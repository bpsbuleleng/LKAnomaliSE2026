/* =============================================================================
   QUERY BANTU (TIDAK diekspor ke staging) — hitung jumlah baris per wilayah
   untuk merencanakan pengelompokan ekspor FASIH (keluarga + roster AK + roster
   meteran — SATU peta, lihat alasan di bawah; usaha PISAH, lihat Query 3).
   -----------------------------------------------------------------------------
   SKEMA KODE WILAYAH FASIH TERVERIFIKASI (2026-08-08, Query 2b lama, sudah
   dihapus dari file ini setelah terjawab): `kode_wilayah` = COALESCE(level_6,
   level_5, level_4)_full_code SELALU 16 digit persis (dicek: 150.538 baris,
   100% panjang 16 — TIDAK ada percampuran granularitas). Format = idsubsls BPS
   (lihat CLAUDE.md skema Alokasi Wilayah): kdprov(2)+kdkab(2)+kdkec(3)+
   kddesa(3)+kdsls(4)+kdsubsls(2). Prefix per level (HITUNGAN DIGIT INI WAJIB
   dipakai — versi awal sesi ini SALAH pakai 6/9 digit, sudah diperbaiki):
     - kecamatan : 7  digit (kdprov+kdkab+kdkec)   mis. 5108010
     - desa      : 10 digit (+kddesa)               mis. 5108010001
     - sls       : 14 digit (+kdsls)                mis. 51080100010001
     - subsls    : 16 digit (+kdsubsls, = kode penuh)

   Batas hard-cap Superset SQL Lab ±9000 baris/query (TUTORIAL_IMPOR_FASIH.md
   §4) berlaku ke SETIAP query ekspor. Hasil Query 1 (per kecamatan, 7 digit,
   2026-08-08): SEMUA 9 kecamatan Buleleng sendiri-sendiri sudah di atas 8000
   baris (terkecil ~8300 proxy) — jadi TIDAK ADA penggabungan kecamatan yang
   muat, langsung turun ke level desa (10 digit) untuk SEMUA kecamatan.

   Kenapa satu peta untuk keluarga+roster AK+roster meteran: ketiganya sama-sama
   difilter dari `root_table.ada_keluarga_value` (kolom `kel` di ke-3 file query
   ekspor) — populasi assignment-nya SAMA. `usaha` populasinya BEDA (unit usaha
   dari se2026_nested) — lihat Query 3 untuk peta terpisahnya.
   ============================================================================= */

-- ================= QUERY 1: peta PER KECAMATAN (7 digit) =================
-- CATATAN: versi SEBELUM 2026-08-08 sore memakai SUBSTR(...,1,6) — SALAH
-- (memotong di tengah kdkec 3-digit). Angka hasil versi lama TIDAK VALID,
-- jalankan ulang dengan versi 7-digit ini sebelum dipakai untuk apa pun.
SELECT
    SUBSTR(COALESCE(rt.level_6_full_code, rt.level_5_full_code, rt.level_4_full_code), 1, 7) AS kode_kecamatan
  , COUNT(*)                                            AS n_assignment_ada_keluarga
  , SUM(CASE WHEN rt.jumlah_ak >= 2 THEN 1 ELSE 0 END)  AS n_estimasi_flagged_atas_proxy
FROM tgr_fd68e454.root_table rt
WHERE rt.ada_keluarga_value IN ('1','2')
GROUP BY 1
ORDER BY 1;


-- ================= QUERY 2: peta PER DESA (10 digit), SEMUA kecamatan sekaligus =================
-- CATATAN: versi SEBELUM 2026-08-08 sore memakai SUBSTR(...,1,9) — SALAH
-- (memotong di tengah kddesa 3-digit, hasil lama cuma 20 kelompok kasar/rancu).
-- Jalankan versi 10-digit ini sebagai peta desa yang benar.
SELECT
    SUBSTR(COALESCE(rt.level_6_full_code, rt.level_5_full_code, rt.level_4_full_code), 1, 10) AS kode_desa
  , COUNT(*)                                            AS n_assignment_ada_keluarga
  , SUM(CASE WHEN rt.jumlah_ak >= 2 THEN 1 ELSE 0 END)  AS n_estimasi_flagged_atas_proxy
FROM tgr_fd68e454.root_table rt
WHERE rt.ada_keluarga_value IN ('1','2')
GROUP BY 1
ORDER BY 1;


-- ================= QUERY 2c: pecah desa yang MASIH >9000, turun ke level SLS (14 digit) =================
-- Pakai SETELAH Query 2 — ganti daftar kode_desa (10 digit) di WHERE dengan
-- desa-desa yang hasilnya masih >9000 dari Query 2.
-- SELECT
--     SUBSTR(COALESCE(rt.level_6_full_code, rt.level_5_full_code, rt.level_4_full_code), 1, 14) AS kode_sls
--   , COUNT(*)                                            AS n_assignment_ada_keluarga
--   , SUM(CASE WHEN rt.jumlah_ak >= 2 THEN 1 ELSE 0 END)  AS n_estimasi_flagged_atas_proxy
-- FROM tgr_fd68e454.root_table rt
-- WHERE rt.ada_keluarga_value IN ('1','2')
--   AND SUBSTR(COALESCE(rt.level_6_full_code, rt.level_5_full_code, rt.level_4_full_code), 1, 10)
--       IN ('5108010001', 'GANTI_DENGAN_DESA_LAIN_YANG_MASIH_BESAR')
-- GROUP BY 1
-- ORDER BY 1;


-- ================= QUERY 3: peta USAHA per kecamatan (7 digit; SUDAH dijalankan 2026-08-08) =================
-- HASIL: 8 dari 9 kecamatan >9000 unit (angka KASAR, semua unit usaha tanpa
-- filter U1-U7 — batas ATAS, jumlah ter-flag asli pasti lebih kecil). Keputusan
-- user: langsung turun ke desa juga (sama pola dengan keluarga), skip coba-coba
-- per kecamatan dulu. Lanjut ke Query 3b di bawah.
-- SELECT
--     SUBSTR(COALESCE(rt.level_6_full_code, rt.level_5_full_code, rt.level_4_full_code), 1, 7) AS kode_kecamatan
--   , COUNT(*) AS n_unit_usaha_total
-- FROM tgr_fd68e454.se2026_nested n
-- LEFT JOIN tgr_fd68e454.root_table rt ON rt.assignment_id = n.assignment_id
-- WHERE n.tahun_operasi IS NOT NULL
-- GROUP BY 1
-- ORDER BY 1;


-- ================= QUERY 3b: peta USAHA per desa (10 digit), SEMUA kecamatan sekaligus =================
-- Jalankan ini (SATU query untuk seluruh Buleleng, tidak perlu diulang per
-- kecamatan) untuk merencanakan pengelompokan desa usaha, sama pola dengan
-- Query 2 (keluarga). n_unit_usaha_total = batas ATAS kasar (tanpa filter
-- U1-U7) — jumlah ter-flag asli pasti lebih kecil, jadi grup boleh disusun
-- longgar (target ≤8000 per grup tetap aman, ada margin ekstra dari sini).
SELECT
    SUBSTR(COALESCE(rt.level_6_full_code, rt.level_5_full_code, rt.level_4_full_code), 1, 10) AS kode_desa
  , COUNT(*) AS n_unit_usaha_total
FROM tgr_fd68e454.se2026_nested n
LEFT JOIN tgr_fd68e454.root_table rt ON rt.assignment_id = n.assignment_id
WHERE n.tahun_operasi IS NOT NULL
GROUP BY 1
ORDER BY 1;
