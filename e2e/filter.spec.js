const { test, expect } = require('@playwright/test');

const EXEC_URL = process.env.EXEC_URL ||
  'https://script.google.com/macros/s/AKfycbwJ4spiFeSAymytUTDFl4bfrMcpBBD3NsE5d0k2GCM1_U50slKfyHaC3HhMRipnw7PU/exec';

// Akun organik: tidak terikat wilayah, jadi bisa pilih Sub-SLS di kecamatan
// MANAPUN — dipakai di sini supaya test bisa punya 2 record dengan
// kecamatan/PPL BERBEDA (PML biasa hanya di-assign 1 desa/kecamatan di data
// riil, jadi tidak representatif untuk menguji filter wilayah/PPL).
const ORGANIK = 'organik@bps.go.id';
const K2_MESSAGE = 'Kepala Keluarga <10 Th di Rumah Sendiri: umur kepala keluarga di bawah 10 tahun dengan rumah milik sendiri';

function app(page) {
  return page.frameLocator('#sandboxFrame').frameLocator('#userHtmlFrame');
}

async function login(page, email) {
  await page.goto(EXEC_URL);
  const f = app(page);
  // Halaman awal = dashboard visualisasi; form login ada di balik tombolnya.
  await f.getByTestId('goto-app-btn').click();
  await f.getByTestId('login-email').fill(email);
  await f.getByTestId('login-password').fill('cobaapp');
  await f.getByTestId('login-submit').click();
  await expect(f.getByTestId('dashboard-view')).toBeVisible();
  return f;
}

async function resetRecords(f) {
  await f.locator('body').evaluate(() =>
    new Promise((resolve) =>
      google.script.run.withSuccessHandler(resolve).resetRecords('admin5108')
    )
  );
}

async function pickWilayahAt(f, kec, desa, sls, subsls) {
  await f.getByTestId('kecamatan-trigger').click();
  await f.getByTestId('kecamatan-list').locator('li[data-kode="' + kec + '"]').click();
  await f.getByTestId('desa-trigger').click();
  await f.getByTestId('desa-list').locator('li[data-kode="' + desa + '"]').click();
  await f.getByTestId('sls-trigger').click();
  await f.getByTestId('sls-list').locator('li[data-kode="' + sls + '"]').click();
  await f.getByTestId('subsls-trigger').click();
  await f.getByTestId('subsls-list').locator('li[data-kode="' + subsls + '"]').click();
  await expect(f.getByTestId('ppl-info')).toBeVisible();
}

test('filter dashboard: status, wilayah, anomali (termasuk "tidak ada anomali"), PPL', async ({ page }) => {
  const f = await login(page, ORGANIK);
  await resetRecords(f);

  // -- Record A: Gerokgak/Sumberklampok (PPL: Abdul Basit), DRAFT, tanpa anomali --
  await f.getByTestId('new-record-btn').click();
  await f.getByTestId('new-keluarga').click();
  await pickWilayahAt(f, '010', '001', '0001', '01');
  await f.getByTestId('q-b1r13_1').fill('30');
  await f.getByTestId('q-b4r3a-opt-2').check(); // kontrak/sewa
  await f.getByTestId('q-b4r5').fill('50');
  await expect(f.getByTestId('sync-indicator')).toHaveAttribute('data-state', 'synced', { timeout: 30000 });
  await f.getByTestId('record-save').click();
  await expect(f.getByTestId('dashboard-view')).toBeVisible();

  // -- Record B: Seririt/Unggahan (PPL: I Komang Julianto), SUBMITTED, memicu K2 --
  await f.getByTestId('new-record-btn').click();
  await f.getByTestId('new-keluarga').click();
  await pickWilayahAt(f, '020', '001', '0001', '01');
  await f.getByTestId('q-b1r13_1').fill('5');
  await f.getByTestId('q-b4r3a-opt-1').check(); // milik sendiri
  await f.getByTestId('q-b4r5').fill('50');
  await expect(f.getByTestId('sync-indicator')).toHaveAttribute('data-state', 'synced', { timeout: 30000 });
  await f.getByTestId('record-submit').click();
  await expect(f.getByTestId('anomaly-dialog')).toBeVisible();
  await f.getByTestId('anomaly-done').click();
  await expect(f.getByTestId('dashboard-view')).toBeVisible();

  // -- Baseline: dua-duanya tampil --
  await expect(f.getByTestId('record-card')).toHaveCount(2);

  // -- Filter status --
  await f.getByTestId('filter-status').selectOption('draft');
  await expect(f.getByTestId('record-card')).toHaveCount(1);
  await f.getByTestId('filter-status').selectOption('submitted');
  await expect(f.getByTestId('record-card')).toHaveCount(1);
  await f.getByTestId('filter-status').selectOption('');

  // -- Filter wilayah (kecamatan) --
  await f.getByTestId('filter-wilayah').selectOption('Seririt');
  await expect(f.getByTestId('record-card')).toHaveCount(1);
  await f.getByTestId('filter-wilayah').selectOption('');

  // -- Filter PPL --
  await f.getByTestId('filter-ppl').selectOption('Abdul Basit');
  await expect(f.getByTestId('record-card')).toHaveCount(1);
  await f.getByTestId('filter-ppl').selectOption('');

  // -- Filter anomali: "Tidak ada anomali" → hanya record A (draft, belum di-run rule) --
  await f.getByTestId('filter-anomali').selectOption('__none__');
  await expect(f.getByTestId('record-card')).toHaveCount(1);
  // -- Filter anomali: pesan K2 → hanya record B --
  await f.getByTestId('filter-anomali').selectOption(K2_MESSAGE);
  await expect(f.getByTestId('record-card')).toHaveCount(1);
  await f.getByTestId('filter-anomali').selectOption('');

  // -- Kombinasi filter yang tidak cocok apa pun → daftar kosong + pesan --
  await f.getByTestId('filter-wilayah').selectOption('Seririt');
  await f.getByTestId('filter-status').selectOption('draft'); // B submitted, bukan draft
  await expect(f.getByTestId('record-card')).toHaveCount(0);
  await expect(f.getByTestId('record-filtered-empty')).toBeVisible();
});
