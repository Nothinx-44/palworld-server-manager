const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { readTail } = require('../lib/logTail');

function mkFile(content) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'palworld-logtail-'));
  const file = path.join(dir, 'console.log');
  fs.writeFileSync(file, content);
  return file;
}

test('renvoie null si le fichier n\'existe pas', () => {
  assert.strictEqual(readTail('Z:\\introuvable\\console.log'), null);
});

test('renvoie toutes les lignes si le fichier tient dans maxBytes', () => {
  const file = mkFile('ligne 1\nligne 2\nligne 3\n');
  assert.deepStrictEqual(readTail(file, 65536), ['ligne 1', 'ligne 2', 'ligne 3']);
});

test('ne garde que la fin quand le fichier dépasse maxBytes, sans ligne tronquée', () => {
  const lines = [];
  for (let i = 0; i < 1000; i++) lines.push(`ligne numero ${i}`);
  const file = mkFile(lines.join('\n') + '\n');
  const tail = readTail(file, 500); // force à couper au milieu du fichier
  assert.ok(tail.length > 0);
  // La dernière ligne réelle doit être présente
  assert.strictEqual(tail[tail.length - 1], 'ligne numero 999');
  // Aucune ligne renvoyée ne doit être un fragment tronqué (chaque ligne garde son format complet)
  tail.forEach(l => assert.match(l, /^ligne numero \d+$/));
});

test('fichier vide -> tableau vide', () => {
  const file = mkFile('');
  assert.deepStrictEqual(readTail(file), []);
});
