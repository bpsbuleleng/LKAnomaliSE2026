const { test, expect } = require('@playwright/test');

const EXEC_URL = process.env.EXEC_URL ||
  'https://script.google.com/macros/s/AKfycbwJ4spiFeSAymytUTDFl4bfrMcpBBD3NsE5d0k2GCM1_U50slKfyHaC3HhMRipnw7PU/exec';

const KADEK = 'kadekbudiana74@gmail.com';
const ADMIN_PW = 'admin5108';
const IDSUBSLS = '5108010002000101'; // assignment KADEK di dataset baseline

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

// Panggilan langsung google.script.run dari dalam frame (jalur transport yang
// sama dengan aplikasi) — dipakai untuk memicu dua request server paralel.
async function gsCall(f, fn, args) {
  return f.locator('body').evaluate(
    (body, { fn, args }) =>
      new Promise((resolve, reject) => {
        google.script.run
          .withSuccessHandler(resolve)
          .withFailureHandler((e) => reject(new Error(String((e && e.message) || e))))
          [fn](...args);
      }),
    { fn, args }
  );
}

function usahaAnswers(nama) {
  // Semua field required usaha terisi → submit lolos validasi.
  return { nama_usaha: nama, r11a: 2, r13b1: 3, r13g: '01111', r25: 2019, r27c: 50000000 };
}

test('ACCEPTANCE Fase 5: dua submit nyaris bersamaan → record_id unik, tepat 2 baris di tab Records', async ({ browser }) => {
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const pageA = await ctxA.newPage();
  const pageB = await ctxB.newPage();
  const fA = await login(pageA, KADEK);
  const fB = await login(pageB, KADEK);

  await gsCall(fA, 'resetRecords', [ADMIN_PW]);

  // Dua proses paralel men-submit record BARU (tanpa record_id) serentak —
  // LockService yang harus menjamin tidak ada duplikat/baris hilang.
  const [ra, rb] = await Promise.all([
    gsCall(fA, 'submitRecord', [KADEK, { jenis: 'usaha', idsubsls: IDSUBSLS, answers: usahaAnswers('RACE A') }]),
    gsCall(fB, 'submitRecord', [KADEK, { jenis: 'usaha', idsubsls: IDSUBSLS, answers: usahaAnswers('RACE B') }])
  ]);

  expect(ra.ok).toBe(true);
  expect(rb.ok).toBe(true);
  expect(ra.submitted).toBe(true);
  expect(rb.submitted).toBe(true);
  expect(ra.record_id).not.toEqual(rb.record_id);

  // Kedua record terbaca kembali, tidak ada id ganda.
  const list = await gsCall(fA, 'listRecords', [KADEK]);
  expect(list.ok).toBe(true);
  expect(list.records.length).toBe(2);
  expect(new Set(list.records.map((r) => r.record_id)).size).toBe(2);

  // Baris FISIK di tab Records juga tepat 2 (bukan 1 tertimpa / 3 dobel).
  const status = await gsCall(fA, 'adminSheetStatus', [ADMIN_PW]);
  expect(status.ok).toBe(true);
  expect(status.tabs['Records'].dataRows).toBe(2);

  await ctxA.close();
  await ctxB.close();
});

test('implementasi Sheets tetap menolak fungsi privileged berpassword salah', async ({ page }) => {
  const f = await login(page, KADEK);
  const calls = [
    ['adminSheetStatus', ['salah']],
    ['adminSetupSheets', ['salah']],
    ['resetRecords', ['salah']],
    ['resetConfig', ['salah']],
    ['updateRule', ['salah', 'K7', { message: 'bobol dari console' }]],
    ['createQuestion', ['salah', 'usaha', { question_id: 'bobol', label: 'x', type: 'text' }]]
  ];
  for (const [fn, args] of calls) {
    expect(await gsCall(f, fn, args)).toEqual({ ok: false, error: 'FORBIDDEN' });
  }
  // Password benar → jalan (kontrol positif, memastikan penolakan di atas
  // memang karena password, bukan karena fungsinya error).
  const ok = await gsCall(f, 'adminSheetStatus', [ADMIN_PW]);
  expect(ok.ok).toBe(true);
});
