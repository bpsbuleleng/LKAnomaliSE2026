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
