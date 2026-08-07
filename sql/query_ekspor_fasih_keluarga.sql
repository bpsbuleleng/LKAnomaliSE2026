/* =============================================================================
   EKSPOR STAGING FASIH — "FASIH Keluarga"  (root_table, Dokumen P)
   -----------------------------------------------------------------------------
   Superset SQL Lab · DB "Starrocks SE 2026" (25) · schema tgr_fd68e454.
   Output kolom = header tab staging "FASIH Keluarga". 1 baris = 1 assignment.
   SATU query untuk semua K1-K7 (tidak perlu file terpisah) — lihat catatan K1/K3
   di bawah untuk kenapa cakupannya proxy longgar, bukan filter presisi.

   Cakupan K2, K4, K5, K6, K7: presisi (rekonsiliasi ke aplikasi — K6 AND 4
   syarat). Cakupan K1 & K3: PROXY `jumlah_ak >= 2` (cabang `flag_k1k3_proxy`),
   BUKAN filter presisi — lihat alasan di bawah.

   KENAPA K1/K3 PROXY, BUKAN PRESISI: K1 & K3 butuh data dari `nested_dtsen`/
   `nested_dtsen_var` (posisi AK-1/AK-2, status disabilitas per anggota), tapi
   StarRocks planner GAGAL ("Invalid plan" / Issue 1002, region_full_code —
   bukan kolom kita, artefak internal planner) begitu `root_table` dan
   `nested_dtsen*` muncul BERSAMA dalam satu statement, apa pun bentuk relasinya
   (UNION, JOIN, WHERE IN, EXISTS — semua dicoba & gagal identik, diverifikasi
   2026-08-07). Assignment_id K1/K3 juga TIDAK bisa di-hardcode sebagai literal
   list permanen — data FASIH terus bertambah, snapshot id akan basi. Solusi:
   proxy `jumlah_ak >= 2` — baik K1 (butuh AK-1 & AK-2) maupun K3 (butuh
   jumlah_ak > 1) SELALU muncul di keluarga ≥2 anggota, jadi hasilnya SUPERSET
   K1∪K3 (bukan filter presis). Ini AMAN: `DataAccess.importFasih` MENGHITUNG
   ULANG anomali tiap record via `RuleEvaluator` terhadap SEMUA 16 rule (bukan
   menyalin flag SQL) — assignment yang lolos proxy ini tapi ternyata tidak
   kena K1/K3 tetap diimpor tanpa error, hasil akhirnya cuma tidak ber-anomali
   K1/K3 (atau tetap ber-anomali kalau kena rule lain). Konsekuensinya:
   beberapa record "bersih" (jumlah_ak≥2 tapi anomalies=[]) ikut terimpor di
   luar assignment yang sengaja ter-flag — bukan bug, cuma cakupan sedikit
   lebih luas dari "assignment yang ter-flag anomali".

   Uang di-CAST ke BIGINT (CSV berisi integer polos tanpa pemisah ribuan) supaya
   parser aplikasi tidak salah baca. Dialek StarRocks: `||` = OR — sambung
   string WAJIB CONCAT (di sini tak perlu). ORDER BY sengaja TIDAK dipakai (juga
   sempat memicu Invalid plan pada tabel ini) — urutan baris tidak memengaruhi
   hasil impor, aplikasi baca semua baris tab staging tanpa peduli urutan.

   NB roster: query ini TIDAK memuat anggota keluarga / meteran — itu 2 query
   terpisah (roster_ak & roster_meteran), diimpor ke tab staging masing-masing.
   ============================================================================= */
WITH
param AS (
  SELECT 3.0 AS p_luas_min_k4, 200.0 AS p_luas_max_k4, 100000.0 AS p_listrik_k6, 10 AS p_jml_ak_k7
)
, kel AS (
  SELECT rt.assignment_id
       , COALESCE(rt.level_6_full_code, rt.level_5_full_code, rt.level_4_full_code) AS kode_wilayah
       , rt.umur_krt
       , rt.jumlah_ak
       , rt.luas_lantai
       , rt.status_kepemilikan_value
       , rt.sumber_penerangan_value
       , rt.jml_meteran
       , rt.listrik_sebulan
       , rt.pengeluaran_makanan_mingguan
       , rt.pengeluaran_non_makan_bulanan
       , rt.pengeluaran_non_makan_tahunan
       , COALESCE(rt.jumlah_kulkas,0) + COALESCE(rt.jumlah_kulkas_new,0)     AS jumlah_kulkas
       , COALESCE(rt.jumlah_ac    ,0) + COALESCE(rt.jumlah_ac_new    ,0)     AS jumlah_ac
       , COALESCE(rt.jumlah_laptop,0) + COALESCE(rt.jumlah_laptop_new,0)     AS jumlah_laptop
       , CASE WHEN COALESCE(rt.jumlah_kulkas,0) + COALESCE(rt.jumlah_kulkas_new,0) > 0
               OR COALESCE(rt.jumlah_ac    ,0) + COALESCE(rt.jumlah_ac_new    ,0) > 0
               OR COALESCE(rt.jumlah_laptop,0) + COALESCE(rt.jumlah_laptop_new,0) > 0
              THEN 1 ELSE 0 END                                              AS punya_barang_mewah
       , CAST(NULLIF(rt.total_pendapatan_keluarga_sebulan ,'') AS DOUBLE)    AS pendapatan_bln
       , CAST(NULLIF(rt.total_pengeluaran_keluarga_sebulan,'') AS DOUBLE)    AS pengeluaran_bln
  FROM tgr_fd68e454.root_table rt
  WHERE rt.ada_keluarga_value IN ('1','2')
)
, ak AS (
  SELECT d.assignment_id, d.index1, d.hubungan_value, CAST(d.umur_ak AS INT) AS umur
  FROM tgr_fd68e454.nested_dtsen d
  WHERE d.keberadaan_dtsen_value IN ('1','5')
)
, ak_agg AS (   /* dipakai FILTER K2 saja (umur_kk) — join balik ke kel via assignment_id,
                   TIDAK mengambil baris union langsung dari nested_dtsen (itu yg bikin gagal) */
  SELECT a.assignment_id,
         MIN(CASE WHEN a.hubungan_value='1' THEN a.umur END) AS umur_kk
  FROM ak a
  GROUP BY a.assignment_id
)
, meteran_rendah AS (
  SELECT m.assignment_id, MAX(CASE WHEN m.daya_terpasang_value='1' THEN 1 ELSE 0 END) AS ada_daya_rendah
  FROM tgr_fd68e454.nested_meteran m GROUP BY m.assignment_id
)
, flag_k2 AS (
  SELECT k.assignment_id FROM kel k JOIN ak_agg g ON g.assignment_id=k.assignment_id
    WHERE g.umur_kk < 10 AND k.status_kepemilikan_value='1'
)
, flag_k4 AS (
  SELECT k.assignment_id FROM kel k CROSS JOIN param p
    WHERE k.luas_lantai IS NOT NULL AND k.jumlah_ak > 0
      AND (k.luas_lantai / k.jumlah_ak < p.p_luas_min_k4 OR k.luas_lantai / k.jumlah_ak > p.p_luas_max_k4)
)
, flag_k5 AS (
  SELECT k.assignment_id FROM kel k
    WHERE k.pendapatan_bln IS NOT NULL AND k.pengeluaran_bln IS NOT NULL AND k.pendapatan_bln < k.pengeluaran_bln
)
, flag_k6 AS (
  SELECT k.assignment_id FROM kel k CROSS JOIN param p
    LEFT JOIN meteran_rendah m ON m.assignment_id=k.assignment_id
    WHERE k.punya_barang_mewah=1 AND k.listrik_sebulan < p.p_listrik_k6
      AND k.jml_meteran=1 AND COALESCE(m.ada_daya_rendah,0)=1
)
, flag_k7 AS (
  SELECT k.assignment_id FROM kel k CROSS JOIN param p WHERE k.jumlah_ak > p.p_jml_ak_k7
)
, flag_k1k3_proxy AS (   /* superset longgar K1∪K3 — lihat catatan di atas */
  SELECT k.assignment_id FROM kel k WHERE k.jumlah_ak >= 2
)
, flagged AS (
  SELECT DISTINCT assignment_id FROM (
      SELECT assignment_id FROM flag_k2
    UNION ALL
      SELECT assignment_id FROM flag_k4
    UNION ALL
      SELECT assignment_id FROM flag_k5
    UNION ALL
      SELECT assignment_id FROM flag_k6
    UNION ALL
      SELECT assignment_id FROM flag_k7
    UNION ALL
      SELECT assignment_id FROM flag_k1k3_proxy
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
