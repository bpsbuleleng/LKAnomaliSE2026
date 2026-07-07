const { test } = require('node:test');
const assert = require('node:assert/strict');

const ComputedFields = require('../src/ComputedFields.js');

function keluarga(answers) { return ComputedFields.augment('keluarga', answers); }
function usaha(answers) { return ComputedFields.augment('usaha', answers); }

// ==== b1r9: jumlah anggota berkode keberadaan 1 atau 5 ====

test('b1r9: hitung kode 1 dan 5 saja; kode string ikut terhitung', () => {
  const out = keluarga({ roster: { anggota_keluarga: [
    { b1r9_n: 1 }, { b1r9_n: 5 }, { b1r9_n: '1' }, // 3 terhitung
    { b1r9_n: 2 }, { b1r9_n: 3 }, { b1r9_n: 4 }, {}
  ] } });
  assert.equal(out.b1r9, 3);
});

test('b1r9: roster kosong/tidak ada → 0', () => {
  assert.equal(keluarga({}).b1r9, 0);
  assert.equal(keluarga({ roster: { anggota_keluarga: [] } }).b1r9, 0);
});

// ==== b3r18c: SUM 3 komponen pendapatan di semua baris ====

test('b3r18c: jumlah a+b+c semua baris; komponen kosong = 0', () => {
  const out = keluarga({ roster: { anggota_keluarga: [
    { b3r18a_n: 1000000, b3r18b_n: 200000, b3r18c_n: 50000 },
    { b3r18a_n: 500000 }, // b & c kosong
    {}
  ] } });
  assert.equal(out.b3r18c, 1750000);
});

// ==== b4r16 = (mingguan × 30/7) + bulanan + (tahunan / 12) ====

test('b4r16: rumus konversi ke bulanan', () => {
  const out = keluarga({ b4r16a: 700000, b4r16b: 500000, b4r16c: 1200000 });
  assert.equal(out.b4r16, 700000 * 30 / 7 + 500000 + 100000); // 3.600.000
});

test('b4r16: komponen kosong dianggap 0', () => {
  assert.equal(keluarga({ b4r16b: 250000 }).b4r16, 250000);
});

// ==== luas_per_kapita = b4r5 / b1r9 (b1r9 dihitung duluan) ====

test('luas_per_kapita: pakai b1r9 hasil hitung; b1r9=0 → null (guard bagi 0)', () => {
  const out = keluarga({ b4r5: 80, roster: { anggota_keluarga: [{ b1r9_n: 1 }, { b1r9_n: 1 }] } });
  assert.equal(out.luas_per_kapita, 40);
  assert.equal(keluarga({ b4r5: 80 }).luas_per_kapita, null);
});

// ==== r26_total, pangsa_biaya_produksi, rasio_pendapatan_biaya ====

test('r26_total: jumlah 5 komponen biaya; kosong = 0', () => {
  assert.equal(usaha({ r26a: 1, r26b: 2, r26c: 3, r26d: 4, r26e: 5 }).r26_total, 15);
  assert.equal(usaha({ r26b: 10 }).r26_total, 10);
});

test('pangsa & rasio: dihitung dari r26_total; total 0 → null (tidak berlaku)', () => {
  const out = usaha({ r26b: 30000000, r26a: 20000000, r27c: 75000000 });
  assert.equal(out.r26_total, 50000000);
  assert.equal(out.pangsa_biaya_produksi, 0.6);
  assert.equal(out.rasio_pendapatan_biaya, 1.5);

  const kosong = usaha({ r27c: 75000000 });
  assert.equal(kosong.r26_total, 0);
  assert.equal(kosong.pangsa_biaya_produksi, null);
  assert.equal(kosong.rasio_pendapatan_biaya, null);
});

// ==== Perilaku augment ====

test('augment TIDAK memutasi input dan menimpa computed lama saat dihitung ulang', () => {
  const answers = { b4r5: 80, b1r9: 999, roster: { anggota_keluarga: [{ b1r9_n: 1 }] } };
  const out = keluarga(answers);
  assert.equal(answers.b1r9, 999); // input utuh
  assert.equal(out.b1r9, 1);       // nilai lama (999) ditimpa hasil hitung
  assert.equal(out.luas_per_kapita, 80);
});

test('augment jenis usaha tidak menambah computed keluarga (dan sebaliknya)', () => {
  const out = usaha({ r26b: 10 });
  assert.equal('b1r9' in out, false);
  const outK = keluarga({});
  assert.equal('r26_total' in outK, false);
});
