const { test, expect } = require('@playwright/test');

// URL deployment /exec dengan ID TETAP (redeploy selalu ke ID ini via `npm run deploy`).
const EXEC_URL = process.env.EXEC_URL ||
  'https://script.google.com/macros/s/AKfycbwJ4spiFeSAymytUTDFl4bfrMcpBBD3NsE5d0k2GCM1_U50slKfyHaC3HhMRipnw7PU/exec';

function app(page) {
  return page.frameLocator('#sandboxFrame').frameLocator('#userHtmlFrame');
}

// Spec ini READ-ONLY (tidak resetRecords/menulis apa pun) — aman dijalankan
// walau tab Records sudah berisi data sungguhan. Assertion dibuat tidak
// bergantung pada isi data (bisa kosong ataupun terisi).

test('halaman awal = dashboard visualisasi: filter row, tile, dan kartu/empty-state', async ({ page }) => {
  await page.goto(EXEC_URL);
  const f = app(page);

  // Landing langsung dashboard viz — bukan form login.
  await expect(f.getByTestId('viz-view')).toBeVisible();
  await expect(f.getByTestId('login-email')).toBeHidden();

  // Baris filter lengkap: kecamatan, desa, sls, pml, ppl (+ draft toggle).
  for (const id of ['viz-filter-kec', 'viz-filter-desa', 'viz-filter-sls', 'viz-filter-pml', 'viz-filter-ppl', 'viz-include-draft']) {
    await expect(f.getByTestId(id)).toBeVisible();
  }

  // Tile ringkasan render setelah data termuat dari server.
  await expect(f.getByTestId('viz-tile-total')).toBeVisible({ timeout: 60000 });
  await expect(f.getByTestId('viz-tile-submitted')).toBeVisible();

  // Ada record pada slice → kartu butir pertanyaan muncul, tabulasi bisa
  // dibuka dan punya 5 tab dimensi; slice kosong → pesan empty.
  const cards = f.getByTestId('viz-card');
  if ((await cards.count()) > 0) {
    const card = cards.first();
    await card.getByTestId('viz-tab-toggle').click();
    for (const dim of ['viz-tab-kec', 'viz-tab-desa', 'viz-tab-sls', 'viz-tab-pml', 'viz-tab-ppl']) {
      await expect(card.getByTestId(dim)).toBeVisible();
    }
    await card.getByTestId('viz-tab-desa').click();
    await expect(card.getByTestId('viz-table')).toBeVisible();
  } else {
    await expect(f.getByTestId('viz-empty')).toBeVisible();
  }

  // Ganti jenis kuesioner tidak boleh error — tile tetap tampil.
  await f.getByTestId('viz-jenis-keluarga').click();
  await expect(f.getByTestId('viz-tile-total')).toBeVisible();
});

test('tombol Masuk membuka form login; bisa kembali ke dashboard', async ({ page }) => {
  await page.goto(EXEC_URL);
  const f = app(page);
  await expect(f.getByTestId('goto-app-btn')).toBeVisible();
  await f.getByTestId('goto-app-btn').click();
  await expect(f.getByTestId('login-email')).toBeVisible();
  await f.getByTestId('login-back-viz').click();
  await expect(f.getByTestId('viz-view')).toBeVisible();
});
