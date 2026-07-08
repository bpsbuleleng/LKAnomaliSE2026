/**
 * Setup — utilitas admin Fase 5 untuk menyiapkan & memeriksa spreadsheet.
 * TIDAK punya UI dan tidak ditautkan dari navigasi mana pun; dipanggil via
 * google.script.run (mis. dari console/Playwright). Semua fungsi privileged:
 * adminPassword dicek di SETIAP panggilan (lihat requireAdmin_ di DataAccess).
 */

/**
 * Jalankan SEKALI oleh pemilik (dari editor Apps Script: Run ▶, ATAU cukup
 * buka URL /dev di browser yang login sebagai pemilik) setiap kali scope OAuth
 * script bertambah — mis. Fase 5 menambah scope Spreadsheet. Tanpa consent
 * ini, /exec menolak SEMUA pengunjung (403). Read-only, tidak menulis apa pun.
 */
function authorize() {
  return 'Akses OK ke spreadsheet: ' + SheetDb.info().name;
}

/**
 * Ringkasan kondisi spreadsheet: tab ada/tidak, jumlah baris data, header
 * yang kurang, dan peringatan leading-zero di Alokasi Wilayah. Read-only.
 */
function adminSheetStatus(adminPassword) {
  var deny = requireAdmin_(adminPassword);
  if (deny) return deny;
  try {
    return { ok: true, spreadsheet: SheetDb.info(), tabs: SheetDb.tabStatus() };
  } catch (e) {
    return { ok: false, error: 'SHEET_ERROR', detail: String((e && e.message) || e) };
  }
}

/**
 * Ringkasan kesehatan relasi Petugas ↔ Alokasi Wilayah: jumlah PML, PML yang
 * belum punya alokasi, dan email PML di alokasi yang tak dikenal di Petugas.
 * Read-only — dipakai verifikasi kelengkapan data & memilih akun uji.
 */
function adminPmlSummary(adminPassword) {
  var deny = requireAdmin_(adminPassword);
  if (deny) return deny;
  try {
    var petugas = SheetDb.readPetugas();
    var alokasi = SheetDb.readAlokasi();
    var norm = function (e) { return String(e == null ? '' : e).trim().toLowerCase(); };
    var assigned = {};
    alokasi.forEach(function (r) {
      var e = norm(r.emailpml);
      if (e) assigned[e] = (assigned[e] || 0) + 1;
    });
    var pml = petugas.filter(function (p) { return AuthLogic.isPml(p); });
    var tanpa = pml
      .filter(function (p) { return !assigned[norm(p['Email'])]; })
      .map(function (p) { return { nama: p['Nama Lengkap'], email: norm(p['Email']) }; });
    var dikenal = {};
    petugas.forEach(function (p) { if (norm(p['Email'])) dikenal[norm(p['Email'])] = true; });
    var asing = Object.keys(assigned).filter(function (e) { return !dikenal[e]; });
    return {
      ok: true,
      totalPetugas: petugas.length,
      totalPml: pml.length,
      jumlahPmlTanpaAlokasi: tanpa.length,
      pmlTanpaAlokasi: tanpa.slice(0, 30),
      emailPmlAlokasiTakDikenal: asing.slice(0, 10)
    };
  } catch (e) {
    return { ok: false, error: 'SHEET_ERROR', detail: String((e && e.message) || e) };
  }
}

/**
 * Siapkan 5 tab aplikasi: buat yang belum ada (header + format TEXT), lalu
 * seed baseline MockData HANYA ke tab yang masih kosong — tab yang sudah
 * berisi data (mis. Petugas riil ~697 baris) TIDAK disentuh sama sekali.
 * Idempoten: aman dipanggil berulang.
 */
function adminSetupSheets(adminPassword) {
  var deny = requireAdmin_(adminPassword);
  if (deny) return deny;
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var H = SheetDb.HEADERS;
    var T = SheetDb.TABS;
    var result = {};

    result[T.PETUGAS] = {
      created: SheetDb.ensureTab(T.PETUGAS, H.PETUGAS),
      seeded: SheetDb.seedPetugasIfEmpty(MockData.PETUGAS)
    };
    result[T.ALOKASI] = {
      created: SheetDb.ensureTab(T.ALOKASI, H.ALOKASI),
      seeded: SheetDb.seedAlokasiIfEmpty(MockData.ALOKASI_WILAYAH)
    };
    result[T.RECORDS] = {
      created: SheetDb.ensureTab(T.RECORDS, H.RECORDS),
      seeded: 0 // Records selalu mulai kosong — diisi aplikasi
    };
    result[T.QUESTIONS] = {
      created: SheetDb.ensureTab(T.QUESTIONS, H.QUESTIONS),
      seeded: SheetDb.seedQuestionsIfEmpty(MockData.QUESTIONS)
    };
    result[T.RULES] = {
      created: SheetDb.ensureTab(T.RULES, H.RULES),
      seeded: SheetDb.seedRulesIfEmpty(MockData.RULES)
    };

    var status = SheetDb.tabStatus();
    Object.keys(result).forEach(function (name) {
      result[name].dataRows = status[name].dataRows;
      if (status[name].missingHeaders) result[name].missingHeaders = status[name].missingHeaders;
      if (status[name].warnings) result[name].warnings = status[name].warnings;
    });
    return { ok: true, spreadsheet: SheetDb.info(), tabs: result };
  } catch (e) {
    return { ok: false, error: 'SHEET_ERROR', detail: String((e && e.message) || e) };
  } finally {
    lock.releaseLock();
  }
}
