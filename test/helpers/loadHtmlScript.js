const fs = require('fs');
const path = require('path');
const vm = require('vm');

/**
 * Muat file partial HTML client (mis. src/CascadeLogic.html) yang isinya satu
 * blok <script> berisi logic murni + guarded module.exports, supaya bisa
 * di-unit-test di Node tanpa browser dan tanpa build step.
 */
function loadHtmlScript(relPathFromRepoRoot) {
  const full = path.resolve(__dirname, '..', '..', relPathFromRepoRoot);
  const html = fs.readFileSync(full, 'utf8');
  const m = html.match(/<script>([\s\S]*)<\/script>/);
  if (!m) throw new Error('Tidak ada blok <script> di ' + relPathFromRepoRoot);
  const module_ = { exports: {} };
  // runInThisContext (bukan runInNewContext) supaya objek hasil share realm
  // dengan test — kalau beda realm, deepStrictEqual gagal karena prototype beda.
  const fn = vm.runInThisContext(
    '(function (module, exports) {\n' + m[1] + '\n})',
    { filename: full }
  );
  fn(module_, module_.exports);
  return module_.exports;
}

module.exports = loadHtmlScript;
