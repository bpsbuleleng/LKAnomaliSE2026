const { test } = require('node:test');
const assert = require('node:assert/strict');

const loadHtmlScript = require('./helpers/loadHtmlScript.js');
const AdminLogic = loadHtmlScript('src/AdminLogic.html');

// ==== parseOptionsText ⇄ optionsToText ====

test('parseOptionsText: format "1. Label", toleran ")" / tanpa titik, baris kosong dilewati', () => {
  const res = AdminLogic.parseOptionsText('1. Ya\n\n2) Tidak\n3 Mungkin\n');
  assert.deepEqual(res, {
    ok: true,
    options: [{ value: 1, label: 'Ya' }, { value: 2, label: 'Tidak' }, { value: 3, label: 'Mungkin' }]
  });
});

test('parseOptionsText: kosong / baris tanpa kode angka → error dengan nomor baris', () => {
  assert.equal(AdminLogic.parseOptionsText('').ok, false);
  assert.equal(AdminLogic.parseOptionsText('   \n  ').ok, false);
  const bad = AdminLogic.parseOptionsText('1. Ya\nTanpa kode');
  assert.equal(bad.ok, false);
  assert.match(bad.error, /Baris 2/);
});

test('optionsToText: round-trip', () => {
  const options = [{ value: 1, label: 'Ya' }, { value: 2, label: 'Tidak' }];
  assert.deepEqual(AdminLogic.parseOptionsText(AdminLogic.optionsToText(options)).options, options);
});

// ==== buildSimpleWhen ====

test('buildSimpleWhen: koersi angka utk field number/select; teks tetap string', () => {
  assert.deepEqual(AdminLogic.buildSimpleWhen('b4r5', '>', ' 500 ', { type: 'number' }).when,
    { field: 'b4r5', op: '>', value: 500 });
  assert.deepEqual(AdminLogic.buildSimpleWhen('b4r3a', '==', '1', { type: 'select' }).when,
    { field: 'b4r3a', op: '==', value: 1 });
  assert.deepEqual(AdminLogic.buildSimpleWhen('nama_usaha', '==', 'WARUNG', { type: 'text' }).when,
    { field: 'nama_usaha', op: '==', value: 'WARUNG' });
});

test('buildSimpleWhen: empty/not_empty tanpa value; in/not_in dari comma-list', () => {
  assert.deepEqual(AdminLogic.buildSimpleWhen('b4r13', 'empty', '', { type: 'select' }).when,
    { field: 'b4r13', op: 'empty' });
  assert.deepEqual(AdminLogic.buildSimpleWhen('b1r11_n', 'in', '1, 3, 4', { type: 'select' }).when,
    { field: 'b1r11_n', op: 'in', value: [1, 3, 4] });
});

test('buildSimpleWhen: penolakan — tanpa field, value kosong, angka rusak utk operator banding, regex rusak', () => {
  assert.equal(AdminLogic.buildSimpleWhen('', '>', '1', { type: 'number' }).ok, false);
  assert.equal(AdminLogic.buildSimpleWhen('b4r5', '>', '', { type: 'number' }).ok, false);
  assert.equal(AdminLogic.buildSimpleWhen('b4r5', '>', 'abc', { type: 'number' }).ok, false);
  assert.equal(AdminLogic.buildSimpleWhen('b4r5', 'regex', '(rusak', { type: 'text' }).ok, false);
});

// ==== parseAdvancedWhen ====

test('parseAdvancedWhen: JSON objek valid diterima; rusak/array/primitif ditolak', () => {
  const ok = AdminLogic.parseAdvancedWhen('{"all":[{"field":"a","op":"==","value":1}]}');
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.when.all[0].field, 'a');
  assert.equal(AdminLogic.parseAdvancedWhen('{rusak').ok, false);
  assert.equal(AdminLogic.parseAdvancedWhen('[1,2]').ok, false);
  assert.equal(AdminLogic.parseAdvancedWhen('"teks"').ok, false);
});

// ==== moveItem ====

test('moveItem: geser aman, array baru, di luar batas apa adanya', () => {
  const arr = ['a', 'b', 'c'];
  assert.deepEqual(AdminLogic.moveItem(arr, 0, 1), ['b', 'a', 'c']);
  assert.deepEqual(AdminLogic.moveItem(arr, 2, -1), ['a', 'c', 'b']);
  assert.deepEqual(AdminLogic.moveItem(arr, 0, -1), ['a', 'b', 'c']); // mentok atas
  assert.deepEqual(AdminLogic.moveItem(arr, 2, 1), ['a', 'b', 'c']);  // mentok bawah
  assert.deepEqual(arr, ['a', 'b', 'c']); // sumber tak berubah
});

// ==== moveToIndex (drag & drop) ====

test('moveToIndex: pindah maju/mundur jarak jauh, array baru, sumber utuh', () => {
  const arr = ['a', 'b', 'c', 'd'];
  assert.deepEqual(AdminLogic.moveToIndex(arr, 0, 3), ['b', 'c', 'd', 'a']); // depan → belakang
  assert.deepEqual(AdminLogic.moveToIndex(arr, 3, 0), ['d', 'a', 'b', 'c']); // belakang → depan
  assert.deepEqual(AdminLogic.moveToIndex(arr, 1, 2), ['a', 'c', 'b', 'd']); // geser 1
  assert.deepEqual(arr, ['a', 'b', 'c', 'd']); // sumber tak berubah
});

test('moveToIndex: to dijepit ke rentang; from di luar batas = apa adanya', () => {
  const arr = ['a', 'b', 'c'];
  assert.deepEqual(AdminLogic.moveToIndex(arr, 0, 99), ['b', 'c', 'a']); // to>panjang → akhir
  assert.deepEqual(AdminLogic.moveToIndex(arr, 2, -5), ['c', 'a', 'b']); // to<0 → awal
  assert.deepEqual(AdminLogic.moveToIndex(arr, 5, 0), ['a', 'b', 'c']);  // from asing
  assert.deepEqual(AdminLogic.moveToIndex(arr, 1, 1), ['a', 'b', 'c']);  // sama posisi
});

// ==== buildLeaf / buildSimpleGroup (multi-kondisi) ====

const metaOf = (id) => ({
  b4r5: { type: 'number' }, b1r9: { type: 'number' },
  b1r11_n: { type: 'select' }, b3r18c: { type: 'number' }, b4r16: { type: 'number' }
}[id] || null);

test('buildLeaf: value literal (koersi angka) & compare field2', () => {
  assert.deepEqual(AdminLogic.buildLeaf({ field: 'b4r5', op: '>', compare: 'value', value: '500' }, metaOf('b4r5')).when,
    { field: 'b4r5', op: '>', value: 500 });
  assert.deepEqual(AdminLogic.buildLeaf({ field: 'b3r18c', op: '<', compare: 'field', field2: 'b4r16' }, metaOf('b3r18c')).when,
    { field: 'b3r18c', op: '<', field2: 'b4r16' });
});

test('buildLeaf: tolak field2 sama dengan field utama, kosong, atau op non-perbandingan', () => {
  assert.equal(AdminLogic.buildLeaf({ field: 'b4r5', op: '<', compare: 'field', field2: 'b4r5' }, metaOf('b4r5')).ok, false);
  assert.equal(AdminLogic.buildLeaf({ field: 'b4r5', op: '<', compare: 'field', field2: '' }, metaOf('b4r5')).ok, false);
  assert.equal(AdminLogic.buildLeaf({ field: 'b4r5', op: 'in', compare: 'field', field2: 'b1r9' }, metaOf('b4r5')).ok, false);
});

test('buildSimpleGroup: 1 kondisi → leaf polos (kompatibel mundur)', () => {
  const res = AdminLogic.buildSimpleGroup('all', [{ field: 'b4r5', op: '>', compare: 'value', value: '500' }], metaOf);
  assert.deepEqual(res.when, { field: 'b4r5', op: '>', value: 500 });
});

test('buildSimpleGroup: ≥2 kondisi → all/any berisi tiap leaf', () => {
  const conds = [
    { field: 'b1r9', op: '>', compare: 'value', value: '1' },
    { field: 'b1r11_n', op: 'in', compare: 'value', value: '1, 3, 4' }
  ];
  assert.deepEqual(AdminLogic.buildSimpleGroup('all', conds, metaOf).when, {
    all: [{ field: 'b1r9', op: '>', value: 1 }, { field: 'b1r11_n', op: 'in', value: [1, 3, 4] }]
  });
  assert.deepEqual(AdminLogic.buildSimpleGroup('any', conds, metaOf).when, {
    any: [{ field: 'b1r9', op: '>', value: 1 }, { field: 'b1r11_n', op: 'in', value: [1, 3, 4] }]
  });
});

test('buildSimpleGroup: error kondisi menyebut nomor barisnya; list kosong ditolak', () => {
  const bad = AdminLogic.buildSimpleGroup('all', [
    { field: 'b4r5', op: '>', compare: 'value', value: '500' },
    { field: 'b1r9', op: '>', compare: 'value', value: '' }
  ], metaOf);
  assert.equal(bad.ok, false);
  assert.equal(bad.index, 1);
  assert.match(bad.error, /Kondisi 2/);
  assert.equal(AdminLogic.buildSimpleGroup('all', [], metaOf).ok, false);
});

// ==== classifySimpleGroup (buka rule ke Mode Sederhana) ====

const known = (id) => ['b4r5', 'b1r9', 'b1r11_n', 'b3r18c', 'b4r16'].indexOf(id) !== -1;

test('classifySimpleGroup: leaf polos → 1 kondisi combinator all', () => {
  const res = AdminLogic.classifySimpleGroup({ field: 'b4r5', op: '>', value: 500 }, known);
  assert.equal(res.simple, true);
  assert.equal(res.combinator, 'all');
  assert.deepEqual(res.conditions, [{ field: 'b4r5', op: '>', compare: 'value', value: 500, field2: '' }]);
});

test('classifySimpleGroup: all/any dengan leaf polos → banyak kondisi; field2 → compare field', () => {
  const res = AdminLogic.classifySimpleGroup({
    any: [{ field: 'b1r9', op: '>', value: 1 }, { field: 'b3r18c', op: '<', field2: 'b4r16' }]
  }, known);
  assert.equal(res.simple, true);
  assert.equal(res.combinator, 'any');
  assert.deepEqual(res.conditions, [
    { field: 'b1r9', op: '>', compare: 'value', value: 1, field2: '' },
    { field: 'b3r18c', op: '<', compare: 'field', value: '', field2: 'b4r16' }
  ]);
});

test('classifySimpleGroup: nested/roster/field tak dikenal → simple:false (jatuh ke Lanjutan)', () => {
  assert.equal(AdminLogic.classifySimpleGroup({ all: [{ all: [{ field: 'b4r5', op: '>', value: 1 }] }] }, known).simple, false);
  assert.equal(AdminLogic.classifySimpleGroup({ roster_any: 'anggota_keluarga', condition: { field: 'x', op: '==', value: 1 } }, known).simple, false);
  assert.equal(AdminLogic.classifySimpleGroup({ field: 'field_hilang', op: '>', value: 1 }, known).simple, false);
});

test('classifySimpleGroup round-trip buildSimpleGroup', () => {
  const when = { all: [{ field: 'b1r9', op: '>', value: 1 }, { field: 'b3r18c', op: '<', field2: 'b4r16' }] };
  const cls = AdminLogic.classifySimpleGroup(when, known);
  const rebuilt = AdminLogic.buildSimpleGroup(cls.combinator, cls.conditions, metaOf);
  assert.deepEqual(rebuilt.when, when);
});

// ==== buildAnswersTemplate ====

test('buildAnswersTemplate: field datar kosong + 1 baris kosong per grup roster', () => {
  const questions = [
    { question_id: 'b4r5', roster_group: '' },
    { question_id: 'b1r6_n', roster_group: 'anggota_keluarga' },
    { question_id: 'b1r8_n', roster_group: 'anggota_keluarga' },
    { question_id: 'b4r14b_n', roster_group: 'meteran_listrik' }
  ];
  assert.deepEqual(AdminLogic.buildAnswersTemplate(questions), {
    b4r5: '',
    roster: {
      anggota_keluarga: [{ b1r6_n: '', b1r8_n: '' }],
      meteran_listrik: [{ b4r14b_n: '' }]
    }
  });
});
