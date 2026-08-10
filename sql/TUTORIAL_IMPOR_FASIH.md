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
- **Kalau mau tahu jumlah baris PASTI tanpa terpotong limit** (mis. curiga
  hasil mentok di angka bulat seperti 5000): ganti sementara SELECT paling
  akhir jadi `SELECT COUNT(*) AS n_baris ...` (tetap pertahankan seluruh
  `WITH ... AS (...)` di atasnya, cukup ganti blok SELECT terakhir), jalankan,
  lalu kembalikan ke SELECT asli sebelum diekspor CSV sungguhan — `COUNT(*)`
  tidak kena limit tampilan baris.
- `query_ekspor_fasih_roster_ak.sql` & `roster_meteran.sql` sengaja TIDAK
  pakai `ORDER BY` (sempat memicu `Invalid plan` planner StarRocks bersama
  `TopNOperator`, sama seperti kasus di query keluarga) — urutan baris tidak
  memengaruhi hasil impor.

---

## 2. Masukkan tiap CSV ke tab staging-nya

### Cara A — otomatis lewat script (RECOMMENDED, lebih cepat & tanpa risiko leading zero)

`scripts/fasih-import-csv.js` membaca file CSV di komputer lalu mengirim
barisnya LANGSUNG ke tab staging lewat `google.script.run` (transport sama
dengan `sheet-admin.js`) — tidak menyentuh SQL Lab sama sekali, jadi AMAN
dari "Bot Detected" (yang diblokir cuma request BERUNTUN ke server FASIH,
bukan panggilan ke aplikasi sendiri). Tidak ada isu leading zero karena data
dikirim sebagai string, bukan lewat parser "convert numbers" Sheets.

```bash
node scripts/fasih-import-csv.js <usaha|keluarga|rosterAk|rosterMeteran> <file.csv>
```

Contoh satu grup kecamatan untuk keluarga:

```bash
node scripts/fasih-import-csv.js keluarga export/fasih_keluarga_grup1.csv
```

Default-nya: **menumpuk** (append) ke baris yang sudah ada di tab staging,
lalu otomatis menjalankan `import-fasih` di akhir. Opsi tambahan:

- `--clear` — kosongkan tab staging itu dulu SEBELUM menulis file ini (pakai
  kalau CSV ini menggantikan isi sebelumnya, bukan menumpuk).
- `--no-import` — hanya tulis ke staging, jangan langsung `import-fasih` di
  akhir (pakai kalau mau isi ke-4 tab staging dulu, baru impor sekali di
  akhir lewat `node scripts/sheet-admin.js import-fasih`).

Script mencocokkan kolom CSV berdasarkan NAMA header (bukan posisi), jadi
aman walau urutan kolom CSV sedikit berbeda dari header tab — tapi akan
berhenti dengan pesan error kalau ada kolom wajib yang hilang dari CSV.

### Cara B — manual lewat UI Google Sheets (fallback)

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

## 4. Ekspor per kecamatan (WAJIB kalau hasil query mentok di limit SQL Lab)

SQL Lab Superset punya batas jumlah baris — kalau hasil query selalu mentok
di angka bulat yang sama (mis. 5000) walau dropdown "LIMIT" (dekat tombol
Run) sudah dinaikkan, itu tandanya baris sebenarnya LEBIH BANYAK dari limit,
BUKAN jumlah asli. `root_table` tanpa filter kecamatan saja sudah 142.635
baris (Buleleng, `ada_keluarga_value IN ('1','2')`) — sangat mungkin
melebihi limit apa pun.

**TERVERIFIKASI (2026-08-08)**: batas sebenarnya adalah **hard-cap di sisi
server Superset, ±9000 baris, TIDAK BERUBAH walau dropdown LIMIT dinaikkan**
(dites langsung: kecamatan 010 & 020 tetap mentok di 9000 meski limit
dropdown dinaikkan ke maksimum; kecamatan 030 beres di 8801 baris — non-bulat,
jadi kemungkinan besar sudah lengkap). Kesimpulan praktis: **kalau hasil satu
potongan (kecamatan/desa) persis 9000 atau angka bulat lain, itu MASIH
terpotong** — potongan itu perlu dipecah lebih kecil lagi (lihat di bawah).
Kalau hasilnya bukan angka bulat, itu sudah lengkap.

**Kenapa TIDAK diotomasi lewat script/browser automation**: server FASIH
memblokir request otomatis yang beruntun ("Bot Detected", lihat pengalaman
sebelumnya di sesi impor ini) — jalankan query & download CSV WAJIB manual di
browser SQL Lab. Tapi jumlah *putaran* manualnya bisa ditekan dengan
menggabungkan beberapa wilayah kecil ke dalam satu query, selama totalnya
tetap di bawah 9000.

**SKEMA KODE WILAYAH FASIH (WAJIB dipahami sebelum lanjut, TERVERIFIKASI
2026-08-08)**: `kode_wilayah` SELALU 16 digit, format `idsubsls` BPS
(`kdprov`2+`kdkab`2+`kdkec`**3**+`kddesa`3+`kdsls`4+`kdsubsls`2 — kecamatan
`kdkec` itu **3 digit**, bukan 2). Prefix per level yang WAJIB dipakai di
`SUBSTR(kode_wilayah, 1, N)`:

| Level     | N (digit) | Contoh        |
|-----------|-----------|----------------|
| kecamatan | 7         | `5108010`      |
| desa      | 10        | `5108010001`   |
| SLS       | 14        | `51080100010001` |
| Sub-SLS   | 16 (penuh)| kode utuh      |

**Kecamatan (7 digit) TERBUKTI TIDAK CUKUP** — sudah dites (2026-08-08):
SEMUA 9 kecamatan Buleleng, sendiri-sendiri tanpa digabung apa pun, sudah di
atas 8000 baris (estimasi proxy). Jadi jangan buang waktu mencoba
menggabungkan kecamatan — langsung mulai dari level **desa** (10 digit).

### Langkah A — peta jumlah baris per desa (SUDAH dijalankan 2026-08-08)

Query 2 di `sql/query_hitung_baris_per_kecamatan.sql` (BUKAN file ekspor,
cuma `GROUP BY` bantu) sudah dijalankan — hasilnya 148 desa / 9 kecamatan,
tidak ada satupun desa sendirian yang >9000 (maksimum ~3019 mentah / 2619
proxy), jadi TIDAK perlu turun ke level SLS (Query 2c tidak diperlukan).

### Langkah B — pengelompokan (SUDAH disusun, siap pakai)

`sql/pengelompokan_desa_keluarga.md` berisi **21 grup siap pakai** (bin-packing
per kecamatan, target ≤8000 proxy/grup) — tinggal salin daftar `IN (...)` satu
grup ke filter di Langkah C, tidak perlu menyusun ulang manual. Kalau nanti
data FASIH berubah signifikan (assignment baru banyak) dan grup ini jadi tidak
akurat lagi, jalankan ulang Query 2 & susun ulang (bisa minta bantuan re-generate
pengelompokannya).

### Langkah C — jalankan per grup

Keempat file query sudah punya baris filter yang tinggal di-uncomment (cari
komentar `-- AND ... IN (...)` / `-- WHERE ... IN (...)` di tiap file,
lokasinya di CTE `kel`/`idn`, dekat awal query):

```sql
-- AND SUBSTR(COALESCE(rt.level_6_full_code, rt.level_5_full_code, rt.level_4_full_code), 1, 10) IN ('5108010001','5108020001')
```

Isi daftar `IN (...)` dengan kode-kode desa (10 digit) satu grup (dari
Langkah B). Untuk tiap grup:

1. Uncomment baris filter di ke-4 file, isi daftar kode desa grup ini.
2. Jalankan. **Cek jumlah baris hasilnya**: kalau persis 9000 (atau angka
   bulat lain), grup itu MASIH terpotong hard-cap server — kecilkan grupnya
   (pindah 1-2 desa ke grup lain) dan jalankan ulang. Kalau bukan angka
   bulat, lanjut normal ke langkah 3.
3. Download CSV.
4. Masukkan ke staging + impor — **Cara A (script, lihat §2)**:
   ```bash
   node scripts/fasih-import-csv.js keluarga export/fasih_keluarga_grup1.csv
   ```
   Default-nya **menumpuk** (append) ke grup sebelumnya di tab staging yang
   sama, lalu langsung `import-fasih` di akhir — jadi untuk grup kedua dst
   TIDAK perlu `--clear` (biarkan menumpuk) kecuali memang mau isi ulang dari
   nol. Kunci `record_id` deterministik per assignment membuat proses ini
   idempoten — grup yang tumpang tindih atau diimpor ulang tidak bikin
   duplikat, record coretan PML tidak tersentuh.

### Untuk `usaha`: SAMA — level desa, pengelompokan sudah disusun

**TERVERIFIKASI (2026-08-08)**: 8 dari 9 kecamatan usaha juga di atas 9000
unit (angka kasar, sebelum filter U1-U7) — level kecamatan (7 digit) TIDAK
cukup, sama seperti keluarga. Pengelompokan level desa (10 digit) sudah
disusun & disimpan di **`sql/pengelompokan_desa_usaha.md`** (21 grup) — tinggal
salin `IN (...)` per grup ke filter yang sudah di-uncomment di
`query_ekspor_fasih_usaha.sql`, jalankan, lalu:
```bash
node scripts/fasih-import-csv.js usaha export/fasih_usaha_grup1.csv
```
Alur sama seperti Langkah C di atas (cek angka bulat = masih terpotong,
append menumpuk antar grup, idempoten).

**Catatan cakupan K1/K3 (query keluarga & roster)**: cabang proxy K1/K3
(`flag_k1k3_proxy` di query keluarga; `ak_12`/`ak_agg` baris ke-2 di kedua
query roster) TIDAK ikut tersaring filter wilayah apa pun — sudah dijelaskan
di komentar masing-masing file (StarRocks planner gagal kalau `root_table` &
`nested_dtsen*` digabung lewat construct apa pun, jadi filter wilayah yang
sumbernya dari `root_table` tidak bisa dioper ke cabang yang sumbernya
`nested_dtsen*`). Konsekuensinya: baris K1/K3 tetap mencakup SEMUA Buleleng
di tiap jalan (bukan per-grup) — aman diimpor berkali-kali (idempoten), tapi
jangan kaget kalau `fasih_keluarga.csv`/`fasih_roster_ak.csv` tidak mengecil
signifikan hanya dari filter wilayah saja.

---

## 5. Verifikasi

- Login sebagai PML yang punya assignment ter-flag → **Lembar Kerja** memuat
  kartu ber-badge **FASIH**; filter **Sumber = FASIH** menyaringnya.
- Buka satu kartu FASIH → panel **detail read-only** + kotak catatan (bukan
  kuesioner; tanpa link FASIH).
- Bandingkan `anomaliPerRule` dengan `REKONSILIASI_RULE.md §1`.
