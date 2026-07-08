/**
 * sheet-admin — jalankan fungsi maintenance server dari terminal lewat
 * Playwright + google.script.run (transport yang sama dengan aplikasi).
 *
 * Pakai:  node scripts/sheet-admin.js status         → adminSheetStatus
 *         node scripts/sheet-admin.js setup          → adminSetupSheets (buat tab + seed yang kosong)
 *         node scripts/sheet-admin.js backup-records → salin tab Records ke tab backup ber-timestamp
 *         node scripts/sheet-admin.js reset-records  → kosongkan tab Records (testing! backup dulu)
 *         node scripts/sheet-admin.js reset-config   → Questions/Rules kembali ke baseline (testing!)
 * Env:    EXEC_URL (default deployment tetap), ADMIN_PW (default pilot).
 */
const { chromium } = require('@playwright/test');

const EXEC_URL = process.env.EXEC_URL ||
  'https://script.google.com/macros/s/AKfycbwJ4spiFeSAymytUTDFl4bfrMcpBBD3NsE5d0k2GCM1_U50slKfyHaC3HhMRipnw7PU/exec';
const ADMIN_PW = process.env.ADMIN_PW || 'admin5108';

const FN = {
  status: 'adminSheetStatus',
  setup: 'adminSetupSheets',
  'backup-records': 'adminBackupRecords',
  'reset-records': 'resetRecords',
  'reset-config': 'resetConfig'
}[process.argv[2] || 'status'];

if (!FN) {
  console.error('Perintah tidak dikenal. Pakai: status | setup | backup-records | reset-records | reset-config');
  process.exit(2);
}

(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(EXEC_URL);
    const f = page.frameLocator('#sandboxFrame').frameLocator('#userHtmlFrame');
    await f.getByTestId('login-email').waitFor({ timeout: 45000 }); // app termuat → google.script.run siap
    const res = await f.locator('body').evaluate(
      (body, { fn, pw }) =>
        new Promise((resolve, reject) => {
          google.script.run
            .withSuccessHandler(resolve)
            .withFailureHandler((e) => reject(new Error(String((e && e.message) || e))))
            [fn](pw);
        }),
      { fn: FN, pw: ADMIN_PW }
    );
    console.log(JSON.stringify(res, null, 1));
    process.exitCode = res && res.ok ? 0 : 1;
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error('GAGAL:', e.message);
  process.exit(1);
});
