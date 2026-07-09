/**
 * DataAccess — SATU-SATUNYA boundary data aplikasi.
 * Fase 5: implementasi baca/tulis Google Sheets via SheetDb (SpreadsheetApp).
 * SIGNATURE DAN BENTUK RETURN SAMA PERSIS dengan fase mock — kode client
 * (google.script.run) tidak berubah sedikit pun.
 *
 * Konvensi return: objek plain JSON-serializable
 *   { ok: true, ... } | { ok: false, error: 'KODE_ERROR', ... }
 * Tanggal selalu string ISO (objek Date bermasalah lewat google.script.run;
 * kolom created_at/updated_at di sheet berformat TEXT jadi ISO utuh).
 */

var PML_PASSWORD = 'cobaapp';
// Dicek di SETIAP fungsi privileged (bukan cuma di layar login admin).
// JANGAN pernah me-log nilai ini.
var ADMIN_PASSWORD = 'admin5108';

// ==== AUTH ====

function login(email, password) {
  return AuthLogic.validateLogin(SheetDb.readPetugas(), email, password, PML_PASSWORD);
}

// ==== WILAYAH ====

function getWilayah(pmlEmail) {
  return { ok: true, rows: WilayahLogic.filterByPml(SheetDb.readAlokasi(), pmlEmail) };
}

// ==== KBLI (referensi statis, lihat KbliData.js) ====

function getKbliOptions() {
  return { ok: true, options: KbliData.LIST };
}

function getPPL(idsubsls) {
  var row = WilayahLogic.findByIdsubsls(SheetDb.readAlokasi(), idsubsls);
  if (!row) return { ok: false, error: 'NOT_FOUND' };
  return { ok: true, ppl: WilayahLogic.joinPetugasNames(row, SheetDb.readPetugas()) };
}

// ==== RECORDS ====

function listRecords(pmlEmail) {
  return { ok: true, records: RecordLogic.listRecordsFor(SheetDb.readRecords(), pmlEmail) };
}

function getRecord(pmlEmail, recordId) {
  return RecordLogic.getRecordFor(SheetDb.readRecords(), pmlEmail, recordId);
}

function pickRecord_(records, recordId) {
  for (var i = 0; i < records.length; i++) {
    if (records[i].record_id === recordId) return records[i];
  }
  return null;
}

function saveDraft(pmlEmail, record) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000); // serialisasi read-modify-write + keputusan append-vs-update
  try {
    var assigned = WilayahLogic.filterByPml(SheetDb.readAlokasi(), pmlEmail);
    var res = RecordLogic.applySaveDraft(
      SheetDb.readRecords(), pmlEmail, record, assigned,
      new Date().toISOString(), 'R-' + Utilities.getUuid()
    );
    if (!res.ok) return res;
    // Logic murni mengembalikan seluruh array; yang ditulis ke sheet HANYA
    // baris terdampak (upsert by record_id) — bukan rewrite seluruh tab.
    SheetDb.upsertRecord(pickRecord_(res.records, res.record_id));
    return { ok: true, record_id: res.record_id, updated_at: res.updated_at };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Hapus record MILIK SENDIRI (cek pml_email di server — bukan cuma tombol UI).
 * Records boleh hard-delete (data isian PML sendiri); guardrail soft-delete
 * hanya berlaku untuk Questions/Rules.
 */
function deleteRecord(pmlEmail, recordId) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var res = RecordLogic.applyDeleteRecord(SheetDb.readRecords(), pmlEmail, recordId);
    if (!res.ok) return res;
    SheetDb.deleteRecordRow(recordId);
    return { ok: true, record_id: recordId };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Submit = simpan jawaban terakhir + validasi required + computed fields +
 * jalankan rule AKTIF + status 'submitted'. Detail kontrak return di
 * SubmitLogic. Validasi gagal → { ok:true, submitted:false, missing } dan
 * jawaban TETAP tersimpan (draft). Submit ulang me-rerun rule tanpa syarat.
 */
// Tabel referensi untuk computed field lookup (batas_rasio_ntb) — dibaca
// hanya untuk jenis usaha; tab hilang/kosong → map kosong (rule NTB tidak
// berlaku, submit tetap jalan). Dipakai submitRecord DAN previewRule supaya
// perilaku preview identik dengan submit.
function computedRefs_(jenis) {
  if (jenis !== 'usaha') return {};
  return { ntbRasio: ComputedFields.buildNtbRasioMap(SheetDb.readNtbRasio()) };
}

function submitRecord(pmlEmail, record) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var jenis = record && record.jenis;
    var assigned = WilayahLogic.filterByPml(SheetDb.readAlokasi(), pmlEmail);
    var questions = QuestionLogic.selectQuestions(SheetDb.readQuestions(), jenis, false);
    var rules = RuleLogic.selectRules(SheetDb.readRules(), jenis, false);
    var res = SubmitLogic.applySubmit(
      SheetDb.readRecords(), pmlEmail, record, assigned, questions, rules,
      new Date().toISOString(), 'R-' + Utilities.getUuid(), computedRefs_(jenis)
    );
    if (!res.ok) return res;
    SheetDb.upsertRecord(pickRecord_(res.records, res.record_id));
    return {
      ok: true, submitted: res.submitted, record_id: res.record_id,
      updated_at: res.updated_at, missing: res.missing || [],
      anomalies: res.anomalies || []
    };
  } finally {
    lock.releaseLock();
  }
}

// ==== UTILITAS TESTING (password-gated; dipakai e2e supaya deterministik) ====
// PERHATIAN: sejak Fase 5 ini beroperasi ke tab SUNGGUHAN — resetRecords
// menghapus SEMUA baris Records, resetConfig mengembalikan Questions & Rules
// ke baseline MockData. Jangan dipanggil setelah data produksi masuk.

function resetRecords(adminPassword) {
  var deny = requireAdmin_(adminPassword);
  if (deny) return deny;
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    SheetDb.clearRecords();
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

function resetConfig(adminPassword) {
  var deny = requireAdmin_(adminPassword);
  if (deny) return deny;
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    SheetDb.writeQuestions(MockData.QUESTIONS);
    SheetDb.writeRules(MockData.RULES);
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

// ==== CONFIG: baca (unprivileged, read-only) ====

function getQuestions(jenis, includeInactive) {
  if (jenis !== 'usaha' && jenis !== 'keluarga') return { ok: false, error: 'INVALID_JENIS' };
  return { ok: true, questions: QuestionLogic.selectQuestions(SheetDb.readQuestions(), jenis, includeInactive === true) };
}

function getRules(jenis, includeInactive) {
  if (jenis !== 'usaha' && jenis !== 'keluarga') return { ok: false, error: 'INVALID_JENIS' };
  return { ok: true, rules: RuleLogic.selectRules(SheetDb.readRules(), jenis, includeInactive === true) };
}

// Sumber dropdown field Mode Sederhana rule: alias pertanyaan AKTIF + computed
// fields (type/options ikut supaya client bisa merender input value yang pas).
function getRuleFieldOptions(jenis) {
  if (jenis !== 'usaha' && jenis !== 'keluarga') return { ok: false, error: 'INVALID_JENIS' };
  var fields = QuestionLogic.selectQuestions(SheetDb.readQuestions(), jenis, false)
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

// Read-modify-write tab di bawah lock, logic murni di ConfigLogic.
function withQuestions_(adminPassword, mutate) {
  var deny = requireAdmin_(adminPassword);
  if (deny) return deny;
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var res = mutate(SheetDb.readQuestions());
    if (!res.ok) return res;
    SheetDb.writeQuestions(res.questions);
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
    var res = mutate(SheetDb.readRules());
    if (!res.ok) return res;
    SheetDb.writeRules(res.rules);
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
  var augmented = ComputedFields.augment(jenis, answers || {}, computedRefs_(jenis));
  try {
    return { ok: true, triggered: RuleEvaluator.evaluate(parsed, augmented), answers: augmented };
  } catch (e) {
    return { ok: false, error: 'INVALID_WHEN', detail: String((e && e.message) || e) };
  }
}
