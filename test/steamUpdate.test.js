const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { parseLatestBuildId, getInstalledBuildId } = require('../lib/steamUpdate');

test('parseLatestBuildId extrait le buildid de la branche publique', () => {
  const vdf = `
"2394010"
{
  "depots"
  {
    "branches"
    {
      "public"
      {
        "buildid"    "14012345"
        "timeupdated"  "1719300000"
      }
      "beta"
      {
        "buildid"    "99999999"
      }
    }
  }
}`;
  assert.strictEqual(parseLatestBuildId(vdf), '14012345');
});

test('parseLatestBuildId renvoie null si introuvable', () => {
  assert.strictEqual(parseLatestBuildId('sortie sans build'), null);
  assert.strictEqual(parseLatestBuildId(''), null);
});

test('getInstalledBuildId lit le manifeste steamapps', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'palworld-steam-'));
  fs.mkdirSync(path.join(dir, 'steamapps'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'steamapps', 'appmanifest_2394010.acf'),
    '"AppState"\n{\n\t"appid"\t\t"2394010"\n\t"buildid"\t\t"13987654"\n}\n');
  process.env.PALWORLD_INSTALL_DIR = dir;
  assert.strictEqual(getInstalledBuildId(), '13987654');
});

test('getInstalledBuildId renvoie null sans manifeste ou sans config', () => {
  process.env.PALWORLD_INSTALL_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'palworld-steam-vide-'));
  assert.strictEqual(getInstalledBuildId(), null);
  process.env.PALWORLD_INSTALL_DIR = '';
  assert.strictEqual(getInstalledBuildId(), null);
});
