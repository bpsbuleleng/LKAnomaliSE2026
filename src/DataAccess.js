/**
 * DataAccess — SATU-SATUNYA boundary data aplikasi.
 * Fase sekarang: baca/tulis MockData in-memory. Fase 5: body fungsi diganti
 * SpreadsheetApp — SIGNATURE DAN BENTUK RETURN TIDAK BOLEH BERUBAH.
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

// ==== STUB — signature final, implementasi menyusul per fase ====

function notImplemented_() {
  return { ok: false, error: 'NOT_IMPLEMENTED' };
}

// == WILAYAH ==
function getWilayah(pmlEmail) { return notImplemented_(); }
function getPPL(idsubsls) { return notImplemented_(); }

// == RECORDS ==
function listRecords(pmlEmail) { return notImplemented_(); }
function getRecord(pmlEmail, recordId) { return notImplemented_(); }
function saveDraft(pmlEmail, record) { return notImplemented_(); }
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
