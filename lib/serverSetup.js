const fs = require('fs');
const path = require('path');
const https = require('https');
const { execFile, spawn } = require('child_process');

const { runNssm, getNssmPath, getServiceName } = require('./palworldClient');
const { updateEnvFile } = require('./envFile');

const APP_ID = '2394010';
const STEAMCMD_ZIP_URL = 'https://steamcdn-a.akamaihd.net/client/installer/steamcmd.zip';
const FIREWALL_RULE_NAME = 'Palworld Server';

// ---------- Utilitaires ----------

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// PalWorldSettings.ini stocke tous les réglages sur une seule ligne
// OptionSettings=(Cle1=val1,Cle2="val2",...). On remplace uniquement la valeur de la clé visée
// en s'ancrant sur le délimiteur précédent ("(" ou ",") pour ne pas confondre deux clés dont
// l'une est un suffixe de l'autre (ex: PublicPort / RESTAPIPort).
function setIniOption(content, key, value, { quoted = false } = {}) {
  const formattedValue = quoted ? `"${String(value).replace(/"/g, '')}"` : String(value);
  const pattern = new RegExp(`([,(]${escapeRegex(key)}=)("[^"]*"|[^,)]*)`);
  if (pattern.test(content)) {
    return content.replace(pattern, `$1${formattedValue}`);
  }
  // Clé absente (ne devrait pas arriver sur un fichier généré par le serveur) : on l'ajoute
  // juste avant la parenthèse fermante d'OptionSettings.
  return content.replace(/^OptionSettings=\((.*)\)$/m, (_, inner) => `OptionSettings=(${inner},${key}=${formattedValue})`);
}

function applyIniSettings(iniPath, config) {
  let content = fs.readFileSync(iniPath, 'utf-8');
  content = setIniOption(content, 'ServerName', config.serverName, { quoted: true });
  content = setIniOption(content, 'ServerPassword', config.serverPassword || '', { quoted: true });
  content = setIniOption(content, 'AdminPassword', config.adminPassword, { quoted: true });
  content = setIniOption(content, 'ServerPlayerMaxNum', config.maxPlayers);
  content = setIniOption(content, 'PublicPort', config.port);
  content = setIniOption(content, 'RESTAPIEnabled', 'True');
  content = setIniOption(content, 'RESTAPIPort', config.restApiPort);
  fs.writeFileSync(iniPath, content);
}

function isElevated() {
  return new Promise(resolve => {
    execFile('net', ['session'], error => resolve(!error));
  });
}

function downloadFile(url, destPath, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirectsLeft > 0) {
        res.resume();
        return resolve(downloadFile(res.headers.location, destPath, redirectsLeft - 1));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`Téléchargement échoué (HTTP ${res.statusCode})`));
      }
      const file = fs.createWriteStream(destPath);
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
      file.on('error', reject);
    }).on('error', reject);
  });
}

function extractZip(zipPath, destDir) {
  return new Promise((resolve, reject) => {
    execFile('powershell', ['-NoProfile', '-Command', `Expand-Archive -Path "${zipPath}" -DestinationPath "${destDir}" -Force`], (error, stdout, stderr) => {
      if (error) return reject(new Error(stderr || error.message));
      resolve();
    });
  });
}

// steamcmd peut prendre plusieurs minutes (12-15 Go) : spawn + streaming ligne à ligne au lieu
// d'execFile (qui bufferise tout jusqu'à la fin) pour donner une vraie progression en direct.
function runSteamCmdUpdate(steamCmdExe, serverDir, onLog) {
  return new Promise((resolve, reject) => {
    const proc = spawn(steamCmdExe, ['+force_install_dir', serverDir, '+login', 'anonymous', '+app_update', APP_ID, 'validate', '+quit']);
    let buffer = '';
    const handleData = data => {
      buffer += data.toString();
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop();
      lines.forEach(line => { if (line.trim()) onLog(line.trim()); });
    };
    proc.stdout.on('data', handleData);
    proc.stderr.on('data', handleData);
    proc.on('error', reject);
    proc.on('close', code => {
      if (code !== 0) return reject(new Error(`steamcmd terminé avec le code ${code}`));
      resolve();
    });
  });
}

function firstLaunch(serverDir, onLog) {
  return new Promise((resolve, reject) => {
    const exePath = path.join(serverDir, 'PalServer.exe');
    const configDir = path.join(serverDir, 'Pal', 'Saved', 'Config', 'WindowsServer');
    const proc = spawn(exePath, [], { cwd: serverDir });
    const maxWaitMs = 45000;
    const startedAt = Date.now();

    const timer = setInterval(() => {
      if (fs.existsSync(configDir)) {
        clearInterval(timer);
        proc.kill();
        onLog('Config générée.');
        resolve();
      } else if (Date.now() - startedAt > maxWaitMs) {
        clearInterval(timer);
        proc.kill();
        onLog('Config non détectée après 45s, on continue quand même.');
        resolve();
      }
    }, 2000);

    proc.on('error', err => { clearInterval(timer); reject(err); });
  });
}

async function setupNssmService({ serverDir, serverName, port, maxPlayers }, onLog) {
  const serviceName = getServiceName();
  let exists = true;
  try {
    await runNssm(['status', serviceName]);
  } catch {
    exists = false;
  }

  const appParams = `-ServerName="${serverName}" -port=${port} -players=${maxPlayers} -useperfthreads -NoAsyncLoadingThread -UseMultithreadForDS EpicApp=PalServer`;

  if (!exists) {
    onLog(`Création du service Windows "${serviceName}"...`);
    await runNssm(['install', serviceName, path.join(serverDir, 'PalServer.exe')]);
    await runNssm(['set', serviceName, 'AppParameters', appParams]);
    await runNssm(['set', serviceName, 'AppDirectory', serverDir]);
    await runNssm(['set', serviceName, 'Start', 'SERVICE_DEMAND_START']);
    await runNssm(['set', serviceName, 'AppExit', 'Default', 'Restart']);
    await runNssm(['set', serviceName, 'AppRestartDelay', '5000']);
    onLog('Service créé (démarrage manuel, à contrôler depuis le dashboard).');
  } else {
    onLog(`Service "${serviceName}" déjà existant, mise à jour des paramètres...`);
    await runNssm(['set', serviceName, 'AppParameters', appParams]);
  }
}

function ensureFirewallRule(port, onLog) {
  return new Promise((resolve, reject) => {
    execFile('netsh', ['advfirewall', 'firewall', 'show', 'rule', `name=${FIREWALL_RULE_NAME}`], (error, stdout) => {
      if (!error && /Palworld Server/i.test(stdout || '')) {
        onLog('Règle de pare-feu déjà présente, ok.');
        return resolve();
      }
      execFile('netsh', ['advfirewall', 'firewall', 'add', 'rule', `name=${FIREWALL_RULE_NAME}`, 'dir=in', 'action=allow', 'protocol=UDP', `localport=${port}`], err2 => {
        if (err2) return reject(err2);
        onLog('Règle de pare-feu ajoutée.');
        resolve();
      });
    });
  });
}

// ---------- API publique ----------

// Complète les champs non fournis par l'utilisateur avec des valeurs par défaut cohérentes
// avec .env.example / server-setup/install-palworld-server.ps1.
function normalizeConfig(body = {}) {
  const installDir = body.installDir || 'D:\\PalworldServer';
  return {
    installDir,
    steamCmdDir: body.steamCmdDir || path.join(installDir, 'SteamCMD'),
    nssmPath: body.nssmPath || getNssmPath(),
    serviceName: body.serviceName || getServiceName(),
    serverName: body.serverName || 'Serveur Palworld',
    serverPassword: body.serverPassword || '',
    adminPassword: body.adminPassword,
    maxPlayers: parseInt(body.maxPlayers, 10) || 8,
    port: parseInt(body.port, 10) || 8211,
    restApiPort: parseInt(body.restApiPort, 10) || 8212,
    backupDir: body.backupDir || path.join(installDir, 'Backups')
  };
}

async function getStatus() {
  const serverDir = process.env.PALWORLD_INSTALL_DIR || '';
  const steamCmdExe = process.env.STEAMCMD_PATH || '';
  const settingsFile = serverDir
    ? path.join(serverDir, 'Pal', 'Saved', 'Config', 'WindowsServer', 'PalWorldSettings.ini')
    : '';

  let restApiConfigured = false;
  if (settingsFile && fs.existsSync(settingsFile)) {
    restApiConfigured = /RESTAPIEnabled=True/i.test(fs.readFileSync(settingsFile, 'utf-8'));
  }

  let serviceRegistered = false;
  try {
    await runNssm(['status', getServiceName()]);
    serviceRegistered = true;
  } catch {
    serviceRegistered = false;
  }

  return {
    elevated: await isElevated(),
    steamCmdPresent: !!steamCmdExe && fs.existsSync(steamCmdExe),
    serverInstalled: !!serverDir && fs.existsSync(path.join(serverDir, 'PalServer.exe')),
    serviceRegistered,
    restApiConfigured,
    current: {
      installDir: serverDir ? path.dirname(serverDir) : '',
      steamCmdDir: steamCmdExe ? path.dirname(steamCmdExe) : '',
      nssmPath: getNssmPath(),
      serviceName: getServiceName(),
      backupDir: process.env.BACKUP_DIR || '',
      port: 8211,
      restApiPort: 8212,
      maxPlayers: 8
    }
  };
}

async function runInstall(config, onLog) {
  // Fixés dès le début (et pas seulement à la fin via updateEnvFile) car setupNssmService()
  // s'appuie sur runNssm(), qui lit NSSM_PATH/SERVICE_NAME depuis process.env à l'appel.
  process.env.NSSM_PATH = config.nssmPath;
  process.env.SERVICE_NAME = config.serviceName;

  const serverDir = path.join(config.installDir, 'Server');
  const steamCmdExe = path.join(config.steamCmdDir, 'steamcmd.exe');

  onLog('=== Installation du serveur Palworld ===');

  if (!fs.existsSync(steamCmdExe)) {
    onLog('[1/7] SteamCMD introuvable, téléchargement...');
    fs.mkdirSync(config.steamCmdDir, { recursive: true });
    const zipPath = path.join(config.steamCmdDir, 'steamcmd.zip');
    await downloadFile(STEAMCMD_ZIP_URL, zipPath);
    await extractZip(zipPath, config.steamCmdDir);
    fs.unlinkSync(zipPath);
    onLog('SteamCMD installé.');
  } else {
    onLog('[1/7] SteamCMD déjà présent, ok.');
  }

  onLog(`[2/7] Téléchargement du serveur Palworld (App ID ${APP_ID})... (12-15 Go, ça peut prendre un moment)`);
  await runSteamCmdUpdate(steamCmdExe, serverDir, onLog);
  if (!fs.existsSync(path.join(serverDir, 'PalServer.exe'))) {
    throw new Error('Échec : PalServer.exe introuvable après l\'installation SteamCMD.');
  }
  onLog('Serveur Palworld installé/à jour.');

  const configDir = path.join(serverDir, 'Pal', 'Saved', 'Config', 'WindowsServer');
  const settingsFile = path.join(configDir, 'PalWorldSettings.ini');
  const defaultSettingsFile = path.join(serverDir, 'DefaultPalWorldSettings.ini');

  if (!fs.existsSync(configDir)) {
    onLog('[3/7] Premier lancement pour générer la config...');
    await firstLaunch(serverDir, onLog);
  } else {
    onLog('[3/7] Config déjà générée, ok.');
  }

  onLog('[4/7] Configuration de PalWorldSettings.ini...');
  if (fs.existsSync(defaultSettingsFile) && (!fs.existsSync(settingsFile) || fs.statSync(settingsFile).size <= 10)) {
    fs.copyFileSync(defaultSettingsFile, settingsFile);
  }
  applyIniSettings(settingsFile, config);
  onLog('Réglages appliqués (nom, mots de passe, joueurs max, ports, API REST activée).');

  fs.mkdirSync(config.backupDir, { recursive: true });

  onLog('[5/7] Configuration du service Windows...');
  await setupNssmService({ serverDir, serverName: config.serverName, port: config.port, maxPlayers: config.maxPlayers }, onLog);

  onLog(`[6/7] Règle de pare-feu (port ${config.port}/UDP)...`);
  await ensureFirewallRule(config.port, onLog);

  onLog('[7/7] Mise à jour de la configuration du dashboard (.env)...');
  updateEnvFile({
    NSSM_PATH: config.nssmPath,
    SERVICE_NAME: config.serviceName,
    SAVE_PATH: path.join(serverDir, 'Pal', 'Saved', 'SaveGames'),
    BACKUP_DIR: config.backupDir,
    STEAMCMD_PATH: steamCmdExe,
    PALWORLD_INSTALL_DIR: serverDir,
    PALWORLD_API_URL: `http://127.0.0.1:${config.restApiPort}`,
    PALWORLD_API_PASSWORD: config.adminPassword
  });

  onLog('=== Installation terminée avec succès — le dashboard est prêt à gérer ce serveur ===');
}

module.exports = { getStatus, runInstall, normalizeConfig, setIniOption, isElevated };
