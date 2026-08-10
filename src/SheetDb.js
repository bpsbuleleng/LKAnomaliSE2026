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
  // `sumber` (coretan|fasih) & `assignment_id` DITAMBAHKAN di akhir (impor
  // FASIH) — record lama tanpa 2 kolom itu tetap terbaca (sumber kosong =
  // coretan, lihat recordFromRow_); migrasi kolom via ensureRecordColumns.
  var RECORD_HEADERS = ['record_id', 'pml_email', 'jenis', 'status']
    .concat(ALOKASI_HEADERS)
    .concat(['answers', 'anomalies', 'created_at', 'updated_at', 'sumber', 'assignment_id']);
  var QUESTION_HEADERS = ['question_id', 'jenis', 'order', 'label', 'type', 'options', 'required', 'help', 'active', 'roster_group'];
  var RULE_HEADERS = ['rule_id', 'jenis', 'severity', 'message', 'when', 'active'];
  // Tab referensi buatan user (~2560 baris, kode KBLI 5 digit → rasio NTB
  // SE2016) — app hanya baca, dipakai computed field batas_rasio_ntb (U9).
  var NTB_HEADERS = ['KBLI 2025', 'Judul KBLI 2025', 'Kategori KBLI 2020', 'Rasio NTB SE 2016'];
  // Tab BARU (dibuat aplikasi sendiri, bukan diimpor user). Dua macam baris
  // hidup berdampingan: (a) override formula computed field bawaan yang boleh
  // diedit admin (label KOSONG; lihat ComputedFields EDITABLE_DEFAULTS —
  // SPARSE, baris dihapus saat reset ke default) dan (b) custom computed
  // field buatan admin lewat CRUD halaman config (label TERISI). Pemilahan
  // baris jadi override vs custom urusan DataAccess (ComputedFields.fieldMeta).
  var COMPUTED_HEADERS = ['field_id', 'jenis', 'formula', 'label'];

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
   * Baca SEMUA baris tab "Variabel Hitungan" milik SATU jenis, urut baris
   * sheet (urutan = urutan evaluasi custom field), jadi
   * [{field_id, formula, label}]. Tab belum ada / baris tanpa formula →
   * dilewati. Pemilahan override-vs-custom BUKAN di sini (lihat komentar
   * COMPUTED_HEADERS) — SheetDb tidak tahu-menahu daftar field bawaan.
   */
  function readComputedFieldDefs(jenis) {
    if (!ss().getSheetByName(TABS.COMPUTED)) return [];
    var out = [];
    readTable(TABS.COMPUTED).forEach(function (r) {
      if (s_(r.jenis) !== jenis) return;
      var id = s_(r.field_id);
      var formula = s_(r.formula);
      if (id && formula) out.push({ field_id: id, formula: formula, label: s_(r.label) });
    });
    return out;
  }

  /** Baris (jenis, fieldId) di tab COMPUTED → index baris sheet, -1 kalau tak ada. */
  function findComputedRow_(sh, jenis, fieldId) {
    var last = sh.getLastRow();
    if (last < 2) return -1;
    var ids = sh.getRange(2, 1, last - 1, 2).getDisplayValues();
    for (var i = 0; i < ids.length; i++) {
      if (ids[i][0] === fieldId && ids[i][1] === jenis) return i + 2;
    }
    return -1;
  }

  // Tab era pra-CRUD hanya punya 3 kolom — sisipkan header 'label' sekali
  // jalan (readTable memetakan per NAMA header, jadi posisi kolom aman).
  function ensureComputedLabelColumn_(sh) {
    var lastCol = Math.max(1, sh.getLastColumn());
    var headers = sh.getRange(1, 1, 1, lastCol).getDisplayValues()[0]
      .map(function (h) { return String(h).trim(); });
    if (headers.indexOf('label') !== -1) return;
    var col = lastCol + 1;
    sh.getRange(1, col, sh.getMaxRows(), 1).setNumberFormat('@');
    sh.getRange(1, col, 1, 1).setValues([['label']]).setFontWeight('bold');
  }

  /**
   * Simpan/timpa SATU baris definisi (override bawaan → label '', custom →
   * label terisi). Membuat tab kalau belum ada (dipanggil pertama kali admin
   * menyimpan dari halaman config — tab ini bukan bagian data awal).
   * Caller WAJIB di bawah ScriptLock.
   */
  function upsertComputedFieldDef(jenis, fieldId, formula, label) {
    if (!ss().getSheetByName(TABS.COMPUTED)) ensureTab(TABS.COMPUTED, COMPUTED_HEADERS);
    var sh = mustSheet(TABS.COMPUTED);
    ensureComputedLabelColumn_(sh);
    var rowIndex = findComputedRow_(sh, jenis, fieldId);
    if (rowIndex === -1) {
      rowIndex = sh.getLastRow() + 1;
      ensureCapacity_(sh, rowIndex);
    }
    sh.getRange(rowIndex, 1, 1, COMPUTED_HEADERS.length)
      .setValues([[fieldId, jenis, formula, s_(label)]]);
  }

  /**
   * Hapus SATU baris definisi (reset override ke default / hapus custom
   * field) — baris benar-benar dibuang supaya tab tak menumpuk baris kosong.
   * Caller WAJIB di bawah ScriptLock. @return true kalau barisnya ketemu.
   */
  function deleteComputedFieldDef(jenis, fieldId) {
    if (!ss().getSheetByName(TABS.COMPUTED)) return false;
    var sh = mustSheet(TABS.COMPUTED);
    var rowIndex = findComputedRow_(sh, jenis, fieldId);
    if (rowIndex === -1) return false;
    sh.deleteRow(rowIndex);
    return true;
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
    row.push(s_(rec.sumber) || 'coretan');
    row.push(s_(rec.assignment_id));
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
      updated_at: s_(row.updated_at),
      // Record lama (pra-impor FASIH) tak punya kolom ini → dianggap coretan.
      sumber: s_(row.sumber) || 'coretan',
      assignment_id: s_(row.assignment_id)
    };
  }

  /**
   * Migrasi in-place: pastikan tab Records punya SEMUA kolom RECORD_HEADERS.
   * Kolom yang belum ada (mis. `sumber`/`assignment_id` pada tab pra-impor
   * FASIH) ditambahkan di UJUNG kanan (diformat TEXT). readTable memetakan per
   * NAMA header, jadi posisi kolom baru aman selama urutan kolom lama = prefix
   * RECORD_HEADERS (selalu benar karena kita hanya menambah di akhir).
   * @return jumlah kolom yang ditambahkan.
   */
  function ensureRecordColumns() {
    var sh = ss().getSheetByName(TABS.RECORDS);
    if (!sh) return 0;
    var lastCol = Math.max(1, sh.getLastColumn());
    var headers = sh.getRange(1, 1, 1, lastCol).getDisplayValues()[0]
      .map(function (h) { return String(h).trim(); });
    var added = 0;
    RECORD_HEADERS.forEach(function (h) {
      if (headers.indexOf(h) !== -1) return;
      var col = lastCol + 1 + added;
      sh.getRange(1, col, sh.getMaxRows(), 1).setNumberFormat('@');
      sh.getRange(1, col, 1, 1).setValues([[h]]).setFontWeight('bold');
      added++;
    });
    return added;
  }

  function readRecords() {
    return readTable(TABS.RECORDS)
      .filter(function (r) { return s_(r.record_id) !== ''; })
      .map(recordFromRow_);
  }

  /**
   * Baca HANYA record milik satu PML. Tab bisa ~29rb baris (impor FASIH) — di
   * sini filter kolom pml_email dilakukan SEBELUM JSON.parse answers tiap baris,
   * jadi cuma baris milik PML itu yang di-parse (hemat waktu, jauh dari batas 6
   * menit). Baca sel tetap satu bulk getDisplayValues (tak terhindarkan), tapi
   * kerja berat (parse) hanya untuk baris relevan.
   */
  function readRecordsForPml(pmlEmail) {
    var sh = ss().getSheetByName(TABS.RECORDS);
    if (!sh) return [];
    var values = sh.getDataRange().getDisplayValues();
    if (values.length < 2) return [];
    var headers = values[0].map(function (h) { return String(h).trim(); });
    var idIdx = headers.indexOf('record_id');
    var emailIdx = headers.indexOf('pml_email');
    if (idIdx === -1 || emailIdx === -1) return [];
    var norm = String(pmlEmail == null ? '' : pmlEmail).trim().toLowerCase();
    var out = [];
    for (var i = 1; i < values.length; i++) {
      if (s_(values[i][idIdx]) === '') continue;
      if (String(values[i][emailIdx]).trim().toLowerCase() !== norm) continue;
      var row = {};
      for (var j = 0; j < headers.length; j++) { if (headers[j]) row[headers[j]] = values[i][j]; }
      out.push(recordFromRow_(row));
    }
    return out;
  }

  /** Baca SATU record ber-record_id (parse cuma 1 baris) — dipakai getRecord &
   *  jalur transaksi (saveDraft/submit/delete) supaya tidak parse seluruh tab.
   *  @return record | null. */
  function readRecordById(recordId) {
    var sh = ss().getSheetByName(TABS.RECORDS);
    if (!sh) return null;
    var last = sh.getLastRow();
    if (last < 2) return null;
    var ids = sh.getRange(2, 1, last - 1, 1).getDisplayValues();
    var rowIndex = -1;
    for (var i = 0; i < ids.length; i++) {
      if (ids[i][0] === recordId) { rowIndex = i + 2; break; }
    }
    if (rowIndex === -1) return null;
    var lastCol = sh.getLastColumn();
    var headers = sh.getRange(1, 1, 1, lastCol).getDisplayValues()[0].map(function (h) { return String(h).trim(); });
    var vals = sh.getRange(rowIndex, 1, 1, lastCol).getDisplayValues()[0];
    var row = {};
    for (var j = 0; j < headers.length; j++) { if (headers[j]) row[headers[j]] = vals[j]; }
    return recordFromRow_(row);
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

  /**
   * Bulk upsert impor FASIH: gabung record baru dengan isi tab yang ADA lalu
   * tulis ulang SELURUH data region dalam SATU setValues (hindari upsertRecord
   * per baris yang O(n²) untuk ~29rb baris). Cocok by record_id: baris lama
   * ber-id sama diganti versi baru; coretan & chunk FASIH sebelumnya (id beda)
   * dipertahankan. Baris lama disimpan sebagai display value MENTAH (tidak
   * di-parse ulang). Caller WAJIB ensureRecordColumns() dulu & di bawah lock.
   */
  function bulkUpsertRecords(recs) {
    var sh = mustSheet(TABS.RECORDS);
    var nCol = RECORD_HEADERS.length;
    var last = sh.getLastRow();
    var existing = last > 1 ? sh.getRange(2, 1, last - 1, nCol).getDisplayValues() : [];
    var newRows = recs.map(recordToRow_);
    var newIds = {};
    newRows.forEach(function (r) { newIds[r[0]] = true; });
    var kept = existing.filter(function (r) { return s_(r[0]) !== '' && !newIds[r[0]]; });
    var all = kept.concat(newRows);
    if (last > 1) sh.getRange(2, 1, last - 1, sh.getMaxColumns()).clearContent();
    if (all.length) {
      ensureCapacity_(sh, 1 + all.length);
      sh.getRange(2, 1, all.length, nCol).setValues(all);
    }
    return { written: all.length, replacedOrAdded: newRows.length, kept: kept.length };
  }

  /** Buat 4 tab staging FASIH (header + format TEXT) kalau belum ada; header
   *  diambil dari FasihImport.STAGING. @return {tab: created?}. */
  function ensureFasihStagingTabs() {
    var out = {};
    var st = FasihImport.STAGING;
    Object.keys(st).forEach(function (k) {
      out[st[k].tab] = ensureTab(st[k].tab, st[k].headers);
    });
    return out;
  }

  /** Baca 4 tab staging FASIH → {usaha, keluarga, rosterAk, rosterMeteran}
   *  (array objek ber-key header; tab belum ada → []). */
  function readFasihStaging() {
    var st = FasihImport.STAGING;
    var out = {};
    Object.keys(st).forEach(function (k) {
      out[k] = ss().getSheetByName(st[k].tab) ? readTable(st[k].tab) : [];
    });
    return out;
  }

  /**
   * Tambahkan baris ke SATU tab staging FASIH (append di bawah baris yang
   * sudah ada, TIDAK menimpa) — dipakai alur impor per-grup-kecamatan supaya
   * CSV dari tiap grup bisa ditumpuk tanpa perlu paste manual UI Sheets.
   * `rowsArrays` HARUS urut kolom persis header tab (FasihImport.STAGING[key].headers).
   * Tab dibuat dulu (format TEXT) kalau belum ada. @return jumlah baris ditulis.
   */
  function appendFasihStagingRows(stagingKey, rowsArrays) {
    var st = FasihImport.STAGING[stagingKey];
    if (!st) throw new Error('Staging key tidak dikenal: ' + stagingKey);
    ensureTab(st.tab, st.headers);
    if (!rowsArrays.length) return 0;
    var sh = mustSheet(st.tab);
    var startRow = sh.getLastRow() + 1;
    ensureCapacity_(sh, startRow - 1 + rowsArrays.length);
    sh.getRange(startRow, 1, rowsArrays.length, st.headers.length).setValues(rowsArrays);
    return rowsArrays.length;
  }

  /** Kosongkan SATU tab staging FASIH (hapus baris data, header tetap) —
   *  dipakai sebelum menumpuk grup kecamatan berikutnya. */
  function clearFasihStagingTab(stagingKey) {
    var st = FasihImport.STAGING[stagingKey];
    if (!st) throw new Error('Staging key tidak dikenal: ' + stagingKey);
    var sh = ss().getSheetByName(st.tab);
    if (!sh) return;
    var last = sh.getLastRow();
    if (last > 1) sh.getRange(2, 1, last - 1, sh.getMaxColumns()).clearContent();
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
    readComputedFieldDefs: readComputedFieldDefs,
    upsertComputedFieldDef: upsertComputedFieldDef,
    deleteComputedFieldDef: deleteComputedFieldDef,
    readRecords: readRecords,
    readRecordsForPml: readRecordsForPml,
    readRecordById: readRecordById,
    ensureRecordColumns: ensureRecordColumns,
    bulkUpsertRecords: bulkUpsertRecords,
    ensureFasihStagingTabs: ensureFasihStagingTabs,
    readFasihStaging: readFasihStaging,
    appendFasihStagingRows: appendFasihStagingRows,
    clearFasihStagingTab: clearFasihStagingTab,
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
