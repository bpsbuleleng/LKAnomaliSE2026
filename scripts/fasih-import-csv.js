/**
 * fasih-import-csv — kirim SATU file CSV (hasil download manual dari SQL Lab)
 * langsung ke tab staging FASIH lewat google.script.run (Playwright, transport
 * sama dengan sheet-admin.js), TANPA paste manual di UI Google Sheets.
 *
 * Kenapa TIDAK menyentuh SQL Lab sama sekali: server FASIH memblokir request
 * otomatis beruntun ("Bot Detected") — jalankan query & download CSV WAJIB
 * manual di browser (lihat TUTORIAL_IMPOR_FASIH.md). Script ini hanya
 * mengotomasi langkah SESUDAH CSV ada di komputer: paste ke staging + impor.
 *
 * Pakai:
 *   node scripts/fasih-import-csv.js <stagingKey> <path/ke/file.csv> [--clear] [--no-import]
 *
 *   <stagingKey>  usaha | keluarga | rosterAk | rosterMeteran
 *   --clear       kosongkan tab staging itu SEBELUM menulis baris CSV ini
 *                 (pakai kalau file CSV ini menggantikan grup sebelumnya,
 *                 bukan menumpuk di atasnya)
 *   --no-import   hanya tulis ke staging, JANGAN otomatis panggil import-fasih
 *                 di akhir (pakai kalau mau isi ke-4 tab dulu baru impor sekali)
 *
 * Urutan kolom CSV HARUS sama dengan urutan alias SELECT di query ekspor
 * (sudah didesain identik dengan header tab staging, FasihImport.STAGING) —
 * script ini memetakan berdasar NAMA header CSV, bukan asumsi posisi, jadi
 * aman walau urutan kolom CSV sedikit beda asal namanya cocok.
 *
 * Env: EXEC_URL (default deployment tetap), ADMIN_PW (default pilot).
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');
const FasihImport = require('../src/FasihImport.js');

const EXEC_URL = process.env.EXEC_URL ||
  'https://script.google.com/macros/s/AKfycbwJ4spiFeSAymytUTDFl4bfrMcpBBD3NsE5d0k2GCM1_U50slKfyHaC3HhMRipnw7PU/exec';
const ADMIN_PW = process.env.ADMIN_PW || 'admin5108';

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const positional = args.filter((a) => !a.startsWith('--'));
const [stagingKey, csvPath] = positional;

if (!stagingKey || !csvPath || !FasihImport.STAGING[stagingKey]) {
  console.error('Pakai: node scripts/fasih-import-csv.js <usaha|keluarga|rosterAk|rosterMeteran> <file.csv> [--clear] [--no-import]');
  process.exit(2);
}

// Parser CSV kecil (RFC4180-ish): koma pemisah, "..." quoting, "" = escape kutip.
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

(async () => {
  const raw = fs.readFileSync(path.resolve(csvPath), 'utf8').replace(/^﻿/, '');
  const table = parseCsv(raw);
  if (!table.length) { console.error('CSV kosong:', csvPath); process.exit(2); }
  const csvHeaders = table[0].map((h) => h.trim());
  const targetHeaders = FasihImport.STAGING[stagingKey].headers;
  const missing = targetHeaders.filter((h) => !csvHeaders.includes(h));
  if (missing.length) {
    console.error('CSV tidak punya kolom:', missing.join(', '));
    console.error('Header CSV:', csvHeaders.join(', '));
    process.exit(2);
  }
  const colIdx = targetHeaders.map((h) => csvHeaders.indexOf(h));
  const rowsArrays = table.slice(1).map((r) => colIdx.map((i) => (r[i] === undefined ? '' : r[i])));

  console.log(`${stagingKey}: ${rowsArrays.length} baris dari ${csvPath}`);

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(EXEC_URL);
    const f = page.frameLocator('#sandboxFrame').frameLocator('#userHtmlFrame');
    await f.locator('#goto-app-btn').waitFor({ timeout: 45000 });
    await f.locator('#goto-app-btn').click();
    await f.getByTestId('login-email').waitFor({ timeout: 45000 });

    const callServer = (fn, ...callArgs) =>
      f.locator('body').evaluate(
        (body, { fn, callArgs }) =>
          new Promise((resolve, reject) => {
            google.script.run
              .withSuccessHandler(resolve)
              .withFailureHandler((e) => reject(new Error(String((e && e.message) || e))))
              [fn](...callArgs);
          }),
        { fn, callArgs }
      );

    if (flags.has('--clear')) {
      const cleared = await callServer('adminClearFasihStagingTab', ADMIN_PW, stagingKey);
      console.log('clear:', JSON.stringify(cleared));
      if (!cleared.ok) { process.exitCode = 1; return; }
    }

    // Kirim per-batch (Apps Script/URL payload ada batas ukuran) — 2000 baris/batch aman.
    const BATCH = 2000;
    let written = 0;
    for (let i = 0; i < rowsArrays.length; i += BATCH) {
      const batch = rowsArrays.slice(i, i + BATCH);
      const res = await callServer('adminAppendFasihStagingRows', ADMIN_PW, stagingKey, batch);
      if (!res.ok) { console.error('GAGAL append batch:', JSON.stringify(res)); process.exitCode = 1; return; }
      written += res.written;
      console.log(`  batch ${i}-${i + batch.length}: ok (${res.written} baris)`);
    }
    console.log(`Total ditulis ke tab staging "${stagingKey}": ${written} baris`);

    if (!flags.has('--no-import')) {
      const imported = await callServer('importFasih', ADMIN_PW);
      console.log('import-fasih:', JSON.stringify(imported, null, 1));
      process.exitCode = imported && imported.ok ? 0 : 1;
    }
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error('GAGAL:', e.message);
  process.exit(1);
});
