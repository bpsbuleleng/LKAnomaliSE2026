# Prompt untuk Claude Cowork — ekspor 6 query FASIH (roster K1/K3 dipisah)

**Cara pakai**: salin SELURUH isi blok di bawah (mulai dari "## TUGAS" sampai
akhir file) ke Claude Cowork. Sebelum menjalankan, buka & login sendiri ke
`https://fasih-dashboard.bps.go.id/superset/sqllab/` (VPN & sesi login kamu
atur manual), pastikan browser Cowork memakai profil/sesi yang sudah login
itu. Cowork TIDAK diminta menangani login atau VPN sama sekali.

**REVISI 2026-08-11 (PENTING, ganti prompt lama)**: versi sebelumnya
menggabungkan cabang K1/K3 KE DALAM Query 2 (`rosterAk`) & Query 3
(`rosterMeteran`) yang di-loop 21× per grup wilayah — karena K1/K3 TIDAK BISA
difilter wilayah (selalu mengembalikan SELURUH Buleleng), pola ini
menyebabkan K1/K3 ter-duplikasi ke tab staging di SETIAP dari 21 grup,
membengkakkan `FASIH Roster AK` sampai 229.782 baris dan HAMPIR membuat
workbook Google Sheets kena limit 10 juta sel (9.972.724/10.000.000 saat
ditemukan). Staging sudah dibersihkan (dipangkas balik ke kosong). **Query 1
(`keluarga`) dan Query 4 (`usaha`) SUDAH SELESAI dijalankan dengan hasil
VALID di sesi sebelumnya — JANGAN DIULANG.** Hanya rosterAk & rosterMeteran
yang perlu dikerjakan ulang, dengan struktur BARU di bawah (K1/K3 dipisah
jadi query tersendiri, dijalankan 2× total, bukan 21×2).

---

## TUGAS

Kamu bekerja di Superset SQL Lab (`https://fasih-dashboard.bps.go.id/superset/sqllab/`,
database "Starrocks SE 2026"). Saya sudah login manual — jangan coba login
ulang atau ganti akun. Tugasmu HANYA mengerjakan roster (Query 2, 3, 5, 6 di
bawah) — Query 1 (`keluarga`) dan Query 4 (`usaha`) SUDAH SELESAI, JANGAN
dijalankan lagi:

- **Query 2** (`rosterAk`, K2/K4/K5/K6/K7 saja) — 21 grup wilayah di Tabel A,
  SATU kali per grup (tanpa partisi) → 21 file CSV.
- **Query 3** (`rosterMeteran`, K2/K4/K5/K6/K7 saja) — 21 grup wilayah di
  Tabel A, SATU kali per grup (tanpa partisi) → 21 file CSV.
- **Query 5** (`rosterAk`, K1/K3 SAJA) — TANPA loop wilayah, HANYA 2 kali
  total (partisi 0 dan partisi 1) → 2 file CSV.
- **Query 6** (`rosterMeteran`, K1/K3 SAJA) — TANPA loop wilayah, HANYA 2
  kali total (partisi 0 dan partisi 1) → 2 file CSV.

**Total: 21 + 21 + 2 + 2 = 46 jalan query**, masing-masing didownload sebagai
CSV terpisah. (Jauh lebih sedikit dari rencana lama 84 jalan roster — karena
K1/K3 tidak lagi diulang tanpa perlu di tiap grup wilayah.)

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
5. **JANGAN jalankan Query 1 (`keluarga`) atau Query 4 (`usaha`) — sudah
   selesai di sesi sebelumnya, hasilnya sudah ada di staging aplikasi.**
6. Setelah SEMUA 46 selesai (atau kalau berhenti di tengah karena error),
   buat **satu laporan akhir** berformat tabel: nomor, query (rosterAk_grup /
   rosterMeteran_grup / rosterAk_k1k3 / rosterMeteran_k1k3), grup/partisi,
   jumlah baris hasil, nama file CSV yang didownload, status (OK /
   terpotong-diduga / gagal).

**Nama file CSV**:

- Query 2: `rosterAk_<nomor grup 2 digit>.csv`, mis. `rosterAk_01.csv`.
- Query 3: `rosterMeteran_<nomor grup 2 digit>.csv`, mis. `rosterMeteran_01.csv`.
- Query 5: `rosterAk_k1k3_p0.csv` dan `rosterAk_k1k3_p1.csv` (persis 2 file).
- Query 6: `rosterMeteran_k1k3_p0.csv` dan `rosterMeteran_k1k3_p1.csv` (persis 2 file).

Simpan semua di folder unduhan yang sama, jangan pindah-pindah folder.

---

## LANGKAH 0 — verifikasi fungsi hash SEBELUM mulai Query 5/6 (WAJIB, sekali saja)

Query 5 (`rosterAk` K1/K3) dan Query 6 (`rosterMeteran` K1/K3) butuh fungsi
`MURMUR_HASH3_32` untuk memecah baseline K1/K3 (~13.024 baris) yang melebihi
cap 9000 TERLEPAS dari filter wilayah apa pun. **Fungsi ini SUDAH
TERVERIFIKASI bekerja dengan baik pada 2026-08-11** (partisi 0 = 6.290 baris,
partisi 1 = 6.851 baris, total 13.141 — seimbang, jauh di bawah cap) — kamu
BOLEH LANGSUNG lanjut ke Query 5/6 tanpa mengulang verifikasi ini, KECUALI
kamu ingin double-check. Kalau ingin verifikasi ulang, jalankan:

```sql
WITH
ak AS (
  SELECT d.assignment_id, d.index1, d.hubungan_value, d.status_kawin_value
  FROM tgr_fd68e454.nested_dtsen d WHERE d.keberadaan_dtsen_value IN ('1','5')
)
, ak_dis AS (
  SELECT v.assignment_id, v.index1,
         CASE WHEN v.dis_netra_value='1' OR v.dis_rungu_value='1' OR v.dis_wicara_value='1'
                OR v.dis_fisik_value='1' OR v.dis_intelek_value='1' OR v.dis_mental_value='1'
              THEN 1 ELSE 0 END AS disabilitas
  FROM tgr_fd68e454.nested_dtsen_var v
)
, ak_idx1 AS (
  SELECT a.assignment_id, MIN(CAST(a.index1 AS INT)) AS idx1
  FROM ak a GROUP BY a.assignment_id
)
, ak_idx2 AS (
  SELECT a.assignment_id, MIN(CAST(a.index1 AS INT)) AS idx2
  FROM ak a JOIN ak_idx1 i1 ON i1.assignment_id = a.assignment_id
  WHERE CAST(a.index1 AS INT) > i1.idx1
  GROUP BY a.assignment_id
)
, ak_12 AS (
  SELECT i1.assignment_id
       , a1.hubungan_value AS hb1, a1.status_kawin_value AS sw1
       , a2.hubungan_value AS hb2, a2.status_kawin_value AS sw2
  FROM ak_idx1 i1
  JOIN ak a1 ON a1.assignment_id = i1.assignment_id AND CAST(a1.index1 AS INT) = i1.idx1
  LEFT JOIN ak_idx2 i2 ON i2.assignment_id = i1.assignment_id
  LEFT JOIN ak a2 ON a2.assignment_id = i2.assignment_id AND CAST(a2.index1 AS INT) = i2.idx2
)
, ak_agg AS (
  SELECT a.assignment_id, COUNT(*) AS n_ak,
         SUM(COALESCE(d.disabilitas,0)) AS n_disabilitas
  FROM ak a LEFT JOIN ak_dis d ON d.assignment_id=a.assignment_id AND d.index1=a.index1
  GROUP BY a.assignment_id
)
, baseline_k1k3 AS (
  SELECT DISTINCT assignment_id FROM (
      SELECT x.assignment_id FROM ak_12 x
        WHERE x.hb1='1' AND x.hb2 IS NOT NULL
          AND ((x.hb2='2' AND (x.sw1<>'2' OR x.sw2<>'2')) OR (x.sw1='2' AND x.hb2<>'2'))
    UNION ALL SELECT g.assignment_id FROM ak_agg g WHERE g.n_ak > 1 AND g.n_disabilitas = g.n_ak
  ) t
)
SELECT
    ABS(MOD(MURMUR_HASH3_32(a.assignment_id), 2)) AS partisi
  , COUNT(*) AS jumlah_baris_anggota
FROM ak a
JOIN baseline_k1k3 b ON b.assignment_id = a.assignment_id
GROUP BY ABS(MOD(MURMUR_HASH3_32(a.assignment_id), 2));
```

Kalau ERROR (mis. "Unknown function MURMUR_HASH3_32") → **BERHENTI**,
laporkan ke saya, jangan lanjut ke Query 5/6.

---

## QUERY 2 — `rosterAk`, HANYA K2/K4/K5/K6/K7 (jalankan 21 grup di Tabel A, SATU kali per grup, TANPA partisi)

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
```

> Kalau server menolak kolom `d.nama_dtsen` (error "column not found"), ganti
> baris itu jadi `v.nama_dtsen`, atau kalau tetap gagal hapus saja baris itu
> dari SELECT (kolom nama cuma untuk tampilan, tidak wajib) — beri tahu saya
> kalau ini terjadi.

## QUERY 3 — `rosterMeteran`, HANYA K2/K4/K5/K6/K7 (jalankan 21 grup di Tabel A — kode desa SAMA dengan Query 2, SATU kali per grup, TANPA partisi)

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
```

---

## QUERY 5 — `rosterAk`, HANYA K1/K3 (TANPA loop wilayah — jalankan HANYA 2 kali total: partisi 0, lalu partisi 1)

```sql
WITH
ak AS (
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
, ak_idx1 AS (
  SELECT a.assignment_id, MIN(CAST(a.index1 AS INT)) AS idx1
  FROM ak a GROUP BY a.assignment_id
)
, ak_idx2 AS (
  SELECT a.assignment_id, MIN(CAST(a.index1 AS INT)) AS idx2
  FROM ak a JOIN ak_idx1 i1 ON i1.assignment_id = a.assignment_id
  WHERE CAST(a.index1 AS INT) > i1.idx1
  GROUP BY a.assignment_id
)
, ak_12 AS (
  SELECT i1.assignment_id
       , a1.hubungan_value AS hb1, a1.status_kawin_value AS sw1
       , a2.hubungan_value AS hb2, a2.status_kawin_value AS sw2
  FROM ak_idx1 i1
  JOIN ak a1 ON a1.assignment_id = i1.assignment_id AND CAST(a1.index1 AS INT) = i1.idx1
  LEFT JOIN ak_idx2 i2 ON i2.assignment_id = i1.assignment_id
  LEFT JOIN ak a2 ON a2.assignment_id = i2.assignment_id AND CAST(a2.index1 AS INT) = i2.idx2
)
, ak_agg AS (
  SELECT a.assignment_id, COUNT(*) AS n_ak,
         SUM(COALESCE(d.disabilitas,0)) AS n_disabilitas
  FROM ak a LEFT JOIN ak_dis d ON d.assignment_id=a.assignment_id AND d.index1=a.index1
  GROUP BY a.assignment_id
)
, flagged AS (
  SELECT DISTINCT assignment_id FROM (
      SELECT x.assignment_id FROM ak_12 x
        WHERE x.hb1='1' AND x.hb2 IS NOT NULL
          AND ((x.hb2='2' AND (x.sw1<>'2' OR x.sw2<>'2')) OR (x.sw1='2' AND x.hb2<>'2'))
          AND ABS(MOD(MURMUR_HASH3_32(x.assignment_id), 2)) = <<GANTI: 0 atau 1, sesuai jalan ini>>
    UNION ALL SELECT g.assignment_id FROM ak_agg g WHERE g.n_ak > 1 AND g.n_disabilitas = g.n_ak
        AND ABS(MOD(MURMUR_HASH3_32(g.assignment_id), 2)) = <<GANTI: SAMA dengan angka di baris di atas>>
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

> **PENTING**: TIDAK ADA `<<GANTI: daftar kode desa>>` di query ini — TIDAK
> ADA filter wilayah sama sekali (memang sengaja, K1/K3 tidak bisa difilter
> wilayah). HANYA dua baris `ABS(MOD(MURMUR_HASH3_32(...), 2)) = <<GANTI: ...>>` yang perlu diisi, dan KEDUANYA WAJIB angka yang SAMA di satu jalan
> (keduanya 0, atau keduanya 1). Jalankan query ini TEPAT 2 KALI: sekali
> dengan `0`, sekali lagi dengan `1`. JANGAN diulang untuk tiap grup wilayah
> — grup wilayah TIDAK RELEVAN untuk query ini.

## QUERY 6 — `rosterMeteran`, HANYA K1/K3 (TANPA loop wilayah — jalankan HANYA 2 kali total: partisi 0, lalu partisi 1)

```sql
WITH
ak AS (
  SELECT d.assignment_id, d.index1, d.hubungan_value, d.status_kawin_value
  FROM tgr_fd68e454.nested_dtsen d WHERE d.keberadaan_dtsen_value IN ('1','5')
)
, ak_dis AS (
  SELECT v.assignment_id, v.index1,
         CASE WHEN v.dis_netra_value='1' OR v.dis_rungu_value='1' OR v.dis_wicara_value='1'
                OR v.dis_fisik_value='1' OR v.dis_intelek_value='1' OR v.dis_mental_value='1'
              THEN 1 ELSE 0 END AS disabilitas
  FROM tgr_fd68e454.nested_dtsen_var v
)
, ak_idx1 AS (
  SELECT a.assignment_id, MIN(CAST(a.index1 AS INT)) AS idx1
  FROM ak a GROUP BY a.assignment_id
)
, ak_idx2 AS (
  SELECT a.assignment_id, MIN(CAST(a.index1 AS INT)) AS idx2
  FROM ak a JOIN ak_idx1 i1 ON i1.assignment_id = a.assignment_id
  WHERE CAST(a.index1 AS INT) > i1.idx1
  GROUP BY a.assignment_id
)
, ak_12 AS (
  SELECT i1.assignment_id
       , a1.hubungan_value AS hb1, a1.status_kawin_value AS sw1
       , a2.hubungan_value AS hb2, a2.status_kawin_value AS sw2
  FROM ak_idx1 i1
  JOIN ak a1 ON a1.assignment_id = i1.assignment_id AND CAST(a1.index1 AS INT) = i1.idx1
  LEFT JOIN ak_idx2 i2 ON i2.assignment_id = i1.assignment_id
  LEFT JOIN ak a2 ON a2.assignment_id = i2.assignment_id AND CAST(a2.index1 AS INT) = i2.idx2
)
, ak_agg AS (
  SELECT a.assignment_id, COUNT(*) AS n_ak,
         SUM(COALESCE(d.disabilitas,0)) AS n_disabilitas
  FROM ak a LEFT JOIN ak_dis d ON d.assignment_id=a.assignment_id AND d.index1=a.index1
  GROUP BY a.assignment_id
)
, flagged AS (
  SELECT DISTINCT assignment_id FROM (
      SELECT x.assignment_id FROM ak_12 x
        WHERE x.hb1='1' AND x.hb2 IS NOT NULL
          AND ((x.hb2='2' AND (x.sw1<>'2' OR x.sw2<>'2')) OR (x.sw1='2' AND x.hb2<>'2'))
          AND ABS(MOD(MURMUR_HASH3_32(x.assignment_id), 2)) = <<GANTI: 0 atau 1, sesuai jalan ini>>
    UNION ALL SELECT g.assignment_id FROM ak_agg g WHERE g.n_ak > 1 AND g.n_disabilitas = g.n_ak
        AND ABS(MOD(MURMUR_HASH3_32(g.assignment_id), 2)) = <<GANTI: SAMA dengan angka di baris di atas>>
  ) t
)
SELECT
    m.assignment_id
  , m.index1
  , m.daya_terpasang_value
FROM tgr_fd68e454.nested_meteran m
JOIN flagged f ON f.assignment_id = m.assignment_id;
```

> **PENTING — sama seperti Query 5**: TIDAK ADA filter wilayah. Jalankan TEPAT
> 2 KALI TOTAL (partisi 0 dan partisi 1), kedua baris `ABS(MOD(...))` WAJIB
> angka yang sama di satu jalan. JANGAN diulang per grup wilayah.

---

## TABEL A — 21 grup untuk Query 2 & 3 (rosterAk / rosterMeteran, K2/K4/K5/K6/K7)

Untuk tiap nomor: jalankan Query 2 dulu dengan daftar kode ini (SATU kali,
tidak ada partisi), tunggu jeda, download → lalu Query 3 dengan daftar SAMA
(SATU kali), jeda, download. Baru lanjut ke nomor berikutnya. Tiap nomor
menghasilkan **2 file CSV** (1 dari Query 2, 1 dari Query 3).

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

---

## Urutan kerja yang disarankan

0. **Langkah 0 (opsional, sekali saja)**: verifikasi `MURMUR_HASH3_32` kalau
   ingin double-check (sudah terverifikasi sebelumnya, lihat "LANGKAH 0" di
   atas) — boleh dilewati langsung ke langkah 1.
1. Query 2 (`rosterAk`, K2/K4/K5/K6/K7) untuk grup 01 sampai 21 di Tabel A,
   SATU kali per grup → 21 file CSV (`rosterAk_01.csv` ... `rosterAk_21.csv`).
2. Query 3 (`rosterMeteran`, K2/K4/K5/K6/K7) untuk grup 01 sampai 21 di Tabel
   A, SATU kali per grup → 21 file CSV (`rosterMeteran_01.csv` ...
   `rosterMeteran_21.csv`).
3. Query 5 (`rosterAk`, K1/K3) — TEPAT 2 kali (partisi 0, partisi 1) → 2 file dikerjakan udah
   CSV (`rosterAk_k1k3_p0.csv`, `rosterAk_k1k3_p1.csv`).
4. Query 6 (`rosterMeteran`, K1/K3) — TEPAT 2 kali (partisi 0, partisi 1) → 2
   file CSV (`rosterMeteran_k1k3_p0.csv`, `rosterMeteran_k1k3_p1.csv`).

Total **46 file CSV**, 46 kali jalan query, dengan jeda 30-60 detik di ANTARA
SETIAP jalan.

**INGAT: Query 1 (`keluarga`) dan Query 4 (`usaha`) SUDAH SELESAI di sesi
sebelumnya — JANGAN dijalankan lagi, walau namanya masih disebut di beberapa
tempat sebagai konteks sejarah.**

Setelah semua selesai, laporkan ke saya lewat tabel ringkasan (lihat aturan
poin 6 di atas), dan saya akan lanjutkan proses impor CSV-nya sendiri dari
sini (di luar tugasmu — kamu tidak perlu menyentuh Google Sheets atau
menjalankan script apa pun setelah CSV terkumpul).
