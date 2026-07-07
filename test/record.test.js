const { test } = require('node:test');
const assert = require('node:assert/strict');

const RecordLogic = require('../src/RecordLogic.js');
const WilayahLogic = require('../src/WilayahLogic.js');
const MockData = require('../src/MockData.js');

const KADEK = 'kadekbudiana74@gmail.com';
const KETUT = 'akusury336@gmail.com';
const assignedKadek = WilayahLogic.filterByPml(MockData.ALOKASI_WILAYAH, KADEK);

const T1 = '2026-07-07T01:00:00.000Z';
const T2 = '2026-07-07T02:00:00.000Z';

function createDraft(records, pmlEmail, input, assigned, now, id) {
  return RecordLogic.applySaveDraft(records, pmlEmail, input, assigned, now, id);
}

test('create draft: snapshot wilayah dari baris alokasi, status draft', () => {
  const res = createDraft([], KADEK, { jenis: 'keluarga', idsubsls: '5108010002000101' }, assignedKadek, T1, 'R-1');
  assert.equal(res.ok, true);
  assert.equal(res.record_id, 'R-1');
  const rec = res.records[0];
  assert.equal(rec.status, 'draft');
  assert.equal(rec.pml_email, KADEK);
  assert.equal(rec.wilayah.kdkec, '010');
  assert.equal(rec.wilayah.nmdesa, 'Sumberkima');
  assert.equal(rec.wilayah.emailppl, 'ruspininimade@gmail.com');
  assert.deepEqual(rec.answers, {});
  assert.equal(rec.created_at, T1);
});

test('create draft tanpa wilayah: boleh (draft belum lengkap), snapshot kosong', () => {
  const res = createDraft([], KADEK, { jenis: 'usaha' }, assignedKadek, T1, 'R-1');
  assert.equal(res.ok, true);
  assert.equal(res.records[0].wilayah.idsubsls, '');
});

test('idsubsls di luar assignment DITOLAK — walau idsubsls valid milik PML lain', () => {
  // '5108010001000101' milik KETUT, bukan KADEK
  const res = createDraft([], KADEK, { jenis: 'usaha', idsubsls: '5108010001000101' }, assignedKadek, T1, 'R-1');
  assert.deepEqual(res, { ok: false, error: 'WILAYAH_NOT_ASSIGNED' });
});

test('jenis tidak valid ditolak', () => {
  assert.equal(createDraft([], KADEK, { jenis: 'lainnya' }, assignedKadek, T1, 'R-1').error, 'INVALID_JENIS');
  assert.equal(createDraft([], KADEK, {}, assignedKadek, T1, 'R-1').error, 'INVALID_JENIS');
});

test('update draft sendiri: wilayah & updated_at berubah, created_at tetap, tidak memutasi input', () => {
  const base = createDraft([], KADEK, { jenis: 'keluarga', idsubsls: '5108010002000101' }, assignedKadek, T1, 'R-1').records;
  const res = RecordLogic.applySaveDraft(base, KADEK,
    { record_id: 'R-1', jenis: 'keluarga', idsubsls: '5108010003000101' }, assignedKadek, T2, 'R-IGNORED');
  assert.equal(res.ok, true);
  assert.equal(res.records[0].wilayah.nmdesa, 'Pejarakan');
  assert.equal(res.records[0].updated_at, T2);
  assert.equal(res.records[0].created_at, T1);
  // immutability: array asal tidak berubah
  assert.equal(base[0].wilayah.nmdesa, 'Sumberkima');
});

test('update record PML lain → FORBIDDEN; record tak ada → NOT_FOUND', () => {
  const base = createDraft([], KADEK, { jenis: 'usaha' }, assignedKadek, T1, 'R-1').records;
  const assignedKetut = WilayahLogic.filterByPml(MockData.ALOKASI_WILAYAH, KETUT);
  assert.equal(RecordLogic.applySaveDraft(base, KETUT, { record_id: 'R-1', jenis: 'usaha' }, assignedKetut, T2, 'x').error, 'FORBIDDEN');
  assert.equal(RecordLogic.applySaveDraft(base, KADEK, { record_id: 'R-99', jenis: 'usaha' }, assignedKadek, T2, 'x').error, 'NOT_FOUND');
});

test('listRecordsFor: hanya milik sendiri, urut terbaru dulu, bentuk summary', () => {
  let records = createDraft([], KADEK, { jenis: 'usaha' }, assignedKadek, T1, 'R-1').records;
  records = createDraft(records, KADEK, { jenis: 'keluarga', idsubsls: '5108010002000101' }, assignedKadek, T2, 'R-2').records;
  const assignedKetut = WilayahLogic.filterByPml(MockData.ALOKASI_WILAYAH, KETUT);
  records = createDraft(records, KETUT, { jenis: 'usaha' }, assignedKetut, T2, 'R-3').records;

  const list = RecordLogic.listRecordsFor(records, KADEK);
  assert.equal(list.length, 2);
  assert.equal(list[0].record_id, 'R-2'); // terbaru dulu
  assert.deepEqual(list[0], {
    record_id: 'R-2', jenis: 'keluarga', status: 'draft',
    idsubsls: '5108010002000101', nmkec: 'Gerokgak', nmdesa: 'Sumberkima',
    nmsls: 'Banjar Dinas Kertha Kusuma', kdsubsls: '01', updated_at: T2
  });
  assert.equal(RecordLogic.listRecordsFor(records, KETUT).length, 1);
});

test('getRecordFor: milik sendiri ok, milik orang FORBIDDEN, tak ada NOT_FOUND', () => {
  const records = createDraft([], KADEK, { jenis: 'usaha' }, assignedKadek, T1, 'R-1').records;
  assert.equal(RecordLogic.getRecordFor(records, KADEK, 'R-1').ok, true);
  assert.equal(RecordLogic.getRecordFor(records, KETUT, 'R-1').error, 'FORBIDDEN');
  assert.equal(RecordLogic.getRecordFor(records, KADEK, 'R-9').error, 'NOT_FOUND');
});
