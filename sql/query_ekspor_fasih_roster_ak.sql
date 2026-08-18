/* =============================================================================
   EKSPOR STAGING FASIH — "FASIH Roster AK"  (anggota keluarga, Blok I + III)
   -----------------------------------------------------------------------------
   Superset SQL Lab · DB "Starrocks SE 2026" (25) · schema tgr_fd68e454.
   Output kolom = header tab staging "FASIH Roster AK". 1 baris = 1 anggota
   keluarga (yang TINGGAL di sini, keberadaan 1/5), urut index1.

   Cakupan file ini: HANYA anggota dari assignment ter-flag K2/K4/K5/K6/K7
   (CTE flag di bawah = SALINAN dari query_ekspor_fasih_keluarga.sql, MINUS
   cabang K1/K3 — lihat REVISI 2026-08-11 di bawah).

   Filter keberadaan 1/5 + urut index1 itu KRITIS: COUNT anggota (b1r9/K7) di
   aplikasi mengandalkan urutan & isi roster ini persis seperti SQL.

   REVISI 2026-08-11 (PEMISAHAN K1/K3, bug duplikasi ditemukan): versi
   sebelumnya menggabungkan cabang K1(ak_12)/K3(ak_agg) — yang TIDAK BISA
   difilter wilayah (join root_table+nested_dtsen* = Issue 1002) — ke DALAM
   file yang sama yang di-loop 21× per grup wilayah. Karena K1/K3 SELALU
   mengembalikan SELURUH Buleleng di tiap jalan (tidak terpengaruh filter
   `kel`), menjalankan file itu 21 kali (×2 partisi = 42 jalan) menyebabkan
   partisi K1/K3 yang SAMA ter-append ULANG ke tab staging di SETIAP dari 21
   grup — hasilnya FASIH Roster AK membengkak ke 229.782 baris (vs ekspektasi
   wajar ~13rb K1/K3 + puluhan ribu K2/K4/K5/K6/K7), sampai workbook Sheets
   nyaris kena limit 10 juta sel. Staging TIDAK dedup otomatis (dedup cuma di
   level Records akhir via record_id, bukan di staging).

   SOLUSI: K1/K3 DIPINDAH ke file terpisah `query_ekspor_fasih_roster_ak_k1k3.sql`
   yang dijalankan HANYA 2 KALI TOTAL (partisi 0 & 1, TANPA loop wilayah sama
   sekali — karena memang tidak bisa difilter wilayah, loop wilayah untuknya
   cuma bikin duplikat). File INI (roster_ak.sql) sekarang HANYA berisi
   K2/K4/K5/K6/K7 — SEMUANYA bisa difilter lewat `kel`, jadi AMAN dijalankan
   21× (1x per grup wilayah, TANPA partisi tambahan) tanpa risiko duplikasi
   (assignment berbeda per grup wilayah, tidak overlap).

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
