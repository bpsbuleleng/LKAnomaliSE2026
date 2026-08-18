const { test } = require('node:test');
const assert = require('node:assert/strict');

const FasihImport = require('../src/FasihImport.js');
const ComputedFields = require('../src/ComputedFields.js');
const RuleEvaluator = require('../src/RuleEvaluator.js');
const RuleLogic = require('../src/RuleLogic.js');
const MockData = require('../src/MockData.js');

// idsubsls riil di MockData → emailpml kadekbudiana74@gmail.com.
const IDSUBSLS = '5108010002000101';
const PML = 'kadekbudiana74@gmail.com';
const ALOKASI = MockData.ALOKASI_WILAYAH;
const NOW = '2026-07-22T00:00:00.000Z';

// ==== Konversi nilai ====

test('toNumber: "Rp 5.000.000" & integer polos & kosong', () => {
  assert.equal(FasihImport.toNumber('Rp 5.000.000'), 5000000);
  assert.equal(FasihImport.toNumber('5000000'), 5000000);
  assert.equal(FasihImport.toNumber('2.500.000'), 2500000);
  assert.equal(FasihImport.toNumber('2019'), 2019);
  assert.equal(FasihImport.toNumber(''), '');
  assert.equal(FasihImport.toNumber(null), '');
});

test('toCat: kode integer → number, kode non-numerik dibiarkan string, kosong → ""', () => {
  assert.equal(FasihImport.toCat('13'), 13);
  assert.equal(FasihImport.toCat('02'), 2);
  assert.equal(FasihImport.toCat('1'), 1);
  assert.equal(FasihImport.toCat('01a'), '01a'); // kode badan usaha ber-huruf
  assert.equal(FasihImport.toCat(''), '');
});

test('toKode: r13g tetap string, leading zero terjaga', () => {
  assert.equal(FasihImport.toKode('01284'), '01284');
  assert.equal(FasihImport.toKode(' 47111 '), '47111');
});

// ==== Perakitan record ====

function keluargaRow(over) {
  var r = {
    assignment_id: 'A1', kode_wilayah: IDSUBSLS,
    umur_krt: '45', status_kepemilikan_value: '1', luas_lantai: '80',
    sumber_penerangan_value: '1', jml_meteran: '1', listrik_sebulan: '300000',
    pengeluaran_makanan_mingguan: '400000', pengeluaran_non_makan_bulanan: '800000',
    pengeluaran_non_makan_tahunan: '1200000',
    jumlah_kulkas: '0', jumlah_ac: '0', jumlah_laptop: '0'
  };
  Object.keys(over || {}).forEach(function (k) { r[k] = over[k]; });
  return r;
}
function akRow(over) {
  var r = {
    assignment_id: 'A1', index1: '1', nama_dtsen: 'ANGGOTA',
    hubungan_value: '3', keberadaan_dtsen_value: '1', status_kawin_value: '1',
    nilai_pend_pekerjaan: '', dis_netra_value: '2', dis_rungu_value: '2',
    dis_fisik_value: '2', dis_intelek_value: '2', dis_mental_value: '2', dis_wicara_value: '2'
  };
  Object.keys(over || {}).forEach(function (k) { r[k] = over[k]; });
  return r;
}

test('buildRecords keluarga: struktur record, join wilayah, pml_email, roster urut index1', () => {
  const built = FasihImport.buildRecords({
    keluarga: [keluargaRow()],
    rosterAk: [
      akRow({ index1: '2', nama_dtsen: 'ISTRI', hubungan_value: '2', status_kawin_value: '2' }),
      akRow({ index1: '1', nama_dtsen: 'KEPALA', hubungan_value: '1', status_kawin_value: '2', nilai_pend_pekerjaan: 'Rp 4.000.000' })
    ],
    rosterMeteran: [{ assignment_id: 'A1', index1: '1', daya_terpasang_value: '2' }],
    alokasi: ALOKASI, nowIso: NOW
  });
  assert.equal(built.records.length, 1);
  const rec = built.records[0];
  assert.equal(rec.record_id, 'F-K-A1');
  assert.equal(rec.jenis, 'keluarga');
  assert.equal(rec.status, 'submitted');
  assert.equal(rec.sumber, 'fasih');
  assert.equal(rec.assignment_id, 'A1');
  assert.equal(rec.pml_email, PML);            // join wilayah → emailpml
  assert.equal(rec.wilayah.idsubsls, IDSUBSLS);
  assert.equal(rec.wilayah.nmdesa, 'Sumberkima');
  // Konversi field datar
  assert.equal(rec.answers.b1r13_1, 45);
  assert.equal(rec.answers.b4r3a, 1);
  assert.equal(rec.answers.b4r5, 80);
  assert.equal(rec.answers.b4r14a, 1);
  // Roster diurutkan index1: KEPALA (1) dulu, ISTRI (2)
  const ak = rec.answers.roster.anggota_keluarga;
  assert.equal(ak.length, 2);
  assert.equal(ak[0].b1r6_n, 'KEPALA');
  assert.equal(ak[0].b1r8_n, 1);
  assert.equal(ak[0].b3r18a_n, 4000000); // "Rp 4.000.000" terparse
  assert.equal(ak[1].b1r6_n, 'ISTRI');
  // b3r18b_n & b3r18c_n selalu 0 (REKONSILIASI §6)
  assert.equal(ak[0].b3r18b_n, 0);
  assert.equal(ak[0].b3r18c_n, 0);
  // Roster meteran
  assert.equal(rec.answers.roster.meteran_listrik.length, 1);
  assert.equal(rec.answers.roster.meteran_listrik[0].b4r14b_n, 2);
});

test('buildRecords: baris rosterAk duplikat (assignment_id+index1 sama, dari 2 query overlap) di-dedup, TIDAK menggandakan anggota', () => {
  // Skenario nyata (2026-08-17): query "gap proxy" sengaja BOLEH overlap
  // dengan query grup-wilayah/K1K3 yang sudah diekspor lebih dulu — baris
  // yang sama bisa muncul di staging dari 2 sumber CSV berbeda. Tanpa dedup,
  // groupRoster akan push 2x, menggandakan b1r9/b3r18c dan roster_all K3.
  const built = FasihImport.buildRecords({
    keluarga: [keluargaRow()],
    rosterAk: [
      akRow({ index1: '1', hubungan_value: '1', nilai_pend_pekerjaan: 'Rp 4.000.000' }),
      akRow({ index1: '2', hubungan_value: '2' }),
      // Duplikat PERSIS index1=1 & index1=2 (simulasi overlap 2 file CSV)
      akRow({ index1: '1', hubungan_value: '1', nilai_pend_pekerjaan: 'Rp 4.000.000' }),
      akRow({ index1: '2', hubungan_value: '2' })
    ],
    alokasi: ALOKASI, nowIso: NOW
  });
  assert.equal(built.records.length, 1);
  const ak = built.records[0].answers.roster.anggota_keluarga;
  assert.equal(ak.length, 2); // BUKAN 4 — duplikat terbuang
  assert.equal(built.stats.rosterAkRows, 2);
});

test('buildRecords usaha: 2 unit dalam 1 assignment → 2 record ber-id beda; r13g string', () => {
  const built = FasihImport.buildRecords({
    usaha: [
      { assignment_id: 'A9', kode_wilayah: IDSUBSLS, idx_unit: '0', nama_usaha: 'WARUNG A',
        badan_usaha_value: '13', produk_sendiri_value: '2', kbli_akhir: '01284',
        biaya_produksi: '35000000', biaya_pembelian: '5000000', gaji: '5000000',
        operasional: '3000000', non_operasional: '2000000', total_pendapatan: '55000000',
        total_aset: '8000000', tahun_operasi: '2019', total_tk_jk: '2' },
      { assignment_id: 'A9', kode_wilayah: IDSUBSLS, idx_unit: '1', nama_usaha: 'WARUNG B',
        badan_usaha_value: '2', produk_sendiri_value: '1', kbli_akhir: '47111',
        total_pendapatan: '30000000', tahun_operasi: '2020' }
    ],
    alokasi: ALOKASI, nowIso: NOW
  });
  assert.equal(built.records.length, 2);
  assert.deepEqual(built.records.map((r) => r.record_id).sort(), ['F-U-A9-0', 'F-U-A9-1']);
  const a = built.records.find((r) => r.record_id === 'F-U-A9-0');
  assert.equal(a.jenis, 'usaha');
  assert.equal(a.answers.r13g, '01284');   // TEXT, leading zero
  assert.equal(a.answers.r11a, 13);
  assert.equal(a.answers.r26b, 35000000);
  assert.deepEqual(a.answers.roster, {});  // usaha tanpa roster
});

test('buildRecords: wilayah tak cocok di Alokasi → snapshot kosong, pml_email kosong, stats naik', () => {
  const built = FasihImport.buildRecords({
    keluarga: [keluargaRow({ kode_wilayah: '9999999999999999' })],
    alokasi: ALOKASI, nowIso: NOW
  });
  assert.equal(built.records[0].wilayah.idsubsls, '');
  assert.equal(built.records[0].pml_email, '');
  assert.equal(built.stats.unmatchedWilayah, 1);
  assert.equal(built.stats.tanpaPml, 1);
});

// ==== Integrasi: record hasil impor lewat mesin rule aplikasi ====

function anomaliesOf(rec, refs) {
  const rules = RuleLogic.selectRules(MockData.RULES, rec.jenis, false);
  const answers = ComputedFields.augment(rec.jenis, rec.answers, refs || {});
  return RuleEvaluator.evaluateRules(rules, answers).anomalies.map((a) => a.rule_id).sort();
}

test('integrasi: KK kawin + AK-2 anak → K1 (cabang b) lewat computed field', () => {
  const built = FasihImport.buildRecords({
    keluarga: [keluargaRow()],
    rosterAk: [
      akRow({ index1: '1', hubungan_value: '1', status_kawin_value: '2', nilai_pend_pekerjaan: 'Rp 4.000.000' }),
      akRow({ index1: '2', hubungan_value: '3', status_kawin_value: '1' })
    ],
    alokasi: ALOKASI, nowIso: NOW
  });
  const rec = built.records[0];
  const augmented = ComputedFields.augment('keluarga', rec.answers, {});
  assert.equal(augmented.k1_pasutri_tidak_kawin, 1);
  assert.equal(augmented.b3r18c, 4000000); // b3r18a saja (b/c = 0)
  assert.ok(anomaliesOf(rec).indexOf('K1') !== -1);
});

test('integrasi: usaha rugi (U2) terdeteksi ulang oleh RuleEvaluator', () => {
  const built = FasihImport.buildRecords({
    usaha: [{ assignment_id: 'A2', kode_wilayah: IDSUBSLS, idx_unit: '0', nama_usaha: 'RUGI',
      badan_usaha_value: '2', produk_sendiri_value: '1', kbli_akhir: '47111',
      biaya_produksi: '20000000', biaya_pembelian: '10000000', gaji: '10000000',
      operasional: '5000000', non_operasional: '5000000', total_pendapatan: '40000000',
      tahun_operasi: '2019', total_tk_jk: '2', peran_mbg_value: '2' }],
    alokasi: ALOKASI, nowIso: NOW
  });
  // r26_total = 50jt, r27c = 40jt < 50jt → U2
  assert.ok(anomaliesOf(built.records[0]).indexOf('U2') !== -1);
});
