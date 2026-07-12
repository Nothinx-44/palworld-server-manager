const axios = require('axios');
const { execFile } = require('child_process');

// Lus dynamiquement à chaque appel (et non figés au chargement du module) pour que l'assistant
// d'installation puisse mettre à jour le .env à chaud, sans redémarrer le dashboard.
function getNssmPath() {
  return process.env.NSSM_PATH || 'nssm.exe';
}

function getServiceName() {
  return process.env.SERVICE_NAME || 'PalworldServer';
}

function getPalworldApi() {
  return axios.create({
    baseURL: process.env.PALWORLD_API_URL || 'http://127.0.0.1:8212',
    auth: {
      username: process.env.PALWORLD_API_USER || 'admin',
      password: process.env.PALWORLD_API_PASSWORD || ''
    },
    timeout: 8000,
    validateStatus: () => true
  });
}

// NSSM écrit sa sortie en UTF-16LE : décodée en UTF-8 (défaut d'execFile), chaque lettre se
// retrouve suivie d'un octet nul, ce qui rend les messages illisibles dans les logs ("P a l...")
// ET casse toute détection par motif en aval (ex : /PENDING/ ne matchera jamais "P E N...").
// On retire ces octets nuls à la source. String.fromCharCode(0) plutôt qu'un littéral, pour
// qu'aucun caractère invisible ne se cache dans ce fichier source.
const NUL_CHARS = new RegExp(String.fromCharCode(0), 'g');
function cleanNssmOutput(text) {
  return String(text || '').replace(NUL_CHARS, '');
}

function runNssm(args) {
  return new Promise((resolve, reject) => {
    execFile(getNssmPath(), args, (error, stdout, stderr) => {
      if (error) return reject(new Error(cleanNssmOutput(stderr).trim() || error.message));
      resolve(cleanNssmOutput(stdout));
    });
  });
}

async function isServiceRunning() {
  try {
    const out = await runNssm(['status', getServiceName()]);
    return out.includes('SERVICE_RUNNING');
  } catch {
    return false;
  }
}

async function gracefulStop(message, waittime = 10) {
  const palworldApi = getPalworldApi();
  await palworldApi.post('/v1/api/save', {});
  await palworldApi.post('/v1/api/shutdown', { waittime, message });
}

// PalServer.exe n'est qu'un lanceur : il démarre un process enfant
// (PalServer-Win64-Shipping-Cmd.exe) qui ouvre réellement le port du jeu (voir même remarque dans
// serverSetup.killTree). NSSM ne suit que le PID de PalServer.exe : un `nssm stop`/`restart` peut
// donc laisser cet enfant orphelin tourner, port toujours occupé — la nouvelle instance démarrée
// par NSSM ne peut alors jamais devenir joignable, et le watchdog la redémarre en boucle infinie
// (observé en usage réel). On force donc la mort de tout l'arbre par nom d'image, en plus de
// `nssm stop`, avant de relancer.
function killOrphanGameProcesses() {
  const names = ['PalServer-Win64-Shipping-Cmd.exe', 'PalServer-Win64-Shipping.exe', 'PalServer.exe'];
  return Promise.all(names.map(name => new Promise(resolve => {
    execFile('taskkill', ['/IM', name, '/T', '/F'], () => resolve());
  })));
}

module.exports = { getPalworldApi, runNssm, isServiceRunning, gracefulStop, killOrphanGameProcesses, getNssmPath, getServiceName };
