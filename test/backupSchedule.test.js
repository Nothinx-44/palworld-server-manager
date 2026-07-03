const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'palworld-bksched-'));
const sched = require('../lib/backupSchedule');

test('normalize garde les heures valides, trie, dédoublonne', () => {
  const c = sched.normalize({ enabled: true, times: ['16:00', '04:00', '16:00', '99:99'], days: [1, 1, 3], keepCount: 20 });
  assert.deepStrictEqual(c.times, ['04:00', '16:00']);
  assert.deepStrictEqual(c.days, [1, 3]);
  assert.strictEqual(c.keepCount, 20);
});

test('normalize applique des valeurs par défaut si vide', () => {
  const c = sched.normalize({ times: [], days: [] });
  assert.deepStrictEqual(c.times, ['04:00']);
  assert.deepStrictEqual(c.days, [0, 1, 2, 3, 4, 5, 6]);
  assert.ok(c.keepCount >= 1);
});

test('keepCount est borné entre 1 et 1000', () => {
  assert.strictEqual(sched.normalize({ keepCount: 0 }).keepCount, sched.defaults().keepCount);
  assert.strictEqual(sched.normalize({ keepCount: 99999 }).keepCount, 1000);
});

test('toCronExpressions : une expression par heure, jours en DOW', () => {
  const crons = sched.toCronExpressions({ enabled: true, times: ['04:00', '16:30'], days: [1, 3, 5], keepCount: 14 });
  assert.deepStrictEqual(crons, ['0 4 * * 1,3,5', '30 16 * * 1,3,5']);
});

test('toCronExpressions : 7 jours -> "*"', () => {
  const crons = sched.toCronExpressions({ enabled: true, times: ['02:00'], days: [0, 1, 2, 3, 4, 5, 6], keepCount: 14 });
  assert.deepStrictEqual(crons, ['0 2 * * *']);
});

test('toCronExpressions : désactivé -> aucune tâche', () => {
  assert.deepStrictEqual(sched.toCronExpressions({ enabled: false, times: ['04:00'], days: [1] }), []);
});

test('save puis load restitue la config normalisée', () => {
  const saved = sched.save({ enabled: true, times: ['08:15', '20:45'], days: [6, 0], keepCount: 30 });
  assert.deepStrictEqual(saved.times, ['08:15', '20:45']);
  assert.deepStrictEqual(sched.load().days, [0, 6]);
});

test('les expressions cron générées sont valides pour node-cron', () => {
  const cron = require('node-cron');
  sched.toCronExpressions({ enabled: true, times: ['00:00', '12:30', '23:59'], days: [1, 2], keepCount: 5 })
    .forEach(expr => assert.ok(cron.validate(expr), `cron invalide: ${expr}`));
});
