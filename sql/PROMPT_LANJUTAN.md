Lanjutkan proyek LK Anomali SE2026 (Google Apps Script + clasp).

Baca dulu `CLAUDE.md`, lalu 3 file di `sql/`:
- `REKONSILIASI_RULE.md` — beda rule aplikasi vs SQL, peta alias FASIH→aplikasi (§5), hal yang belum terverifikasi (§6)
- `PEMETAAN_ANOMALI_FASIH.md` — skema database FASIH di Superset
- `anomali_se2026_gabungan.sql` — query deteksi anomali, sudah teruji

Semua keputusan desain sudah final di file-file itu. Jangan tanya ulang, jangan ubah SQL yang sudah ada.

Kerjakan berurutan. Logic murni ditulis tanpa dependency SpreadsheetApp dan di-unit-test Node dulu sebelum deploy.

## 1. Samakan rule aplikasi dengan SQL (REKONSILIASI_RULE.md §2)
- Tab `Rules` U5: ambang `10000000` → `10000000000`
- Tab `Rules` K6: `any` → `all`, 4 syarat (§2.2)
- `ComputedFields.js` fungsi `k1PasutriTidakKawin`: tambah cabang (b) — AK-1 Kepala Keluarga & berstatus kawin tapi AK-2 BUKAN Istri/Suami → 1. Tidak ada AK-2 → tetap 0.
- Tab `Rules` K1 → `{"field":"k1_pasutri_tidak_kawin","op":"==","value":1}`
- Ubah tab `Rules` lewat script (`scripts/sheet-admin.js` atau fungsi setup), jangan manual.

## 2. Perluas skema `Records`
Tambah 2 kolom di akhir `RECORD_HEADERS` (`SheetDb.js`) + `Setup.js`: `sumber` (`coretan`|`fasih`) dan `assignment_id`. Record lama tanpa kolom itu harus tetap terbaca — `sumber` kosong dianggap `coretan`.

## 3. Impor FASIH → `Records`
Belum ada query ekspornya — turunkan sendiri dari peta alias REKONSILIASI_RULE.md §5, hasilkan 4 CSV yang di-paste admin ke tab staging: `FASIH Usaha`, `FASIH Keluarga`, `FASIH Roster AK`, `FASIH Roster Meteran`. Cakupan: hanya assignment yang ter-flag anomali (~29rb se-Buleleng).

Buat `FasihImport.js` (logic murni, unit-test Node):
- rakit `answers` + `answers.roster` dari baris staging pakai peta §5
- konversi string kategorik FASIH (`'1'`, `'13'`) → number; jaga `r13g` tetap TEXT (leading zero)
- parse `nilai_pend_pekerjaan` format `"Rp 5.000.000"` → `5000000`
- `b3r18b_n` dan `b3r18c_n` = 0 (§6 poin 1)
- wilayah: `kode_wilayah` 16 digit == `idsubsls`; join ke `Alokasi Wilayah` untuk mengisi 16 kolom snapshot wilayah

Lalu `DataAccess.importFasih(adminPassword)` — privileged, cek password tiap panggilan:
baca staging → rakit record → hitung `anomalies` via `RuleEvaluator` (**bukan** disalin dari SQL) → upsert ke `Records` berdasarkan `assignment_id`, dengan `status='submitted'`, `sumber='fasih'`, bypass validasi required.

## 4. `readRecords` per PML + UI Lembar Kerja
- `SheetDb.readRecords` jangan baca seluruh tab (bisa ~29rb baris) — filter per `pml_email` di level baca supaya tidak kena batas 6 menit Apps Script.
- `DashboardView.html`: badge sumber di kartu, filter **Sumber** (Semua/Coretan/FASIH) dan filter **status assignment**.
- Record `sumber='fasih'` dibuka ke panel detail read-only + kotak catatan, **bukan** kuesioner. **Jangan** tampilkan link FASIH.

## Acceptance
`npm test` hijau → `clasp push` + `npm run deploy` → verifikasi Playwright ke URL `/exec`.
Laporkan jumlah anomali per kode hasil `RuleEvaluator` dan bandingkan dengan angka di REKONSILIASI_RULE.md §1 (U9 wajar lebih banyak di aplikasi — lihat §3).
