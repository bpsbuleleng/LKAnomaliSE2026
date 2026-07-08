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

// Baca semua draft dari IndexedDB DI DALAM frame aplikasi.
async function readDraftsFromIdb(f) {
  return f.locator('body').evaluate(() =>
    new Promise((resolve, reject) => {
      const rq = indexedDB.open('lk_anomali', 1);
      rq.onsuccess = () => {
        const db = rq.result;
        const g = db.transaction('drafts', 'readonly').objectStore('drafts').getAll();
        g.onsuccess = () => { db.close(); resolve(g.result); };
        g.onerror = () => { db.close(); reject(g.error); };
      };
      rq.onerror = () => reject(rq.error);
    })
  );
}

const syncIndicator = (f) => f.getByTestId('sync-indicator');

test('kuesioner dinamis: pertanyaan aktif sesuai jenis, soft-deleted tidak tampil, roster ada', async ({ page }) => {
  const f = await login(page, KADEK);
  await resetRecords(f);
  await newRecord(f, 'keluarga');

  // Field keluarga tampil, field usaha TIDAK
  await expect(f.getByTestId('q-b1r13_1')).toBeVisible();
  await expect(f.getByTestId('q-b4r3a')).toBeVisible();
  await expect(f.getByTestId('q-r27c')).toHaveCount(0);
  // Soft-deleted (active=FALSE) TIDAK dirender
  await expect(f.getByTestId('q-catatan_lama')).toHaveCount(0);
  // Roster anggota keluarga tersedia + badge jumlah baris mulai dari 0
  await expect(f.getByTestId('roster-add-anggota_keluarga')).toBeVisible();
  await expect(f.getByTestId('roster-count-anggota_keluarga')).toHaveText('0 baris');

  // Bandingkan: kuesioner usaha berisi field usaha
  await f.getByTestId('record-back').click();
  await newRecord(f, 'usaha');
  await expect(f.getByTestId('q-nama_usaha')).toBeVisible();
  await expect(f.getByTestId('q-b1r13_1')).toHaveCount(0);
  await expect(f.getByTestId('roster-add-anggota_keluarga')).toHaveCount(0);
});

test('alur normal: isi (flat + roster) → auto-sync → simpan → buka lagi ter-prefill', async ({ page }) => {
  const f = await login(page, KADEK);
  await resetRecords(f);
  await newRecord(f, 'keluarga');

  await pickWilayah(f);
  await f.getByTestId('q-b1r13_1').fill('45');
  await f.getByTestId('q-b4r3a-opt-1').check(); // kategorik = radio sejak revisi UX
  await f.getByTestId('q-b4r5').fill('120');

  // Roster: tambah 2 anggota, hapus 1
  await f.getByTestId('roster-add-anggota_keluarga').click();
  await f.getByTestId('q-b1r6_n-0').fill('KETUT ADI');
  await f.getByTestId('q-b1r8_n-0-opt-1').check();
  await f.getByTestId('roster-add-anggota_keluarga').click();
  await f.getByTestId('q-b1r6_n-1').fill('SALAH KETIK');
  await f.getByTestId('roster-remove-anggota_keluarga-1').click();
  await expect(f.getByTestId('roster-row-anggota_keluarga-1')).toHaveCount(0);
  // Badge jumlah baris mengikuti add/remove (variabel jumlah_<roster> live)
  await expect(f.getByTestId('roster-count-anggota_keluarga')).toHaveText('1 baris');

  // Auto-sync jalan tanpa tombol manual
  await expect(syncIndicator(f)).toHaveAttribute('data-state', 'synced', { timeout: 30000 });

  // Simpan manual → dashboard: judul kartu = nama anggota pertama roster
  await f.getByTestId('record-save').click();
  await expect(f.getByTestId('dashboard-view')).toBeVisible();
  await expect(f.getByTestId('record-card')).toHaveCount(1);
  await expect(f.getByTestId('record-card-title')).toHaveText('KETUT ADI');

  // Buka lagi → nilai ter-prefill (radio tercentang, roster utuh)
  await f.getByTestId('record-card').click();
  await expect(f.getByTestId('record-view')).toBeVisible();
  await expect(f.getByTestId('q-b1r13_1')).toHaveValue('45');
  await expect(f.getByTestId('q-b4r3a-opt-1')).toBeChecked();
  await expect(f.getByTestId('q-b4r5')).toHaveValue('120');
  await expect(f.getByTestId('q-b1r6_n-0')).toHaveValue('KETUT ADI');
  await expect(f.getByTestId('roster-row-anggota_keluarga-1')).toHaveCount(0);
  await expect(f.getByTestId('roster-count-anggota_keluarga')).toHaveText('1 baris');
});

test('hapus record: konfirmasi → hilang dari dashboard, dari server, dan dari IndexedDB', async ({ page }) => {
  const f = await login(page, KADEK);
  await resetRecords(f);
  await newRecord(f, 'keluarga');
  await pickWilayah(f);
  await f.getByTestId('q-b1r13_1').fill('33');
  await expect(syncIndicator(f)).toHaveAttribute('data-state', 'synced', { timeout: 30000 });
  await f.getByTestId('record-save').click();
  await expect(f.getByTestId('record-card')).toHaveCount(1);

  // Buka → hapus dengan konfirmasi
  await f.getByTestId('record-card').click();
  await expect(f.getByTestId('record-delete')).toBeVisible();
  await f.getByTestId('record-delete').click();
  await expect(f.getByTestId('delete-dialog')).toBeVisible();
  await f.getByTestId('delete-confirm').click();
  await expect(f.getByTestId('dashboard-view')).toBeVisible();
  await expect(f.getByTestId('record-card')).toHaveCount(0);
  await expect(f.getByTestId('record-empty')).toBeVisible();

  // Muat ulang halaman (state client bersih, sesi PML tetap awet lewat
  // localStorage → dashboard langsung tanpa login ulang): server & IndexedDB
  // dua-duanya kosong → dashboard tetap kosong, tidak ada "record hantu".
  await page.goto(EXEC_URL);
  const f2 = app(page);
  await expect(f2.getByTestId('dashboard-view')).toBeVisible();
  await expect(f2.getByTestId('record-empty')).toBeVisible();
  await expect(f2.getByTestId('record-card')).toHaveCount(0);
});

test('OFFLINE: data selamat di IndexedDB + indikator belum-sync → online → auto-sync ke server', async ({ page, context }) => {
  const f = await login(page, KADEK);
  await resetRecords(f);
  await newRecord(f, 'keluarga');
  await pickWilayah(f);
  await f.getByTestId('q-b1r13_1').fill('30');
  await expect(syncIndicator(f)).toHaveAttribute('data-state', 'synced', { timeout: 30000 });

  // ---- matikan network di tengah pengisian ----
  await context.setOffline(true);
  await f.getByTestId('q-b4r5').fill('999');
  await f.getByTestId('q-b4r16a').fill('750000');

  // Indikator belum-sync muncul
  await expect(syncIndicator(f)).toHaveAttribute('data-state', 'dirty', { timeout: 15000 });

  // Data TIDAK hilang: sudah tertulis di IndexedDB
  await expect
    .poll(async () => {
      const drafts = await readDraftsFromIdb(f);
      const d = drafts.find((x) => x.answers && x.answers.b4r5 === 999);
      return d ? d.answers.b4r16a : null;
    }, { timeout: 10000 })
    .toBe(750000);

  // ---- nyalakan network → sync otomatis (event online / retry 5 detik) ----
  await context.setOffline(false);
  await expect(syncIndicator(f)).toHaveAttribute('data-state', 'synced', { timeout: 30000 });

  // Verifikasi data benar-benar sampai SERVER: muat ulang halaman (IndexedDB
  // bersih tidak dipakai karena draft sudah clean → dashboard pakai server;
  // sesi PML tetap awet lewat localStorage → tidak perlu login lagi), buka
  // record → nilai dari server.
  await page.goto(EXEC_URL);
  const f2 = app(page);
  await expect(f2.getByTestId('dashboard-view')).toBeVisible();
  await expect(f2.getByTestId('record-card')).toHaveCount(1);
  await f2.getByTestId('record-card').click();
  await expect(f2.getByTestId('q-b4r5')).toHaveValue('999');
  // b4r16a = currency: prefill dirender terformat gaya id-ID ("750.000").
  await expect(f2.getByTestId('q-b4r16a')).toHaveValue('750.000');
});

test('dialog keluar: tanpa perubahan langsung keluar; Batal bertahan; Buang membuang', async ({ page, context }) => {
  const f = await login(page, KADEK);
  await resetRecords(f);

  // Tanpa perubahan → tidak ada dialog
  await newRecord(f, 'keluarga');
  await f.getByTestId('record-back').click();
  await expect(f.getByTestId('dashboard-view')).toBeVisible();
  await expect(f.getByTestId('exit-dialog')).toBeHidden();

  // Offline supaya perubahan pasti belum ke-sync
  await context.setOffline(true);
  await newRecord(f, 'keluarga');
  await f.getByTestId('q-b1r13_1').fill('50');
  await f.getByTestId('record-back').click();
  await expect(f.getByTestId('exit-dialog')).toBeVisible();

  // Batal → tetap di kuesioner, nilai masih ada
  await f.getByTestId('exit-cancel').click();
  await expect(f.getByTestId('exit-dialog')).toBeHidden();
  await expect(f.getByTestId('q-b1r13_1')).toHaveValue('50');

  // Buang → ke dashboard, draft lokal dibuang (offline: tidak ada dari server juga)
  await f.getByTestId('record-back').click();
  await f.getByTestId('exit-discard').click();
  await expect(f.getByTestId('dashboard-view')).toBeVisible();
  await expect(f.getByTestId('record-card')).toHaveCount(0);
  await expect(f.getByTestId('record-empty')).toBeVisible();

  await context.setOffline(false);
});

test('dialog keluar saat offline: Simpan sementara → draft "belum sync" di dashboard → dibuka lagi auto-sync', async ({ page, context }) => {
  const f = await login(page, KADEK);
  await resetRecords(f);

  // Tunggu prefetch referensi (questions + wilayah) selesai sebelum offline —
  // inilah yang membuat kuesioner BARU bisa dibuka tanpa koneksi.
  await expect
    .poll(() => f.locator('body').evaluate(() =>
      !!(window.App && App.state.questionCache.keluarga && App.state.wilayahRows)
    ), { timeout: 15000 })
    .toBe(true);

  await context.setOffline(true);
  await newRecord(f, 'keluarga');
  await f.getByTestId('q-b1r13_1').fill('60');
  await f.getByTestId('record-back').click();
  await expect(f.getByTestId('exit-dialog')).toBeVisible();
  await f.getByTestId('exit-save').click();

  // Dashboard (offline): draft lokal tetap tampil, ditandai belum sync
  await expect(f.getByTestId('dashboard-view')).toBeVisible();
  await expect(f.getByTestId('record-card')).toHaveCount(1);
  await expect(f.getByTestId('unsynced-badge')).toBeVisible();

  // Buka lagi saat masih offline → nilai selamat, lalu online → auto-sync
  await f.getByTestId('record-card').click();
  await expect(f.getByTestId('q-b1r13_1')).toHaveValue('60');
  await context.setOffline(false);
  await expect(syncIndicator(f)).toHaveAttribute('data-state', 'synced', { timeout: 30000 });
});

// Helper: pilih wilayah lengkap (riil: Gerokgak/Pejarakan/0001/01 — milik KADEK).
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
