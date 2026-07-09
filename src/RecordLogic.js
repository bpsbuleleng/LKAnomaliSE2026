/**
 * RecordLogic — transformasi murni atas array Records (dipakai server).
 * Tanpa dependency GAS; di-unit-test di Node. Tidak memutasi input —
 * fungsi yang mengubah data mengembalikan array records BARU.
 */
var RecordLogic = (function () {
  function normEmail(email) {
    return String(email == null ? '' : email).trim().toLowerCase();
  }
  function s(v) { return String(v == null ? '' : v); }

  // Akun "organik" (lihat AuthLogic.ORGANIK_EMAIL / WilayahLogic.ORGANIK_EMAIL)
  // TIDAK terikat wilayah DAN bisa melihat record/assignment SEMUA PML —
  // dipakai BPS pusat/kabupaten sebagai akses pengawas. Hanya visibilitas:
  // applySaveDraft/applyDeleteRecord di bawah TETAP mengecek kepemilikan apa
  // adanya, jadi organik bisa MELIHAT tapi tidak bisa mengedit/hapus record
  // PML lain.
  var ORGANIK_EMAIL = 'organik@bps.go.id';

  // Snapshot wilayah disalin dari baris alokasi saat simpan (bukan live-join),
  // supaya riwayat record tidak berubah kalau Alokasi Wilayah diperbarui.
  function buildWilayahSnapshot(row) {
    if (!row) {
      return {
        idsubsls: '', kdprov: '', kdkab: '', kdkec: '', kddesa: '', kdsls: '', kdsubsls: '',
        nmprov: '', nmkab: '', nmkec: '', nmdesa: '', nmsls: '',
        nmppl: '', nmpml: '', emailppl: '', emailpml: ''
      };
    }
    return {
      idsubsls: s(row.idsubsls),
      kdprov: s(row.kdprov), kdkab: s(row.kdkab), kdkec: s(row.kdkec),
      kddesa: s(row.kddesa), kdsls: s(row.kdsls), kdsubsls: s(row.kdsubsls),
      nmprov: s(row.nmprov), nmkab: s(row.nmkab), nmkec: s(row.nmkec),
      nmdesa: s(row.nmdesa), nmsls: s(row.nmsls),
      nmppl: s(row.nmppl), nmpml: s(row.nmpml),
      emailppl: normEmail(row.emailppl), emailpml: normEmail(row.emailpml)
    };
  }

  /**
   * Judul tampilan record di dashboard: keluarga = nama 2 anggota pertama
   * roster ("NAMA1 / NAMA2"), usaha = nama usaha. Kosong kalau belum diisi —
   * client menampilkan fallback wilayah.
   */
  function judulRecord(jenis, answers) {
    answers = answers || {};
    if (jenis === 'keluarga') {
      var rows = (answers.roster && answers.roster.anggota_keluarga) || [];
      var names = [];
      for (var i = 0; i < rows.length && names.length < 2; i++) {
        var n = s(rows[i] && rows[i].b1r6_n).trim();
        if (n) names.push(n);
      }
      return names.join(' / ');
    }
    return s(answers.nama_usaha).trim();
  }

  function summarize(rec) {
    var w = rec.wilayah || {};
    return {
      record_id: rec.record_id, jenis: rec.jenis, status: rec.status,
      judul: judulRecord(rec.jenis, rec.answers),
      idsubsls: s(w.idsubsls), nmkec: s(w.nmkec), nmdesa: s(w.nmdesa),
      nmsls: s(w.nmsls), kdsubsls: s(w.kdsubsls), nmppl: s(w.nmppl),
      // Identitas pembuat record — dipakai dashboard organik untuk menandai
      // record "milik siapa" (lihat listRecordsFor). pml_email otoritatif;
      // nmpml cuma label tampilan (nama PML yang di-assign ke Sub-SLS ini di
      // Alokasi Wilayah, BISA beda dari pml_email kalau organik sendiri yang
      // membuat record di wilayah orang lain).
      pml_email: normEmail(rec.pml_email), nmpml: s(w.nmpml),
      // Dipakai filter dashboard (jenis anomali / "tidak ada anomali") —
      // bentuk minimal, message dipakai sebagai label filter.
      anomalies: (rec.anomalies || []).map(function (a) {
        return { rule_id: a.rule_id, severity: a.severity, message: a.message };
      }),
      updated_at: rec.updated_at
    };
  }

  function listRecordsFor(records, pmlEmail) {
    var norm = normEmail(pmlEmail);
    var scoped = norm === ORGANIK_EMAIL
      ? records // akses pengawas: semua record, bukan cuma milik sendiri
      : records.filter(function (r) { return normEmail(r.pml_email) === norm; });
    return scoped
      .map(summarize)
      .sort(function (a, b) { // terbaru dulu
        return a.updated_at < b.updated_at ? 1 : a.updated_at > b.updated_at ? -1 : 0;
      });
  }

  function getRecordFor(records, pmlEmail, recordId) {
    var norm = normEmail(pmlEmail);
    var rec = null;
    for (var i = 0; i < records.length; i++) {
      if (records[i].record_id === recordId) { rec = records[i]; break; }
    }
    if (!rec) return { ok: false, error: 'NOT_FOUND' };
    var owned = normEmail(rec.pml_email) === norm;
    if (!owned && norm !== ORGANIK_EMAIL) return { ok: false, error: 'FORBIDDEN' };
    return { ok: true, record: rec, owned: owned };
  }

  /**
   * @param input {record_id?, jenis, idsubsls?} dari client
   * @param assignedRows baris alokasi MILIK pmlEmail (sudah difilter) —
   *        idsubsls di luar daftar ini DITOLAK (enforcement di server).
   * @param nowIso timestamp ISO; newId id record baru — dua-duanya disuntik
   *        supaya fungsi tetap murni & deterministik saat dites.
   */
  function applySaveDraft(records, pmlEmail, input, assignedRows, nowIso, newId) {
    var norm = normEmail(pmlEmail);
    input = input || {};
    if (input.jenis !== 'usaha' && input.jenis !== 'keluarga') {
      return { ok: false, error: 'INVALID_JENIS' };
    }

    var idsubsls = s(input.idsubsls).trim();
    var alokasiRow = null;
    if (idsubsls) {
      for (var i = 0; i < assignedRows.length; i++) {
        if (s(assignedRows[i].idsubsls) === idsubsls) { alokasiRow = assignedRows[i]; break; }
      }
      if (!alokasiRow) return { ok: false, error: 'WILAYAH_NOT_ASSIGNED' };
    }
    // Draft boleh belum punya wilayah (idsubsls kosong → snapshot kosong).
    var wilayah = buildWilayahSnapshot(alokasiRow);

    if (input.record_id) {
      var idx = -1;
      for (var j = 0; j < records.length; j++) {
        if (records[j].record_id === input.record_id) { idx = j; break; }
      }
      if (idx === -1) {
        // RECOVERY: record_id dikenal client tapi barisnya tidak ada di server
        // (mis. terhapus admin/reset). Draft di perangkat PML adalah satu-satunya
        // salinan datanya — buat ulang dengan id yang SAMA alih-alih menolak,
        // supaya data tidak terkunci selamanya di IndexedDB browser.
        var revived = {
          record_id: input.record_id, pml_email: norm, jenis: input.jenis,
          status: 'draft', wilayah: wilayah, answers: input.answers || {},
          anomalies: [], created_at: nowIso, updated_at: nowIso
        };
        return { ok: true, records: records.concat([revived]), record_id: revived.record_id, updated_at: nowIso };
      }
      if (normEmail(records[idx].pml_email) !== norm) return { ok: false, error: 'FORBIDDEN' };
      var updated = {};
      Object.keys(records[idx]).forEach(function (k) { updated[k] = records[idx][k]; });
      updated.jenis = input.jenis;
      updated.wilayah = wilayah;
      // Sync = kirim versi lokal terakhir (single-writer, tanpa merge per-field).
      updated.answers = input.answers !== undefined ? input.answers : records[idx].answers;
      updated.updated_at = nowIso;
      var copy = records.slice();
      copy[idx] = updated;
      return { ok: true, records: copy, record_id: updated.record_id, updated_at: nowIso };
    }

    var rec = {
      record_id: newId, pml_email: norm, jenis: input.jenis, status: 'draft',
      wilayah: wilayah, answers: input.answers || {}, anomalies: [],
      created_at: nowIso, updated_at: nowIso
    };
    return { ok: true, records: records.concat([rec]), record_id: newId, updated_at: nowIso };
  }

  /** Hapus record milik sendiri. Records = data PML sendiri, boleh hard-delete
   *  (beda dengan Questions/Rules yang wajib soft-delete). */
  function applyDeleteRecord(records, pmlEmail, recordId) {
    var norm = normEmail(pmlEmail);
    var found = null;
    for (var i = 0; i < records.length; i++) {
      if (records[i].record_id === recordId) { found = records[i]; break; }
    }
    if (!found) return { ok: false, error: 'NOT_FOUND' };
    if (normEmail(found.pml_email) !== norm) return { ok: false, error: 'FORBIDDEN' };
    return {
      ok: true, record_id: recordId,
      records: records.filter(function (r) { return r.record_id !== recordId; })
    };
  }

  return {
    buildWilayahSnapshot: buildWilayahSnapshot,
    judulRecord: judulRecord,
    summarize: summarize,
    listRecordsFor: listRecordsFor,
    getRecordFor: getRecordFor,
    applySaveDraft: applySaveDraft,
    applyDeleteRecord: applyDeleteRecord,
    ORGANIK_EMAIL: ORGANIK_EMAIL
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = RecordLogic;
}
