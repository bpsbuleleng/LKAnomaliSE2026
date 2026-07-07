const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './e2e',
  timeout: 120000,
  // Store Records mock dipakai bersama semua test — jangan paralel antar file.
  workers: 1,
  // Panggilan google.script.run bolak-balik ke server GAS bisa lambat.
  expect: { timeout: 30000 },
  use: {
    headless: true,
    viewport: { width: 390, height: 844 } // mobile-first: ukuran layar HP
  }
});
