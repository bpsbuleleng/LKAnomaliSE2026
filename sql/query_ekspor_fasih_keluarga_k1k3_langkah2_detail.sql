/* =============================================================================
   EKSPOR STAGING FASIH — "FASIH Keluarga" K1/K3 — LANGKAH 2: kolom detail
   -----------------------------------------------------------------------------
   Superset SQL Lab · DB "Starrocks SE 2026" (25) · schema tgr_fd68e454.

   BELUM SIAP DIJALANKAN — placeholder {{ID_LIST}} di bawah harus diganti dulu
   dengan daftar assignment_id hasil LANGKAH 1
   (query_ekspor_fasih_keluarga_k1k3_langkah1_id.sql). Cara isi:
     1. Jalankan langkah 1, copy semua nilai assignment_id hasilnya.
     2. Tempel ke chat Claude — Claude akan susun ulang file ini dengan literal
        IN list lengkap (format: 'id1','id2','id3',...).
     3. Jalankan file yang sudah disusun ulang itu di SQL Lab.

   Kolom output SAMA PERSIS dengan query_ekspor_fasih_keluarga.sql (Query A) —
   hasilnya di-APPEND (bukan replace) ke baris berikutnya di tab staging
   "FASIH Keluarga" setelah hasil Query A. ORDER BY sengaja tidak dipakai.

   Kalau daftar id terlalu panjang untuk 1 query (SQL Lab/browser mungkin ada
   batas panjang statement), pisah jadi beberapa batch (mis. 1000 id per
   batch) — jalankan & simpan CSV terpisah per batch, semuanya tetap di-append
   ke tab staging yang sama.
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
    AND rt.assignment_id IN ( {{ID_LIST}} )
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
FROM kel k;
