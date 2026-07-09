/**
 * SheetDb — lapisan akses Google Sheets (Fase 5). SATU-SATUNYA file yang
 * menyentuh SpreadsheetApp; modul logic murni (RecordLogic dll) tidak
 * tahu-menahu soal sheet. Fungsi baca mengembalikan objek berbentuk PERSIS
 * seperti MockData Fase 0-4 (kunci = nama kolom asli), jadi bentuk data yang
 * mengalir lewat boundary DataAccess tidak berubah.
 *
 * Guardrail leading zero (CLAUDE.md): SEMUA pembacaan pakai getDisplayValues()
 * sehingga nilai selalu string apa adanya ("010" tidak berubah jadi 10), dan
 * tab milik aplikasi (Records/Questions/Rules) diformat TEXT ('@') sekolom
 * penuh saat dibuat supaya Sheets tidak pernah meng-coerce isi sel ("010" →
 * angka, string ISO → Date). Normalisasi tipe (Number/boolean/JSON) terjadi
 * eksplisit di fromRow* di sini — bukan diserahkan ke Sheets.
 */
var SheetDb = (function () {
  var SPREADSHEET_ID = '1-AaXOXyy83Txn5xKxN9HpDYGuj5TwuaiYAD8nRKUUMU';

  var TABS = {
    PETUGAS: 'Petugas',
    ALOKASI: 'Alokasi Wilayah',
    RECORDS: 'Records',
    QUESTIONS: 'Questions',
    RULES: 'Rules',
    NTB: 'Rasio NTB SE2016',
    COMPUTED: 'Variabel Hitungan'
  };

  var PETUGAS_HEADERS = ['Nama Lengkap', 'Posisi', 'Posisi Daftar', 'Alamat Detail', 'Jenis Kelamin', 'SOBAT ID', 'Email'];
  var ALOKASI_HEADERS = ['idsubsls', 'kdprov', 'kdkab', 'kdkec', 'kddesa', 'kdsls', 'kdsubsls',
    'nmprov', 'nmkab', 'nmkec', 'nmdesa', 'nmsls', 'nmppl', 'nmpml', 'emailppl', 'emailpml'];
  // Snapshot wilayah di Records = kolom yang sama persis dengan Alokasi Wilayah.
  var RECORD_HEADERS = ['record_id', 'pml_email', 'jenis', 'status']
    .concat(ALOKASI_HEADERS)
    .concat(['answers', 'anomalies', 'created_at', 'updated_at']);
  var QUESTION_HEADERS = ['question_id', 'jenis', 'order', 'label', 'type', 'options', 'required', 'help', 'active', 'roster_group'];
  var RULE_HEADERS = ['rule_id', 'jenis', 'severity', 'message', 'when', 'active'];
  // Tab referensi buatan user (~2560 baris, kode KBLI 5 digit → rasio NTB
  // SE2016) — app hanya baca, dipakai computed field batas_rasio_ntb (U9).
  var NTB_HEADERS = ['KBLI 2025', 'Judul KBLI 2025', 'Kategori KBLI 2020', 'Rasio NTB SE 2016'];
  // Tab BARU (dibuat aplikasi sendiri, bukan diimpor user): override formula
  // computed field yang boleh diedit admin (lihat ComputedFields
  // EDITABLE_DEFAULTS). SPARSE — hanya field yang di-override admin punya
  // baris; field lain pakai default di kode. Baris dihapus (bukan
  // dikosongkan) saat admin reset ke default lewat updateComputedFieldFormula.
  var COMPUTED_HEADERS = ['field_id', 'jenis', 'formula'];

  // Satu handle spreadsheet per eksekusi (global GAS hidup sepanjang satu
  // panggilan google.script.run saja — ini memo, bukan state antar panggilan).
  var ssCache = null;
  function ss() {
    if (!ssCache) ssCache = SpreadsheetApp.openById(SPREADSHEET_ID);
    return ssCache;
  }

  function mustSheet(name) {
    var sh = ss().getSheetByName(name);
    if (!sh) throw new Error('Tab "' + name + '" tidak ada di spreadsheet — jalankan adminSetupSheets dulu.');
    return sh;
  }

  function s_(v) { return String(v == null ? '' : v); }

  function toBool_(v) {
    return v === true || String(v).trim().toUpperCase() === 'TRUE';
  }

  function parseJson_(str, fallback) {
    if (str === '' || str == null) return fallback;
    try { return JSON.parse(str); } catch (e) { return fallback; }
  }

  // ==== primitif tabel ====

  /** Baca satu tab jadi array objek {namaHeader: string}; baris kosong dilewati. */
  function readTable(name) {
    var values = mustSheet(name).getDataRange().getDisplayValues();
    if (values.length < 2) return [];
    var headers = values[0].map(function (h) { return String(h).trim(); });
    var out = [];
    for (var i = 1; i < values.length; i++) {
      var row = {};
      var empty = true;
      for (var j = 0; j < headers.length; j++) {
        if (!headers[j]) continue;
        row[headers[j]] = values[i][j];
        if (values[i][j] !== '') empty = false;
      }
      if (!empty) out.push(row);
    }
    return out;
  }

  function ensureCapacity_(sh, neededRows) {
    var max = sh.getMaxRows();
    if (neededRows > max) sh.insertRowsAfter(max, neededRows - max + 20);
  }

  /**
   * Tulis ulang SELURUH isi data tab (header tetap). Hanya untuk tab kecil
   * (Questions/Rules) dan HARUS di bawah ScriptLock — array yang ditulis
   * selalu berisi SEMUA baris (soft-delete cuma flip kolom active), jadi ini
   * bukan hard-delete.
   */
  function writeTable_(name, headers, rowsArrays) {
    var sh = mustSheet(name);
    var last = sh.getLastRow();
    if (last > 1) sh.getRange(2, 1, last - 1, sh.getMaxColumns()).clearContent();
    if (rowsArrays.length) {
      ensureCapacity_(sh, 1 + rowsArrays.length);
      sh.getRange(2, 1, rowsArrays.length, headers.length).setValues(rowsArrays);
    }
  }

  /**
   * Buat tab kalau belum ada: header + SEMUA kolom diformat TEXT ('@').
   * Tab yang sudah ada TIDAK disentuh strukturnya. @return true kalau baru dibuat.
   */
  function ensureTab(name, headers) {
    var sh = ss().getSheetByName(name);
    if (sh) return false;
    sh = ss().insertSheet(name);
    sh.getRange(1, 1, sh.getMaxRows(), headers.length).setNumberFormat('@');
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sh.setFrozenRows(1);
    return true;
  }

  /** Isi data HANYA kalau tab masih kosong — TIDAK PERNAH menimpa isi yang ada.
   *  @return jumlah baris yang ditulis (0 = sudah ada isi, tidak disentuh). */
  function seedIfEmpty_(name, headers, rowsArrays) {
    var sh = mustSheet(name);
    if (sh.getLastRow() > 1) return 0;
    // Jaga-jaga: tab lama yang dibuat manual bisa belum berformat text.
    sh.getRange(1, 1, sh.getMaxRows(), headers.length).setNumberFormat('@');
    writeTable_(name, headers, rowsArrays);
    return rowsArrays.length;
  }

  // ==== Petugas & Alokasi Wilayah (referensi; app hanya baca) ====

  function readPetugas() { return readTable(TABS.PETUGAS); }
  function readAlokasi() { return readTable(TABS.ALOKASI); }

  /**
   * Baca tab "Rasio NTB SE2016" jadi [{kode, rasio}] (string apa adanya —
   * leading zero KBLI selamat via getDisplayValues). Tab belum ada → []
   * (submit tetap jalan, batas_rasio_ntb null = rule NTB tidak berlaku).
   */
  function readNtbRasio() {
    if (!ss().getSheetByName(TABS.NTB)) return [];
    return readTable(TABS.NTB).map(function (r) {
      return { kode: s_(r[NTB_HEADERS[0]]), rasio: s_(r[NTB_HEADERS[3]]) };
    });
  }

  /**
   * Baca override formula computed field milik SATU jenis jadi map
   * {field_id: formula}. Tab belum ada / baris tanpa formula → dilewati
   * (field itu pakai default di kode — lihat ComputedFields.formulaStep).
   */
  function readComputedFieldFormulas(jenis) {
    if (!ss().getSheetByName(TABS.COMPUTED)) return {};
    var map = {};
    readTable(TABS.COMPUTED).forEach(function (r) {
      if (s_(r.jenis) !== jenis) return;
      var id = s_(r.field_id);
      var formula = s_(r.formula);
      if (id && formula) map[id] = formula;
    });
    return map;
  }

  /**
   * Simpan/timpa formula override SATU field, atau hapus barisnya kalau
   * formula kosong (= reset ke default) — tab TIDAK PERNAH menumpuk baris
   * kosong. Membuat tab kalau belum ada (dipanggil pertama kali admin
   * mengedit formula, bukan lewat adminSetupSheets — tab ini bukan bagian
   * dari data awal). Caller WAJIB di bawah ScriptLock.
   */
  function upsertComputedFieldFormula(jenis, fieldId, formula) {
    if (!ss().getSheetByName(TABS.COMPUTED)) ensureTab(TABS.COMPUTED, COMPUTED_HEADERS);
    var sh = mustSheet(TABS.COMPUTED);
    var last = sh.getLastRow();
    var rowIndex = -1;
    if (last >= 2) {
      var ids = sh.getRange(2, 1, last - 1, 2).getDisplayValues();
      for (var i = 0; i < ids.length; i++) {
        if (ids[i][0] === fieldId && ids[i][1] === jenis) { rowIndex = i + 2; break; }
      }
    }
    if (!formula) {
      if (rowIndex !== -1) sh.deleteRow(rowIndex);
      return;
    }
    if (rowIndex === -1) {
      rowIndex = last + 1;
      ensureCapacity_(sh, rowIndex);
    }
    sh.getRange(rowIndex, 1, 1, COMPUTED_HEADERS.length).setValues([[fieldId, jenis, formula]]);
  }

  function petugasToRow_(p) { return PETUGAS_HEADERS.map(function (h) { return s_(p[h]); }); }
  function alokasiToRow_(a) { return ALOKASI_HEADERS.map(function (h) { return s_(a[h]); }); }

  function seedPetugasIfEmpty(rows) {
    return seedIfEmpty_(TABS.PETUGAS, PETUGAS_HEADERS, rows.map(petugasToRow_));
  }
  function seedAlokasiIfEmpty(rows) {
    return seedIfEmpty_(TABS.ALOKASI, ALOKASI_HEADERS, rows.map(alokasiToRow_));
  }

  // ==== Records ====

  function recordToRow_(rec) {
    var w = rec.wilayah || {};
    var row = [s_(rec.record_id), s_(rec.pml_email), s_(rec.jenis), s_(rec.status)];
    for (var i = 0; i < ALOKASI_HEADERS.length; i++) row.push(s_(w[ALOKASI_HEADERS[i]]));
    row.push(JSON.stringify(rec.answers || {}));
    row.push(JSON.stringify(rec.anomalies || []));
    row.push(s_(rec.created_at));
    row.push(s_(rec.updated_at));
    return row;
  }

  function recordFromRow_(row) {
    var w = {};
    for (var i = 0; i < ALOKASI_HEADERS.length; i++) {
      w[ALOKASI_HEADERS[i]] = s_(row[ALOKASI_HEADERS[i]]);
    }
    return {
      record_id: s_(row.record_id),
      pml_email: s_(row.pml_email),
      jenis: s_(row.jenis),
      status: s_(row.status),
      wilayah: w,
      answers: parseJson_(row.answers, {}),
      anomalies: parseJson_(row.anomalies, []),
      created_at: s_(row.created_at),
      updated_at: s_(row.updated_at)
    };
  }

  function readRecords() {
    return readTable(TABS.RECORDS)
      .filter(function (r) { return s_(r.record_id) !== ''; })
      .map(recordFromRow_);
  }

  /**
   * Update baris ber-record_id sama, atau append kalau belum ada. Hanya baris
   * terdampak yang ditulis (bukan rewrite seluruh tab). Caller WAJIB memanggil
   * di bawah ScriptLock — keputusan update-vs-append tidak atomik sendiri.
   */
  function upsertRecord(rec) {
    var sh = mustSheet(TABS.RECORDS);
    var rowIndex = -1;
    var last = sh.getLastRow();
    if (last >= 2) {
      var ids = sh.getRange(2, 1, last - 1, 1).getDisplayValues();
      for (var i = 0; i < ids.length; i++) {
        if (ids[i][0] === rec.record_id) { rowIndex = i + 2; break; }
      }
    }
    if (rowIndex === -1) {
      rowIndex = last + 1;
      ensureCapacity_(sh, rowIndex);
    }
    sh.getRange(rowIndex, 1, 1, RECORD_HEADERS.length).setValues([recordToRow_(rec)]);
  }

  /** Kosongkan SEMUA baris data Records — utilitas testing (lihat resetRecords). */
  function clearRecords() {
    var sh = mustSheet(TABS.RECORDS);
    var last = sh.getLastRow();
    if (last > 1) sh.getRange(2, 1, last - 1, sh.getMaxColumns()).clearContent();
  }

  /**
   * Hapus SATU baris ber-record_id (baris benar-benar dibuang, bukan
   * dikosongkan, supaya tidak meninggalkan lubang). Caller WAJIB di bawah
   * ScriptLock dan sudah memverifikasi kepemilikan record.
   * @return true kalau barisnya ketemu & terhapus.
   */
  function deleteRecordRow(recordId) {
    var sh = mustSheet(TABS.RECORDS);
    var last = sh.getLastRow();
    if (last < 2) return false;
    var ids = sh.getRange(2, 1, last - 1, 1).getDisplayValues();
    for (var i = 0; i < ids.length; i++) {
      if (ids[i][0] === recordId) {
        sh.deleteRow(i + 2);
        return true;
      }
    }
    return false;
  }

  /**
   * Salin tab Records apa adanya ke tab "Records_backup_<timestamp>" di
   * spreadsheet yang sama — jaring pengaman sebelum operasi destruktif
   * (reset e2e, dsb). Tab backup TIDAK pernah dibaca aplikasi.
   */
  function backupRecords() {
    var src = mustSheet(TABS.RECORDS);
    var stamp = Utilities.formatDate(new Date(), 'Asia/Makassar', 'yyyyMMdd_HHmmss');
    var name = 'Records_backup_' + stamp;
    src.copyTo(ss()).setName(name);
    return { sheet: name, dataRows: Math.max(0, src.getLastRow() - 1) };
  }

  // ==== Questions ====

  function questionToRow_(q) {
    return [
      s_(q.question_id), s_(q.jenis),
      String(q.order == null ? '' : q.order),
      s_(q.label), s_(q.type),
      q.options && q.options.length ? JSON.stringify(q.options) : '',
      q.required === true ? 'TRUE' : 'FALSE',
      s_(q.help),
      q.active === true ? 'TRUE' : 'FALSE',
      s_(q.roster_group)
    ];
  }

  function questionFromRow_(row) {
    var opts = parseJson_(row.options, null);
    return {
      question_id: s_(row.question_id),
      jenis: s_(row.jenis),
      order: Number(row.order) || 0,
      label: s_(row.label),
      type: s_(row.type),
      options: Array.isArray(opts) ? opts : null,
      required: toBool_(row.required),
      help: s_(row.help),
      active: toBool_(row.active),
      roster_group: s_(row.roster_group)
    };
  }

  function readQuestions() {
    return readTable(TABS.QUESTIONS)
      .filter(function (r) { return s_(r.question_id) !== ''; })
      .map(questionFromRow_);
  }

  function writeQuestions(questions) {
    writeTable_(TABS.QUESTIONS, QUESTION_HEADERS, questions.map(questionToRow_));
  }

  // ==== Rules ====

  function ruleToRow_(r) {
    return [
      s_(r.rule_id), s_(r.jenis), s_(r.severity), s_(r.message),
      typeof r.when === 'string' ? r.when : JSON.stringify(r.when),
      r.active === true ? 'TRUE' : 'FALSE'
    ];
  }

  function ruleFromRow_(row) {
    return {
      rule_id: s_(row.rule_id),
      jenis: s_(row.jenis),
      severity: s_(row.severity),
      message: s_(row.message),
      // `when` dikembalikan sebagai OBJEK (Admin.html memakai r.when.field &
      // JSON.stringify(r.when)); kalau sel berisi JSON rusak (diedit manual),
      // string mentahnya diteruskan — evaluateRules mencatatnya per-rule tanpa
      // menggagalkan submit, dan validateWhen menolaknya saat diedit di config.
      when: parseJson_(row.when, s_(row.when)),
      active: toBool_(row.active)
    };
  }

  function readRules() {
    return readTable(TABS.RULES)
      .filter(function (r) { return s_(r.rule_id) !== ''; })
      .map(ruleFromRow_);
  }

  function writeRules(rules) {
    writeTable_(TABS.RULES, RULE_HEADERS, rules.map(ruleToRow_));
  }

  function seedQuestionsIfEmpty(questions) {
    return seedIfEmpty_(TABS.QUESTIONS, QUESTION_HEADERS, questions.map(questionToRow_));
  }
  function seedRulesIfEmpty(rules) {
    return seedIfEmpty_(TABS.RULES, RULE_HEADERS, rules.map(ruleToRow_));
  }

  // ==== status/diagnostik ====

  /** Ringkasan kondisi tab aplikasi & referensi + peringatan leading-zero — dipakai adminSheetStatus. */
  function tabStatus() {
    var expected = {};
    expected[TABS.PETUGAS] = PETUGAS_HEADERS;
    expected[TABS.ALOKASI] = ALOKASI_HEADERS;
    expected[TABS.RECORDS] = RECORD_HEADERS;
    expected[TABS.QUESTIONS] = QUESTION_HEADERS;
    expected[TABS.RULES] = RULE_HEADERS;
    expected[TABS.NTB] = NTB_HEADERS;
    expected[TABS.COMPUTED] = COMPUTED_HEADERS;

    var out = {};
    Object.keys(expected).forEach(function (name) {
      var sh = ss().getSheetByName(name);
      if (!sh) { out[name] = { exists: false, dataRows: 0 }; return; }
      var info = { exists: true, dataRows: Math.max(0, sh.getLastRow() - 1) };
      var lastCol = sh.getLastColumn();
      var actual = lastCol > 0 ? sh.getRange(1, 1, 1, lastCol).getDisplayValues()[0]
        .map(function (h) { return String(h).trim(); }) : [];
      var missing = expected[name].filter(function (h) { return actual.indexOf(h) === -1; });
      if (missing.length) info.missingHeaders = missing;
      out[name] = info;
    });

    // Sampel guard leading zero di Alokasi Wilayah: kode wilayah harus string
    // ber-panjang tetap. Kalau pernah diimpor sebagai ANGKA, nol di depan sudah
    // hilang permanen di datanya — hanya bisa dibetulkan dengan impor ulang.
    var al = out[TABS.ALOKASI];
    if (al && al.exists && al.dataRows > 0 && !al.missingHeaders) {
      var sample = readTable(TABS.ALOKASI)[0];
      var warns = [];
      if (sample) {
        if (s_(sample.idsubsls).length !== 16) warns.push('idsubsls sampel bukan 16 karakter: "' + sample.idsubsls + '"');
        if (s_(sample.kdkec).length !== 3) warns.push('kdkec sampel bukan 3 karakter: "' + sample.kdkec + '" — leading zero kemungkinan hilang saat impor');
        if (s_(sample.kdsls).length !== 4) warns.push('kdsls sampel bukan 4 karakter: "' + sample.kdsls + '"');
        if (s_(sample.kdsubsls).length !== 2) warns.push('kdsubsls sampel bukan 2 karakter: "' + sample.kdsubsls + '"');
      }
      if (warns.length) al.warnings = warns;
    }
    return out;
  }

  function info() {
    return { id: SPREADSHEET_ID, name: ss().getName() };
  }

  return {
    TABS: TABS,
    readPetugas: readPetugas,
    readAlokasi: readAlokasi,
    readNtbRasio: readNtbRasio,
    readComputedFieldFormulas: readComputedFieldFormulas,
    upsertComputedFieldFormula: upsertComputedFieldFormula,
    readRecords: readRecords,
    upsertRecord: upsertRecord,
    deleteRecordRow: deleteRecordRow,
    backupRecords: backupRecords,
    clearRecords: clearRecords,
    readQuestions: readQuestions,
    writeQuestions: writeQuestions,
    readRules: readRules,
    writeRules: writeRules,
    ensureTab: ensureTab,
    seedPetugasIfEmpty: seedPetugasIfEmpty,
    seedAlokasiIfEmpty: seedAlokasiIfEmpty,
    seedQuestionsIfEmpty: seedQuestionsIfEmpty,
    seedRulesIfEmpty: seedRulesIfEmpty,
    tabStatus: tabStatus,
    info: info,
    HEADERS: {
      PETUGAS: PETUGAS_HEADERS,
      ALOKASI: ALOKASI_HEADERS,
      RECORDS: RECORD_HEADERS,
      QUESTIONS: QUESTION_HEADERS,
      RULES: RULE_HEADERS,
      NTB: NTB_HEADERS,
      COMPUTED: COMPUTED_HEADERS
    }
  };
})();
