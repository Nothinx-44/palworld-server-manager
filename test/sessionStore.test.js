const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Doit être défini avant le require : sessionStore.js fige le chemin au chargement
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'palworld-sessions-'));
const { JsonSessionStore, SESSIONS_FILE } = require('../lib/sessionStore');
const { readJson } = require('../lib/jsonStore');

const sess = (expiresInMs) => ({
  cookie: { expires: new Date(Date.now() + expiresInMs).toISOString() },
  user: { username: 'vincent', role: 'admin' }
});

function get(store, sid) {
  return new Promise((resolve, reject) => store.get(sid, (err, s) => (err ? reject(err) : resolve(s))));
}
function set(store, sid, s) {
  return new Promise((resolve, reject) => store.set(sid, s, err => (err ? reject(err) : resolve())));
}
function destroy(store, sid) {
  return new Promise((resolve, reject) => store.destroy(sid, err => (err ? reject(err) : resolve())));
}

test('set puis get restitue la session', async () => {
  const store = new JsonSessionStore();
  await set(store, 'sid-1', sess(60000));
  const s = await get(store, 'sid-1');
  assert.strictEqual(s.user.username, 'vincent');
});

test('une session expirée n\'est pas restituée', async () => {
  const store = new JsonSessionStore();
  await set(store, 'sid-2', sess(-1000));
  assert.strictEqual(await get(store, 'sid-2'), null);
});

test('destroy supprime la session', async () => {
  const store = new JsonSessionStore();
  await set(store, 'sid-3', sess(60000));
  await destroy(store, 'sid-3');
  assert.strictEqual(await get(store, 'sid-3'), null);
});

test('les sessions survivent à un nouveau store (persistance disque)', async () => {
  const store = new JsonSessionStore();
  await set(store, 'sid-4', sess(60000));
  // attend que l'écriture asynchrone (updateJson) soit passée
  await new Promise(r => setTimeout(r, 100));
  assert.ok(readJson(SESSIONS_FILE, {})['sid-4']);
  const store2 = new JsonSessionStore();
  const s = await get(store2, 'sid-4');
  assert.strictEqual(s.user.username, 'vincent');
});
