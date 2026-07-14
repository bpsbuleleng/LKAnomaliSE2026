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
  await direct(f, 'resetConfig', [ADMIN_PW]);
  await direct(f, 'resetRecords', [ADMIN_PW]);
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
  // Halaman awal = dashboard visualisasi; form login ada di balik tombolnya.
  await f.getByTestId('goto-app-btn').click();
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
    await direct(f, 'resetConfig', [ADMIN_PW]);
    await direct(f, 'resetRecords', [ADMIN_PW]);
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

  // -- Reorder: masuk mode Ubah Urutan, geser ↑ (staging), Simpan Urutan --
  await fa.getByTestId('aq-reorder').click();
  await expect(fa.getByTestId('aq-reorder-bar')).toBeVisible();
  await fa.getByTestId('aq-up-warna_pintu').click(); // menata staging, belum ke server
  await fa.getByTestId('aq-reorder-save').click();
  await expect(fa.getByTestId('aq-reorder-bar')).toBeHidden(); // kembali ke mode normal
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
  await fp.getByTestId('q-b4r3a-opt-1').check();
  await fp.getByTestId('q-b4r5').fill('80');
  await fp.getByTestId('q-warna_pintu').fill('biru');
  await expect(fp.getByTestId('sync-indicator')).toHaveAttribute('data-state', 'synced', { timeout: 30000 });
  await fp.getByTestId('record-save').click();
  await expect(fp.getByTestId('dashboard-view')).toBeVisible();

  // -- Admin menonaktifkan (soft-delete, BUKAN hapus) --
  await fa.getByTestId('aq-toggle-warna_pintu').click();
  await expect(fa.getByTestId('aq-row-warna_pintu')).toContainText('NONAKTIF');

  // -- Kuesioner BARU (sesi segar): field hilang --
  // Sesi PML tetap awet lewat localStorage → reload tidak perlu login ulang.
  await pml.goto(EXEC_URL);
  const fp2 = app(pml);
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

  // -- Susun rule Mode Sederhana (1 kondisi): b4r5 > 500 --
  await fa.getByTestId('ar-add').click();
  await fa.getByTestId('ar-message').fill('UJI-E2E: luas bangunan tidak wajar (> 500 m²)');
  await fa.getByTestId('ar-cond-field-0').selectOption('b4r5');
  await fa.getByTestId('ar-cond-op-0').selectOption('>');
  await fa.getByTestId('ar-cond-value-0').fill('500');

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
  await fp.getByTestId('q-b4r3a-opt-1').check();
  await fp.getByTestId('q-b4r5').fill('600');
  await fp.getByTestId('record-submit').click();
  const dialogItems = fp.getByTestId('anomaly-dialog').getByTestId('anomaly-item');
  await expect(fp.getByTestId('anomaly-dialog')).toBeVisible();
  await expect(dialogItems).toHaveCount(1);
  await expect(dialogItems).toContainText('UJI-E2E: luas bangunan tidak wajar');

  await pml.close();
});

test('rule Mode Sederhana MULTI-KONDISI (DAN, 2 field): preview benar, tersimpan sbg all[], round-trip buka lagi tetap sederhana', async ({ page }) => {
  const fa = await adminLogin(page);
  await resetAll(fa);
  await fa.getByTestId('jenis-tab-keluarga').click();
  await expect(fa.getByTestId('ar-row-K1')).toBeVisible();

  await fa.getByTestId('ar-add').click();
  await fa.getByTestId('ar-message').fill('UJI-E2E multi: luas > 500 DAN umur KK < 50');
  // Kondisi 1: b4r5 > 500
  await fa.getByTestId('ar-cond-field-0').selectOption('b4r5');
  await fa.getByTestId('ar-cond-op-0').selectOption('>');
  await fa.getByTestId('ar-cond-value-0').fill('500');
  // Tambah kondisi 2: b1r13_1 < 50 → kombinator DAN/ATAU muncul
  await fa.getByTestId('ar-cond-add').click();
  await expect(fa.getByTestId('ar-combinator')).toBeVisible();
  await fa.getByTestId('ar-cond-field-1').selectOption('b1r13_1');
  await fa.getByTestId('ar-cond-op-1').selectOption('<');
  await fa.getByTestId('ar-cond-value-1').fill('50');

  // Preview (evaluator server yang sama): DAN → hanya terpicu bila keduanya benar.
  await fa.getByTestId('ar-preview-answers').fill('{"b4r5": 600, "b1r13_1": 45}');
  await fa.getByTestId('ar-preview-run').click();
  await expect(fa.getByTestId('ar-preview-result')).toContainText('TERPICU');
  await fa.getByTestId('ar-preview-answers').fill('{"b4r5": 600, "b1r13_1": 70}');
  await fa.getByTestId('ar-preview-run').click();
  await expect(fa.getByTestId('ar-preview-result')).toContainText('TIDAK terpicu');

  // Simpan → K100, lalu buka lagi: builder dengan 2 kondisi utuh.
  await fa.getByTestId('ar-save').click();
  await expect(fa.getByTestId('ar-row-K100')).toBeVisible();
  await fa.getByTestId('ar-edit-K100').click();
  await expect(fa.getByTestId('ar-cond-field-0')).toHaveValue('b4r5');
  await expect(fa.getByTestId('ar-cond-field-1')).toHaveValue('b1r13_1');
});

test('rule MULTI-KONDISI campur Sederhana + Formula (DAN): tersimpan sbg all[leaf, formula], round-trip utuh', async ({ page }) => {
  const fa = await adminLogin(page);
  await resetAll(fa);
  // usaha: pakai r13b1 (sederhana) DAN pangsa biaya produksi via formula r26b/r26_total
  await expect(fa.getByTestId('ar-row-U1')).toBeVisible();

  await fa.getByTestId('ar-add').click();
  await fa.getByTestId('ar-message').fill('UJI-E2E campur: produksi barang DAN biaya produksi dominan');
  // Kondisi 1 (Sederhana): r13b1 == 1
  await fa.getByTestId('ar-cond-field-0').selectOption('r13b1');
  await fa.getByTestId('ar-cond-op-0').selectOption('==');
  await fa.getByTestId('ar-cond-value-0').selectOption('1');
  // Kondisi 2: tambah, ubah tipe ke Formula, isi lewat klik panel Variabel + ketik
  await fa.getByTestId('ar-cond-add').click();
  await expect(fa.getByTestId('ar-combinator')).toBeVisible();
  await fa.getByTestId('ar-cond-type-1').selectOption('formula');
  await fa.getByTestId('ar-cond-formula-1').click();
  await fa.getByTestId('ar-var-search').fill('r26b');
  await fa.getByTestId('ar-var-r26b').click(); // sisip alias ke formula
  await fa.getByTestId('ar-cond-formula-1').press('End');
  await page.keyboard.type('/ r26_total > 0.5');

  // Preview: DAN → terpicu hanya bila keduanya benar
  await fa.getByTestId('ar-preview-answers').fill('{"r13b1": 1, "r26b": 40, "r26a": 10}');
  await fa.getByTestId('ar-preview-run').click();
  await expect(fa.getByTestId('ar-preview-result')).toContainText('TERPICU');
  await fa.getByTestId('ar-preview-answers').fill('{"r13b1": 2, "r26b": 40, "r26a": 10}');
  await fa.getByTestId('ar-preview-run').click();
  await expect(fa.getByTestId('ar-preview-result')).toContainText('TIDAK terpicu');

  await fa.getByTestId('ar-save').click();
  await expect(fa.getByTestId('ar-row-U100')).toBeVisible();
  // Tersimpan sebagai all[ leaf, {formula} ]
  const rules = await direct(fa, 'getRules', ['usaha', true]);
  const u100 = rules.rules.find((r) => r.rule_id === 'U100');
  expect(u100.when.all).toHaveLength(2);
  expect(u100.when.all[0]).toEqual({ field: 'r13b1', op: '==', value: 1 });
  expect(u100.when.all[1]).toEqual({ formula: 'r26b / r26_total > 0.5' });
  // Round-trip: buka lagi → kondisi 1 sederhana, kondisi 2 formula dengan teks utuh
  await fa.getByTestId('ar-edit-U100').click();
  await expect(fa.getByTestId('ar-cond-field-0')).toHaveValue('r13b1');
  await expect(fa.getByTestId('ar-cond-type-1')).toHaveValue('formula');
  await expect(fa.getByTestId('ar-cond-formula-1')).toHaveValue('r26b / r26_total > 0.5');
});

test('rule kompleks lama (roster/bersarang) dibuka sebagai editor JSON otomatis', async ({ page }) => {
  const fa = await adminLogin(page);
  await resetAll(fa);
  await fa.getByTestId('jenis-tab-keluarga').click();
  await expect(fa.getByTestId('ar-row-K3')).toBeVisible();
  // K3 memakai roster_all bersarang di dalam all[] → tak bisa di builder → editor JSON muncul
  await fa.getByTestId('ar-edit-K3').click();
  await expect(fa.getByTestId('ar-json')).toBeVisible();
  await expect(fa.getByTestId('ar-json')).toHaveValue(/roster_all/); // isi textarea di .value
  // builder (daftar kondisi) tersembunyi untuk rule kompleks
  await expect(fa.getByTestId('ar-cond-list')).toBeHidden();
});

test('beralih manual builder → editor JSON (kondisi berkurung) → balik lagi ke builder', async ({ page }) => {
  const fa = await adminLogin(page);
  await resetAll(fa);
  await expect(fa.getByTestId('ar-row-U1')).toBeVisible();

  // Rule baru sederhana: r13b1 == 1 (Sederhana)
  await fa.getByTestId('ar-add').click();
  await fa.getByTestId('ar-message').fill('UJI-E2E kurung: r13b1==1 DAN (r26a>0 ATAU r26b>0)');
  await fa.getByTestId('ar-cond-field-0').selectOption('r13b1');
  await fa.getByTestId('ar-cond-op-0').selectOption('==');
  await fa.getByTestId('ar-cond-value-0').selectOption('1');

  // Pindah manual ke JSON: kondisi yg sudah diisi ikut terbawa (bukan kosong),
  // catatan yang tampil netral (manual) — BUKAN peringatan "rule kompleks lama".
  await fa.getByTestId('ar-switch-advanced').click();
  await expect(fa.getByTestId('ar-json')).toBeVisible();
  await expect(fa.getByTestId('ar-json')).toHaveValue(/"r13b1"/);
  await expect(fa.getByTestId('ar-adv-note-manual')).toBeVisible();
  await expect(fa.getByTestId('ar-adv-note-auto')).toBeHidden();

  // Tambahkan kurung (nested any) langsung sebagai JSON — di luar jangkauan
  // builder flat, ini justru intinya fitur "editor JSON" ini.
  await fa.getByTestId('ar-json').fill(JSON.stringify({
    all: [
      { field: 'r13b1', op: '==', value: 1 },
      { any: [{ field: 'r26a', op: '>', value: 0 }, { field: 'r26b', op: '>', value: 0 }] }
    ]
  }));
  await fa.getByTestId('ar-preview-answers').fill('{"r13b1": 1, "r26a": 0, "r26b": 5}');
  await fa.getByTestId('ar-preview-run').click();
  await expect(fa.getByTestId('ar-preview-result')).toContainText('TERPICU');

  await fa.getByTestId('ar-save').click();
  await expect(fa.getByTestId('ar-row-U100')).toBeVisible();
  const rules = await direct(fa, 'getRules', ['usaha', true]);
  const u100 = rules.rules.find((r) => r.rule_id === 'U100');
  expect(u100.when).toEqual({
    all: [
      { field: 'r13b1', op: '==', value: 1 },
      { any: [{ field: 'r26a', op: '>', value: 0 }, { field: 'r26b', op: '>', value: 0 }] }
    ]
  });

  // Rule ini SEKARANG kompleks (nested) → dibuka lagi otomatis sbg JSON (amber).
  await fa.getByTestId('ar-edit-U100').click();
  await expect(fa.getByTestId('ar-json')).toBeVisible();
  await expect(fa.getByTestId('ar-adv-note-auto')).toBeVisible();
  // "Kembali ke builder sederhana" gagal dengan pesan jelas untuk JSON bersarang.
  await fa.getByTestId('ar-switch-builder').click();
  await expect(fa.getByTestId('ar-error')).toBeVisible();
  await expect(fa.getByTestId('ar-error')).toContainText('bersarang');
  await expect(fa.getByTestId('ar-json')).toBeVisible(); // tetap di JSON, tidak dipaksa pindah
});

test('tombol "Isi template" hanya mengisi variabel yang dipakai kondisi rule, bukan semua pertanyaan', async ({ page }) => {
  const fa = await adminLogin(page);
  await resetAll(fa);
  await fa.getByTestId('jenis-tab-keluarga').click();
  await expect(fa.getByTestId('ar-row-K1')).toBeVisible();

  await fa.getByTestId('ar-add').click();
  await fa.getByTestId('ar-cond-field-0').selectOption('b4r5');
  await fa.getByTestId('ar-cond-op-0').selectOption('>');
  await fa.getByTestId('ar-cond-value-0').fill('500');

  await fa.getByTestId('ar-preview-template').click();
  const tmpl = JSON.parse(await fa.getByTestId('ar-preview-answers').inputValue());
  expect(Object.keys(tmpl)).toEqual(['b4r5']);
  expect(tmpl.b4r5).toBe('');

  // Tambah kondisi ke-2 pakai field flat lain → template ikut nambah field itu
  // SAJA, tetap tidak menyeret field keluarga lain (mis. b4r3a) yang tak disebut.
  await fa.getByTestId('ar-cond-add').click();
  await fa.getByTestId('ar-cond-field-1').selectOption('b1r13_1');
  await fa.getByTestId('ar-cond-op-1').selectOption('<');
  await fa.getByTestId('ar-cond-value-1').fill('50');
  await fa.getByTestId('ar-preview-template').click();
  const tmpl2 = JSON.parse(await fa.getByTestId('ar-preview-answers').inputValue());
  expect(tmpl2).toEqual({ b4r5: '', b1r13_1: '' });

  // Field roster (mis. b1r8_n) sengaja TIDAK dipilihkan di builder flat (hanya
  // lewat Mode Lanjutan roster_*) — cek lewat editor JSON: template ikut
  // menyertakan blok roster yang dirujuk, TANPA field keluarga lain.
  await fa.getByTestId('ar-switch-advanced').click();
  await fa.getByTestId('ar-json').fill(JSON.stringify({
    roster_any: 'anggota_keluarga', condition: { field: 'b1r8_n', op: '==', value: 1 }
  }));
  await fa.getByTestId('ar-preview-template').click();
  const tmpl3 = JSON.parse(await fa.getByTestId('ar-preview-answers').inputValue());
  expect(tmpl3).toEqual({ roster: { anggota_keluarga: [{ b1r8_n: '' }] } });
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
    ['resetConfig', []],
    ['resetRecords', []]
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
  expect(await direct(f, 'resetConfig', [ADMIN_PW])).toEqual({ ok: true });
});
