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
async function resetMockRecords(f) {
  await f.locator('body').evaluate(() =>
    new Promise((resolve) =>
      google.script.run.withSuccessHandler(resolve).resetMockRecords('admin5108')
    )
  );
}

// Alur baru Fase 2: tombol "Buat Record" → dialog pilih jenis → kuesioner.
async function newRecord(f, jenis) {
  await f.getByTestId('new-record-btn').click();
  await f.getByTestId('new-' + jenis).click();
}

test('cascade penuh KADEK: opsi terfilter, PPL/PML benar, ganti kecamatan me-reset', async ({ page }) => {
  const f = await login(page, 'kadekbudiana74@gmail.com');
  await newRecord(f, 'keluarga');

  // Prov & Kab auto-terisi read-only
  await expect(f.getByTestId('prov')).toHaveValue('[51] Bali');
  await expect(f.getByTestId('kab')).toHaveValue('[08] Buleleng');

  // Kecamatan: hanya assignment Kadek (Gerokgak + Seririt)
  expect(await openAndListKodes(f, 'kecamatan')).toEqual(['010', '020']);
  await pick(f, 'kecamatan', '010');

  // Desa terfilter per kecamatan: Sumberkima+Pejarakan, TANPA Sumberklampok (punya Ketut)
  await f.getByTestId('desa-trigger').click();
  const desaList = f.getByTestId('desa-list');
  await expect(desaList.locator('li[data-kode]').first()).toBeVisible();
  expect(await desaList.locator('li[data-kode]').evaluateAll((els) => els.map((e) => e.getAttribute('data-kode')))).toEqual(['002', '003']);
  await expect(desaList).not.toContainText('Sumberklampok');

  // Searchable: ketik "kima" → tersisa Sumberkima saja, lalu pilih
  await f.getByTestId('desa-search').fill('kima');
  await expect(desaList.locator('li[data-kode]')).toHaveCount(1);
  await desaList.locator('li[data-kode="002"]').click();

  // SLS → Sub-SLS
  expect(await openAndListKodes(f, 'sls')).toEqual(['0001', '0002']);
  await pick(f, 'sls', '0001');
  expect(await openAndListKodes(f, 'subsls')).toEqual(['01', '02']);
  await pick(f, 'subsls', '01');

  // PPL & PML tampil otomatis — nama kanonik hasil join ke Petugas
  await expect(f.getByTestId('ppl-info')).toBeVisible();
  await expect(f.getByTestId('ppl-nama')).toHaveText('NI MADE RUSPINI');
  await expect(f.getByTestId('pml-nama')).toHaveText('KADEK BUDIANA');

  // Ganti kecamatan → desa/SLS/Sub-SLS reset, PPL hilang
  await pick(f, 'kecamatan', '020');
  await expect(f.getByTestId('desa-trigger')).toHaveText('Pilih Desa');
  await expect(f.getByTestId('sls-trigger')).toBeDisabled();
  await expect(f.getByTestId('subsls-trigger')).toBeDisabled();
  await expect(f.getByTestId('ppl-info')).toBeHidden();

  // Kasus emailppl kosong: fallback ke nama di alokasi
  await pick(f, 'desa', '001');
  await pick(f, 'sls', '0001');
  await pick(f, 'subsls', '01');
  await expect(f.getByTestId('ppl-nama')).toHaveText('GEDE SUARDANA');
});

test('isolasi assignment: KETUT hanya lihat wilayahnya sendiri, bukan punya KADEK', async ({ page }) => {
  const f = await login(page, 'akusury336@gmail.com');
  await newRecord(f, 'usaha');

  // Hanya Gerokgak — Seririt (assignment Kadek) TIDAK muncul
  expect(await openAndListKodes(f, 'kecamatan')).toEqual(['010']);
  await pick(f, 'kecamatan', '010');

  // Di Gerokgak, Ketut cuma lihat Sumberklampok — desa Kadek (Sumberkima,
  // Pejarakan) tidak bisa diakses sama sekali dari akun ini
  await f.getByTestId('desa-trigger').click();
  const desaList = f.getByTestId('desa-list');
  await expect(desaList.locator('li[data-kode]').first()).toBeVisible();
  expect(await desaList.locator('li[data-kode]').evaluateAll((els) => els.map((e) => e.getAttribute('data-kode')))).toEqual(['001']);
  await expect(desaList).not.toContainText('Sumberkima');
  await expect(desaList).not.toContainText('Pejarakan');
  await desaList.locator('li[data-kode="001"]').click();

  await pick(f, 'sls', '0001');
  expect(await openAndListKodes(f, 'subsls')).toEqual(['01', '02']);
  await pick(f, 'subsls', '01');

  await expect(f.getByTestId('ppl-nama')).toHaveText('ABDUL BASIT');
  await expect(f.getByTestId('pml-nama')).toHaveText('KETUT SURYANTA PUTRA');
});

test('PML tanpa assignment: pesan jelas, bukan dropdown kosong', async ({ page }) => {
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
  await resetMockRecords(f);

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
  await expect(f.getByTestId('record-card')).toContainText('Sumberkima');

  // Buka lagi: jenis & cascade ter-prefill sampai Sub-SLS + PPL tampil
  await f.getByTestId('record-card').click();
  await expect(f.getByTestId('record-view')).toBeVisible();
  await expect(f.getByTestId('record-jenis-chip')).toHaveText('keluarga');
  await expect(f.getByTestId('subsls-trigger')).toHaveText('[01] Sub-SLS 01');
  await expect(f.getByTestId('ppl-nama')).toHaveText('NI MADE RUSPINI');
});
