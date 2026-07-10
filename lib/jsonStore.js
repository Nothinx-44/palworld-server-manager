const fs = require('fs');
const path = require('path');

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return fallback;
  }
}

// Écrit dans un fichier temporaire puis renomme : évite un JSON tronqué/corrompu
// si le process est tué en plein milieu de l'écriture.
function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2));
  fs.renameSync(tmpPath, filePath);
}

// ---------- Verrou inter-process ----------
// La file d'attente updateQueues (plus bas) ne protège qu'au sein d'un même process. Or deux
// process peuvent écrire les mêmes fichiers : le dashboard (service Windows) et l'appli desktop
// (création de compte). Un fichier .lock créé en mode exclusif (wx) sert de verrou entre eux.
const LOCK_TIMEOUT_MS = 3000;
const LOCK_STALE_MS = 10000; // verrou plus vieux que ça = process mort, on le casse

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function tryAcquire(lockPath) {
  try {
    fs.mkdirSync(path.dirname(lockPath), { recursive: true });
    const fd = fs.openSync(lockPath, 'wx');
    fs.writeSync(fd, String(process.pid));
    fs.closeSync(fd);
    return true;
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
    try {
      if (Date.now() - fs.statSync(lockPath).mtimeMs > LOCK_STALE_MS) fs.unlinkSync(lockPath);
    } catch (_) {}
    return false;
  }
}

function releaseLock(lockPath) {
  try { fs.unlinkSync(lockPath); } catch (_) {}
}

function acquireLockSync(filePath) {
  const lockPath = `${filePath}.lock`;
  const start = Date.now();
  while (!tryAcquire(lockPath)) {
    if (Date.now() - start > LOCK_TIMEOUT_MS) throw new Error(`Verrou inter-process non obtenu : ${lockPath}`);
    sleepSync(15);
  }
  return () => releaseLock(lockPath);
}

async function acquireLock(filePath) {
  const lockPath = `${filePath}.lock`;
  const start = Date.now();
  while (!tryAcquire(lockPath)) {
    if (Date.now() - start > LOCK_TIMEOUT_MS) throw new Error(`Verrou inter-process non obtenu : ${lockPath}`);
    await new Promise(resolve => setTimeout(resolve, 15));
  }
  return () => releaseLock(lockPath);
}

// ---------- Mises à jour lecture-modification-écriture ----------
// File d'attente par fichier : sérialise les cycles lecture-modification-écriture pour
// qu'une mise à jour ne puisse pas en écraser une autre lancée en parallèle. L'atomicité
// devient ainsi structurelle, au lieu de dépendre de l'absence de `await` entre la lecture
// et l'écriture chez chaque appelant. Le verrou inter-process couvre l'autre process.
const updateQueues = new Map();

function updateJson(filePath, fallback, mutate) {
  const prev = updateQueues.get(filePath) || Promise.resolve();
  const next = prev.then(async () => {
    const release = await acquireLock(filePath);
    try {
      const data = readJson(filePath, fallback);
      const result = await mutate(data);
      const toWrite = result === undefined ? data : result;
      writeJson(filePath, toWrite);
      return toWrite;
    } finally {
      release();
    }
  });
  // La file ne doit pas rester bloquée si une mise à jour échoue
  updateQueues.set(filePath, next.catch(() => {}));
  return next;
}

// Variante synchrone, pour les appelants à l'API sync (users.js) : mêmes garanties.
function updateJsonSync(filePath, fallback, mutate) {
  const release = acquireLockSync(filePath);
  try {
    const data = readJson(filePath, fallback);
    const result = mutate(data);
    const toWrite = result === undefined ? data : result;
    writeJson(filePath, toWrite);
    return toWrite;
  } finally {
    release();
  }
}

module.exports = { readJson, writeJson, updateJson, updateJsonSync, acquireLockSync };
