const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'palworld-basetracker-'));
const baseTracker = require('../lib/baseTracker');
const playerTracker = require('../lib/playerTracker');

function writeStore(store) {
  fs.writeFileSync(baseTracker.BASES_FILE, JSON.stringify(store));
}
function writePlayers(players) {
  fs.writeFileSync(playerTracker.HISTORY_FILE, JSON.stringify({ sessions: [], totals: {}, players }));
}

test('guildLastActiveMs prend le plus récent entre lastOnlineAt et la dernière connexion des membres', () => {
  const now = Date.now();
  const recent = new Date(now - 2 * 86400000).toISOString();
  const older = new Date(now - 20 * 86400000).toISOString();
  const lastSeenByUser = { u1: Date.parse(older), u2: Date.parse(recent) };
  const ms = baseTracker.guildLastActiveMs({ memberUserIds: ['u1', 'u2'], lastOnlineAt: null }, lastSeenByUser);
  assert.strictEqual(ms, Date.parse(recent)); // u2 est le plus récent
});

test('guildLastActiveMs : lastOnlineAt (membre vu en ligne au poll) l\'emporte s\'il est le plus récent', () => {
  const now = Date.now();
  const onlineNow = new Date(now).toISOString();
  const old = new Date(now - 30 * 86400000).toISOString();
  const ms = baseTracker.guildLastActiveMs({ memberUserIds: ['u1'], lastOnlineAt: onlineNow }, { u1: Date.parse(old) });
  assert.strictEqual(ms, Date.parse(onlineNow));
});

test('listBases marque abandonnée une base dont la guilde n\'a pas été active depuis le seuil', () => {
  const now = Date.now();
  const longAgo = new Date(now - (baseTracker.ABANDONED_AFTER_DAYS + 5) * 86400000).toISOString();
  const recently = new Date(now - 1 * 86400000).toISOString();

  writeStore({
    bases: {
      camp_old: { campId: 'camp_old', guildId: 'g-old', guildName: 'Anciens', x: 1, y: 2, firstSeen: longAgo, lastSeen: new Date(now).toISOString() },
      camp_new: { campId: 'camp_new', guildId: 'g-new', guildName: 'Actifs', x: 3, y: 4, firstSeen: recently, lastSeen: new Date(now).toISOString() }
    },
    guilds: {
      'g-old': { name: 'Anciens', memberUserIds: ['u-old'], lastOnlineAt: longAgo },
      'g-new': { name: 'Actifs', memberUserIds: ['u-new'], lastOnlineAt: recently }
    }
  });
  writePlayers({
    'u-old': { name: 'Ancien', lastSeen: longAgo, sessionCount: 1 },
    'u-new': { name: 'Actif', lastSeen: recently, sessionCount: 1 }
  });

  const bases = baseTracker.listBases();
  const old = bases.find(b => b.guildId === 'g-old');
  const fresh = bases.find(b => b.guildId === 'g-new');
  assert.strictEqual(old.abandoned, true);
  assert.strictEqual(fresh.abandoned, false);
  assert.ok(old.daysSinceOwnerSeen >= baseTracker.ABANDONED_AFTER_DAYS);
});

test('listBases : guilde sans activité connue -> non abandonnée (donnée insuffisante)', () => {
  writeStore({
    bases: { camp_x: { campId: 'camp_x', guildId: 'g-inconnue', guildName: '?', x: 0, y: 0, firstSeen: new Date().toISOString(), lastSeen: new Date().toISOString() } },
    guilds: { 'g-inconnue': { name: '?', memberUserIds: ['u-jamais-vu'], lastOnlineAt: null } }
  });
  writePlayers({});
  const [base] = baseTracker.listBases();
  assert.strictEqual(base.abandoned, false);
  assert.strictEqual(base.daysSinceOwnerSeen, null);
});

test('listBases trie du plus longtemps inactif au plus récent', () => {
  const now = Date.now();
  writeStore({
    bases: {
      b1: { campId: 'b1', guildId: 'g1', x: 0, y: 0, lastSeen: new Date().toISOString() },
      b2: { campId: 'b2', guildId: 'g2', x: 1, y: 1, lastSeen: new Date().toISOString() }
    },
    guilds: {
      g1: { memberUserIds: ['p1'], lastOnlineAt: new Date(now - 3 * 86400000).toISOString() },
      g2: { memberUserIds: ['p2'], lastOnlineAt: new Date(now - 30 * 86400000).toISOString() }
    }
  });
  writePlayers({});
  const bases = baseTracker.listBases();
  assert.strictEqual(bases[0].guildId, 'g2'); // le plus anciennement actif d'abord
  assert.strictEqual(bases[1].guildId, 'g1');
});
