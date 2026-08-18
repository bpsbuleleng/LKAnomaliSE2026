/**
 * FasihImport — merakit record `Records` dari baris tab staging hasil ekspor
 * SQL Lab FASIH (lihat sql/query_ekspor_fasih_*.sql & sql/TUTORIAL_IMPOR_FASIH.md).
 * Logic MURNI: tanpa dependency SpreadsheetApp — di-unit-test di Node. Yang
 * menyentuh sheet (baca staging, tulis Records, jalankan rule) ada di
 * DataAccess.importFasih.
 *
 * Peta alias FASIH→aplikasi = sql/REKONSILIASI_RULE.md §5. Konversi nilai:
 *   - kategorik FASIH ('1','13') → number (kode non-numerik spt '01a' dibiarkan
 *     string — U3 hanya membandingkan ==13 yang tetap cocok);
 *   - r13g (KBLI) TETAP string (leading zero bagian identitas — JANGAN di-number);
 *   - uang ("Rp 5.000.000" atau integer polos) → number;
 *   - b3r18b_n & b3r18c_n = 0 (REKONSILIASI §6 poin 1: dekomposisi pendapatan
 *     belum pasti; b3r18a_n memuat total per anggota supaya b3r18c/K5 identik SQL).
 *
 * Roster anggota_keluarga di-ekspor HANYA anggota yang tinggal di sini
 * (keberadaan 1/5) & diurutkan index1 — supaya posisi AK-1/AK-2 (dipakai K1),
 * COUNT (b1r9/K7), dan roster_all (K3) identik dengan query SQL.
 */
var FasihImport = (function () {
  function deps() {
    if (typeof module !== 'undefined' && module.exports) {
      return { RecordLogic: require('./RecordLogic.js') };
    }
    return { RecordLogic: RecordLogic };
  }

  function s(v) { return String(v == null ? '' : v).trim(); }

  // Uang / hitungan → number. Buang "Rp", spasi & titik ribuan; koma (jika ada)
  // = desimal. Kosong/tak terparse → '' (dianggap kosong oleh evaluator/computed).
  function toNumber(v) {
    if (v === null || v === undefined) return '';
    var str = String(v).trim();
    if (str === '') return '';
    var cleaned = str.replace(/[Rr][Pp]/, '').replace(/[.\s]/g, '').replace(',', '.');
    cleaned = cleaned.replace(/[^0-9.\-]/g, '');
    if (!cleaned || cleaned === '-' || cleaned === '.') return '';
    var n = Number(cleaned);
    return isNaN(n) ? '' : n;
  }

  // Kode kategorik: integer-murni → number ('13'→13, '02'→2); non-numerik
  // dibiarkan string apa adanya ('01a'); kosong → ''.
  function toCat(v) {
    var str = s(v);
    if (str === '') return '';
    return /^-?\d+$/.test(str) ? Number(str) : str;
  }

  // r13g: string, jaga leading zero (JANGAN jadikan number).
  function toKode(v) { return s(v); }

  // Peta kolom staging → {alias aplikasi, konversi}. Kolom struktural
  // (assignment_id, kode_wilayah, idx_unit, index1) TIDAK di sini — ditangani
  // terpisah karena bukan jawaban kuesioner.
  var USAHA_MAP = {
    nama_usaha: ['nama_usaha', s],
    badan_usaha_value: ['r11a', toCat],
    lap_keuangan_value: ['r11d', toCat],
    produk_sendiri_value: ['r13b1', toCat],
    kbli_akhir: ['r13g', toKode],
    internet_value: ['r16a', toCat],
    peran_mbg_value: ['r22', toCat],
    total_tk_jk: ['r24c1', toNumber],
    tahun_operasi: ['r25', toNumber],
    biaya_pembelian: ['r26a', toNumber],
    biaya_produksi: ['r26b', toNumber],
    gaji: ['r26c', toNumber],
    operasional: ['r26d', toNumber],
    non_operasional: ['r26e', toNumber],
    total_pendapatan: ['r27c', toNumber],
    total_aset: ['r28c', toNumber],
    publik: ['r29c', toNumber],
    non_publik: ['r29d', toNumber]
  };

  var KELUARGA_MAP = {
    umur_krt: ['b1r13_1', toNumber],
    status_kepemilikan_value: ['b4r3a', toCat],
    luas_lantai: ['b4r5', toNumber],
    sumber_penerangan_value: ['b4r13', toCat],
    jml_meteran: ['b4r14a', toNumber],
    listrik_sebulan: ['b4r15a', toNumber],
    pengeluaran_makanan_mingguan: ['b4r16a', toNumber],
    pengeluaran_non_makan_bulanan: ['b4r16b', toNumber],
    pengeluaran_non_makan_tahunan: ['b4r16c', toNumber],
    jumlah_kulkas: ['b4r17c', toNumber],
    jumlah_ac: ['b4r17d', toNumber],
    jumlah_laptop: ['b4r17f', toNumber]
  };

  var ROSTER_AK_MAP = {
    nama_dtsen: ['b1r6_n', s],
    hubungan_value: ['b1r8_n', toCat],
    keberadaan_dtsen_value: ['b1r9_n', toCat],
    status_kawin_value: ['b1r11_n', toCat],
    nilai_pend_pekerjaan: ['b3r18a_n', toNumber],
    dis_netra_value: ['b3r20a_n', toCat],
    dis_rungu_value: ['b3r20b_n', toCat],
    dis_fisik_value: ['b3r20c_n', toCat],
    dis_intelek_value: ['b3r20d_n', toCat],
    dis_mental_value: ['b3r20e_n', toCat],
    dis_wicara_value: ['b3r20f_n', toCat]
  };

  var ROSTER_METERAN_MAP = {
    daya_terpasang_value: ['b4r14b_n', toCat]
  };

  // Header staging — dipakai membuat tab (Setup) & didokumentasikan di tutorial.
  // WAJIB persis sama dengan alias SELECT di query ekspor SQL.
  var STAGING = {
    usaha: { tab: 'FASIH Usaha', headers:
      ['assignment_id', 'kode_wilayah', 'idx_unit'].concat(Object.keys(USAHA_MAP)) },
    keluarga: { tab: 'FASIH Keluarga', headers:
      ['assignment_id', 'kode_wilayah'].concat(Object.keys(KELUARGA_MAP)) },
    rosterAk: { tab: 'FASIH Roster AK', headers:
      ['assignment_id', 'index1'].concat(Object.keys(ROSTER_AK_MAP)) },
    rosterMeteran: { tab: 'FASIH Roster Meteran', headers:
      ['assignment_id', 'index1'].concat(Object.keys(ROSTER_METERAN_MAP)) }
  };

  function applyMap(map, row) {
    var out = {};
    Object.keys(map).forEach(function (col) {
      var def = map[col];
      var val = def[1](row[col]);
      if (val !== '') out[def[0]] = val; // kosong → tidak ditulis (semantik "belum diisi")
    });
    return out;
  }

  // Kelompokkan baris roster per assignment_id, urut Number(index1) (stabil).
  // Dedup by (assignment_id, index1): staging FASIH bisa berisi baris yang
  // sama dari 2 query berbeda yang sengaja/tidak sengaja overlap (mis. satu
  // assignment match KEDUA kondisi K2-K7 per-wilayah dan proxy jumlah_ak>=2
  // dari query terpisah) — tanpa dedup ini, anggota roster tergandakan,
  // merusak b1r9/b3r18c (dihitung 2x) dan K3 (roster_all disabilitas).
  // Baris pertama yang ditemukan untuk kombinasi (assignment_id, index1)
  // dipakai, duplikat berikutnya diabaikan (datanya identik, sumbernya
  // query berbeda tapi anggota yang sama).
  function groupRoster(rows, map, extraConst) {
    var byAssign = {};
    var seen = {};
    (rows || []).forEach(function (r) {
      var aid = s(r.assignment_id);
      if (!aid) return;
      var idx = s(r.index1);
      var dedupKey = aid + '' + idx;
      if (seen[dedupKey]) return;
      seen[dedupKey] = true;
      if (!byAssign[aid]) byAssign[aid] = [];
      var rec = applyMap(map, r);
      Object.keys(extraConst || {}).forEach(function (k) { rec[k] = extraConst[k]; });
      byAssign[aid].push({ idx: Number(r.index1), data: rec });
    });
    Object.keys(byAssign).forEach(function (aid) {
      byAssign[aid].sort(function (a, b) {
        var ai = isNaN(a.idx) ? 0 : a.idx, bi = isNaN(b.idx) ? 0 : b.idx;
        return ai - bi;
      });
      byAssign[aid] = byAssign[aid].map(function (x) { return x.data; });
    });
    return byAssign;
  }

  /**
   * @param input {usaha, keluarga, rosterAk, rosterMeteran, alokasi, nowIso}
   *   — 4 array staging (baris objek ber-key header), array Alokasi Wilayah
   *   (untuk join wilayah + pml_email), dan timestamp ISO.
   * @return { records: [...], stats } — records BELUM ber-anomalies (diisi
   *   DataAccess.importFasih via RuleEvaluator); answers masih MENTAH (belum
   *   di-augment computed field).
   */
  function buildRecords(input) {
    input = input || {};
    var nowIso = input.nowIso || new Date().toISOString();
    var RL = deps().RecordLogic;

    // idsubsls → snapshot wilayah (email dinormalkan di buildWilayahSnapshot).
    var wilayahByIdsubsls = {};
    (input.alokasi || []).forEach(function (r) {
      var id = s(r.idsubsls);
      if (id && !wilayahByIdsubsls[id]) wilayahByIdsubsls[id] = RL.buildWilayahSnapshot(r);
    });
    function lookupWilayah(kode) {
      return wilayahByIdsubsls[s(kode)] || RL.buildWilayahSnapshot(null);
    }

    var akByAssign = groupRoster(input.rosterAk, ROSTER_AK_MAP, { b3r18b_n: 0, b3r18c_n: 0 });
    var metByAssign = groupRoster(input.rosterMeteran, ROSTER_METERAN_MAP, {});

    var records = [];
    var stats = { usaha: 0, keluarga: 0, rosterAkRows: 0, rosterMeteranRows: 0,
      unmatchedWilayah: 0, tanpaPml: 0 };
    Object.keys(akByAssign).forEach(function (a) { stats.rosterAkRows += akByAssign[a].length; });
    Object.keys(metByAssign).forEach(function (a) { stats.rosterMeteranRows += metByAssign[a].length; });

    function newRecord(jenis, key, assignmentId, wilayah, answers) {
      if (!wilayah.idsubsls) stats.unmatchedWilayah++;
      if (!wilayah.emailpml) stats.tanpaPml++;
      records.push({
        record_id: 'F-' + key,
        pml_email: wilayah.emailpml,
        jenis: jenis, status: 'submitted',
        wilayah: wilayah, answers: answers, anomalies: [],
        created_at: nowIso, updated_at: nowIso,
        sumber: 'fasih', assignment_id: assignmentId
      });
    }

    // ---- Keluarga (1 record/assignment) ----
    (input.keluarga || []).forEach(function (row) {
      var aid = s(row.assignment_id);
      if (!aid) return;
      var answers = applyMap(KELUARGA_MAP, row);
      var roster = {};
      if (akByAssign[aid]) roster.anggota_keluarga = akByAssign[aid];
      if (metByAssign[aid]) roster.meteran_listrik = metByAssign[aid];
      if (Object.keys(roster).length) answers.roster = roster;
      newRecord('keluarga', 'K-' + aid, aid, lookupWilayah(row.kode_wilayah), answers);
      stats.keluarga++;
    });

    // ---- Usaha (1 record/unit usaha; idx_unit membedakan unit dlm 1 assignment) ----
    (input.usaha || []).forEach(function (row) {
      var aid = s(row.assignment_id);
      if (!aid) return;
      var unit = s(row.idx_unit) || '0';
      var answers = applyMap(USAHA_MAP, row);
      answers.roster = {}; // usaha tidak punya roster
      newRecord('usaha', 'U-' + aid + '-' + unit, aid, lookupWilayah(row.kode_wilayah), answers);
      stats.usaha++;
    });

    return { records: records, stats: stats };
  }

  return {
    buildRecords: buildRecords,
    STAGING: STAGING,
    // diekspor untuk unit test konversi
    toNumber: toNumber, toCat: toCat, toKode: toKode
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = FasihImport;
}
