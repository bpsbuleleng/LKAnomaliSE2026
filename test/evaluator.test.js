const { test } = require('node:test');
const assert = require('node:assert/strict');

const RuleEvaluator = require('../src/RuleEvaluator.js');
const ev = (when, answers) => RuleEvaluator.evaluate(when, answers);

// ==== Operator dasar — SEMUA operator di format `when` ====

test('op ==: longgar antara number dan string kategorik, ketat untuk teks', () => {
  assert.equal(ev({ field: 'x', op: '==', value: 1 }, { x: 1 }), true);
  assert.equal(ev({ field: 'x', op: '==', value: 1 }, { x: '1' }), true); // select/Sheets round-trip
  assert.equal(ev({ field: 'x', op: '==', value: '1' }, { x: 1 }), true);
  assert.equal(ev({ field: 'x', op: '==', value: 1 }, { x: 2 }), false);
  assert.equal(ev({ field: 'x', op: '==', value: 'abc' }, { x: 'abc' }), true);
  assert.equal(ev({ field: 'x', op: '==', value: 'abc' }, { x: 'ABC' }), false);
});

test('op !=', () => {
  assert.equal(ev({ field: 'x', op: '!=', value: 1 }, { x: 2 }), true);
  assert.equal(ev({ field: 'x', op: '!=', value: 1 }, { x: '1' }), false);
});

test('op > >= < <=: numerik, termasuk angka dalam string', () => {
  assert.equal(ev({ field: 'x', op: '>', value: 10 }, { x: 11 }), true);
  assert.equal(ev({ field: 'x', op: '>', value: 10 }, { x: 10 }), false);
  assert.equal(ev({ field: 'x', op: '>=', value: 10 }, { x: 10 }), true);
  assert.equal(ev({ field: 'x', op: '<', value: 10 }, { x: 9 }), true);
  assert.equal(ev({ field: 'x', op: '<=', value: 10 }, { x: 11 }), false);
  assert.equal(ev({ field: 'x', op: '>', value: '10' }, { x: '11' }), true);
  assert.equal(ev({ field: 'x', op: '>', value: 10 }, { x: 'bukan angka' }), false);
});

test('op in / not_in: keanggotaan longgar', () => {
  assert.equal(ev({ field: 'x', op: 'in', value: [1, 2] }, { x: 2 }), true);
  assert.equal(ev({ field: 'x', op: 'in', value: [1, 2] }, { x: '2' }), true);
  assert.equal(ev({ field: 'x', op: 'in', value: [1, 2] }, { x: 3 }), false);
  assert.equal(ev({ field: 'x', op: 'not_in', value: [1, 2] }, { x: 3 }), true);
  assert.equal(ev({ field: 'x', op: 'not_in', value: [1, 2] }, { x: '1' }), false);
  assert.throws(() => ev({ field: 'x', op: 'in', value: 1 }, { x: 1 }), /array/);
});

test('op empty / not_empty: undefined, null, "" kosong; 0 TERISI', () => {
  assert.equal(ev({ field: 'x', op: 'empty' }, {}), true);
  assert.equal(ev({ field: 'x', op: 'empty' }, { x: null }), true);
  assert.equal(ev({ field: 'x', op: 'empty' }, { x: '' }), true);
  assert.equal(ev({ field: 'x', op: 'empty' }, { x: 0 }), false);
  assert.equal(ev({ field: 'x', op: 'not_empty' }, { x: 0 }), true);
  assert.equal(ev({ field: 'x', op: 'not_empty' }, {}), false);
});

test('op regex', () => {
  assert.equal(ev({ field: 'x', op: 'regex', value: '^51\\d{2}$' }, { x: '5108' }), true);
  assert.equal(ev({ field: 'x', op: 'regex', value: '^51\\d{2}$' }, { x: '6108' }), false);
});

test('field2: bandingkan antar-field', () => {
  assert.equal(ev({ field: 'a', op: '<', field2: 'b' }, { a: 1, b: 2 }), true);
  assert.equal(ev({ field: 'a', op: '<', field2: 'b' }, { a: 3, b: 2 }), false);
  assert.equal(ev({ field: 'a', op: '==', field2: 'b' }, { a: 5, b: '5' }), true);
});

// ==== Semantik nilai kosong: perbandingan atas field kosong = false ====

test('field kosong/null → SEMUA operator perbandingan false (belum diisi ≠ anomali)', () => {
  for (const op of ['==', '!=', '>', '>=', '<', '<=']) {
    assert.equal(ev({ field: 'x', op, value: 1 }, {}), false, 'op ' + op);
    assert.equal(ev({ field: 'x', op, value: 1 }, { x: '' }), false, 'op ' + op);
    assert.equal(ev({ field: 'x', op, value: 1 }, { x: null }), false, 'op ' + op);
  }
  assert.equal(ev({ field: 'x', op: 'in', value: [1] }, {}), false);
  assert.equal(ev({ field: 'x', op: 'not_in', value: [1] }, {}), false);
  assert.equal(ev({ field: 'x', op: 'regex', value: '.*' }, {}), false);
  // computed field bisa null (guard pembagi 0) — juga false
  assert.equal(ev({ field: 'rasio', op: '<', value: 1 }, { rasio: null }), false);
  // field2 kosong → false
  assert.equal(ev({ field: 'a', op: '<', field2: 'b' }, { a: 1 }), false);
});

// ==== Kombinator all/any, boleh bersarang ====

test('all/any bersarang', () => {
  const when = {
    all: [
      { field: 'a', op: '>', value: 0 },
      { any: [{ field: 'b', op: '==', value: 1 }, { field: 'c', op: '==', value: 1 }] }
    ]
  };
  assert.equal(ev(when, { a: 5, b: 1, c: 9 }), true);
  assert.equal(ev(when, { a: 5, b: 9, c: 1 }), true);
  assert.equal(ev(when, { a: 5, b: 9, c: 9 }), false);
  assert.equal(ev(when, { a: 0, b: 1, c: 1 }), false);
});

// ==== Primitif roster (roster_any / roster_all / roster_count) ====

const rosterAnswers = {
  roster: {
    anggota_keluarga: [
      { b1r8_n: 1, b1r11_n: 2 },
      { b1r8_n: 2, b1r11_n: 3 },
      { b1r8_n: 3, b1r11_n: 1 }
    ]
  }
};

test('roster_any: ada baris memenuhi', () => {
  const when = {
    roster_any: 'anggota_keluarga',
    condition: { all: [{ field: 'b1r8_n', op: 'in', value: [1, 2] }, { field: 'b1r11_n', op: 'in', value: [1, 3, 4] }] }
  };
  assert.equal(ev(when, rosterAnswers), true); // baris ke-2: pasangan cerai hidup
  assert.equal(ev(when, { roster: { anggota_keluarga: [{ b1r8_n: 1, b1r11_n: 2 }] } }), false);
  assert.equal(ev(when, { roster: { anggota_keluarga: [] } }), false);
  assert.equal(ev(when, {}), false); // roster tidak ada sama sekali
});

test('roster_all: semua baris memenuhi; roster KOSONG = false (bukan vakum-benar)', () => {
  const when = { roster_all: 'anggota_keluarga', condition: { field: 'b1r8_n', op: '>', value: 0 } };
  assert.equal(ev(when, rosterAnswers), true);
  assert.equal(ev({ roster_all: 'anggota_keluarga', condition: { field: 'b1r8_n', op: '==', value: 1 } }, rosterAnswers), false);
  assert.equal(ev(when, { roster: { anggota_keluarga: [] } }), false);
  assert.equal(ev(when, {}), false);
});

test('roster_count: hitung baris yang memenuhi kondisi, banding numerik', () => {
  const base = { roster_count: 'anggota_keluarga', condition: { field: 'b1r11_n', op: '!=', value: 2 } };
  assert.equal(ev(Object.assign({ op: '==', value: 2 }, base), rosterAnswers), true);
  assert.equal(ev(Object.assign({ op: '>', value: 2 }, base), rosterAnswers), false);
  assert.equal(ev(Object.assign({ op: '>=', value: 2 }, base), rosterAnswers), true);
  // tanpa condition → hitung semua baris
  assert.equal(ev({ roster_count: 'anggota_keluarga', op: '==', value: 3 }, rosterAnswers), true);
  assert.throws(() => ev(Object.assign({ op: 'in', value: [1] }, base), rosterAnswers), /roster_count/);
});

test('kondisi roster dievaluasi dengan scope BARIS (tidak melihat field datar)', () => {
  const when = { roster_any: 'g', condition: { field: 'datar', op: '==', value: 1 } };
  assert.equal(ev(when, { datar: 1, roster: { g: [{ lain: 9 }] } }), false);
});

// ==== leaf formula (aritmetika antar-field, parser aman) ====

test('formula: perbandingan aritmetika antar-field; bagi 0 → false', () => {
  assert.equal(ev({ formula: 'r26b / r26_total >= 0.5' }, { r26b: 30, r26_total: 50 }), true);
  assert.equal(ev({ formula: 'r26b / r26_total >= 0.5' }, { r26b: 30, r26_total: 0 }), false);
});

test('formula: bisa dipakai di dalam all/any bersama leaf biasa', () => {
  const when = { all: [
    { field: 'r13b1', op: '==', value: 2 },
    { formula: 'r26b / r26_total > 0.5' }
  ] };
  assert.equal(ev(when, { r13b1: 2, r26b: 40, r26_total: 50 }), true);  // 0,8 > 0,5
  assert.equal(ev(when, { r13b1: 2, r26b: 10, r26_total: 50 }), false); // 0,2 > 0,5 gagal
});

test('formula: sintaks rusak → throw (ditangkap per-rule oleh evaluateRules)', () => {
  assert.throws(() => ev({ formula: 'r26b / r26_total' }, {}), /perbandingan/);
});

// ==== when sebagai string JSON (bentuk kolom sheet di Fase 5) ====

test('when string JSON di-parse; JSON rusak throw', () => {
  assert.equal(ev('{"field":"x","op":"==","value":1}', { x: 1 }), true);
  assert.throws(() => ev('{bukan json', {}));
});

// ==== Malformed → throw (JANGAN diam-diam false) ====

test('kondisi malformed throw: op tak dikenal, bentuk tak dikenali', () => {
  assert.throws(() => ev({ field: 'x', op: 'like', value: 1 }, { x: 1 }), /Operator/);
  assert.throws(() => ev({ foo: 'bar' }, {}), /tidak dikenali/);
  assert.throws(() => ev(null, {}));
});

// ==== evaluateRules: kumpulkan anomali; rule rusak dilewati & dicatat ====

test('evaluateRules: rule terpicu masuk anomalies dengan severity+message', () => {
  const rules = [
    { rule_id: 'R1', severity: 'error', message: 'satu', when: { field: 'x', op: '>', value: 0 }, active: true },
    { rule_id: 'R2', severity: 'warning', message: 'dua', when: { field: 'x', op: '<', value: 0 }, active: true }
  ];
  const res = RuleEvaluator.evaluateRules(rules, { x: 5 });
  assert.deepEqual(res.anomalies, [{
    rule_id: 'R1', severity: 'error', message: 'satu',
    fields: [{ field: 'x', value: 5 }]
  }]);
  assert.deepEqual(res.errors, []);
});

// ==== collectTriggered: field pemicu + nilai (dipakai tampilan anomali) ====

const collect = (when, answers) => RuleEvaluator.collectTriggered(when, answers);

test('collectTriggered: leaf field + field2, dedupe field ganda', () => {
  assert.deepEqual(collect({ field: 'a', op: '>', field2: 'b' }, { a: 5, b: 3 }),
    [{ field: 'a', value: 5 }, { field: 'b', value: 3 }]);
  // Field sama dirujuk 2 leaf (mis. K4 luas < 3 ATAU > 200) → satu entri saja.
  assert.deepEqual(collect({
    any: [{ field: 'x', op: '<', value: 3 }, { all: [{ field: 'x', op: '>', value: 0 }, { field: 'x', op: '<', value: 1 }] }]
  }, { x: 0.5 }), [{ field: 'x', value: 0.5 }]);
});

test('collectTriggered: value undefined dinormalkan ke null (JSON round-trip aman)', () => {
  assert.deepEqual(collect({ field: 'x', op: 'empty' }, {}), [{ field: 'x', value: null }]);
});

test('collectTriggered: anak `any` yang FALSE tidak ikut — cuma cabang pemicu', () => {
  // Gaya K6: cabang pertama (b4r15a rendah) yang memicu; cabang meteran tidak.
  const when = {
    any: [
      { field: 'b4r15a', op: '<', value: 100000 },
      { field: 'b4r14a', op: '==', value: 1 }
    ]
  };
  assert.deepEqual(collect(when, { b4r15a: 50000, b4r14a: 3 }),
    [{ field: 'b4r15a', value: 50000 }]);
});

test('collectTriggered: roster_any → hanya baris yang cocok, dengan row_index & nilai baris itu', () => {
  // Gaya K1: baris #2 (index 1) yang memicu.
  const when = {
    roster_any: 'anggota_keluarga',
    condition: { all: [{ field: 'b1r8_n', op: 'in', value: [1, 2] }, { field: 'b1r11_n', op: 'in', value: [1, 3, 4] }] }
  };
  const answers = { roster: { anggota_keluarga: [
    { b1r8_n: 1, b1r11_n: 2 }, // kepala keluarga, kawin — bukan pemicu
    { b1r8_n: 2, b1r11_n: 3 }  // pasangan, cerai hidup — PEMICU
  ] } };
  assert.deepEqual(collect(when, answers), [
    { field: 'b1r8_n', value: 2, roster_group: 'anggota_keluarga', row_index: 1 },
    { field: 'b1r11_n', value: 3, roster_group: 'anggota_keluarga', row_index: 1 }
  ]);
});

test('collectTriggered: roster_all → semua baris; `any` per-baris cuma ambil kondisi yang benar di baris itu', () => {
  // Gaya K3: tiap baris cukup satu jenis disabilitas yang == 1.
  const when = {
    roster_all: 'anggota_keluarga',
    condition: { any: [{ field: 'd1', op: '==', value: 1 }, { field: 'd2', op: '==', value: 1 }] }
  };
  const answers = { roster: { anggota_keluarga: [{ d1: 1, d2: 2 }, { d1: 2, d2: 1 }] } };
  assert.deepEqual(collect(when, answers), [
    { field: 'd1', value: 1, roster_group: 'anggota_keluarga', row_index: 0 },
    { field: 'd2', value: 1, roster_group: 'anggota_keluarga', row_index: 1 }
  ]);
});

test('collectTriggered: roster_count dengan condition → baris cocok; tanpa condition → kosong', () => {
  const answers = { roster: { g: [{ x: 1 }, { x: 2 }, { x: 1 }] } };
  assert.deepEqual(collect({ roster_count: 'g', condition: { field: 'x', op: '==', value: 1 }, op: '>=', value: 2 }, answers), [
    { field: 'x', value: 1, roster_group: 'g', row_index: 0 },
    { field: 'x', value: 1, roster_group: 'g', row_index: 2 }
  ]);
  assert.deepEqual(collect({ roster_count: 'g', op: '>=', value: 1 }, answers), []);
});

test('collectTriggered: formula → semua field di ekspresinya, dengan nilai scope', () => {
  assert.deepEqual(collect({ formula: 'r26b / r26_total >= 0.5' }, { r26b: 60, r26_total: 100 }),
    [{ field: 'r26b', value: 60 }, { field: 'r26_total', value: 100 }]);
});

test('evaluateRules: anomali membawa fields; rule string JSON pun jalan', () => {
  const rules = [{
    rule_id: 'K7', severity: 'warning', message: 'ekstrem',
    when: '{"field":"b1r9","op":">","value":10}'
  }];
  const res = RuleEvaluator.evaluateRules(rules, { b1r9: 12 });
  assert.deepEqual(res.anomalies[0].fields, [{ field: 'b1r9', value: 12 }]);
});

// ==== validateWhen: validasi struktur TANPA evaluasi (dipakai config) ====

test('validateWhen: menerima leaf, kombinator bersarang, roster_*, field2, when string JSON', () => {
  const valid = [
    { field: 'x', op: '>', value: 0 },
    { field: 'x', op: '==', value: 0 }, // value 0 sah
    { field: 'a', op: '<', field2: 'b' },
    { field: 'x', op: 'empty' },
    { field: 'x', op: 'in', value: [1, 2] },
    { field: 'x', op: 'regex', value: '^ab$' },
    { all: [{ field: 'x', op: '>', value: 0 }, { any: [{ field: 'y', op: 'not_empty' }] }] },
    { roster_any: 'g', condition: { field: 'x', op: '==', value: 1 } },
    { roster_all: 'g', condition: { any: [{ field: 'x', op: '==', value: 1 }] } },
    { roster_count: 'g', condition: { field: 'x', op: '==', value: 1 }, op: '>', value: 2 },
    { roster_count: 'g', op: '>=', value: 1 }, // tanpa condition = hitung semua baris
    { formula: '(r26a + r26b) / r27c >= 0.5' }, // leaf formula
    { all: [{ field: 'x', op: '>', value: 0 }, { formula: 'a / b < 1' }] }, // formula di dalam kombinator
    '{"field":"x","op":"==","value":1}'
  ];
  for (const w of valid) {
    const v = RuleEvaluator.validateWhen(w);
    assert.equal(v.ok, true, JSON.stringify(w) + ' → ' + (v.error || ''));
  }
});

test('validateWhen: menolak struktur rusak — TERMASUK cabang dalam yang lolos dari evaluasi short-circuit', () => {
  const invalid = [
    null, 42, 'bukan json {', [],
    { foo: 'bar' },
    { field: 'x', op: 'like', value: 1 },
    { field: 'x', op: '>' },                      // tanpa value/field2
    { field: 'x', op: 'in', value: 1 },           // in butuh array
    { field: 'x', op: 'in', value: [] },          // array kosong
    { field: 'x', op: 'regex', value: '(rusak' }, // pola regex invalid
    { all: [] },                                  // kombinator kosong
    { all: 'bukan-array' },
    { roster_any: 'g' },                          // tanpa condition
    { roster_count: 'g', op: 'in', value: [1] },  // op count tidak numerik
    { formula: 'r26b / r26_total' },             // formula tanpa perbandingan
    { formula: 'a && b > 1' },                    // formula karakter asing
    // Short-circuit killer: leaf pertama valid, cabang KEDUA rusak —
    // evaluate() dengan answers kosong tidak akan menyentuh cabang kedua.
    { all: [{ field: 'x', op: '==', value: 1 }, { field: 'y', op: 'RUSAK' }] },
    { all: [{ field: 'x', op: '==', value: 1 }, { formula: '(a + b' }] } // formula rusak di cabang dalam
  ];
  for (const w of invalid) {
    assert.equal(RuleEvaluator.validateWhen(w).ok, false, 'harusnya invalid: ' + JSON.stringify(w));
  }
});

test('evaluateRules: satu rule malformed TIDAK menggagalkan rule lain', () => {
  const rules = [
    { rule_id: 'RUSAK', severity: 'error', message: 'x', when: { field: 'x', op: 'like', value: 1 } },
    { rule_id: 'SEHAT', severity: 'warning', message: 'y', when: { field: 'x', op: '==', value: 1 } }
  ];
  const res = RuleEvaluator.evaluateRules(rules, { x: 1 });
  assert.deepEqual(res.anomalies.map((a) => a.rule_id), ['SEHAT']);
  assert.equal(res.errors.length, 1);
  assert.equal(res.errors[0].rule_id, 'RUSAK');
});
