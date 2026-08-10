/* =============================================================================
   EKSPOR STAGING FASIH — "FASIH Roster AK"  (anggota keluarga, Blok I + III)
   -----------------------------------------------------------------------------
   Superset SQL Lab · DB "Starrocks SE 2026" (25) · schema tgr_fd68e454.
   Output kolom = header tab staging "FASIH Roster AK". 1 baris = 1 anggota
   keluarga (yang TINGGAL di sini, keberadaan 1/5), urut index1.

   Cakupan: HANYA anggota dari assignment keluarga yang ter-flag K1–K7 (CTE
   flag di bawah = SALINAN dari query_ekspor_fasih_keluarga.sql — WAJIB sama
   supaya roster & induknya sekelompok).

   Filter keberadaan 1/5 + urut index1 itu KRITIS: posisi AK-1/AK-2 (K1),
   COUNT anggota (b1r9/K7), dan roster_all disabilitas (K3) di aplikasi
   mengandalkan urutan & isi roster ini persis seperti SQL.

   CATATAN KOLOM: `nama_dtsen` diasumsikan ada di nested_dtsen (Blok I). Kalau
   SQL Lab menolak kolomnya, pindahkan ke `v.nama_dtsen` (nested_dtsen_var) atau
   hapus kolom itu — nama hanya untuk judul kartu, TIDAK memengaruhi anomali.
   ============================================================================= */
WITH
param AS (
  SELECT 3.0 AS p_luas_min_k4, 200.0 AS p_luas_max_k4, 100000.0 AS p_listrik_k6, 10 AS p_jml_ak_k7
)
, kel AS (
  SELECT rt.assignment_id, rt.jumlah_ak, rt.luas_lantai, rt.status_kepemilikan_value,
         rt.jml_meteran, rt.listrik_sebulan,
         COALESCE(rt.level_6_full_code, rt.level_5_full_code, rt.level_4_full_code) AS kode_wilayah,
         CASE WHEN COALESCE(rt.jumlah_kulkas,0)+COALESCE(rt.jumlah_kulkas_new,0) > 0
               OR COALESCE(rt.jumlah_ac,0)+COALESCE(rt.jumlah_ac_new,0) > 0
               OR COALESCE(rt.jumlah_laptop,0)+COALESCE(rt.jumlah_laptop_new,0) > 0
              THEN 1 ELSE 0 END AS punya_barang_mewah,
         CAST(NULLIF(rt.total_pendapatan_keluarga_sebulan ,'') AS DOUBLE) AS pendapatan_bln,
         CAST(NULLIF(rt.total_pengeluaran_keluarga_sebulan,'') AS DOUBLE) AS pengeluaran_bln
  FROM tgr_fd68e454.root_table rt
  WHERE rt.ada_keluarga_value IN ('1','2')
    -- AND SUBSTR(COALESCE(rt.level_6_full_code, rt.level_5_full_code, rt.level_4_full_code), 1, 10) IN ('5108010001','5108020001')  -- WAJIB level desa (10 digit: kdprov2+kdkab2+kdkec3+kddesa3 — kecamatan=7 digit TIDAK CUKUP, semua 9 kecamatan Buleleng >8000 baris sendiri2). Lihat TUTORIAL §4.
)
, ak AS (
  SELECT d.assignment_id, d.index1, d.hubungan_value, d.status_kawin_value, CAST(d.umur_ak AS INT) AS umur
  FROM tgr_fd68e454.nested_dtsen d WHERE d.keberadaan_dtsen_value IN ('1','5')
)
, ak_dis AS (
  SELECT v.assignment_id, v.index1,
         CASE WHEN v.dis_netra_value='1' OR v.dis_rungu_value='1' OR v.dis_wicara_value='1'
                OR v.dis_fisik_value='1' OR v.dis_intelek_value='1' OR v.dis_mental_value='1'
              THEN 1 ELSE 0 END AS disabilitas
  FROM tgr_fd68e454.nested_dtsen_var v
)
, meteran_rendah AS (
  SELECT m.assignment_id, MAX(CASE WHEN m.daya_terpasang_value='1' THEN 1 ELSE 0 END) AS ada_daya_rendah
  FROM tgr_fd68e454.nested_meteran m GROUP BY m.assignment_id
)
, ak_pos AS (
  SELECT a.assignment_id, ROW_NUMBER() OVER (PARTITION BY a.assignment_id ORDER BY CAST(a.index1 AS INT)) AS rn,
         a.hubungan_value AS hb, a.status_kawin_value AS sw FROM ak a
)
, ak_12 AS (
  SELECT assignment_id, MAX(CASE WHEN rn=1 THEN hb END) AS hb1, MAX(CASE WHEN rn=1 THEN sw END) AS sw1,
         MAX(CASE WHEN rn=2 THEN hb END) AS hb2, MAX(CASE WHEN rn=2 THEN sw END) AS sw2
  FROM ak_pos GROUP BY assignment_id
)
, ak_agg AS (
  SELECT a.assignment_id, COUNT(*) AS n_ak,
         MIN(CASE WHEN a.hubungan_value='1' THEN a.umur END) AS umur_kk,
         SUM(COALESCE(d.disabilitas,0)) AS n_disabilitas
  FROM ak a LEFT JOIN ak_dis d ON d.assignment_id=a.assignment_id AND d.index1=a.index1
  GROUP BY a.assignment_id
)
, flagged AS (   /* NB: cabang K1 (ak_12) & K3 (ak_agg baris ke-2) TIDAK bisa disaring lewat `kel`
                   (join/subquery root_table+nested_dtsen* di sini = planner gagal lagi, Issue 1002)
                   — makanya kedua cabang ini TETAP tanpa scope kecamatan/ada_keluarga_value walau
                   filter LIKE di `kel` diaktifkan. Aman (superset, RuleEvaluator recompute), tapi
                   artinya toggle kecamatan TIDAK memperkecil hasil K1/K3 sebanyak cabang lain. */
  SELECT DISTINCT assignment_id FROM (
      SELECT x.assignment_id FROM ak_12 x
        WHERE x.hb1='1' AND x.hb2 IS NOT NULL
          AND ((x.hb2='2' AND (x.sw1<>'2' OR x.sw2<>'2')) OR (x.sw1='2' AND x.hb2<>'2'))
    UNION ALL SELECT k.assignment_id FROM kel k JOIN ak_agg g ON g.assignment_id=k.assignment_id
        WHERE g.umur_kk < 10 AND k.status_kepemilikan_value='1'
    UNION ALL SELECT g.assignment_id FROM ak_agg g WHERE g.n_ak > 1 AND g.n_disabilitas = g.n_ak
    UNION ALL SELECT k.assignment_id FROM kel k CROSS JOIN param p
        WHERE k.luas_lantai IS NOT NULL AND k.jumlah_ak > 0
          AND (k.luas_lantai / k.jumlah_ak < p.p_luas_min_k4 OR k.luas_lantai / k.jumlah_ak > p.p_luas_max_k4)
    UNION ALL SELECT k.assignment_id FROM kel k
        WHERE k.pendapatan_bln IS NOT NULL AND k.pengeluaran_bln IS NOT NULL AND k.pendapatan_bln < k.pengeluaran_bln
    UNION ALL SELECT k.assignment_id FROM kel k CROSS JOIN param p
        LEFT JOIN meteran_rendah m ON m.assignment_id=k.assignment_id
        WHERE k.punya_barang_mewah=1 AND k.listrik_sebulan < p.p_listrik_k6 AND k.jml_meteran=1 AND COALESCE(m.ada_daya_rendah,0)=1
    UNION ALL SELECT k.assignment_id FROM kel k CROSS JOIN param p WHERE k.jumlah_ak > p.p_jml_ak_k7
  ) t
)
SELECT
    d.assignment_id
  , d.index1
  , d.nama_dtsen
  , d.hubungan_value
  , d.keberadaan_dtsen_value
  , d.status_kawin_value
  , v.nilai_pend_pekerjaan
  , v.dis_netra_value
  , v.dis_rungu_value
  , v.dis_fisik_value
  , v.dis_intelek_value
  , v.dis_mental_value
  , v.dis_wicara_value
FROM tgr_fd68e454.nested_dtsen d
JOIN flagged f ON f.assignment_id = d.assignment_id
LEFT JOIN tgr_fd68e454.nested_dtsen_var v ON v.assignment_id = d.assignment_id AND v.index1 = d.index1
WHERE d.keberadaan_dtsen_value IN ('1','5');
