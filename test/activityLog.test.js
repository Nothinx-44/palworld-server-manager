const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Doit être défini avant le require : activityLog.js fige le chemin au chargement
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'palworld-activity-'));
const activityLog = require('../lib/activityLog');

test('les entrées sont ajoutées en tête (plus récentes d\'abord)', async () => {
  await activityLog.log('vincent', 'start');
  await activityLog.log('copain', 'backup', 'backup_test.zip');
  const entries = activityLog.list();
  assert.strictEqual(entries[0].username, 'copain');
  assert.strictEqual(entries[0].action, 'backup');
  assert.strictEqual(entries[0].details, 'backup_test.zip');
  assert.strictEqual(entries[1].username, 'vincent');
});

test('list respecte la limite demandée', async () => {
  for (let i = 0; i < 10; i++) await activityLog.log('vincent', 'announce', `msg ${i}`);
  assert.strictEqual(activityLog.list(5).length, 5);
});

test('le journal est plafonné à 500 entrées', async () => {
  // On écrit directement 499 entrées puis on en ajoute via log() pour dépasser le plafond
  const { writeJson } = require('../lib/jsonStore');
  const logFile = path.join(process.env.DATA_DIR, 'activity-log.json');
  writeJson(logFile, Array.from({ length: 499 }, (_, i) => ({ ts: '', username: 'x', action: 'a', details: String(i) })));
  await activityLog.log('vincent', 'kick');
  await activityLog.log('vincent', 'stop');
  const entries = activityLog.list(1000);
  assert.strictEqual(entries.length, 500);
  assert.strictEqual(entries[0].action, 'stop'); // la plus récente est conservée
});

test('des écritures concurrentes ne se perdent pas mutuellement', async () => {
  const before = activityLog.list(1000).length;
  await Promise.all(Array.from({ length: 25 }, (_, i) => activityLog.log('vincent', 'announce', `concurrent ${i}`)));
  assert.strictEqual(activityLog.list(1000).length, Math.min(500, before + 25));
});
