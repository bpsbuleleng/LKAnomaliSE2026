/**
 * Code — entry point web app (doGet router) + helper template.
 */

function doGet(e) {
  var page = (e && e.parameter && e.parameter.page) || '';

  // Halaman admin (Fase 4) — hanya via ?page=admin, tidak ditautkan dari UI PML.
  if (page === 'admin') {
    return HtmlService.createHtmlOutput(
      '<p style="font-family:sans-serif;padding:24px">Halaman admin belum tersedia (Fase 4).</p>'
    ).setTitle('Admin — LK Anomali SE2026');
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
