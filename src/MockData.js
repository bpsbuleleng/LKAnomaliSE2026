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

  QUESTIONS: [],
  RULES: []
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = MockData;
}
