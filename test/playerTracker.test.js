const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Doit être défini avant le require : playerTracker.js fige le chemin au chargement
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'palworld-tracker-'));
const { readJson, writeJson } = require('../lib/jsonStore');
const playerTracker = require('../lib/playerTracker');

const HISTORY_FILE = path.join(process.env.DATA_DIR, 'player-history.json');
const INTERVAL_MS = 60000;

test('recoverOpenSessions clôture les sessions périmées et préserve les fraîches', async () => {
  const now = Date.now();
  const iso = ms => new Date(ms).toISOString();

  writeJson(HISTORY_FILE, {
    sessions: [
      // Session fraîche : joueur vu il y a 30 s (simple redémarrage du dashboard) -> reste ouverte
      { userId: 'frais', name: 'Frais', joined: iso(now - 10 * 60000), left: null, lastSeen: iso(now - 30000) },
      // Session périmée : joueur vu pour la dernière fois il y a 45 min -> clôturée à ce moment-là
      { userId: 'perime', name: 'Périmé', joined: iso(now - 120 * 60000), left: null, lastSeen: iso(now - 45 * 60000) },
      // Ancienne session sans lastSeen (format d'avant) : joined fait foi -> clôturée
      { userId: 'ancien', name: 'Ancien', joined: iso(now - 200 * 60000), left: null },
      // Session déjà fermée : intouchée
      { userId: 'ferme', name: 'Fermé', joined: iso(now - 300 * 60000), left: iso(now - 250 * 60000) }
    ],
    totals: { perime: 10 }
  });

  await playerTracker.recoverOpenSessions(INTERVAL_MS);
  const history = readJson(HISTORY_FILE, null);
  const byId = Object.fromEntries(history.sessions.map(s => [s.userId, s]));

  // Fraîche : toujours ouverte, pas de temps crédité
  assert.strictEqual(byId.frais.left, null);
  assert.strictEqual(history.totals.frais, undefined);

  // Périmée : clôturée à lastSeen, durée joined->lastSeen (75 min) ajoutée au total existant
  assert.strictEqual(byId.perime.left, iso(now - 45 * 60000));
  assert.strictEqual(history.totals.perime, 10 + 75);

  // Sans lastSeen : clôturée à joined, 1 min minimum créditée
  assert.strictEqual(byId.ancien.left, byId.ancien.joined);
  assert.strictEqual(history.totals.ancien, 1);

  // Déjà fermée : inchangée
  assert.strictEqual(byId.ferme.left, iso(now - 250 * 60000));
});

test('recoverOpenSessions est sans effet sur un historique vide', async () => {
  fs.rmSync(HISTORY_FILE, { force: true });
  await playerTracker.recoverOpenSessions(INTERVAL_MS);
  assert.deepStrictEqual(playerTracker.totals(), {});
  assert.deepStrictEqual(playerTracker.recentSessions(), []);
});
