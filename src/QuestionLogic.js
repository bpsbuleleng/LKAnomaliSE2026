/**
 * QuestionLogic — logic murni seputar tab Questions (dipakai server).
 * Tanpa dependency GAS; di-unit-test di Node.
 */
var QuestionLogic = (function () {
  /**
   * Pilih pertanyaan untuk satu jenis kuesioner, terurut `order`.
   * Default hanya active=true (soft-delete: active=false hilang dari
   * kuesioner baru tapi barisnya tidak pernah dihapus).
   */
  function selectQuestions(all, jenis, includeInactive) {
    return all
      .filter(function (q) {
        return q.jenis === jenis && (includeInactive === true || q.active === true);
      })
      .slice()
      .sort(function (a, b) { return a.order - b.order; });
  }

  return { selectQuestions: selectQuestions };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = QuestionLogic;
}
