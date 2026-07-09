const { test } = require('node:test');
const assert = require('node:assert/strict');

const ConfigLogic = require('../src/ConfigLogic.js');
const ComputedFields = require('../src/ComputedFields.js');
const RuleEvaluator = require('../src/RuleEvaluator.js');

// defs = baris CUSTOM milik satu jenis (override bawaan sudah disaring
// caller — lihat DataAccess.splitComputedDefs_). reservedIds meniru yang
// dibangun DataAccess.reservedComputedIds_: alias pertanyaan + bawaan + roster.
const RESERVED = ['roster', 'r26a', 'r26b', 'r27c', 'r26_total', 'rasio_ntb'];

function create(defs, input) {
  return ConfigLogic.applyCreateComputedField(defs, 'usaha', input, RESERVED);
}

// ==== applyCreateComputedField ====

test('create: id di-lowercase, label & formula tervalidasi, def lengkap', () => {
  const res = create([], { field_id: 'Margin_Kotor', label: 'Margin kotor usaha', formula: 'r27c - r26_total' });
  assert.equal(res.ok, true);
  assert.deepEqual(res.def, {
    field_id: 'margin_kotor', jenis: 'usaha',
    label: 'Margin kotor usaha', formula: 'r27c - r26_total'
  });
  assert.equal(res.defs.length, 1);
});

test('create: alias tidak valid ditolak (kosong / diawali angka / karakter aneh)', () => {
  ['', '9margin', 'margin-kotor', 'margin kotor'].forEach((id) => {
    assert.equal(create([], { field_id: id, label: 'x', formula: '1' }).error, 'INVALID_ALIAS');
  });
});

test('create: alias bentrok reserved (pertanyaan/bawaan/roster) atau custom lain → DUPLICATE_ALIAS', () => {
  assert.equal(create([], { field_id: 'r26a', label: 'x', formula: '1' }).error, 'DUPLICATE_ALIAS');
  assert.equal(create([], { field_id: 'rasio_ntb', label: 'x', formula: '1' }).error, 'DUPLICATE_ALIAS');
  assert.equal(create([], { field_id: 'roster', label: 'x', formula: '1' }).error, 'DUPLICATE_ALIAS');
  const ada = [{ field_id: 'margin', jenis: 'usaha', label: 'y', formula: '1' }];
  assert.equal(create(ada, { field_id: 'margin', label: 'x', formula: '1' }).error, 'DUPLICATE_ALIAS');
});

test('create: label kosong → INVALID_LABEL; formula kosong/rusak/berisi perbandingan → INVALID_FORMULA', () => {
  assert.equal(create([], { field_id: 'oke', label: '  ', formula: '1' }).error, 'INVALID_LABEL');
  assert.equal(create([], { field_id: 'oke', label: 'x', formula: '' }).error, 'INVALID_FORMULA');
  assert.equal(create([], { field_id: 'oke', label: 'x', formula: 'r26a + +' }).error, 'INVALID_FORMULA');
  assert.equal(create([], { field_id: 'oke', label: 'x', formula: 'r26a > 5' }).error, 'INVALID_FORMULA');
});

// ==== applyUpdateComputedField ====

test('update: patch label & formula tervalidasi; field_id tidak bisa diganti (immutable)', () => {
  const defs = [{ field_id: 'margin', jenis: 'usaha', label: 'Lama', formula: 'r27c - r26_total' }];
  const res = ConfigLogic.applyUpdateComputedField(defs, 'margin', { label: 'Baru', formula: 'r27c * 2' });
  assert.equal(res.ok, true);
  assert.equal(res.def.label, 'Baru');
  assert.equal(res.def.formula, 'r27c * 2');
  assert.equal(res.def.field_id, 'margin');
  assert.equal(defs[0].label, 'Lama'); // immutable: input tak dimutasi

  assert.equal(ConfigLogic.applyUpdateComputedField(defs, 'margin', { label: '' }).error, 'INVALID_LABEL');
  assert.equal(ConfigLogic.applyUpdateComputedField(defs, 'margin', { formula: 'x >' }).error, 'INVALID_FORMULA');
  assert.equal(ConfigLogic.applyUpdateComputedField(defs, 'tak_ada', { label: 'x' }).error, 'NOT_FOUND');
});

// ==== applyDeleteComputedField ====

test('delete: buang def-nya; id tak dikenal → NOT_FOUND', () => {
  const defs = [
    { field_id: 'a', jenis: 'usaha', label: 'A', formula: '1' },
    { field_id: 'b', jenis: 'usaha', label: 'B', formula: '2' }
  ];
  const res = ConfigLogic.applyDeleteComputedField(defs, 'a');
  assert.equal(res.ok, true);
  assert.deepEqual(res.defs.map((d) => d.field_id), ['b']);
  assert.equal(res.def.field_id, 'a');
  assert.equal(defs.length, 2); // input tak dimutasi
  assert.equal(ConfigLogic.applyDeleteComputedField(defs, 'x').error, 'NOT_FOUND');
});

// ==== ACCEPTANCE: custom field hasil create LANGSUNG bisa dipakai rule ====

test('ACCEPTANCE: create custom field → augment via refs → rule memicu anomali', () => {
  const created = create([], { field_id: 'margin_kotor', label: 'Margin kotor', formula: 'r27c - r26_total' });
  assert.equal(created.ok, true);

  // Seperti DataAccess.computedRefs_: defs custom → refs.customFields.
  const refs = { customFields: created.defs.map((d) => ({ id: d.field_id, formula: d.formula })) };
  const augmented = ComputedFields.augment('usaha', { r26a: 30, r27c: 100 }, refs);
  assert.equal(augmented.margin_kotor, 70);

  const when = { field: 'margin_kotor', op: '>', value: 50 };
  assert.equal(RuleEvaluator.validateWhen(when).ok, true);
  assert.equal(RuleEvaluator.evaluate(when, augmented), true);

  // Setelah custom field dihapus, rule TIDAK error — hanya tak pernah cocok.
  const afterDelete = ComputedFields.augment('usaha', { r26a: 30, r27c: 100 }, { customFields: [] });
  assert.equal(RuleEvaluator.evaluate(when, afterDelete), false);
});
