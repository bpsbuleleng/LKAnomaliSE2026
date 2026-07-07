const { test } = require('node:test');
const assert = require('node:assert/strict');

const RuleEvaluator = require('../src/RuleEvaluator.js');
const ComputedFields = require('../src/ComputedFields.js');
const RuleLogic = require('../src/RuleLogic.js');
const MockData = require('../src/MockData.js');
const { TEST_RECORDS } = require('./fixtures/testRecords.js');

/**
 * Acceptance Fase 3: evaluator dijalankan terhadap SEMUA test record dari
 * "Strategi sampel test record" — 1 bersih per jenis + 1 per rule aktif
 * (isolasi) + 1 multi-trigger per jenis. Ekspektasi = daftar rule_id PERSIS
 * (bukan subset), jadi rule yang bocor ke record lain langsung ketahuan.
 */

for (const rec of TEST_RECORDS) {
  test(`fixture ${rec.id} (${rec.jenis}) → [${rec.expect.join(', ') || 'bersih'}]`, () => {
    const rules = RuleLogic.selectRules(MockData.RULES, rec.jenis, false);
    const answers = ComputedFields.augment(rec.jenis, rec.answers);
    const res = RuleEvaluator.evaluateRules(rules, answers);
    assert.deepEqual(res.errors, [], 'tidak boleh ada rule error');
    assert.deepEqual(res.anomalies.map((a) => a.rule_id).sort(), rec.expect.slice().sort());
  });
}

test('cakupan strategi: 14 rule aktif masing-masing punya fixture ISOLASI + ada multi-trigger + bersih', () => {
  const activeIds = MockData.RULES.filter((r) => r.active).map((r) => r.rule_id).sort();
  assert.equal(activeIds.length, 14); // U1-U7 + K1-K7 (U8 excluded, K99 nonaktif)

  const isolated = TEST_RECORDS.filter((r) => r.expect.length === 1).map((r) => r.expect[0]).sort();
  assert.deepEqual(isolated, activeIds); // tiap rule diisolasi tepat 1 fixture

  assert.equal(TEST_RECORDS.filter((r) => r.expect.length === 0).length, 2); // bersih per jenis
  assert.equal(TEST_RECORDS.filter((r) => r.expect.length > 1).length >= 1, true); // ≥1 multi-trigger
  assert.equal(TEST_RECORDS.length >= 18, true);
});
