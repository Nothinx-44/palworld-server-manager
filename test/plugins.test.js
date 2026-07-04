const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'palworld-plugins-'));
const plugins = require('../lib/plugins');

function setupServerDir() {
  const installDir = fs.mkdtempSync(path.join(os.tmpdir(), 'palworld-plugins-server-'));
  process.env.PALWORLD_INSTALL_DIR = installDir;
  const binDir = path.join(installDir, 'Pal', 'Binaries', 'Win64');
  fs.mkdirSync(binDir, { recursive: true });
  return binDir;
}

test('getBinariesDir pointe vers Pal/Binaries/Win64', () => {
  process.env.PALWORLD_INSTALL_DIR = 'D:\\Serveur';
  assert.strictEqual(plugins.getBinariesDir(), path.join('D:\\Serveur', 'Pal', 'Binaries', 'Win64'));
});

test('getBinariesDir vide si PALWORLD_INSTALL_DIR non configuré', () => {
  delete process.env.PALWORLD_INSTALL_DIR;
  assert.strictEqual(plugins.getBinariesDir(), '');
});

test('getStatus : non installé par défaut', () => {
  setupServerDir();
  assert.deepStrictEqual(plugins.getStatus('ue4ss'), { installed: false, installedVersion: null });
});

test('getStatus détecte via le fichier marqueur', () => {
  const binDir = setupServerDir();
  fs.writeFileSync(path.join(binDir, 'UE4SS.dll'), 'faux contenu');
  assert.strictEqual(plugins.getStatus('ue4ss').installed, true);
  assert.strictEqual(plugins.getStatus('paldefender').installed, false);
});

test('uninstall retire les fichiers propres au plugin mais pas Mods/', () => {
  const binDir = setupServerDir();
  ['dwmapi.dll', 'UE4SS.dll', 'UE4SS-settings.ini'].forEach(f => fs.writeFileSync(path.join(binDir, f), 'x'));
  fs.mkdirSync(path.join(binDir, 'Mods', 'UnMod'), { recursive: true });
  fs.writeFileSync(path.join(binDir, 'Mods', 'UnMod', 'main.lua'), 'x');

  plugins.uninstall('ue4ss');

  assert.strictEqual(fs.existsSync(path.join(binDir, 'UE4SS.dll')), false);
  assert.strictEqual(fs.existsSync(path.join(binDir, 'dwmapi.dll')), false);
  assert.strictEqual(fs.existsSync(path.join(binDir, 'Mods', 'UnMod', 'main.lua')), true, 'Mods/ ne doit pas être supprimé');
  assert.strictEqual(plugins.getStatus('ue4ss').installedVersion, null);
});

test('les deux plugins utilisent des fichiers marqueurs différents (pas de collision)', () => {
  assert.notStrictEqual(plugins.PLUGINS.ue4ss.markerFile, plugins.PLUGINS.paldefender.markerFile);
  const ue4ssFiles = new Set(plugins.PLUGINS.ue4ss.coreFiles);
  const overlap = plugins.PLUGINS.paldefender.coreFiles.filter(f => ue4ssFiles.has(f));
  assert.deepStrictEqual(overlap, []);
});

function restConfigPath(binDir) {
  return path.join(binDir, 'PalDefender', 'RESTAPI', 'RESTConfig.json');
}

test('enablePalDefenderRestApi : crée une config activée quand aucune n\'existe', () => {
  const binDir = setupServerDir();
  plugins.enablePalDefenderRestApi(binDir);
  const cfg = JSON.parse(fs.readFileSync(restConfigPath(binDir), 'utf-8'));
  assert.strictEqual(cfg.Enabled, true);
  assert.strictEqual(cfg.Address, '127.0.0.1');
  assert.strictEqual(cfg.Port, 17993);
});

test('enablePalDefenderRestApi : active une config existante sans perdre les autres clés', () => {
  const binDir = setupServerDir();
  const configPath = restConfigPath(binDir);
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify({ Enabled: false, Address: '0.0.0.0', Port: 17993, CustomKey: 42 }));

  plugins.enablePalDefenderRestApi(binDir);

  const cfg = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  assert.strictEqual(cfg.Enabled, true);
  assert.strictEqual(cfg.Address, '127.0.0.1', 'une écoute 0.0.0.0 doit être corrigée en local');
  assert.strictEqual(cfg.CustomKey, 42, 'les autres clés doivent être préservées');
});

test('enablePalDefenderRestApi : préserve une adresse déjà personnalisée (non 0.0.0.0)', () => {
  const binDir = setupServerDir();
  const configPath = restConfigPath(binDir);
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify({ Enabled: false, Address: '10.0.0.5', Port: 17993 }));

  plugins.enablePalDefenderRestApi(binDir);

  const cfg = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  assert.strictEqual(cfg.Address, '10.0.0.5');
});
