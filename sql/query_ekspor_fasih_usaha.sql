/* =============================================================================
   EKSPOR STAGING FASIH — "FASIH Usaha"  (Dokumen L)
   -----------------------------------------------------------------------------
   Jalankan di : Superset SQL Lab  https://fasih-dashboard.bps.go.id/superset/sqllab/
   Database    : "Starrocks SE 2026" (id 25)   Schema : tgr_fd68e454

   Output kolom = header tab staging "FASIH Usaha" (persis, urut bebas) di
   spreadsheet aplikasi. 1 baris = 1 UNIT usaha (bisa >1 per assignment).

   Cakupan: HANYA unit usaha yang ter-flag salah satu anomali U1–U7 (rekonsiliasi
   ke aplikasi — U5 ambang aset 10 MILIAR, U8/U9 tidak di sini). Aplikasi
   MENGHITUNG ULANG anomalinya sendiri saat impor; query ini hanya menyaring
   unit yang perlu diimpor supaya ukurannya wajar (~ribuan, bukan 73rb).

   Uang di-CAST ke BIGINT (CSV berisi integer polos tanpa pemisah ribuan) supaya
   parser aplikasi tidak salah baca. kbli_akhir DIBIARKAN string (leading zero).
   Dialek StarRocks: `||` = OR — sambung string WAJIB CONCAT (di sini tak perlu).
   ============================================================================= */
WITH
param AS (
  SELECT 0.50 AS p_pangsa_biaya_u1, 1.25 AS p_rasio_mbg_atas, 1.00 AS p_rasio_mbg_bawah,
         10000000000.0 AS p_aset_u5, 60000000.0 AS p_pendapatan_u5, 1 AS p_pekerja_u5,
         15000000000.0 AS p_pendapatan_ub, 2026 AS p_tahun_ub
)
, idn AS (
  SELECT rt.assignment_id,
         COALESCE(rt.level_6_full_code, rt.level_5_full_code, rt.level_4_full_code) AS kode_wilayah
  FROM tgr_fd68e454.root_table rt
)
, us AS (
  SELECT n.assignment_id
       , n.index1                                                                   AS idx_unit
       , n.nama_usaha
       , CAST(n.tahun_operasi AS INT)                                               AS thn_operasi
       , n.badan_usaha_value, n.lap_keuangan_value, n.produk_sendiri_value
       , n.kbli_akhir, n.internet_value, n.peran_mbg_value
       , n.total_tk_jk                                                              AS pekerja
       , COALESCE(n.biaya_pembelian , n.biaya_pembelian_bln , 0)                    AS r26a
       , COALESCE(n.biaya_produksi  , n.biaya_produksi_bln  , 0)                    AS r26b
       , COALESCE(n.gaji            , n.gaji_bln            , 0)                     AS r26c
       , COALESCE(n.operasional     , n.operasional_bln     , 0)                    AS r26d
       , COALESCE(n.non_operasional , n.non_operasional_bln , 0)                    AS r26e
       , COALESCE(n.total_pendapatan, n.total_pendapatan_bln)                       AS pendapatan
       , COALESCE(n.total_pendapatan, n.total_pendapatan_bln * 12)                  AS pendapatan_thn
       , COALESCE(n.total_aset_thn  , CAST(NULLIF(n.total_aset_bln,'') AS DOUBLE))  AS aset
       , COALESCE(n.publik    , n.publik_didirikan)                                 AS publik
       , COALESCE(n.non_publik, n.nonpublik_didirikan)                              AS non_publik
  FROM tgr_fd68e454.se2026_nested n
  WHERE n.tahun_operasi IS NOT NULL
)
, us2 AS (   /* turunan yang dipakai flag — kolom dieja eksplisit, SQL Lab menolak wildcard */
  SELECT u.assignment_id, u.idx_unit, u.nama_usaha, u.thn_operasi
       , u.badan_usaha_value, u.lap_keuangan_value, u.produk_sendiri_value
       , u.kbli_akhir, u.internet_value, u.peran_mbg_value, u.pekerja
       , u.r26a, u.r26b, u.r26c, u.r26d, u.r26e
       , u.pendapatan, u.pendapatan_thn, u.aset, u.publik, u.non_publik
       , (u.r26a + u.r26b + u.r26c + u.r26d + u.r26e) AS pengeluaran
  FROM us u
)
, flagged AS (
  SELECT DISTINCT assignment_id, idx_unit FROM (
      SELECT u.assignment_id, u.idx_unit FROM us2 u CROSS JOIN param p        /* U1 */
        WHERE u.produk_sendiri_value = '2' AND u.pengeluaran > 0
          AND u.r26b / u.pengeluaran > p.p_pangsa_biaya_u1
    UNION ALL
      SELECT u.assignment_id, u.idx_unit FROM us2 u                           /* U2 */
        WHERE u.pendapatan IS NOT NULL AND u.pengeluaran IS NOT NULL AND u.pendapatan < u.pengeluaran
    UNION ALL
      SELECT u.assignment_id, u.idx_unit FROM us2 u                           /* U3 */
        WHERE u.badan_usaha_value = '13' AND (COALESCE(u.publik,0) > 0 OR COALESCE(u.non_publik,0) > 0)
    UNION ALL
      SELECT u.assignment_id, u.idx_unit FROM us2 u CROSS JOIN param p        /* U4 */
        WHERE u.peran_mbg_value = '1' AND u.pengeluaran > 0
          AND (u.pendapatan / u.pengeluaran >= p.p_rasio_mbg_atas OR u.pendapatan / u.pengeluaran < p.p_rasio_mbg_bawah)
    UNION ALL
      SELECT u.assignment_id, u.idx_unit FROM us2 u CROSS JOIN param p        /* U5 */
        WHERE u.aset > p.p_aset_u5 AND u.pekerja = p.p_pekerja_u5 AND u.pendapatan_thn < p.p_pendapatan_u5
    UNION ALL
      SELECT u.assignment_id, u.idx_unit FROM us2 u CROSS JOIN param p        /* U6 */
        WHERE u.internet_value = '2' AND u.thn_operasi < p.p_tahun_ub AND u.pendapatan_thn >= p.p_pendapatan_ub
    UNION ALL
      SELECT u.assignment_id, u.idx_unit FROM us2 u CROSS JOIN param p        /* U7 */
        WHERE u.lap_keuangan_value = '2' AND u.thn_operasi < p.p_tahun_ub AND u.pendapatan_thn >= p.p_pendapatan_ub
  ) t
)
SELECT
    u.assignment_id
  , i.kode_wilayah
  , u.idx_unit
  , u.nama_usaha
  , u.badan_usaha_value
  , u.lap_keuangan_value
  , u.produk_sendiri_value
  , u.kbli_akhir
  , u.internet_value
  , u.peran_mbg_value
  , CAST(u.pekerja AS BIGINT)       AS total_tk_jk
  , u.thn_operasi                   AS tahun_operasi
  , CAST(u.r26a AS BIGINT)          AS biaya_pembelian
  , CAST(u.r26b AS BIGINT)          AS biaya_produksi
  , CAST(u.r26c AS BIGINT)          AS gaji
  , CAST(u.r26d AS BIGINT)          AS operasional
  , CAST(u.r26e AS BIGINT)          AS non_operasional
  , CAST(u.pendapatan AS BIGINT)    AS total_pendapatan
  , CAST(u.aset AS BIGINT)          AS total_aset
  , CAST(u.publik AS BIGINT)        AS publik
  , CAST(u.non_publik AS BIGINT)    AS non_publik
FROM us2 u
JOIN flagged f ON f.assignment_id = u.assignment_id AND f.idx_unit = u.idx_unit
LEFT JOIN idn i ON i.assignment_id = u.assignment_id
ORDER BY u.assignment_id, u.idx_unit;
