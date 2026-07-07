/**
 * MockData — pengganti in-memory tab Google Sheets untuk Fase 0-4.
 * Struktur & nama kolom PERSIS mengikuti sheet asli, supaya swap ke
 * SpreadsheetApp di Fase 5 tidak mengubah bentuk data yang mengalir.
 * GUARDRAIL: semua kode wilayah (kdkec, kddesa, kdsls, kdsubsls) STRING.
 *
 * Catatan: tab Records TIDAK di sini — variabel global GAS tidak bertahan
 * antar panggilan google.script.run, jadi Records disimpan di
 * PropertiesService (lihat DataAccess).
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

  // Subset representatif dari 64 pertanyaan riil (alias asli SE2026).
  // options untuk select = array {value, label} (hasil parse kolom `kategori`
  // gaya "1. Label\n2. Label" — parsing aslinya urusan Fase 5).
  QUESTIONS: [
    // ---- USAHA ----
    { question_id: 'nama_usaha', jenis: 'usaha', order: 1, label: 'Nama usaha/perusahaan', type: 'text', options: null, required: true, help: 'Sesuai papan nama atau izin usaha', active: true, roster_group: '' },
    { question_id: 'r11a', jenis: 'usaha', order: 2, label: 'Bentuk badan usaha', type: 'select', options: [{ value: 1, label: 'PT' }, { value: 2, label: 'CV' }, { value: 3, label: 'Koperasi' }, { value: 13, label: 'Tidak berbadan usaha' }], required: true, help: '', active: true, roster_group: '' },
    { question_id: 'r13b1', jenis: 'usaha', order: 3, label: 'Jenis kegiatan utama usaha', type: 'select', options: [{ value: 1, label: 'Menghasilkan barang' }, { value: 2, label: 'Menjual/memperdagangkan barang' }, { value: 3, label: 'Menyediakan jasa' }], required: true, help: '', active: true, roster_group: '' },
    { question_id: 'r16a', jenis: 'usaha', order: 4, label: 'Menggunakan internet dalam kegiatan usaha', type: 'select', options: [{ value: 1, label: 'Ya' }, { value: 2, label: 'Tidak' }], required: false, help: '', active: true, roster_group: '' },
    { question_id: 'r22', jenis: 'usaha', order: 5, label: 'Melakukan pembukuan/pencatatan keuangan', type: 'select', options: [{ value: 1, label: 'Ya' }, { value: 2, label: 'Tidak' }], required: false, help: '', active: true, roster_group: '' },
    { question_id: 'r25', jenis: 'usaha', order: 6, label: 'Tahun mulai beroperasi', type: 'number', options: null, required: true, help: 'Empat digit tahun, mis. 2019', active: true, roster_group: '' },
    { question_id: 'r26b', jenis: 'usaha', order: 7, label: 'Biaya bahan baku/produksi setahun (Rp)', type: 'number', options: null, required: false, help: '', active: true, roster_group: '' },
    { question_id: 'r27c', jenis: 'usaha', order: 8, label: 'Pendapatan usaha setahun (Rp)', type: 'number', options: null, required: true, help: '', active: true, roster_group: '' },
    { question_id: 'r28c', jenis: 'usaha', order: 9, label: 'Perkiraan nilai aset usaha (Rp)', type: 'number', options: null, required: false, help: '', active: true, roster_group: '' },
    { question_id: 'catatan_usaha', jenis: 'usaha', order: 10, label: 'Catatan pemeriksa', type: 'textarea', options: null, required: false, help: '', active: true, roster_group: '' },
    // ---- KELUARGA (field datar) ----
    { question_id: 'b1r13_1', jenis: 'keluarga', order: 1, label: 'Umur Kepala Keluarga (tahun)', type: 'number', options: null, required: true, help: '', active: true, roster_group: '' },
    { question_id: 'b4r3a', jenis: 'keluarga', order: 2, label: 'Status kepemilikan bangunan tempat tinggal yang ditempati', type: 'select', options: [{ value: 1, label: 'Milik sendiri' }, { value: 2, label: 'Kontrak/sewa' }, { value: 3, label: 'Bebas sewa' }, { value: 4, label: 'Dinas' }, { value: 5, label: 'Lainnya' }], required: true, help: '', active: true, roster_group: '' },
    { question_id: 'b4r5', jenis: 'keluarga', order: 3, label: 'Luas lantai bangunan tempat tinggal (m²)', type: 'number', options: null, required: true, help: '', active: true, roster_group: '' },
    { question_id: 'b4r13', jenis: 'keluarga', order: 4, label: 'Sumber penerangan utama', type: 'select', options: [{ value: 1, label: 'Listrik PLN dengan meteran' }, { value: 2, label: 'Listrik PLN tanpa meteran' }, { value: 3, label: 'Listrik non-PLN' }, { value: 4, label: 'Bukan listrik' }], required: false, help: '', active: true, roster_group: '' },
    { question_id: 'b4r15a', jenis: 'keluarga', order: 5, label: 'Pengeluaran listrik sebulan (Rp)', type: 'number', options: null, required: false, help: '', active: true, roster_group: '' },
    { question_id: 'b4r16a', jenis: 'keluarga', order: 6, label: 'Pengeluaran makanan seminggu (Rp)', type: 'number', options: null, required: false, help: '', active: true, roster_group: '' },
    { question_id: 'b4r16b', jenis: 'keluarga', order: 7, label: 'Pengeluaran bukan makanan sebulan (Rp)', type: 'number', options: null, required: false, help: '', active: true, roster_group: '' },
    { question_id: 'catatan_keluarga', jenis: 'keluarga', order: 8, label: 'Catatan pemeriksa', type: 'textarea', options: null, required: false, help: '', active: true, roster_group: '' },
    // Soft-deleted: TIDAK boleh tampil di kuesioner baru.
    { question_id: 'catatan_lama', jenis: 'keluarga', order: 9, label: '(NONAKTIF) Kolom catatan versi lama', type: 'textarea', options: null, required: false, help: '', active: false, roster_group: '' },
    // ---- KELUARGA (roster anggota_keluarga) ----
    { question_id: 'b1r6_n', jenis: 'keluarga', order: 10, label: 'Nama anggota keluarga', type: 'text', options: null, required: true, help: '', active: true, roster_group: 'anggota_keluarga' },
    { question_id: 'b1r8_n', jenis: 'keluarga', order: 11, label: 'Hubungan dengan kepala keluarga', type: 'select', options: [{ value: 1, label: 'Kepala Keluarga' }, { value: 2, label: 'Istri/Suami' }, { value: 3, label: 'Anak' }, { value: 9, label: 'Lainnya' }], required: true, help: '', active: true, roster_group: 'anggota_keluarga' },
    { question_id: 'b1r11_n', jenis: 'keluarga', order: 12, label: 'Status perkawinan', type: 'select', options: [{ value: 1, label: 'Belum kawin' }, { value: 2, label: 'Kawin' }, { value: 3, label: 'Cerai hidup' }, { value: 4, label: 'Cerai mati' }], required: false, help: '', active: true, roster_group: 'anggota_keluarga' },
    { question_id: 'b3r20a_n', jenis: 'keluarga', order: 13, label: 'Mengalami kesulitan melihat', type: 'select', options: [{ value: 1, label: 'Ya' }, { value: 2, label: 'Tidak' }], required: false, help: '', active: true, roster_group: 'anggota_keluarga' }
  ],
  RULES: []
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = MockData;
}
