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

function runNssm(args) {
  return new Promise((resolve, reject) => {
    execFile(getNssmPath(), args, (error, stdout, stderr) => {
      if (error) return reject(stderr || error.message);
      resolve(stdout);
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

module.exports = { getPalworldApi, runNssm, isServiceRunning, gracefulStop, getNssmPath, getServiceName };
