const { test, expect } = require('@playwright/test');

const EXEC_URL = process.env.EXEC_URL ||
  'https://script.google.com/macros/s/AKfycbwJ4spiFeSAymytUTDFl4bfrMcpBBD3NsE5d0k2GCM1_U50slKfyHaC3HhMRipnw7PU/exec';
const ADMIN_URL = EXEC_URL + '?page=admin';

const KADEK = 'kadekbudiana74@gmail.com';
const ADMIN_PW = 'admin5108';

function app(page) {
  return page.frameLocator('#sandboxFrame').frameLocator('#userHtmlFrame');
}

// Panggilan LANGSUNG google.script.run dari dalam frame — mensimulasikan
// penyerang yang membuka console browser, TANPA lewat UI mana pun.
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

async function resetAll(f) {
  await direct(f, 'resetMockConfig', [ADMIN_PW]);
  await direct(f, 'resetMockRecords', [ADMIN_PW]);
}

async function adminLogin(page) {
  await page.goto(ADMIN_URL);
  const f = app(page);
  await f.getByTestId('admin-password').fill(ADMIN_PW);
  await f.getByTestId('admin-login-submit').click();
  await expect(f.getByTestId('admin-main')).toBeVisible();
  return f;
}

async function pmlLogin(page) {
  await page.goto(EXEC_URL);
  const f = app(page);
  await f.getByTestId('login-email').fill(KADEK);
  await f.getByTestId('login-password').fill('cobaapp');
  await f.getByTestId('login-submit').click();
  await expect(f.getByTestId('dashboard-view')).toBeVisible();
  return f;
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

// Config dikembalikan ke baseline apa pun hasil test, supaya suite lain
// (kuesioner/submit) selalu melihat Questions & Rules bawaan.
test.afterEach(async ({ page }) => {
  try {
    const f = app(page);
    await direct(f, 'resetMockConfig', [ADMIN_PW]);
    await direct(f, 'resetMockRecords', [ADMIN_PW]);
  } catch (e) { /* halaman sudah tertutup — biarkan */ }
});

test('login admin: password salah DITOLAK (tidak masuk), password benar masuk', async ({ page }) => {
  await page.goto(ADMIN_URL);
  const f = app(page);
  await f.getByTestId('admin-password').fill('salah123');
  await f.getByTestId('admin-login-submit').click();
  await expect(f.getByTestId('admin-login-error')).toBeVisible();
  await expect(f.getByTestId('admin-main')).toBeHidden();

  await f.getByTestId('admin-password').fill(ADMIN_PW);
  await f.getByTestId('admin-login-submit').click();
  await expect(f.getByTestId('admin-main')).toBeVisible();
  await expect(f.getByTestId('aq-row-nama_usaha')).toBeVisible(); // tab default usaha termuat
});

test('CRUD pertanyaan: tambah → edit → reorder ↑ → nonaktifkan; kuesioner baru kehilangan field, jawaban record lama TETAP tersimpan', async ({ page, context }) => {
  const fa = await adminLogin(page);
  await resetAll(fa);
  await fa.getByTestId('jenis-tab-keluarga').click();
  await expect(fa.getByTestId('aq-row-b1r13_1')).toBeVisible();

  // -- Tambah --
  await fa.getByTestId('aq-add').click();
  await fa.getByTestId('aq-alias').fill('warna_pintu');
  await fa.getByTestId('aq-label').fill('Warna pintu rumah');
  await fa.getByTestId('aq-save').click();
  await expect(fa.getByTestId('aq-row-warna_pintu')).toBeVisible();
  // pertanyaan baru nempel di URUTAN TERAKHIR
  await expect(fa.locator('#aq-list > div').last()).toHaveAttribute('data-testid', 'aq-row-warna_pintu');

  // -- Edit label --
  await fa.getByTestId('aq-edit-warna_pintu').click();
  await expect(fa.getByTestId('aq-alias')).toBeDisabled(); // alias terkunci saat edit
  await fa.getByTestId('aq-label').fill('Warna pintu rumah (revisi)');
  await fa.getByTestId('aq-save').click();
  await expect(fa.getByTestId('aq-row-warna_pintu')).toContainText('Warna pintu rumah (revisi)');

  // -- Reorder ↑ : tidak lagi di posisi terakhir --
  await fa.getByTestId('aq-up-warna_pintu').click();
  await expect(fa.locator('#aq-list > div').last()).not.toHaveAttribute('data-testid', 'aq-row-warna_pintu');
  await expect(fa.getByTestId('aq-row-warna_pintu')).toBeVisible(); // masih ada, cuma pindah

  // -- PML mengisi record DENGAN field baru (masih aktif) --
  const pml = await context.newPage();
  const fp = await pmlLogin(pml);
  await fp.getByTestId('new-record-btn').click();
  await fp.getByTestId('new-keluarga').click();
  await expect(fp.getByTestId('q-warna_pintu')).toBeVisible(); // field baru tampil ke PML
  await pickWilayah(fp);
  await fp.getByTestId('q-b1r13_1').fill('45');
  await fp.getByTestId('q-b4r3a').selectOption('1');
  await fp.getByTestId('q-b4r5').fill('80');
  await fp.getByTestId('q-warna_pintu').fill('biru');
  await expect(fp.getByTestId('sync-indicator')).toHaveAttribute('data-state', 'synced', { timeout: 30000 });
  await fp.getByTestId('record-save').click();
  await expect(fp.getByTestId('dashboard-view')).toBeVisible();

  // -- Admin menonaktifkan (soft-delete, BUKAN hapus) --
  await fa.getByTestId('aq-toggle-warna_pintu').click();
  await expect(fa.getByTestId('aq-row-warna_pintu')).toContainText('NONAKTIF');

  // -- Kuesioner BARU (sesi segar): field hilang --
  await pml.goto(EXEC_URL);
  const fp2 = app(pml);
  await fp2.getByTestId('login-email').fill(KADEK);
  await fp2.getByTestId('login-password').fill('cobaapp');
  await fp2.getByTestId('login-submit').click();
  await expect(fp2.getByTestId('dashboard-view')).toBeVisible();
  await fp2.getByTestId('new-record-btn').click();
  await fp2.getByTestId('new-keluarga').click();
  await expect(fp2.getByTestId('q-b1r13_1')).toBeVisible();
  await expect(fp2.getByTestId('q-warna_pintu')).toHaveCount(0);
  await fp2.getByTestId('record-back').click();

  // -- Record LAMA tetap terbuka benar & jawaban field nonaktif TIDAK hilang --
  await expect(fp2.getByTestId('record-card')).toHaveCount(1);
  await fp2.getByTestId('record-card').click();
  await expect(fp2.getByTestId('q-b1r13_1')).toHaveValue('45'); // isian lain utuh
  const list = await direct(fp2, 'listRecords', [KADEK]);
  const rec = await direct(fp2, 'getRecord', [KADEK, list.records[0].record_id]);
  expect(rec.record.answers.warna_pintu).toBe('biru'); // tersimpan di server, tidak terhapus

  await pml.close();
});

test('rule baru via UI + preview: preview TERPICU/TIDAK benar, submit PML berikutnya menandai anomali baru', async ({ page, context }) => {
  const fa = await adminLogin(page);
  await resetAll(fa);
  await fa.getByTestId('jenis-tab-keluarga').click();
  await expect(fa.getByTestId('ar-row-K1')).toBeVisible();

  // -- Susun rule Mode Sederhana: b4r5 > 500 --
  await fa.getByTestId('ar-add').click();
  await fa.getByTestId('ar-message').fill('UJI-E2E: luas bangunan tidak wajar (> 500 m²)');
  await fa.getByTestId('ar-field').selectOption('b4r5');
  await fa.getByTestId('ar-op').selectOption('>');
  await fa.getByTestId('ar-value').fill('500');

  // -- Preview pakai evaluator yang SAMA dengan submit --
  await fa.getByTestId('ar-preview-answers').fill('{"b4r5": 600}');
  await fa.getByTestId('ar-preview-run').click();
  await expect(fa.getByTestId('ar-preview-result')).toContainText('TERPICU');
  await fa.getByTestId('ar-preview-answers').fill('{"b4r5": 100}');
  await fa.getByTestId('ar-preview-run').click();
  await expect(fa.getByTestId('ar-preview-result')).toContainText('TIDAK terpicu');

  // -- Simpan → id otomatis K100, langsung aktif --
  await fa.getByTestId('ar-save').click();
  await expect(fa.getByTestId('ar-row-K100')).toBeVisible();
  await expect(fa.getByTestId('ar-row-K100')).toContainText('UJI-E2E');

  // -- PML submit record yang memenuhi kondisi → anomali BARU muncul --
  const pml = await context.newPage();
  const fp = await pmlLogin(pml);
  await fp.getByTestId('new-record-btn').click();
  await fp.getByTestId('new-keluarga').click();
  await expect(fp.getByTestId('q-b1r13_1')).toBeVisible();
  await pickWilayah(fp);
  await fp.getByTestId('q-b1r13_1').fill('45');
  await fp.getByTestId('q-b4r3a').selectOption('1');
  await fp.getByTestId('q-b4r5').fill('600');
  await fp.getByTestId('record-submit').click();
  const dialogItems = fp.getByTestId('anomaly-dialog').getByTestId('anomaly-item');
  await expect(fp.getByTestId('anomaly-dialog')).toBeVisible();
  await expect(dialogItems).toHaveCount(1);
  await expect(dialogItems).toContainText('UJI-E2E: luas bangunan tidak wajar');

  await pml.close();
});

test('SERVER-SIDE GUARD: panggilan langsung (console) SEMUA fungsi privileged dengan password salah/kosong/tanpa-argumen DITOLAK', async ({ page }) => {
  // Dari halaman PML biasa — membuktikan proteksi tidak bergantung UI admin.
  const f = await pmlLogin(page);

  const PRIVILEGED = [
    ['createQuestion', ['keluarga', { question_id: 'bobol', label: 'x', type: 'text' }]],
    ['updateQuestion', ['keluarga', 'b4r5', { label: 'DIBOBOL' }]],
    ['setQuestionActive', ['keluarga', 'b4r5', false]],
    ['reorderQuestions', ['keluarga', []]],
    ['createRule', ['keluarga', { severity: 'warning', message: 'bobol', when: { field: 'b4r5', op: '>', value: 1 } }]],
    ['updateRule', ['K7', { message: 'DIBOBOL' }]],
    ['setRuleActive', ['K7', false]],
    ['previewRule', ['keluarga', { field: 'b4r5', op: '>', value: 1 }, {}]],
    ['checkAdminPassword', []],
    ['resetMockConfig', []],
    ['resetMockRecords', []]
  ];

  for (const [fn, rest] of PRIVILEGED) {
    for (const pw of ['password-salah', '']) {
      const res = await direct(f, fn, [pw, ...rest]);
      expect(res, `${fn} dengan password "${pw}"`).toEqual({ ok: false, error: 'FORBIDDEN' });
    }
  }
  // Tanpa argumen sama sekali (adminPassword undefined) → tetap FORBIDDEN.
  expect(await direct(f, 'setRuleActive', [])).toEqual({ ok: false, error: 'FORBIDDEN' });

  // Data TIDAK berubah oleh semua percobaan di atas.
  const qs = await direct(f, 'getQuestions', ['keluarga', true]);
  const b4r5 = qs.questions.find((q) => q.question_id === 'b4r5');
  expect(b4r5.label).toBe('Luas lantai bangunan tempat tinggal (m²)');
  expect(b4r5.active).toBe(true);
  expect(qs.questions.some((q) => q.question_id === 'bobol')).toBe(false);
  const rules = await direct(f, 'getRules', ['keluarga', true]);
  const k7 = rules.rules.find((r) => r.rule_id === 'K7');
  expect(k7.message).toContain('Jumlah Anggota Keluarga Ekstrem');
  expect(k7.active).toBe(true);

  // Kontrol positif: password BENAR diterima server (bukti guard-nya yang
  // menolak, bukan fungsinya yang mati).
  const okCreate = await direct(f, 'createQuestion',
    [ADMIN_PW, 'keluarga', { question_id: 'kontrol_positif', label: 'x', type: 'text' }]);
  expect(okCreate.ok).toBe(true);
  expect(await direct(f, 'resetMockConfig', [ADMIN_PW])).toEqual({ ok: true });
});
