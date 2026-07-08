const { test } = require('node:test');
const assert = require('node:assert/strict');

const WilayahLogic = require('../src/WilayahLogic.js');
const MockData = require('../src/MockData.js');

const KADEK = 'kadekbudiana74@gmail.com';
const KETUT = 'akusury336@gmail.com';

test('filterByPml: hanya baris milik PML ybs', () => {
  const rows = WilayahLogic.filterByPml(MockData.ALOKASI_WILAYAH, KADEK);
  assert.equal(rows.length, 5);
  rows.forEach((r) => assert.equal(r.emailpml, KADEK));
});

test('filterByPml: dua PML TIDAK saling lihat (idsubsls disjoint)', () => {
  const kadek = WilayahLogic.filterByPml(MockData.ALOKASI_WILAYAH, KADEK).map((r) => r.idsubsls);
  const ketut = WilayahLogic.filterByPml(MockData.ALOKASI_WILAYAH, KETUT).map((r) => r.idsubsls);
  assert.equal(ketut.length, 3);
  kadek.forEach((id) => assert.equal(ketut.includes(id), false));
});

test('filterByPml: email case-insensitive + trim', () => {
  const rows = WilayahLogic.filterByPml(MockData.ALOKASI_WILAYAH, '  KadekBudiana74@GMAIL.com ');
  assert.equal(rows.length, 5);
});

test('filterByPml: PML tanpa assignment → array kosong (bukan error)', () => {
  assert.deepEqual(WilayahLogic.filterByPml(MockData.ALOKASI_WILAYAH, 'luhputuekayanti@gmail.com'), []);
  assert.deepEqual(WilayahLogic.filterByPml(MockData.ALOKASI_WILAYAH, ''), []);
});

test('filterByPml: akun organik TIDAK terikat wilayah → semua baris (case-insensitive)', () => {
  const rows = WilayahLogic.filterByPml(MockData.ALOKASI_WILAYAH, ' Organik@BPS.go.id ');
  assert.equal(rows.length, MockData.ALOKASI_WILAYAH.length);
});

test('findByIdsubsls: ketemu dan tidak ketemu', () => {
  assert.equal(WilayahLogic.findByIdsubsls(MockData.ALOKASI_WILAYAH, '5108010001000101').nmdesa, 'Sumberklampok');
  assert.equal(WilayahLogic.findByIdsubsls(MockData.ALOKASI_WILAYAH, '9999999999999999'), null);
  assert.equal(WilayahLogic.findByIdsubsls(MockData.ALOKASI_WILAYAH, ''), null);
});

test('joinPetugasNames: nama kanonik dari tab Petugas menang atas nama di alokasi', () => {
  // Baris alokasi menulis 'Abdul Basit' / 'Ketut Suryanta Putra' (bukan kapital);
  // join ke Petugas harus menghasilkan versi kanonik.
  const row = WilayahLogic.findByIdsubsls(MockData.ALOKASI_WILAYAH, '5108010001000101');
  const ppl = WilayahLogic.joinPetugasNames(row, MockData.PETUGAS);
  assert.equal(ppl.nmppl, 'ABDUL BASIT');
  assert.equal(ppl.nmpml, 'KETUT SURYANTA PUTRA');
  assert.equal(ppl.emailppl, 'abdulbasit081194@gmail.com');
});

test('joinPetugasNames: emailppl kosong → fallback ke nmppl alokasi', () => {
  const row = WilayahLogic.findByIdsubsls(MockData.ALOKASI_WILAYAH, '5108020001000101');
  const ppl = WilayahLogic.joinPetugasNames(row, MockData.PETUGAS);
  assert.equal(ppl.nmppl, 'GEDE SUARDANA');
  assert.equal(ppl.emailppl, '');
  assert.equal(ppl.nmpml, 'KADEK BUDIANA');
});
