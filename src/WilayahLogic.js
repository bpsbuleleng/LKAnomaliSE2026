/**
 * WilayahLogic — logic murni seputar Alokasi Wilayah (dipakai server).
 * Tanpa dependency layanan GAS; di-unit-test langsung di Node.
 */
var WilayahLogic = (function () {
  function normEmail(email) {
    return String(email == null ? '' : email).trim().toLowerCase();
  }

  // Dasar pembatasan Sub-SLS per assignment — WAJIB dieksekusi di server,
  // bukan cuma di UI (google.script.run bisa dipanggil dari console siapa pun).
  function filterByPml(rows, pmlEmail) {
    var norm = normEmail(pmlEmail);
    if (!norm) return [];
    return rows.filter(function (r) { return normEmail(r.emailpml) === norm; });
  }

  function findByIdsubsls(rows, idsubsls) {
    var id = String(idsubsls == null ? '' : idsubsls).trim();
    if (!id) return null;
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i].idsubsls) === id) return rows[i];
    }
    return null;
  }

  // Nama kanonik diambil dari tab Petugas (join via email); fallback ke nama
  // yang tertera di baris alokasi kalau email kosong / tidak ketemu di Petugas.
  function joinPetugasNames(alokasiRow, petugasRows) {
    function nameByEmail(email) {
      var norm = normEmail(email);
      if (!norm) return null;
      for (var i = 0; i < petugasRows.length; i++) {
        if (normEmail(petugasRows[i]['Email']) === norm) {
          return String(petugasRows[i]['Nama Lengkap'] || '');
        }
      }
      return null;
    }
    return {
      nmppl: nameByEmail(alokasiRow.emailppl) || String(alokasiRow.nmppl || ''),
      emailppl: normEmail(alokasiRow.emailppl),
      nmpml: nameByEmail(alokasiRow.emailpml) || String(alokasiRow.nmpml || ''),
      emailpml: normEmail(alokasiRow.emailpml)
    };
  }

  return {
    filterByPml: filterByPml,
    findByIdsubsls: findByIdsubsls,
    joinPetugasNames: joinPetugasNames
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = WilayahLogic;
}
