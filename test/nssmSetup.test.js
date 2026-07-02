const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { findNssmExe } = require('../lib/nssmSetup');

test('findNssmExe localise nssm.exe dans le sous-dossier d\'architecture', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nssm-'));
  const archDir = path.join(dir, 'nssm-2.24', process.arch === 'x64' ? 'win64' : 'win32');
  fs.mkdirSync(archDir, { recursive: true });
  const exe = path.join(archDir, 'nssm.exe');
  fs.writeFileSync(exe, 'binaire factice');
  assert.strictEqual(findNssmExe(dir), exe);
});

test('findNssmExe renvoie null si nssm.exe est absent', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nssm-'));
  assert.strictEqual(findNssmExe(dir), null);
});

test('findNssmExe renvoie null si le dossier n\'existe pas', () => {
  assert.strictEqual(findNssmExe(path.join(os.tmpdir(), 'nssm-inexistant-xyz')), null);
});
