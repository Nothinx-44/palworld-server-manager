const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

// HOME dédié : le .env n'existe pas encore, updateEnvFile va l'amorcer depuis .env.example
const HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'palworld-envseed-'));
process.env.PALWORLD_DASHBOARD_HOME = HOME;
const { updateEnvFile, ENV_FILE } = require('../lib/envFile');

test('l\'amorçage vide les valeurs d\'exemple au lieu de les copier comme réelles', () => {
  updateEnvFile({ PORT: '3000' });
  const content = fs.readFileSync(ENV_FILE, 'utf-8');
  // Les placeholders de .env.example ne doivent pas devenir des valeurs "réelles"
  assert.match(content, /^SAVE_PATH=$/m);
  assert.match(content, /^SESSION_SECRET=$/m);
  assert.match(content, /^PALWORLD_API_PASSWORD=$/m);
  assert.match(content, /^NSSM_PATH=$/m);
  // Les valeurs sûres de l'exemple sont conservées (défauts fonctionnels)
  assert.match(content, /^PALWORLD_API_URL=http:\/\/127\.0\.0\.1:8212$/m);
  // Les commentaires du fichier d'exemple sont préservés
  assert.match(content, /# --- Sauvegardes ---/);
});

test('les amorçages suivants ne re-vident pas les valeurs déjà renseignées', () => {
  updateEnvFile({ SAVE_PATH: 'D:\\Serveur\\SaveGames' });
  updateEnvFile({ PORT: '3001' }); // .env existe maintenant : pas de re-seed
  const content = fs.readFileSync(ENV_FILE, 'utf-8');
  assert.match(content, /^SAVE_PATH=D:\\Serveur\\SaveGames$/m);
  assert.match(content, /^PORT=3001$/m);
});
