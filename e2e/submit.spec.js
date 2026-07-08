const { test, expect } = require('@playwright/test');

const EXEC_URL = process.env.EXEC_URL ||
  'https://script.google.com/macros/s/AKfycbwJ4spiFeSAymytUTDFl4bfrMcpBBD3NsE5d0k2GCM1_U50slKfyHaC3HhMRipnw7PU/exec';

const KADEK = 'kadekbudiana74@gmail.com';

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

async function newRecord(f, jenis) {
  await f.getByTestId('new-record-btn').click();
  await f.getByTestId('new-' + jenis).click();
}

async function resetRecords(f) {
  await f.locator('body').evaluate(() =>
    new Promise((resolve) =>
      google.script.run.withSuccessHandler(resolve).resetRecords('admin5108')
    )
  );
}

function direct(f, fn, args) {
  return f.locator('body').evaluate(
    (el, { fn, args }) =>
      new Promise((resolve) => {
        const runner = google.script.run
          .withSuccessHandler(resolve)
          .withFailureHandler((e) => resolve({ __failure: String(e) }));
        runner[fn](...args);
      }),
    { fn, args }
  );
}

async function pickWilayah(f) {
  await f.getByTestId('kecamatan-trigger').click();
  await f.getByTestId('kecamatan-list').locator('li[data-kode="010"]').click();
  await f.getByTestId('desa-trigger').click();
  await f.getByTestId('desa-list').locator('li[data-kode="002"]').click();
  await f.getByTestId('sls-trigger').click();
  await f.getByTestId('sls-list').locator('li[data-kode="0001"]').click();
  await f.getByTestId('subsls-trigger').click();
  await f.getByTestId('subsls-list').locator('li[data-kode="01"]').click();
  await expect(f.getByTestId('ppl-info')).toBeVisible();
}

test('submit keluarga: required kosong ditolak + field ditunjuk → submit → daftar anomali → edit → submit ulang ter-update', async ({ page }) => {
  const f = await login(page, KADEK);
  await resetRecords(f);
  await newRecord(f, 'keluarga');
  await expect(f.getByTestId('record-status-chip')).toHaveText('draft');
  await expect(f.getByTestId('q-b1r13_1')).toBeVisible(); // kuesioner selesai dirender

  // ---- (1) Validasi isian: kuesioner kosong → DITOLAK, field ditunjuk ----
  await f.getByTestId('record-submit').click();
  await expect(f.getByTestId('missing-summary')).toBeVisible();
  await expect(f.getByTestId('missing-item').filter({ hasText: 'Wilayah (Sub-SLS)' })).toBeVisible();
  await expect(f.getByTestId('missing-item').filter({ hasText: 'Umur Kepala Keluarga' })).toBeVisible();
  await expect(f.getByTestId('q-b1r13_1')).toHaveAttribute('aria-invalid', 'true');
  await expect(f.getByTestId('anomaly-dialog')).toBeHidden(); // TIDAK tersubmit
  await expect(f.getByTestId('record-status-chip')).toHaveText('draft');

  // ---- (2) Isi lengkap kecuali required di BARIS roster → masih ditolak per baris ----
  await pickWilayah(f);
  await f.getByTestId('q-b1r13_1').fill('8'); // sengaja <10 utk memicu K2 nanti
  await f.getByTestId('q-b4r3a-opt-1').check(); // milik sendiri
  await f.getByTestId('q-b4r5').fill('80');
  await f.getByTestId('roster-add-anggota_keluarga').click();
  await f.getByTestId('q-b1r6_n-0').fill('KETUT SUKARDI'); // hubungan (b1r8_n) dibiarkan kosong
  await f.getByTestId('record-submit').click();
  await expect(f.getByTestId('missing-summary')).toBeVisible();
  await expect(f.getByTestId('q-b1r8_n-0')).toHaveAttribute('aria-invalid', 'true');
  await expect(f.getByTestId('q-b1r13_1')).not.toHaveAttribute('aria-invalid', 'true');

  // ---- (3) Lengkapi → submit sukses → Daftar Anomali: K2 terdeteksi ----
  // Item anomali juga tampil di panel inline "hasil pemeriksaan terakhir",
  // jadi assert HARUS di-scope ke dialog.
  const dialogItems = f.getByTestId('anomaly-dialog').getByTestId('anomaly-item');
  await f.getByTestId('q-b1r8_n-0-opt-1').check();
  await f.getByTestId('record-submit').click();
  await expect(f.getByTestId('anomaly-dialog')).toBeVisible();
  await expect(dialogItems).toHaveCount(1);
  await expect(dialogItems).toContainText('Kepala Keluarga <10 Th');
  await expect(f.getByTestId('missing-summary')).toBeHidden();
  await expect(f.getByTestId('record-status-chip')).toHaveText('submitted');

  // ---- (4) Edit lalu submit ULANG → anomali ter-update (kosong) ----
  await f.getByTestId('anomaly-close').click(); // tetap di kuesioner
  await f.getByTestId('q-b1r13_1').fill('45');
  await f.getByTestId('record-submit').click();
  await expect(f.getByTestId('anomaly-dialog')).toBeVisible();
  await expect(dialogItems).toHaveCount(0);
  await expect(f.getByTestId('anomaly-dialog-count')).toContainText('Tidak ada anomali');

  // ---- (5) Ke dashboard → status submitted; buka lagi → hasil terakhir tampil ----
  await f.getByTestId('anomaly-done').click();
  await expect(f.getByTestId('dashboard-view')).toBeVisible();
  await expect(f.getByTestId('record-card')).toContainText('submitted');
  await f.getByTestId('record-card').click();
  await expect(f.getByTestId('record-status-chip')).toHaveText('submitted');
  await expect(f.getByTestId('anomaly-section')).toBeVisible();
  await expect(f.getByTestId('anomaly-section')).toContainText('tidak ada anomali');
});

test('submit usaha: computed fields server-side memicu multi anomali (U2 + U4)', async ({ page }) => {
  const f = await login(page, KADEK);
  await resetRecords(f);
  await newRecord(f, 'usaha');

  await pickWilayah(f);
  await f.getByTestId('q-nama_usaha').fill('WARUNG SEGARA');
  await f.getByTestId('q-r11a-opt-2').check();   // CV
  await f.getByTestId('q-r13b1-opt-3').check();  // jasa
  await f.getByTestId('q-r22-opt-1').check();    // ada pembukuan
  await f.getByTestId('q-r25').fill('2019');
  await f.getByTestId('q-r26b').fill('50000000');    // total biaya 50jt
  await f.getByTestId('q-r27c').fill('40000000');    // pendapatan < biaya → U2; rasio 0,8 → U4

  await f.getByTestId('record-submit').click();
  const dialogItems = f.getByTestId('anomaly-dialog').getByTestId('anomaly-item');
  await expect(f.getByTestId('anomaly-dialog')).toBeVisible();
  await expect(dialogItems).toHaveCount(2);
  await expect(dialogItems.filter({ hasText: 'Keuntungan Usaha' })).toBeVisible();
  await expect(dialogItems.filter({ hasText: 'rasio pendapatan' })).toBeVisible();
});

test('KBLI (r13g): searchable select cari kode/judul, tersimpan sbg kode; r13f dihitung otomatis (digit pertama)', async ({ page }) => {
  const f = await login(page, KADEK);
  await resetRecords(f);
  await newRecord(f, 'usaha');

  await pickWilayah(f);
  await f.getByTestId('q-nama_usaha').fill('WARUNG SEGARA');
  await f.getByTestId('q-r11a-opt-2').check();
  await f.getByTestId('q-r13b1-opt-3').check();
  await f.getByTestId('q-r25').fill('2019');
  await f.getByTestId('q-r27c').fill('40000000');

  // Cari via judul, bukan kode langsung — memastikan pencarian teks judul jalan.
  await f.getByTestId('kbli-r13g-trigger').click();
  await f.getByTestId('kbli-r13g-search').fill('PERTANIAN JAGUNG');
  await f.getByTestId('kbli-r13g-list').locator('li[data-kode="01111"]').click();
  await expect(f.getByTestId('kbli-r13g-trigger')).toContainText('01111');
  await expect(f.getByTestId('kbli-r13g-trigger')).toContainText('PERTANIAN JAGUNG');

  await expect(f.getByTestId('sync-indicator')).toHaveAttribute('data-state', 'synced', { timeout: 30000 });
  await f.getByTestId('record-submit').click();
  await expect(f.getByTestId('anomaly-dialog')).toBeVisible();
  await f.getByTestId('anomaly-done').click();

  const list = await direct(f, 'listRecords', [KADEK]);
  const rec = await direct(f, 'getRecord', [KADEK, list.records[0].record_id]);
  expect(rec.record.answers.r13g).toBe('01111');
  expect(rec.record.answers.r13f).toBe('0'); // digit pertama, string (bukan number)
});
