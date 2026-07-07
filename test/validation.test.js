const { test } = require('node:test');
const assert = require('node:assert/strict');

const ValidationLogic = require('../src/ValidationLogic.js');
const QuestionLogic = require('../src/QuestionLogic.js');
const MockData = require('../src/MockData.js');

const IDSUBSLS = '5108010002000101';

const Q_FLAT_REQ = { question_id: 'f1', label: 'Field wajib', required: true, roster_group: '' };
const Q_FLAT_OPT = { question_id: 'f2', label: 'Field opsional', required: false, roster_group: '' };
const Q_ROSTER_REQ = { question_id: 'r1', label: 'Nama anggota', required: true, roster_group: 'g' };

test('semua terisi + wilayah ada → tidak ada missing', () => {
  const missing = ValidationLogic.findMissing(
    [Q_FLAT_REQ, Q_FLAT_OPT, Q_ROSTER_REQ],
    { f1: 'x', roster: { g: [{ r1: 'a' }] } },
    IDSUBSLS
  );
  assert.deepEqual(missing, []);
});

test('field required kosong DITUNJUK (undefined, "", null); opsional diabaikan', () => {
  for (const val of [undefined, '', null]) {
    const missing = ValidationLogic.findMissing([Q_FLAT_REQ, Q_FLAT_OPT], { f1: val }, IDSUBSLS);
    assert.equal(missing.length, 1);
    assert.deepEqual(missing[0], { question_id: 'f1', label: 'Field wajib', roster_group: '', row_index: null });
  }
});

test('nilai 0 dianggap TERISI', () => {
  assert.deepEqual(ValidationLogic.findMissing([Q_FLAT_REQ], { f1: 0 }, IDSUBSLS), []);
});

test('wilayah kosong → entri __wilayah__ di urutan pertama', () => {
  for (const w of ['', null, undefined, '  ']) {
    const missing = ValidationLogic.findMissing([Q_FLAT_REQ], { f1: 'x' }, w);
    assert.equal(missing.length, 1);
    assert.equal(missing[0].question_id, '__wilayah__');
  }
});

test('roster: required dicek per BARIS yang ada, dengan row_index; roster kosong lolos', () => {
  const missing = ValidationLogic.findMissing(
    [Q_ROSTER_REQ],
    { roster: { g: [{ r1: 'a' }, {}, { r1: '' }] } },
    IDSUBSLS
  );
  assert.deepEqual(missing.map((m) => m.row_index), [1, 2]);
  assert.equal(missing[0].roster_group, 'g');
  // roster kosong / tidak ada → lolos (tidak ada aturan minimal baris di v1)
  assert.deepEqual(ValidationLogic.findMissing([Q_ROSTER_REQ], {}, IDSUBSLS), []);
  assert.deepEqual(ValidationLogic.findMissing([Q_ROSTER_REQ], { roster: { g: [] } }, IDSUBSLS), []);
});

// ==== Integrasi dengan Questions mock sungguhan ====

test('keluarga mock: kuesioner kosong → wilayah + b1r13_1 + b4r3a + b4r5 ditunjuk', () => {
  const questions = QuestionLogic.selectQuestions(MockData.QUESTIONS, 'keluarga', false);
  const missing = ValidationLogic.findMissing(questions, { roster: {} }, '');
  assert.deepEqual(missing.map((m) => m.question_id), ['__wilayah__', 'b1r13_1', 'b4r3a', 'b4r5']);
});

test('keluarga mock: baris roster anggota dgn nama kosong ditunjuk per baris', () => {
  const questions = QuestionLogic.selectQuestions(MockData.QUESTIONS, 'keluarga', false);
  const answers = {
    b1r13_1: 45, b4r3a: 1, b4r5: 80,
    roster: { anggota_keluarga: [{ b1r8_n: 1 }] } // b1r6_n (nama) kosong
  };
  const missing = ValidationLogic.findMissing(questions, answers, IDSUBSLS);
  assert.deepEqual(missing, [{
    question_id: 'b1r6_n', label: 'Nama anggota keluarga',
    roster_group: 'anggota_keluarga', row_index: 0
  }]);
});
