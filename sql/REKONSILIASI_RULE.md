# Rekonsiliasi Rule: Aplikasi LK Anomali ↔ SQL Lab FASIH

Tujuan: memastikan anomali yang dideteksi SQL Lab **identik** dengan yang dihitung
mesin rule aplikasi (`RuleEvaluator` + `ComputedFields`), karena kolom `anomalies`
pada record hasil impor akan **dihitung ulang oleh aplikasi**, bukan disalin dari SQL.

Status per 22-07-2026. Rule aplikasi dibaca langsung dari tab `Rules`
(spreadsheet `1-AaXOXyy83Txn5xKxN9HpDYGuj5TwuaiYAD8nRKUUMU`), bukan dari CLAUDE.md
— beberapa di antaranya ternyata berbeda dari yang tertulis di dokumen.

---

## 1. Perbandingan per rule

| Kode | Rule aplikasi (live di tab `Rules`) | SQL Lab | Status |
|---|---|---|---|
| U1 | `r13b1==2` ∧ `pangsa_biaya_produksi > 0,5` | sama | ✅ sama |
| U2 | `r27c < r26_total` | sama | ✅ sama |
| U3 | `r11a==13` ∧ (`r29c>0` ∨ `r29d>0`) | sama | ✅ sama |
| U4 | `r22==1` ∧ (`rasio_pendapatan_biaya ≥ 1,25` ∨ `< 1`) | sama | ✅ sama |
| U5 | `r28c > 10.000.000` ∧ `r24c1==1` ∧ `r27c < 60jt` | aset > **10.000.000.000** | ⚠️ **BEDA — perbaiki aplikasi** |
| U6 | `r16a==2` ∧ `r25<2026` ∧ `r27c ≥ 15 M` | sama | ✅ sama |
| U7 | `r11d==2` ∧ `r25<2026` ∧ `r27c ≥ 15 M` | sama | ✅ sama |
| U9 | `rasio_ntb > batas_rasio_ntb` | **tidak ada** | ⚠️ **BEDA — disengaja, lihat §3** |
| K1 | `roster_any(b1r8_n ∈ [1,2] ∧ b1r11_n ∈ [1,3,4])` | berbasis posisi AK-1 & AK-2, 2 cabang | ⚠️ **BEDA — perbaiki aplikasi** |
| K2 | `b1r13_1 < 10` ∧ `b4r3a==1` | sama | ✅ sama |
| K3 | `b1r9>1` ∧ `roster_all(disabilitas)` | sama | ✅ sama |
| K4 | `luas_per_kapita < 3` ∨ `> 200` | sama | ✅ sama |
| K5 | `b3r18c < b4r16` | sama | ✅ sama |
| K6 | `(b4r15a<100rb ∨ (b4r14a==1 ∧ daya450))` ∧ barang mewah | **AND** ketiganya | ⚠️ **BEDA — perbaiki aplikasi** |
| K7 | `b1r9 > 10` | sama | ✅ sama |
| K99 | `b1r13_1 not_empty` | — | rule uji coba, `active=FALSE`, abaikan |

---

## 2. Perubahan yang harus dilakukan di APLIKASI

### 2.1 U5 — ambang aset

Tab `Rules`, kolom `when` baris `U5`:

```json
{"all":[{"field":"r28c","op":">","value":10000000000},
        {"field":"r24c1","op":"==","value":1},
        {"field":"r27c","op":"<","value":60000000}]}
```

Hanya angka `10000000` → `10000000000` (10 juta → 10 Miliar).

### 2.2 K6 — OR menjadi AND

Tab `Rules`, kolom `when` baris `K6`:

```json
{"all":[
  {"field":"b4r15a","op":"<","value":100000},
  {"field":"b4r14a","op":"==","value":1},
  {"roster_any":"meteran_listrik","condition":{"field":"b4r14b_n","op":"==","value":1}},
  {"any":[{"field":"b4r17c","op":">","value":0},
          {"field":"b4r17d","op":">","value":0},
          {"field":"b4r17f","op":">","value":0}]}
]}
```

### 2.3 K1 — pindah ke computed field berbasis posisi roster

Format `when` tidak bisa menyatakan "bandingkan baris ke-1 dengan baris ke-2",
jadi logikanya harus di `ComputedFields.js`. Fungsi `k1PasutriTidakKawin` **sudah ada**
tetapi baru mencakup cabang (a); perlu ditambah cabang (b).

Definisi yang disepakati (roster `anggota_keluarga`, index 0 = AK ke-1, index 1 = AK ke-2):

```
0  jika AK ke-1 bukan Kepala Keluarga (b1r8_n ≠ 1)
0  jika tidak ada AK ke-2                      ← KK kawin tinggal sendirian BUKAN anomali
1  (a) jika AK ke-2 = Istri/Suami (b1r8_n = 2) DAN
       (b1r11_n AK ke-1 ≠ 2  ATAU  b1r11_n AK ke-2 ≠ 2)
1  (b) jika AK ke-1 berstatus Kawin (b1r11_n = 2) DAN AK ke-2 BUKAN Istri/Suami
0  selain itu
```

Status kawin kosong tetap diperlakukan sebagai **tidak** anomali (data belum lengkap ≠ anomali),
konsisten dengan semantik evaluator yang berlaku sekarang.

Lalu `when` baris `K1` diganti jadi leaf datar:

```json
{"field":"k1_pasutri_tidak_kawin","op":"==","value":1}
```

Rincian temuan cabang (a) = 72, cabang (b) = 3.089, total **3.161**.

---

## 3. U9 — sengaja tidak ada di SQL

`U9` (rasio NTB) butuh tabel referensi `Rasio NTB SE2016` yang ada di **spreadsheet
aplikasi**, bukan di FASIH, dan tidak bisa di-upload ke sana. Jadi:

- SQL Lab **tidak** menghitung U9.
- Aplikasi tetap menghitungnya sendiri saat impor, karena punya tabel lookup-nya.
- Konsekuensi: jumlah anomali versi SQL akan **lebih sedikit** dari versi aplikasi,
  selisihnya persis sebanyak temuan U9. Ini disengaja dan bukan bug.

Syaratnya: `answers` hasil impor harus memuat `r13g` (kode KBLI), `r27c`, dan `r26a`–`r26e`
supaya `rasio_ntb` dan `batas_rasio_ntb` bisa dihitung.

---

## 4. Jebakan yang sudah ditangani

**R26f vs jumlah komponen.** Tab `Questions` aplikasi **tidak punya alias `r26f`** —
aplikasi hanya menanyakan `r26a`–`r26e` lalu menghitung
`r26_total = r26a+r26b+r26c+r26d+r26e`. FASIH punya kolom `total_pengeluaran` (R26f)
yang berdiri sendiri. Kalau SQL memakai `total_pengeluaran` sementara aplikasi memakai
jumlah komponen, U1/U2/U4 bisa berbeda hasil.

Sudah diperbaiki: SQL kini menghitung denominator dari **jumlah komponen yang sama**
(`biaya_pembelian + biaya_produksi + gaji + operasional + non_operasional`), dan kolom
`total_pengeluaran` asli tetap dibawa sebagai `r26f_fasih` untuk pembanding.

---

## 5. Peta alias aplikasi ↔ kolom FASIH

Dipakai untuk membangun `answers` JSON saat impor ke `Records`.

### Usaha — dari `tgr_fd68e454.se2026_nested`

| alias aplikasi | kolom FASIH (berdiri <2026 / berdiri 2026) |
|---|---|
| `nama_usaha` | `nama_usaha` |
| `r11a` | `badan_usaha_value` — string `'13'`, aplikasi membandingkan numerik `13` |
| `r11d` | `lap_keuangan_value` |
| `r13b1` | `produk_sendiri_value` |
| `r13g` | `kbli_akhir` — **TEXT, jaga leading zero** |
| `r16a` | `internet_value` |
| `r22` | `peran_mbg_value` |
| `r24c1` | `total_tk_jk` |
| `r25` | `tahun_operasi` |
| `r26a` | `biaya_pembelian` / `biaya_pembelian_bln` |
| `r26b` | `biaya_produksi` / `biaya_produksi_bln` |
| `r26c` | `gaji` / `gaji_bln` |
| `r26d` | `operasional` / `operasional_bln` |
| `r26e` | `non_operasional` / `non_operasional_bln` |
| `r27c` | `total_pendapatan` / `total_pendapatan_bln` |
| `r28c` | `total_aset_thn` / `total_aset_bln` (VARCHAR, perlu CAST) |
| `r29c` | `publik` / `publik_didirikan` |
| `r29d` | `non_publik` / `nonpublik_didirikan` |

### Keluarga non-roster — dari `tgr_fd68e454.root_table`

| alias | kolom FASIH |
|---|---|
| `b1r13_1` | `umur_krt` |
| `b4r3a` | `status_kepemilikan_value` |
| `b4r5` | `luas_lantai` |
| `b4r13` | `sumber_penerangan_value` |
| `b4r14a` | `jml_meteran` |
| `b4r15a` | `listrik_sebulan` |
| `b4r16a` | `pengeluaran_makanan_mingguan` |
| `b4r16b` | `pengeluaran_non_makan_bulanan` |
| `b4r16c` | `pengeluaran_non_makan_tahunan` |
| `b4r17c` | `jumlah_kulkas` (+ `jumlah_kulkas_new`) |
| `b4r17d` | `jumlah_ac` (+ `jumlah_ac_new`) |
| `b4r17f` | `jumlah_laptop` (+ `jumlah_laptop_new`) |

### Roster `anggota_keluarga` — `nested_dtsen` ⋈ `nested_dtsen_var` on (`assignment_id`,`index1`)

| alias | kolom FASIH |
|---|---|
| `b1r6_n` | `nama_dtsen` |
| `b1r8_n` | `hubungan_value` |
| `b1r9_n` | `keberadaan_dtsen_value` |
| `b1r11_n` | `status_kawin_value` |
| `b3r18a_n` | `nilai_pend_pekerjaan` — VARCHAR berformat `"Rp 5.000.000"`, **perlu di-parse** |
| `b3r18b_n` | *(lihat catatan)* |
| `b3r18c_n` | *(lihat catatan)* |
| `b3r20a_n` melihat | `dis_netra_value` |
| `b3r20b_n` mendengar | `dis_rungu_value` |
| `b3r20c_n` berjalan | `dis_fisik_value` |
| `b3r20d_n` mengingat | `dis_intelek_value` |
| `b3r20e_n` mengurus diri | `dis_mental_value` |
| `b3r20f_n` berkomunikasi | `dis_wicara_value` |

> Semua nilai kategorik FASIH berupa string (`'1'`, `'2'`, `'13'`), sedangkan rule aplikasi
> membandingkan numerik. Konversi dilakukan sekali saat impor, bukan di rule.

### Roster `meteran_listrik` — `nested_meteran`

| alias | kolom FASIH |
|---|---|
| `b4r14b_n` | `daya_terpasang_value` — `'1'` = 450 watt (terverifikasi) |

---

## 6. Masih perlu diverifikasi

1. **Dekomposisi `b3r18a/b/c_n`.** Label aplikasi: (a) pendapatan dari bekerja,
   (b) kepemilikan & investasi, (c) transfer/pensiun/lainnya. FASIH punya
   `nilai_pend_pekerjaan`, `pend_usaha`, `pend_lainnya`, `nilai_pend_lain`, dan komponen
   `pend_gaji/honor/lembur/tunjangan/uangmkn`. Pemetaan b dan c belum pasti.
   **Default sementara:** isi `b3r18a_n` dengan total pendapatan per anggota,
   `b3r18b_n` dan `b3r18c_n` = 0. Ini menjaga `b3r18c` (jumlah seluruh roster)
   tetap sama dengan `total_pendapatan_keluarga_sebulan` FASIH, sehingga **K5 identik** —
   hanya rinciannya yang belum terekonstruksi.
2. **`umur_krt` vs umur AK yang berkode Kepala Keluarga di roster.** Perlu dicek apakah
   selalu sama; kalau ada selisih, pilih salah satu sebagai sumber `b1r13_1`.
3. **`total_pengeluaran` (R26f) vs jumlah komponen** — sudah di-bypass (§4), tapi baik
   dicek berapa banyak barisnya yang berbeda untuk mengetahui kualitas isian.

Ketiganya butuh query tambahan di SQL Lab; belum sempat dijalankan karena FASIH
memblokir permintaan beruntun ("Bot Detected") dan perlu jeda antar-query.
