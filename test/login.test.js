const { test } = require('node:test');
const assert = require('node:assert/strict');

const AuthLogic = require('../src/AuthLogic.js');
const MockData = require('../src/MockData.js');

const PASSWORD = 'cobaapp';
const login = (email, password) =>
  AuthLogic.validateLogin(MockData.PETUGAS, email, password, PASSWORD);

test('login valid: email PML + password benar', () => {
  const res = login('kadekbudiana74@gmail.com', 'cobaapp');
  assert.equal(res.ok, true);
  assert.deepEqual(res.pml, {
    nama: 'KADEK BUDIANA',
    email: 'kadekbudiana74@gmail.com',
    sobatId: '510822100697'
  });
});

test('email di-trim dan case-insensitive', () => {
  const res = login('  KadekBudiana74@Gmail.com  ', 'cobaapp');
  assert.equal(res.ok, true);
  assert.equal(res.pml.email, 'kadekbudiana74@gmail.com');
});

test('password salah', () => {
  const res = login('kadekbudiana74@gmail.com', 'salahpass');
  assert.deepEqual(res, { ok: false, error: 'WRONG_PASSWORD' });
});

test('password benar tapi beda kapitalisasi tetap ditolak', () => {
  const res = login('kadekbudiana74@gmail.com', 'CobaApp');
  assert.deepEqual(res, { ok: false, error: 'WRONG_PASSWORD' });
});

test('email terdaftar tapi PPL (bukan PML)', () => {
  const res = login('ruspininimade@gmail.com', 'cobaapp');
  assert.deepEqual(res, { ok: false, error: 'NOT_PML' });
});

test('PPL dengan kolom Posisi kosong: role tetap dari Posisi Daftar', () => {
  const res = login('dehkaghust04@gmail.com', 'cobaapp');
  assert.deepEqual(res, { ok: false, error: 'NOT_PML' });
});

test('email tidak terdaftar', () => {
  const res = login('tidakada@gmail.com', 'cobaapp');
  assert.deepEqual(res, { ok: false, error: 'EMAIL_NOT_FOUND' });
});

test('email kosong / null', () => {
  assert.deepEqual(login('', 'cobaapp'), { ok: false, error: 'EMAIL_NOT_FOUND' });
  assert.deepEqual(login(null, 'cobaapp'), { ok: false, error: 'EMAIL_NOT_FOUND' });
});

test('email duplikat: baris PML tetap ketemu walau ada baris PPL dengan email sama', () => {
  const rows = [
    { 'Nama Lengkap': 'X', 'Posisi Daftar': 'Petugas Lapangan Sensus (PPL Sensus)', 'SOBAT ID': '1', 'Email': 'dobel@gmail.com' },
    { 'Nama Lengkap': 'X', 'Posisi Daftar': 'Pemeriksa Lapangan Sensus (PML Sensus)', 'SOBAT ID': '2', 'Email': 'dobel@gmail.com' }
  ];
  const res = AuthLogic.validateLogin(rows, 'dobel@gmail.com', PASSWORD, PASSWORD);
  assert.equal(res.ok, true);
  assert.equal(res.pml.sobatId, '2');
});
