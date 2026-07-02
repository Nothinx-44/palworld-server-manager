const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { readJson, writeJson, updateJson } = require('../lib/jsonStore');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'palworld-jsonstore-'));

test('readJson renvoie le fallback si le fichier est absent', () => {
  assert.deepStrictEqual(readJson(path.join(tmpDir, 'absent.json'), { a: 1 }), { a: 1 });
});

test('readJson renvoie le fallback si le fichier est corrompu', () => {
  const file = path.join(tmpDir, 'corrompu.json');
  fs.writeFileSync(file, '{pas du json');
  assert.deepStrictEqual(readJson(file, []), []);
});

test('writeJson puis readJson restitue les données (et crée le dossier)', () => {
  const file = path.join(tmpDir, 'sous', 'dossier', 'donnees.json');
  writeJson(file, { liste: [1, 2, 3] });
  assert.deepStrictEqual(readJson(file, null), { liste: [1, 2, 3] });
});

test('updateJson sérialise les mises à jour concurrentes sur un même fichier', async () => {
  const file = path.join(tmpDir, 'compteur.json');
  writeJson(file, { compteur: 0 });

  // 20 mises à jour lancées en parallèle, chacune avec un await entre lecture et écriture :
  // sans sérialisation, elles se liraient toutes mutuellement des valeurs périmées.
  await Promise.all(Array.from({ length: 20 }, () =>
    updateJson(file, { compteur: 0 }, async data => {
      const value = data.compteur;
      await new Promise(resolve => setImmediate(resolve));
      data.compteur = value + 1;
    })
  ));

  assert.strictEqual(readJson(file, null).compteur, 20);
});

test('updateJson continue de fonctionner après une mise à jour en échec', async () => {
  const file = path.join(tmpDir, 'apres-erreur.json');
  writeJson(file, { ok: false });
  await assert.rejects(updateJson(file, {}, () => { throw new Error('boom'); }));
  await updateJson(file, {}, data => { data.ok = true; });
  assert.strictEqual(readJson(file, null).ok, true);
});

const { updateJsonSync } = require('../lib/jsonStore');

test('updateJsonSync mute et écrit de façon synchrone', () => {
  const file = path.join(tmpDir, 'sync.json');
  updateJsonSync(file, [], list => { list.push('a'); });
  updateJsonSync(file, [], list => list.concat('b'));
  assert.deepStrictEqual(readJson(file, null), ['a', 'b']);
});

test('updateJsonSync relâche le verrou même si la mutation échoue', () => {
  const file = path.join(tmpDir, 'sync-erreur.json');
  assert.throws(() => updateJsonSync(file, {}, () => { throw new Error('boom'); }));
  assert.ok(!fs.existsSync(`${file}.lock`), 'le fichier .lock doit être supprimé');
  updateJsonSync(file, {}, data => { data.ok = true; }); // ne doit pas bloquer sur le verrou
  assert.strictEqual(readJson(file, null).ok, true);
});

test('le verrou inter-process fait attendre l\'écriture concurrente', async () => {
  const file = path.join(tmpDir, 'verrou.json');
  writeJson(file, { n: 0 });
  // Simule un autre process détenant le verrou, relâché après 150 ms
  const lockPath = `${file}.lock`;
  fs.writeFileSync(lockPath, '9999', { flag: 'wx' });
  setTimeout(() => fs.unlinkSync(lockPath), 150);
  const start = Date.now();
  await updateJson(file, {}, data => { data.n = 1; });
  assert.ok(Date.now() - start >= 100, 'updateJson doit avoir attendu le verrou');
  assert.strictEqual(readJson(file, null).n, 1);
});
