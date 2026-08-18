# Checklist ekspor FASIH — 42 putaran manual

Centang `[x]` tiap kali satu langkah (satu file, satu grup) sudah dikerjakan
sampai `node scripts/fasih-import-csv.js` selesai OK. Kalau sesi terputus di
tengah jalan, file ini menunjukkan persis sudah sampai mana — tidak perlu
mengingat-ingat atau menebak ulang.

**Kenapa manual (bukan bot)**: server FASIH memblokir request otomatis
beruntun ("Bot Detected", sudah terbukti di sesi pembuatan alur ini) — kerjakan
satu per satu, boleh berjeda antar putaran.

**Urutan per grup** (ringkas — detail lengkap di TUTORIAL_IMPOR_FASIH.md §2/§4):
1. Buka file query di kolom "File", uncomment baris filter, isi `IN (...)`
   dari kolom "Kode desa" di bawah.
2. Jalankan di SQL Lab. Kalau hasilnya persis angka bulat (mis. 9000) → grup
   masih terpotong, kecilkan (pindah 1-2 desa) & jalankan ulang.
3. Download CSV.
4. `node scripts/fasih-import-csv.js <key> <file.csv>` (key: `keluarga` /
   `usaha` / `rosterAk` / `rosterMeteran`).
5. Centang baris ini.

---

## Keluarga + Roster AK + Roster Meteran (sql/pengelompokan_desa_keluarga.md)

Satu grup wilayah = 3 file terpisah dijalankan (kode desa SAMA untuk
ketiganya, hanya file query & staging key beda).

| # | Kecamatan | Grup | Kode desa | keluarga | rosterAk | rosterMeteran |
|---|-----------|------|-----------|:---:|:---:|:---:|
| 1 | 5108010 | 1 | `'5108010001','5108010002','5108010003','5108010004','5108010005'` | [ ] | [ ] | [ ] |
| 2 | 5108010 | 2 | `'5108010006','5108010007','5108010008','5108010009','5108010010'` | [ ] | [ ] | [ ] |
| 3 | 5108010 | 3 | `'5108010011','5108010012','5108010013','5108010014'` | [ ] | [ ] | [ ] |
| 4 | 5108020 | 1 | `'5108020001'..'5108020015'` (15 desa, lihat file sumber) | [ ] | [ ] | [ ] |
| 5 | 5108020 | 2 | `'5108020016','5108020017','5108020018','5108020019','5108020020','5108020021'` | [ ] | [ ] | [ ] |
| 6 | 5108030 | 1 | `'5108030001'..'5108030014'` (14 desa, lihat file sumber) | [ ] | [ ] | [ ] |
| 7 | 5108030 | 2 | `'5108030015'` | [ ] | [ ] | [ ] |
| 8 | 5108040 | 1 | `'5108040001'..'5108040010'` (10 desa, lihat file sumber) | [ ] | [ ] | [ ] |
| 9 | 5108040 | 2 | `'5108040011','5108040012','5108040013','5108040014','5108040015','5108040016','5108040017'` | [ ] | [ ] | [ ] |
| 10 | 5108050 | 1 | `'5108050001'..'5108050008'` (8 desa, lihat file sumber) | [ ] | [ ] | [ ] |
| 11 | 5108050 | 2 | `'5108050009','5108050010','5108050011','5108050012','5108050013'` | [ ] | [ ] | [ ] |
| 12 | 5108050 | 3 | `'5108050014','5108050015'` | [ ] | [ ] | [ ] |
| 13 | 5108060 | 1 | `'5108060001'..'5108060016'` (16 desa, lihat file sumber) | [ ] | [ ] | [ ] |
| 14 | 5108060 | 2 | `'5108060017'..'5108060024'` (8 desa, lihat file sumber) | [ ] | [ ] | [ ] |
| 15 | 5108060 | 3 | `'5108060025','5108060026','5108060027','5108060028','5108060029'` | [ ] | [ ] | [ ] |
| 16 | 5108070 | 1 | `'5108070001'..'5108070011'` (11 desa, lihat file sumber) | [ ] | [ ] | [ ] |
| 17 | 5108070 | 2 | `'5108070012','5108070013','5108070014'` | [ ] | [ ] | [ ] |
| 18 | 5108080 | 1 | `'5108080001'..'5108080010'` (10 desa, lihat file sumber) | [ ] | [ ] | [ ] |
| 19 | 5108080 | 2 | `'5108080011','5108080012','5108080013'` | [ ] | [ ] | [ ] |
| 20 | 5108090 | 1 | `'5108090001'..'5108090006'` (6 desa, lihat file sumber) | [ ] | [ ] | [ ] |
| 21 | 5108090 | 2 | `'5108090007','5108090008','5108090009','5108090010'` | [ ] | [ ] | [ ] |

> Daftar `IN (...)` yang dipersingkat `'...'..'...'` di atas: salin versi
> LENGKAP dari `sql/pengelompokan_desa_keluarga.md` (jangan ketik ulang manual,
> rawan salah ketik kode wilayah).

Subtotal: 21 grup × 3 file = **63 langkah kerja**, tapi tetap **21 kali** buka
SQL Lab per file (query & filter sama, cuma ganti file query aktif) — total
usaha ≈ 21×3 = 63 download CSV + 63 panggilan `fasih-import-csv.js`. Kalau mau
lebih ringkas, boleh kerjakan 1 file dulu untuk semua 21 grup (mis. selesaikan
kolom `keluarga` dulu top-to-bottom), baru pindah ke `rosterAk`, baru
`rosterMeteran` — bukan grup-per-grup 3-file-sekaligus. Pilih urutan yang
paling nyaman, keduanya idempoten.

---

## Usaha (sql/pengelompokan_desa_usaha.md)

| # | Kecamatan | Grup | Kode desa | Status |
|---|-----------|------|-----------|:---:|
| 1 | residual | 1 | `'5108000000'` (2 unit, boleh gabung ke grup manapun) | [ ] |
| 2 | 5108010 | 1 | `'5108010001','5108010002','5108010003','5108010004'` | [ ] |
| 3 | 5108010 | 2 | `'5108010005'..'5108010011'` (7 desa, lihat file sumber) | [ ] |
| 4 | 5108010 | 3 | `'5108010012','5108010013','5108010014'` | [ ] |
| 5 | 5108020 | 1 | `'5108020001'..'5108020016'` (16 desa, lihat file sumber) | [ ] |
| 6 | 5108020 | 2 | `'5108020017','5108020018','5108020019','5108020020','5108020021'` | [ ] |
| 7 | 5108030 | 1 | `'5108030001'..'5108030013'` (13 desa, lihat file sumber) | [ ] |
| 8 | 5108030 | 2 | `'5108030014','5108030015'` | [ ] |
| 9 | 5108040 | 1 | `'5108040001'..'5108040009'` (9 desa, lihat file sumber) | [ ] |
| 10 | 5108040 | 2 | `'5108040010'..'5108040016'` (7 desa, lihat file sumber) | [ ] |
| 11 | 5108040 | 3 | `'5108040017'` | [ ] |
| 12 | 5108050 | 1 | `'5108050001'..'5108050008'` (8 desa, lihat file sumber) | [ ] |
| 13 | 5108050 | 2 | `'5108050009'..'5108050015'` (7 desa, lihat file sumber) | [ ] |
| 14 | 5108060 | 1 | `'5108060001'..'5108060022'` (22 desa, lihat file sumber) | [ ] |
| 15 | 5108060 | 2 | `'5108060023'..'5108060029'` (7 desa, lihat file sumber) | [ ] |
| 16 | 5108070 | 1 | `'5108070001'..'5108070012'` (12 desa, lihat file sumber) | [ ] |
| 17 | 5108070 | 2 | `'5108070013','5108070014'` | [ ] |
| 18 | 5108080 | 1 | `'5108080001'..'5108080009'` (9 desa, lihat file sumber) | [ ] |
| 19 | 5108080 | 2 | `'5108080010','5108080011','5108080012','5108080013'` | [ ] |
| 20 | 5108090 | 1 | `'5108090001'..'5108090009'` (9 desa, lihat file sumber) | [ ] |
| 21 | 5108090 | 2 | `'5108090010'` | [ ] |

---

## Setelah SEMUA baris di atas tercentang

1. `node scripts/sheet-admin.js status` — cek jumlah baris tab `Records` naik
   signifikan.
2. Bandingkan `anomaliPerRule` akumulasi (dari output tiap `import-fasih`,
   atau jalankan ulang `import-fasih` sekali lagi di akhir untuk lihat total)
   dengan `sql/REKONSILIASI_RULE.md §1`. U9 wajar lebih banyak di aplikasi
   (lihat §3 file itu).
3. roster_ak & roster_meteran: pastikan tidak ada error `Invalid plan` lagi
   (fix `ORDER BY` sudah diterapkan, tapi belum pernah dites dengan data
   sungguhan sampai checklist ini dibuat).
