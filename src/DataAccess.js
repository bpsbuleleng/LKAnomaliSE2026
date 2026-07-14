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
// Pilah baris tab "Variabel Hitungan" milik satu jenis jadi dua kelompok:
// override formula field BAWAAN yang editable ({field_id → formula}) vs
// custom field buatan admin (array, urut baris tab = urutan evaluasi).
// Baris ber-id field bawaan NON-editable diabaikan (hanya mungkin muncul
// kalau tab diedit manual — jangan sampai menimpa logic roster/lookup kode).
function splitComputedDefs_(jenis) {
  var overrides = {}, custom = [];
  SheetDb.readComputedFieldDefs(jenis).forEach(function (d) {
    var meta = ComputedFields.fieldMeta(jenis, d.field_id);
    if (meta) {
      if (meta.editable) overrides[d.field_id] = d.formula;
      return;
    }
    custom.push(d);
  });
  return { overrides: overrides, custom: custom };
}

// Tabel referensi untuk computed field: lookup batas_rasio_ntb (usaha saja)
// + override formula field editable + custom field admin (kedua jenis) —
// tab hilang/kosong → default berlaku, submit tetap jalan. Dipakai
// submitRecord DAN previewRule supaya perilaku preview identik dengan submit.
function computedRefs_(jenis) {
  var split = splitComputedDefs_(jenis);
  var refs = {
    formulaOverrides: split.overrides,
    // label ikut dioper: dipakai SubmitLogic melabeli entri `fields` anomali
    // (ComputedFields.augment sendiri mengabaikannya).
    customFields: split.custom.map(function (d) { return { id: d.field_id, formula: d.formula, label: d.label }; })
  };
  if (jenis === 'usaha') refs.ntbRasio = ComputedFields.buildNtbRasioMap(SheetDb.readNtbRasio());
  return refs;
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

// ==== DASHBOARD VISUALISASI (halaman awal, unprivileged read-only) ====

/**
 * Data untuk dashboard visualisasi di halaman awal: SEMUA record (lintas PML,
 * draft & submitted — client yang memfilter) dalam bentuk ringkas (VizData)
 * + daftar pertanyaan aktif kedua jenis. Agregasi/chart/tabulasi sepenuhnya
 * client-side (VizLogic) supaya filter interaktif tanpa bolak-balik server.
 */
function getDashboardData() {
  var questions = SheetDb.readQuestions();
  return {
    ok: true,
    records: VizData.forDashboard(SheetDb.readRecords()),
    questions: {
      usaha: QuestionLogic.selectQuestions(questions, 'usaha', false),
      keluarga: QuestionLogic.selectQuestions(questions, 'keluarga', false)
    }
  };
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
  splitComputedDefs_(jenis).custom.forEach(function (d) {
    fields.push({ id: d.field_id, label: d.label, source: 'computed', type: 'number', options: null });
  });
  return { ok: true, fields: fields };
}

/**
 * Daftar SEMUA computed field jenis ini (bawaan editable, bawaan
 * tetap-di-kode, DAN custom buatan admin) untuk halaman admin "Variabel
 * Hitungan" — supaya admin tidak buta terhadap variabel hasil perhitungan
 * yang dipakai rule. Read-only, unprivileged (sama seperti
 * getQuestions/getRules) — password admin cuma dicek saat MENGUBAH
 * (updateComputedFieldFormula / create/update/deleteComputedField).
 */
function getComputedFields(jenis) {
  if (jenis !== 'usaha' && jenis !== 'keluarga') return { ok: false, error: 'INVALID_JENIS' };
  var split = splitComputedDefs_(jenis);
  var fields = ComputedFields.listFields(jenis).map(function (f) {
    var out = { id: f.id, label: f.label, editable: f.editable, custom: false };
    if (f.editable) {
      out.defaultFormula = f.defaultFormula;
      out.formula = split.overrides[f.id] || f.defaultFormula;
      out.overridden = !!split.overrides[f.id];
    } else {
      out.note = f.note;
    }
    return out;
  });
  split.custom.forEach(function (d) {
    fields.push({ id: d.field_id, label: d.label, editable: true, custom: true, formula: d.formula });
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
 * Ubah formula SATU computed field editable (lihat CLAUDE.md "Variabel
 * Hitungan"). formula='' (atau spasi kosong) = reset ke default (baris
 * override dihapus dari tab). Formula rusak ditolak DI SINI
 * (Formula.compileExpr) supaya admin dapat error langsung saat menyimpan —
 * ComputedFields.formulaStep tetap fallback aman kalau tab pernah diedit
 * manual di luar jalur ini.
 */
function updateComputedFieldFormula(adminPassword, jenis, fieldId, formula) {
  var deny = requireAdmin_(adminPassword);
  if (deny) return deny;
  if (jenis !== 'usaha' && jenis !== 'keluarga') return { ok: false, error: 'INVALID_JENIS' };
  var meta = ComputedFields.fieldMeta(jenis, fieldId);
  if (!meta || !meta.editable) return { ok: false, error: 'NOT_EDITABLE' };
  var text = String(formula == null ? '' : formula).trim();
  if (text) {
    try {
      Formula.compileExpr(text);
    } catch (e) {
      return { ok: false, error: 'INVALID_FORMULA', detail: String((e && e.message) || e) };
    }
  }
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    if (text) SheetDb.upsertComputedFieldDef(jenis, fieldId, text, '');
    else SheetDb.deleteComputedFieldDef(jenis, fieldId);
    return { ok: true, formula: text || meta.defaultFormula, overridden: !!text };
  } finally {
    lock.releaseLock();
  }
}

// ==== CUSTOM COMPUTED FIELD (CRUD "Variabel Hitungan") ====
// Custom field = variabel hitungan TAMBAHAN buatan admin: aritmetika flat
// lewat parser aman Formula.js (grammar sama dengan override formula bawaan),
// dievaluasi saat submit SETELAH pipeline bawaan (ComputedFields.augment),
// otomatis bisa dipakai kondisi rule (getRuleFieldOptions). Logic murni di
// ConfigLogic; di sini hanya gerbang admin + baca/tulis sheet di bawah lock.

// Alias yang tak boleh dipakai custom field: alias pertanyaan jenis itu
// (termasuk nonaktif — bisa diaktifkan lagi), computed bawaan, dan 'roster'
// (kunci struktural answers untuk kelompok roster).
function reservedComputedIds_(jenis) {
  var ids = ['roster'];
  SheetDb.readQuestions().forEach(function (q) {
    if (q.jenis === jenis) ids.push(q.question_id);
  });
  ComputedFields.listFields(jenis).forEach(function (f) { ids.push(f.id); });
  return ids;
}

function createComputedField(adminPassword, jenis, input) {
  var deny = requireAdmin_(adminPassword);
  if (deny) return deny;
  if (jenis !== 'usaha' && jenis !== 'keluarga') return { ok: false, error: 'INVALID_JENIS' };
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var res = ConfigLogic.applyCreateComputedField(
      splitComputedDefs_(jenis).custom, jenis, input, reservedComputedIds_(jenis));
    if (!res.ok) return res;
    SheetDb.upsertComputedFieldDef(jenis, res.def.field_id, res.def.formula, res.def.label);
    return { ok: true, field: res.def };
  } finally {
    lock.releaseLock();
  }
}

function updateComputedField(adminPassword, jenis, fieldId, patch) {
  var deny = requireAdmin_(adminPassword);
  if (deny) return deny;
  if (jenis !== 'usaha' && jenis !== 'keluarga') return { ok: false, error: 'INVALID_JENIS' };
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var res = ConfigLogic.applyUpdateComputedField(splitComputedDefs_(jenis).custom, fieldId, patch);
    if (!res.ok) return res;
    SheetDb.upsertComputedFieldDef(jenis, res.def.field_id, res.def.formula, res.def.label);
    return { ok: true, field: res.def };
  } finally {
    lock.releaseLock();
  }
}

// Hanya custom field yang bisa dihapus (bawaan cuma bisa reset formula) —
// applyDeleteComputedField menolak id yang tak ada di defs custom.
function deleteComputedField(adminPassword, jenis, fieldId) {
  var deny = requireAdmin_(adminPassword);
  if (deny) return deny;
  if (jenis !== 'usaha' && jenis !== 'keluarga') return { ok: false, error: 'INVALID_JENIS' };
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var res = ConfigLogic.applyDeleteComputedField(splitComputedDefs_(jenis).custom, fieldId);
    if (!res.ok) return res;
    SheetDb.deleteComputedFieldDef(jenis, fieldId);
    return { ok: true, field_id: fieldId };
  } finally {
    lock.releaseLock();
  }
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
