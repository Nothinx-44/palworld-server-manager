const test = require('node:test');
const assert = require('node:assert');

const { setIniOption } = require('../lib/serverSetup');

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
