/**
 * SubmitLogic — transformasi murni alur submit (dipakai server, di-unit-test
 * di Node). Urutannya WAJIB begini:
 *   1. Simpan jawaban terakhir (reuse applySaveDraft — jawaban user TIDAK
 *      boleh hilang walau validasi gagal).
 *   2. Validasi isian: semua field required terisi? Gagal → record TETAP
 *      tersimpan sebagai draft, kembalikan daftar field kurang (blocking).
 *   3. Hitung computed fields → simpan sebagai field biasa di answers.
 *   4. Jalankan rule anomali (caller memfilter active=TRUE) → simpan hasil.
 *   5. status = 'submitted'. Submit ulang mengulang SEMUA langkah tanpa
 *      syarat — anomali lama selalu ditimpa hasil run terbaru.
 *
 * Kontrak return (dibaca client):
 *   { ok:false, error }                                  — gagal simpan (FORBIDDEN dll)
 *   { ok:true, submitted:false, missing:[...], ... }     — tersimpan, DITOLAK validasi
 *   { ok:true, submitted:true, anomalies:[...], ... }    — tersubmit + hasil rule
 */
var SubmitLogic = (function () {
  // GAS: semua file .gs share global scope; Node: require. Resolusi ditunda ke
  // saat panggil supaya urutan load file GAS tidak berpengaruh.
  function deps() {
    if (typeof module !== 'undefined' && module.exports) {
      return {
        RecordLogic: require('./RecordLogic.js'),
        ValidationLogic: require('./ValidationLogic.js'),
        ComputedFields: require('./ComputedFields.js'),
        RuleEvaluator: require('./RuleEvaluator.js')
      };
    }
    return {
      RecordLogic: RecordLogic,
      ValidationLogic: ValidationLogic,
      ComputedFields: ComputedFields,
      RuleEvaluator: RuleEvaluator
    };
  }

  /**
   * @param input     {record_id?, jenis, idsubsls?, answers} dari client —
   *                  bentuk sama dengan saveDraft (submit membawa jawaban
   *                  lokal terakhir, jadi record yang belum pernah sync pun
   *                  bisa langsung disubmit).
   * @param questions pertanyaan AKTIF jenis ini (untuk validasi required)
   * @param rules     rule AKTIF jenis ini (untuk evaluasi anomali)
   * @param refs      tabel referensi computed fields (opsional) — mis.
   *                  { ntbRasio } untuk batas_rasio_ntb; lihat ComputedFields.
   */
  function applySubmit(records, pmlEmail, input, assignedRows, questions, rules, nowIso, newId, refs) {
    var d = deps();
    var saved = d.RecordLogic.applySaveDraft(records, pmlEmail, input, assignedRows, nowIso, newId);
    if (!saved.ok) return saved;

    var idx = -1;
    for (var i = 0; i < saved.records.length; i++) {
      if (saved.records[i].record_id === saved.record_id) { idx = i; break; }
    }
    var rec = saved.records[idx];

    var missing = d.ValidationLogic.findMissing(questions, rec.answers, rec.wilayah.idsubsls);
    if (missing.length) {
      return {
        ok: true, submitted: false, missing: missing,
        records: saved.records, record_id: saved.record_id, updated_at: saved.updated_at
      };
    }

    var answers = d.ComputedFields.augment(rec.jenis, rec.answers, refs);
    var evalRes = d.RuleEvaluator.evaluateRules(rules, answers);

    var updated = {};
    Object.keys(rec).forEach(function (k) { updated[k] = rec[k]; });
    updated.answers = answers;
    updated.status = 'submitted';
    updated.anomalies = evalRes.anomalies;
    updated.updated_at = nowIso;

    var copy = saved.records.slice();
    copy[idx] = updated;
    return {
      ok: true, submitted: true, anomalies: evalRes.anomalies,
      // errors: rule malformed dilewati (tidak menggagalkan submit) — caller
      // boleh me-log; JANGAN dicampur ke anomalies.
      errors: evalRes.errors,
      records: copy, record_id: saved.record_id, updated_at: nowIso
    };
  }

  return { applySubmit: applySubmit };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = SubmitLogic;
}
