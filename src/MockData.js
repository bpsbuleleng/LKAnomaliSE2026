/**
 * MockData — pengganti in-memory tab Google Sheets untuk Fase 0-4.
 * Struktur & nama kolom PERSIS mengikuti sheet asli, supaya swap ke
 * SpreadsheetApp di Fase 5 tidak mengubah bentuk data yang mengalir.
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
    }
  ],

  ALOKASI_WILAYAH: [
    {
      idsubsls: '5108010001000101',
      kdprov: '51', kdkab: '08', kdkec: '010', kddesa: '001', kdsls: '0001', kdsubsls: '01',
      nmprov: 'Bali', nmkab: 'Buleleng', nmkec: 'Gerokgak', nmdesa: 'Sumberklampok',
      nmsls: 'Banjar Dinas Sumber Batok',
      nmppl: 'Abdul Basit', nmpml: 'Ketut Suryanta Putra',
      emailppl: 'abdulbasit081194@gmail.com', emailpml: 'akusury336@gmail.com'
    },
    {
      idsubsls: '5108010002000101',
      kdprov: '51', kdkab: '08', kdkec: '010', kddesa: '002', kdsls: '0001', kdsubsls: '01',
      nmprov: 'Bali', nmkab: 'Buleleng', nmkec: 'Gerokgak', nmdesa: 'Sumberkima',
      nmsls: 'Banjar Dinas Kertha Kusuma',
      nmppl: 'NI MADE RUSPINI', nmpml: 'KADEK BUDIANA',
      emailppl: 'ruspininimade@gmail.com', emailpml: 'kadekbudiana74@gmail.com'
    }
  ],

  RECORDS: [],
  QUESTIONS: [],
  RULES: []
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = MockData;
}
