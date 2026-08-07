# Tutorial Impor FASIH → Aplikasi LK Anomali (manual, via CSV)

Alur ini **tidak menarik data otomatis** dari FASIH (server FASIH memblokir
request beruntun / "Bot Detected"). Kamu jalankan query di SQL Lab, **simpan
hasilnya ke file**, lalu paste ke tab staging di spreadsheet aplikasi. Aplikasi
yang merakit record + **menghitung ulang anomali sendiri** (bukan menyalin dari
SQL) saat impor.

Ringkas: **4 query → 4 CSV → 4 tab staging → 1 tombol impor.**

---

## 0. Sekali di awal — siapkan tab staging & samakan rule

Dari terminal (folder proyek), pastikan kode terbaru sudah ter-deploy
(`npm run push && npm run deploy`), lalu:

```bash
# Buat 4 tab staging kosong (header + format TEXT) di spreadsheet aplikasi
node scripts/sheet-admin.js setup-fasih

# Samakan U5/K6/K1 di tab Rules LIVE dengan hasil rekonsiliasi ke SQL
node scripts/sheet-admin.js reconcile-rules

# Tambah kolom sumber/assignment_id ke tab Records (aman diulang)
node scripts/sheet-admin.js setup
```

`setup-fasih` membuat 4 tab: **FASIH Usaha**, **FASIH Keluarga**,
**FASIH Roster AK**, **FASIH Roster Meteran** — semuanya diformat **TEXT** (WAJIB:
menjaga leading zero `kbli_akhir`/`kode_wilayah`). Header baris-1 sudah terisi;
**jangan diubah namanya** — harus persis sama dengan alias `SELECT` di query.

> Amankan dulu kalau tab Records sudah berisi data:
> `node scripts/sheet-admin.js backup-records`

---

## 1. Jalankan 4 query di SQL Lab & simpan hasilnya ke file

Buka [https://fasih-dashboard.bps.go.id/superset/sqllab/](https://fasih-dashboard.bps.go.id/superset/sqllab/) → DB **"Starrocks SE
2026"**. Jalankan **satu per satu** (beri jeda beberapa detik antar-query supaya
tidak kena "Bot Detected"):

| No | File query | Simpan hasil sebagai | Isi |
|----|------------|----------------------|-----|
| 1 | `sql/query_ekspor_fasih_usaha.sql` | `fasih_usaha.csv` | 1 baris / unit usaha ter-flag U1–U7 |
| 2 | `sql/query_ekspor_fasih_keluarga.sql` | `fasih_keluarga.csv` | 1 baris / keluarga ter-flag K2/K4/K5/K6/K7 presisi + K1/K3 proxy (lihat catatan) |
| 3 | `sql/query_ekspor_fasih_roster_ak.sql` | `fasih_roster_ak.csv` | 1 baris / anggota keluarga (assignment ter-flag) |
| 4 | `sql/query_ekspor_fasih_roster_meteran.sql` | `fasih_roster_meteran.csv` | 1 baris / meteran (assignment ter-flag) |

Cara menyimpan di SQL Lab: setelah hasil muncul, klik **"Download to CSV"**
(atau ikon unduh di panel Results). Simpan keempatnya di komputer dulu — inilah
"file" tempat kamu bisa memeriksa/menambah data manual sebelum masuk spreadsheet.

**Catatan soal cakupan K1/K3 di query keluarga.** K1 & K3 butuh data dari
`nested_dtsen`/`nested_dtsen_var`, tapi StarRocks planner GAGAL ("Invalid plan"
/ Issue 1002) begitu `root_table` dan `nested_dtsen*` muncul bersama dalam satu
statement — dicoba lewat `UNION ALL`, `JOIN`, `WHERE IN`, `EXISTS`, semuanya
gagal identik (bug/keterbatasan optimizer, diverifikasi 2026-08-07; assignment
id juga tidak bisa di-hardcode karena data FASIH terus bertambah). Solusinya:
query mengambil K1/K3 lewat **proxy longgar** `jumlah_ak >= 2` (cabang
`flag_k1k3_proxy` di file query) — superset dari assignment K1∪K3 yang
sesungguhnya, bukan filter presisi. Ini aman karena `DataAccess.importFasih`
menghitung ulang anomali tiap record via `RuleEvaluator` terhadap semua 16
rule (bukan menyalin flag SQL); assignment yang lolos proxy tapi ternyata
tidak kena K1/K3 tetap diimpor tanpa error — hasilnya cuma tidak ber-anomali
K1/K3 (atau tetap ber-anomali kalau kena rule lain). Konsekuensinya, cakupan
ekspor sedikit lebih luas dari "assignment yang ter-flag anomali" — beberapa
keluarga ≥2 anggota yang sebenarnya "bersih" ikut terimpor.

**Catatan penting lain saat menjalankan query:**

- Query hanya menyaring **assignment yang ter-flag anomali** (~puluhan ribu),
  bukan seluruh Buleleng — supaya ukuran wajar.
- Kalau query **roster_ak** menolak kolom `nama_dtsen`, ganti `d.nama_dtsen`
  → `v.nama_dtsen` atau hapus kolom itu (nama hanya untuk judul kartu, tidak
  memengaruhi anomali). Lihat komentar di file query.
- Kolom `kbli_akhir` (usaha) dan `kode_wilayah` bisa punya angka 0 di depan —
  jangan sampai hilang (lihat langkah 2).

---

## 2. Paste tiap CSV ke tab staging-nya

Untuk tiap file:

1. Buka spreadsheet aplikasi → tab staging yang sesuai (mis. `fasih_usaha.csv`
   → tab **FASIH Usaha**).
2. Klik sel **A2** (baris 2 — baris 1 sudah berisi header, biarkan).
3. **File → Import** (rekomendasi, paling aman untuk leading zero):
   - Upload CSV → **Import location: _Replace data at selected cell_** (A2)
   - **Separator type: _Comma_**
   - **Convert text to numbers/dates: _NO / Nonaktif_** ← WAJIB, supaya `kbli_akhir`
     & kode wilayah tetap teks (0 di depan selamat).
4. Pastikan **urutan kolom CSV = urutan header tab**. Query sudah menghasilkan
   kolom dengan nama & urutan yang sama — jangan menyusun ulang.

> Alternatif cepat (kalau yakin tidak ada leading zero bermasalah): copy dari
> CSV lalu **Paste special → Values only** di A2. Tapi **Import + convert=NO**
> lebih aman untuk kolom kode.

Boleh mengoreksi/menambah baris manual di tab staging sebelum impor — isinya
baru dibaca aplikasi saat langkah 3.

---

## 3. Jalankan impor

Dari terminal:

```bash
node scripts/sheet-admin.js import-fasih
```

Yang terjadi:

- Baca 4 tab staging → rakit record (`answers` + roster, konversi nilai, join
  wilayah `kode_wilayah` = `idsubsls` untuk mengisi 16 kolom wilayah + `pml_email`).
- **Hitung ulang anomali** tiap record dengan mesin rule aplikasi (`RuleEvaluator`).
- Tulis ke tab **Records** dengan `status = submitted`, `sumber = fasih`
  (bypass validasi wajib-isi). **Idempoten**: dijalankan ulang menimpa record
  FASIH yang sama (kunci `record_id` deterministik dari assignment), record
  **coretan** PML tidak tersentuh.

Output menampilkan:

```
imported            : <jumlah record>
stats               : {usaha, keluarga, rosterAkRows, rosterMeteranRows,
                        unmatchedWilayah, tanpaPml}
anomaliPerRule      : {U1: .., K5: .., ...}   ← hitungan versi APLIKASI
```

- `unmatchedWilayah` > 0 → ada `kode_wilayah` yang tak ada di tab
  `Alokasi Wilayah` (record tetap dibuat, tapi tanpa wilayah/PML — tak muncul
  di Lembar Kerja PML mana pun). Lengkapi Alokasi lalu impor ulang.
- Angka `anomaliPerRule` **wajar sedikit berbeda** dari hitungan SQL:
  **U9** (rasio NTB) hanya dihitung aplikasi (butuh tab referensi yang tak ada
  di FASIH) → aplikasi > SQL sebanyak temuan U9. Lihat `REKONSILIASI_RULE.md §3`.

---

## 4. Impor bertahap (opsional, kalau kena batas 6 menit Apps Script)

Kalau data terlalu besar sekali jalan:

- Tambahkan filter wilayah di **akhir** tiap query, mis. `AND i.kode_wilayah LIKE '510803%'` (per kecamatan), ekspor & impor per kecamatan.
- Impor bertahap **akumulatif**: chunk berikutnya tidak menghapus chunk
  sebelumnya (kunci `record_id` beda), dan record coretan tetap aman.
- Kosongkan tab staging sebelum paste chunk berikutnya (biar tidak dobel).

---

## 5. Verifikasi

- Login sebagai PML yang punya assignment ter-flag → **Lembar Kerja** memuat
  kartu ber-badge **FASIH**; filter **Sumber = FASIH** menyaringnya.
- Buka satu kartu FASIH → panel **detail read-only** + kotak catatan (bukan
  kuesioner; tanpa link FASIH).
- Bandingkan `anomaliPerRule` dengan `REKONSILIASI_RULE.md §1`.
