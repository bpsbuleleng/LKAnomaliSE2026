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

  // Urutan penting: field yang bergantung field computed lain harus setelahnya.
  // Elemen ke-3 = label tampilan (dipakai dropdown field di halaman config).
  var PIPELINE = {
    keluarga: [
      ['b1r9', b1r9, 'Jumlah anggota keluarga (hitungan)'],
      ['b3r18c', b3r18c, 'Total pendapatan sebulan (hitungan)'],
      ['b4r16', b4r16, 'Total pengeluaran sebulan (hitungan)'],
      ['luas_per_kapita', luasPerKapita, 'Luas lantai per kapita m² (hitungan)']
    ],
    usaha: [
      ['r26_total', r26Total, 'Total biaya usaha setahun (hitungan)'],
      ['pangsa_biaya_produksi', pangsaBiayaProduksi, 'Pangsa biaya produksi 0-1 (hitungan)'],
      ['rasio_pendapatan_biaya', rasioPendapatanBiaya, 'Rasio pendapatan/biaya (hitungan)']
    ]
  };

  /** Kembalikan SALINAN answers dengan computed fields ditambahkan/ditimpa. */
  function augment(jenis, answers) {
    var out = {};
    Object.keys(answers || {}).forEach(function (k) { out[k] = answers[k]; });
    (PIPELINE[jenis] || []).forEach(function (step) {
      out[step[0]] = step[1](out);
    });
    return out;
  }

  /** Daftar computed field per jenis — untuk dropdown field halaman config. */
  function listFields(jenis) {
    return (PIPELINE[jenis] || []).map(function (step) {
      return { id: step[0], label: step[2] };
    });
  }

  return { augment: augment, listFields: listFields };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ComputedFields;
}
