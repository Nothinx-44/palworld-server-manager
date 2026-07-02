const path = require('path');
const { readJson, updateJson } = require('./jsonStore');
const { DATA_DIR } = require('./paths');

// L'API REST Palworld sait bannir/débannir mais n'expose aucune route pour lister les bannis.
// On tient donc notre propre liste ici, pour pouvoir afficher qui est banni et proposer un unban.
const BANS_FILE = path.join(DATA_DIR, 'bans.json');

function list() {
  return readJson(BANS_FILE, []);
}

function add(userId, name, by) {
  return updateJson(BANS_FILE, [], bans => {
    if (!bans.find(b => b.userId === userId)) {
      bans.unshift({ userId, name: name || userId, ts: new Date().toISOString(), by });
    }
    return bans;
  });
}

function remove(userId) {
  return updateJson(BANS_FILE, [], bans => bans.filter(b => b.userId !== userId));
}

module.exports = { list, add, remove };
