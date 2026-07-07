/**
 * ValidationLogic — validasi ISIAN saat submit (BUKAN rule anomali).
 * Bedanya prinsipil: validasi isian MEMBLOKIR submit dan menunjuk field yang
 * kurang; rule anomali jalan SETELAH submit dan sifatnya laporan.
 * Logic murni: tanpa dependency GAS, di-unit-test di Node.
 */
var ValidationLogic = (function () {
  function isEmpty(v) {
    return v === undefined || v === null || v === ''; // 0 = terisi
  }

  /**
   * Cari semua isian wajib yang belum terisi.
   * @param questions pertanyaan AKTIF untuk jenis record ini (urut `order`)
   * @param answers   {field: value, roster: {grup: [{field: value}]}}
   * @param idsubsls  wilayah record — wajib terisi saat submit
   * @return array {question_id, label, roster_group, row_index} — kosong = lolos.
   *         Entri wilayah pakai question_id '__wilayah__' (bukan baris Questions).
   *         Field required di roster dicek per BARIS YANG ADA — roster kosong
   *         lolos (tidak ada aturan minimal baris di v1).
   */
  function findMissing(questions, answers, idsubsls) {
    answers = answers || {};
    var missing = [];

    if (isEmpty(idsubsls) || String(idsubsls).trim() === '') {
      missing.push({ question_id: '__wilayah__', label: 'Wilayah (Sub-SLS)', roster_group: '', row_index: null });
    }

    (questions || []).forEach(function (q) {
      if (q.required !== true) return;
      if (q.roster_group) {
        var rows = (answers.roster && answers.roster[q.roster_group]) || [];
        rows.forEach(function (row, i) {
          if (isEmpty(row[q.question_id])) {
            missing.push({ question_id: q.question_id, label: q.label, roster_group: q.roster_group, row_index: i });
          }
        });
      } else if (isEmpty(answers[q.question_id])) {
        missing.push({ question_id: q.question_id, label: q.label, roster_group: '', row_index: null });
      }
    });

    return missing;
  }

  return { findMissing: findMissing };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ValidationLogic;
}
