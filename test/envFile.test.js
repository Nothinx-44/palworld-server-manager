const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Doit être défini avant le require : paths.js fige HOME (donc ENV_FILE) au chargement
const HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'palworld-env-'));
process.env.PALWORLD_DASHBOARD_HOME = HOME;
const { updateEnvFile, ENV_FILE } = require('../lib/envFile');

test('crée le .env (basé sur .env.example) et écrit la clé', () => {
  updateEnvFile({ PORT: '3100' });
  const content = fs.readFileSync(ENV_FILE, 'utf-8');
  assert.match(content, /^PORT=3100$/m);
  assert.strictEqual(process.env.PORT, '3100');
});

test('met à jour une clé existante sans dupliquer la ligne', () => {
  updateEnvFile({ PORT: '3200' });
  const content = fs.readFileSync(ENV_FILE, 'utf-8');
  assert.strictEqual(content.match(/^PORT=/gm).length, 1);
  assert.match(content, /^PORT=3200$/m);
});

test('quote les valeurs contenant un # (sinon dotenv les tronque en commentaire)', () => {
  updateEnvFile({ PALWORLD_API_PASSWORD: 'super#secret' });
  const content = fs.readFileSync(ENV_FILE, 'utf-8');
  assert.match(content, /^PALWORLD_API_PASSWORD="super#secret"$/m);
  // Vérifie que dotenv relit bien la valeur complète
  const parsed = require('dotenv').parse(content);
  assert.strictEqual(parsed.PALWORLD_API_PASSWORD, 'super#secret');
});

test('ne quote pas les chemins Windows (l\'expansion \\n de dotenv les corromprait)', () => {
  updateEnvFile({ SAVE_PATH: 'D:\\nouveau\\SaveGames' });
  const content = fs.readFileSync(ENV_FILE, 'utf-8');
  assert.match(content, /^SAVE_PATH=D:\\nouveau\\SaveGames$/m);
  const parsed = require('dotenv').parse(content);
  assert.strictEqual(parsed.SAVE_PATH, 'D:\\nouveau\\SaveGames');
});
