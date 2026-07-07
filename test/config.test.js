const { test } = require('node:test');
const assert = require('node:assert/strict');

const ConfigLogic = require('../src/ConfigLogic.js');
const QuestionLogic = require('../src/QuestionLogic.js');
const RuleLogic = require('../src/RuleLogic.js');
const ValidationLogic = require('../src/ValidationLogic.js');
const MockData = require('../src/MockData.js');

const QS = MockData.QUESTIONS;
const RULES = MockData.RULES;

// ==== createQuestion ====

test('createQuestion: nempel di akhir (order max+1), active=true, bukan roster', () => {
  const res = ConfigLogic.applyCreateQuestion(QS, 'keluarga', {
    question_id: 'b4r99', label: 'Punya sumur bor', type: 'select',
    options: [{ value: 1, label: 'Ya' }, { value: 2, label: 'Tidak' }],
    required: true, help: 'cek fisik'
  });
  assert.equal(res.ok, true);
  const maxOrder = Math.max(...QS.filter((q) => q.jenis === 'keluarga').map((q) => q.order));
  assert.deepEqual(res.question, {
    question_id: 'b4r99', jenis: 'keluarga', order: maxOrder + 1,
    label: 'Punya sumur bor', type: 'select',
    options: [{ value: 1, label: 'Ya' }, { value: 2, label: 'Tidak' }],
    required: true, help: 'cek fisik', active: true, roster_group: ''
  });
  assert.equal(res.questions.length, QS.length + 1);
  assert.equal(QS.length, res.questions.length - 1); // input tidak dimutasi
});

test('createQuestion: alias di-lowercase + trim; alias invalid/duplikat ditolak', () => {
  const ok = ConfigLogic.applyCreateQuestion(QS, 'usaha', { question_id: '  R99X ', label: 'x', type: 'text' });
  assert.equal(ok.question.question_id, 'r99x');
  assert.equal(ConfigLogic.applyCreateQuestion(QS, 'usaha', { question_id: 'ada spasi', label: 'x', type: 'text' }).error, 'INVALID_ALIAS');
  assert.equal(ConfigLogic.applyCreateQuestion(QS, 'usaha', { question_id: '', label: 'x', type: 'text' }).error, 'INVALID_ALIAS');
  assert.equal(ConfigLogic.applyCreateQuestion(QS, 'usaha', { label: 'x', type: 'text' }).error, 'INVALID_ALIAS');
  assert.equal(ConfigLogic.applyCreateQuestion(QS, 'usaha', { question_id: 'r27c', label: 'x', type: 'text' }).error, 'DUPLICATE_ALIAS');
});

test('createQuestion: alias sama di jenis BERBEDA boleh (unik per jenis, bukan global)', () => {
  // r27c ada di usaha — membuat r27c di keluarga sah.
  const res = ConfigLogic.applyCreateQuestion(QS, 'keluarga', { question_id: 'r27c', label: 'x', type: 'number' });
  assert.equal(res.ok, true);
});

test('createQuestion: validasi jenis/label/type/options', () => {
  assert.equal(ConfigLogic.applyCreateQuestion(QS, 'lainnya', { question_id: 'a', label: 'x', type: 'text' }).error, 'INVALID_JENIS');
  assert.equal(ConfigLogic.applyCreateQuestion(QS, 'usaha', { question_id: 'a', label: '  ', type: 'text' }).error, 'INVALID_LABEL');
  assert.equal(ConfigLogic.applyCreateQuestion(QS, 'usaha', { question_id: 'a', label: 'x', type: 'radio' }).error, 'INVALID_TYPE');
  assert.equal(ConfigLogic.applyCreateQuestion(QS, 'usaha', { question_id: 'a', label: 'x', type: 'select' }).error, 'INVALID_OPTIONS');
  assert.equal(ConfigLogic.applyCreateQuestion(QS, 'usaha', { question_id: 'a', label: 'x', type: 'select', options: [] }).error, 'INVALID_OPTIONS');
  assert.equal(ConfigLogic.applyCreateQuestion(QS, 'usaha', { question_id: 'a', label: 'x', type: 'select', options: [{ value: 1, label: '' }] }).error, 'INVALID_OPTIONS');
  // options diabaikan (null) untuk non-select
  const res = ConfigLogic.applyCreateQuestion(QS, 'usaha', { question_id: 'a', label: 'x', type: 'number', options: [{ value: 1, label: 'Ya' }] });
  assert.equal(res.question.options, null);
});

// ==== updateQuestion ====

test('updateQuestion: patch whitelist; order/jenis/alias/roster/active TIDAK berubah', () => {
  const res = ConfigLogic.applyUpdateQuestion(QS, 'keluarga', 'b4r5', {
    label: 'Luas lantai (m2) — revisi', help: 'ukur ulang', required: false,
    // upaya menyelundupkan field terlarang:
    order: 999, jenis: 'usaha', question_id: 'lain', roster_group: 'x', active: false
  });
  assert.equal(res.ok, true);
  assert.equal(res.question.label, 'Luas lantai (m2) — revisi');
  assert.equal(res.question.required, false);
  const asli = QS.find((q) => q.jenis === 'keluarga' && q.question_id === 'b4r5');
  assert.equal(res.question.order, asli.order);
  assert.equal(res.question.jenis, 'keluarga');
  assert.equal(res.question.question_id, 'b4r5');
  assert.equal(res.question.roster_group, '');
  assert.equal(res.question.active, true);
  assert.equal(asli.label, 'Luas lantai bangunan tempat tinggal (m²)'); // sumber utuh
});

test('updateQuestion: ganti type ke select tanpa options DITOLAK; select→number membuang options', () => {
  assert.equal(ConfigLogic.applyUpdateQuestion(QS, 'keluarga', 'b4r5', { type: 'select' }).error, 'INVALID_OPTIONS');
  const ok = ConfigLogic.applyUpdateQuestion(QS, 'keluarga', 'b4r5', {
    type: 'select', options: [{ value: 1, label: 'Kecil' }, { value: 2, label: 'Besar' }]
  });
  assert.equal(ok.ok, true);
  const back = ConfigLogic.applyUpdateQuestion(ok.questions, 'keluarga', 'b4r5', { type: 'number' });
  assert.equal(back.question.options, null);
});

test('updateQuestion: NOT_FOUND — alias tak ada ATAU jenis salah', () => {
  assert.equal(ConfigLogic.applyUpdateQuestion(QS, 'keluarga', 'tidak_ada', { label: 'x' }).error, 'NOT_FOUND');
  assert.equal(ConfigLogic.applyUpdateQuestion(QS, 'usaha', 'b4r5', { label: 'x' }).error, 'NOT_FOUND'); // b4r5 milik keluarga
});

// ==== setQuestionActive (soft-delete) ====

test('setQuestionActive: nonaktifkan → hilang dari kuesioner baru, tetap ada dengan includeInactive', () => {
  const res = ConfigLogic.applySetQuestionActive(QS, 'keluarga', 'b4r13', false);
  assert.equal(res.ok, true);
  const aktif = QuestionLogic.selectQuestions(res.questions, 'keluarga', false);
  assert.equal(aktif.some((q) => q.question_id === 'b4r13'), false);
  const semua = QuestionLogic.selectQuestions(res.questions, 'keluarga', true);
  assert.equal(semua.some((q) => q.question_id === 'b4r13'), true);
  assert.equal(res.questions.length, QS.length); // TIDAK dihapus
  // aktifkan lagi
  const back = ConfigLogic.applySetQuestionActive(res.questions, 'keluarga', 'b4r13', true);
  assert.equal(back.question.active, true);
});

test('setQuestionActive: pertanyaan required yang dinonaktifkan TIDAK lagi memblokir submit', () => {
  const res = ConfigLogic.applySetQuestionActive(QS, 'keluarga', 'b1r13_1', false);
  const aktif = QuestionLogic.selectQuestions(res.questions, 'keluarga', false);
  const missing = ValidationLogic.findMissing(aktif, { b4r3a: 1, b4r5: 80, roster: {} }, 'x');
  assert.equal(missing.some((m) => m.question_id === 'b1r13_1'), false);
});

// ==== reorderQuestions ====

test('reorderQuestions: permutasi valid → order 1..n mengikuti urutan; jenis lain tak tersentuh', () => {
  const ids = QS.filter((q) => q.jenis === 'usaha').map((q) => q.question_id);
  const swapped = ids.slice();
  [swapped[0], swapped[1]] = [swapped[1], swapped[0]];
  const res = ConfigLogic.applyReorderQuestions(QS, 'usaha', swapped);
  assert.equal(res.ok, true);
  const after = QuestionLogic.selectQuestions(res.questions, 'usaha', true);
  assert.deepEqual(after.map((q) => q.question_id).slice(0, 2), [ids[1], ids[0]]);
  assert.deepEqual(after.map((q) => q.order), after.map((_, i) => i + 1)); // rapat 1..n
  const keluargaBefore = QS.filter((q) => q.jenis === 'keluarga').map((q) => q.order);
  const keluargaAfter = res.questions.filter((q) => q.jenis === 'keluarga').map((q) => q.order);
  assert.deepEqual(keluargaAfter, keluargaBefore);
});

test('reorderQuestions: set tidak persis sama DITOLAK (kurang, asing, duplikat)', () => {
  const ids = QS.filter((q) => q.jenis === 'usaha').map((q) => q.question_id);
  assert.equal(ConfigLogic.applyReorderQuestions(QS, 'usaha', ids.slice(1)).error, 'INVALID_ORDER');
  assert.equal(ConfigLogic.applyReorderQuestions(QS, 'usaha', ids.slice(0, -1).concat(['asing'])).error, 'INVALID_ORDER');
  assert.equal(ConfigLogic.applyReorderQuestions(QS, 'usaha', ids.slice(0, -1).concat([ids[0]])).error, 'INVALID_ORDER');
  assert.equal(ConfigLogic.applyReorderQuestions(QS, 'usaha', 'bukan-array').error, 'INVALID_ORDER');
});

// ==== createRule ====

test('createRule: rule_id otomatis mulai 100 per jenis (K99 nonaktif tidak bikin tabrakan)', () => {
  const res = ConfigLogic.applyCreateRule(RULES, 'keluarga', {
    severity: 'warning', message: 'Uji rule baru', when: { field: 'b4r5', op: '>', value: 500 }
  });
  assert.equal(res.ok, true);
  assert.equal(res.rule.rule_id, 'K100'); // max K = K99 → 100
  assert.equal(res.rule.active, true);
  const res2 = ConfigLogic.applyCreateRule(res.rules, 'keluarga', {
    severity: 'error', message: 'Kedua', when: { field: 'b4r5', op: '<', value: 1 }
  });
  assert.equal(res2.rule.rule_id, 'K101'); // berurut
  const resU = ConfigLogic.applyCreateRule(RULES, 'usaha', {
    severity: 'warning', message: 'Usaha baru', when: { field: 'r25', op: '<', value: 1900 }
  });
  assert.equal(resU.rule.rule_id, 'U100'); // max U = U7 → tetap mulai 100
});

test('createRule: when string JSON di-parse & disimpan sebagai objek; when rusak DITOLAK dengan detail', () => {
  const ok = ConfigLogic.applyCreateRule(RULES, 'keluarga', {
    severity: 'warning', message: 'x', when: '{"field":"b4r5","op":">","value":500}'
  });
  assert.deepEqual(ok.rule.when, { field: 'b4r5', op: '>', value: 500 });

  const badJson = ConfigLogic.applyCreateRule(RULES, 'keluarga', { severity: 'warning', message: 'x', when: '{rusak' });
  assert.equal(badJson.error, 'INVALID_WHEN');
  assert.match(badJson.detail, /JSON/);

  const badOp = ConfigLogic.applyCreateRule(RULES, 'keluarga', {
    severity: 'warning', message: 'x', when: { field: 'b4r5', op: 'like', value: 1 }
  });
  assert.equal(badOp.error, 'INVALID_WHEN');
  assert.match(badOp.detail, /Operator/);
});

test('createRule: validasi severity/message/jenis', () => {
  const when = { field: 'b4r5', op: '>', value: 1 };
  assert.equal(ConfigLogic.applyCreateRule(RULES, 'keluarga', { severity: 'fatal', message: 'x', when }).error, 'INVALID_SEVERITY');
  assert.equal(ConfigLogic.applyCreateRule(RULES, 'keluarga', { severity: 'error', message: ' ', when }).error, 'INVALID_MESSAGE');
  assert.equal(ConfigLogic.applyCreateRule(RULES, 'apalah', { severity: 'error', message: 'x', when }).error, 'INVALID_JENIS');
});

// ==== updateRule & setRuleActive ====

test('updateRule: patch severity/message/when; when dalam patch tetap divalidasi', () => {
  const res = ConfigLogic.applyUpdateRule(RULES, 'K7', {
    severity: 'error', message: 'K7 revisi', when: { field: 'b1r9', op: '>', value: 12 }
  });
  assert.equal(res.ok, true);
  assert.equal(res.rule.severity, 'error');
  assert.deepEqual(res.rule.when, { field: 'b1r9', op: '>', value: 12 });
  assert.equal(RULES.find((r) => r.rule_id === 'K7').message, 'Jumlah Anggota Keluarga Ekstrem: lebih dari 10 anggota');

  assert.equal(ConfigLogic.applyUpdateRule(RULES, 'K7', { when: { foo: 1 } }).error, 'INVALID_WHEN');
  assert.equal(ConfigLogic.applyUpdateRule(RULES, 'ZZZ', { message: 'x' }).error, 'NOT_FOUND');
});

test('setRuleActive: toggle dua arah tanpa menghapus baris', () => {
  const off = ConfigLogic.applySetRuleActive(RULES, 'K1', false);
  assert.equal(off.rule.active, false);
  assert.equal(RuleLogic.selectRules(off.rules, 'keluarga', false).some((r) => r.rule_id === 'K1'), false);
  assert.equal(off.rules.length, RULES.length);
  const on = ConfigLogic.applySetRuleActive(off.rules, 'K1', true);
  assert.equal(on.rule.active, true);
});
