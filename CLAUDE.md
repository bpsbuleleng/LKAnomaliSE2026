
## PROJECT BRIEF (paste sekali / simpan sebagai CLAUDE.md)

### Tujuan

Aplikasi web mobile-first sebagai lembar kerja pengecekan anomali isian Sensus Ekonomi 2026. Pengguna = PML (Pemeriksa Lapangan Sensus). PML mengisi kuesioner (bisa disimpan walau belum lengkap, termasuk saat offline), lalu setelah lengkap & submit, sistem menjalankan rule validation dan menampilkan daftar anomali. Database di Google Spreadsheet.

### Sumber data asli

Spreadsheet acuan: **"Database LK Anomali SE2026"** (ID `1-AaXOXyy83Txn5xKxN9HpDYGuj5TwuaiYAD8nRKUUMU` untuk versi live Google Sheets, dipakai Fase 5). **Penting**: versi live Sheets yang sempat dicek baru berisi tab `Petugas`. Versi yang jadi acuan SEKARANG adalah file `.xlsx` offline yang lebih lengkap, isinya 4 sheet: `Petugas` (~697 baris), `Alokasi Wilayah` (2601 baris), `Daftar Pertanyaan` (64 baris), `Daftar Anomali` (16 baris). **Sebelum Fase 5, ke-4 tab ini harus disinkronkan ke Google Sheets live** (import xlsx langsung atau copy-paste per tab) — jangan asumsikan otomatis ada di sana.

### Stack & Arsitektur (opsi A)

- **Semua dalam SATU proyek Google Apps Script**: file `.gs` (server) + file `.html` (client, HTML Service). TIDAK ada frontend terpisah, TIDAK ada masalah CORS.
- **Client**: vanilla JS + HTML + CSS. Tailwind lewat CDN (`<script src="https://cdn.tailwindcss.com">`) — TIDAK pakai React (butuh bundler, tidak cocok dengan HTML Service yang tanpa build step). Mobile-first, touch target ≥ 44px.
- **Komunikasi client→server**: `google.script.run.namaFungsi(...).withSuccessHandler(...).withFailureHandler(...)`. Tidak ada fetch/REST manual.
- **Struktur halaman**: satu `Index.html` sebagai shell; client-side JS show/hide "view" (Login, Dashboard, Kuesioner) berdasarkan state, supaya terasa seperti SPA tanpa reload penuh. Halaman Admin (Fase 4) dirender terpisah lewat `doGet(e)` yang mengecek `e.parameter.page === 'admin'` — TIDAK ditautkan dari navigasi PML sama sekali, hanya bisa diakses kalau tahu URL-nya langsung.
- **Boundary data-access (tetap kritikal, filosofinya TIDAK berubah)**: satu file `DataAccess.gs` dengan fungsi: `login`, `getWilayah`, `getPPL`, `listRecords`, `getRecord`, `saveDraft`, `submitRecord`, `getQuestions`, `getRules`, `createQuestion`, `updateQuestion`, `setQuestionActive`, `reorderQuestions`, `createRule`, `updateRule`, `setRuleActive`. Fase awal: implementasi baca/tulis dari OBJEK JS in-memory (mock) di dalam `.gs`. Fase 5: ganti isi fungsi jadi baca/tulis `SpreadsheetApp` — signature TIDAK berubah, kode client yang memanggil via `google.script.run` TIDAK berubah.
- **Tooling wajib**: `clasp` supaya Claude Code bisa push & deploy dari terminal. **Satu-satunya langkah yang TIDAK BISA dilakukan Claude Code sendiri: `clasp login`** (butuh browser sungguhan untuk OAuth) — LO yang jalankan ini sekali di awal.
- **Strategi testing (paling beda dari rencana awal, WAJIB dipahami sebelum Fase 0)**:
  1. Logic murni (evaluator rule, logic cascading wilayah, validasi required) ditulis sebagai fungsi TANPA dependency ke layanan Apps Script (`SpreadsheetApp`, `HtmlService`, dll). Fungsi begini di-unit-test LANGSUNG pakai Node (mis. Jest) tanpa deploy sama sekali — jalur tercepat, prioritaskan sebanyak mungkin logic ditulis begini.
  2. Untuk uji UI/integrasi: `clasp push` → `clasp deploy -i <deploymentId tetap>` (redeploy ke ID yang SAMA supaya URL stabil) → Playwright buka URL `/exec` itu. **JANGAN** pakai URL `/dev` ("latest code") untuk testing otomatis — itu cuma bisa diakses akun dengan edit access dan akan redirect ke login Google kalau diakses browser otomatis tanpa sesi yang sudah login.
  3. Deployment pertama (setting "Execute as" & "Who has access") kemungkinan besar bisa diatur lewat `webapp.access`/`webapp.executeAs` di `appsscript.json` saat `clasp deploy` — tapi ini belum pasti 100% konsisten di semua versi. **TERVERIFIKASI (2026-07-07, clasp 3.3.0): setting manifest TERBAWA otomatis ke deployment** — `/exec` bisa diakses anonim (HTTP 200, tanpa redirect login), TIDAK perlu klik manual di editor. Dua catatan penting: (a) nilai enum manifest untuk akses tanpa login adalah `ANYONE_ANONYMOUS` — enum `ANYONE` justru berarti wajib login akun Google; (b) `clasp create` MENIMPA `appsscript.json` dengan default tanpa blok `webapp` — jangan jalankan `clasp create`/`pull` sembarangan. Deployment ID tetap: `AKfycbwJ4spiFeSAymytUTDFl4bfrMcpBBD3NsE5d0k2GCM1_U50slKfyHaC3HhMRipnw7PU` (redeploy via `npm run deploy`).
  4. Setelah deployment awal berdiri dengan ID tetap, semua iterasi berikutnya (`clasp push` + `clasp deploy -i <id>`) sepenuhnya bisa dijalankan Claude Code sendiri.

### Auth (pilot)

- **PML**: email (harus ada di tab `Petugas`, pada baris dengan `Posisi Daftar` mengandung "PML") + password `"cobaapp"`. PPL TIDAK login — PPL cuma data referensi yang ditampilkan otomatis.
- **Admin**: password saja, TANPA email/identitas — `"admin5108"`. Tidak butuh baris di `Petugas` — admin bukan personil, cuma gerbang password di kode.
- Karena komunikasinya `google.script.run` (bukan REST bebas header/body), setiap fungsi privileged (`createQuestion`, `updateQuestion`, `setQuestionActive`, `reorderQuestions`, `createRule`, `updateRule`, `setRuleActive`) **WAJIB menerima `adminPassword` sebagai parameter eksplisit**, dan server **HARUS mengecek `adminPassword === ADMIN_PASSWORD` di SETIAP pemanggilan** — bukan cuma sekali di layar login. Client menyimpan password yang dimasukkan admin di variabel JS in-memory selama sesi halaman (bukan localStorage), dan menyertakannya di tiap panggilan privileged.
- **JANGAN** log password ini (`Logger.log`, dll) di mana pun.
- Ini bukan security beneran (password konstan & plaintext) — hanya mencegah PML biasa iseng mengubah rule lewat browser console. `google.script.run.updateRule(...)` bisa dipanggil siapa saja yang buka console, terlepas tombol UI-nya kelihatan atau tidak — makanya pengecekan HARUS di server.
- **Trade-off yang diterima secara sadar**: tidak ada audit trail siapa yang mengubah apa di halaman config, karena admin tidak punya identitas individual.
- Jangan implementasikan hashing/registrasi.

### Skema Google Sheets (satu spreadsheet, banyak tab)

1. **`Petugas`** — PML dan PPL JADI SATU tab (bukan dua terpisah — ini struktur data riil yang sudah dibuat). Kolom (nama asli): `Nama Lengkap`, `Posisi`, `Posisi Daftar`, `Alamat Detail`, `Jenis Kelamin`, `SOBAT ID`, `Email`. **WAJIB pakai `Posisi Daftar` untuk menentukan role (PML/PPL), BUKAN `Posisi`** — di data riil, beberapa baris `Posisi`-nya kosong sementara `Posisi Daftar` selalu terisi. `SOBAT ID` = kode unik petugas.
2. **`Alokasi Wilayah`** (ini yang dimaksud "alokasi Sub-SLS") — SUDAH ADA, 2601 baris riil. Kolom asli: `idsubsls` (kunci gabungan kdprov+kdkab+kdkec+kddesa+kdsls+kdsubsls, unik, tidak ada duplikat), `kdprov`, `kdkab`, `kdkec`, `kddesa`, `kdsls`, `kdsubsls`, `nmprov`, `nmkab`, `nmkec`, `nmdesa`, `nmsls`, `nmppl`, `nmpml`, `emailppl`, `emailpml`. **Koreksi dari draft sebelumnya**: join key ke `Petugas` itu **email, BUKAN SOBAT ID** — dan **PML JUGA punya assignment per Sub-SLS** (`emailpml`), bukan cuma PPL seperti asumsi gue sebelumnya. 9 kecamatan di Buleleng, 5 baris `emailppl` kosong (perlu dilengkapi). **GUARDRAIL WAJIB**: kolom kode wilayah (`kdkec`, `kddesa`, `kdsls`, `kdsubsls`) harus dibaca/disimpan sebagai TEXT/STRING, bukan angka — kalau dibaca sebagai number, leading zero hilang (mis. `"010"` jadi `10`) dan cocokkan-nya bakal salah. **RESOLVED (sudah tertulis di "Alur aplikasi" poin 4)**: Sub-SLS DIBATASI ke assignment PML yang login — `getWilayah(pmlEmail)` memfilter `Alokasi Wilayah` dimana `emailpml` == email PML aktif.
3. **`Records`** — satu baris per record kuesioner. Kolom: `record_id` (dibuat server pakai `LockService`), `pml_email`, `jenis` (`usaha`|`keluarga`), `status` (`draft`|`submitted`), kolom wilayah (`kdkec`..`kdsubsls`, `emailppl`, `emailpml` — **disalin sebagai snapshot saat record dibuat**, bukan live-join ke `Alokasi Wilayah`, supaya riwayat tidak berubah kalau alokasi diperbarui belakangan), `created_at`, `updated_at`, `answers` (JSON — struktur detail lihat "GAP ARSITEKTUR" di bawah, karena ada pertanyaan roster), `anomalies` (JSON string hasil rule saat submit).
4. **`Questions`** — BASELINE untuk pertanyaan NON-roster. Kolom: `question_id`, `jenis` (`usaha`|`keluarga`), `order`, `label`, `type` (`text`|`number`|`select`|`date`|`textarea`), `options` (JSON array untuk select), `required` (`TRUE`/`FALSE`), `help` (opsional), `active` (`TRUE`/`FALSE`, default `TRUE`), `roster_group` (kosong = bukan roster; lihat "GAP ARSITEKTUR"). `active=FALSE` = soft-delete: hilang dari kuesioner baru, tapi record lama yang sudah punya jawaban untuk `question_id` itu tetap dirender apa adanya — JANGAN pernah hard-delete baris ini.
5. **`Rules`** — BASELINE untuk rule kondisi-sederhana. Kolom: `rule_id`, `jenis`, `severity` (`error`|`warning`), `message`, `when` (JSON string, format di bawah), `active` (`TRUE`/`FALSE`). **Belum cukup untuk semua 16 anomali riil — lihat "GAP ARSITEKTUR".**

6. **`Rasio NTB SE2016`** (gid=595141439, ditambahkan user 2026-07-09) — tab REFERENSI (app hanya baca), ~2560 baris. Kolom: `KBLI 2025` (kode 5 digit, TEXT — leading zero!), `Judul KBLI 2025`, `Kategori KBLI 2020`, `Rasio NTB SE 2016` (desimal titik, rentang riil 0.057–0.8456). Dipakai computed field `batas_rasio_ntb` untuk rule `U9`. **Data-quality**: 1559 kode unik, tapi **125 kode muncul >1 kali dengan rasio BERBEDA** (kode sama terpetakan ke >1 kategori, mis. `01284` → 0.7641 & 0.8362) — kebijakan yang dipakai: ambil rasio **TERBESAR** (konservatif: anomali hanya kalau melebihi batas tertinggi; lihat `buildNtbRasioMap` di ComputedFields.js). Tab hilang/kosong → `batas_rasio_ntb` null → U9 tidak berlaku, submit tetap jalan.
7. **`Variabel Hitungan`** (BARU, dibuat aplikasi sendiri 2026-07-09 — BUKAN diimpor user, jangan bingung dengan tab 1-6 yang isinya data BPS). Kolom: `field_id`, `jenis`, `formula`, `label` (kolom `label` ditambahkan 2026-07-09 saat fitur CRUD; tab lama 3-kolom di-migrate otomatis oleh `SheetDb.ensureComputedLabelColumn_` saat tulis pertama). DUA macam baris hidup berdampingan: (a) **override** formula computed field bawaan yang editable — `label` KOSONG, SPARSE by design (hanya field yang admin timpa formulanya punya baris; reset ke default = HAPUS baris), dan (b) **custom computed field** buatan admin lewat CRUD halaman config — `label` TERISI (inilah penanda pemilah, ditegakkan `DataAccess.splitComputedDefs_` via `ComputedFields.fieldMeta`). Urutan baris tab = urutan evaluasi custom field saat submit. Lihat "Variabel hasil perhitungan (computed fields)" di bawah.

> **Catatan istilah**: "daftar anomali" dan "rule validation" merujuk ke ENTITY YANG SAMA — satu baris di tab `Rules` = satu anomali (`message`) sekaligus logika deteksinya (`when`). Halaman config punya 3 bagian: Kelola Pertanyaan, Kelola Rule, dan Variabel Hasil Perhitungan (BARU 2026-07-09, lihat bawah) — bukan 2 seperti draft awal.

### Variabel hasil perhitungan (computed fields) — bawaan editable / tetap di kode / custom CRUD

Computed field (`ComputedFields.js`) dibagi 3 kelompok, JANGAN dicampur:

1. **Formula-editable (bawaan)** — aritmetika FLAT (cuma `+ - * /` antar-field/angka, tanpa akses roster/tabel eksternal). Didefinisikan sebagai string di `EDITABLE_DEFAULTS` (bukan kode JS bebas), dievaluasi lewat parser AMAN yang sama dengan rule (`Formula.compileExpr`/`evaluateExpr` — TANPA eval, hanya tokenizer + recursive-descent). Admin boleh menimpa rumusnya lewat halaman config ("Variabel Hitungan") — override tersimpan di tab `Variabel Hitungan` (skema no. 7). Daftarnya: `keluarga.b4r16`, `keluarga.luas_per_kapita`, `usaha.r26_total`, `usaha.pangsa_biaya_produksi`, `usaha.rasio_pendapatan_biaya`, `usaha.rasio_ntb`. Id & label tetap dari kode — hanya formulanya yang bisa diubah/reset.
2. **Tetap di kode** — butuh primitif di luar grammar aritmetika flat: agregasi roster (`b1r9`, `b3r18c`, `jumlah_anggota_keluarga`, `jumlah_meteran_listrik`), ekstraksi/lookup string (`r13f`, `r13h`), atau lookup tabel eksternal (`batas_rasio_ntb`, lihat skema no. 6). TIDAK bisa diedit dari UI — ini keputusan arsitektur sadar (CLAUDE.md "GAP ARSITEKTUR": hindari bahasa query generik), bukan keterbatasan sementara.
3. **Custom buatan admin (BARU 2026-07-09, CRUD penuh)** — variabel TAMBAHAN yang admin buat sendiri dari halaman config: alias (`^[a-z_][a-z0-9_]*$`, tidak boleh menabrak alias pertanyaan jenis itu / computed bawaan / `roster`; immutable setelah dibuat), label, dan formula (grammar aritmetika flat yang SAMA dengan kelompok 1). Tersimpan di tab `Variabel Hitungan` dengan `label` terisi; dievaluasi saat submit SETELAH pipeline bawaan, urut baris tab (custom boleh merujuk jawaban kuesioner, computed bawaan, dan custom yang barisnya lebih dulu — merujuk yang belakangan dapat 0). Otomatis muncul di dropdown field rule (`getRuleFieldOptions`) & preview. BOLEH hard-delete (beda dari Questions/Rules — nilainya dihitung ulang tiap submit, tidak menyimpan jawaban historis); UI memperingatkan rule aktif yang masih merujuknya (rule TIDAK error setelah hapus, hanya tak pernah cocok).

`DataAccess.getComputedFields(jenis)` (read-only, unprivileged) mengembalikan SEMUA field ketiga kelompok (custom bertanda `custom: true`) — dipakai halaman admin supaya tidak "buta" terhadap variabel yang dipakai rule tapi tidak muncul di kuesioner. Fungsi privileged (semua cek `adminPassword` per panggilan): `updateComputedFieldFormula(adminPassword, jenis, fieldId, formula)` untuk kelompok 1 (menolak non-editable `NOT_EDITABLE`, formula rusak `INVALID_FORMULA`; `formula=''` = reset ke default), dan `createComputedField` / `updateComputedField` / `deleteComputedField` untuk kelompok 3 (logic murni di `ConfigLogic.applyCreate/Update/DeleteComputedField`, di-unit-test Node). Override/custom yang lolos validasi saat simpan TAPI entah kenapa gagal dievaluasi saat submit (mis. tab diedit manual di luar UI) **fallback diam-diam** (override → default; custom → null) — formula admin TIDAK PERNAH boleh menggagalkan submit PML.

### GAP ARSITEKTUR — pertanyaan roster & rule agregat (BELUM FINAL — jangan bangun Fase 2/3 serius sebelum ini diputuskan)

Setelah baca `Daftar Pertanyaan` (64 baris) dan `Daftar Anomali` (16 baris) yang sebenarnya, desain baseline di atas TIDAK CUKUP untuk sebagian data riil. Ini bukan soal wording, ini soal model data:

1. **RESOLVED — 2 kelompok roster, sudah diverifikasi ulang ke seluruh data (bukan cuma yang `in_roster=ya`)**:
   **`anggota_keluarga`** (13 field, per-anggota, semua jenis `keluarga`): `b1r6_n` (nama), `b1r8_n` (hubungan dgn KK), `b1r9_n` (status keberadaan), `b1r11_n` (status kawin), `b3r18a_n`/`b3r18b_n`/`b3r18c_n` (3 komponen pendapatan), `b3r20a_n`..`b3r20f_n` (6 jenis disabilitas).
   **`meteran_listrik`** (1 field): `b4r14b_n` (daya per meteran). **Ada skip-pattern**: field ini cuma relevan kalau `b4r13` (sumber penerangan) berkode 1 (PLN dengan meteran), dan jumlah pengulangannya ditentukan `b4r14a` (jumlah meteran) — field driver ini sendiri BUKAN roster, cuma penentu berapa kali `b4r14b_n` diulang.
   **KASUS KHUSUS yang perlu lo konfirmasi**: `b1r13_1` ("Umur Kepala Keluarga") ditandai `in_roster=ya` tapi pola namanya beda dari 13 field di atas — pakai `_1` (indeks tetap), BUKAN `_n` (umum), dan TIDAK ADA `b1r13_n` di data. Artinya umur cuma ditanya untuk Kepala Keluarga (anggota indeks 1), bukan tiap anggota. Gue simpulkan ini **BUKAN benar-benar roster** — field berdiri sendiri, ditanya sekali, bukan diulang per baris. Betulkan kalau salah, tapi kalau gue gak dengar sebaliknya, gue lanjutkan dengan asumsi ini.
2. **`b1r9` dan `b4r16` CONFIRMED (semua sumber sepakat)**: `b1r9` = COUNT anggota di roster `anggota_keluarga` dengan `b1r9_n` berkode 1 (tinggal di sini) atau 5 (anggota baru). `b3r18c` = SUM tiga komponen pendapatan (`b3r18a_n`+`b3r18b_n`+`b3r18c_n`) di SEMUA baris roster (dipakai K5). `b4r16` = `(b4r16a × 30 ÷ 7) + b4r16b + (b4r16c ÷ 12)` — dikonfirmasi user, cocok dengan `Identifikasi` K5.
3. **Roster tidak butuh field "jumlah" eksplisit (RESOLVED)**: gak ada field deklarasi jumlah anggota terpisah — `b1r9` sendiri yang jadi hasil hitungnya, PML kemungkinan cuma nambah baris bebas. Konsisten dengan pola `meteran_listrik` yang justru punya `b4r14a` sebagai driver eksplisit — asimetri ini gue terima sebagai fakta data, bukan didesain ulang.
4. **Beberapa dari 16 anomali butuh cek agregat lintas-roster**, bukan satu field vs satu value — contoh nyata: K3 "Semua Anggota Keluarga Disabilitas" (butuh cek SEMUA baris roster), K7 "Jumlah Anggota Keluarga Ekstrem" (butuh COUNT baris roster), K5 "Selisih Pendapatan Negatif" (butuh field hasil hitungan poin 2). Format `when` yang ada (field/op/value datar) TIDAK BISA menyatakan ini.
5. **U-series (usaha) — sebagian besar RESOLVED**: dimensi "usaha berdiri 2026 vs sebelumnya" disatukan (keputusan user: anggap sama, pakai field yang sama). Dimensi "usaha besar" **RESOLVED (keputusan user 2026-07-07): DISATUKAN dengan usaha biasa** — tidak ada cabang rule terpisah di v1; lihat "Progress terjemahan" di bawah.
   **Arah yang gue rekomendasikan** (proposal, bukan keputusan final):

- `answers` di `Records` dipisah dua bagian: field datar seperti biasa (`{question_id: value}`), plus `roster: {nama_roster: [ {field: value, ...}, {field: value, ...} ] }` untuk tiap kelompok roster.
- Field yang sifatnya hitungan (poin 2) dihitung sebagai langkah eksplisit terpisah saat submit (fungsi kecil per field, bukan bahasa query generik) — hasilnya disimpan sebagai field biasa di `answers`, supaya evaluator rule di Fase 3 TETAP sederhana (field/op/value), tidak perlu bahasa agregat generik yang rawan bug.
- Untuk cek "semua/berapa banyak anggota memenuhi kondisi X" (K3, K7), tambah SATU jenis kondisi baru di `when`: kombinator `roster_all` / `roster_any` / `roster_count` yang menunjuk ke satu `roster_group` + kondisi per-baris — bukan bahasa query umum, cuma 3 primitif ini.
- Ke-16 anomali riil perlu diterjemahkan SATU-SATU dari `Identifikasi` (prosa) ke `when` (struktur) — ini butuh pemahaman domain form SE2026 (kode rincian kayak R13b1, R26b/R26f) yang gue TIDAK bisa nebak dengan aman. Rekomendasi: kerjakan ini di chat, sama seperti rencana semula — bukan karena venue-nya beda, tapi karena inilah pekerjaan yang perlu validasi paling ketat dari semua yang ada di proyek ini.
  **RESOLVED (2026-07-07): dimensi "usaha besar" JUGA disatukan dengan usaha biasa.** Tidak ada lagi pertanyaan blocking di bagian ini. Asumsi berjalan yang tetap berlaku kecuali dikoreksi: `b1r13_1` bukan roster (poin 1), K3 pakai `b1r9 > 1`, K6 pakai proposal sementara multi-meteran (lihat "Progress terjemahan").

### Format rule (isi kolom `when`)

Format BASELINE ini berlaku untuk rule non-agregat. Untuk rule yang butuh cek lintas-roster, lihat "GAP ARSITEKTUR" di atas — jangan dipaksakan ke format ini. Kondisi terstruktur, aman (JANGAN pakai `eval` string arbitrer). Contoh:

```json
{
  "all": [
    { "field": "omzet", "op": ">", "value": 0 },
    { "field": "tenaga_kerja", "op": "==", "value": 0 }
  ]
}
```

- Kombinator: `all` (AND) dan `any` (OR), boleh bersarang.
- Operator: `==`, `!=`, `>`, `>=`, `<`, `<=`, `in`, `not_in`, `empty`, `not_empty`, `regex`.
- Bandingkan antar-field: pakai `field2` alih-alih `value`, contoh `{ "field": "pengeluaran", "op": ">", "field2": "pemasukan" }`.
- Sebuah record dianggap anomali untuk rule tsb jika kondisinya **terpenuhi**; `message` ditampilkan.

### Progress terjemahan 16 anomali (LIVE — update tiap sesi chat)

Metodenya: tiap anomali di-cross-check field yang direferensikan `Identifikasi`-nya terhadap 64 alias yang BENERAN ada di `Daftar Pertanyaan`. Ini bukan cuma soal istilah — kalau field-nya gak ada, rule-nya secara harfiah gak bisa jalan, berapa pun bagusnya `when` yang ditulis.

**Sudah bisa diterjemahkan bersih (field-nya semua ada):**

`K1` (Status Cerai/Belum Kawin):

```json
{ "roster_any": "anggota_keluarga", "condition": { "all": [
  { "field": "b1r8_n", "op": "in", "value": [1, 2] },
  { "field": "b1r11_n", "op": "in", "value": [1, 3, 4] }
] } }
```

Cek: ada anggota berstatus kepala keluarga ATAU pasangan (b1r8_n = 1/2) yang status kawinnya bukan "kawin" (b1r11_n = 1/3/4).

`K7` (Jumlah Anggota Keluarga Ekstrem):

```json
{ "field": "b1r9", "op": ">", "value": 10 }
```

`K4` (Luas Lantai Ekstrem) — butuh 1 computed field baru, `luas_per_kapita` = `b4r5` ÷ `b1r9` (dihitung saat submit, bukan di `when`):

```json
{ "any": [
  { "field": "luas_per_kapita", "op": "<", "value": 3 },
  { "field": "luas_per_kapita", "op": ">", "value": 200 }
] }
```

**Hampir bisa, tapi ada 1 hal spesifik yang perlu lo konfirmasi per anomali:**

`K3` (Semua Anggota Keluarga Disabilitas): `Identifikasi` rujuk "Blok I R2b > 1" (jumlah anggota) — gak ada alias `b1r2b`, tapi kemungkinan besar ini konsep yang SAMA dengan `b1r9` (jumlah anggota) cuma beda penyebutan. Gue asumsikan `b1r9 > 1` — koreksi kalau salah:

```json
{ "all": [
  { "field": "b1r9", "op": ">", "value": 1 },
  { "roster_all": "anggota_keluarga", "condition": { "any": [
    {"field":"b3r20a_n","op":"=="," value":1}, {"field":"b3r20b_n","op":"==","value":1},
    {"field":"b3r20c_n","op":"==","value":1}, {"field":"b3r20d_n","op":"==","value":1},
    {"field":"b3r20e_n","op":"==","value":1}, {"field":"b3r20f_n","op":"==","value":1}
  ] } }
] }
```

`K5` (Selisih Pendapatan Negatif): field-nya semua ada (`b3r18c` = total pendapatan, `b4r16` = total pengeluaran), TAPI rumus `b4r16` masih konflik (lihat "GAP ARSITEKTUR" poin 2) — rule-nya gampang begitu itu settle:

```json
{ "field": "b3r18c", "op": "<", "field2": "b4r16" }
```

`K6` (Listrik Rendah & Ada Barang Mewah): field-nya semua ada, tapi `Identifikasi`-nya cuma jelasin skenario "1 meteran" secara eksplisit — belum jelas gimana kalau `b4r14a` (jumlah meteran) lebih dari 1 (jumlah semua daya? cek semua meteran rendah?). Proposal sementara (1 meteran ATAU pengeluaran listrik rendah, ditambah punya barang mewah):

```json
{ "all": [
  { "any": [
    { "field": "b4r15a", "op": "<", "value": 100000 },
    { "all": [{ "field": "b4r14a", "op": "==", "value": 1 }, { "roster_any": "meteran_listrik", "condition": {"field":"b4r14b_n","op":"==","value":1} }] }
  ] },
  { "any": [
    { "field": "b4r17c", "op": ">", "value": 0 }, { "field": "b4r17d", "op": ">", "value": 0 }, { "field": "b4r17f", "op": ">", "value": 0 }
  ] }
] }
```

`U1`-`U7` (Biaya Produksi Dominan, Keuntungan Usaha, Penyertaan Modal Korporasi, Data Keuangan MBG, Hubungan Aset/Pekerja/Produksi, Internet Usaha Menengah-Besar, Laporan Keuangan Usaha Menengah-Besar): dimensi "usaha berdiri 2026 vs sebelumnya" **RESOLVED — disatukan** (keputusan user: dianggap sama, dokumen L dipakai untuk semua tahun berdiri). Dimensi **"usaha besar"** itu BEDA sumbu, bukan cuma tahun — khusus muncul di `U1`, `U2`, `U3` (field terpisah: R22b/R22f, R22f/R23c, R25) — **RESOLVED (keputusan user 2026-07-07): disatukan juga dengan usaha biasa**, cabang field khusus usaha besar TIDAK dipakai di v1. Dengan ini `U1`-`U7` SEMUANYA bersih sepenuhnya.

**Computed field baru yang dipakai bersama (dihitung sekali saat submit, dipakai beberapa rule):**

- `r26_total` = `r26a + r26b + r26c + r26d + r26e` (total biaya usaha)
- `pangsa_biaya_produksi` = `r26b / r26_total` (dipakai U1; kalau `r26_total`=0, treat sebagai 0/tidak berlaku)
- `rasio_pendapatan_biaya` = `r27c / r26_total` (dipakai U4, guard sama)

```
U1: { "all": [{"field":"r13b1","op":"==","value":2}, {"field":"pangsa_biaya_produksi","op":">","value":0.5}] }   ← BERSIH SEPENUHNYA (usaha besar disatukan, 2026-07-07)
U2: { "field": "r27c", "op": "<", "field2": "r26_total" }   ← BERSIH SEPENUHNYA (usaha besar disatukan, 2026-07-07)
U3: { "all": [{"field":"r11a","op":"==","value":13}, {"any":[{"field":"r29c","op":">","value":0},{"field":"r29d","op":">","value":0}]}] }   ← BERSIH SEPENUHNYA (usaha besar disatukan, 2026-07-07)
U4: { "all": [{"field":"r22","op":"==","value":1}, {"any":[{"field":"rasio_pendapatan_biaya","op":">=","value":1.25},{"field":"rasio_pendapatan_biaya","op":"<","value":1}]}] }   ← BERSIH SEPENUHNYA
U5: { "all": [{"field":"r28c","op":">","value":10000000}, {"field":"r24c1","op":"==","value":1}, {"field":"r27c","op":"<","value":60000000}] }   ← BERSIH SEPENUHNYA
U6: { "all": [{"field":"r16a","op":"==","value":2}, {"field":"r25","op":"<","value":2026}, {"field":"r27c","op":">=","value":15000000000}] }   ← BERSIH SEPENUHNYA
U7: { "all": [{"field":"r11d","op":"==","value":2}, {"field":"r25","op":"<","value":2026}, {"field":"r27c","op":">=","value":15000000000}] }   ← BERSIH SEPENUHNYA
```

`U9` (Rasio NTB Tinggi — rule BARU 2026-07-09, di LUAR 16 anomali awal): rasio NTB = `(r27c − r26_total) ÷ r27c` (rujukan sirusa.web.bps.go.id/metadata/indikator/4621), dibandingkan batas per kode KBLI `r13g` dari tab `Rasio NTB SE2016` (skema tab no. 6, termasuk kebijakan kode dobel → ambil terbesar). Dua computed field baru saat submit: `rasio_ntb` (r27c 0/kosong → null) dan `batas_rasio_ntb` (lookup r13g; kode tak ada di tab → null → rule tidak berlaku). Tabel lookup dioper ke ComputedFields lewat parameter `refs` (dibaca `SheetDb.readNtbRasio()` hanya untuk jenis usaha, dipakai submit DAN preview):

```json
{ "field": "rasio_ntb", "op": ">", "field2": "batas_rasio_ntb" }
```

`U8` (Perbedaan KBLI 2 digit Pendataan dan SBR): **DIKONFIRMASI EXCLUDED dari v1** — bukan rule per-record (butuh agregasi lintas-record + data eksternal SBR yang gak kita punya). TIDAK masuk tab `Rules`. Kalau nanti dibutuhkan, jadi fitur laporan admin terpisah, di luar scope dokumen ini.

`K2` (Kepala Keluarga <10 Th di Rumah Sendiri): **RESOLVED — koreksi dari kesimpulan sebelumnya.** Field-nya BUKAN field baru — `b4r3a` sudah ada di sheet, cuma label & kategorinya di `Daftar Pertanyaan` salah (tertulis "jenis bangunan tempat tinggal", padahal isinya seharusnya "Status kepemilikan bangunan tempat tinggal yang ditempati", kategori `1. Milik sendiri\n2. Kontrak/sewa\n3. Bebas sewa\n4. Dinas\n5. Lainnya`). **Sudah dikoreksi di file v2** (label & kategori `b4r3a` diperbaiki). Rule (memakai `b1r13_1` yang sudah confirmed = umur kepala keluarga):

```json
{ "all": [
  { "field": "b1r13_1", "op": "<", "value": 10 },
  { "field": "b4r3a", "op": "==", "value": 1 }
] }
```

### Alur aplikasi (wajib sesuai)

1. Login (email + `"cobaapp"`) → identitas PML dikenali, hanya record milik PML itu yang muncul.
2. Dashboard: daftar record milik PML (draft & submitted, ada status), tombol buat record baru, dan bisa buka/lanjutkan record lama.
3. Buat record baru → pilih jenis assignment: **usaha** atau **keluarga** (kuesioner & rule beda).
4. Kuesioner muncul. Wilayah = searchable select bertingkat & dependen: Kecamatan → Desa → SLS → Sub-SLS (Prov `[51] Bali` & Kab `[08] Buleleng` auto-terisi). **Sub-SLS DIBATASI ke assignment PML yang login** (filter `Alokasi Wilayah` dimana `emailpml` == email PML aktif) — bukan daftar bebas semua Sub-SLS. Setelah Sub-SLS dipilih, nama PPL & PML (join `Alokasi Wilayah` → `Petugas` lewat email) otomatis tampil. Tiap pertanyaan menampilkan `question_id` kecil (mono, abu-abu) di samping label (mis. `r26b`) — sejak 2026-07-09 label usaha TIDAK lagi memuat prefix kode form (`26b.` dst, dihapus user langsung di tab `Questions`), jadi `question_id` inilah satu-satunya penanda kode variabel yang terlihat PML.
5. Draft disimpan ke IndexedDB browser SEGERA (debounced) begitu PML mengetik — selamat walau koneksi putus. "Simpan Sementara" manual tetap ada sebagai trigger eksplisit ke server; record baru baru tercipta di server setelah panggilan pertama berhasil. Sebelum PML keluar dari kuesioner dengan perubahan belum ke-sync, tampilkan **dialog konfirmasi** ("Simpan sementara / Buang / Batal").
6. Draft boleh belum lengkap. **Submit hanya boleh jika semua field `required` terisi** (validasi isian). Setelah submit, jalankan rule → simpan hasil → tampilkan **daftar anomali**. Rule anomali bersifat laporan, bukan pemblokir submit.
7. Record submitted boleh diedit; submit ulang → rule di-run ulang. (Unconditional.)
8. Halaman **Kelola Pertanyaan & Rule** (+ Variabel Hasil Perhitungan) hanya bisa diakses lewat URL `?page=admin` + password admin — tidak muncul di navigasi PML sama sekali.

### Guardrails scope (JANGAN lakukan di v1)

- JANGAN bikin hashing password / registrasi / reset password.
- JANGAN pakai `eval`/`Function` untuk rule; reuse evaluator terstruktur yang sama (Fase 3) di fitur preview rule pada halaman config.
- JANGAN taruh data pribadi/sensitif di URL/query string.
- JANGAN ubah signature `DataAccess.gs` atau kode client saat mengganti mock → `SpreadsheetApp` di Fase 5.
- JANGAN hard-delete baris `Questions`/`Rules` — selalu soft-delete lewat `active`.
- JANGAN andalkan tombol UI yang disembunyikan sebagai satu-satunya proteksi — `google.script.run` bisa dipanggil langsung dari console siapa pun; proteksi HARUS dicek di server tiap panggilan privileged.
- JANGAN pakai URL `/dev` untuk testing otomatis publik — gunakan deployment `/exec` yang stabil.
- JANGAN bangun visual rule-builder yang menghandle semua kombinasi nested AND/OR di v1 — pakai hybrid: form sederhana untuk kondisi tunggal + textarea JSON (tervalidasi) untuk kasus bersarang/kompleks.

### Format acceptance & verifikasi (berlaku tiap fase)

- Prioritaskan unit test Node lokal untuk logic yang dependency-free (evaluator rule, cascading wilayah, validasi) — ini jalur tercepat, jalankan tanpa deploy.
- Untuk apa pun yang butuh UI/HTML Service: `clasp push` + `clasp deploy -i <deploymentId tetap>` + Playwright ke `/exec`. Laporkan hasil sebelum bilang "selesai".
- Untuk fase yang menyentuh desain data/interface, **propose dulu** struktur file + signature `DataAccess.gs`, tunggu konfirmasi, baru tulis kode.
- Jaga fungsi tetap kecil, komentari alur non-obvious, dan buat mock data realistis (wilayah Buleleng, dsb).

---

## DATA UNTUK DIISI USER

### Sampel `Petugas` (3 dari ~697 baris riil — sudah ada, TIDAK perlu didraft ulang)

| Nama Lengkap                 | Posisi                                     | Posisi Daftar                          | Alamat Detail | Jenis Kelamin | SOBAT ID     | Email                    |
| ---------------------------- | ------------------------------------------ | -------------------------------------- | ------------- | ------------- | ------------ | ------------------------ |
| KADEK BUDIANA                | Pemeriksa Lapangan Sensus (PML Sensus)     | Pemeriksa Lapangan Sensus (PML Sensus) | Sumberkima    | Lk            | 510822100697 | kadekbudiana74@gmail.com |
| NI MADE RUSPINI              | Petugas Lapangan Sensus (PPL Sensus)       | Petugas Lapangan Sensus (PPL Sensus)   | Sudaji        | Pr            | 510822030003 | ruspininimade@gmail.com  |
| I MADE AGUS PRADNYANA ASTAWA | *(kosong — lihat catatan data-quality)* | Petugas Lapangan Sensus (PPL Sensus)   | SUMBERKLAMPOK | Lk            | 510822100659 | dehkaghust04@gmail.com   |

> Baris ke-3 sengaja dipilih: contoh nyata `Posisi` kosong tapi `Posisi Daftar` terisi. Fase 0-4 cukup pakai 3 baris ini untuk mock; Fase 5 baca langsung ~697 baris asli.

### Sampel `Alokasi Wilayah` (2601 baris riil — SUDAH ADA, TIDAK perlu didraft ulang)

| idsubsls         | kdprov | kdkab | kdkec | kddesa | kdsls | kdsubsls | nmkec    | nmdesa        | nmppl       | nmpml                | emailppl                   | emailpml             |
| ---------------- | ------ | ----- | ----- | ------ | ----- | -------- | -------- | ------------- | ----------- | -------------------- | -------------------------- | -------------------- |
| 5108010001000101 | 51     | 08    | 010   | 001    | 0001  | 01       | Gerokgak | Sumberklampok | Abdul Basit | Ketut Suryanta Putra | abdulbasit081194@gmail.com | akusury336@gmail.com |

> Ingat guardrail: `kdkec`/`kddesa`/`kdsls`/`kdsubsls` HARUS text, bukan number. Fase 0-4 cukup pakai beberapa baris ini untuk mock; Fase 5 baca 2601 baris asli.

### Pertanyaan — Usaha & Keluarga (64 baris riil, skema ASLI beda dari baseline)

Kolom asli: `jenis`, `alias` (≈ question_id, unik per jenis — BUKAN unik global), `nama variabel` (≈ label), `tipe` (`kategorik`/`string`/`integer`/`double`/`float positif dan nol`/`Persentase` — lebih kaya dari baseline, perlu dipetakan ke `text/number/select/date`), `prefilled`, `kategori` (dobel fungsi: hint format ATAU daftar opsi gaya "1. Label\n2. Label" untuk `kategorik` — perlu di-parse jadi array `options`, bukan disalin mentah), `in_roster`.

Contoh non-roster: `usaha | kecamatan | kode atau nama kecamatan | kategorik | - | kode kecamatan | -`
Contoh roster: `keluarga | b1r8_n | Hubungan Anggota Keluarga Urutan ke-n dengan Kepala Keluarga | kategorik | - | 1. Kepala Keluarga\n2. Istri/Suami\n...\n9. Lainnya | ya`
Contoh computed: `keluarga | b1r9 | jumlah b1r9_n yang berkode 1 dan 5 | integer | ya | - | -` ← butuh rumus, lihat GAP ARSITEKTUR.

> 64 baris asli sudah ada, TIDAK perlu didraft ulang — yang kurang cuma kolom `roster_group` + rumus 3 field hitungan (lihat GAP ARSITEKTUR). JANGAN masukkan ke tab `Questions` final sebelum itu selesai.

### Rule / Anomali (16 baris riil, skema ASLI beda dari baseline)

Kolom asli: `Kode Anomali` (≈ rule_id: U1-U8 usaha, K1-K7 keluarga), `Kelompok Anomali` (≈ jenis), `Jenis Anomali` (JUDUL anomali — jangan disamakan dengan field `jenis` di skema lain), `Deskripsi` (≈ message), `Identifikasi` (prosa panjang, langkah manual + kode rincian form asli seperti R13b1/R26b/R26f — INI yang belum diterjemahkan ke `when`).

8 usaha (U1-U8): Biaya Produksi Dominan, Keuntungan Usaha, Penyertaan Modal Korporasi, Data Keuangan MBG, Hubungan Aset/Pekerja/Produksi, Penggunaan Internet Usaha Menengah-Besar, Laporan Keuangan Usaha Menengah-Besar, Perbedaan KBLI Pendataan vs SBR.
7 keluarga (K1-K7): Status Cerai/Belum Kawin, Kepala Keluarga <10th di Rumah Sendiri, Semua Anggota Keluarga Disabilitas, Luas Lantai Ekstrem, Selisih Pendapatan Negatif, Listrik Rendah & Ada Barang Mewah, Jumlah Anggota Keluarga Ekstrem.

> Judul & deskripsi 16 anomali sudah ada — `when` JSON-nya BELUM. Diterjemahkan satu-satu di chat (lihat GAP ARSITEKTUR).

### Strategi sampel test record

Setelah ke-16 rule di atas diterjemahkan ke `when`, jumlah record test = **1 bersih (0 anomali) + 1 per rule aktif (mengisolasi rule itu saja) + minimal 1 multi-trigger** — untuk 16 rule berarti minimal ~18 record test.
