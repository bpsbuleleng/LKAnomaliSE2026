# Prompt untuk Claude Cowork — ekspor 4 query FASIH × 42 grup wilayah

**Cara pakai**: salin SELURUH isi blok di bawah (mulai dari "## TUGAS" sampai
akhir file) ke Claude Cowork. Sebelum menjalankan, buka & login sendiri ke
`https://fasih-dashboard.bps.go.id/superset/sqllab/` (VPN & sesi login kamu
atur manual), pastikan browser Cowork memakai profil/sesi yang sudah login
itu. Cowork TIDAK diminta menangani login atau VPN sama sekali.

---

## TUGAS

Kamu bekerja di Superset SQL Lab (`https://fasih-dashboard.bps.go.id/superset/sqllab/`,
database "Starrocks SE 2026"). Saya sudah login manual — jangan coba login
ulang atau ganti akun. Tugasmu: jalankan 4 query SQL di bawah ini, masing-masing
diulang untuk beberapa "grup wilayah" berbeda (total 42 kombinasi query×grup),
lalu download tiap hasil sebagai CSV.

**ATURAN PALING PENTING — WAJIB DIPATUHI:**

1. **Jeda minimal 30-60 detik antara satu query selesai dan query berikutnya
   mulai dijalankan.** Server ini sebelumnya pernah memblokir request yang
   terlalu beruntun cepat ("Bot Detected"). Jeda ini WAJIB, bukan opsional.
2. Kalau di titik manapun muncul pesan error yang menyebut "Bot Detected",
   **BERHENTI TOTAL**, jangan retry otomatis. Laporkan ke saya kondisi
   terakhir (query mana, grup keberapa) dan tunggu instruksi saya.
3. Kalau hasil suatu query jumlah barisnya **persis angka bulat** (misalnya
   tepat 9000, 8000, dst — bukan angka acak seperti 7977), itu tanda hasil
   masih TERPOTONG oleh limit server. **Tetap download apa adanya**, tapi
   catat di laporan akhir sebagai "kemungkinan terpotong" — JANGAN mencoba
   mengubah setting limit atau menjalankan ulang sendiri; laporkan saja ke saya.
4. Untuk tiap query, ganti HANYA bagian yang ditandai `<<GANTI: ...>>` sesuai
   tabel grup wilayah di bawah — jangan ubah bagian lain dari SQL.
5. Setelah SEMUA 42 selesai (atau kalau berhenti di tengah karena error),
   buat **satu laporan akhir** berformat tabel: nomor, query (keluarga/usaha/
   rosterAk/rosterMeteran), grup, jumlah baris hasil, nama file CSV yang
   didownload, status (OK / terpotong-diduga / gagal).

**Nama file CSV**: beri nama `<query>_<nomor_urut>.csv`, contoh
`keluarga_01.csv`, `usaha_15.csv`, `rosterAk_03.csv`, `rosterMeteran_09.csv`
— nomor urut mengikuti kolom "#" di tabel grup wilayah masing-masing di bawah.
Simpan semua di folder unduhan yang sama, jangan pindah-pindah folder.

---

## QUERY 1 — `keluarga` (jalankan untuk 21 grup di Tabel A)

```sql
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
    AND SUBSTR(COALESCE(rt.level_6_full_code, rt.level_5_full_code, rt.level_4_full_code), 1, 10) IN (<<GANTI: daftar kode desa dari Tabel A>>)
)
, ak AS (
  SELECT d.assignment_id, d.index1, d.hubungan_value, CAST(d.umur_ak AS INT) AS umur
  FROM tgr_fd68e454.nested_dtsen d
  WHERE d.keberadaan_dtsen_value IN ('1','5')
)
, ak_agg AS (
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
, flag_k1k3_proxy AS (
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
```

## QUERY 2 — `rosterAk` (jalankan untuk 21 grup di Tabel A — kode desa SAMA dengan Query 1)

```sql
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
    AND SUBSTR(COALESCE(rt.level_6_full_code, rt.level_5_full_code, rt.level_4_full_code), 1, 10) IN (<<GANTI: daftar kode desa dari Tabel A>>)
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
, flagged AS (
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
```

> Kalau server menolak kolom `d.nama_dtsen` (error "column not found"), ganti
> baris itu jadi `v.nama_dtsen`, atau kalau tetap gagal hapus saja baris itu
> dari SELECT (kolom nama cuma untuk tampilan, tidak wajib) — beri tahu saya
> kalau ini terjadi.

## QUERY 3 — `rosterMeteran` (jalankan untuk 21 grup di Tabel A — kode desa SAMA dengan Query 1)

```sql
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
    AND SUBSTR(COALESCE(rt.level_6_full_code, rt.level_5_full_code, rt.level_4_full_code), 1, 10) IN (<<GANTI: daftar kode desa dari Tabel A>>)
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
, flagged AS (
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
    m.assignment_id
  , m.index1
  , m.daya_terpasang_value
FROM tgr_fd68e454.nested_meteran m
JOIN flagged f ON f.assignment_id = m.assignment_id;
```

## QUERY 4 — `usaha` (jalankan untuk 21 grup di Tabel B — kode desa BEDA dari Tabel A)

```sql
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
, us2 AS (
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
      SELECT u.assignment_id, u.idx_unit FROM us2 u CROSS JOIN param p
        WHERE u.produk_sendiri_value = '2' AND u.pengeluaran > 0
          AND u.r26b / u.pengeluaran > p.p_pangsa_biaya_u1
    UNION ALL
      SELECT u.assignment_id, u.idx_unit FROM us2 u
        WHERE u.pendapatan IS NOT NULL AND u.pengeluaran IS NOT NULL AND u.pendapatan < u.pengeluaran
    UNION ALL
      SELECT u.assignment_id, u.idx_unit FROM us2 u
        WHERE u.badan_usaha_value = '13' AND (COALESCE(u.publik,0) > 0 OR COALESCE(u.non_publik,0) > 0)
    UNION ALL
      SELECT u.assignment_id, u.idx_unit FROM us2 u CROSS JOIN param p
        WHERE u.peran_mbg_value = '1' AND u.pengeluaran > 0
          AND (u.pendapatan / u.pengeluaran >= p.p_rasio_mbg_atas OR u.pendapatan / u.pengeluaran < p.p_rasio_mbg_bawah)
    UNION ALL
      SELECT u.assignment_id, u.idx_unit FROM us2 u CROSS JOIN param p
        WHERE u.aset > p.p_aset_u5 AND u.pekerja = p.p_pekerja_u5 AND u.pendapatan_thn < p.p_pendapatan_u5
    UNION ALL
      SELECT u.assignment_id, u.idx_unit FROM us2 u CROSS JOIN param p
        WHERE u.internet_value = '2' AND u.thn_operasi < p.p_tahun_ub AND u.pendapatan_thn >= p.p_pendapatan_ub
    UNION ALL
      SELECT u.assignment_id, u.idx_unit FROM us2 u CROSS JOIN param p
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
WHERE SUBSTR(i.kode_wilayah, 1, 10) IN (<<GANTI: daftar kode desa dari Tabel B>>)
ORDER BY u.assignment_id, u.idx_unit;
```

---

## TABEL A — 21 grup untuk Query 1, 2, 3 (keluarga / rosterAk / rosterMeteran)

Untuk tiap nomor: jalankan Query 1 dulu dengan daftar kode ini, tunggu jeda,
download → lalu Query 2 dengan daftar SAMA, jeda, download → lalu Query 3
dengan daftar SAMA, jeda, download. Baru lanjut ke nomor berikutnya.

| #  | Daftar kode desa (isi persis ke`<<GANTI: ...>>`)                                                                                                                                                                  |
| -- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 01 | `'5108010001','5108010002','5108010003','5108010004','5108010005'`                                                                                                                                                |
| 02 | `'5108010006','5108010007','5108010008','5108010009','5108010010'`                                                                                                                                                |
| 03 | `'5108010011','5108010012','5108010013','5108010014'`                                                                                                                                                             |
| 04 | `'5108020001','5108020002','5108020003','5108020004','5108020005','5108020006','5108020007','5108020008','5108020009','5108020010','5108020011','5108020012','5108020013','5108020014','5108020015'`              |
| 05 | `'5108020016','5108020017','5108020018','5108020019','5108020020','5108020021'`                                                                                                                                   |
| 06 | `'5108030001','5108030002','5108030003','5108030004','5108030005','5108030006','5108030007','5108030008','5108030009','5108030010','5108030011','5108030012','5108030013','5108030014'`                           |
| 07 | `'5108030015'`                                                                                                                                                                                                    |
| 08 | `'5108040001','5108040002','5108040003','5108040004','5108040005','5108040006','5108040007','5108040008','5108040009','5108040010'`                                                                               |
| 09 | `'5108040011','5108040012','5108040013','5108040014','5108040015','5108040016','5108040017'`                                                                                                                      |
| 10 | `'5108050001','5108050002','5108050003','5108050004','5108050005','5108050006','5108050007','5108050008'`                                                                                                         |
| 11 | `'5108050009','5108050010','5108050011','5108050012','5108050013'`                                                                                                                                                |
| 12 | `'5108050014','5108050015'`                                                                                                                                                                                       |
| 13 | `'5108060001','5108060002','5108060003','5108060004','5108060005','5108060006','5108060007','5108060008','5108060009','5108060010','5108060011','5108060012','5108060013','5108060014','5108060015','5108060016'` |
| 14 | `'5108060017','5108060018','5108060019','5108060020','5108060021','5108060022','5108060023','5108060024'`                                                                                                         |
| 15 | `'5108060025','5108060026','5108060027','5108060028','5108060029'`                                                                                                                                                |
| 16 | `'5108070001','5108070002','5108070003','5108070004','5108070005','5108070006','5108070007','5108070008','5108070009','5108070010','5108070011'`                                                                  |
| 17 | `'5108070012','5108070013','5108070014'`                                                                                                                                                                          |
| 18 | `'5108080001','5108080002','5108080003','5108080004','5108080005','5108080006','5108080007','5108080008','5108080009','5108080010'`                                                                               |
| 19 | `'5108080011','5108080012','5108080013'`                                                                                                                                                                          |
| 20 | `'5108090001','5108090002','5108090003','5108090004','5108090005','5108090006'`                                                                                                                                   |
| 21 | `'5108090007','5108090008','5108090009','5108090010'`                                                                                                                                                             |

## TABEL B — 21 grup untuk Query 4 (usaha)

| #  | Daftar kode desa (isi persis ke`<<GANTI: ...>>`)                                                                                                                                                                                                                                                |
| -- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 01 | `'5108000000'`                                                                                                                                                                                                                                                                                  |
| 02 | `'5108010001','5108010002','5108010003','5108010004'`                                                                                                                                                                                                                                           |
| 03 | `'5108010005','5108010006','5108010007','5108010008','5108010009','5108010010','5108010011'`                                                                                                                                                                                                    |
| 04 | `'5108010012','5108010013','5108010014'`                                                                                                                                                                                                                                                        |
| 05 | `'5108020001','5108020002','5108020003','5108020004','5108020005','5108020006','5108020007','5108020008','5108020009','5108020010','5108020011','5108020012','5108020013','5108020014','5108020015','5108020016'`                                                                               |
| 06 | `'5108020017','5108020018','5108020019','5108020020','5108020021'`                                                                                                                                                                                                                              |
| 07 | `'5108030001','5108030002','5108030003','5108030004','5108030005','5108030006','5108030007','5108030008','5108030009','5108030010','5108030011','5108030012','5108030013'`                                                                                                                      |
| 08 | `'5108030014','5108030015'`                                                                                                                                                                                                                                                                     |
| 09 | `'5108040001','5108040002','5108040003','5108040004','5108040005','5108040006','5108040007','5108040008','5108040009'`                                                                                                                                                                          |
| 10 | `'5108040010','5108040011','5108040012','5108040013','5108040014','5108040015','5108040016'`                                                                                                                                                                                                    |
| 11 | `'5108040017'`                                                                                                                                                                                                                                                                                  |
| 12 | `'5108050001','5108050002','5108050003','5108050004','5108050005','5108050006','5108050007','5108050008'`                                                                                                                                                                                       |
| 13 | `'5108050009','5108050010','5108050011','5108050012','5108050013','5108050014','5108050015'`                                                                                                                                                                                                    |
| 14 | `'5108060001','5108060002','5108060003','5108060004','5108060005','5108060006','5108060007','5108060008','5108060009','5108060010','5108060011','5108060012','5108060013','5108060014','5108060015','5108060016','5108060017','5108060018','5108060019','5108060020','5108060021','5108060022'` |
| 15 | `'5108060023','5108060024','5108060025','5108060026','5108060027','5108060028','5108060029'`                                                                                                                                                                                                    |
| 16 | `'5108070001','5108070002','5108070003','5108070004','5108070005','5108070006','5108070007','5108070008','5108070009','5108070010','5108070011','5108070012'`                                                                                                                                   |
| 17 | `'5108070013','5108070014'`                                                                                                                                                                                                                                                                     |
| 18 | `'5108080001','5108080002','5108080003','5108080004','5108080005','5108080006','5108080007','5108080008','5108080009'`                                                                                                                                                                          |
| 19 | `'5108080010','5108080011','5108080012','5108080013'`                                                                                                                                                                                                                                           |
| 20 | `'5108090001','5108090002','5108090003','5108090004','5108090005','5108090006','5108090007','5108090008','5108090009'`                                                                                                                                                                          |
| 21 | `'5108090010'`                                                                                                                                                                                                                                                                                  |

---

## Urutan kerja yang disarankan

Untuk menghindari kebingungan dan supaya jeda antar-query konsisten, kerjakan
per query dulu (bukan per grup 4-query-sekaligus):

1. Query 1 (`keluarga`) untuk grup 01 sampai 21 di Tabel A → 21 file CSV.
2. Query 2 (`rosterAk`) untuk grup 01 sampai 21 di Tabel A → 21 file CSV.
3. Query 3 (`rosterMeteran`) untuk grup 01 sampai 21 di Tabel A → 21 file CSV.
4. Query 4 (`usaha`) untuk grup 01 sampai 21 di Tabel B → 21 file CSV.

Total 84 file CSV, 84 kali jalan query, dengan jeda 30-60 detik di ANTARA
SETIAP jalan (bukan cuma antar-query, tapi juga antar-grup dalam query yang
sama).

Setelah semua selesai, laporkan ke saya lewat tabel ringkasan (lihat aturan
poin 5 di atas), dan saya akan lanjutkan proses impor CSV-nya sendiri dari
sini (di luar tugasmu — kamu tidak perlu menyentuh Google Sheets atau
menjalankan script apa pun setelah CSV terkumpul).
