const { test, expect } = require('@playwright/test');

const EXEC_URL = process.env.EXEC_URL ||
  'https://script.google.com/macros/s/AKfycbwJ4spiFeSAymytUTDFl4bfrMcpBBD3NsE5d0k2GCM1_U50slKfyHaC3HhMRipnw7PU/exec';

function app(page) {
  return page.frameLocator('#sandboxFrame').frameLocator('#userHtmlFrame');
}

async function login(page, email) {
  await page.goto(EXEC_URL);
  const f = app(page);
  await f.getByTestId('login-email').fill(email);
  await f.getByTestId('login-password').fill('cobaapp');
  await f.getByTestId('login-submit').click();
  await expect(f.getByTestId('dashboard-view')).toBeVisible();
  return f;
}

// Buka panel level `name` dan kembalikan daftar data-kode opsinya.
async function openAndListKodes(f, name) {
  await f.getByTestId(name + '-trigger').click();
  const list = f.getByTestId(name + '-list');
  await expect(list).toBeVisible();
  await expect(list.locator('li[data-kode]').first()).toBeVisible();
  return list.locator('li[data-kode]').evaluateAll((els) =>
    els.map((e) => e.getAttribute('data-kode'))
  );
}

async function pick(f, name, kode) {
  const list = f.getByTestId(name + '-list');
  if (!(await list.isVisible())) await f.getByTestId(name + '-trigger').click();
  await list.locator('li[data-kode="' + kode + '"]').click();
}

// Reset store Records mock supaya assertion dashboard deterministik antar run.
async function resetRecords(f) {
  await f.locator('body').evaluate(() =>
    new Promise((resolve) =>
      google.script.run.withSuccessHandler(resolve).resetRecords('admin5108')
    )
  );
}

// Alur baru Fase 2: tombol "Buat Record" → dialog pilih jenis → kuesioner.
async function newRecord(f, jenis) {
  await f.getByTestId('new-record-btn').click();
  await f.getByTestId('new-' + jenis).click();
}

// Sejak Fase 5, e2e jalan atas DATA RIIL "Alokasi Wilayah" (2601 baris) —
// ekspektasi di bawah dipatok ke assignment nyata (probe 2026-07-08):
// KADEK BUDIANA: kec 010 Gerokgak, desa 002 Pejarakan (10 SLS, sub-SLS 0001=01).
// KETUT SURYANTA PUTRA: kec 010, desa 001 Sumberklampok + 005 Banyupoh.
// Alokasi = daftar administratif tetap; kalau suatu saat direvisi, sesuaikan.
test('cascade penuh KADEK: opsi terfilter sesuai assignment riil, PPL/PML benar', async ({ page }) => {
  const f = await login(page, 'kadekbudiana74@gmail.com');
  await newRecord(f, 'keluarga');

  // Prov & Kab auto-terisi read-only
  await expect(f.getByTestId('prov')).toHaveValue('[51] Bali');
  await expect(f.getByTestId('kab')).toHaveValue('[08] Buleleng');

  // Kecamatan: hanya assignment Kadek (data riil: Gerokgak saja)
  expect(await openAndListKodes(f, 'kecamatan')).toEqual(['010']);
  await pick(f, 'kecamatan', '010');

  // Desa terfilter per assignment: hanya Pejarakan — desa PML lain
  // (Sumberklampok punya Ketut) tidak muncul
  await f.getByTestId('desa-trigger').click();
  const desaList = f.getByTestId('desa-list');
  await expect(desaList.locator('li[data-kode]').first()).toBeVisible();
  expect(await desaList.locator('li[data-kode]').evaluateAll((els) => els.map((e) => e.getAttribute('data-kode')))).toEqual(['002']);
  await expect(desaList).toContainText('Pejarakan');
  await expect(desaList).not.toContainText('Sumberklampok');

  // Searchable: "klampok" → kosong (bukan milik Kadek); "jarak" → Pejarakan
  await f.getByTestId('desa-search').fill('klampok');
  await expect(desaList.locator('li[data-kode]')).toHaveCount(0);
  await f.getByTestId('desa-search').fill('jarak');
  await expect(desaList.locator('li[data-kode]')).toHaveCount(1);
  await desaList.locator('li[data-kode="002"]').click();

  // SLS → Sub-SLS (riil: 10 SLS di Pejarakan; SLS 0001 cuma punya sub-SLS 01)
  expect(await openAndListKodes(f, 'sls')).toEqual(['0001', '0002', '0003', '0004', '0005', '0006', '0007', '0008', '0009', '2001']);
  await pick(f, 'sls', '0001');
  expect(await openAndListKodes(f, 'subsls')).toEqual(['01']);
  await pick(f, 'subsls', '01');

  // PPL & PML tampil otomatis — nama kanonik hasil join ke Petugas
  await expect(f.getByTestId('ppl-info')).toBeVisible();
  await expect(f.getByTestId('ppl-nama')).toHaveText('Kadek krisna warma ariesta');
  await expect(f.getByTestId('pml-nama')).toHaveText('KADEK BUDIANA');
});

test('isolasi assignment KETUT: hanya wilayah sendiri; ganti desa me-reset turunan', async ({ page }) => {
  const f = await login(page, 'akusury336@gmail.com');
  await newRecord(f, 'usaha');

  expect(await openAndListKodes(f, 'kecamatan')).toEqual(['010']);
  await pick(f, 'kecamatan', '010');

  // Desa Ketut: Sumberklampok + Banyupoh — desa Kadek (Pejarakan) tidak bisa
  // diakses sama sekali dari akun ini
  await f.getByTestId('desa-trigger').click();
  const desaList = f.getByTestId('desa-list');
  await expect(desaList.locator('li[data-kode]').first()).toBeVisible();
  expect(await desaList.locator('li[data-kode]').evaluateAll((els) => els.map((e) => e.getAttribute('data-kode')))).toEqual(['001', '005']);
  await expect(desaList).not.toContainText('Pejarakan');
  await desaList.locator('li[data-kode="001"]').click();

  expect(await openAndListKodes(f, 'sls')).toEqual(['0001', '0002', '0003', '2001', '2002', '2003']);
  await pick(f, 'sls', '0001');
  expect(await openAndListKodes(f, 'subsls')).toEqual(['01', '02', '03']);
  await pick(f, 'subsls', '01');

  await expect(f.getByTestId('ppl-nama')).toHaveText('ABDUL BASIT');
  await expect(f.getByTestId('pml-nama')).toHaveText('KETUT SURYANTA PUTRA');

  // Ganti desa → SLS dapat opsi baru (placeholder), Sub-SLS reset, PPL hilang
  await pick(f, 'desa', '005');
  await expect(f.getByTestId('sls-trigger')).toHaveText('Pilih SLS');
  await expect(f.getByTestId('subsls-trigger')).toBeDisabled();
  await expect(f.getByTestId('ppl-info')).toBeHidden();
});

// DATA RIIL 2026-07-08: SEMUA 77 PML punya alokasi (adminPmlSummary →
// jumlahPmlTanpaAlokasi = 0), jadi state "belum ada assignment" tidak bisa
// dipicu lewat akun nyata mana pun. Logic servernya tetap teruji di Node
// (wilayah.test.js: filterByPml PML tanpa assignment → array kosong).
// Aktifkan lagi kalau muncul PML riil tanpa alokasi.
test.skip('PML tanpa assignment: pesan jelas, bukan dropdown kosong', async ({ page }) => {
  const f = await login(page, 'luhputuekayanti@gmail.com');
  await newRecord(f, 'usaha');

  await expect(f.getByTestId('no-assignment')).toBeVisible();
  await expect(f.getByTestId('no-assignment')).toContainText('Belum ada assignment wilayah');
  // Cascade disembunyikan & tombol simpan dinonaktifkan
  await expect(f.getByTestId('kecamatan-trigger')).toBeHidden();
  await expect(f.getByTestId('record-save')).toBeDisabled();
});

test('simpan draft → muncul di dashboard → buka lagi ter-prefill', async ({ page }) => {
  const f = await login(page, 'kadekbudiana74@gmail.com');
  await resetRecords(f);

  await newRecord(f, 'keluarga');
  await pick(f, 'kecamatan', '010');
  await pick(f, 'desa', '002');
  await pick(f, 'sls', '0001');
  await pick(f, 'subsls', '01');
  await expect(f.getByTestId('ppl-info')).toBeVisible();
  await f.getByTestId('record-save').click();

  // Kembali ke dashboard, record baru tampil
  await expect(f.getByTestId('dashboard-view')).toBeVisible();
  await expect(f.getByTestId('record-card')).toHaveCount(1);
  await expect(f.getByTestId('record-card')).toContainText('keluarga');
  await expect(f.getByTestId('record-card')).toContainText('draft');
  await expect(f.getByTestId('record-card')).toContainText('Pejarakan');

  // Buka lagi: jenis & cascade ter-prefill sampai Sub-SLS + PPL tampil
  await f.getByTestId('record-card').click();
  await expect(f.getByTestId('record-view')).toBeVisible();
  await expect(f.getByTestId('record-jenis-chip')).toHaveText('keluarga');
  await expect(f.getByTestId('subsls-trigger')).toHaveText('[01] Sub-SLS 01');
  await expect(f.getByTestId('ppl-nama')).toHaveText('Kadek krisna warma ariesta');
});
