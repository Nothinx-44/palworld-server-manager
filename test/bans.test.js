const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Doit être défini avant le require : bans.js fige le chemin au chargement
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'palworld-bans-'));
const bans = require('../lib/bans');

test('ajoute un banni avec nom, auteur et horodatage', async () => {
  await bans.add('user-001', 'Copain1', 'vincent');
  const list = bans.list();
  assert.strictEqual(list.length, 1);
  assert.strictEqual(list[0].userId, 'user-001');
  assert.strictEqual(list[0].name, 'Copain1');
  assert.strictEqual(list[0].by, 'vincent');
  assert.ok(list[0].ts);
});

test('ne crée pas de doublon pour un même userId', async () => {
  await bans.add('user-001', 'Copain1', 'vincent');
  assert.strictEqual(bans.list().length, 1);
});

test('utilise le userId comme nom si aucun nom fourni', async () => {
  await bans.add('user-XYZ');
  assert.strictEqual(bans.list().find(b => b.userId === 'user-XYZ').name, 'user-XYZ');
});

test('remove retire le banni ciblé', async () => {
  await bans.remove('user-001');
  assert.strictEqual(bans.list().find(b => b.userId === 'user-001'), undefined);
  assert.ok(bans.list().find(b => b.userId === 'user-XYZ')); // les autres restent
});
