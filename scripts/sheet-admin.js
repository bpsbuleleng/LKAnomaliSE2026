/**
 * sheet-admin — jalankan fungsi maintenance server dari terminal lewat
 * Playwright + google.script.run (transport yang sama dengan aplikasi).
 *
 * Pakai:  node scripts/sheet-admin.js status          → adminSheetStatus
 *         node scripts/sheet-admin.js setup           → adminSetupSheets (buat tab + seed yang kosong)
 *         node scripts/sheet-admin.js backup-records  → salin tab Records ke tab backup ber-timestamp
 *         node scripts/sheet-admin.js reset-records   → kosongkan tab Records (testing! backup dulu)
 *         node scripts/sheet-admin.js reset-config    → Questions/Rules kembali ke baseline (testing!)
 *         node scripts/sheet-admin.js reconcile-rules → U5/K6/K1 disamakan dgn SQL FASIH
 *         node scripts/sheet-admin.js import-fasih    → impor tab staging FASIH → Records
 *         node scripts/sheet-admin.js sheet-sizes     → ukuran grid tiap tab (diagnostik limit sel)
 *         node scripts/sheet-admin.js shrink-fasih <usaha|keluarga|rosterAk|rosterMeteran>
 *                                                     → pangkas kapasitas grid tab staging (TANPA hapus data)
 *         node scripts/sheet-admin.js fasih-dry-run   → hitung jumlah record hasil import TANPA menulis (read-only)
 *         node scripts/sheet-admin.js sample-records <startRow> <count>
 *                                                     → baca N baris tab Records dari posisi tertentu (diagnostik ringan)
 *         node scripts/sheet-admin.js anomali-summary → ringkasan anomaliPerRule dari data Records yang SUDAH ada (tanpa re-run RuleEvaluator)
 * Env:    EXEC_URL (default deployment tetap), ADMIN_PW (default pilot).
 */
const { chromium } = require('@playwright/test');

const EXEC_URL = process.env.EXEC_URL ||
  'https://script.google.com/macros/s/AKfycbwJ4spiFeSAymytUTDFl4bfrMcpBBD3NsE5d0k2GCM1_U50slKfyHaC3HhMRipnw7PU/exec';
const ADMIN_PW = process.env.ADMIN_PW || 'admin5108';

const CMD = process.argv[2] || 'status';
const EXTRA_ARG = process.argv[3]; // stagingKey (shrink-fasih) atau startRow (sample-records)
const EXTRA_ARG2 = process.argv[4]; // count (sample-records)

const FN = {
  status: 'adminSheetStatus',
  setup: 'adminSetupSheets',
  'backup-records': 'adminBackupRecords',
  'reset-records': 'resetRecords',
  'reset-config': 'resetConfig',
  'reconcile-rules': 'adminReconcileRules',
  'setup-fasih': 'adminSetupFasihStaging',
  'import-fasih': 'importFasih',
  'sheet-sizes': 'adminSheetSizes',
  'shrink-fasih': 'adminShrinkFasihStagingTab',
  'fasih-dry-run': 'adminFasihDryRun',
  'sample-records': 'adminSampleRecords',
  'anomali-summary': 'adminRecordsAnomaliSummary'
}[CMD];

if (!FN) {
  console.error('Perintah tidak dikenal. Pakai: status | setup | backup-records | reset-records | reset-config | reconcile-rules | setup-fasih | import-fasih | sheet-sizes | shrink-fasih | fasih-dry-run | sample-records | anomali-summary');
  process.exit(2);
}
if (CMD === 'shrink-fasih' && !EXTRA_ARG) {
  console.error('shrink-fasih butuh stagingKey: usaha | keluarga | rosterAk | rosterMeteran');
  process.exit(2);
}
if (CMD === 'sample-records' && (!EXTRA_ARG || !EXTRA_ARG2)) {
  console.error('sample-records butuh <startRow> <count>, mis: sample-records 1 5');
  process.exit(2);
}

(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(EXEC_URL);
    const f = page.frameLocator('#sandboxFrame').frameLocator('#userHtmlFrame');
    // Sejak dashboard visualisasi jadi halaman awal, view login tersembunyi
    // di balik tombol "Masuk" (id=goto-app-btn) — klik dulu sebelum menunggu form.
    await f.locator('#goto-app-btn').waitFor({ timeout: 45000 });
    await f.locator('#goto-app-btn').click();
    await f.getByTestId('login-email').waitFor({ timeout: 45000 }); // app termuat → google.script.run siap
    const res = await f.locator('body').evaluate(
      (body, { fn, pw, extra, extra2 }) =>
        new Promise((resolve, reject) => {
          const runner = google.script.run
            .withSuccessHandler(resolve)
            .withFailureHandler((e) => reject(new Error(String((e && e.message) || e))));
          if (extra2 !== null) runner[fn](pw, Number(extra), Number(extra2));
          else if (extra) runner[fn](pw, extra);
          else runner[fn](pw);
        }),
      { fn: FN, pw: ADMIN_PW, extra: EXTRA_ARG || null, extra2: EXTRA_ARG2 || null }
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
