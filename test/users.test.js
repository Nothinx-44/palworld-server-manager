const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Doit être défini avant le require : users.js fige le chemin au chargement
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'palworld-users-'));
const users = require('../lib/users');

test('création et vérification de mot de passe', () => {
  users.upsertUser('vincent', 'motdepasse-fort');
  assert.strictEqual(users.verifyPassword('vincent', 'motdepasse-fort'), true);
  assert.strictEqual(users.verifyPassword('vincent', 'mauvais'), false);
  assert.strictEqual(users.verifyPassword('inconnu', 'peu-importe'), false);
});

test('le rôle par défaut est admin, viewer si demandé', () => {
  users.upsertUser('copain', 'un-mot-de-passe', 'viewer');
  assert.strictEqual(users.findUser('vincent').role, 'admin');
  assert.strictEqual(users.findUser('copain').role, 'viewer');
});

test('le rôle "user" est accepté ; un rôle inconnu retombe sur admin', () => {
  users.upsertUser('manager', 'mot-de-passe-x', 'user');
  assert.strictEqual(users.findUser('manager').role, 'user');
  assert.strictEqual(users.normalizeRole('user'), 'user');
  assert.strictEqual(users.normalizeRole('n_importe_quoi'), 'admin');
  users.deleteUser('manager');
});

test('listUsers ne divulgue pas les hash de mots de passe', () => {
  const list = users.listUsers();
  assert.ok(list.length >= 2);
  list.forEach(u => {
    assert.deepStrictEqual(Object.keys(u).sort(), ['role', 'username']);
  });
});

test('impossible de rétrograder ou supprimer le dernier admin', () => {
  assert.throws(() => users.setRole('vincent', 'viewer'), /last_admin/);
  assert.throws(() => users.deleteUser('vincent'), /last_admin/);
});

test('rétrogradation possible dès qu\'il reste un autre admin', () => {
  users.upsertUser('copain2', 'encore-un-mdp', 'admin');
  users.setRole('vincent', 'viewer');
  assert.strictEqual(users.findUser('vincent').role, 'viewer');
  // copain2 est maintenant le dernier admin
  assert.throws(() => users.deleteUser('copain2'), /last_admin/);
  users.deleteUser('vincent');
  assert.strictEqual(users.findUser('vincent'), undefined);
});
