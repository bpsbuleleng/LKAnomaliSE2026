/**
 * RuleLogic — logic murni seputar tab Rules (dipakai server).
 * Tanpa dependency GAS; di-unit-test di Node.
 */
var RuleLogic = (function () {
  /**
   * Pilih rule untuk satu jenis kuesioner. Default hanya active=true —
   * submit HANYA menjalankan rule aktif (soft-delete lewat `active`,
   * baris tidak pernah dihapus).
   */
  function selectRules(all, jenis, includeInactive) {
    return all.filter(function (r) {
      return r.jenis === jenis && (includeInactive === true || r.active === true);
    });
  }

  return { selectRules: selectRules };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = RuleLogic;
}
