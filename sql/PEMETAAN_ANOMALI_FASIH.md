# Pemetaan Anomali SE2026 → Database FASIH (Superset SQL Lab)

Hasil penelusuran 22 Juli 2026. Dokumen ini menjelaskan **di mana** data SE2026 tersimpan
dan **kolom mana** yang dipakai untuk tiap kode anomali. Semua nama kolom di bawah ini
sudah diverifikasi langsung ke database, bukan tebakan.

---

## 1. Koordinat database

| Item | Nilai |
|---|---|
| URL | https://fasih-dashboard.bps.go.id/superset/sqllab/ |
| Database | **Starrocks SE 2026** (`database_id = 25`, engine MySQL/StarRocks) |
| Schema | **`tgr_fd68e454`** |
| survey_id | `fd68e454-ba45-4b85-8205-f3bf777ded24` (sama dengan sufiks nama schema) |
| Link assignment | `https://fasih-sm.bps.go.id/app/assignment/{survey_id}/{assignment_id}` |
| Cakupan data | 100% Bali (51) – Buleleng (08); 219.967 assignment |

Database lain yang ada tapi **tidak dipakai**: `tcz_37526b20` (survei berbeda, hanya 113 baris),
`Presto MSSQL FASIH`, `SQL Server SE 26 Dashboard` (schema kosong), dll.

### Tabel di `tgr_fd68e454`

| Tabel | Isi | Baris |
|---|---|---|
| `root_table` | 1 baris per assignment — **keluarga / bangunan** (Dok P) | 219.967 |
| `se2026_nested` | roster **usaha** (Dok L) per assignment | 143.542 (72.952 terisi) |
| `nested_dtsen` | roster **anggota keluarga** Blok I | 339.150 |
| `nested_dtsen_var` | roster anggota keluarga Blok III (disabilitas, pendapatan) | 332.255 |
| `nested_meteran` | roster **meteran listrik** Blok IV | 82.712 |
| `base_table_assignment` | metadata assignment + `current_user_username` (email petugas) | — |
| `base_table_assignment_responsibility` | 2 baris/assignment: `Pengawas` (PML) & `Pencacah` (PPL) | 441.224 |
| `base_table_user_allocation_new` | **KOSONG** — jangan dipakai | 0 |

Join roster ke induknya: `assignment_id` + `index1`.

---

## 2. Konvensi penting

- Semua jawaban kategorik disimpan **berpasangan**: `<var>_value` (kode, tipe VARCHAR)
  dan `<var>_label` (teks). Bandingkan sebagai **string**: `= '2'`, bukan `= 2`.
- Kode badan usaha ber-leading-zero: `'01a'`, `'02'`, … , `'13'`.
- Usaha **berdiri < 2026** mengisi kolom tahunan (`total_pendapatan`, …);
  usaha **berdiri 2026** mengisi kolom bulanan (`*_bln`). Keduanya tidak pernah
  terisi bersamaan → aman pakai `COALESCE`.
- `total_aset_bln` bertipe VARCHAR (perlu `CAST`), `total_aset_thn` DOUBLE.
- **StarRocks: `||` = operator OR, bukan penyambung string.** Wajib `CONCAT()`.

---

## 3. Pemetaan variabel — USAHA (`se2026_nested`, Dokumen L)

| Rincian | Kolom | Catatan |
|---|---|---|
| R11a status badan usaha | `badan_usaha_value` | `'13'` = Bukan Badan Usaha |
| R11d laporan keuangan | `lap_keuangan_value` | 1=Ya, 2=Tidak |
| R13b1 memproduksi sendiri | `produk_sendiri_value` | 1=Ya, 2=Tidak |
| R13g KBLI | `kbli_akhir` | 5 digit, VARCHAR |
| R16a penggunaan internet | `internet_value` | 1=Ya, 2=Tidak |
| R22 peran MBG | `peran_mbg_value` | `'1'` = SPPG |
| R24c total pekerja | `total_tk_jk` | = `tk_laki` + `tk_pr` |
| R25 tahun operasi | `tahun_operasi` | VARCHAR → `CAST(... AS INT)` |
| R26b / R30b biaya produksi | `biaya_produksi` / `biaya_produksi_bln` | |
| R26f / R30f total pengeluaran | `total_pengeluaran` / `total_pengeluaran_bln` | |
| R27c / R31c total pendapatan | `total_pendapatan` / `total_pendapatan_bln` | |
| R28c / R32c total aset | `total_aset_thn` / `total_aset_bln` | |
| R29c / R33c modal korporasi publik | `publik` / `publik_didirikan` | persen (INT) |
| R29d / R33d modal korporasi non-publik | `non_publik` / `nonpublik_didirikan` | persen (INT) |

Komponen R26 lain yang tersedia: `biaya_pembelian` (a), `gaji` (c), `operasional` (d),
`non_operasional` (e), `pendapatan_lain`, `pendapatan_online`.

## 4. Pemetaan variabel — KELUARGA

**`root_table`**

| Rincian | Kolom |
|---|---|
| Keberadaan keluarga | `ada_keluarga_value` (1=Ditemukan, 2=Baru) |
| Blok I R2b jumlah AK | `jumlah_ak` — **sudah** = COUNT(R9 in {1,5}), terverifikasi |
| Blok IV R3a status kepemilikan bangunan | `status_kepemilikan_value` (1=Milik sendiri) |
| Blok IV R5 luas lantai | `luas_lantai` (INT) |
| Blok IV R13 sumber penerangan | `sumber_penerangan_value` (1=PLN dengan meteran) |
| Blok IV R14a jumlah meteran | `jml_meteran` |
| Blok IV R15a listrik sebulan | `listrik_sebulan` (DOUBLE, rupiah) |
| Blok IV R16a/b/c pengeluaran | `pengeluaran_makanan_mingguan`, `pengeluaran_non_makan_bulanan`, `pengeluaran_non_makan_tahunan` |
| Blok IV R17c/d/f kulkas / AC / laptop | `jumlah_kulkas`, `jumlah_ac`, `jumlah_laptop` (+ varian `*_new`) |
| Total pendapatan keluarga sebulan | `total_pendapatan_keluarga_sebulan` (VARCHAR) |
| Total pengeluaran keluarga sebulan | `total_pengeluaran_keluarga_sebulan` (VARCHAR) |

> `total_pengeluaran_keluarga_sebulan` sudah dihitung server dengan rumus resmi
> `R16a/7*30 + R16b + R16c/12` — **sudah dicek manual dan cocok**, jadi tidak perlu
> dihitung ulang di SQL.

**`nested_dtsen`** (Blok I, per anggota)

| Rincian | Kolom |
|---|---|
| R8 hubungan dengan KK | `hubungan_value` (1=KK, 2=Istri/Suami, 3=Anak, …, 9=Lainnya) |
| R9 status keberadaan | `keberadaan_dtsen_value` (1=Tinggal di sini, 5=AK baru) |
| R11 status perkawinan | `status_kawin_value` (1=Belum kawin, 2=Kawin, 3=Cerai hidup, 4=Cerai mati) |
| R13b umur | `umur_ak` |

**`nested_dtsen_var`** (Blok III, per anggota)

| Rincian | Kolom |
|---|---|
| R20 A–F disabilitas | `dis_netra_value`, `dis_rungu_value`, `dis_wicara_value`, `dis_fisik_value`, `dis_intelek_value`, `dis_mental_value` — 1=Ya, 2=Tidak, 3=Tidak tahu |
| R18 pendapatan | `nilai_pend_pekerjaan` (VARCHAR "Rp 5.000.000"), `pend_usaha`, `nilai_pend_lain` |

**`nested_meteran`** (Blok IV, per meteran)

| Rincian | Kolom |
|---|---|
| R14b daya terpasang | `daya_terpasang_value` — `'1'` = **450 watt** (terverifikasi) |

---

## 5. Ringkasan aturan yang diimplementasikan

| Kode | Aturan | Temuan Buleleng |
|---|---|---|
| U1 | `produk_sendiri='2'` DAN `biaya_produksi/total_pengeluaran > 0,5` | 3.961 |
| U2 | `total_pendapatan < total_pengeluaran` | 1.886 |
| U3 | `badan_usaha='13'` DAN (`publik>0` ATAU `non_publik>0`) | 136 |
| U4 | `peran_mbg='1'` DAN (rasio ≥ 1,25 ATAU rasio < 1) | 20 |
| U5 | `aset > 10 Miliar` DAN `pekerja = 1` DAN `pendapatan setahun < 60 jt` | 55 |
| U6 | `internet='2'` DAN `tahun<2026` DAN `pendapatan setahun ≥ 15 M` | 7 |
| U7 | `lap_keuangan='2'` DAN `tahun<2026` DAN `pendapatan setahun ≥ 15 M` | 22 |
| U8 | **tidak dibuat** — butuh data SBR eksternal + agregasi | — |
| K1 | AK-1 = KK, ada AK-2, DAN [(AK-2 pasangan & salah satu R11≠2) ATAU (KK kawin & AK-2 bukan pasangan)] | 3.161 |
| K2 | umur KK < 10 DAN R3a = 1 | 3 |
| K3 | `jumlah_ak > 1` DAN semua AK punya ≥1 disabilitas | 241 |
| K4 | `luas_lantai/jumlah_ak < 3` ATAU `> 200` | 362 |
| K5 | pendapatan sebulan < pengeluaran sebulan | 7.570 |
| K6 | listrik<100rb **DAN** 1 meteran 450W **DAN** punya kulkas/AC/laptop | 12.317 |
| K7 | `jumlah_ak > 10` | 4 |

---

## 6. Keputusan yang sudah diambil (22-07-2026)

| Isu | Keputusan |
|---|---|
| **U5** "aset lebih dari 10M" | **10 Miliar** (55 temuan). Versi 10 Juta ditolak (19.201 temuan). |
| **K6** OR vs AND | **AND** (12.317). Versi OR sesuai bunyi dokumen menghasilkan 33.335 (32% keluarga) — terlalu banyak untuk dikerjakan lapangan. |
| **K1** basis logika | **Posisi roster** (AK ke-1 & AK ke-2), bukan "ada KK & ada pasangan". Mencakup: AK-2 pasangan tapi status ≠ kawin (33), kebalikannya (39), dan AK-2 bukan pasangan padahal KK kawin (3.089). **Dikecualikan**: KK kawin tinggal sendirian (1.833) karena umumnya wajar. |

## 7. Yang masih terbuka

1. Perlu difilter status assignment tertentu saja (mis. hanya `APPROVED BY Pengawas`)
   atau semua status ikut diperiksa? Saat ini **semua status** ikut.
2. U8 (beda KBLI vs SBR) — kalau nanti dibutuhkan, jadi laporan agregat terpisah.
3. Cara tarik data rutin ke aplikasi: FASIH memblokir request otomatis
   ("Bot Detected") kalau terlalu cepat, jadi sebaiknya ekspor CSV manual
   dari SQL Lab atau dijadwalkan dengan jeda.
