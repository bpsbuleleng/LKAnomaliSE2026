/* =============================================================================
   EKSPOR STAGING FASIH — "FASIH Keluarga" K1/K3 — LANGKAH 1: daftar assignment_id
   -----------------------------------------------------------------------------
   Superset SQL Lab · DB "Starrocks SE 2026" (25) · schema tgr_fd68e454.

   TIDAK menyentuh root_table sama sekali (murni nested_dtsen + nested_dtsen_var)
   — StarRocks planner GAGAL ("Invalid plan" Issue 1002) kalau root_table dan
   nested_dtsen* muncul bersama dalam satu statement, APA PUN bentuknya (UNION,
   JOIN, WHERE IN, EXISTS — semua dicoba & gagal identik, diverifikasi
   2026-08-07). Makanya proses K1/K3 dipecah jadi 2 LANGKAH TERPISAH:

   LANGKAH 1 (file ini): jalankan, lalu COPY SEMUA nilai assignment_id hasilnya
   (klik kolom assignment_id di panel Results → copy, atau download CSV lalu
   buka di editor teks / spreadsheet buat ambil kolomnya).

   LANGKAH 2 (query_ekspor_fasih_keluarga_k1k3_langkah2_detail.sql): tempel
   daftar id dari langkah 1 ke placeholder di query itu, baru jalankan — hasil
   LANGKAH 2 itulah yang di-append ke tab staging "FASIH Keluarga".

   Kalau assignment_id-nya ribuan (LANGKAH 2 template pakai literal IN list),
   lihat catatan di file langkah 2 soal cara membagi jadi beberapa batch kalau
   query jadi terlalu panjang untuk SQL Lab.
   ============================================================================= */
WITH
ak AS (
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
SELECT DISTINCT assignment_id FROM (
    SELECT assignment_id FROM flag_k1
  UNION ALL
    SELECT assignment_id FROM flag_k3
) t;
