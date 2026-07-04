const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { downloadFile, extractZip } = require('./download');
const { readJson, writeJson } = require('./jsonStore');
const { DATA_DIR } = require('./paths');

// Plugins tiers optionnels, installés directement depuis leurs releases GitHub officielles
// (même principe que SteamCMD/NSSM/Node dans ce projet : téléchargement à la demande, jamais
// redistribué/hébergé par nous). Les deux utilisent des DLL de proxy DIFFÉRENTES (dwmapi.dll vs
// d3d9.dll) : pas de collision de fichier entre elles. PalDefender.dll et UE4SS.dll (binaires
// compilés par leurs auteurs respectifs) sont fermés, contrairement au reste du code du projet.
const STATE_FILE = path.join(DATA_DIR, 'plugins.json');

const PLUGINS = {
  ue4ss: {
    label: 'UE4SS',
    repo: 'UE4SS-RE/RE-UE4SS',
    assetPattern: /^UE4SS_v[\d.]+\.zip$/,
    // Fichiers propres au loader : le dossier Mods/ n'est PAS supprimé à la désinstallation
    // (il peut contenir des mods ajoutés par l'utilisateur en plus de ceux fournis par défaut).
    coreFiles: ['dwmapi.dll', 'UE4SS.dll', 'UE4SS-settings.ini'],
    markerFile: 'UE4SS.dll'
  },
  paldefender: {
    label: 'PalDefender',
    repo: 'Ultimeit/PalDefender',
    assetPattern: /^PalDefender\.zip$/,
    coreFiles: ['PalDefender.dll', 'd3d9.dll'],
    markerFile: 'PalDefender.dll'
  }
};

// Dossier où vivent les DLL du jeu (PalServer-Win64-Shipping.exe) : c'est là, et non à la racine
// de PALWORLD_INSTALL_DIR (qui contient le lanceur PalServer.exe), que UE4SS/PalDefender
// s'installent.
function getBinariesDir() {
  const serverDir = process.env.PALWORLD_INSTALL_DIR || '';
  return serverDir ? path.join(serverDir, 'Pal', 'Binaries', 'Win64') : '';
}

function loadState() {
  return readJson(STATE_FILE, {});
}

function isInstalled(name) {
  const dir = getBinariesDir();
  return !!dir && fs.existsSync(path.join(dir, PLUGINS[name].markerFile));
}

function getStatus(name) {
  const state = loadState();
  return {
    installed: isInstalled(name),
    installedVersion: (state[name] && state[name].version) || null
  };
}

async function getLatestRelease(name) {
  const { repo, assetPattern, label } = PLUGINS[name];
  const res = await axios.get(`https://api.github.com/repos/${repo}/releases/latest`, { timeout: 10000 });
  const asset = res.data.assets.find(a => assetPattern.test(a.name));
  if (!asset) throw new Error(`Aucun asset correspondant trouvé pour ${label}`);
  return { version: res.data.tag_name, url: asset.browser_download_url, assetName: asset.name };
}

// Active l'API REST de PalDefender (Enabled: true) en écoute locale uniquement. PalDefender ne
// génère RESTConfig.json qu'au premier lancement du serveur après installation (voir sa doc :
// "Start your server once to generate the file structure") : si le fichier n'existe pas encore,
// on pré-crée le dossier avec une config par défaut déjà activée, pour que rien à faire de plus
// après ce premier lancement ; s'il existe déjà (réinstallation/mise à jour), on active dessus en
// préservant le reste (et on corrige une éventuelle écoute 0.0.0.0, exposée à tout le réseau).
function enablePalDefenderRestApi(dir) {
  const restDir = path.join(dir, 'PalDefender', 'RESTAPI');
  const configPath = path.join(restDir, 'RESTConfig.json');
  fs.mkdirSync(restDir, { recursive: true });

  let cfg = null;
  if (fs.existsSync(configPath)) {
    try { cfg = JSON.parse(fs.readFileSync(configPath, 'utf-8')); } catch { cfg = null; }
  }
  if (!cfg) {
    cfg = {
      Version: { Major: 1, Minor: 0, Patch: 0 },
      Enabled: true,
      Address: '127.0.0.1',
      Port: 17993,
      Cors: { Comment: 'Do not change those unless you know what you are doing!', 'Allowed-Origins': '*', 'Max-Age': 86400 }
    };
  } else {
    cfg.Enabled = true;
    if (!cfg.Address || cfg.Address === '0.0.0.0') cfg.Address = '127.0.0.1';
  }
  fs.writeFileSync(configPath, JSON.stringify(cfg, null, 4));
}

async function install(name, onLog = () => {}) {
  const dir = getBinariesDir();
  if (!dir) throw new Error('Serveur non installé (PALWORLD_INSTALL_DIR manquant).');
  fs.mkdirSync(dir, { recursive: true });

  onLog(`Recherche de la dernière version de ${PLUGINS[name].label}...`);
  const latest = await getLatestRelease(name);
  onLog(`Téléchargement de ${latest.assetName} (${latest.version})...`);

  const tmpZip = path.join(dir, `_${name}-download.zip`);
  await downloadFile(latest.url, tmpZip);
  onLog('Extraction...');
  await extractZip(tmpZip, dir);
  fs.unlinkSync(tmpZip);

  if (name === 'paldefender') {
    enablePalDefenderRestApi(dir);
    onLog("API REST de PalDefender activée (écoute locale). Un jeton reste à créer/coller dans l'onglet Plugins.");
  }

  const state = loadState();
  state[name] = { version: latest.version, installedAt: new Date().toISOString() };
  writeJson(STATE_FILE, state);
  onLog(`${PLUGINS[name].label} ${latest.version} installé.`);
  return latest.version;
}

function uninstall(name) {
  const dir = getBinariesDir();
  if (dir) {
    PLUGINS[name].coreFiles.forEach(f => {
      const p = path.join(dir, f);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    });
  }
  const state = loadState();
  delete state[name];
  writeJson(STATE_FILE, state);
}

// NOTE : pas de détection/lecture automatique du jeton PalDefender ici (contrairement à
// l'activation de l'API ci-dessus, lire un jeton d'authentification pour le réutiliser reste
// plus sensible). L'admin le colle manuellement dans l'onglet Plugins.

module.exports = { PLUGINS, getBinariesDir, getStatus, getLatestRelease, install, uninstall, enablePalDefenderRestApi };
