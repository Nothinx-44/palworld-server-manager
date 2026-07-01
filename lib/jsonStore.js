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

// File d'attente par fichier : sérialise les cycles lecture-modification-écriture pour
// qu'une mise à jour ne puisse pas en écraser une autre lancée en parallèle. L'atomicité
// devient ainsi structurelle, au lieu de dépendre de l'absence de `await` entre la lecture
// et l'écriture chez chaque appelant.
const updateQueues = new Map();

function updateJson(filePath, fallback, mutate) {
  const prev = updateQueues.get(filePath) || Promise.resolve();
  const next = prev.then(async () => {
    const data = readJson(filePath, fallback);
    const result = await mutate(data);
    const toWrite = result === undefined ? data : result;
    writeJson(filePath, toWrite);
    return toWrite;
  });
  // La file ne doit pas rester bloquée si une mise à jour échoue
  updateQueues.set(filePath, next.catch(() => {}));
  return next;
}

module.exports = { readJson, writeJson, updateJson };
