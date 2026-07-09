/**
 * ComputedFields — field hasil hitungan yang dihitung SAAT SUBMIT lalu
 * disimpan sebagai field biasa di `answers`, supaya evaluator rule tetap
 * sederhana (field/op/value) tanpa bahasa agregat generik.
 * Logic murni: tanpa dependency GAS, di-unit-test di Node.
 *
 * Tiga kelompok field, TIDAK dicampur:
 *   1. FORMULA-EDITABLE (aritmetika flat, tanpa akses roster/tabel eksternal)
 *      — didefinisikan sebagai string Formula.js (parser aman, TANPA eval)
 *      di EDITABLE_DEFAULTS, admin bisa menimpanya lewat tab "Variabel
 *      Hitungan" (dioper via refs.formulaOverrides — lihat DataAccess
 *      getComputedFields/updateComputedFieldFormula). Field OVERRIDE rusak
 *      (seharusnya sudah divalidasi saat disimpan) fallback diam-diam ke
 *      default, submit TIDAK PERNAH gagal karena formula admin.
 *   2. TETAP DI KODE (agregasi roster, lookup tabel, ekstraksi string) —
 *      satu fungsi kecil per field seperti sebelumnya (CLAUDE.md "GAP
 *      ARSITEKTUR"), TIDAK bisa diedit dari UI karena butuh primitif di luar
 *      grammar aritmetika flat (roster_*, lookup KBLI, dst).
 *   3. CUSTOM buatan admin (CRUD halaman config) — grammar aritmetika flat
 *      yang SAMA dengan kelompok 1, dioper via refs.customFields
 *      ([{id, formula}], urut baris tab "Variabel Hitungan") dan dievaluasi
 *      SETELAH pipeline bawaan — boleh merujuk jawaban kuesioner, field
 *      bawaan, dan custom field yang barisnya lebih dulu. Formula rusak →
 *      nilai null ("tidak berlaku"), submit tetap jalan.
 *
 * Guard pembagian (kedua kelompok): penyebut 0/kosong → hasil null; evaluator
 * memperlakukan null sebagai "tidak berlaku" (kondisi false).
 *
 * Submit ulang menghitung ulang & menimpa nilai lama — computed field TIDAK
 * pernah diisi manual dan tidak dirender di kuesioner (bukan baris Questions).
 */
var ComputedFields = (function () {
  // GAS: Formula global antar-file; Node: require (ditunda ke saat panggil).
  function formulaLib() {
    if (typeof module !== 'undefined' && module.exports) return require('./Formula.js');
    return Formula;
  }

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

  // Formula DEFAULT untuk field yang boleh diedit admin (aritmetika flat,
  // TANPA roster/lookup — lihat komentar atas file). String ini adalah
  // SUMBER KEBENARAN (bukan sekadar dokumentasi) — dipakai formulaStep()
  // sebagai fallback saat tidak ada override, DAN oleh listFields/fieldMeta
  // untuk ditampilkan di halaman admin.
  var EDITABLE_DEFAULTS = {
    keluarga: {
      // Total pengeluaran sebulan (rumus dikonfirmasi user, cocok Identifikasi K5).
      b4r16: '(b4r16a * 30 / 7) + b4r16b + (b4r16c / 12)',
      // Luas lantai per kapita (dipakai K4). b1r9 sudah dihitung LEBIH DULU
      // di pipeline — di sini cuma field angka biasa, bukan akses roster.
      luas_per_kapita: 'b4r5 / b1r9'
    },
    usaha: {
      r26_total: 'r26a + r26b + r26c + r26d + r26e',
      pangsa_biaya_produksi: 'r26b / r26_total',
      rasio_pendapatan_biaya: 'r27c / r26_total',
      // Rasio NTB (sirusa.web.bps.go.id/metadata/indikator/4621).
      rasio_ntb: '(r27c - r26_total) / r27c'
    }
  };

  /**
   * Step pipeline untuk field formula-editable: pakai override
   * refs.formulaOverrides[fieldId] kalau ada (string tervalidasi saat
   * disimpan — lihat DataAccess.updateComputedFieldFormula), else default.
   * Override yang ternyata rusak (mis. tab diedit manual di luar UI admin)
   * TIDAK BOLEH menggagalkan submit — fallback diam-diam ke default.
   */
  function formulaStep(jenis, fieldId) {
    var defaultFormula = EDITABLE_DEFAULTS[jenis][fieldId];
    return function (a, refs) {
      var override = refs && refs.formulaOverrides && refs.formulaOverrides[fieldId];
      try {
        return formulaLib().evaluateExpr(override || defaultFormula, a);
      } catch (e) {
        return formulaLib().evaluateExpr(defaultFormula, a);
      }
    };
  }

  // Urutan penting: field yang bergantung field computed lain harus setelahnya.
  // Elemen ke-3 = label tampilan; elemen ke-4 = { editable, note } — note
  // dipakai halaman admin untuk field TETAP DI KODE (editable:false).
  var PIPELINE = {
    keluarga: [
      ['jumlah_anggota_keluarga', rosterCount('anggota_keluarga'), 'Jumlah baris roster Anggota Keluarga (hitungan)',
        { editable: false, note: 'Banyak baris roster anggota_keluarga, apa pun isinya (agregasi roster — tetap di kode).' }],
      ['jumlah_meteran_listrik', rosterCount('meteran_listrik'), 'Jumlah baris roster Meteran Listrik (hitungan)',
        { editable: false, note: 'Banyak baris roster meteran_listrik, apa pun isinya (agregasi roster — tetap di kode).' }],
      ['b1r9', b1r9, 'Jumlah anggota keluarga (hitungan)',
        { editable: false, note: 'Count baris roster anggota_keluarga dengan b1r9_n = 1 (tinggal) atau 5 (anggota baru) — agregasi roster, tetap di kode.' }],
      ['b3r18c', b3r18c, 'Total pendapatan sebulan (hitungan)',
        { editable: false, note: 'SUM b3r18a_n + b3r18b_n + b3r18c_n di SEMUA baris roster anggota_keluarga — agregasi roster, tetap di kode.' }],
      ['b4r16', formulaStep('keluarga', 'b4r16'), 'Total pengeluaran sebulan (hitungan)', { editable: true }],
      ['luas_per_kapita', formulaStep('keluarga', 'luas_per_kapita'), 'Luas lantai per kapita m² (hitungan)', { editable: true }]
    ],
    usaha: [
      ['r13f', r13f, 'Kategori 1 digit dari kode KBLI (hitungan)',
        { editable: false, note: 'Digit pertama kode KBLI r13g (ekstraksi string, tetap di kode).' }],
      ['r13h', r13h, 'Kategori huruf A-U dari kode KBLI (hitungan)',
        { editable: false, note: 'Golongan pokok (2 digit pertama r13g) dipetakan ke huruf kategori KBLI 2020 (lookup rentang, tetap di kode).' }],
      ['r26_total', formulaStep('usaha', 'r26_total'), 'Total biaya usaha setahun (hitungan)', { editable: true }],
      ['pangsa_biaya_produksi', formulaStep('usaha', 'pangsa_biaya_produksi'), 'Pangsa biaya produksi 0-1 (hitungan)', { editable: true }],
      ['rasio_pendapatan_biaya', formulaStep('usaha', 'rasio_pendapatan_biaya'), 'Rasio pendapatan/biaya (hitungan)', { editable: true }],
      ['rasio_ntb', formulaStep('usaha', 'rasio_ntb'), 'Rasio NTB (pendapatan−biaya)÷pendapatan (hitungan)', { editable: true }],
      ['batas_rasio_ntb', batasRasioNtb, 'Batas rasio NTB SE2016 per KBLI (hitungan)',
        { editable: false, note: 'Lookup kode KBLI r13g di tab "Rasio NTB SE2016" (kode dobel → ambil rasio terbesar) — tabel eksternal, tetap di kode.' }]
    ]
  };

  /**
   * Kembalikan SALINAN answers dengan computed fields ditambahkan/ditimpa.
   * @param refs tabel referensi eksternal opsional:
   *        { ntbRasio: {kode→rasio}, formulaOverrides: {fieldId→formula},
   *          customFields: [{id, formula}] } — lihat kelompok 3 di atas.
   */
  function augment(jenis, answers, refs) {
    var out = {};
    Object.keys(answers || {}).forEach(function (k) { out[k] = answers[k]; });
    (PIPELINE[jenis] || []).forEach(function (step) {
      out[step[0]] = step[1](out, refs);
    });
    // Custom field admin dievaluasi paling akhir, urut baris tab — formula
    // rusak (mis. tab diedit manual) → null, TIDAK menggagalkan submit.
    ((refs && refs.customFields) || []).forEach(function (cf) {
      var val = null;
      try { val = formulaLib().evaluateExpr(cf.formula, out); } catch (e) { val = null; }
      out[cf.id] = val;
    });
    return out;
  }

  /** Daftar computed field per jenis — untuk dropdown field & halaman admin. */
  function listFields(jenis) {
    return (PIPELINE[jenis] || []).map(function (step) {
      var meta = step[3] || {};
      var f = { id: step[0], label: step[2], editable: !!meta.editable };
      if (meta.editable) f.defaultFormula = EDITABLE_DEFAULTS[jenis][step[0]];
      if (meta.note) f.note = meta.note;
      return f;
    });
  }

  /** Metadata satu field — dipakai DataAccess memvalidasi sebelum menyimpan override. */
  function fieldMeta(jenis, fieldId) {
    var steps = PIPELINE[jenis] || [];
    for (var i = 0; i < steps.length; i++) {
      if (steps[i][0] === fieldId) {
        var meta = steps[i][3] || {};
        return { editable: !!meta.editable, defaultFormula: meta.editable ? EDITABLE_DEFAULTS[jenis][fieldId] : null };
      }
    }
    return null;
  }

  return { augment: augment, listFields: listFields, fieldMeta: fieldMeta, buildNtbRasioMap: buildNtbRasioMap };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ComputedFields;
}
