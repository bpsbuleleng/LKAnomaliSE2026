const { test } = require('node:test');
const assert = require('node:assert/strict');

const Formula = require('../src/Formula.js');

// ==== evaluate: aritmetika + perbandingan ====

test('evaluate: pembagian antar-field dibanding konstanta (kasus pangsa_biaya)', () => {
  const scope = { r26b: 30, r26_total: 50 };
  assert.equal(Formula.evaluate('r26b / r26_total >= 0.5', scope), true);  // 0,6 ≥ 0,5
  assert.equal(Formula.evaluate('r26b / r26_total >= 0.7', scope), false); // 0,6 ≥ 0,7
});

test('evaluate: presedensi * / di atas + -; tanda kurung mengubah urutan', () => {
  const s = { a: 2, b: 3, c: 4 };
  assert.equal(Formula.evaluate('a + b * c == 14', s), true);   // 2 + 12
  assert.equal(Formula.evaluate('(a + b) * c == 20', s), true); // 5 * 4
});

test('evaluate: unary minus & pengurangan', () => {
  assert.equal(Formula.evaluate('r27c - r26_total < 0', { r27c: 40, r26_total: 50 }), true);
  assert.equal(Formula.evaluate('-a + 10 == 7', { a: 3 }), true);
});

test('evaluate: perbandingan field vs field langsung (tanpa aritmetika)', () => {
  assert.equal(Formula.evaluate('r27c < r26_total', { r27c: 40, r26_total: 50 }), true);
  assert.equal(Formula.evaluate('r27c < r26_total', { r27c: 60, r26_total: 50 }), false);
});

test('evaluate: semua operator banding', () => {
  assert.equal(Formula.evaluate('a == 5', { a: 5 }), true);
  assert.equal(Formula.evaluate('a != 5', { a: 6 }), true);
  assert.equal(Formula.evaluate('a > 5', { a: 6 }), true);
  assert.equal(Formula.evaluate('a >= 5', { a: 5 }), true);
  assert.equal(Formula.evaluate('a < 5', { a: 4 }), true);
  assert.equal(Formula.evaluate('a <= 5', { a: 5 }), true);
});

// ==== semantik nilai (samakan dgn ComputedFields) ====

test('evaluate: field kosong/null/non-angka dianggap 0', () => {
  assert.equal(Formula.evaluate('a + b == 0', { a: '', b: null }), true);
  assert.equal(Formula.evaluate('a + b == 0', {}), true);                 // keduanya undefined
  assert.equal(Formula.evaluate('a == 0', { a: 'WARUNG' }), true);        // non-angka → 0
});

test('evaluate: bagi 0 → tidak berlaku → perbandingan FALSE (bukan error)', () => {
  assert.equal(Formula.evaluate('r26b / r26_total >= 0.5', { r26b: 30, r26_total: 0 }), false);
  assert.equal(Formula.evaluate('r26b / r26_total >= 0.5', { r26b: 30 }), false); // total undefined → 0
  // not-applicable menjalar lewat aritmetika induk
  assert.equal(Formula.evaluate('(a / b) + 1 > 0', { a: 5, b: 0 }), false);
});

test('evaluate: string angka diperlakukan sebagai angka', () => {
  assert.equal(Formula.evaluate('a / b >= 0.5', { a: '30', b: '50' }), true);
});

// ==== fieldsUsed ====

test('fieldsUsed: kumpulkan alias unik, abaikan angka', () => {
  assert.deepEqual(Formula.fieldsUsed('(r26a + r26b) / r26_total >= 0.5'), ['r26a', 'r26b', 'r26_total']);
  assert.deepEqual(Formula.fieldsUsed('a / a > 1'), ['a']); // unik
  assert.deepEqual(Formula.fieldsUsed('1 + 2 < 5'), []);
});

// ==== compile: penolakan sintaks ====

test('compile: tanpa perbandingan ditolak', () => {
  assert.throws(() => Formula.compile('r26b / r26_total'), /perbandingan/);
});

test('compile: perbandingan berantai / token berlebih ditolak', () => {
  assert.throws(() => Formula.compile('0.5 <= a <= 0.8'), /berlebih|SATU perbandingan/);
});

test('compile: kurung tak seimbang ditolak', () => {
  assert.throws(() => Formula.compile('(a + b > 1'), /Kurung/);
});

test('compile: karakter asing ditolak (tanpa eval — aman)', () => {
  assert.throws(() => Formula.compile('a && b > 1'), /Karakter tidak dikenal/);
  assert.throws(() => Formula.compile('a > 1; drop'), /Karakter tidak dikenal/);
  assert.throws(() => Formula.compile('a.b > 1')); // ditolak (bukan akses properti) — aman
});

test('compile: formula kosong ditolak', () => {
  assert.throws(() => Formula.compile('   '), /kosong/);
});

test('compile: operator banding tak lengkap ditolak', () => {
  assert.throws(() => Formula.compile('a = 1'), /tidak lengkap/);
});

// ==== compileExpr/evaluateExpr: ekspresi NILAI (dipakai formula computed
// field yang bisa diedit admin — TANPA perbandingan, hasil Number|null) ====

test('evaluateExpr: aritmetika dasar identik dengan grammar evaluate (tanpa cmp)', () => {
  assert.equal(Formula.evaluateExpr('r26a + r26b + r26c + r26d + r26e', { r26a: 1, r26b: 2, r26c: 3, r26d: 4, r26e: 5 }), 15);
  assert.equal(Formula.evaluateExpr('(a + b) * c', { a: 2, b: 3, c: 4 }), 20);
  assert.equal(Formula.evaluateExpr('-a + 10', { a: 3 }), 7);
});

test('evaluateExpr: field kosong/null/non-angka dianggap 0 (sama seperti evaluate)', () => {
  assert.equal(Formula.evaluateExpr('a + b', { a: '', b: null }), 0);
  assert.equal(Formula.evaluateExpr('a + b', {}), 0);
});

test('evaluateExpr: bagi 0 → null ("tidak berlaku"), menjalar ke ekspresi induk', () => {
  assert.equal(Formula.evaluateExpr('r26b / r26_total', { r26b: 30, r26_total: 0 }), null);
  assert.equal(Formula.evaluateExpr('(a / b) + 1', { a: 5, b: 0 }), null);
});

test('evaluateExpr: mereproduksi hasil computed field pangsa_biaya_produksi persis', () => {
  const scope = { r26b: 30000000, r26_total: 50000000 };
  assert.equal(Formula.evaluateExpr('r26b / r26_total', scope), 0.6);
});

test('compileExpr: TIDAK boleh mengandung perbandingan (beda dengan compile)', () => {
  assert.throws(() => Formula.compileExpr('r26a + r26b >= 0.5'), /TIDAK BOLEH mengandung perbandingan/);
  assert.throws(() => Formula.compileExpr('a == b'), /TIDAK BOLEH mengandung perbandingan/);
});

test('compileExpr: sisa token berlebih non-cmp tetap ditolak', () => {
  assert.throws(() => Formula.compileExpr('a b'), /berlebih/);
});

test('compileExpr: kurung tak seimbang & formula kosong tetap ditolak (grammar sama)', () => {
  assert.throws(() => Formula.compileExpr('(a + b'), /Kurung/);
  assert.throws(() => Formula.compileExpr('   '), /kosong/);
});

test('fieldsUsedExpr: kumpulkan alias unik dari ekspresi nilai', () => {
  assert.deepEqual(Formula.fieldsUsedExpr('(r26a + r26b) / r26_total'), ['r26a', 'r26b', 'r26_total']);
});
