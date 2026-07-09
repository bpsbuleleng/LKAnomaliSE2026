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

// ==== r13f (kategori 1 digit dari kode KBLI r13g) ====

test('r13f: digit pertama kode KBLI 5 digit; kosong/belum diisi → ""', () => {
  assert.equal(usaha({ r13g: '01111' }).r13f, '0');
  assert.equal(usaha({ r13g: '47111' }).r13f, '4');
  assert.equal(usaha({}).r13f, '');
  assert.equal(usaha({ r13g: '' }).r13f, '');
});

test('r13h: kategori huruf A-U dari 2 digit pertama (golongan pokok) KBLI', () => {
  assert.equal(usaha({ r13g: '01111' }).r13h, 'A'); // pertanian
  assert.equal(usaha({ r13g: '08000' }).r13h, 'B'); // pertambangan
  assert.equal(usaha({ r13g: '10111' }).r13h, 'C'); // industri pengolahan
  assert.equal(usaha({ r13g: '33111' }).r13h, 'C'); // batas atas C
  assert.equal(usaha({ r13g: '47111' }).r13h, 'G'); // perdagangan eceran
  assert.equal(usaha({ r13g: '68111' }).r13h, 'L'); // real estat (rentang 1 nilai)
  assert.equal(usaha({ r13g: '99000' }).r13h, 'U'); // badan internasional
  assert.equal(usaha({}).r13h, '');
  assert.equal(usaha({ r13g: '5' }).r13h, ''); // kurang dari 2 digit
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

// ==== rasio_ntb & batas_rasio_ntb (rule U9) ====

test('rasio_ntb: (r27c − r26_total) ÷ r27c; r27c 0/kosong → null', () => {
  const out = usaha({ r26a: 4000000, r26b: 5000000, r27c: 55000000 });
  assert.equal(out.r26_total, 9000000);
  assert.equal(out.rasio_ntb, 46000000 / 55000000);
  assert.equal(usaha({ r26a: 1000 }).rasio_ntb, null);          // r27c kosong
  assert.equal(usaha({ r26a: 1000, r27c: 0 }).rasio_ntb, null); // r27c 0
  // biaya > pendapatan → rasio negatif (bukan null) — U9 aman, U2 yang menangkap
  assert.equal(usaha({ r26a: 60000000, r27c: 50000000 }).rasio_ntb, -0.2);
});

test('batas_rasio_ntb: lookup r13g di refs.ntbRasio; tanpa refs / kode tak dikenal → null', () => {
  const refs = { ntbRasio: { '01111': 0.8127 } };
  assert.equal(ComputedFields.augment('usaha', { r13g: '01111' }, refs).batas_rasio_ntb, 0.8127);
  assert.equal(ComputedFields.augment('usaha', { r13g: '99999' }, refs).batas_rasio_ntb, null);
  assert.equal(ComputedFields.augment('usaha', {}, refs).batas_rasio_ntb, null);
  assert.equal(usaha({ r13g: '01111' }).batas_rasio_ntb, null); // tanpa refs
});

test('buildNtbRasioMap: string→number, duplikat ambil MAX, baris rusak dilewati', () => {
  const map = ComputedFields.buildNtbRasioMap([
    { kode: '01111', rasio: '0.8127' },
    { kode: '01284', rasio: '0.7641' },
    { kode: '01284', rasio: '0.8362' }, // duplikat riil (2 kategori) → ambil terbesar
    { kode: '01284', rasio: '0.7000' }, // duplikat lebih kecil setelah max → tetap max
    { kode: '', rasio: '0.5' },         // tanpa kode
    { kode: '99000', rasio: '' },       // rasio kosong
    { kode: '99001', rasio: 'abc' }     // rasio non-numerik
  ]);
  assert.deepEqual(map, { '01111': 0.8127, '01284': 0.8362 });
});

// ==== jumlah_<roster>: banyak baris roster (apa pun isinya) ====

test('jumlah_anggota_keluarga & jumlah_meteran_listrik: hitung SEMUA baris', () => {
  const out = keluarga({ roster: {
    anggota_keluarga: [{ b1r9_n: 1 }, { b1r9_n: 2 }, {}],
    meteran_listrik: [{ b4r14b_n: 1 }]
  } });
  assert.equal(out.jumlah_anggota_keluarga, 3); // baris kosong pun terhitung
  assert.equal(out.jumlah_meteran_listrik, 1);
});

test('jumlah_<roster>: roster tidak ada → 0 (field tetap dibuat)', () => {
  const out = keluarga({});
  assert.equal(out.jumlah_anggota_keluarga, 0);
  assert.equal(out.jumlah_meteran_listrik, 0);
});

test('jumlah_<roster>: nilai kiriman client ditimpa hasil hitung server', () => {
  const out = keluarga({ jumlah_anggota_keluarga: 99, roster: { anggota_keluarga: [{}] } });
  assert.equal(out.jumlah_anggota_keluarga, 1);
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
