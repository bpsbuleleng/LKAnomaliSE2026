/**
 * AuthLogic — logic login MURNI, tanpa dependency ke layanan Apps Script.
 * File yang sama dipakai server GAS (global `AuthLogic`) dan unit test Node
 * (lewat guarded module.exports di bawah).
 */
var AuthLogic = (function () {
  function normalizeEmail(email) {
    return String(email == null ? '' : email).trim().toLowerCase();
  }

  // Role WAJIB ditentukan dari `Posisi Daftar` (kolom `Posisi` bisa kosong di data riil).
  function isPml(row) {
    return String(row['Posisi Daftar'] || '').toUpperCase().indexOf('PML') !== -1;
  }

  /**
   * @param {Array<Object>} petugasRows baris tab Petugas (objek ber-key nama kolom asli)
   * @param {string} email
   * @param {string} password
   * @param {string} expectedPassword konstanta password PML (disuntik caller, bukan hardcode di sini)
   * @returns {{ok:true, pml:{nama:string,email:string,sobatId:string}} | {ok:false, error:string}}
   */
  function validateLogin(petugasRows, email, password, expectedPassword) {
    var norm = normalizeEmail(email);
    if (!norm) return { ok: false, error: 'EMAIL_NOT_FOUND' };

    // Satu email bisa muncul >1 baris; yang dicari baris ber-role PML.
    var emailFound = false;
    var pmlRow = null;
    for (var i = 0; i < petugasRows.length; i++) {
      if (normalizeEmail(petugasRows[i]['Email']) !== norm) continue;
      emailFound = true;
      if (isPml(petugasRows[i])) { pmlRow = petugasRows[i]; break; }
    }
    if (!emailFound) return { ok: false, error: 'EMAIL_NOT_FOUND' };
    if (!pmlRow) return { ok: false, error: 'NOT_PML' };
    if (password !== expectedPassword) return { ok: false, error: 'WRONG_PASSWORD' };

    return {
      ok: true,
      pml: {
        nama: String(pmlRow['Nama Lengkap'] || ''),
        email: norm,
        sobatId: String(pmlRow['SOBAT ID'] || '')
      }
    };
  }

  return { normalizeEmail: normalizeEmail, isPml: isPml, validateLogin: validateLogin };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = AuthLogic;
}
