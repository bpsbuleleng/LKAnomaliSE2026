/**
 * DataAccess — SATU-SATUNYA boundary data aplikasi.
 * Fase sekarang: mock (MockData in-memory untuk data referensi; PropertiesService
 * untuk Records karena global GAS TIDAK bertahan antar panggilan google.script.run).
 * Fase 5: body fungsi diganti SpreadsheetApp — SIGNATURE DAN BENTUK RETURN
 * TIDAK BOLEH BERUBAH.
 *
 * Konvensi return: objek plain JSON-serializable
 *   { ok: true, ... } | { ok: false, error: 'KODE_ERROR', ... }
 * Tanggal selalu string ISO (objek Date bermasalah lewat google.script.run).
 */

var PML_PASSWORD = 'cobaapp';
// Dicek di SETIAP fungsi privileged (bukan cuma di layar login admin).
// JANGAN pernah me-log nilai ini.
var ADMIN_PASSWORD = 'admin5108';

// ==== AUTH ====

function login(email, password) {
  return AuthLogic.validateLogin(MockData.PETUGAS, email, password, PML_PASSWORD);
}

// ==== WILAYAH ====

function getWilayah(pmlEmail) {
  return { ok: true, rows: WilayahLogic.filterByPml(MockData.ALOKASI_WILAYAH, pmlEmail) };
}

function getPPL(idsubsls) {
  var row = WilayahLogic.findByIdsubsls(MockData.ALOKASI_WILAYAH, idsubsls);
  if (!row) return { ok: false, error: 'NOT_FOUND' };
  return { ok: true, ppl: WilayahLogic.joinPetugasNames(row, MockData.PETUGAS) };
}

// ==== RECORDS (mock store: Script Properties, JSON) ====

var RECORDS_STORE_KEY = 'MOCK_RECORDS';

function readRecords_() {
  var raw = PropertiesService.getScriptProperties().getProperty(RECORDS_STORE_KEY);
  return raw ? JSON.parse(raw) : [];
}

function writeRecords_(records) {
  PropertiesService.getScriptProperties().setProperty(RECORDS_STORE_KEY, JSON.stringify(records));
}

function listRecords(pmlEmail) {
  return { ok: true, records: RecordLogic.listRecordsFor(readRecords_(), pmlEmail) };
}

function getRecord(pmlEmail, recordId) {
  return RecordLogic.getRecordFor(readRecords_(), pmlEmail, recordId);
}

function saveDraft(pmlEmail, record) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000); // serialisasi read-modify-write store + pembuatan record_id
  try {
    var assigned = WilayahLogic.filterByPml(MockData.ALOKASI_WILAYAH, pmlEmail);
    var res = RecordLogic.applySaveDraft(
      readRecords_(), pmlEmail, record, assigned,
      new Date().toISOString(), 'R-' + Utilities.getUuid()
    );
    if (!res.ok) return res;
    writeRecords_(res.records);
    return { ok: true, record_id: res.record_id, updated_at: res.updated_at };
  } finally {
    lock.releaseLock();
  }
}

// Helper dev KHUSUS mock (bukan bagian boundary final — dibuang di Fase 5).
// Dipakai e2e supaya store deterministik antar run.
function resetMockRecords(adminPassword) {
  if (adminPassword !== ADMIN_PASSWORD) return { ok: false, error: 'FORBIDDEN' };
  writeRecords_([]);
  return { ok: true };
}

// ==== STUB — signature final, implementasi menyusul per fase ====

function notImplemented_() {
  return { ok: false, error: 'NOT_IMPLEMENTED' };
}

function submitRecord(pmlEmail, record) { return notImplemented_(); }

// == CONFIG: baca ==
function getQuestions(jenis, includeInactive) { return notImplemented_(); }
function getRules(jenis, includeInactive) { return notImplemented_(); }

// == CONFIG: privileged — WAJIB cek adminPassword === ADMIN_PASSWORD di tiap panggilan ==
function createQuestion(adminPassword, question) { return notImplemented_(); }
function updateQuestion(adminPassword, questionId, patch) { return notImplemented_(); }
function setQuestionActive(adminPassword, questionId, active) { return notImplemented_(); }
function reorderQuestions(adminPassword, jenis, orderedQuestionIds) { return notImplemented_(); }
function createRule(adminPassword, rule) { return notImplemented_(); }
function updateRule(adminPassword, ruleId, patch) { return notImplemented_(); }
function setRuleActive(adminPassword, ruleId, active) { return notImplemented_(); }
