const { test } = require('node:test');
const assert = require('node:assert/strict');

const SubmitLogic = require('../src/SubmitLogic.js');
const RecordLogic = require('../src/RecordLogic.js');
const QuestionLogic = require('../src/QuestionLogic.js');
const RuleLogic = require('../src/RuleLogic.js');
const WilayahLogic = require('../src/WilayahLogic.js');
const MockData = require('../src/MockData.js');
const { keluargaBase } = require('./fixtures/testRecords.js');

const KADEK = 'kadekbudiana74@gmail.com';
const KETUT = 'akusury336@gmail.com';
const IDSUBSLS = '5108010002000101';
const T1 = '2026-07-07T01:00:00.000Z';
const T2 = '2026-07-07T02:00:00.000Z';
const T3 = '2026-07-07T03:00:00.000Z';

const assigned = WilayahLogic.filterByPml(MockData.ALOKASI_WILAYAH, KADEK);
const questionsK = QuestionLogic.selectQuestions(MockData.QUESTIONS, 'keluarga', false);
// Seperti DataAccess.submitRecord: HANYA rule active=TRUE yang diberikan.
const rulesK = RuleLogic.selectRules(MockData.RULES, 'keluarga', false);

function submit(records, email, input, now, id) {
  return SubmitLogic.applySubmit(records, email, input, assigned, questionsK, rulesK, now, id || 'R-NEW');
}

test('submit dengan required kosong → DITOLAK + tunjuk field, TAPI jawaban tetap tersimpan sbg draft', () => {
  const res = submit([], KADEK, {
    jenis: 'keluarga', idsubsls: IDSUBSLS,
    answers: { b4r5: 80, roster: {} } // b1r13_1 & b4r3a kosong
  }, T1, 'R-1');

  assert.equal(res.ok, true);
  assert.equal(res.submitted, false);
  assert.deepEqual(res.missing.map((m) => m.question_id), ['b1r13_1', 'b4r3a']);
  assert.equal(res.missing[0].label, 'Umur Kepala Keluarga (tahun)');
  // Jawaban TIDAK hilang: record tersimpan, status tetap draft, tanpa anomali
  const rec = res.records[0];
  assert.equal(rec.status, 'draft');
  assert.equal(rec.answers.b4r5, 80);
  assert.deepEqual(rec.anomalies, []);
});

test('submit tanpa wilayah → ditolak dengan entri __wilayah__', () => {
  const res = submit([], KADEK, { jenis: 'keluarga', answers: keluargaBase() }, T1, 'R-1');
  assert.equal(res.submitted, false);
  assert.equal(res.missing[0].question_id, '__wilayah__');
});

test('submit lengkap → status submitted, computed fields tersimpan di answers, anomali tersimpan', () => {
  const answers = keluargaBase();
  answers.b1r13_1 = 8; // memicu K2 (umur KK < 10 + rumah milik sendiri)
  const res = submit([], KADEK, { jenis: 'keluarga', idsubsls: IDSUBSLS, answers }, T1, 'R-1');

  assert.equal(res.ok, true);
  assert.equal(res.submitted, true);
  assert.deepEqual(res.anomalies.map((a) => a.rule_id), ['K2']);
  assert.equal(res.anomalies[0].severity, 'error');

  const rec = res.records[0];
  assert.equal(rec.status, 'submitted');
  assert.deepEqual(rec.anomalies, res.anomalies);
  assert.equal(rec.updated_at, T1);
  // Computed fields jadi field biasa di answers (dipakai rule & riwayat)
  assert.equal(rec.answers.b1r9, 4);
  assert.equal(rec.answers.luas_per_kapita, 20);
  assert.equal(rec.answers.b3r18c, 4000000);
});

test('anomali membawa `fields`: label pertanyaan, display opsi kategorik, penanda computed', () => {
  const answers = keluargaBase();
  answers.b1r13_1 = 8; // K2 (umur KK < 10 + rumah milik sendiri)
  answers.b4r5 = 900;  // K4 (luas per kapita 900/4 = 225 > 200 — via computed)
  const res = submit([], KADEK, { jenis: 'keluarga', idsubsls: IDSUBSLS, answers }, T1, 'R-1');
  assert.equal(res.submitted, true);

  const k2 = res.anomalies.find((a) => a.rule_id === 'K2');
  assert.deepEqual(k2.fields, [
    { field: 'b1r13_1', value: 8, label: 'Umur Kepala Keluarga (tahun)' },
    { field: 'b4r3a', value: 1, label: 'Status kepemilikan bangunan tempat tinggal yang ditempati', display: '1. Milik sendiri' }
  ]);

  // K4 merujuk computed field → ada label + penanda computed (client tahu
  // tidak ada input kuesioner untuk di-scroll), nilai hasil hitungan ikut.
  const k4 = res.anomalies.find((a) => a.rule_id === 'K4');
  assert.deepEqual(k4.fields, [
    { field: 'luas_per_kapita', value: 225, label: 'Luas lantai per kapita m² (hitungan)', computed: true }
  ]);

  // fields ikut tersimpan di record (snapshot bersama anomalinya).
  assert.deepEqual(res.records[0].anomalies, res.anomalies);
});

test('rule NONAKTIF (K99) tidak pernah jalan — filter active di caller', () => {
  // K99 (not_empty b1r13_1) akan SELALU terpicu kalau filter bocor.
  const res = submit([], KADEK, { jenis: 'keluarga', idsubsls: IDSUBSLS, answers: keluargaBase() }, T1, 'R-1');
  assert.equal(res.submitted, true);
  assert.deepEqual(res.anomalies, []); // record bersih: 0 anomali, tanpa K99
});

test('edit lalu submit ULANG → rule di-run ulang unconditional, anomali TER-UPDATE', () => {
  // Submit pertama: bersih (0 anomali)
  const first = submit([], KADEK, { jenis: 'keluarga', idsubsls: IDSUBSLS, answers: keluargaBase() }, T1, 'R-1');
  assert.equal(first.submitted, true);
  assert.deepEqual(first.anomalies, []);

  // Edit: umur KK jadi 8 + luas ekstrem → submit ulang atas record yang sama
  const edited = keluargaBase();
  edited.b1r13_1 = 8;
  edited.b4r5 = 900;
  const second = submit(first.records, KADEK,
    { record_id: 'R-1', jenis: 'keluarga', idsubsls: IDSUBSLS, answers: edited }, T2);
  assert.equal(second.submitted, true);
  assert.deepEqual(second.anomalies.map((a) => a.rule_id), ['K2', 'K4']);
  assert.equal(second.records.length, 1); // record sama, bukan duplikat
  assert.equal(second.records[0].updated_at, T2);

  // Perbaiki lagi → submit ketiga → anomali kembali kosong (bukan akumulasi)
  const third = submit(second.records, KADEK,
    { record_id: 'R-1', jenis: 'keluarga', idsubsls: IDSUBSLS, answers: keluargaBase() }, T3);
  assert.equal(third.submitted, true);
  assert.deepEqual(third.records[0].anomalies, []);
});

test('submit record milik PML lain → FORBIDDEN (tidak tersimpan apa pun)', () => {
  const first = submit([], KADEK, { jenis: 'keluarga', idsubsls: IDSUBSLS, answers: keluargaBase() }, T1, 'R-1');
  const res = SubmitLogic.applySubmit(first.records, KETUT,
    { record_id: 'R-1', jenis: 'keluarga', answers: {} },
    WilayahLogic.filterByPml(MockData.ALOKASI_WILAYAH, KETUT), questionsK, rulesK, T2, 'R-X');
  assert.deepEqual(res, { ok: false, error: 'FORBIDDEN' });
});

test('submit record baru yang belum pernah sync (record_id null) → record dibuat LALU disubmit', () => {
  const res = submit([], KADEK, { jenis: 'keluarga', idsubsls: IDSUBSLS, answers: keluargaBase() }, T1, 'R-BARU');
  assert.equal(res.submitted, true);
  assert.equal(res.record_id, 'R-BARU');
  assert.equal(res.records[0].status, 'submitted');
});

test('validasi gagal TIDAK mengubah status record submitted (tetap submitted, jawaban terbaru tersimpan)', () => {
  const first = submit([], KADEK, { jenis: 'keluarga', idsubsls: IDSUBSLS, answers: keluargaBase() }, T1, 'R-1');
  const kosong = keluargaBase();
  kosong.b1r13_1 = ''; // hapus isian wajib lalu coba submit ulang
  const res = submit(first.records, KADEK,
    { record_id: 'R-1', jenis: 'keluarga', idsubsls: IDSUBSLS, answers: kosong }, T2);
  assert.equal(res.submitted, false);
  assert.equal(res.records[0].status, 'submitted'); // status lama dipertahankan
  assert.equal(res.records[0].answers.b1r13_1, ''); // jawaban terbaru tetap tersimpan
});
