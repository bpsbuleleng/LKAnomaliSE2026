/**
 * Set data test sesuai "Strategi sampel test record" di CLAUDE.md:
 * 1 record bersih per jenis + 1 record per rule aktif (mengisolasi rule itu
 * saja) + 1 multi-trigger per jenis = 19 record untuk 15 rule aktif.
 *
 * Tiap fixture dibangun dari record dasar yang BERSIH (0 anomali) lalu
 * diubah seminimal mungkin supaya HANYA rule target yang terpicu — kalau
 * evaluator/computed berubah dan memicu rule lain, test langsung gagal.
 */

// Potongan tab "Rasio NTB SE2016" untuk refs.ntbRasio (nilai riil dari tab
// live): cukup kode yang dipakai fixture. Kode lain → batas null → U9 tidak
// berlaku.
var TEST_NTB_RASIO = { '01111': 0.8127 };

// Anggota roster default: anak, tinggal di keluarga, belum kawin, tanpa
// pendapatan, tanpa disabilitas.
function member(over) {
  var m = {
    b1r6_n: 'ANGGOTA', b1r8_n: 3, b1r9_n: 1, b1r11_n: 1,
    b3r18a_n: 0, b3r18b_n: 0, b3r18c_n: 0,
    b3r20a_n: 2, b3r20b_n: 2, b3r20c_n: 2, b3r20d_n: 2, b3r20e_n: 2, b3r20f_n: 2
  };
  Object.keys(over || {}).forEach(function (k) { m[k] = over[k]; });
  return m;
}

// Keluarga bersih: 4 anggota (KK+istri kawin, 2 anak), pendapatan 4jt >
// pengeluaran ±2,61jt (b4r16 = 400rb×30/7 + 800rb + 1,2jt/12), luas per
// kapita 80/4 = 20 m², listrik 900 VA & 300rb/bulan, tanpa barang mewah.
function keluargaBase() {
  return {
    b1r13_1: 45, b4r3a: 1, b4r5: 80,
    b4r13: 1, b4r14a: 1, b4r15a: 300000,
    b4r16a: 400000, b4r16b: 800000, b4r16c: 1200000,
    b4r17c: 0, b4r17d: 0, b4r17f: 0,
    roster: {
      anggota_keluarga: [
        member({ b1r6_n: 'KETUT SUKARDI', b1r8_n: 1, b1r11_n: 2, b3r18a_n: 4000000 }),
        member({ b1r6_n: 'NI LUH SARI', b1r8_n: 2, b1r11_n: 2 }),
        member({ b1r6_n: 'KADEK DWI' }),
        member({ b1r6_n: 'KOMANG TRI' })
      ],
      meteran_listrik: [{ b4r14b_n: 2 }]
    }
  };
}

// Usaha bersih: memproduksi barang (r13b1=1), total biaya 50jt (pangsa
// produksi 0,4), pendapatan 55jt → rasio 1,1 (di antara 1 dan 1,25), aset
// kecil, 2 pekerja (r24c1, bukan 1 → U5 aman), pakai internet & menyusun
// laporan keuangan. KBLI 01111 → rasio NTB 5jt/55jt ≈ 0,09, jauh di bawah
// batas 0,8127 → U9 aman.
function usahaBase() {
  return {
    nama_usaha: 'WARUNG SEGARA', r11a: 2, r13b1: 1, r13g: '01111', r16a: 1, r11d: 1,
    r22: 1, r24c1: 2, r25: 2019,
    r26a: 10000000, r26b: 20000000, r26c: 10000000, r26d: 5000000, r26e: 5000000,
    r27c: 55000000, r28c: 8000000, r29c: 0, r29d: 0,
    roster: {}
  };
}

function make(id, jenis, expect, base, mutate) {
  var answers = base();
  if (mutate) mutate(answers);
  return { id: id, jenis: jenis, expect: expect, answers: answers };
}

var TEST_RECORDS = [
  // ---- Bersih (0 anomali) ----
  make('bersih-keluarga', 'keluarga', [], keluargaBase, null),
  make('bersih-usaha', 'usaha', [], usahaBase, null),

  // ---- Keluarga: isolasi per rule ----
  make('k1-pasangan-cerai', 'keluarga', ['K1'], keluargaBase, function (a) {
    a.roster.anggota_keluarga[1].b1r11_n = 3; // istri cerai hidup
  }),
  make('k1-anak-cerai-bukan-anomali', 'keluarga', [], keluargaBase, function (a) {
    // anggota ke-2 (index 1) diganti jadi anak (bukan istri/suami) berstatus
    // cerai mati — bukan pasutri, status kawinnya TIDAK diperiksa K1.
    a.roster.anggota_keluarga[1].b1r8_n = 3;
    a.roster.anggota_keluarga[1].b1r11_n = 4;
  }),
  make('k2-kk-anak-rumah-sendiri', 'keluarga', ['K2'], keluargaBase, function (a) {
    a.b1r13_1 = 8; // umur KK < 10, b4r3a tetap 1 (milik sendiri)
  }),
  make('k3-semua-disabilitas', 'keluarga', ['K3'], keluargaBase, function (a) {
    var rows = a.roster.anggota_keluarga;
    rows[0].b3r20a_n = 1; rows[1].b3r20b_n = 1; rows[2].b3r20c_n = 1; rows[3].b3r20f_n = 1;
  }),
  make('k4-luas-ekstrem', 'keluarga', ['K4'], keluargaBase, function (a) {
    a.b4r5 = 900; // 900/4 = 225 m² per kapita > 200
  }),
  make('k5-pendapatan-negatif', 'keluarga', ['K5'], keluargaBase, function (a) {
    a.roster.anggota_keluarga[0].b3r18a_n = 0; // total pendapatan 0 < pengeluaran
  }),
  make('k6-listrik-rendah-barang-mewah', 'keluarga', ['K6'], keluargaBase, function (a) {
    a.b4r15a = 50000; a.b4r17c = 1; // listrik < 100rb + punya mobil
  }),
  make('k7-anggota-ekstrem', 'keluarga', ['K7'], keluargaBase, function (a) {
    for (var i = 0; i < 7; i++) a.roster.anggota_keluarga.push(member({ b1r6_n: 'ANAK-' + (i + 3) }));
    // 11 anggota; luas per kapita 80/11 ≈ 7,3 → K4 tetap aman
  }),

  // ---- Keluarga: multi-trigger ----
  make('multi-keluarga-k2-k5-k6', 'keluarga', ['K2', 'K5', 'K6'], keluargaBase, function (a) {
    a.b1r13_1 = 7;                                // K2
    a.roster.anggota_keluarga[0].b3r18a_n = 0;    // K5
    a.b4r15a = 50000; a.b4r17d = 2;               // K6 (cabang pengeluaran listrik)
    a.roster.meteran_listrik = [{ b4r14b_n: 1 }]; // K6 (cabang meteran 450 VA)
  }),

  // ---- Usaha: isolasi per rule ----
  make('u1-biaya-produksi-dominan', 'usaha', ['U1'], usahaBase, function (a) {
    a.r13b1 = 2; // tidak memproduksi barang di lokasi ini
    a.r26a = 5000000; a.r26b = 35000000; a.r26c = 5000000; a.r26d = 3000000; a.r26e = 2000000;
    // total tetap 50jt, pangsa produksi 0,7 — rasio 55/50 = 1,1 aman dari U2/U4
  }),
  make('u2-usaha-rugi', 'usaha', ['U2'], usahaBase, function (a) {
    a.r27c = 40000000; // < total biaya 50jt
    a.r22 = 2;         // bukan "Ya, sebagai SPPG" supaya U4 (rasio 0,8 < 1) tidak ikut
  }),
  make('u3-modal-korporasi', 'usaha', ['U3'], usahaBase, function (a) {
    a.r11a = 13; a.r29c = 5000000;
  }),
  make('u4-rasio-tidak-wajar', 'usaha', ['U4'], usahaBase, function (a) {
    a.r27c = 70000000; // rasio 1,4 ≥ 1,25; > total biaya → U2 aman; ≥ 60jt → U5 aman
  }),
  make('u5-aset-mbg', 'usaha', ['U5'], usahaBase, function (a) {
    a.r28c = 50000000; a.r24c1 = 1; // aset > 10jt, 1 pekerja (r24c1="Total pekerja"), pendapatan 55jt < 60jt
  }),
  make('u6-besar-tanpa-internet', 'usaha', ['U6'], usahaBase, function (a) {
    a.r16a = 2; a.r27c = 15000000000;
    a.r22 = 2; // rasio 300 akan memicu U4 kalau dibiarkan "Ya, sebagai SPPG" (1)
    delete a.r13g; // rasio NTB ≈ 0,997 pasti > batas mana pun — kosongkan KBLI supaya U9 tidak ikut (isolasi)
  }),
  make('u7-besar-tanpa-laporan', 'usaha', ['U7'], usahaBase, function (a) {
    a.r11d = 2; a.r27c = 15000000000;
    a.r22 = 2; // idem U6
    delete a.r13g; // idem U6
  }),
  make('u9-rasio-ntb-tinggi', 'usaha', ['U9'], usahaBase, function (a) {
    a.r26a = 2000000; a.r26b = 3000000; a.r26c = 2000000; a.r26d = 1000000; a.r26e = 1000000;
    // total biaya 9jt, pendapatan 55jt → rasio_ntb 46/55 ≈ 0,836 > 0,8127 (batas 01111)
    a.r22 = 2; // rasio pendapatan/biaya 6,1 akan memicu U4 kalau tetap SPPG
  }),

  // ---- Usaha: multi-trigger ----
  make('multi-usaha-u2-u4', 'usaha', ['U2', 'U4'], usahaBase, function (a) {
    a.r27c = 40000000; // rugi (U2) + rasio 0,8 < 1 dengan pembukuan (U4)
  })
];

module.exports = { TEST_RECORDS: TEST_RECORDS, TEST_NTB_RASIO: TEST_NTB_RASIO, keluargaBase: keluargaBase, usahaBase: usahaBase, member: member };
