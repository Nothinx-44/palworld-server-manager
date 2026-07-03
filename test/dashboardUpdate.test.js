const test = require('node:test');
const assert = require('node:assert');
const { isNewer } = require('../lib/dashboardUpdate');

test('isNewer : comparaison de versions', () => {
  assert.strictEqual(isNewer('1.0.10', '1.0.9'), true, '1.0.10 > 1.0.9 (pas de comparaison alphabétique)');
  assert.strictEqual(isNewer('1.1.0', '1.0.9'), true);
  assert.strictEqual(isNewer('2.0.0', '1.9.9'), true);
  assert.strictEqual(isNewer('1.0.9', '1.0.9'), false);
  assert.strictEqual(isNewer('1.0.8', '1.0.9'), false);
  assert.strictEqual(isNewer('1.0', '1.0.0'), false, 'longueurs différentes');
});
