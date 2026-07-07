/**
 * Code — entry point web app (doGet router) + helper template.
 */

function doGet(e) {
  var page = (e && e.parameter && e.parameter.page) || '';

  // Halaman admin (Fase 4) — hanya via ?page=admin, TIDAK ditautkan dari UI
  // PML. URL saja bukan proteksi: tiap fungsi privileged tetap mengecek
  // adminPassword server-side di DataAccess.
  if (page === 'admin') {
    return HtmlService.createTemplateFromFile('Admin')
      .evaluate()
      .setTitle('Admin — LK Anomali SE2026')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }

  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('LK Anomali SE2026')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// Dipakai template Index.html untuk menyisipkan partial view.
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
