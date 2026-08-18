/**
 * fasih-import-all — setelah scripts/fasih-sqllab-export.js selesai
 * mengumpulkan CSV di folder export/ (84 file, pola <stagingKey>_<nn>.csv),
 * jalankan scripts/fasih-import-csv.js untuk SEMUA file itu secara berurutan.
 *
 * AMAN diotomasi penuh (tidak menyentuh FASIH sama sekali, hanya memanggil
 * google.script.run ke aplikasi sendiri) — beda dari fasih-sqllab-export.js
 * yang WAJIB berjeda karena menyentuh server FASIH.
 *
 * Default: --no-import per file (hanya menumpuk ke staging), lalu SATU kali
 * import-fasih di paling akhir setelah semua staging terisi — lebih efisien
 * daripada memicu recompute anomali 84 kali berturut-turut.
 *
 * Pakai:
 *   node scripts/fasih-import-all.js
 *   node scripts/fasih-import-all.js --dir=export/coba1     (folder custom)
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const args = process.argv.slice(2);
const dirArg = args.find((a) => a.startsWith('--dir='));
const exportDir = path.resolve(__dirname, '..', dirArg ? dirArg.replace('--dir=', '') : 'export');

const STAGING_KEYS = ['keluarga', 'usaha', 'rosterAk', 'rosterMeteran'];

function findFilesFor(key) {
  return fs.readdirSync(exportDir)
    .filter((f) => f.startsWith(`${key}_`) && f.endsWith('.csv'))
    .sort()
    .map((f) => path.join(exportDir, f));
}

(async () => {
  let totalFiles = 0;
  for (const key of STAGING_KEYS) {
    const files = findFilesFor(key);
    if (!files.length) {
      console.log(`(${key}) tidak ada file ditemukan di ${exportDir}, dilewati`);
      continue;
    }
    console.log(`\n=== ${key}: ${files.length} file ===`);
    for (const file of files) {
      console.log(`  append ${path.basename(file)} ...`);
      execFileSync('node', ['scripts/fasih-import-csv.js', key, file, '--no-import'], {
        cwd: path.resolve(__dirname, '..'),
        stdio: 'inherit'
      });
      totalFiles++;
    }
  }

  if (!totalFiles) {
    console.log('\nTidak ada file CSV ditemukan sama sekali. Cek folder:', exportDir);
    return;
  }

  console.log(`\n=== Semua ${totalFiles} file sudah masuk staging. Menjalankan import-fasih final... ===`);
  execFileSync('node', ['scripts/sheet-admin.js', 'import-fasih'], {
    cwd: path.resolve(__dirname, '..'),
    stdio: 'inherit'
  });
})().catch((e) => {
  console.error('GAGAL:', e.message);
  process.exit(1);
});
