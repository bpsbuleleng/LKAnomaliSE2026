/**
 * fasih-sqllab-export — jalankan 84 query (4 template × 21 grup wilayah) di
 * Superset SQL Lab FASIH secara berurutan, tiap query diberi jeda acak
 * 30-60 detik (hindari "Bot Detected", TERBUKTI terjadi di proyek ini kalau
 * request dikirim beruntun cepat). Browser dibuka baru oleh Playwright —
 * KAMU login manual & aktifkan VPN sendiri saat script berhenti menunggu di
 * awal (login/VPN TIDAK disentuh/diketahui script ini).
 *
 * KONFIGURASI BROWSER meniru proyek referensi `scrape_fasih` (Playwright
 * Python, target `fasih-sm.bps.go.id`, TERBUKTI lolos deteksi bot BPS):
 * Chromium BAWAAN Playwright biasa (bukan Chrome asli via channel:'chrome' —
 * dicoba sebelumnya, TETAP terdeteksi, jadi dibuang), headed, `slowMo: 50`
 * (jeda 50ms tiap aksi Playwright — pola satu-satunya yang terbukti berhasil
 * di proyek referensi itu, TANPA override fingerprint/navigator.webdriver
 * apa pun). Catatan: proyek referensi menyasar `fasih-sm.bps.go.id` (aplikasi
 * beda dari SQL Lab yang di sini/`fasih-dashboard.bps.go.id`), jadi ini
 * dugaan terbaik berdasarkan pola yang terbukti jalan di domain BPS lain,
 * BUKAN jaminan — kalau tetap terdeteksi di SQL Lab, kembali ke jalur manual
 * (sql/checklist_ekspor.md) atau Claude Cowork (sql/PROMPT_COWORK_EKSPOR.md).
 *
 * Progres disimpan ke fasih-sqllab-export.progress.json (folder yang sama)
 * setiap job selesai — kalau proses terhenti (ditutup, error, kamu Ctrl+C),
 * jalankan lagi perintah yang SAMA dan otomatis lanjut dari job yang belum
 * selesai, TIDAK mengulang dari awal.
 *
 * SELECTOR SQL Lab: nilai di bawah (SELECTORS) ditulis mengikuti pola umum
 * Superset open-source. Instalasi BPS mungkin beda — kalau script berhenti
 * dengan pesan "Elemen tidak ditemukan: ...", buka SQL Lab manual, klik-kanan
 * elemen yang dimaksud → Inspect, cari selector yang cocok, sesuaikan konstanta
 * di bawah. Jangan tebak-tebak jika tidak yakin — cek langsung di browser.
 *
 * Pakai:
 *   node scripts/fasih-sqllab-export.js
 *   node scripts/fasih-sqllab-export.js --only=keluarga_01,usaha_03   (subset, untuk uji coba)
 *   node scripts/fasih-sqllab-export.js --reset                       (buang progres, mulai dari job 1 lagi)
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');
const { buildJobs } = require('./fasih-sqllab-export.data.js');
const readline = require('readline');

// Halaman login FASIH — GANTI kalau URL login sesungguhnya berbeda (belum
// dites; sesuaikan setelah dicek manual di browser).
const LOGIN_URL = 'https://fasih-dashboard.bps.go.id/login/';
const SQLLAB_URL = 'https://fasih-dashboard.bps.go.id/superset/sqllab/';
const DOWNLOAD_DIR = path.resolve(__dirname, '..', 'export');
const PROGRESS_FILE = path.resolve(__dirname, 'fasih-sqllab-export.progress.json');

const DELAY_MIN_MS = 30000;
const DELAY_MAX_MS = 60000;
const SLOW_MO_MS = 50; // jeda antar-aksi Playwright — pola dari scrape_fasih.py

// ==== SELECTOR SQL Lab — SESUAIKAN kalau berbeda dari instalasi BPS ====
const SELECTORS = {
  // Editor kode SQL (Superset pakai Ace/CodeMirror editor) — biasanya di
  // dalam sebuah div dengan class 'ace_editor' atau textarea tersembunyi.
  sqlEditor: '.ace_editor',
  // Tombol "Run" / "Run Query".
  runButton: 'button:has-text("Run")',
  // Area hasil query (tabel hasil) — dipakai untuk mendeteksi query selesai.
  resultsPane: '[data-test="query-results"], .ResultSetControls, .ResultSet',
  // Tombol/menu "Download to CSV" di panel hasil.
  downloadCsvButton: 'button:has-text("Download to CSV"), [data-test="export-csv-button"]',
  // Teks yang muncul kalau ada error dari server (termasuk Bot Detected).
  errorMessage: '[data-test="alert-danger"], .alert-danger, [role="alert"]'
};
// =========================================================================

function loadProgress() {
  if (fs.existsSync(PROGRESS_FILE)) {
    return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
  }
  return { done: [] };
}

function saveProgress(progress) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 1));
}

function waitForEnter(promptText) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(promptText, () => { rl.close(); resolve(); });
  });
}

function randomDelayMs() {
  return DELAY_MIN_MS + Math.random() * (DELAY_MAX_MS - DELAY_MIN_MS);
}

async function sleep(ms) {
  console.log(`  jeda ${Math.round(ms / 1000)} detik sebelum job berikutnya...`);
  await new Promise((r) => setTimeout(r, ms));
}

async function runJob(page, job) {
  console.log(`\n=== Job ${job.id} (staging: ${job.stagingKey}) ===`);

  // Pastikan tab SQL Lab / editor baru siap. Kalau instalasi BPS menampilkan
  // tab query permanen, `page.reload()` di sini bisa diganti klik "New Tab".
  await page.locator(SELECTORS.sqlEditor).first().waitFor({ timeout: 30000 });
  await page.locator(SELECTORS.sqlEditor).first().click();

  // Ace editor tidak menerima .fill() biasa — pilih semua isi lama & ganti.
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Delete');
  await page.keyboard.insertText(job.sql);

  await page.locator(SELECTORS.runButton).first().click();

  // Tunggu salah satu dari: hasil muncul, atau pesan error muncul.
  const resultOrError = await Promise.race([
    page.locator(SELECTORS.resultsPane).first().waitFor({ timeout: 120000 }).then(() => 'result'),
    page.locator(SELECTORS.errorMessage).first().waitFor({ timeout: 120000 }).then(() => 'error')
  ]).catch(() => 'timeout');

  if (resultOrError === 'timeout') {
    throw new Error(`Job ${job.id}: timeout menunggu hasil/error (120 detik) — cek manual di browser.`);
  }

  if (resultOrError === 'error') {
    const errText = await page.locator(SELECTORS.errorMessage).first().innerText().catch(() => '(gagal baca pesan error)');
    if (/bot\s*detected/i.test(errText)) {
      throw new Error(`BOT_DETECTED pada job ${job.id}: "${errText}" — HENTIKAN, tunggu beberapa saat sebelum lanjut manual.`);
    }
    throw new Error(`Job ${job.id} error dari server: "${errText}"`);
  }

  // Download CSV.
  const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
  await page.locator(SELECTORS.downloadCsvButton).first().click();
  const download = await downloadPromise;
  const destPath = path.join(DOWNLOAD_DIR, `${job.id}.csv`);
  await download.saveAs(destPath);
  console.log(`  CSV tersimpan: ${destPath}`);

  return destPath;
}

(async () => {
  const args = process.argv.slice(2);
  const onlyArg = args.find((a) => a.startsWith('--only='));
  const onlyIds = onlyArg ? onlyArg.replace('--only=', '').split(',') : null;
  const reset = args.includes('--reset');

  if (!fs.existsSync(DOWNLOAD_DIR)) fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });

  let progress = reset ? { done: [] } : loadProgress();
  const allJobs = buildJobs();
  const jobs = onlyIds ? allJobs.filter((j) => onlyIds.includes(j.id)) : allJobs;
  const remaining = jobs.filter((j) => !progress.done.includes(j.id));

  console.log(`Total job: ${jobs.length}, sudah selesai sebelumnya: ${jobs.length - remaining.length}, sisa: ${remaining.length}`);
  if (!remaining.length) {
    console.log('Semua job (dalam cakupan ini) sudah selesai. Pakai --reset kalau mau ulang dari awal.');
    return;
  }

  const browser = await chromium.launch({ headless: false, slowMo: SLOW_MO_MS });
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();

  console.log(`\nMembuka halaman login: ${LOGIN_URL} ...`);
  await page.goto(LOGIN_URL);

  await waitForEnter(
    '\n>>> Silakan LOGIN manual & aktifkan VPN di jendela browser yang baru terbuka.\n' +
    '>>> Setelah login berhasil, navigasikan sendiri ke SQL Lab (menu di dalam\n' +
    '>>> aplikasi, atau buka URL: ' + SQLLAB_URL + ')\n' +
    '>>> Pastikan sudah berada di halaman SQL Lab dengan editor query siap.\n' +
    '>>> Tekan ENTER di terminal ini kalau sudah siap untuk mulai otomatis...\n'
  );

  for (const job of remaining) {
    try {
      await runJob(page, job);
      progress.done.push(job.id);
      saveProgress(progress);
    } catch (e) {
      console.error(`\nGAGAL di job ${job.id}: ${e.message}`);
      console.error('Progres tersimpan sampai job SEBELUM ini. Perbaiki masalahnya, lalu jalankan ulang perintah yang sama untuk lanjut.');
      await browser.close();
      process.exit(1);
    }

    const isLast = job === remaining[remaining.length - 1];
    if (!isLast) await sleep(randomDelayMs());
  }

  console.log(`\nSelesai. ${remaining.length} job baru diproses. Total selesai: ${progress.done.length}/${allJobs.length}.`);
  console.log(`File CSV ada di: ${DOWNLOAD_DIR}`);
  await browser.close();
})().catch((e) => {
  console.error('GAGAL:', e.message);
  process.exit(1);
});
