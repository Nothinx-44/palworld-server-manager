const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { freeSpace } = require('../lib/diskSpace');

test('freeSpace renvoie des valeurs cohérentes pour un dossier existant', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'palworld-diskspace-'));
  const result = freeSpace(dir);
  assert.ok(result, 'devrait renvoyer un résultat sur un dossier réel');
  assert.ok(result.freeBytes > 0);
  assert.ok(result.totalBytes >= result.freeBytes);
});

test('freeSpace renvoie null pour un chemin inexistant', () => {
  const result = freeSpace('Z:\\ce\\chemin\\n-existe-vraiment-pas\\du-tout');
  assert.strictEqual(result, null);
});
