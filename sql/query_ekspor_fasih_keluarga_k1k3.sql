/* =============================================================================
   EKSPOR STAGING FASIH — "FASIH Keluarga" LANJUTAN K1/K3  — QUERY B
   -----------------------------------------------------------------------------
   Superset SQL Lab · DB "Starrocks SE 2026" (25) · schema tgr_fd68e454.

   Pasangan query_ekspor_fasih_keluarga.sql (Query A, isi K2/K4/K5/K6/K7).
   Lihat komentar di Query A untuk alasan pemisahan ini (StarRocks planner
   gagal kalau union K1/K3 (sumber nested_dtsen*) dicampur K2/K4/K5/K6/K7
   (sumber root_table) dalam satu query — diverifikasi 2026-08-07).

   Query ini mengembalikan kolom detail LENGKAP (sama seperti Query A) untuk
   assignment_id yang ter-flag K1 ATAU K3 — TIDAK perlu VLOOKUP manual, cukup
   jalankan lalu APPEND hasilnya ke bawah baris hasil Query A di tab staging
   "FASIH Keluarga" (kalau ada assignment_id yang overlap dgn Query A, boleh
   dobel — aplikasi upsert berdasar assignment_id saat impor, aman).

   Uang di-CAST ke BIGINT. ORDER BY sengaja TIDAK dipakai (lihat Query A).
   ============================================================================= */
WITH
kel AS (
  SELECT rt.assignment_id
       , COALESCE(rt.level_6_full_code, rt.level_5_full_code, rt.level_4_full_code) AS kode_wilayah
       , rt.umur_krt
       , rt.status_kepemilikan_value
       , rt.luas_lantai
       , rt.sumber_penerangan_value
       , rt.jml_meteran
       , rt.listrik_sebulan
       , rt.pengeluaran_makanan_mingguan
       , rt.pengeluaran_non_makan_bulanan
       , rt.pengeluaran_non_makan_tahunan
       , COALESCE(rt.jumlah_kulkas,0) + COALESCE(rt.jumlah_kulkas_new,0)     AS jumlah_kulkas
       , COALESCE(rt.jumlah_ac    ,0) + COALESCE(rt.jumlah_ac_new    ,0)     AS jumlah_ac
       , COALESCE(rt.jumlah_laptop,0) + COALESCE(rt.jumlah_laptop_new,0)     AS jumlah_laptop
  FROM tgr_fd68e454.root_table rt
  WHERE rt.ada_keluarga_value IN ('1','2')
)
, ak AS (
  SELECT d.assignment_id, d.index1, d.hubungan_value, d.status_kawin_value
  FROM tgr_fd68e454.nested_dtsen d
  WHERE d.keberadaan_dtsen_value IN ('1','5')
)
, ak_dis AS (
  SELECT v.assignment_id, v.index1,
         CASE WHEN v.dis_netra_value='1' OR v.dis_rungu_value='1' OR v.dis_wicara_value='1'
                OR v.dis_fisik_value='1' OR v.dis_intelek_value='1' OR v.dis_mental_value='1'
              THEN 1 ELSE 0 END AS disabilitas
  FROM tgr_fd68e454.nested_dtsen_var v
)
, ak_pos AS (
  SELECT a.assignment_id,
         ROW_NUMBER() OVER (PARTITION BY a.assignment_id ORDER BY CAST(a.index1 AS INT)) AS rn,
         a.hubungan_value AS hb, a.status_kawin_value AS sw
  FROM ak a
)
, ak_12 AS (
  SELECT assignment_id,
         MAX(CASE WHEN rn=1 THEN hb END) AS hb1, MAX(CASE WHEN rn=1 THEN sw END) AS sw1,
         MAX(CASE WHEN rn=2 THEN hb END) AS hb2, MAX(CASE WHEN rn=2 THEN sw END) AS sw2
  FROM ak_pos GROUP BY assignment_id
)
, ak_agg AS (
  SELECT a.assignment_id, COUNT(*) AS n_ak,
         SUM(COALESCE(d.disabilitas,0)) AS n_disabilitas
  FROM ak a LEFT JOIN ak_dis d ON d.assignment_id=a.assignment_id AND d.index1=a.index1
  GROUP BY a.assignment_id
)
, flag_k1 AS (
  SELECT x.assignment_id FROM ak_12 x
    WHERE x.hb1='1' AND x.hb2 IS NOT NULL
      AND ((x.hb2='2' AND (x.sw1<>'2' OR x.sw2<>'2')) OR (x.sw1='2' AND x.hb2<>'2'))
)
, flag_k3 AS (
  SELECT g.assignment_id FROM ak_agg g WHERE g.n_ak > 1 AND g.n_disabilitas = g.n_ak
)
, flagged AS (
  SELECT DISTINCT assignment_id FROM (
      SELECT assignment_id FROM flag_k1
    UNION ALL
      SELECT assignment_id FROM flag_k3
  ) t
)
SELECT
    k.assignment_id
  , k.kode_wilayah
  , k.umur_krt
  , k.status_kepemilikan_value
  , CAST(k.luas_lantai AS BIGINT)                     AS luas_lantai
  , k.sumber_penerangan_value
  , k.jml_meteran
  , CAST(k.listrik_sebulan AS BIGINT)                 AS listrik_sebulan
  , CAST(k.pengeluaran_makanan_mingguan  AS BIGINT)   AS pengeluaran_makanan_mingguan
  , CAST(k.pengeluaran_non_makan_bulanan AS BIGINT)   AS pengeluaran_non_makan_bulanan
  , CAST(k.pengeluaran_non_makan_tahunan AS BIGINT)   AS pengeluaran_non_makan_tahunan
  , k.jumlah_kulkas
  , k.jumlah_ac
  , k.jumlah_laptop
FROM kel k
WHERE k.assignment_id IN (SELECT assignment_id FROM flagged);
