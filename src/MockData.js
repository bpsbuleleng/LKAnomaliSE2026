/**
 * MockData — dataset referensi baseline. Sejak Fase 5 BUKAN lagi store
 * runtime; perannya tinggal dua: (1) fixture unit test Node, (2) sumber seed
 * tab Google Sheets yang masih kosong (adminSetupSheets) dan baseline
 * resetConfig. Struktur & nama kolom PERSIS mengikuti sheet asli.
 * GUARDRAIL: semua kode wilayah (kdkec, kddesa, kdsls, kdsubsls) STRING.
 */
var MockData = {
  PETUGAS: [
    {
      'Nama Lengkap': 'KADEK BUDIANA',
      'Posisi': 'Pemeriksa Lapangan Sensus (PML Sensus)',
      'Posisi Daftar': 'Pemeriksa Lapangan Sensus (PML Sensus)',
      'Alamat Detail': 'Sumberkima',
      'Jenis Kelamin': 'Lk',
      'SOBAT ID': '510822100697',
      'Email': 'kadekbudiana74@gmail.com'
    },
    {
      'Nama Lengkap': 'NI MADE RUSPINI',
      'Posisi': 'Petugas Lapangan Sensus (PPL Sensus)',
      'Posisi Daftar': 'Petugas Lapangan Sensus (PPL Sensus)',
      'Alamat Detail': 'Sudaji',
      'Jenis Kelamin': 'Pr',
      'SOBAT ID': '510822030003',
      'Email': 'ruspininimade@gmail.com'
    },
    {
      // Contoh riil: `Posisi` kosong tapi `Posisi Daftar` terisi — role dari Posisi Daftar.
      'Nama Lengkap': 'I MADE AGUS PRADNYANA ASTAWA',
      'Posisi': '',
      'Posisi Daftar': 'Petugas Lapangan Sensus (PPL Sensus)',
      'Alamat Detail': 'SUMBERKLAMPOK',
      'Jenis Kelamin': 'Lk',
      'SOBAT ID': '510822100659',
      'Email': 'dehkaghust04@gmail.com'
    },
    {
      // PML kedua — untuk uji isolasi assignment antar PML.
      'Nama Lengkap': 'KETUT SURYANTA PUTRA',
      'Posisi': 'Pemeriksa Lapangan Sensus (PML Sensus)',
      'Posisi Daftar': 'Pemeriksa Lapangan Sensus (PML Sensus)',
      'Alamat Detail': 'Sumberklampok',
      'Jenis Kelamin': 'Lk',
      'SOBAT ID': '510822100001',
      'Email': 'akusury336@gmail.com'
    },
    {
      'Nama Lengkap': 'ABDUL BASIT',
      'Posisi': 'Petugas Lapangan Sensus (PPL Sensus)',
      'Posisi Daftar': 'Petugas Lapangan Sensus (PPL Sensus)',
      'Alamat Detail': 'Sumberklampok',
      'Jenis Kelamin': 'Lk',
      'SOBAT ID': '510822100002',
      'Email': 'abdulbasit081194@gmail.com'
    },
    {
      // PML TANPA assignment sama sekali — untuk uji pesan "belum punya assignment".
      'Nama Lengkap': 'LUH PUTU EKA YANTI',
      'Posisi': 'Pemeriksa Lapangan Sensus (PML Sensus)',
      'Posisi Daftar': 'Pemeriksa Lapangan Sensus (PML Sensus)',
      'Alamat Detail': 'Singaraja',
      'Jenis Kelamin': 'Pr',
      'SOBAT ID': '510822100003',
      'Email': 'luhputuekayanti@gmail.com'
    }
  ],

  // idsubsls = kdprov+kdkab+kdkec+kddesa+kdsls+kdsubsls (16 digit, unik).
  // Sengaja: desa kode '001' ada di kec 010 (Sumberklampok) DAN kec 020
  // (Lokapaksa) — menguji filter desa per-kecamatan, bukan cuma unik kode.
  ALOKASI_WILAYAH: [
    // ---- Assignment KADEK BUDIANA ----
    {
      idsubsls: '5108010002000101',
      kdprov: '51', kdkab: '08', kdkec: '010', kddesa: '002', kdsls: '0001', kdsubsls: '01',
      nmprov: 'Bali', nmkab: 'Buleleng', nmkec: 'Gerokgak', nmdesa: 'Sumberkima',
      nmsls: 'Banjar Dinas Kertha Kusuma',
      nmppl: 'NI MADE RUSPINI', nmpml: 'KADEK BUDIANA',
      emailppl: 'ruspininimade@gmail.com', emailpml: 'kadekbudiana74@gmail.com'
    },
    {
      idsubsls: '5108010002000102',
      kdprov: '51', kdkab: '08', kdkec: '010', kddesa: '002', kdsls: '0001', kdsubsls: '02',
      nmprov: 'Bali', nmkab: 'Buleleng', nmkec: 'Gerokgak', nmdesa: 'Sumberkima',
      nmsls: 'Banjar Dinas Kertha Kusuma',
      nmppl: 'NI MADE RUSPINI', nmpml: 'KADEK BUDIANA',
      emailppl: 'ruspininimade@gmail.com', emailpml: 'kadekbudiana74@gmail.com'
    },
    {
      idsubsls: '5108010002000201',
      kdprov: '51', kdkab: '08', kdkec: '010', kddesa: '002', kdsls: '0002', kdsubsls: '01',
      nmprov: 'Bali', nmkab: 'Buleleng', nmkec: 'Gerokgak', nmdesa: 'Sumberkima',
      nmsls: 'Banjar Dinas Batu Ampar',
      nmppl: 'I MADE AGUS PRADNYANA ASTAWA', nmpml: 'KADEK BUDIANA',
      emailppl: 'dehkaghust04@gmail.com', emailpml: 'kadekbudiana74@gmail.com'
    },
    {
      idsubsls: '5108010003000101',
      kdprov: '51', kdkab: '08', kdkec: '010', kddesa: '003', kdsls: '0001', kdsubsls: '01',
      nmprov: 'Bali', nmkab: 'Buleleng', nmkec: 'Gerokgak', nmdesa: 'Pejarakan',
      nmsls: 'Banjar Dinas Pejarakan Kaja',
      nmppl: 'I MADE AGUS PRADNYANA ASTAWA', nmpml: 'KADEK BUDIANA',
      emailppl: 'dehkaghust04@gmail.com', emailpml: 'kadekbudiana74@gmail.com'
    },
    {
      // Kasus riil: emailppl KOSONG (5 baris begini di data asli) —
      // tampilan nama PPL fallback ke nmppl.
      idsubsls: '5108020001000101',
      kdprov: '51', kdkab: '08', kdkec: '020', kddesa: '001', kdsls: '0001', kdsubsls: '01',
      nmprov: 'Bali', nmkab: 'Buleleng', nmkec: 'Seririt', nmdesa: 'Lokapaksa',
      nmsls: 'Banjar Dinas Delod Margi',
      nmppl: 'GEDE SUARDANA', nmpml: 'KADEK BUDIANA',
      emailppl: '', emailpml: 'kadekbudiana74@gmail.com'
    },
    // ---- Assignment KETUT SURYANTA PUTRA ----
    {
      // Persis baris sampel di brief.
      idsubsls: '5108010001000101',
      kdprov: '51', kdkab: '08', kdkec: '010', kddesa: '001', kdsls: '0001', kdsubsls: '01',
      nmprov: 'Bali', nmkab: 'Buleleng', nmkec: 'Gerokgak', nmdesa: 'Sumberklampok',
      nmsls: 'Banjar Dinas Sumber Batok',
      nmppl: 'Abdul Basit', nmpml: 'Ketut Suryanta Putra',
      emailppl: 'abdulbasit081194@gmail.com', emailpml: 'akusury336@gmail.com'
    },
    {
      idsubsls: '5108010001000102',
      kdprov: '51', kdkab: '08', kdkec: '010', kddesa: '001', kdsls: '0001', kdsubsls: '02',
      nmprov: 'Bali', nmkab: 'Buleleng', nmkec: 'Gerokgak', nmdesa: 'Sumberklampok',
      nmsls: 'Banjar Dinas Sumber Batok',
      nmppl: 'Abdul Basit', nmpml: 'Ketut Suryanta Putra',
      emailppl: 'abdulbasit081194@gmail.com', emailpml: 'akusury336@gmail.com'
    },
    {
      idsubsls: '5108010001000201',
      kdprov: '51', kdkab: '08', kdkec: '010', kddesa: '001', kdsls: '0002', kdsubsls: '01',
      nmprov: 'Bali', nmkab: 'Buleleng', nmkec: 'Gerokgak', nmdesa: 'Sumberklampok',
      nmsls: 'Banjar Dinas Tegal Bunder',
      nmppl: 'Abdul Basit', nmpml: 'Ketut Suryanta Putra',
      emailppl: 'abdulbasit081194@gmail.com', emailpml: 'akusury336@gmail.com'
    }
  ],

  // Subset representatif dari 64 pertanyaan riil (alias asli SE2026) — kini
  // mencakup SEMUA field yang direferensikan 14 rule final + input computed
  // fields, supaya rule bisa dipicu lewat kuesioner sungguhan.
  // options untuk select = array {value, label} (hasil parse kolom `kategori`
  // gaya "1. Label\n2. Label" — parsing aslinya urusan Fase 5).
  // Field computed (b1r9, b3r18c, b4r16, luas_per_kapita, r26_total,
  // pangsa_biaya_produksi, rasio_pendapatan_biaya) BUKAN pertanyaan — dihitung
  // saat submit (ComputedFields) dan tidak dirender.
  QUESTIONS: [
    // ---- USAHA ----
    // Baseline di bawah SUDAH DISINKRONKAN ke isi tab Questions (Google
    // Sheets) hasil edit manual user 2026-07-09 — label/opsi persis meniru
    // sheet (termasuk keanehan kecil kayak spasi dobel di r26d), JANGAN
    // "dirapikan" tanpa izin. resetConfig menulis array ini ke sheet, jadi
    // array ini WAJIB tetap sama dengan yang di sheet supaya reset config
    // tidak menghapus editan user. Prefix kode (mis. "8.a. ") DIHAPUS dari
    // label usaha oleh user 2026-07-09 — kodenya sekarang tampil terpisah
    // di UI lewat question_id (lihat CLAUDE.md "Alur aplikasi").
    { question_id: 'nama_usaha', jenis: 'usaha', order: 1, label: 'Nama usaha/perusahaan', type: 'text', options: null, required: true, help: 'Sesuai papan nama atau izin usaha', active: true, roster_group: '' },
    { question_id: 'r11a', jenis: 'usaha', order: 2, label: 'Bentuk badan usaha', type: 'select', options: [
      { value: '1a', label: 'Perseroan (PT/NV, PT Persero, PT Tbk, PT Persero Tbk, Perseroan Daerah' },
      { value: '1b', label: 'Perseroan perorangan' },
      { value: 2, label: 'Yayasan' },
      { value: 3, label: 'Koperasi' },
      { value: 4, label: 'Dana Pensiun' },
      { value: 5, label: 'Perum/Perumda' },
      { value: 6, label: 'BUM Desa' },
      { value: 7, label: 'Persekutuan Komanditer (CV)' },
      { value: 8, label: 'Persekutuan Firma (Fa)' },
      { value: 9, label: 'Persekutuan Perdata (Maatschap)' },
      { value: 10, label: 'Kantor Perwakilan Luar Negeri' },
      { value: 11, label: 'Badan Usaha Luar Negeri' },
      { value: 12, label: 'Badan Usaha Lainnya (Contoh: BLU, PTN-BH)' },
      { value: 13, label: 'Bukan Badan Usaha' }
    ], required: true, help: '', active: true, roster_group: '' },
    { question_id: 'r13b1', jenis: 'usaha', order: 3, label: 'Apakah memproduksi barang di lokasi ini?', type: 'select', options: [{ value: 1, label: 'Ya' }, { value: 2, label: 'Tidak' }], required: true, help: '', active: true, roster_group: '' },
    // r13g = kode KBLI 5 digit (searchable select, daftar di KbliData.js).
    // r13f (kategori 1 digit) & r13h (kategori huruf A-U) BUKAN baris di
    // sini — dihitung otomatis dari r13g saat submit, lihat ComputedFields.js.
    { question_id: 'r13g', jenis: 'usaha', order: 4, label: 'Kode KBLI (5 digit) kegiatan utama usaha', type: 'kbli', options: null, required: true, help: 'Cari berdasarkan kode atau judul KBLI', active: true, roster_group: '' },
    { question_id: 'r16a', jenis: 'usaha', order: 5, label: 'Apakah menggunakan internet dalam kegiatan usaha?', type: 'select', options: [{ value: 1, label: 'Ya' }, { value: 2, label: 'Tidak' }], required: false, help: '', active: true, roster_group: '' },
    { question_id: 'r11d', jenis: 'usaha', order: 6, label: 'Apakah mempunyai laporan/catatan keuangan', type: 'select', options: [{ value: 1, label: 'Ya' }, { value: 2, label: 'Tidak' }], required: false, help: '', active: true, roster_group: '' },
    { question_id: 'r22', jenis: 'usaha', order: 7, label: 'Apakah terlibat dalam program MBG?', type: 'select', options: [
      { value: 1, label: 'Ya, sebagai SATUAN PELAYANAN PEMENUHAN GIZI (SPPG)' },
      { value: 2, label: 'Ya, sebagai Supplier' },
      { value: 3, label: 'Ya, sebagai penerima manfaat MBG (Sekolah, Puskesmas)' },
      { value: 4, label: 'Ya, peran lainnya' },
      { value: 5, label: 'Tidak terlibat MBG' }
    ], required: false, help: '', active: true, roster_group: '' },
    { question_id: 'r24c1', jenis: 'usaha', order: 8, label: 'Total pekerja', type: 'number', options: [{ value: 1, label: 'Ya' }, { value: 2, label: 'Tidak' }], required: false, help: '', active: true, roster_group: '' },
    { question_id: 'r25', jenis: 'usaha', order: 9, label: 'Tahun mulai beroperasi', type: 'number', options: null, required: true, help: 'Empat digit tahun, mis. 2019', active: true, roster_group: '' },
    { question_id: 'r26a', jenis: 'usaha', order: 10, label: 'Total upah dan gaji, serta jaminan sosial pegawai', type: 'number', options: null, required: false, help: '', active: true, roster_group: '' },
    { question_id: 'r26b', jenis: 'usaha', order: 11, label: 'Biaya produksi', type: 'currency', options: null, required: false, help: '', active: true, roster_group: '' },
    { question_id: 'r26c', jenis: 'usaha', order: 12, label: 'Biaya pembelian barang yang terjual (Rp)', type: 'currency', options: null, required: false, help: '', active: true, roster_group: '' },
    { question_id: 'r26d', jenis: 'usaha', order: 13, label: 'Biaya operasional  setahun (Rp)', type: 'currency', options: null, required: false, help: '', active: true, roster_group: '' },
    { question_id: 'r26e', jenis: 'usaha', order: 14, label: 'Biaya non-operasional setahun (Rp)', type: 'currency', options: null, required: false, help: '', active: true, roster_group: '' },
    { question_id: 'r27c', jenis: 'usaha', order: 15, label: 'Total nilai pendapatan setahun (Rp)', type: 'currency', options: null, required: true, help: '', active: true, roster_group: '' },
    { question_id: 'r28c', jenis: 'usaha', order: 16, label: 'Perkiraan nilai aset usaha (Rp)', type: 'currency', options: null, required: false, help: '', active: true, roster_group: '' },
    { question_id: 'r29c', jenis: 'usaha', order: 17, label: 'Persentase modal dari korporasi publik (bukan koperasi) (Rp)', type: 'currency', options: null, required: false, help: '', active: true, roster_group: '' },
    { question_id: 'r29d', jenis: 'usaha', order: 18, label: 'Persentase modal dari korporasi non-publik (bukan koperasi) (Rp)', type: 'currency', options: null, required: false, help: '', active: true, roster_group: '' },
    { question_id: 'catatan_usaha', jenis: 'usaha', order: 19, label: 'Catatan pemeriksa', type: 'textarea', options: null, required: false, help: '', active: true, roster_group: '' },
    // ---- KELUARGA (field datar) ----
    { question_id: 'b1r13_1', jenis: 'keluarga', order: 1, label: 'Umur Kepala Keluarga (tahun)', type: 'number', options: null, required: true, help: '', active: true, roster_group: '' },
    { question_id: 'b4r3a', jenis: 'keluarga', order: 2, label: 'Status kepemilikan bangunan tempat tinggal yang ditempati', type: 'select', options: [{ value: 1, label: 'Milik sendiri' }, { value: 2, label: 'Kontrak/sewa' }, { value: 3, label: 'Bebas sewa' }, { value: 4, label: 'Dinas' }, { value: 5, label: 'Lainnya' }], required: true, help: '', active: true, roster_group: '' },
    { question_id: 'b4r5', jenis: 'keluarga', order: 3, label: 'Luas lantai bangunan tempat tinggal (m²)', type: 'number', options: null, required: true, help: '', active: true, roster_group: '' },
    { question_id: 'b4r13', jenis: 'keluarga', order: 4, label: 'Sumber penerangan utama', type: 'select', options: [{ value: 1, label: 'Listrik PLN dengan meteran' }, { value: 2, label: 'Listrik PLN tanpa meteran' }, { value: 3, label: 'Listrik non-PLN' }, { value: 4, label: 'Bukan listrik' }], required: false, help: '', active: true, roster_group: '' },
    { question_id: 'b4r14a', jenis: 'keluarga', order: 5, label: 'Jumlah meteran listrik PLN', type: 'number', options: null, required: false, help: 'Isi jika sumber penerangan PLN dengan meteran', active: true, roster_group: '' },
    { question_id: 'b4r15a', jenis: 'keluarga', order: 6, label: 'Pengeluaran listrik sebulan (Rp)', type: 'currency', options: null, required: false, help: '', active: true, roster_group: '' },
    { question_id: 'b4r16a', jenis: 'keluarga', order: 7, label: 'Pengeluaran makanan seminggu (Rp)', type: 'currency', options: null, required: false, help: '', active: true, roster_group: '' },
    { question_id: 'b4r16b', jenis: 'keluarga', order: 8, label: 'Pengeluaran bukan makanan sebulan (Rp)', type: 'currency', options: null, required: false, help: '', active: true, roster_group: '' },
    { question_id: 'b4r16c', jenis: 'keluarga', order: 9, label: 'Pengeluaran tahunan — pendidikan, pajak, dll (Rp)', type: 'currency', options: null, required: false, help: '', active: true, roster_group: '' },
    { question_id: 'b4r17c', jenis: 'keluarga', order: 10, label: 'Jumlah mobil yang dimiliki', type: 'number', options: null, required: false, help: '', active: true, roster_group: '' },
    { question_id: 'b4r17d', jenis: 'keluarga', order: 11, label: 'Jumlah AC yang dimiliki', type: 'number', options: null, required: false, help: '', active: true, roster_group: '' },
    { question_id: 'b4r17f', jenis: 'keluarga', order: 12, label: 'Jumlah pemanas air (water heater) yang dimiliki', type: 'number', options: null, required: false, help: '', active: true, roster_group: '' },
    { question_id: 'catatan_keluarga', jenis: 'keluarga', order: 13, label: 'Catatan pemeriksa', type: 'textarea', options: null, required: false, help: '', active: true, roster_group: '' },
    // Soft-deleted: TIDAK boleh tampil di kuesioner baru.
    { question_id: 'catatan_lama', jenis: 'keluarga', order: 14, label: '(NONAKTIF) Kolom catatan versi lama', type: 'textarea', options: null, required: false, help: '', active: false, roster_group: '' },
    // ---- KELUARGA (roster anggota_keluarga) ----
    { question_id: 'b1r6_n', jenis: 'keluarga', order: 20, label: 'Nama anggota keluarga', type: 'text', options: null, required: true, help: '', active: true, roster_group: 'anggota_keluarga' },
    { question_id: 'b1r8_n', jenis: 'keluarga', order: 21, label: 'Hubungan dengan kepala keluarga', type: 'select', options: [{ value: 1, label: 'Kepala Keluarga' }, { value: 2, label: 'Istri/Suami' }, { value: 3, label: 'Anak' }, { value: 9, label: 'Lainnya' }], required: true, help: '', active: true, roster_group: 'anggota_keluarga' },
    { question_id: 'b1r9_n', jenis: 'keluarga', order: 22, label: 'Status keberadaan anggota', type: 'select', options: [{ value: 1, label: 'Tinggal di keluarga ini' }, { value: 2, label: 'Meninggal' }, { value: 3, label: 'Pindah' }, { value: 4, label: 'Tidak ditemukan' }, { value: 5, label: 'Anggota baru' }], required: false, help: '', active: true, roster_group: 'anggota_keluarga' },
    { question_id: 'b1r11_n', jenis: 'keluarga', order: 23, label: 'Status perkawinan', type: 'select', options: [{ value: 1, label: 'Belum kawin' }, { value: 2, label: 'Kawin' }, { value: 3, label: 'Cerai hidup' }, { value: 4, label: 'Cerai mati' }], required: false, help: '', active: true, roster_group: 'anggota_keluarga' },
    { question_id: 'b3r18a_n', jenis: 'keluarga', order: 24, label: 'Pendapatan dari bekerja sebulan (Rp)', type: 'currency', options: null, required: false, help: '', active: true, roster_group: 'anggota_keluarga' },
    { question_id: 'b3r18b_n', jenis: 'keluarga', order: 25, label: 'Pendapatan kepemilikan & investasi sebulan (Rp)', type: 'currency', options: null, required: false, help: '', active: true, roster_group: 'anggota_keluarga' },
    { question_id: 'b3r18c_n', jenis: 'keluarga', order: 26, label: 'Pendapatan transfer/pensiun/lainnya sebulan (Rp)', type: 'currency', options: null, required: false, help: '', active: true, roster_group: 'anggota_keluarga' },
    { question_id: 'b3r20a_n', jenis: 'keluarga', order: 27, label: 'Mengalami kesulitan melihat', type: 'select', options: [{ value: 1, label: 'Ya' }, { value: 2, label: 'Tidak' }], required: false, help: '', active: true, roster_group: 'anggota_keluarga' },
    { question_id: 'b3r20b_n', jenis: 'keluarga', order: 28, label: 'Mengalami kesulitan mendengar', type: 'select', options: [{ value: 1, label: 'Ya' }, { value: 2, label: 'Tidak' }], required: false, help: '', active: true, roster_group: 'anggota_keluarga' },
    { question_id: 'b3r20c_n', jenis: 'keluarga', order: 29, label: 'Mengalami kesulitan berjalan/naik tangga', type: 'select', options: [{ value: 1, label: 'Ya' }, { value: 2, label: 'Tidak' }], required: false, help: '', active: true, roster_group: 'anggota_keluarga' },
    { question_id: 'b3r20d_n', jenis: 'keluarga', order: 30, label: 'Mengalami kesulitan mengingat/berkonsentrasi', type: 'select', options: [{ value: 1, label: 'Ya' }, { value: 2, label: 'Tidak' }], required: false, help: '', active: true, roster_group: 'anggota_keluarga' },
    { question_id: 'b3r20e_n', jenis: 'keluarga', order: 31, label: 'Mengalami kesulitan mengurus diri sendiri', type: 'select', options: [{ value: 1, label: 'Ya' }, { value: 2, label: 'Tidak' }], required: false, help: '', active: true, roster_group: 'anggota_keluarga' },
    { question_id: 'b3r20f_n', jenis: 'keluarga', order: 32, label: 'Mengalami kesulitan berkomunikasi', type: 'select', options: [{ value: 1, label: 'Ya' }, { value: 2, label: 'Tidak' }], required: false, help: '', active: true, roster_group: 'anggota_keluarga' },
    // ---- KELUARGA (roster meteran_listrik) ----
    // Skip-pattern (relevan hanya kalau b4r13=1, jumlah baris mengikuti b4r14a)
    // BELUM di-enforce di UI v1 — baris bebas ditambah; rule K6 sudah
    // mengunci lewat kondisi b4r14a di `when`.
    { question_id: 'b4r14b_n', jenis: 'keluarga', order: 40, label: 'Daya per meteran listrik', type: 'select', options: [{ value: 1, label: '450 VA' }, { value: 2, label: '900 VA' }, { value: 3, label: '1300 VA' }, { value: 4, label: 'Lebih dari 1300 VA' }], required: false, help: 'Isi jika sumber penerangan PLN dengan meteran', active: true, roster_group: 'meteran_listrik' }
  ],

  // 15 rule aktif: 14 hasil terjemahan `Identifikasi` → `when` (lihat CLAUDE.md
  // "Progress terjemahan") + U9 (rasio NTB, ditambahkan 2026-07-09). U8
  // EXCLUDED dari v1 (butuh agregasi lintas-record + data SBR eksternal).
  // `when` di mock = OBJEK; kolom sheet Fase 5 berisi string JSON — evaluator
  // menerima keduanya.
  RULES: [
    // ---- USAHA ----
    { rule_id: 'U1', jenis: 'usaha', severity: 'warning', message: 'Biaya Produksi Dominan: usaha perdagangan tetapi biaya produksi lebih dari 50% total biaya', active: true,
      when: { all: [{ field: 'r13b1', op: '==', value: 2 }, { field: 'pangsa_biaya_produksi', op: '>', value: 0.5 }] } },
    { rule_id: 'U2', jenis: 'usaha', severity: 'warning', message: 'Keuntungan Usaha: pendapatan setahun lebih kecil dari total biaya (usaha rugi)', active: true,
      when: { field: 'r27c', op: '<', field2: 'r26_total' } },
    { rule_id: 'U3', jenis: 'usaha', severity: 'error', message: 'Penyertaan Modal Korporasi: usaha tidak berbadan usaha tetapi menerima penyertaan modal', active: true,
      when: { all: [{ field: 'r11a', op: '==', value: 13 }, { any: [{ field: 'r29c', op: '>', value: 0 }, { field: 'r29d', op: '>', value: 0 }] }] } },
    { rule_id: 'U4', jenis: 'usaha', severity: 'warning', message: 'Data Keuangan MBG: rasio pendapatan terhadap total biaya tidak wajar (≥ 1,25 atau < 1)', active: true,
      when: { all: [{ field: 'r22', op: '==', value: 1 }, { any: [{ field: 'rasio_pendapatan_biaya', op: '>=', value: 1.25 }, { field: 'rasio_pendapatan_biaya', op: '<', value: 1 }] }] } },
    // r24c1 = "Total pekerja" (jumlah pekerja, BUKAN lagi "mitra MBG Ya/Tidak"
    // seperti sebelumnya — field ini direvisi user 2026-07-09 di tab
    // Questions). Kondisi & pesan disesuaikan: aset besar tapi CUMA 1 pekerja
    // dan pendapatan tak sepadan = mismatch skala aset vs operasi riil.
    { rule_id: 'U5', jenis: 'usaha', severity: 'warning', message: 'Hubungan Aset/Pekerja/Produksi: aset usaha besar tetapi hanya 1 pekerja dan pendapatan tidak sepadan', active: true,
      when: { all: [{ field: 'r28c', op: '>', value: 10000000 }, { field: 'r24c1', op: '==', value: 1 }, { field: 'r27c', op: '<', value: 60000000 }] } },
    { rule_id: 'U6', jenis: 'usaha', severity: 'warning', message: 'Penggunaan Internet Usaha Menengah-Besar: usaha besar tidak menggunakan internet', active: true,
      when: { all: [{ field: 'r16a', op: '==', value: 2 }, { field: 'r25', op: '<', value: 2026 }, { field: 'r27c', op: '>=', value: 15000000000 }] } },
    { rule_id: 'U7', jenis: 'usaha', severity: 'warning', message: 'Laporan Keuangan Usaha Menengah-Besar: usaha besar tidak menyusun laporan keuangan', active: true,
      when: { all: [{ field: 'r11d', op: '==', value: 2 }, { field: 'r25', op: '<', value: 2026 }, { field: 'r27c', op: '>=', value: 15000000000 }] } },
    // rasio_ntb = (r27c − r26_total) ÷ r27c; batas_rasio_ntb = lookup kode
    // KBLI r13g di tab "Rasio NTB SE2016" (keduanya computed saat submit,
    // lihat ComputedFields). Kode tanpa baris di tab itu → batas null → rule
    // tidak berlaku (evaluator: nilai kosong = false).
    { rule_id: 'U9', jenis: 'usaha', severity: 'warning', message: 'Rasio NTB Tinggi: (pendapatan − total biaya) ÷ pendapatan melebihi batas rasio NTB SE2016 untuk KBLI usaha ini', active: true,
      when: { field: 'rasio_ntb', op: '>', field2: 'batas_rasio_ntb' } },
    // ---- KELUARGA ----
    { rule_id: 'K1', jenis: 'keluarga', severity: 'error', message: 'Status Cerai/Belum Kawin: pasangan suami/istri (anggota ke-1 & ke-2) berstatus bukan kawin', active: true,
      when: { field: 'k1_pasutri_tidak_kawin', op: '==', value: 1 } },
    { rule_id: 'K2', jenis: 'keluarga', severity: 'error', message: 'Kepala Keluarga <10 Th di Rumah Sendiri: umur kepala keluarga di bawah 10 tahun dengan rumah milik sendiri', active: true,
      when: { all: [{ field: 'b1r13_1', op: '<', value: 10 }, { field: 'b4r3a', op: '==', value: 1 }] } },
    { rule_id: 'K3', jenis: 'keluarga', severity: 'warning', message: 'Semua Anggota Keluarga Disabilitas (lebih dari 1 anggota)', active: true,
      when: { all: [
        { field: 'b1r9', op: '>', value: 1 },
        { roster_all: 'anggota_keluarga', condition: { any: [
          { field: 'b3r20a_n', op: '==', value: 1 }, { field: 'b3r20b_n', op: '==', value: 1 },
          { field: 'b3r20c_n', op: '==', value: 1 }, { field: 'b3r20d_n', op: '==', value: 1 },
          { field: 'b3r20e_n', op: '==', value: 1 }, { field: 'b3r20f_n', op: '==', value: 1 }
        ] } }
      ] } },
    { rule_id: 'K4', jenis: 'keluarga', severity: 'warning', message: 'Luas Lantai Ekstrem: luas per kapita di bawah 3 m² atau di atas 200 m²', active: true,
      when: { any: [{ field: 'luas_per_kapita', op: '<', value: 3 }, { field: 'luas_per_kapita', op: '>', value: 200 }] } },
    { rule_id: 'K5', jenis: 'keluarga', severity: 'warning', message: 'Selisih Pendapatan Negatif: total pendapatan sebulan lebih kecil dari total pengeluaran sebulan', active: true,
      when: { field: 'b3r18c', op: '<', field2: 'b4r16' } },
    { rule_id: 'K6', jenis: 'keluarga', severity: 'warning', message: 'Listrik Rendah & Ada Barang Mewah', active: true,
      when: { all: [
        { any: [
          { field: 'b4r15a', op: '<', value: 100000 },
          { all: [{ field: 'b4r14a', op: '==', value: 1 }, { roster_any: 'meteran_listrik', condition: { field: 'b4r14b_n', op: '==', value: 1 } }] }
        ] },
        { any: [{ field: 'b4r17c', op: '>', value: 0 }, { field: 'b4r17d', op: '>', value: 0 }, { field: 'b4r17f', op: '>', value: 0 }] }
      ] } },
    { rule_id: 'K7', jenis: 'keluarga', severity: 'warning', message: 'Jumlah Anggota Keluarga Ekstrem: lebih dari 10 anggota', active: true,
      when: { field: 'b1r9', op: '>', value: 10 } },
    // Soft-deleted: TIDAK boleh pernah jalan saat submit (uji filter active).
    { rule_id: 'K99', jenis: 'keluarga', severity: 'error', message: '(NONAKTIF) Rule uji soft-delete — kalau anomali ini muncul, filter active bocor', active: false,
      when: { field: 'b1r13_1', op: 'not_empty' } }
  ]
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = MockData;
}
