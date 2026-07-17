const { test } = require('node:test');
const assert = require('node:assert/strict');

const loadHtmlScript = require('./helpers/loadHtmlScript.js');
const VizLogic = loadHtmlScript('src/VizLogic.html');
const VizData = require('../src/VizData.js');

// ---- fixture: record bentuk payload VizData.forDashboard ----

function rec(over) {
  const base = {
    jenis: 'keluarga',
    status: 'submitted',
    wilayah: {
      idsubsls: '5108010002000101',
      kdkec: '010', nmkec: 'Gerokgak', kddesa: '002', nmdesa: 'Sumberkima',
      kdsls: '0001', nmsls: 'Banjar Dinas Kertha Kusuma', kdsubsls: '01',
      nmppl: 'NI MADE RUSPINI', nmpml: 'KADEK BUDIANA',
      emailppl: 'ruspininimade@gmail.com', emailpml: 'kadekbudiana74@gmail.com'
    },
    answers: {},
    anomali_count: 0
  };
  const out = Object.assign({}, base, over || {});
  out.wilayah = Object.assign({}, base.wilayah, (over && over.wilayah) || {});
  return out;
}

const Q_SELECT = {
  question_id: 'b4r3a', jenis: 'keluarga', type: 'select', roster_group: '',
  options: [{ value: 1, label: 'Milik sendiri' }, { value: 2, label: 'Kontrak/sewa' }]
};
const Q_NUM = { question_id: 'b4r5', jenis: 'keluarga', type: 'number', roster_group: '', options: null };
const Q_ROSTER = {
  question_id: 'b1r8_n', jenis: 'keluarga', type: 'select', roster_group: 'anggota_keluarga',
  options: [{ value: 1, label: 'Kepala Keluarga' }, { value: 2, label: 'Istri/Suami' }]
};
const Q_TEXT = { question_id: 'nama_usaha', jenis: 'usaha', type: 'text', roster_group: '', options: null };

// ==== VizData (server, pure) ====

test('VizData.forDashboard: ringkas record + anomali_count, kode wilayah tetap string', () => {
  const out = VizData.forDashboard([{
    record_id: 'R-1', pml_email: 'x@y.z', jenis: 'usaha', status: 'submitted',
    wilayah: { kdkec: '010', nmkec: 'Gerokgak', kddesa: '002', kdsls: '0001', kdsubsls: '01', idsubsls: '5108010002000101' },
    answers: { r25: 2019 },
    anomalies: [{ rule_id: 'U2' }, { rule_id: 'U9' }],
    created_at: 'x', updated_at: 'y'
  }]);
  assert.equal(out.length, 1);
  assert.equal(out[0].anomali_count, 2);
  // identitas anomali ikut (dipakai filter per anomali di dashboard)
  assert.deepEqual(out[0].anomalies.map((a) => a.rule_id), ['U2', 'U9']);
  assert.equal(out[0].wilayah.kdkec, '010');
  assert.deepEqual(out[0].answers, { r25: 2019 });
  assert.equal(out[0].record_id, undefined); // payload ramping: tanpa identitas record
  assert.equal(out[0].pml_email, undefined);
});

// ==== filter ====

test('matchesFilters: default hanya submitted; includeDraft menyertakan draft', () => {
  const draft = rec({ status: 'draft' });
  assert.equal(VizLogic.matchesFilters(draft, { jenis: 'keluarga' }), false);
  assert.equal(VizLogic.matchesFilters(draft, { jenis: 'keluarga', includeDraft: true }), true);
});

test('matchesFilters: jenis, wilayah bertingkat, pml/ppl', () => {
  const r = rec({});
  assert.equal(VizLogic.matchesFilters(r, { jenis: 'usaha' }), false);
  assert.equal(VizLogic.matchesFilters(r, { kdkec: '010' }), true);
  assert.equal(VizLogic.matchesFilters(r, { kdkec: '020' }), false);
  assert.equal(VizLogic.matchesFilters(r, { kdkec: '010', kddesa: '002', kdsls: '0001' }), true);
  assert.equal(VizLogic.matchesFilters(r, { pml: 'kadekbudiana74@gmail.com' }), true);
  assert.equal(VizLogic.matchesFilters(r, { ppl: 'lain@gmail.com' }), false);
});

test('pplKey: fallback ke nama saat emailppl kosong (kasus riil 5 baris)', () => {
  const r = rec({ wilayah: { emailppl: '', nmppl: 'GEDE SUARDANA' } });
  assert.equal(VizLogic.pplKey(r), 'GEDE SUARDANA');
  assert.equal(VizLogic.matchesFilters(r, { ppl: 'GEDE SUARDANA' }), true);
});

test('filterOptions: desa dibatasi kecamatan terpilih; kode desa sama beda kecamatan tidak bocor', () => {
  const records = [
    rec({}),
    rec({ wilayah: { kdkec: '020', nmkec: 'Seririt', kddesa: '001', nmdesa: 'Lokapaksa', kdsls: '0001', nmsls: 'Delod Margi' } }),
    rec({ wilayah: { kddesa: '001', nmdesa: 'Sumberklampok' } })
  ];
  const all = VizLogic.filterOptions(records, {});
  assert.deepEqual(all.kec.map((o) => o.kode), ['010', '020']);
  const scoped = VizLogic.filterOptions(records, { kdkec: '010' });
  assert.deepEqual(scoped.desa.map((o) => o.nama).sort(), ['Sumberkima', 'Sumberklampok']);
  const seririt = VizLogic.filterOptions(records, { kdkec: '020' });
  assert.deepEqual(seririt.desa.map((o) => o.nama), ['Lokapaksa']);
});

test('filter anomali: __any__/__none__/rule_id spesifik', () => {
  const bersih = rec({});
  const kena = rec({ anomali_count: 2, anomalies: [{ rule_id: 'K1', severity: 'error', message: 'Status Cerai/Belum Kawin: x' }, { rule_id: 'K7', severity: 'warning', message: 'Jumlah Anggota Keluarga Ekstrem: y' }] });
  assert.equal(VizLogic.matchesFilters(bersih, { anomali: '__none__' }), true);
  assert.equal(VizLogic.matchesFilters(kena, { anomali: '__none__' }), false);
  assert.equal(VizLogic.matchesFilters(bersih, { anomali: '__any__' }), false);
  assert.equal(VizLogic.matchesFilters(kena, { anomali: '__any__' }), true);
  assert.equal(VizLogic.matchesFilters(kena, { anomali: 'K1' }), true);
  assert.equal(VizLogic.matchesFilters(kena, { anomali: 'K5' }), false);
});

test('filterOptions: daftar anomali dari record se-scope wilayah, urut rule_id', () => {
  const records = [
    rec({ anomalies: [{ rule_id: 'K7', severity: 'warning', message: 'K7 msg' }] }),
    rec({ anomalies: [{ rule_id: 'K1', severity: 'error', message: 'K1 msg' }] }),
    rec({
      wilayah: { kdkec: '020', nmkec: 'Seririt' },
      anomalies: [{ rule_id: 'K5', severity: 'warning', message: 'K5 msg' }]
    })
  ];
  const all = VizLogic.filterOptions(records, {});
  assert.deepEqual(all.anomali.map((o) => o.kode), ['K1', 'K5', 'K7']);
  // scope kecamatan 010 → K5 (milik Seririt) tidak ikut
  const scoped = VizLogic.filterOptions(records, { kdkec: '010' });
  assert.deepEqual(scoped.anomali.map((o) => o.kode), ['K1', 'K7']);
});

test('summary ikut menghormati filter anomali', () => {
  const records = [
    rec({ anomali_count: 1, anomalies: [{ rule_id: 'K1', severity: 'error', message: 'x' }] }),
    rec({})
  ];
  const s = VizLogic.summary(records, { jenis: 'keluarga', anomali: 'K1' });
  assert.deepEqual(s, { total: 1, submitted: 1, draft: 0, anomali: 1 });
});

test('summary: pecah submitted/draft + total anomali submitted saja', () => {
  const records = [
    rec({ anomali_count: 2 }),
    rec({ status: 'draft', anomali_count: 9 }), // draft tak dihitung anomalinya
    rec({ jenis: 'usaha', anomali_count: 1 })
  ];
  const s = VizLogic.summary(records, { jenis: 'keluarga' });
  assert.deepEqual(s, { total: 2, submitted: 1, draft: 1, anomali: 2 });
});

// ==== nilai per butir ====

test('questionValues non-roster: nilai kosong/absen terhitung empty', () => {
  const records = [
    rec({ answers: { b4r5: 80 } }),
    rec({ answers: { b4r5: '' } }),
    rec({ answers: {} })
  ];
  const v = VizLogic.questionValues(records, Q_NUM);
  assert.deepEqual(v.values, [80]);
  assert.equal(v.empty, 2);
  assert.equal(v.rows, 3);
});

test('questionValues roster: unit analisis = baris roster', () => {
  const records = [
    rec({ answers: { roster: { anggota_keluarga: [{ b1r8_n: 1 }, { b1r8_n: 2 }, {}] } } }),
    rec({ answers: {} }) // tanpa roster → 0 baris
  ];
  const v = VizLogic.questionValues(records, Q_ROSTER);
  assert.deepEqual(v.values, [1, 2]);
  assert.equal(v.empty, 1);
  assert.equal(v.rows, 3);
});

test('optionCounts: urutan mengikuti opsi, cocok lintas tipe (angka vs string), sisanya other', () => {
  const oc = VizLogic.optionCounts([1, '1', 2, 7], Q_SELECT.options);
  assert.deepEqual(oc.items.map((i) => i.count), [2, 1]);
  assert.equal(oc.other, 1);
});

test('topValues: urut count desc lalu alfabet, sisa masuk otherCount', () => {
  const tv = VizLogic.topValues(['b', 'a', 'b', 'c', 'a', 'b', ' '], 2);
  assert.deepEqual(tv.items, [{ value: 'b', count: 3 }, { value: 'a', count: 2 }]);
  assert.equal(tv.otherCount, 1);
  assert.equal(tv.uniqueCount, 3); // string spasi saja tidak dihitung
});

// ==== numerik ====

test('numericStats: n/min/max/mean/median/sum (median genap = rata dua tengah)', () => {
  const st = VizLogic.numericStats([4, 1, 3, 2]);
  assert.deepEqual(st, { n: 4, min: 1, max: 4, mean: 2.5, median: 2.5, sum: 10 });
  assert.equal(VizLogic.numericStats([]), null);
});

test('toNumbers: buang non-angka', () => {
  assert.deepEqual(VizLogic.toNumbers([1, '2', 'x', '', null, 0]), [1, 2, 0]);
});

test('histogram: bin cantik 1/2/5×10^k, nilai max masuk bin terakhir', () => {
  const h = VizLogic.histogram([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 5);
  assert.equal(h.step, 2);
  assert.equal(h.bins.length, 5);
  assert.equal(h.bins[0].x0, 0);
  const total = h.bins.reduce((a, b) => a + b.count, 0);
  assert.equal(total, 11);
  assert.equal(h.bins[4].count, 3); // 8, 9, 10 (max menempel bin terakhir)
});

test('histogram: semua nilai sama → satu bin tunggal', () => {
  const h = VizLogic.histogram([7, 7, 7]);
  assert.deepEqual(h.bins, [{ x0: 7, x1: 7, count: 3 }]);
});

// ==== tabulasi ====

const TAB_RECORDS = [
  rec({ answers: { b4r3a: 1, b4r5: 100 } }),
  rec({ answers: { b4r3a: 2, b4r5: 50 } }),
  rec({
    wilayah: { kdkec: '020', nmkec: 'Seririt', kddesa: '001', nmdesa: 'Lokapaksa', kdsls: '0002', nmsls: 'Delod Margi', nmppl: 'GEDE SUARDANA', emailppl: '', nmpml: 'KETUT S', emailpml: 'akusury336@gmail.com' },
    answers: { b4r3a: 1 }
  })
];

test('tabulate kategorik per kecamatan: kolom = kode opsi + Kosong + Total', () => {
  const t = VizLogic.tabulate(TAB_RECORDS, Q_SELECT, 'kec');
  assert.equal(t.kind, 'categorical');
  assert.deepEqual(t.columns, ['1', '2', 'Kosong', 'Total']);
  assert.deepEqual(t.rows.map((r) => r.label), ['Gerokgak', 'Seririt']);
  assert.deepEqual(t.rows[0].cells, [1, 1, 0, 2]);
  assert.deepEqual(t.rows[1].cells, [1, 0, 0, 1]);
  assert.deepEqual(t.total.cells, [2, 1, 0, 3]);
});

test('tabulate kategorik: kolom Lainnya muncul hanya kalau ada nilai di luar opsi', () => {
  const withOther = TAB_RECORDS.concat([rec({ answers: { b4r3a: 99 } })]);
  const t = VizLogic.tabulate(withOther, Q_SELECT, 'kec');
  assert.deepEqual(t.columns, ['1', '2', 'Lainnya', 'Kosong', 'Total']);
  assert.deepEqual(t.total.cells, [2, 1, 1, 0, 4]);
});

test('tabulate numerik per PML: sel angka mentah, grup kosong = null', () => {
  const t = VizLogic.tabulate(TAB_RECORDS, Q_NUM, 'pml');
  assert.equal(t.kind, 'numeric');
  assert.deepEqual(t.columns, ['N', 'Min', 'Median', 'Rata-rata', 'Maks', 'Jumlah']);
  const kadek = t.rows.find((r) => r.label === 'KADEK BUDIANA');
  assert.deepEqual(kadek.cells, [2, 50, 75, 75, 100, 150]);
  const ketut = t.rows.find((r) => r.label === 'KETUT S');
  assert.deepEqual(ketut.cells, [0, null, null, null, null, null]);
});

test('tabulate: desa kode sama di kecamatan berbeda TIDAK tergabung', () => {
  const records = [
    rec({ wilayah: { kdkec: '010', kddesa: '001', nmdesa: 'Sumberklampok' }, answers: { b4r3a: 1 } }),
    rec({ wilayah: { kdkec: '020', nmkec: 'Seririt', kddesa: '001', nmdesa: 'Lokapaksa' }, answers: { b4r3a: 1 } })
  ];
  const t = VizLogic.tabulate(records, Q_SELECT, 'desa');
  assert.equal(t.rows.length, 2);
});

test('tabulate teks per PPL: Terisi/Kosong/Total + fallback nama PPL tanpa email', () => {
  const records = [
    rec({ jenis: 'usaha', answers: { nama_usaha: 'Warung A' } }),
    rec({ jenis: 'usaha', wilayah: { nmppl: 'GEDE SUARDANA', emailppl: '' }, answers: {} })
  ];
  const t = VizLogic.tabulate(records, Q_TEXT, 'ppl');
  assert.equal(t.kind, 'text');
  assert.deepEqual(t.columns, ['Terisi', 'Kosong', 'Total']);
  const gede = t.rows.find((r) => r.label === 'GEDE SUARDANA');
  assert.deepEqual(gede.cells, [0, 1, 1]);
});

test('tabulate: record tanpa wilayah masuk grup "(tanpa wilayah)"', () => {
  const records = [rec({ wilayah: { kdkec: '', nmkec: '', kddesa: '', kdsls: '' } })];
  const t = VizLogic.tabulate(records, Q_SELECT, 'kec');
  assert.equal(t.rows[0].label, '(tanpa wilayah)');
});

// ==== kategori KBLI ====

test('kbliKategori: pemetaan golongan pokok → huruf (sama dengan r13h)', () => {
  assert.equal(VizLogic.kbliKategori('01111'), 'A');
  assert.equal(VizLogic.kbliKategori('10110'), 'C');
  assert.equal(VizLogic.kbliKategori('47111'), 'G');
  assert.equal(VizLogic.kbliKategori('99000'), 'U');
  assert.equal(VizLogic.kbliKategori('04999'), ''); // gap antar rentang
  assert.equal(VizLogic.kbliKategori('x'), '');
  assert.equal(VizLogic.kbliKategori(''), '');
});

// ==== filter nilai jawaban (click-to-filter) ====

test('answer filter eq non-roster: cocok lintas tipe angka/string', () => {
  const r = rec({ answers: { b4r3a: 1 } });
  assert.equal(VizLogic.answerFilterMatches(r, { qid: 'b4r3a', roster_group: '', kind: 'eq', value: '1' }), true);
  assert.equal(VizLogic.answerFilterMatches(r, { qid: 'b4r3a', roster_group: '', kind: 'eq', value: 2 }), false);
});

test('answer filter eq roster: cocok kalau ADA baris yang memenuhi', () => {
  const r = rec({ answers: { roster: { anggota_keluarga: [{ b1r8_n: 1 }, { b1r8_n: 3 }] } } });
  assert.equal(VizLogic.answerFilterMatches(r, { qid: 'b1r8_n', roster_group: 'anggota_keluarga', kind: 'eq', value: 3 }), true);
  assert.equal(VizLogic.answerFilterMatches(r, { qid: 'b1r8_n', roster_group: 'anggota_keluarga', kind: 'eq', value: 2 }), false);
});

test('answer filter empty & range (bin terakhir inklusif batas atas)', () => {
  const kosong = rec({ answers: {} });
  assert.equal(VizLogic.answerFilterMatches(kosong, { qid: 'b4r5', roster_group: '', kind: 'empty' }), true);
  const r = rec({ answers: { b4r5: 100 } });
  assert.equal(VizLogic.answerFilterMatches(r, { qid: 'b4r5', roster_group: '', kind: 'empty' }), false);
  assert.equal(VizLogic.answerFilterMatches(r, { qid: 'b4r5', roster_group: '', kind: 'range', x0: 50, x1: 100 }), false);
  assert.equal(VizLogic.answerFilterMatches(r, { qid: 'b4r5', roster_group: '', kind: 'range', x0: 50, x1: 100, incMax: true }), true);
  assert.equal(VizLogic.answerFilterMatches(r, { qid: 'b4r5', roster_group: '', kind: 'range', x0: 100, x1: 150 }), true);
});

test('answer filter kat: kategori huruf dari kode KBLI', () => {
  const r = rec({ jenis: 'usaha', answers: { r13g: '47111' } });
  assert.equal(VizLogic.answerFilterMatches(r, { qid: 'r13g', roster_group: '', kind: 'kat', value: 'G' }), true);
  assert.equal(VizLogic.answerFilterMatches(r, { qid: 'r13g', roster_group: '', kind: 'kat', value: 'A' }), false);
});

test('matchesAnswerFilters: OR di nilai qid sama, AND antar qid', () => {
  const r = rec({ answers: { b4r3a: 1, b4r5: 80 } });
  const eq1 = { qid: 'b4r3a', roster_group: '', kind: 'eq', value: 1 };
  const eq2 = { qid: 'b4r3a', roster_group: '', kind: 'eq', value: 2 };
  const range = { qid: 'b4r5', roster_group: '', kind: 'range', x0: 0, x1: 50 };
  assert.equal(VizLogic.matchesAnswerFilters(r, [eq2, eq1]), true); // OR: salah satu cukup
  assert.equal(VizLogic.matchesAnswerFilters(r, [eq1, range]), false); // AND: range gagal
  assert.equal(VizLogic.matchesAnswerFilters(r, []), true);
});

test('matchesAnswerFilters: eq + "Tidak diisi" (empty) qid sama tetap OR', () => {
  const terisi = rec({ answers: { b4r3a: 1 } });
  const kosong = rec({ answers: {} });
  const filters = [
    { qid: 'b4r3a', roster_group: '', kind: 'eq', value: 1 },
    { qid: 'b4r3a', roster_group: '', kind: 'empty' }
  ];
  assert.equal(VizLogic.matchesAnswerFilters(terisi, filters), true);
  assert.equal(VizLogic.matchesAnswerFilters(kosong, filters), true);
});

test('matchesAnswerFilters: kategori KBLI di-AND terhadap kode qid yang sama', () => {
  const a = rec({ jenis: 'usaha', answers: { r13g: '01122' } }); // kategori A
  const g = rec({ jenis: 'usaha', answers: { r13g: '47111' } }); // kategori G
  const filters = [
    { qid: 'r13g', roster_group: '', kind: 'kat', value: 'A' },
    { qid: 'r13g', roster_group: '', kind: 'eq', value: '01122' }
  ];
  assert.equal(VizLogic.matchesAnswerFilters(a, filters), true);
  assert.equal(VizLogic.matchesAnswerFilters(g, filters), false); // OR lama akan meloloskan semua A ∪ 01122
  const lainA = rec({ jenis: 'usaha', answers: { r13g: '01132' } });
  assert.equal(VizLogic.matchesAnswerFilters(lainA, filters), false); // A tapi bukan kode terpilih
});

test('filterRecords + summary ikut menghormati filter nilai jawaban', () => {
  const records = [
    rec({ answers: { b4r3a: 1 } }),
    rec({ answers: { b4r3a: 2 } }),
    rec({ status: 'draft', answers: { b4r3a: 1 } })
  ];
  const answers = [{ qid: 'b4r3a', roster_group: '', kind: 'eq', value: 1 }];
  assert.equal(VizLogic.filterRecords(records, { jenis: 'keluarga', answers }).length, 1);
  const s = VizLogic.summary(records, { jenis: 'keluarga', answers });
  assert.deepEqual(s, { total: 2, submitted: 1, draft: 1, anomali: 0 });
});

test('sameAnswerFilter: identitas untuk toggle', () => {
  const a = { qid: 'r27c', kind: 'range', x0: 0, x1: 100 };
  assert.equal(VizLogic.sameAnswerFilter(a, { qid: 'r27c', kind: 'range', x0: 0, x1: 100 }), true);
  assert.equal(VizLogic.sameAnswerFilter(a, { qid: 'r27c', kind: 'range', x0: 100, x1: 200 }), false);
  assert.equal(VizLogic.sameAnswerFilter(
    { qid: 'b4r3a', kind: 'eq', value: 1 }, { qid: 'b4r3a', kind: 'eq', value: '1' }), true);
});
