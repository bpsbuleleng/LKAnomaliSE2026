const { test } = require('node:test');
const assert = require('node:assert/strict');

const loadHtmlScript = require('./helpers/loadHtmlScript.js');
const CascadeLogic = loadHtmlScript('src/CascadeLogic.html');

// Fixture mini dengan jebakan yang disengaja:
// - desa kode '001' ada di DUA kecamatan berbeda (nama beda)
// - kode ber-leading-zero ('010' vs '100') harus tetap string & terurut benar
const rows = [
  { idsubsls: '5108010001000101', kdkec: '010', nmkec: 'Gerokgak', kddesa: '001', nmdesa: 'Sumberklampok', kdsls: '0001', nmsls: 'SLS A', kdsubsls: '01' },
  { idsubsls: '5108010001000102', kdkec: '010', nmkec: 'Gerokgak', kddesa: '001', nmdesa: 'Sumberklampok', kdsls: '0001', nmsls: 'SLS A', kdsubsls: '02' },
  { idsubsls: '5108010001000201', kdkec: '010', nmkec: 'Gerokgak', kddesa: '001', nmdesa: 'Sumberklampok', kdsls: '0002', nmsls: 'SLS B', kdsubsls: '01' },
  { idsubsls: '5108010002000101', kdkec: '010', nmkec: 'Gerokgak', kddesa: '002', nmdesa: 'Sumberkima', kdsls: '0001', nmsls: 'SLS C', kdsubsls: '01' },
  { idsubsls: '5108020001000101', kdkec: '020', nmkec: 'Seririt', kddesa: '001', nmdesa: 'Lokapaksa', kdsls: '0001', nmsls: 'SLS D', kdsubsls: '01' },
  { idsubsls: '5108100001000101', kdkec: '100', nmkec: 'Tejakula', kddesa: '001', nmdesa: 'Les', kdsls: '0001', nmsls: 'SLS E', kdsubsls: '01' }
];

test('kecamatanOptions: unik, terurut kode, leading zero utuh', () => {
  const opts = CascadeLogic.kecamatanOptions(rows);
  assert.deepEqual(opts, [
    { kode: '010', nama: 'Gerokgak' },
    { kode: '020', nama: 'Seririt' },
    { kode: '100', nama: 'Tejakula' }
  ]);
  assert.equal(typeof opts[0].kode, 'string');
});

test('desaOptions: terfilter per kecamatan — kode desa sama di kecamatan beda TIDAK bocor', () => {
  const gerokgak = CascadeLogic.desaOptions(rows, '010');
  assert.deepEqual(gerokgak, [
    { kode: '001', nama: 'Sumberklampok' },
    { kode: '002', nama: 'Sumberkima' }
  ]);
  const seririt = CascadeLogic.desaOptions(rows, '020');
  assert.deepEqual(seririt, [{ kode: '001', nama: 'Lokapaksa' }]);
});

test('desaOptions: kode kecamatan number TIDAK match kode string beda makna', () => {
  // '10' (tanpa leading zero) bukan '010' — tidak boleh dapat apa-apa
  assert.deepEqual(CascadeLogic.desaOptions(rows, '10'), []);
});

test('slsOptions: terfilter kecamatan + desa', () => {
  assert.deepEqual(CascadeLogic.slsOptions(rows, '010', '001'), [
    { kode: '0001', nama: 'SLS A' },
    { kode: '0002', nama: 'SLS B' }
  ]);
  assert.deepEqual(CascadeLogic.slsOptions(rows, '010', '002'), [
    { kode: '0001', nama: 'SLS C' }
  ]);
});

test('subSlsOptions: terfilter penuh + bawa idsubsls', () => {
  assert.deepEqual(CascadeLogic.subSlsOptions(rows, '010', '001', '0001'), [
    { kode: '01', nama: 'Sub-SLS 01', idsubsls: '5108010001000101' },
    { kode: '02', nama: 'Sub-SLS 02', idsubsls: '5108010001000102' }
  ]);
});

test('searchOptions: cocok ke nama (case-insensitive) dan kode', () => {
  const opts = CascadeLogic.desaOptions(rows, '010');
  assert.deepEqual(CascadeLogic.searchOptions(opts, 'KIMA'), [{ kode: '002', nama: 'Sumberkima' }]);
  assert.deepEqual(CascadeLogic.searchOptions(opts, '001'), [{ kode: '001', nama: 'Sumberklampok' }]);
  assert.equal(CascadeLogic.searchOptions(opts, '').length, 2);
  assert.deepEqual(CascadeLogic.searchOptions(opts, 'zzz'), []);
});
