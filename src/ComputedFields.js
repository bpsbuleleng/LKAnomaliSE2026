/**
 * ComputedFields — field hasil hitungan yang dihitung SAAT SUBMIT lalu
 * disimpan sebagai field biasa di `answers`, supaya evaluator rule tetap
 * sederhana (field/op/value) tanpa bahasa agregat generik.
 * Logic murni: tanpa dependency GAS, di-unit-test di Node.
 *
 * Satu fungsi kecil per field (bukan bahasa query) — sesuai keputusan di
 * CLAUDE.md "GAP ARSITEKTUR". Guard pembagian: penyebut 0/kosong → hasil
 * null; evaluator memperlakukan null sebagai "tidak berlaku" (kondisi false).
 *
 * Submit ulang menghitung ulang & menimpa nilai lama — computed field TIDAK
 * pernah diisi manual dan tidak dirender di kuesioner (bukan baris Questions).
 */
var ComputedFields = (function () {
  // Jumlah: komponen kosong dianggap 0 (isian belum lengkap ≠ NaN).
  function num(v) {
    if (v === undefined || v === null || v === '') return 0;
    var n = Number(v);
    return isNaN(n) ? 0 : n;
  }

  function rows(answers, group) {
    var r = answers.roster && answers.roster[group];
    return Array.isArray(r) ? r : [];
  }

  function eqCode(v, code) { return Number(v) === code; }

  // jumlah_<roster> = banyak BARIS roster grup itu, apa pun isinya — beda
  // dari b1r9 yang hanya menghitung kode keberadaan 1/5. Client (DraftLogic)
  // memelihara nilai yang sama live saat baris ditambah/dihapus; nilai di
  // sini yang otoritatif karena dihitung ulang tiap submit.
  function rosterCount(group) {
    return function (a) { return rows(a, group).length; };
  }

  // b1r9 = jumlah anggota roster dengan status keberadaan 1 (tinggal di sini)
  // atau 5 (anggota baru).
  function b1r9(a) {
    return rows(a, 'anggota_keluarga').filter(function (m) {
      return eqCode(m.b1r9_n, 1) || eqCode(m.b1r9_n, 5);
    }).length;
  }

  // b3r18c = SUM tiga komponen pendapatan di SEMUA baris roster (dipakai K5).
  function b3r18c(a) {
    return rows(a, 'anggota_keluarga').reduce(function (sum, m) {
      return sum + num(m.b3r18a_n) + num(m.b3r18b_n) + num(m.b3r18c_n);
    }, 0);
  }

  // b4r16 = (mingguan × 30 ÷ 7) + bulanan + (tahunan ÷ 12) — total pengeluaran
  // sebulan (rumus dikonfirmasi user, cocok dengan Identifikasi K5).
  function b4r16(a) {
    return (num(a.b4r16a) * 30 / 7) + num(a.b4r16b) + (num(a.b4r16c) / 12);
  }

  // luas_per_kapita = b4r5 ÷ b1r9 (dipakai K4). b1r9 dihitung DULUAN.
  function luasPerKapita(a) {
    var jml = num(a.b1r9);
    return jml > 0 ? num(a.b4r5) / jml : null;
  }

  // r13f = kategori 1 digit, digit PERTAMA dari kode KBLI 5 digit r13g —
  // string (bukan number) supaya konsisten dengan cara kode wilayah/KBLI
  // diperlakukan di app ini (leading zero itu bagian dari identitasnya).
  function r13f(a) {
    var kode = String(a.r13g == null ? '' : a.r13g);
    return kode ? kode.charAt(0) : '';
  }

  // r13h = Kategori KBLI (huruf A-U), dipetakan dari 2 digit PERTAMA kode
  // KBLI (Golongan Pokok) r13g, mengikuti struktur baku Klasifikasi Baku
  // Lapangan Usaha Indonesia (KBLI) 2020 milik BPS. TIDAK ADA sumber data
  // pemetaan ini di repo (master/kbli.json cuma berisi level "Kelompok" 5
  // digit) — rentang di bawah dari pengetahuan umum struktur KBLI 2020,
  // BUKAN dari file referensi proyek. Mohon diverifikasi ke dokumen KBLI
  // 2020 resmi kalau dipakai untuk keperluan resmi.
  var KATEGORI_RANGES = [
    [1, 3, 'A'], [5, 9, 'B'], [10, 33, 'C'], [35, 35, 'D'], [36, 39, 'E'],
    [41, 43, 'F'], [45, 47, 'G'], [49, 53, 'H'], [55, 56, 'I'], [58, 63, 'J'],
    [64, 66, 'K'], [68, 68, 'L'], [69, 75, 'M'], [77, 82, 'N'], [84, 84, 'O'],
    [85, 85, 'P'], [86, 88, 'Q'], [90, 93, 'R'], [94, 96, 'S'], [97, 98, 'T'],
    [99, 99, 'U']
  ];
  function r13h(a) {
    var kode = String(a.r13g == null ? '' : a.r13g);
    if (kode.length < 2) return '';
    var golPokok = Number(kode.slice(0, 2));
    if (isNaN(golPokok)) return '';
    for (var i = 0; i < KATEGORI_RANGES.length; i++) {
      if (golPokok >= KATEGORI_RANGES[i][0] && golPokok <= KATEGORI_RANGES[i][1]) return KATEGORI_RANGES[i][2];
    }
    return '';
  }

  function r26Total(a) {
    return num(a.r26a) + num(a.r26b) + num(a.r26c) + num(a.r26d) + num(a.r26e);
  }

  function pangsaBiayaProduksi(a) {
    var total = num(a.r26_total);
    return total > 0 ? num(a.r26b) / total : null;
  }

  function rasioPendapatanBiaya(a) {
    var total = num(a.r26_total);
    return total > 0 ? num(a.r27c) / total : null;
  }

  // rasio_ntb = (r27c − r26_total) ÷ r27c — rasio Nilai Tambah Bruto
  // (sirusa.web.bps.go.id/metadata/indikator/4621). r27c 0/kosong → null.
  function rasioNtb(a) {
    var pendapatan = num(a.r27c);
    return pendapatan > 0 ? (pendapatan - num(a.r26_total)) / pendapatan : null;
  }

  // batas_rasio_ntb = lookup rasio NTB SE2016 per kode KBLI r13g dari tab
  // "Rasio NTB SE2016" (dioper caller lewat refs.ntbRasio — modul ini tetap
  // bebas dependency GAS). Kode tak ada di tabel / tabel tak dioper → null
  // (rule U9 tidak berlaku, konsisten semantik nilai kosong evaluator).
  function batasRasioNtb(a, refs) {
    var map = refs && refs.ntbRasio;
    if (!map) return null;
    var kode = String(a.r13g == null ? '' : a.r13g).trim();
    if (!kode || !Object.prototype.hasOwnProperty.call(map, kode)) return null;
    var v = Number(map[kode]);
    return isNaN(v) ? null : v;
  }

  /**
   * Bangun map {kode KBLI → rasio NTB} dari baris mentah tab "Rasio NTB
   * SE2016" ({kode, rasio} string apa adanya). Baris tanpa kode / rasio
   * non-numerik dilewati. Tab riil punya 125 kode DUPLIKAT dengan rasio
   * berbeda (satu kode terpetakan ke >1 kategori) — kebijakan: ambil yang
   * TERBESAR, konservatif: anomali hanya kalau melebihi batas tertinggi.
   */
  function buildNtbRasioMap(rows) {
    var map = {};
    (rows || []).forEach(function (r) {
      var kode = String(r && r.kode != null ? r.kode : '').trim();
      if (!kode || r.rasio === '' || r.rasio == null) return;
      var rasio = Number(r.rasio);
      if (isNaN(rasio)) return;
      if (!(kode in map) || rasio > map[kode]) map[kode] = rasio;
    });
    return map;
  }

  // Urutan penting: field yang bergantung field computed lain harus setelahnya.
  // Elemen ke-3 = label tampilan (dipakai dropdown field di halaman config).
  var PIPELINE = {
    keluarga: [
      ['jumlah_anggota_keluarga', rosterCount('anggota_keluarga'), 'Jumlah baris roster Anggota Keluarga (hitungan)'],
      ['jumlah_meteran_listrik', rosterCount('meteran_listrik'), 'Jumlah baris roster Meteran Listrik (hitungan)'],
      ['b1r9', b1r9, 'Jumlah anggota keluarga (hitungan)'],
      ['b3r18c', b3r18c, 'Total pendapatan sebulan (hitungan)'],
      ['b4r16', b4r16, 'Total pengeluaran sebulan (hitungan)'],
      ['luas_per_kapita', luasPerKapita, 'Luas lantai per kapita m² (hitungan)']
    ],
    usaha: [
      ['r13f', r13f, 'Kategori 1 digit dari kode KBLI (hitungan)'],
      ['r13h', r13h, 'Kategori huruf A-U dari kode KBLI (hitungan)'],
      ['r26_total', r26Total, 'Total biaya usaha setahun (hitungan)'],
      ['pangsa_biaya_produksi', pangsaBiayaProduksi, 'Pangsa biaya produksi 0-1 (hitungan)'],
      ['rasio_pendapatan_biaya', rasioPendapatanBiaya, 'Rasio pendapatan/biaya (hitungan)'],
      ['rasio_ntb', rasioNtb, 'Rasio NTB (pendapatan−biaya)÷pendapatan (hitungan)'],
      ['batas_rasio_ntb', batasRasioNtb, 'Batas rasio NTB SE2016 per KBLI (hitungan)']
    ]
  };

  /**
   * Kembalikan SALINAN answers dengan computed fields ditambahkan/ditimpa.
   * @param refs tabel referensi eksternal opsional untuk field lookup,
   *        saat ini: { ntbRasio: {kode→rasio} } (lihat buildNtbRasioMap).
   */
  function augment(jenis, answers, refs) {
    var out = {};
    Object.keys(answers || {}).forEach(function (k) { out[k] = answers[k]; });
    (PIPELINE[jenis] || []).forEach(function (step) {
      out[step[0]] = step[1](out, refs);
    });
    return out;
  }

  /** Daftar computed field per jenis — untuk dropdown field halaman config. */
  function listFields(jenis) {
    return (PIPELINE[jenis] || []).map(function (step) {
      return { id: step[0], label: step[2] };
    });
  }

  return { augment: augment, listFields: listFields, buildNtbRasioMap: buildNtbRasioMap };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ComputedFields;
}
