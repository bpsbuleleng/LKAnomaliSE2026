/* =============================================================================
   DETEKSI ANOMALI SE2026  —  KABUPATEN BULELENG (5108)
   -----------------------------------------------------------------------------
   Jalankan di : Superset SQL Lab  https://fasih-dashboard.bps.go.id/superset/sqllab/
   Database    : "Starrocks SE 2026"   (id 25, engine MySQL/StarRocks)
   Schema      : tgr_fd68e454          (survey SE2026, survey_id fd68e454-ba45-4b85-8205-f3bf777ded24)

   Output      : LONG format — 1 baris per (assignment, kode anomali)
                 Kolom mengikuti sheet "Anomali Usaha" BPS supaya bisa langsung
                 di-paste / di-import ke spreadsheet aplikasi LK Anomali.

   Cakupan     : U1-U7 (usaha) + K1-K7 (keluarga).
                 U8 (beda KBLI 2 digit pendataan vs SBR) TIDAK di sini — butuh
                 data SBR eksternal + agregasi lintas-record, bukan cek per-record.

   -----------------------------------------------------------------------------
   CARA PAKAI FILTER PML
     Ganti nilai p_email_pml di CTE `param` dengan email PML, contoh:
         SELECT 'akusury336@gmail.com' AS p_email_pml
     Biarkan '' (string kosong) untuk menampilkan SELURUH Buleleng.
   -----------------------------------------------------------------------------
   AMBANG BATAS  → semua ada di CTE `param`, tandai `[PARAM]`, ubah di satu tempat.
   ============================================================================= */

WITH
/* ---------------------------------------------------------------- 0. PARAMETER */
param AS (
  SELECT
    ''                AS p_email_pml           -- [PARAM] '' = semua PML Buleleng
  , 0.50              AS p_pangsa_biaya_u1     -- [PARAM] U1  biaya produksi / total pengeluaran > 50%
  , 1.25              AS p_rasio_mbg_atas      -- [PARAM] U4  rasio pendapatan/pengeluaran >= 1,25
  , 1.00              AS p_rasio_mbg_bawah     -- [PARAM] U4  atau rasio < 1
  , 10000000000.0     AS p_aset_u5             -- [PARAM] U5  aset > 10 M (10 MILIAR — lihat CATATAN 1)
  , 60000000.0        AS p_pendapatan_u5       -- [PARAM] U5  pendapatan setahun < 60 juta
  , 1                 AS p_pekerja_u5          -- [PARAM] U5  total pekerja = 1
  , 15000000000.0     AS p_pendapatan_ub       -- [PARAM] U6/U7 skala menengah-besar >= 15 Miliar
  , 2026              AS p_tahun_ub            -- [PARAM] U6/U7 tahun operasi < 2026
  , 3.0               AS p_luas_min_k4         -- [PARAM] K4  luas lantai per kapita < 3 m2
  , 200.0             AS p_luas_max_k4         -- [PARAM] K4  atau > 200 m2
  , 100000.0          AS p_listrik_k6          -- [PARAM] K6  listrik sebulan < Rp100.000 (dipakai AND, lihat CATATAN 5)
  , 10                AS p_jml_ak_k7           -- [PARAM] K7  jumlah anggota keluarga > 10
)

/* ------------------------------------------------- 1. PETUGAS (PML / PPL) ---- */
/* base_table_user_allocation_new KOSONG di instance ini, jadi kamus
   user_id -> email/nama dibangun dari base_table_assignment.                    */
, petugas AS (
  SELECT current_user_id                AS uid
       , MIN(current_user_username)     AS email
       , MIN(current_user_fullname)     AS nama
  FROM tgr_fd68e454.base_table_assignment
  WHERE current_user_id IS NOT NULL
    AND current_user_username IS NOT NULL
  GROUP BY current_user_id
)
, pml AS (   /* Pengawas = PML */
  SELECT r.assignment_id, MIN(p.email) AS email_pml, MIN(p.nama) AS nama_pml
  FROM tgr_fd68e454.base_table_assignment_responsibility r
  JOIN petugas p ON p.uid = r.current_user_id
  WHERE r.current_survey_rolename = 'Pengawas'
  GROUP BY r.assignment_id
)
, ppl AS (   /* Pencacah = PPL */
  SELECT r.assignment_id, MIN(p.email) AS email_ppl, MIN(p.nama) AS nama_ppl
  FROM tgr_fd68e454.base_table_assignment_responsibility r
  JOIN petugas p ON p.uid = r.current_user_id
  WHERE r.current_survey_rolename = 'Pencacah'
  GROUP BY r.assignment_id
)

/* -------------------------------------------- 2. IDENTITAS & WILAYAH ASSIGNMENT */
, idn AS (
  SELECT rt.assignment_id
       , COALESCE(rt.level_6_full_code, rt.level_5_full_code, rt.level_4_full_code) AS kode_wilayah
       , rt.level_3_code  AS kdkec   , rt.level_3_name AS nmkec
       , rt.level_4_code  AS kddesa  , rt.level_4_name AS nmdesa
       , rt.level_5_name  AS nmsls
       , rt.nama_sls
       , rt.no_bang
       , rt.no_keluarga
       , rt.nama_kk
       , rt.assignment_status_alias AS status_assignment
  FROM tgr_fd68e454.root_table rt
)

/* =============================================================================
   3. BASIS USAHA  (Dokumen L)  — tabel nested se2026_nested, 1 baris = 1 usaha
      Pemetaan kolom  <->  rincian kuesioner:
        tahun_operasi                    R25    tahun mulai beroperasi
        produk_sendiri_value             R13b1  memproduksi barang sendiri (1=Ya, 2=Tidak)
        biaya_produksi / _bln            R26b / R30b
        total_pengeluaran / _bln         R26f / R30f
        total_pendapatan / _bln          R27c / R31c
        total_aset_thn / total_aset_bln  R28c / R32c
        total_tk_jk                      R24c   total pekerja (laki + perempuan)
        badan_usaha_value                R11a   ('13' = Bukan Badan Usaha)
        lap_keuangan_value               R11d   (1=Ya, 2=Tidak)
        internet_value                   R16a   (1=Ya, 2=Tidak)
        peran_mbg_value                  R22    ('1' = SPPG)
        publik / non_publik              R29c / R29d   (% modal korporasi)
        publik_didirikan / nonpublik_didirikan   R33c / R33d  (usaha berdiri 2026)
        kbli_akhir                       R13g
      Kolom "_bln" dipakai untuk usaha yang BERDIRI 2026 (nilai BULANAN),
      kolom biasa untuk usaha yang berdiri < 2026 (nilai TAHUNAN).
   ============================================================================= */
, us AS (
  SELECT n.assignment_id
       , n.index1                                                              AS idx_unit        /* kunci unik usaha dlm 1 assignment */
       , n.no_usaha
       , n.nama_usaha
       , CAST(n.tahun_operasi AS INT)                                          AS thn_operasi
       , COALESCE(n.total_pendapatan  , n.total_pendapatan_bln)                AS pendapatan      /* R27c / R31c  (satuan asli) */
       /* PENTING — aplikasi TIDAK punya field R26f; ia menghitung
          r26_total = r26a+r26b+r26c+r26d+r26e. Supaya hasil SQL identik dengan
          mesin rule aplikasi, denominator di sini memakai JUMLAH KOMPONEN yang
          sama, BUKAN kolom total_pengeluaran (R26f) milik FASIH. */
       , ( COALESCE(n.biaya_pembelian , n.biaya_pembelian_bln , 0)
         + COALESCE(n.biaya_produksi  , n.biaya_produksi_bln  , 0)
         + COALESCE(n.gaji            , n.gaji_bln            , 0)
         + COALESCE(n.operasional     , n.operasional_bln     , 0)
         + COALESCE(n.non_operasional , n.non_operasional_bln , 0) )           AS pengeluaran     /* = r26_total aplikasi */
       , COALESCE(n.total_pengeluaran , n.total_pengeluaran_bln)               AS r26f_fasih      /* R26f asli, utk pembanding saja */
       , COALESCE(n.biaya_produksi    , n.biaya_produksi_bln)                  AS biaya_produksi  /* R26b / R30b */
       , COALESCE(n.total_pendapatan  , n.total_pendapatan_bln * 12)           AS pendapatan_thn  /* disetahunkan */
       , COALESCE(n.total_aset_thn    , CAST(NULLIF(n.total_aset_bln,'') AS DOUBLE)) AS aset      /* R28c / R32c */
       , n.total_tk_jk                                                         AS pekerja         /* R24c */
       , n.badan_usaha_value
       , n.produk_sendiri_value
       , n.internet_value
       , n.lap_keuangan_value
       , n.peran_mbg_value
       , n.kbli_akhir
       , COALESCE(n.publik    , n.publik_didirikan)                            AS modal_publik    /* R29c / R33c */
       , COALESCE(n.non_publik, n.nonpublik_didirikan)                         AS modal_nonpublik /* R29d / R33d */
  FROM tgr_fd68e454.se2026_nested n
  WHERE n.tahun_operasi IS NOT NULL      /* hanya usaha yang benar-benar didata (Dok L terisi) */
)

/* =============================================================================
   4. BASIS KELUARGA  —  root_table + roster nested_dtsen / nested_dtsen_var
        jumlah_ak                          Blok I  R2b  = COUNT(R9 in {1,5})  (sudah terhitung)
        luas_lantai                        Blok IV R5
        status_kepemilikan_value           Blok IV R3a  ('1' = milik sendiri)
        jml_meteran                        Blok IV R14a
        listrik_sebulan                    Blok IV R15a
        jumlah_kulkas / _ac / _laptop      Blok IV R17c / R17d / R17f
        total_pendapatan_keluarga_sebulan  Blok III R18a+R18b+R18c (sudah terhitung server)
        total_pengeluaran_keluarga_sebulan Blok IV  R16a/7*30 + R16b + R16c/12 (sudah terhitung)
   ============================================================================= */
, kel AS (
  SELECT rt.assignment_id
       , rt.jumlah_ak
       , rt.luas_lantai
       , rt.status_kepemilikan_value
       , rt.jml_meteran
       , rt.listrik_sebulan
       , CASE WHEN COALESCE(rt.jumlah_kulkas,0) + COALESCE(rt.jumlah_kulkas_new,0) > 0
               OR COALESCE(rt.jumlah_ac    ,0) + COALESCE(rt.jumlah_ac_new    ,0) > 0
               OR COALESCE(rt.jumlah_laptop,0) + COALESCE(rt.jumlah_laptop_new,0) > 0
              THEN 1 ELSE 0 END                                                AS punya_barang_mewah
       , CAST(NULLIF(rt.total_pendapatan_keluarga_sebulan ,'') AS DOUBLE)      AS pendapatan_bln
       , CAST(NULLIF(rt.total_pengeluaran_keluarga_sebulan,'') AS DOUBLE)      AS pengeluaran_bln
  FROM tgr_fd68e454.root_table rt
  WHERE rt.ada_keluarga_value IN ('1','2')     /* 1=Ditemukan, 2=Baru */
)
/* roster anggota keluarga yang TINGGAL di sini (R9 = 1 atau 5) */
, ak AS (
  SELECT d.assignment_id
       , d.index1
       , d.hubungan_value                    /* R8  : 1=KK, 2=Istri/Suami, 3=Anak, ... */
       , d.status_kawin_value                /* R11 : 1=Belum kawin, 2=Kawin, 3=Cerai hidup, 4=Cerai mati */
       , CAST(d.umur_ak AS INT) AS umur      /* R13b */
  FROM tgr_fd68e454.nested_dtsen d
  WHERE d.keberadaan_dtsen_value IN ('1','5')
)
/* flag disabilitas per anggota (Blok III R20 A-F, value '1' = Ya) */
, ak_dis AS (
  SELECT v.assignment_id
       , v.index1
       , CASE WHEN v.dis_netra_value  = '1' OR v.dis_rungu_value  = '1'
                OR v.dis_wicara_value = '1' OR v.dis_fisik_value  = '1'
                OR v.dis_intelek_value= '1' OR v.dis_mental_value = '1'
              THEN 1 ELSE 0 END AS disabilitas
  FROM tgr_fd68e454.nested_dtsen_var v
)
/* meteran listrik daya rendah (Blok IV R14b = 1  → < 900 watt) */
, meteran_rendah AS (
  SELECT m.assignment_id, MAX(CASE WHEN m.daya_terpasang_value = '1' THEN 1 ELSE 0 END) AS ada_daya_rendah
  FROM tgr_fd68e454.nested_meteran m
  GROUP BY m.assignment_id
)
/* posisi anggota ke-1 dan ke-2 dalam roster (dipakai K1) — urut index1 */
, ak_pos AS (
  SELECT a.assignment_id
       , ROW_NUMBER() OVER (PARTITION BY a.assignment_id ORDER BY CAST(a.index1 AS INT)) AS rn
       , a.hubungan_value     AS hb
       , a.status_kawin_value AS sw
  FROM ak a
)
, ak_12 AS (
  SELECT assignment_id
       , MAX(CASE WHEN rn = 1 THEN hb END) AS hb1   /* hubungan AK ke-1 */
       , MAX(CASE WHEN rn = 1 THEN sw END) AS sw1   /* status kawin AK ke-1 */
       , MAX(CASE WHEN rn = 2 THEN hb END) AS hb2   /* hubungan AK ke-2 */
       , MAX(CASE WHEN rn = 2 THEN sw END) AS sw2   /* status kawin AK ke-2 */
       , COUNT(*)                          AS n_ak
  FROM ak_pos
  GROUP BY assignment_id
)
/* ringkasan roster per assignment (dipakai K2, K3) */
, ak_agg AS (
  SELECT a.assignment_id
       , COUNT(*)                                                                       AS n_ak
       , MAX(CASE WHEN a.hubungan_value = '1' THEN 1 ELSE 0 END)                        AS ada_kk
       , MAX(CASE WHEN a.hubungan_value = '2' THEN 1 ELSE 0 END)                        AS ada_pasangan
       , MAX(CASE WHEN a.hubungan_value IN ('1','2')
                   AND a.status_kawin_value IN ('1','3','4') THEN 1 ELSE 0 END)         AS pasutri_tdk_kawin
       , MIN(CASE WHEN a.hubungan_value = '1' THEN a.umur END)                          AS umur_kk
       , SUM(COALESCE(d.disabilitas,0))                                                 AS n_disabilitas
  FROM ak a
  LEFT JOIN ak_dis d
         ON d.assignment_id = a.assignment_id
        AND d.index1        = a.index1
  GROUP BY a.assignment_id
)

/* =============================================================================
   5. TEMUAN ANOMALI  (UNION ALL, satu blok per kode)
   ============================================================================= */
, temuan AS (

  /* ---------- U1  Biaya Produksi Dominan ------------------------------------
     R13b1 = 2 (tidak memproduksi sendiri) TAPI R26b/R26f (atau R30b/R30f) > 50%  */
  SELECT 'U1' AS kode, 'usaha' AS jenis, 1 AS no_anomali
       , 'Biaya Produksi Dominan' AS jenis_anomali
       , 'Kegiatan usaha tidak memproduksi barang sendiri, tetapi komposisi pengeluaran pada biaya produksi dominan (>50%).' AS deskripsi
       , u.assignment_id, u.idx_unit, u.no_usaha AS no_unit, u.nama_usaha AS nama_unit
       , CONCAT('R13b1=', u.produk_sendiri_value,
                ' | biaya produksi=', CAST(u.biaya_produksi AS STRING),
                ' | total pengeluaran=', CAST(u.pengeluaran AS STRING),
                ' | pangsa=', CAST(ROUND(u.biaya_produksi / u.pengeluaran, 4) AS STRING)) AS detail
  FROM us u CROSS JOIN param p
  WHERE u.produk_sendiri_value = '2'
    AND u.pengeluaran > 0
    AND u.biaya_produksi / u.pengeluaran > p.p_pangsa_biaya_u1

  /* ---------- U2  Keuntungan Usaha (selisih negatif) ------------------------
     R27c < R26f   (atau R31c < R30f untuk usaha berdiri 2026)                   */
  UNION ALL
  SELECT 'U2', 'usaha', 2
       , 'Keuntungan Usaha'
       , 'Selisih pendapatan dan pengeluaran negatif.'
       , u.assignment_id, u.idx_unit, u.no_usaha, u.nama_usaha
       , CONCAT('pendapatan=', CAST(u.pendapatan AS STRING),
                ' | pengeluaran=', CAST(u.pengeluaran AS STRING),
                ' | selisih=', CAST(u.pendapatan - u.pengeluaran AS STRING))
  FROM us u
  WHERE u.pendapatan IS NOT NULL
    AND u.pengeluaran IS NOT NULL
    AND u.pendapatan < u.pengeluaran

  /* ---------- U3  Penyertaan Modal Korporasi --------------------------------
     R11a = 13 (Bukan Badan Usaha) TAPI R29c / R29d (modal korporasi) > 0        */
  UNION ALL
  SELECT 'U3', 'usaha', 3
       , 'Penyertaan Modal Korporasi'
       , 'Status Badan Usaha "Bukan Badan Usaha" namun ada penyertaan permodalan korporasi.'
       , u.assignment_id, u.idx_unit, u.no_usaha, u.nama_usaha
       , CONCAT('R11a=', u.badan_usaha_value,
                ' | modal korporasi publik=', CAST(COALESCE(u.modal_publik,0) AS STRING), '%',
                ' | non publik=', CAST(COALESCE(u.modal_nonpublik,0) AS STRING), '%')
  FROM us u
  WHERE u.badan_usaha_value = '13'
    AND (COALESCE(u.modal_publik,0) > 0 OR COALESCE(u.modal_nonpublik,0) > 0)

  /* ---------- U4  Data Keuangan MBG ----------------------------------------
     R22 = 1 (SPPG) TAPI rasio pendapatan/pengeluaran >= 1,25 atau < 1           */
  UNION ALL
  SELECT 'U4', 'usaha', 4
       , 'Data Keuangan MBG'
       , 'Unit "Makan Bergizi Gratis" (SPPG) dengan rasio pendapatan dibagi pengeluaran di luar kewajaran.'
       , u.assignment_id, u.idx_unit, u.no_usaha, u.nama_usaha
       , CONCAT('R22=', u.peran_mbg_value,
                ' | pendapatan=', CAST(u.pendapatan AS STRING),
                ' | pengeluaran=', CAST(u.pengeluaran AS STRING),
                ' | rasio=', CAST(ROUND(u.pendapatan / u.pengeluaran, 4) AS STRING))
  FROM us u CROSS JOIN param p
  WHERE u.peran_mbg_value = '1'
    AND u.pengeluaran > 0
    AND (   u.pendapatan / u.pengeluaran >= p.p_rasio_mbg_atas
         OR u.pendapatan / u.pengeluaran <  p.p_rasio_mbg_bawah )

  /* ---------- U5  Hubungan Aset, Pekerja, dan Produksi ----------------------
     Aset > 10 M  DAN  total pekerja = 1  DAN  pendapatan setahun < 60 juta      */
  UNION ALL
  SELECT 'U5', 'usaha', 5
       , 'Hubungan Aset, Pekerja, dan Produksi Usaha'
       , 'Nilai aset sangat besar, tetapi total pekerja hanya 1 dan nilai produksi/penjualan/pendapatan kecil.'
       , u.assignment_id, u.idx_unit, u.no_usaha, u.nama_usaha
       , CONCAT('aset=', CAST(u.aset AS STRING),
                ' | pekerja=', CAST(u.pekerja AS STRING),
                ' | pendapatan setahun=', CAST(u.pendapatan_thn AS STRING))
  FROM us u CROSS JOIN param p
  WHERE u.aset           >  p.p_aset_u5
    AND u.pekerja        =  p.p_pekerja_u5
    AND u.pendapatan_thn <  p.p_pendapatan_u5

  /* ---------- U6  Penggunaan Internet pada Usaha Menengah/Besar -------------
     R16a = 2 (tidak pakai internet) DAN R25 < 2026 DAN pendapatan setahun >= 15 M */
  UNION ALL
  SELECT 'U6', 'usaha', 6
       , 'Penggunaan Internet pada Usaha Menengah dan Besar'
       , 'Pendapatan usaha berskala menengah/besar, tetapi tidak menggunakan internet.'
       , u.assignment_id, u.idx_unit, u.no_usaha, u.nama_usaha
       , CONCAT('R16a=', u.internet_value,
                ' | R25=', CAST(u.thn_operasi AS STRING),
                ' | pendapatan setahun=', CAST(u.pendapatan_thn AS STRING))
  FROM us u CROSS JOIN param p
  WHERE u.internet_value  = '2'
    AND u.thn_operasi     <  p.p_tahun_ub
    AND u.pendapatan_thn  >= p.p_pendapatan_ub

  /* ---------- U7  Laporan Keuangan pada Usaha Menengah/Besar ----------------
     R11d = 2 (tidak punya laporan keuangan) DAN R25 < 2026 DAN pendapatan >= 15 M */
  UNION ALL
  SELECT 'U7', 'usaha', 7
       , 'Kepemilikan Laporan Keuangan pada Usaha Menengah dan Besar'
       , 'Pendapatan usaha berskala menengah/besar, tetapi tidak memiliki laporan/catatan keuangan.'
       , u.assignment_id, u.idx_unit, u.no_usaha, u.nama_usaha
       , CONCAT('R11d=', u.lap_keuangan_value,
                ' | R25=', CAST(u.thn_operasi AS STRING),
                ' | pendapatan setahun=', CAST(u.pendapatan_thn AS STRING))
  FROM us u CROSS JOIN param p
  WHERE u.lap_keuangan_value = '2'
    AND u.thn_operasi        <  p.p_tahun_ub
    AND u.pendapatan_thn     >= p.p_pendapatan_ub

  /* ---------- K1  Status Cerai / Belum Kawin -------------------------------
     Berbasis POSISI roster (AK ke-1 vs AK ke-2), bukan sekadar "ada KK & ada pasangan".
     Anomali bila AK ke-1 adalah Kepala Keluarga (R8=1) DAN salah satu terjadi:
       (a) AK ke-2 tercatat sebagai suami/istri (R8=2) tetapi status kawin
           AK ke-1 atau AK ke-2 bukan "Kawin" (R11 <> 2);
       (b) AK ke-1 berstatus kawin (R11=2) tetapi AK ke-2 BUKAN suami/istri
           (mis. langsung Anak) -> pasangan kemungkinan belum dicatat.
     TIDAK termasuk: KK berstatus kawin yang tinggal sendirian (tidak ada AK ke-2),
     karena umumnya wajar (pasangan merantau/bekerja di luar).                   */
  UNION ALL
  SELECT 'K1', 'keluarga', 1
       , 'Status Cerai / Belum Kawin'
       , 'Kepala Keluarga dan pasangannya berstatus cerai atau belum kawin.'
       , x.assignment_id, NULL, NULL, NULL
       , CONCAT('AK1: R8=', COALESCE(x.hb1,'-'), ' R11=', COALESCE(x.sw1,'-'),
                ' | AK2: R8=', COALESCE(x.hb2,'-'), ' R11=', COALESCE(x.sw2,'-'),
                ' | jumlah AK=', CAST(x.n_ak AS STRING))
  FROM ak_12 x
  WHERE x.hb1 = '1'
    AND x.hb2 IS NOT NULL                          /* ada AK ke-2 */
    AND (    (x.hb2 = '2' AND (x.sw1 <> '2' OR x.sw2 <> '2'))   /* (a) */
          OR (x.sw1 = '2' AND x.hb2 <> '2') )                   /* (b) */

  /* ---------- K2  Kepala Keluarga < 10 Th di Rumah Sendiri ------------------
     KK (R8=1) berumur < 10 tahun DAN status kepemilikan bangunan = 1 (milik sendiri) */
  UNION ALL
  SELECT 'K2', 'keluarga', 2
       , 'Kepala Keluarga < 10 Th di Rumah Sendiri'
       , 'Umur Kepala Keluarga < 10 tahun dan tinggal di rumah milik sendiri.'
       , k.assignment_id, NULL, NULL, NULL
       , CONCAT('umur KK=', CAST(g.umur_kk AS STRING), ' | R3a=', k.status_kepemilikan_value)
  FROM kel k
  JOIN ak_agg g ON g.assignment_id = k.assignment_id
  WHERE g.umur_kk < 10
    AND k.status_kepemilikan_value = '1'

  /* ---------- K3  Semua Anggota Keluarga Disabilitas ------------------------
     Jumlah AK > 1 DAN SEMUA anggota punya minimal satu R20.A-F = 1             */
  UNION ALL
  SELECT 'K3', 'keluarga', 3
       , 'Semua Anggota Keluarga Disabilitas'
       , 'Semua anggota keluarga menyandang disabilitas (kecuali keluarga tunggal).'
       , g.assignment_id, NULL, NULL, NULL
       , CONCAT('jumlah AK=', CAST(g.n_ak AS STRING), ' | AK disabilitas=', CAST(g.n_disabilitas AS STRING))
  FROM ak_agg g
  WHERE g.n_ak > 1
    AND g.n_disabilitas = g.n_ak

  /* ---------- K4  Luas Lantai Ekstrem --------------------------------------
     Luas lantai (R5) per kapita (R2b) < 3 m2 atau > 200 m2                     */
  UNION ALL
  SELECT 'K4', 'keluarga', 4
       , 'Luas Lantai Ekstrem'
       , 'Luas lantai per kapita < 3 m2 atau > 200 m2.'
       , k.assignment_id, NULL, NULL, NULL
       , CONCAT('luas lantai=', CAST(k.luas_lantai AS STRING),
                ' | jumlah AK=', CAST(k.jumlah_ak AS STRING),
                ' | per kapita=', CAST(ROUND(k.luas_lantai / k.jumlah_ak, 2) AS STRING))
  FROM kel k CROSS JOIN param p
  WHERE k.luas_lantai IS NOT NULL
    AND k.jumlah_ak > 0
    AND (   k.luas_lantai / k.jumlah_ak < p.p_luas_min_k4
         OR k.luas_lantai / k.jumlah_ak > p.p_luas_max_k4 )

  /* ---------- K5  Selisih Pendapatan Negatif --------------------------------
     Total pendapatan keluarga sebulan < total pengeluaran keluarga sebulan      */
  UNION ALL
  SELECT 'K5', 'keluarga', 5
       , 'Selisih Pendapatan Negatif'
       , 'Selisih pendapatan dan pengeluaran keluarga negatif.'
       , k.assignment_id, NULL, NULL, NULL
       , CONCAT('pendapatan=', CAST(k.pendapatan_bln AS STRING),
                ' | pengeluaran=', CAST(k.pengeluaran_bln AS STRING),
                ' | selisih=', CAST(ROUND(k.pendapatan_bln - k.pengeluaran_bln, 0) AS STRING))
  FROM kel k
  WHERE k.pendapatan_bln  IS NOT NULL
    AND k.pengeluaran_bln IS NOT NULL
    AND k.pendapatan_bln < k.pengeluaran_bln

  /* ---------- K6  Listrik Rendah & Ada Barang Mewah -------------------------
     R15a < 100.000  DAN  R14a = 1  DAN  R14b = 1  DAN  (R17c/d/f > 0)
     Sengaja memakai AND (bukan OR seperti bunyi dokumen) — versi OR menghasilkan
     33.335 temuan (32% keluarga), terlalu longgar untuk dikerjakan lapangan.    */
  UNION ALL
  SELECT 'K6', 'keluarga', 6
       , 'Listrik Rendah & Ada Barang Mewah'
       , 'Pengeluaran listrik sebulan < Rp100.000 atau daya listrik < 900 watt, tetapi memiliki kulkas/AC/komputer.'
       , k.assignment_id, NULL, NULL, NULL
       , CONCAT('listrik sebulan=', CAST(k.listrik_sebulan AS STRING),
                ' | jumlah meteran=', CAST(k.jml_meteran AS STRING),
                ' | daya rendah=', CAST(COALESCE(m.ada_daya_rendah,0) AS STRING),
                ' | punya kulkas/AC/laptop=ya')
  FROM kel k
  CROSS JOIN param p
  LEFT JOIN meteran_rendah m ON m.assignment_id = k.assignment_id
  WHERE k.punya_barang_mewah = 1
    AND k.listrik_sebulan < p.p_listrik_k6
    AND k.jml_meteran = 1
    AND COALESCE(m.ada_daya_rendah,0) = 1

  /* ---------- K7  Jumlah Anggota Keluarga Ekstrem ---------------------------
     Jumlah anggota keluarga (R9 = 1 + R9 = 5) > 10 orang                       */
  UNION ALL
  SELECT 'K7', 'keluarga', 7
       , 'Jumlah Anggota Keluarga Ekstrem'
       , 'Jumlah Anggota Keluarga > 10 orang.'
       , k.assignment_id, NULL, NULL, NULL
       , CONCAT('jumlah AK=', CAST(k.jumlah_ak AS STRING))
  FROM kel k CROSS JOIN param p
  WHERE k.jumlah_ak > p.p_jml_ak_k7
)

/* =============================================================================
   6. HASIL AKHIR
   ============================================================================= */
SELECT
    t.kode                                        AS kode_anomali
  , t.jenis                                       AS jenis_anomali_kelompok
  , t.no_anomali                                  AS no_anomali
  , t.jenis_anomali
  , t.deskripsi
  , t.assignment_id
  , t.idx_unit
  , CONCAT('https://fasih-sm.bps.go.id/app/assignment/fd68e454-ba45-4b85-8205-f3bf777ded24/', t.assignment_id) AS link_fasih
  , i.kode_wilayah
  , i.kdkec, i.nmkec
  , i.kddesa, i.nmdesa
  , COALESCE(i.nmsls, i.nama_sls)                 AS nama_sls
  , i.no_bang
  , i.no_keluarga
  , t.no_unit                                     AS no_usaha
  , COALESCE(t.nama_unit, i.nama_kk)              AS nama
  , i.status_assignment
  , pm.email_pml, pm.nama_pml
  , pp.email_ppl, pp.nama_ppl
  , t.detail                                      AS nilai_pemicu
FROM temuan t
CROSS JOIN param p
LEFT JOIN idn i ON i.assignment_id = t.assignment_id
LEFT JOIN pml pm ON pm.assignment_id = t.assignment_id
LEFT JOIN ppl pp ON pp.assignment_id = t.assignment_id
WHERE (p.p_email_pml = '' OR pm.email_pml = p.p_email_pml)
ORDER BY t.jenis, t.no_anomali, i.kdkec, i.kddesa, i.no_bang, i.no_keluarga;


/* =============================================================================
   HASIL UJI COBA  (dijalankan 22-07-2026 di SQL Lab, seluruh Buleleng)
   -----------------------------------------------------------------------------
     U1  3.961     K1  3.161
     U2  1.886     K2      3
     U3    136     K3    241
     U4     20     K4    362
     U5     55     K5  7.570
     U6      7     K6 12.317
     U7     22     K7      4
   Basis: 72.952 usaha (Dok L terisi) & ~104.300 keluarga (ada_keluarga 1/2).
   Angka bergerak sedikit tiap hari karena pendataan masih berjalan.
   ============================================================================= */

/* =============================================================================
   CATATAN & ASUMSI
   -----------------------------------------------------------------------------
   1. U5 — "nilai total aset lebih dari 10M" = 10 MILIAR (DIKONFIRMASI USER).
        aset > 10 Miliar  ->     55 temuan  (dipakai)
        aset > 10 Juta    -> 19.201 temuan  (ditolak)

   2. U6/U7 — dokumen menyebut "R27c ATAU R31c*12 >= 15 Miliar" tapi sekaligus
      mensyaratkan R25 < 2026 (artinya R31c tidak pernah terpakai). Di sini
      dipakai pendapatan yang sudah disetahunkan supaya aman.

   3. U8 (beda KBLI 2 digit pendataan vs SBR) TIDAK dibuat — perlu tabel SBR
      eksternal dan sifatnya agregat, bukan cek per-assignment.

   4. K1 — DIKONFIRMASI USER, berbasis POSISI roster (AK ke-1 & AK ke-2),
      bukan sekadar "ada KK & ada pasangan" seperti bunyi dokumen.
      Rincian temuan dari 80.165 keluarga yang AK-1 = KK berstatus kawin:
        AK-2 suami/istri tapi status kawinnya bukan 2      :    33  (dipakai)
        AK-2 suami/istri tapi KK-nya yang belum/cerai      :    39  (dipakai)
        AK-2 BUKAN suami/istri, 2.816 di antaranya Anak    : 3.089  (dipakai)
        KK kawin tapi tinggal sendirian (tidak ada AK-2)   : 1.833  (DIKECUALIKAN,
            umumnya wajar: pasangan merantau/bekerja di luar)

   5. K6 — DIKONFIRMASI USER memakai AND, bukan OR seperti bunyi dokumen.
      Perbandingan versi (data Buleleng):
        OR  (versi dokumen)                              : 33.335 temuan (32%)
        AND (dipakai)                                    : 12.315 temuan
        hanya 1 meteran 450 watt + barang mewah          : 16.543 temuan
        hanya listrik < Rp100rb + barang mewah           : 29.107 temuan

   6. K6 "daya listrik < 900 watt" = daya_terpasang_value = '1'.
      SUDAH DIVERIFIKASI: label kode '1' pada nested_meteran adalah "1. 450 watt".

   7. Barang mewah K6 memakai jumlah_kulkas/ac/laptop DAN varian *_new
      (dianggap punya bila salah satu > 0).

   8. base_table_user_allocation_new KOSONG di instance ini, sehingga email
      PML/PPL diambil dari base_table_assignment (± 3,6% baris responsibility
      tidak ketemu emailnya -> kolom email/nama akan NULL).

   9. DIALEK StarRocks: operator `||` berarti OR (BUKAN penyambung teks).
      Untuk menyambung string WAJIB pakai CONCAT(...). Jangan diganti.
   ============================================================================= */
