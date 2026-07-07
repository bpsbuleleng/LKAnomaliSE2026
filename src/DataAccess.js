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

// ==== MOCK STORE (Script Properties, JSON, chunked) ====
// Global GAS TIDAK bertahan antar panggilan google.script.run, jadi data yang
// bisa berubah (Records, dan sejak Fase 4: Questions & Rules hasil CRUD
// admin) hidup di Script Properties. Chunked karena satu property dibatasi
// ±9KB sedangkan JSON Questions > 9KB.

var RECORDS_STORE_KEY = 'MOCK_RECORDS';
var QUESTIONS_STORE_KEY = 'MOCK_QUESTIONS';
var RULES_STORE_KEY = 'MOCK_RULES';
var CHUNK_SIZE = 8000;

function writeStore_(key, value) {
  var props = PropertiesService.getScriptProperties();
  var json = JSON.stringify(value);
  var n = Math.ceil(json.length / CHUNK_SIZE) || 1;
  var oldN = Number(props.getProperty(key + '_N') || 0);
  for (var i = n; i < oldN; i++) props.deleteProperty(key + '_' + i); // sisa chunk lama
  for (var j = 0; j < n; j++) props.setProperty(key + '_' + j, json.substr(j * CHUNK_SIZE, CHUNK_SIZE));
  props.setProperty(key + '_N', String(n));
}

function readStore_(key) {
  var props = PropertiesService.getScriptProperties();
  var n = Number(props.getProperty(key + '_N') || 0);
  if (!n) return null;
  var parts = [];
  for (var i = 0; i < n; i++) parts.push(props.getProperty(key + '_' + i) || '');
  return JSON.parse(parts.join(''));
}

function clearStore_(key) {
  var props = PropertiesService.getScriptProperties();
  var n = Number(props.getProperty(key + '_N') || 0);
  for (var i = 0; i < n; i++) props.deleteProperty(key + '_' + i);
  props.deleteProperty(key + '_N');
}

function readRecords_() {
  return readStore_(RECORDS_STORE_KEY) || [];
}

function writeRecords_(records) {
  writeStore_(RECORDS_STORE_KEY, records);
}

// Questions & Rules: seed dari MockData saat store kosong. Fase 5: body
// helper ini diganti baca/tulis SpreadsheetApp, bentuk data tidak berubah.
function readQuestions_() {
  var v = readStore_(QUESTIONS_STORE_KEY);
  if (!v) { v = MockData.QUESTIONS; writeStore_(QUESTIONS_STORE_KEY, v); }
  return v;
}

function writeQuestions_(questions) {
  writeStore_(QUESTIONS_STORE_KEY, questions);
}

function readRules_() {
  var v = readStore_(RULES_STORE_KEY);
  if (!v) { v = MockData.RULES; writeStore_(RULES_STORE_KEY, v); }
  return v;
}

function writeRules_(rules) {
  writeStore_(RULES_STORE_KEY, rules);
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
  var deny = requireAdmin_(adminPassword);
  if (deny) return deny;
  writeRecords_([]);
  return { ok: true };
}

// Idem: kembalikan Questions & Rules ke baseline MockData (seed ulang saat
// dibaca berikutnya). Dibuang di Fase 5.
function resetMockConfig(adminPassword) {
  var deny = requireAdmin_(adminPassword);
  if (deny) return deny;
  clearStore_(QUESTIONS_STORE_KEY);
  clearStore_(RULES_STORE_KEY);
  return { ok: true };
}

/**
 * Submit = simpan jawaban terakhir + validasi required + computed fields +
 * jalankan rule AKTIF + status 'submitted'. Detail kontrak return di
 * SubmitLogic. Validasi gagal → { ok:true, submitted:false, missing } dan
 * jawaban TETAP tersimpan (draft). Submit ulang me-rerun rule tanpa syarat.
 */
function submitRecord(pmlEmail, record) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var jenis = record && record.jenis;
    var assigned = WilayahLogic.filterByPml(MockData.ALOKASI_WILAYAH, pmlEmail);
    var questions = QuestionLogic.selectQuestions(readQuestions_(), jenis, false);
    var rules = RuleLogic.selectRules(readRules_(), jenis, false);
    var res = SubmitLogic.applySubmit(
      readRecords_(), pmlEmail, record, assigned, questions, rules,
      new Date().toISOString(), 'R-' + Utilities.getUuid()
    );
    if (!res.ok) return res;
    writeRecords_(res.records);
    return {
      ok: true, submitted: res.submitted, record_id: res.record_id,
      updated_at: res.updated_at, missing: res.missing || [],
      anomalies: res.anomalies || []
    };
  } finally {
    lock.releaseLock();
  }
}

// ==== CONFIG: baca (unprivileged, read-only) ====

function getQuestions(jenis, includeInactive) {
  if (jenis !== 'usaha' && jenis !== 'keluarga') return { ok: false, error: 'INVALID_JENIS' };
  return { ok: true, questions: QuestionLogic.selectQuestions(readQuestions_(), jenis, includeInactive === true) };
}

// `when` di mock disimpan sebagai OBJEK; di Fase 5 kolom sheet berisi string
// JSON — evaluator menerima dua-duanya, jadi implementasi Sheets boleh
// meneruskan string apa adanya.
function getRules(jenis, includeInactive) {
  if (jenis !== 'usaha' && jenis !== 'keluarga') return { ok: false, error: 'INVALID_JENIS' };
  return { ok: true, rules: RuleLogic.selectRules(readRules_(), jenis, includeInactive === true) };
}

// Sumber dropdown field Mode Sederhana rule: alias pertanyaan AKTIF + computed
// fields (type/options ikut supaya client bisa merender input value yang pas).
function getRuleFieldOptions(jenis) {
  if (jenis !== 'usaha' && jenis !== 'keluarga') return { ok: false, error: 'INVALID_JENIS' };
  var fields = QuestionLogic.selectQuestions(readQuestions_(), jenis, false)
    .filter(function (q) { return !q.roster_group; }) // field roster hanya via Mode Lanjutan (roster_*)
    .map(function (q) {
      return { id: q.question_id, label: q.label, source: 'question', type: q.type, options: q.options };
    });
  ComputedFields.listFields(jenis).forEach(function (f) {
    fields.push({ id: f.id, label: f.label, source: 'computed', type: 'number', options: null });
  });
  return { ok: true, fields: fields };
}

// ==== CONFIG: privileged ====
// requireAdmin_ WAJIB jadi baris pertama SETIAP fungsi privileged — tombol UI
// yang disembunyikan bukan proteksi; google.script.run bisa dipanggil siapa
// pun dari console. JANGAN pernah me-log adminPassword.

function requireAdmin_(adminPassword) {
  if (adminPassword !== ADMIN_PASSWORD) return { ok: false, error: 'FORBIDDEN' };
  return null;
}

// Gerbang layar login halaman admin (UX saja — keamanan tetap per-panggilan).
function checkAdminPassword(adminPassword) {
  return requireAdmin_(adminPassword) || { ok: true };
}

// Read-modify-write store di bawah lock, logic murni di ConfigLogic.
function withQuestions_(adminPassword, mutate) {
  var deny = requireAdmin_(adminPassword);
  if (deny) return deny;
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var res = mutate(readQuestions_());
    if (!res.ok) return res;
    writeQuestions_(res.questions);
    return { ok: true, question: res.question };
  } finally {
    lock.releaseLock();
  }
}

function withRules_(adminPassword, mutate) {
  var deny = requireAdmin_(adminPassword);
  if (deny) return deny;
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var res = mutate(readRules_());
    if (!res.ok) return res;
    writeRules_(res.rules);
    return { ok: true, rule: res.rule };
  } finally {
    lock.releaseLock();
  }
}

function createQuestion(adminPassword, jenis, question) {
  return withQuestions_(adminPassword, function (all) {
    return ConfigLogic.applyCreateQuestion(all, jenis, question);
  });
}

function updateQuestion(adminPassword, jenis, questionId, patch) {
  return withQuestions_(adminPassword, function (all) {
    return ConfigLogic.applyUpdateQuestion(all, jenis, questionId, patch);
  });
}

function setQuestionActive(adminPassword, jenis, questionId, active) {
  return withQuestions_(adminPassword, function (all) {
    return ConfigLogic.applySetQuestionActive(all, jenis, questionId, active);
  });
}

function reorderQuestions(adminPassword, jenis, orderedQuestionIds) {
  return withQuestions_(adminPassword, function (all) {
    return ConfigLogic.applyReorderQuestions(all, jenis, orderedQuestionIds);
  });
}

function createRule(adminPassword, jenis, rule) {
  return withRules_(adminPassword, function (all) {
    return ConfigLogic.applyCreateRule(all, jenis, rule);
  });
}

function updateRule(adminPassword, ruleId, patch) {
  return withRules_(adminPassword, function (all) {
    return ConfigLogic.applyUpdateRule(all, ruleId, patch);
  });
}

function setRuleActive(adminPassword, ruleId, active) {
  return withRules_(adminPassword, function (all) {
    return ConfigLogic.applySetRuleActive(all, ruleId, active);
  });
}

/**
 * Preview/Test rule: EVALUATOR YANG SAMA dengan submit (RuleEvaluator) +
 * computed fields dulu (ComputedFields.augment) — perilaku preview identik
 * dengan submit sungguhan. Tidak menulis apa pun.
 */
function previewRule(adminPassword, jenis, when, answers) {
  var deny = requireAdmin_(adminPassword);
  if (deny) return deny;
  if (jenis !== 'usaha' && jenis !== 'keluarga') return { ok: false, error: 'INVALID_JENIS' };
  var v = RuleEvaluator.validateWhen(when);
  if (!v.ok) return { ok: false, error: 'INVALID_WHEN', detail: v.error };
  var parsed = typeof when === 'string' ? JSON.parse(when) : when;
  var augmented = ComputedFields.augment(jenis, answers || {});
  try {
    return { ok: true, triggered: RuleEvaluator.evaluate(parsed, augmented), answers: augmented };
  } catch (e) {
    return { ok: false, error: 'INVALID_WHEN', detail: String((e && e.message) || e) };
  }
}
