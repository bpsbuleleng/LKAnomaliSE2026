/* =============================================================================
   EKSPOR STAGING FASIH — "FASIH Roster Meteran"  (Blok IV R14b)
   -----------------------------------------------------------------------------
   Superset SQL Lab · DB "Starrocks SE 2026" (25) · schema tgr_fd68e454.
   Output kolom = header tab staging "FASIH Roster Meteran". 1 baris = 1 meteran.

   Cakupan file ini: HANYA meteran dari assignment ter-flag K2/K4/K5/K6/K7
   (CTE flag di bawah = SALINAN dari query_ekspor_fasih_keluarga.sql, MINUS
   cabang K1/K3 — lihat REVISI 2026-08-11 di bawah). daya_terpasang_value
   '1' = 450 watt (dipakai K6). Aplikasi menghitung ulang anomalinya sendiri.

   REVISI 2026-08-11 (PEMISAHAN K1/K3, bug duplikasi ditemukan): sama persis
   dengan query_ekspor_fasih_roster_ak.sql (lihat catatan REVISI di sana untuk
   kronologi lengkap) — cabang K1(ak_12)/K3(ak_agg) TIDAK BISA difilter
   wilayah, jadi menjalankan versi lama (K1/K3 digabung + loop 21 grup wilayah)
   menyebabkan duplikasi masif ke tab staging "FASIH Roster Meteran" (bagian
   dari 9.972.724/10.000.000 sel workbook yang nyaris kena limit).

   SOLUSI: K1/K3 DIPINDAH ke file terpisah
   `query_ekspor_fasih_roster_meteran_k1k3.sql`, dijalankan HANYA 2 KALI TOTAL
   (partisi 0 & 1, TANPA loop wilayah). File INI hanya berisi K2/K4/K5/K6/K7,
   semuanya bisa difilter `kel`, AMAN dijalankan 21× (1x per grup wilayah).
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
    AND SUBSTR(COALESCE(rt.level_6_full_code, rt.level_5_full_code, rt.level_4_full_code), 1, 10) IN ('5108010001','5108020001')  -- WAJIB GANTI: daftar kode desa 1 grup dari pengelompokan_desa_keluarga.md. WAJIB level desa (10 digit).
)
, meteran_rendah AS (
  SELECT m.assignment_id, MAX(CASE WHEN m.daya_terpasang_value='1' THEN 1 ELSE 0 END) AS ada_daya_rendah
  FROM tgr_fd68e454.nested_meteran m GROUP BY m.assignment_id
)
, flagged AS (
  SELECT DISTINCT assignment_id FROM (
      SELECT k.assignment_id FROM kel k CROSS JOIN param p
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
    m.assignment_id
  , m.index1
  , m.daya_terpasang_value
FROM tgr_fd68e454.nested_meteran m
JOIN flagged f ON f.assignment_id = m.assignment_id;
