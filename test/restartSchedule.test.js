const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'palworld-rssched-'));
const sched = require('../lib/restartSchedule');
// defaults()/defaultsFromEnvCron() relisent process.env.RESTART_CRON à chaque appel (pas de
// valeur figée au chargement du module), donc pas besoin de recharger le module entre les tests.

test('sans RESTART_CRON, les défauts sont désactivés', () => {
  delete process.env.RESTART_CRON;
  assert.strictEqual(sched.defaults().enabled, false);
});

test('defaultsFromEnvCron convertit un RESTART_CRON simple en config activée', () => {
  process.env.RESTART_CRON = '0 5 * * *';
  process.env.RESTART_WARNING_MINUTES = '7';
  const d = sched.defaults();
  assert.strictEqual(d.enabled, true);
  assert.deepStrictEqual(d.times, ['05:00']);
  assert.deepStrictEqual(d.days, [0, 1, 2, 3, 4, 5, 6]);
  assert.strictEqual(d.warningMinutes, 7);
});

test('defaultsFromEnvCron convertit une liste de jours spécifique', () => {
  process.env.RESTART_CRON = '30 4 * * 1,3,5';
  const d = sched.defaults();
  assert.deepStrictEqual(d.times, ['04:30']);
  assert.deepStrictEqual(d.days, [1, 3, 5]);
});

test('un RESTART_CRON non conforme au format simple retombe désactivé', () => {
  process.env.RESTART_CRON = '*/15 * * * *'; // trop complexe pour notre conversion
  assert.strictEqual(sched.defaults().enabled, false);
});

test('normalize borne warningMinutes entre 1 et 60', () => {
  delete process.env.RESTART_CRON;
  assert.strictEqual(sched.normalize({ warningMinutes: 0 }).warningMinutes, sched.defaults().warningMinutes);
  assert.strictEqual(sched.normalize({ warningMinutes: 999 }).warningMinutes, 60);
});

test('toCronExpressions : une expression par heure, jours en DOW', () => {
  const crons = sched.toCronExpressions({ enabled: true, times: ['05:00', '17:15'], days: [2, 4], warningMinutes: 5 });
  assert.deepStrictEqual(crons, ['0 5 * * 2,4', '15 17 * * 2,4']);
});

test('save puis load restitue la config normalisée', () => {
  delete process.env.RESTART_CRON;
  sched.save({ enabled: true, times: ['06:00'], days: [1], warningMinutes: 10 });
  const loaded = sched.load();
  assert.strictEqual(loaded.enabled, true);
  assert.deepStrictEqual(loaded.times, ['06:00']);
  assert.strictEqual(loaded.warningMinutes, 10);
});

test('les expressions cron générées sont valides pour node-cron', () => {
  const cron = require('node-cron');
  sched.toCronExpressions({ enabled: true, times: ['00:00', '23:59'], days: [0, 6], warningMinutes: 5 })
    .forEach(expr => assert.ok(cron.validate(expr), `cron invalide: ${expr}`));
});
