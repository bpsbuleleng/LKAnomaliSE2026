const { test, expect } = require('@playwright/test');

const EXEC_URL = process.env.EXEC_URL ||
  'https://script.google.com/macros/s/AKfycbwJ4spiFeSAymytUTDFl4bfrMcpBBD3NsE5d0k2GCM1_U50slKfyHaC3HhMRipnw7PU/exec';

// Akun organik = akses pengawas: melihat record SEMUA PML (bukan cuma
// miliknya sendiri), tapi read-only — lihat CLAUDE.md & RecordLogic.js.
const KADEK = 'kadekbudiana74@gmail.com';
const ORGANIK = 'organik@bps.go.id';

function app(page) {
  return page.frameLocator('#sandboxFrame').frameLocator('#userHtmlFrame');
}

async function login(page, email) {
  await page.goto(EXEC_URL);
  const f = app(page);
  // Sesi login sebelumnya di-restore otomatis dari localStorage (lihat
  // Index.html restoreSession) — test ini login berkali-kali di page yang
  // SAMA, jadi logout dulu kalau sesi lama masih aktif supaya form login muncul.
  if (await f.getByTestId('dashboard-view').isVisible().catch(() => false)) {
    await f.getByTestId('logout-btn').click();
  }
  await expect(f.getByTestId('login-email')).toBeVisible();
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

// Panggil fungsi DataAccess langsung dari console halaman — dipakai di sini
// untuk membuat record KADEK tanpa mengisi seluruh form UI (test ini fokus
// ke visibilitas Dashboard/RecordView, bukan alur isi kuesioner).
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

test('akun organik: lihat Dashboard & record milik PML lain (read-only); PML biasa tetap hanya lihat miliknya', async ({ page }) => {
  const f = await login(page, KADEK);
  await resetRecords(f);
  const saved = await direct(f, 'saveDraft', [KADEK,
    { jenis: 'keluarga', idsubsls: '5108010002000101', answers: { b1r13_1: 30 } }]);
  expect(saved.ok).toBe(true);

  // -- Organik: Dashboard menampilkan record KADEK, dengan badge pembuat --
  const g = await login(page, ORGANIK);
  await expect(g.getByTestId('record-card')).toHaveCount(1);
  await expect(g.getByTestId('owner-badge')).toBeVisible();
  await expect(g.getByTestId('owner-badge')).toContainText(/kadek/i);

  // -- Buka record: read-only — banner tampil, tombol simpan/submit/hapus TIDAK --
  await g.getByTestId('record-card').click();
  await expect(g.getByTestId('readonly-banner')).toBeVisible();
  await expect(g.getByTestId('readonly-banner')).toContainText(KADEK);
  await expect(g.getByTestId('record-save')).toBeHidden();
  await expect(g.getByTestId('record-submit')).toBeHidden();
  await expect(g.getByTestId('record-delete')).toBeHidden();
  await g.getByTestId('record-back').click();
  await expect(g.getByTestId('dashboard-view')).toBeVisible();

  // -- Regresi: KADEK login lagi → tetap hanya lihat record miliknya sendiri --
  const f2 = await login(page, KADEK);
  await expect(f2.getByTestId('record-card')).toHaveCount(1);
  await expect(f2.getByTestId('owner-badge')).toHaveCount(0);
});
