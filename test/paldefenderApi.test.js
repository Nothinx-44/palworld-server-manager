const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'palworld-pdapi-'));
const plugins = require('../lib/plugins');
const { COMMANDS } = require('../lib/paldefenderApi');

function setupServerDir() {
  const installDir = fs.mkdtempSync(path.join(os.tmpdir(), 'palworld-pdapi-server-'));
  process.env.PALWORLD_INSTALL_DIR = installDir;
  const restDir = path.join(installDir, 'Pal', 'Binaries', 'Win64', 'PalDefender', 'RESTAPI');
  fs.mkdirSync(restDir, { recursive: true });
  return restDir;
}

test('getPalDefenderApiStatus : rien configuré sans RESTConfig.json', () => {
  delete process.env.PALWORLD_INSTALL_DIR;
  delete process.env.PALDEFENDER_API_TOKEN;
  assert.deepStrictEqual(plugins.getPalDefenderApiStatus(), { configFileExists: false, tokenConfigured: false });
});

test('configurePalDefenderApi rejette si RESTConfig.json est absent', () => {
  const restDir = setupServerDir();
  fs.rmSync(restDir, { recursive: true, force: true }); // simule "jamais lancé"
  assert.throws(() => plugins.configurePalDefenderApi(), /RESTConfig\.json introuvable/);
});

test('configurePalDefenderApi active Enabled, crée un token, et écrit le .env', () => {
  const restDir = setupServerDir();
  fs.writeFileSync(path.join(restDir, 'RESTConfig.json'), JSON.stringify({ Enabled: false, SomeOtherKey: 42 }));

  const result = plugins.configurePalDefenderApi();
  assert.strictEqual(result.restartRequired, true);

  const config = JSON.parse(fs.readFileSync(path.join(restDir, 'RESTConfig.json'), 'utf-8'));
  assert.strictEqual(config.Enabled, true);
  assert.strictEqual(config.SomeOtherKey, 42, 'les autres clés doivent être préservées');

  const tokenFile = path.join(restDir, 'Tokens', 'DashboardToken.json');
  assert.ok(fs.existsSync(tokenFile));
  const tokenData = JSON.parse(fs.readFileSync(tokenFile, 'utf-8'));
  assert.strictEqual(tokenData.Permissions[0], 'REST.*');
  assert.ok(tokenData.Token.length >= 32);

  assert.strictEqual(process.env.PALDEFENDER_API_TOKEN, tokenData.Token);
  assert.strictEqual(process.env.PALDEFENDER_API_URL, 'http://127.0.0.1:17993');

  const status = plugins.getPalDefenderApiStatus();
  assert.deepStrictEqual(status, { configFileExists: true, tokenConfigured: true });
});

test('COMMANDS : chaque commande a un label et une fonction run', () => {
  Object.entries(COMMANDS).forEach(([key, cmd]) => {
    assert.ok(cmd.label, `${key} doit avoir un label`);
    assert.strictEqual(typeof cmd.run, 'function', `${key}.run doit être une fonction`);
  });
});

test('COMMANDS : les commandes cibllant un joueur/IP sont marquées correctement', () => {
  assert.strictEqual(COMMANDS.kick.needsPlayer, true);
  assert.strictEqual(COMMANDS.banip.needsIp, true);
  assert.ok(!COMMANDS.broadcast.needsPlayer && !COMMANDS.broadcast.needsIp, 'broadcast ne cible ni joueur ni IP');
});
