const { test } = require('node:test');
const assert = require('node:assert/strict');

const ConfigLogic = require('../src/ConfigLogic.js');
const SubmitLogic = require('../src/SubmitLogic.js');
const QuestionLogic = require('../src/QuestionLogic.js');
const RuleLogic = require('../src/RuleLogic.js');
const RuleEvaluator = require('../src/RuleEvaluator.js');
const ComputedFields = require('../src/ComputedFields.js');
const WilayahLogic = require('../src/WilayahLogic.js');
const MockData = require('../src/MockData.js');
const { keluargaBase } = require('./fixtures/testRecords.js');

const KADEK = 'kadekbudiana74@gmail.com';
const IDSUBSLS = '5108010002000101';
const T1 = '2026-07-07T01:00:00.000Z';
const assigned = WilayahLogic.filterByPml(MockData.ALOKASI_WILAYAH, KADEK);

test('ACCEPTANCE: rule baru dari config LANGSUNG menandai anomali di submit berikutnya', () => {
  // Record dasar bersih (0 anomali dari 14 rule bawaan), b4r16c = 1.200.000.
  const created = ConfigLogic.applyCreateRule(MockData.RULES, 'keluarga', {
    severity: 'warning',
    message: 'UJI: pengeluaran tahunan di atas 1 juta',
    when: { field: 'b4r16c', op: '>', value: 1000000 }
  });
  assert.equal(created.ok, true);
  assert.equal(created.rule.rule_id, 'K100');

  const questions = QuestionLogic.selectQuestions(MockData.QUESTIONS, 'keluarga', false);
  const activeRules = RuleLogic.selectRules(created.rules, 'keluarga', false);
  const res = SubmitLogic.applySubmit([], KADEK,
    { jenis: 'keluarga', idsubsls: IDSUBSLS, answers: keluargaBase() },
    assigned, questions, activeRules, T1, 'R-1');

  assert.equal(res.submitted, true);
  assert.deepEqual(res.anomalies.map((a) => a.rule_id), ['K100']);
  assert.equal(res.anomalies[0].message, 'UJI: pengeluaran tahunan di atas 1 juta');

  // Nonaktifkan rule-nya → submit ulang → anomali hilang (soft-delete rule).
  const off = ConfigLogic.applySetRuleActive(created.rules, 'K100', false);
  const res2 = SubmitLogic.applySubmit(res.records, KADEK,
    { record_id: 'R-1', jenis: 'keluarga', idsubsls: IDSUBSLS, answers: keluargaBase() },
    assigned, questions, RuleLogic.selectRules(off.rules, 'keluarga', false), T1);
  assert.deepEqual(res2.anomalies, []);
});

test('ACCEPTANCE: preview identik dengan jalur submit — evaluator & computed yang sama', () => {
  // Seperti previewRule di server: augment lalu evaluate dengan RuleEvaluator.
  const when = { field: 'luas_per_kapita', op: '>', value: 200 };
  const contoh = { b4r5: 900, roster: { anggota_keluarga: [{ b1r9_n: 1 }, { b1r9_n: 1 }, { b1r9_n: 1 }, { b1r9_n: 1 }] } };
  const augmented = ComputedFields.augment('keluarga', contoh);
  assert.equal(RuleEvaluator.evaluate(when, augmented), true); // 225 > 200 → terpicu

  const contohAman = { b4r5: 100, roster: { anggota_keluarga: [{ b1r9_n: 1 }, { b1r9_n: 1 }] } };
  assert.equal(RuleEvaluator.evaluate(when, ComputedFields.augment('keluarga', contohAman)), false);
});

test('validateWhen menerima SEMUA 15 rule bawaan (config bisa buka-simpan ulang tanpa tersandung)', () => {
  MockData.RULES.forEach((r) => {
    const v = RuleEvaluator.validateWhen(r.when);
    assert.equal(v.ok, true, r.rule_id + ': ' + (v.error || ''));
  });
});
