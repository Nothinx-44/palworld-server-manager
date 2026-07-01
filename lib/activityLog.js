const path = require('path');
const { readJson, updateJson } = require('./jsonStore');

// DATA_DIR surchargeable via l'environnement, principalement pour les tests
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const LOG_FILE = path.join(DATA_DIR, 'activity-log.json');
const MAX_ENTRIES = 500;

function log(username, action, details = '') {
  return updateJson(LOG_FILE, [], entries => {
    entries.unshift({ ts: new Date().toISOString(), username, action, details });
    return entries.slice(0, MAX_ENTRIES);
  }).catch(err => console.error("Écriture du journal d'activité échouée:", err.message || err));
}

function list(limit = 50) {
  return readJson(LOG_FILE, []).slice(0, limit);
}

module.exports = { log, list };
