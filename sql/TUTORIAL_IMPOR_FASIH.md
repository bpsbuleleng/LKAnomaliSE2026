# Tutorial Impor FASIH → Aplikasi LK Anomali (manual, via CSV)

Alur ini **tidak menarik data otomatis dari FASIH tanpa jeda** (server FASIH
memblokir request beruntun CEPAT / "Bot Detected" — terbukti terjadi kalau
tidak ada jeda; sejauh diketahui pemblokiran ini pulih sendiri setelah
menunggu beberapa saat, BUKAN blokir akun permanen). Kamu jalankan query di
SQL Lab (manual ATAU via `scripts/fasih-sqllab-export.js`, lihat §1b),
**simpan hasilnya ke file**, lalu masukkan ke tab staging di spreadsheet
aplikasi. Aplikasi yang merakit record + **menghitung ulang anomali sendiri**
(bukan menyalin dari SQL) saat impor.

Ringkas: **4 query → banyak CSV (lihat §4, dipecah per grup wilayah) → 4 tab
staging → 1 tombol impor.**

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

## 1. Jalankan query di SQL Lab & simpan hasilnya ke file

> **PENTING**: tabel di bawah ini menggambarkan versi PALING AWAL (1 query =
> 1 file, TANPA filter wilayah) — sudah TIDAK BERLAKU untuk data Buleleng
> yang sebenarnya (>9000 baris per query, kena hard-cap server). **Untuk cara
> menjalankan yang BENAR & TERKINI (per grup wilayah + pemisahan K1/K3),
> lompat ke §4.** Bagian ini disisakan sebagai gambaran umum isi tiap query
> saja (6 file sekarang, bukan 4 — lihat §4 poin 1-4).

Buka [https://fasih-dashboard.bps.go.id/superset/sqllab/](https://fasih-dashboard.bps.go.id/superset/sqllab/) → DB **"Starrocks SE
2026"**. Jalankan **satu per satu** (beri jeda beberapa detik antar-query supaya
tidak kena "Bot Detected"):

| No | File query | Simpan hasil sebagai | Isi |
|----|------------|----------------------|-----|
| 1 | `sql/query_ekspor_fasih_usaha.sql` | `fasih_usaha.csv` | 1 baris / unit usaha ter-flag U1–U7 |
| 2 | `sql/query_ekspor_fasih_keluarga.sql` | `fasih_keluarga.csv` | 1 baris / keluarga ter-flag K2/K4/K5/K6/K7 presisi + K1/K3 proxy (lihat catatan) |
| 3 | `sql/query_ekspor_fasih_roster_ak.sql` | `fasih_roster_ak.csv` | 1 baris / anggota keluarga ter-flag K2/K4/K5/K6/K7 (K1/K3 di file terpisah, lihat §4) |
| 4 | `sql/query_ekspor_fasih_roster_meteran.sql` | `fasih_roster_meteran.csv` | 1 baris / meteran ter-flag K2/K4/K5/K6/K7 (K1/K3 di file terpisah, lihat §4) |
| 5 | `sql/query_ekspor_fasih_roster_ak_k1k3.sql` | `rosterAk_k1k3_p0.csv`/`_p1.csv` | 1 baris / anggota keluarga ter-flag K1 atau K3 (2x jalan, TANPA filter wilayah) |
| 6 | `sql/query_ekspor_fasih_roster_meteran_k1k3.sql` | `rosterMeteran_k1k3_p0.csv`/`_p1.csv` | 1 baris / meteran ter-flag K1 atau K3 (2x jalan, TANPA filter wilayah) |

Cara menyimpan di SQL Lab: setelah hasil muncul, klik **"Download to CSV"**
(atau ikon unduh di panel Results). Simpan hasilnya di komputer dulu — inilah
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
- **Window function juga memicu bug planner yang SAMA** (TERVERIFIKASI
  2026-08-08): `ROW_NUMBER() OVER (PARTITION BY ... ORDER BY ...)` yang
  dipakai kedua file itu untuk cari posisi AK-1/AK-2 (dipakai rule K1)
  menghasilkan error `Invalid plan`/`PhysicalTopNOperator` identik dengan
  `ORDER BY` biasa — `ORDER BY` DI DALAM window function tetap memicu bug
  yang sama walau tidak ada `ORDER BY` eksplisit di akhir SELECT. Sudah
  diganti dengan agregasi `MIN(index1)` + JOIN balik (tanpa window function
  sama sekali) — kalau nanti perlu menulis query serupa, hindari `OVER (...)`
  apa pun yang menyentuh kombinasi `root_table`+`nested_dtsen*`.

---

## 1b. Opsi otomasi — `scripts/fasih-sqllab-export.js` (Playwright, browser terpisah)

Karena §4 mengharuskan **84 kali jalan query** (21 grup wilayah × 4 file),
tersedia script Playwright yang menjalankan semuanya berurutan dengan jeda
30-60 detik acak antar-query, lalu men-download tiap hasil sebagai CSV.

**Login & VPN tetap 100% kamu pegang manual** — script membuka jendela
browser Playwright (Chromium bawaan, headed). **Konfigurasi browser meniru
proyek referensi `scrape_fasih`** (Playwright Python, dipakai untuk scraping
`fasih-sm.bps.go.id` — aplikasi BPS lain, TERBUKTI berhasil lolos deteksi
bot): Chromium biasa + `slowMo: 50` (jeda 50ms tiap aksi), TANPA override
fingerprint apa pun. **Riwayat percobaan sebelumnya**: sempat dicoba
`channel:'chrome'` (Chrome asli) + patch `navigator.webdriver` — TETAP
terdeteksi, jadi dibuang, kembali ke pola paling sederhana yang justru
terbukti jalan di proyek referensi itu. Catatan jujur: `scrape_fasih`
menyasar domain BPS yang BEDA (`fasih-sm` vs `fasih-dashboard`/SQL Lab di
sini) — pola ini dugaan terbaik berdasarkan bukti nyata, BUKAN jaminan mutlak
akan berhasil juga di SQL Lab.

Browser dibuka ke **halaman login FASIH dulu** (bukan langsung ke SQL Lab)
supaya urutan navigasinya wajar. Script berhenti sejenak dan menunggu kamu
tekan Enter di terminal setelah kamu login + aktifkan VPN + navigasi sendiri
ke SQL Lab. Setelah itu baru script mengambil alih menjalankan 84 query
secara otomatis.

```bash
node scripts/fasih-sqllab-export.js
```

- Progres tersimpan ke `scripts/fasih-sqllab-export.progress.json` — kalau
  proses terhenti (ditutup paksa, error, Ctrl+C), jalankan ulang PERINTAH
  YANG SAMA dan otomatis lanjut dari job yang belum selesai, tidak mengulang
  84 dari awal.
- Kalau server menampilkan pesan yang mengandung "Bot Detected", script
  **berhenti total otomatis** (tidak retry sendiri) dan progres tetap
  tersimpan sampai job sebelumnya — tunggu beberapa saat, lalu jalankan ulang
  perintah yang sama untuk lanjut.
- Untuk uji coba 1-2 job dulu sebelum menjalankan semua 84 (disarankan,
  supaya tahu selector-nya cocok dengan tampilan SQL Lab BPS sebelum jalan
  penuh): `node scripts/fasih-sqllab-export.js --only=keluarga_01`
- **PENTING**: selector elemen (editor SQL, tombol Run, tombol Download CSV)
  di dalam script ditulis mengikuti pola umum Superset open-source —
  instalasi BPS BISA berbeda. Kalau script berhenti dengan pesan "Elemen
  tidak ditemukan", buka konstanta `SELECTORS` di bagian atas
  `scripts/fasih-sqllab-export.js`, inspect elemen yang dimaksud di browser
  (klik kanan → Inspect), sesuaikan nilainya. **Belum pernah dites end-to-end
  terhadap tampilan SQL Lab BPS sungguhan** — kemungkinan perlu 1-2 kali
  penyesuaian selector di percobaan pertama. `LOGIN_URL` (dekat awal file)
  juga baru tebakan pola umum, cek/sesuaikan ke URL login FASIH sesungguhnya.
- Kalau Chrome belum terpasang, script berhenti dengan pesan jelas
  (bukan error Playwright yang membingungkan) — pasang dari
  google.com/chrome dulu.
- CSV tersimpan ke folder `export/` dengan nama `<query>_<nomor>.csv` (mis.
  `keluarga_01.csv`) — otomatis dibaca `scripts/fasih-import-all.js` di §4b.
- Kalau lebih suka jalankan manual satu-satu (tanpa script sama sekali), atau
  mendelegasikan ke Claude Cowork alih-alih menjalankan sendiri, dua-duanya
  tetap didukung — lihat `sql/PROMPT_COWORK_EKSPOR.md` (berisi 4 query
  lengkap siap-salin + 42 daftar kode wilayah, format prompt siap tempel ke
  Claude Cowork; aturan jeda yang sama juga berlaku di sana).

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

### PENTING — kenapa pengelompokan `keluarga` SAJA tidak cukup untuk roster, dan solusi finalnya (TEMUAN 2026-08-08/10)

`sql/pengelompokan_desa_keluarga.md` disusun dari estimasi jumlah **assignment**
(`n_estimasi_flagged_atas_proxy`) per desa — cocok untuk memprediksi jumlah baris
query `keluarga` (1 baris = 1 assignment). **TIDAK cocok** untuk memprediksi
jumlah baris query `roster_ak`/`roster_meteran`, karena kedua query itu
mengeluarkan **1 baris per anggota/meteran**, bukan 1 baris per assignment.

**Bukti nyata #1** (2026-08-08): grup 07 cuma berisi 1 desa dengan total
keluarga ter-flag 441 (jauh di bawah 8000), tapi hasil `roster_ak`/
`roster_meteran` untuk grup itu tetap **persis 9000 baris**.

**Bukti nyata #2 & AKAR MASALAH SESUNGGUHNYA** (2026-08-10): diselidiki lebih
jauh, ternyata penyebab utamanya BUKAN filter wilayah yang kurang kecil —
cabang K1/K3 (`ak_12`/`ak_agg` baris ke-2 di `flagged`) **TIDAK PERNAH
tersaring filter wilayah sama sekali** (dijelaskan di komentar file query:
join `root_table`+`nested_dtsen*` untuk menyaringnya = Issue 1002 lagi). Jadi
cabang ini SELALU mengembalikan **SELURUH Buleleng** di setiap jalan, berapa
pun kecilnya filter desa yang dipasang di `kel`. Baseline K1∪K3 (tanpa filter
apa pun) diukur = **13.024 baris anggota** — di atas cap 9000 dengan
sendirinya, TERLEPAS dari pemecahan wilayah apa pun. Ini kenapa memecah
wilayah lebih kecil lagi (sampai level SLS) TIDAK PERNAH bisa menyelesaikan
masalah roster: bagian K1/K3-nya tetap 13.024 di setiap jalan.

**REVISI 2026-08-11 — solusi "SILANG PENUH" (21 grup × 2 partisi digabung
dalam SATU file) di atas TERBUKTI SALAH DESAIN, jangan dipakai:** karena
cabang K1/K3 TIDAK PERNAH tersaring filter wilayah, menjalankan file gabungan
itu 21 kali (sekali per grup) berarti partisi K1/K3 yang SAMA PERSIS
ter-*append* ULANG ke tab staging di SETIAP dari 21 grup — bukan 42 baris
data unik, tapi ~21× lipat ganda dari partisi K1/K3 itu sendiri. Akibatnya
tab staging `FASIH Roster AK` membengkak ke **229.782 baris** (dari
ekspektasi wajar puluhan ribu) dan workbook Google Sheets nyaris kena limit
**10 juta sel** (9.972.724/10.000.000 saat ditemukan, 2026-08-11). Staging
sudah dibersihkan (`node scripts/sheet-admin.js shrink-fasih rosterAk` dst,
lihat bagian "Diagnostik ukuran sel" di bawah).

**SOLUSI FINAL (2026-08-11) — pisahkan K1/K3 jadi file SENDIRI, dijalankan
HANYA 2× TOTAL, TIDAK di-loop per grup wilayah:**

`query_ekspor_fasih_roster_ak.sql` & `roster_meteran.sql` SEKARANG hanya
berisi cabang K2/K4/K5/K6/K7 (semuanya bisa difilter wilayah lewat `kel`) —
**AMAN dijalankan 21× (1x per grup, TANPA partisi tambahan)**, sama seperti
`keluarga`/`usaha`. Cabang K1/K3 dipindah ke 2 file BARU:
`query_ekspor_fasih_roster_ak_k1k3.sql` dan
`query_ekspor_fasih_roster_meteran_k1k3.sql` — file ini **TIDAK PUNYA filter
wilayah sama sekali** (memang tidak relevan untuk K1/K3) dan **HANYA
dijalankan 2 KALI TOTAL**: sekali dengan kedua baris
`ABS(MOD(MURMUR_HASH3_32(...), 2)) = 0`, sekali lagi dengan `= 1`. Hasilnya
di-append ke tab staging YANG SAMA (`FASIH Roster AK`/`FASIH Roster Meteran`)
dengan nama file `rosterAk_k1k3_p0.csv`/`_p1.csv` (dan padanannya untuk
meteran) — TIDAK diulang per grup wilayah.

`MURMUR_HASH3_32` = fungsi hash biasa StarRocks (bukan window function/
`ORDER BY`), aman dari Issue 1002 karena kedua file k1k3 cuma menyentuh
`nested_dtsen`/`nested_dtsen_var`, tidak ada `root_table`. **`ABS()` WAJIB**
(bukan estetika) — di StarRocks, `MOD` mempertahankan tanda dari argumen
pertama, dan `MURMUR_HASH3_32` bisa mengembalikan nilai negatif, jadi tanpa
`ABS()` sisa `-1` tidak akan match `=0` MAUPUN `=1` dan baris itu hilang dari
kedua partisi. **TERVERIFIKASI 2026-08-11**: partisi 0 = 6.290 baris anggota,
partisi 1 = 6.851 baris anggota, total 13.141 (dekat estimasi 13.024,
seimbang, jauh di bawah cap 9000) — lihat `sql/query_cek_hash_function.sql`
untuk query verifikasinya (boleh dijalankan ulang kapan saja untuk
double-check, tidak wajib mengulang tiap sesi karena sudah terverifikasi).

**Cara menjalankan roster_ak & roster_meteran mulai sekarang (SKEMA FINAL):**

1. `query_ekspor_fasih_roster_ak.sql` (K2/K4/K5/K6/K7): jalankan 21× — 1x per
   grup desa di `pengelompokan_desa_keluarga.md`, filter di CTE `kel`, TANPA
   partisi. Sama seperti `query_ekspor_fasih_keluarga.sql`.
2. `query_ekspor_fasih_roster_meteran.sql` (K2/K4/K5/K6/K7): sama, 21×.
3. `query_ekspor_fasih_roster_ak_k1k3.sql` (K1/K3): jalankan TEPAT 2× TOTAL
   (partisi 0, lalu partisi 1) — TIDAK ADA loop wilayah untuk file ini.
4. `query_ekspor_fasih_roster_meteran_k1k3.sql` (K1/K3): sama, TEPAT 2× TOTAL.
5. **Total jalan roster: 21+21+2+2 = 46** (bukan 84 seperti rencana silang
   lama, dan bukan 42 seperti rencana sebelum itu — 46 adalah desain yang
   BENAR, sudah tidak ada duplikasi).
6. Beri nama file CSV yang jelas: `rosterAk_01.csv` ... `rosterAk_21.csv` (dari
   file grup), `rosterAk_k1k3_p0.csv`/`rosterAk_k1k3_p1.csv` (dari file k1k3);
   padanan yang sama untuk `rosterMeteran`. `fasih-import-csv.js`/
   `fasih-import-all.js` menumpuk (append) & idempoten, jadi aman memasukkan
   semua 46 file secara berurutan tanpa peduli urutan.
7. Query `keluarga` & `usaha` TIDAK terkena masalah ini sama sekali —
   `keluarga` sudah SELESAI dijalankan (131.768 baris valid di staging,
   2026-08-11), `usaha` juga SELESAI (7.571 baris). JANGAN diulang.

### BUG LANJUTAN ditemukan pasca-impor (2026-08-17) — gap proxy K1/K3 di roster

Setelah 46 jalan roster di atas dijalankan & 139.337 record diimpor
(2026-08-13/14), `anomali-summary` menunjukkan **K5 melonjak ke 121.444**
(ekspektasi ~7.570) dan **K2 ke 1.221** (ekspektasi ~3) — jauh di luar variasi
wajar. Akar masalah: `query_ekspor_fasih_keluarga.sql` punya cabang
`flag_k1k3_proxy` (`root_table WHERE jumlah_ak >= 2`, PROXY LONGGAR) yang
memasukkan assignment ke staging **keluarga**. Tapi skema roster final (poin
1-4 di atas) TIDAK punya padanan proxy ini — `roster_ak.sql` cuma K2/K4/K5/K6/K7,
`roster_ak_k1k3.sql` cuma K1/K3 PRESISI (bukan proxy). Assignment yang match
`jumlah_ak>=2` tapi TIDAK match K1/K3 presisi ATAU K2/K4/K5/K6/K7 apa pun
**tidak pernah** diekspor ke roster manapun — rosternya kosong di staging,
`b1r9`/`b3r18c` (computed dari `SUM` roster) jadi **0 secara eksplisit**
(bukan hilang/undefined), yang memicu K5 (`b3r18c < b4r16`) secara PALSU
untuk hampir semua assignment yang kena gap ini.

**Perbaikan**: 2 file BARU `query_ekspor_fasih_roster_ak_gap_proxy.sql` &
`query_ekspor_fasih_roster_meteran_gap_proxy.sql` — mengekspor SEMUA anggota
dari assignment `jumlah_ak>=2` (mirror persis kondisi `flag_k1k3_proxy`),
filter wilayah 21× seperti roster_ak.sql biasa (kondisi ini sumbernya
`root_table`, bisa difilter, beda dari K1/K3 presisi). File ini **BOLEH
OVERLAP** dengan roster_ak.sql & roster_ak_k1k3.sql yang sudah diekspor
(assignment yang sama bisa match keduanya) — **WAJIB** `FasihImport.groupRoster`
versi TERBARU (deploy v54, 2026-08-17) yang sudah DEDUP by
`(assignment_id, index1)` sebelum menjalankan file ini; versi lama TIDAK
dedup dan akan menggandakan anggota kalau ada overlap.

**Cara jalankan**: 21× (1x per grup wilayah, kode desa SAMA dengan
`pengelompokan_desa_keluarga.md`), simpan `rosterAk_gap_01.csv` ...
`_21.csv` & `rosterMeteran_gap_01.csv` ... `_21.csv`, append ke tab staging
YANG SAMA (`FASIH Roster AK`/`FASIH Roster Meteran`) via
`fasih-import-csv.js`/`fasih-import-all.js` seperti biasa, lalu jalankan
`import-fasih` LAGI — `bulkUpsertRecords` menimpa record dengan `record_id`
sama (idempoten), jadi 139.337 record yang sudah salah otomatis diperbaiki
tanpa perlu hapus manual dulu.

**Diagnostik ukuran sel (kalau curiga staging membengkak lagi)**:
`node scripts/sheet-admin.js sheet-sizes` melaporkan `maxRows`/`cellsAllocated`
tiap tab (termasuk workbook `totalCells`, limit Google Sheets = 10 juta).
`node scripts/sheet-admin.js shrink-fasih <usaha|keluarga|rosterAk|rosterMeteran>`
memangkas kapasitas grid tab staging itu kembali pas ke data terisi + buffer
kecil TANPA menghapus data (beda dari `adminClearFasihStagingTab` yang
menghapus data) — pakai kalau `maxRows` jauh lebih besar dari `lastRow`.

---

## 4b. Impor semua CSV sekaligus — `scripts/fasih-import-all.js`

Setelah folder `export/` terisi (baik dari §1b otomatis, dari
`sql/PROMPT_COWORK_EKSPOR.md`, atau didownload manual satu-satu dengan nama
mengikuti pola `<stagingKey>_<nomor>.csv`, mis. `keluarga_01.csv`,
`usaha_15.csv`), jalankan SATU perintah untuk memasukkan semuanya ke staging
+ impor sekali di akhir:

```bash
node scripts/fasih-import-all.js
```

Berbeda dari §1b (yang WAJIB berjeda karena menyentuh server FASIH), script
ini **AMAN diotomasi penuh tanpa jeda** — hanya memanggil aplikasi sendiri
lewat `google.script.run`, sama sekali tidak menyentuh FASIH. Prosesnya:
tumpuk semua file per `stagingKey` ke tab staging masing-masing (pakai
`--no-import` di tiap panggilan supaya tidak memicu recompute anomali 84 kali
berturut-turut), lalu SATU kali `import-fasih` di paling akhir.

Kalau CSV ada di folder lain (mis. hasil unduhan manual disimpan terpisah):
`node scripts/fasih-import-all.js --dir=export/nama_folder_lain`.

---

## 5. Verifikasi

- Login sebagai PML yang punya assignment ter-flag → **Lembar Kerja** memuat
  kartu ber-badge **FASIH**; filter **Sumber = FASIH** menyaringnya.
- Buka satu kartu FASIH → panel **detail read-only** + kotak catatan (bukan
  kuesioner; tanpa link FASIH).
- Bandingkan `anomaliPerRule` dengan `REKONSILIASI_RULE.md §1`.
