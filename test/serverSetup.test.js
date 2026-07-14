const test = require('node:test');
const assert = require('node:assert');

const { setIniOption, parseIniOptions, normalizeConfig } = require('../lib/serverSetup');

const SAMPLE = 'OptionSettings=(Difficulty=None,ServerName="Default Palworld Server",PublicPort=8211,RESTAPIEnabled=False,RESTAPIPort=8212,AdminPassword="")';

test('remplace une valeur simple', () => {
  const out = setIniOption(SAMPLE, 'PublicPort', 9999);
  assert.ok(out.includes('PublicPort=9999'));
  assert.ok(out.includes('RESTAPIPort=8212')); // la clé "suffixe" ne doit pas être touchée
});

test('remplace une valeur entre guillemets', () => {
  const out = setIniOption(SAMPLE, 'ServerName', 'Mon Serveur', { quoted: true });
  assert.ok(out.includes('ServerName="Mon Serveur"'));
});

test('ne confond pas deux clés dont l\'une est le suffixe de l\'autre', () => {
  const out = setIniOption(SAMPLE, 'RESTAPIPort', 8300);
  assert.ok(out.includes('RESTAPIPort=8300'));
  assert.ok(out.includes('PublicPort=8211'));
});

test('remplace une valeur vide entre guillemets', () => {
  const out = setIniOption(SAMPLE, 'AdminPassword', 'secret123', { quoted: true });
  assert.ok(out.includes('AdminPassword="secret123"'));
});

test('ajoute la clé si elle est absente', () => {
  const out = setIniOption(SAMPLE, 'NouvelleCle', 'True');
  assert.ok(out.includes('NouvelleCle=True'));
  assert.ok(out.endsWith(')'));
});

test('les guillemets sont retirés de la valeur pour ne pas casser le format', () => {
  const out = setIniOption(SAMPLE, 'ServerName', 'Nom "louche"', { quoted: true });
  assert.ok(out.includes('ServerName="Nom louche"'));
});

test('parseIniOptions découpe les clés/valeurs en respectant les virgules entre guillemets', () => {
  const options = parseIniOptions('OptionSettings=(Difficulty=None,ServerName="Chez nous, les copains",ExpRate=1.500000,bEnablePvP=False,AdminPassword="")');
  const byKey = Object.fromEntries(options.map(o => [o.key, o]));
  assert.strictEqual(options.length, 5);
  assert.deepStrictEqual(byKey.ServerName, { key: 'ServerName', value: 'Chez nous, les copains', quoted: true });
  assert.deepStrictEqual(byKey.Difficulty, { key: 'Difficulty', value: 'None', quoted: false });
  assert.deepStrictEqual(byKey.AdminPassword, { key: 'AdminPassword', value: '', quoted: true });
  assert.strictEqual(byKey.bEnablePvP.value, 'False');
});

test('parseIniOptions renvoie null si OptionSettings est absent', () => {
  assert.strictEqual(parseIniOptions('[/Script/Pal.PalGameWorldSettings]\n'), null);
});

test('normalizeConfig conserve les arguments de lancement custom (issue #5)', () => {
  const cfg = normalizeConfig({ adminPassword: 'secret1', extraArgs: '-publiclobby -log' });
  assert.strictEqual(cfg.extraArgs, '-publiclobby -log');
});

test('normalizeConfig assainit extraArgs (retire les sauts de ligne) et défaut vide', () => {
  assert.strictEqual(normalizeConfig({ adminPassword: 'secret1' }).extraArgs, '');
  const cfg = normalizeConfig({ adminPassword: 'secret1', extraArgs: '  -a\n-b\r\n-c  ' });
  assert.strictEqual(cfg.extraArgs, '-a -b -c');
});

test('aller-retour : parseIniOptions puis setIniOption préserve le format', () => {
  const options = parseIniOptions(SAMPLE);
  const target = options.find(o => o.key === 'ServerName');
  const out = setIniOption(SAMPLE, 'ServerName', 'Nouveau nom', { quoted: target.quoted });
  const reparsed = parseIniOptions(out);
  assert.strictEqual(reparsed.find(o => o.key === 'ServerName').value, 'Nouveau nom');
  assert.strictEqual(reparsed.length, options.length);
});
