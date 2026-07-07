const { test, expect } = require('@playwright/test');

// URL deployment /exec dengan ID TETAP (redeploy selalu ke ID ini via `npm run deploy`).
const EXEC_URL = process.env.EXEC_URL ||
  'https://script.google.com/macros/s/AKfycbwJ4spiFeSAymytUTDFl4bfrMcpBBD3NsE5d0k2GCM1_U50slKfyHaC3HhMRipnw7PU/exec';

// HTML Service merender app di dalam iframe bersarang: #sandboxFrame > #userHtmlFrame.
function app(page) {
  return page.frameLocator('#sandboxFrame').frameLocator('#userHtmlFrame');
}

async function submitLogin(page, email, password) {
  const f = app(page);
  await f.getByTestId('login-email').fill(email);
  await f.getByTestId('login-password').fill(password);
  await f.getByTestId('login-submit').click();
  return f;
}

test.beforeEach(async ({ page }) => {
  await page.goto(EXEC_URL);
});

test('login valid: PML masuk ke dashboard placeholder', async ({ page }) => {
  const f = await submitLogin(page, 'kadekbudiana74@gmail.com', 'cobaapp');
  await expect(f.getByTestId('dashboard-view')).toBeVisible();
  await expect(f.getByTestId('dashboard-greeting')).toContainText('KADEK BUDIANA');
});

test('password salah: tetap di login + pesan error', async ({ page }) => {
  const f = await submitLogin(page, 'kadekbudiana74@gmail.com', 'passwordsalah');
  await expect(f.getByTestId('login-error')).toContainText('Password salah');
  await expect(f.getByTestId('dashboard-view')).toBeHidden();
});

test('email PPL (bukan PML) ditolak', async ({ page }) => {
  const f = await submitLogin(page, 'ruspininimade@gmail.com', 'cobaapp');
  await expect(f.getByTestId('login-error')).toContainText('bukan akun PML');
  await expect(f.getByTestId('dashboard-view')).toBeHidden();
});

test('email tidak terdaftar ditolak', async ({ page }) => {
  const f = await submitLogin(page, 'tidakada@gmail.com', 'cobaapp');
  await expect(f.getByTestId('login-error')).toContainText('tidak terdaftar');
  await expect(f.getByTestId('dashboard-view')).toBeHidden();
});

test('logout kembali ke layar login', async ({ page }) => {
  const f = await submitLogin(page, 'kadekbudiana74@gmail.com', 'cobaapp');
  await expect(f.getByTestId('dashboard-view')).toBeVisible();
  await f.getByTestId('logout-btn').click();
  await expect(f.getByTestId('login-submit')).toBeVisible();
  await expect(f.getByTestId('dashboard-view')).toBeHidden();
});
