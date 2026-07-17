/**
 * VizData — transformasi murni payload dashboard visualisasi (halaman awal).
 * Tanpa dependency GAS; di-unit-test di Node. Dipakai DataAccess.getDashboardData.
 *
 * Payload sengaja RAMPING: hanya field yang dibutuhkan agregasi client
 * (VizLogic.html) — tanpa record_id/pml_email/timestamp, dan anomalies
 * diringkas jadi hitungan saja. answers dikirim utuh karena agregasi per
 * butir pertanyaan (termasuk roster) terjadi di client.
 */
var VizData = (function () {
  function s(v) { return String(v == null ? '' : v); }

  function forDashboard(records) {
    return records.map(function (r) {
      var w = r.wilayah || {};
      return {
        jenis: s(r.jenis),
        status: s(r.status),
        wilayah: {
          idsubsls: s(w.idsubsls),
          kdkec: s(w.kdkec), nmkec: s(w.nmkec),
          kddesa: s(w.kddesa), nmdesa: s(w.nmdesa),
          kdsls: s(w.kdsls), nmsls: s(w.nmsls),
          kdsubsls: s(w.kdsubsls),
          nmppl: s(w.nmppl), nmpml: s(w.nmpml),
          emailppl: s(w.emailppl), emailpml: s(w.emailpml)
        },
        answers: r.answers || {},
        anomali_count: (r.anomalies || []).length,
        // Identitas anomali (bukan cuma jumlah) — dipakai filter "per anomali"
        // di dashboard; bentuk minimal, sama dengan RecordLogic.summarize.
        anomalies: (r.anomalies || []).map(function (a) {
          return { rule_id: s(a.rule_id), severity: s(a.severity), message: s(a.message) };
        })
      };
    });
  }

  return { forDashboard: forDashboard };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = VizData;
}
