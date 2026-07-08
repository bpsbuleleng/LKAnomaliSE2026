/**
 * Formula — parser + evaluator aritmetika AMAN untuk kondisi rule bergaya
 * "ketik ekspresi" (mis. `r26b / r26_total >= 0.5`). Logic murni: TANPA
 * dependency GAS, TANPA eval/Function — tokenizer + recursive-descent buatan
 * sendiri. Di-unit-test di Node.
 *
 * Sebuah formula = SATU perbandingan dua ekspresi aritmetika:
 *   <arith> <cmp> <arith>          cmp ∈ == != > >= < <=
 *   <arith> = operan digabung + - * / dan tanda kurung ( ), boleh unary minus.
 *   operan  = angka (12, 0.5, .5) ATAU alias field ([A-Za-z_][A-Za-z0-9_]*).
 *
 * Untuk gabungan DAN/ATAU beberapa kondisi, pakai kombinator all/any di
 * RuleEvaluator — bukan di sini (formula sengaja dibatasi 1 perbandingan
 * supaya tetap bounded, bukan bahasa query generik).
 *
 * Semantik nilai (SENGAJA disamakan dengan ComputedFields supaya formula bisa
 * mereproduksi computed field seperti pangsa_biaya_produksi dengan hasil
 * identik):
 *   - operan field kosong/null/'' ATAU non-angka → 0.
 *   - bagi dengan 0 → hasil null = "tidak berlaku"; menjalar ke atas dan
 *     membuat perbandingan bernilai false (data begini ≠ anomali).
 *   - perbandingan yang salah satu sisinya null → false.
 *
 * Sintaks rusak (karakter asing, kurung tak seimbang, tak ada perbandingan,
 * token berlebih) → THROW dengan pesan Indonesia yang jelas. Pemanggil
 * (RuleEvaluator.validateNode) menangkapnya jadi INVALID_WHEN saat simpan;
 * saat submit, evaluateRules menangkap per-rule.
 */
var Formula = (function () {
  var CMP = ['==', '!=', '>=', '<=', '>', '<'];

  function isDigit(c) { return c >= '0' && c <= '9'; }
  function isIdentStart(c) { return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_'; }
  function isIdentChar(c) { return isIdentStart(c) || isDigit(c); }

  // ---- Tokenizer ----
  function tokenize(text) {
    var s = String(text == null ? '' : text);
    var tokens = [];
    var i = 0, n = s.length;
    while (i < n) {
      var c = s.charAt(i);
      if (c === ' ' || c === '\t' || c === '\n' || c === '\r') { i++; continue; }

      if (isDigit(c) || c === '.') {
        var j = i;
        while (j < n && (isDigit(s.charAt(j)) || s.charAt(j) === '.')) j++;
        var numStr = s.slice(i, j);
        if (!/^(\d+(\.\d+)?|\.\d+)$/.test(numStr)) {
          throw new Error('Angka tidak valid: "' + numStr + '"');
        }
        tokens.push({ t: 'num', v: Number(numStr) });
        i = j; continue;
      }

      if (isIdentStart(c)) {
        var k = i + 1;
        while (k < n && isIdentChar(s.charAt(k))) k++;
        tokens.push({ t: 'ident', v: s.slice(i, k) });
        i = k; continue;
      }

      if (c === '+' || c === '-' || c === '*' || c === '/') { tokens.push({ t: 'op', v: c }); i++; continue; }
      if (c === '(') { tokens.push({ t: 'lp' }); i++; continue; }
      if (c === ')') { tokens.push({ t: 'rp' }); i++; continue; }

      if (c === '>' || c === '<' || c === '=' || c === '!') {
        var two = s.substr(i, 2);
        if (two === '>=' || two === '<=' || two === '==' || two === '!=') { tokens.push({ t: 'cmp', v: two }); i += 2; continue; }
        if (c === '>' || c === '<') { tokens.push({ t: 'cmp', v: c }); i++; continue; }
        throw new Error('Perbandingan tidak lengkap "' + c + '" — pakai ==, !=, >=, <=, > atau <');
      }

      throw new Error('Karakter tidak dikenal: "' + c + '"');
    }
    return tokens;
  }

  // ---- Parser (recursive descent). AST node:
  //   { type:'cmp', op, left, right } | { type:'bin', op, left, right }
  //   { type:'neg', arg } | { type:'num', value } | { type:'field', name }
  function parse(text) {
    var tokens = tokenize(text);
    if (!tokens.length) throw new Error('Formula kosong.');
    var pos = 0;

    function peek() { return tokens[pos]; }
    function next() { return tokens[pos++]; }

    function parsePrimary() {
      var tk = peek();
      if (!tk) throw new Error('Ekspresi terpotong — diharapkan angka, field, atau "(".');
      if (tk.t === 'num') { next(); return { type: 'num', value: tk.v }; }
      if (tk.t === 'ident') { next(); return { type: 'field', name: tk.v }; }
      if (tk.t === 'lp') {
        next();
        var inner = parseAdd();
        if (!peek() || peek().t !== 'rp') throw new Error('Kurung ")" tidak ditemukan.');
        next();
        return inner;
      }
      throw new Error('Diharapkan angka, field, atau "(" — dapat "' + tokenText(tk) + '".');
    }

    function parseUnary() {
      var tk = peek();
      if (tk && tk.t === 'op' && (tk.v === '-' || tk.v === '+')) {
        next();
        var arg = parseUnary();
        return tk.v === '-' ? { type: 'neg', arg: arg } : arg;
      }
      return parsePrimary();
    }

    function parseMul() {
      var node = parseUnary();
      while (peek() && peek().t === 'op' && (peek().v === '*' || peek().v === '/')) {
        var op = next().v;
        node = { type: 'bin', op: op, left: node, right: parseUnary() };
      }
      return node;
    }

    function parseAdd() {
      var node = parseMul();
      while (peek() && peek().t === 'op' && (peek().v === '+' || peek().v === '-')) {
        var op = next().v;
        node = { type: 'bin', op: op, left: node, right: parseMul() };
      }
      return node;
    }

    var left = parseAdd();
    var cmpTok = peek();
    if (!cmpTok || cmpTok.t !== 'cmp') {
      throw new Error('Formula harus berisi satu perbandingan (==, !=, >, >=, <, <=), mis. "r26b / r26_total >= 0.5".');
    }
    next();
    var right = parseAdd();
    if (pos < tokens.length) {
      throw new Error('Ada bagian berlebih setelah perbandingan: "' + tokenText(tokens[pos]) + '". Satu formula hanya boleh punya SATU perbandingan.');
    }
    return { type: 'cmp', op: cmpTok.v, left: left, right: right };
  }

  function tokenText(tk) {
    if (!tk) return '';
    if (tk.t === 'num') return String(tk.v);
    if (tk.t === 'ident') return tk.v;
    if (tk.t === 'op' || tk.t === 'cmp') return tk.v;
    if (tk.t === 'lp') return '(';
    if (tk.t === 'rp') return ')';
    return '?';
  }

  // ---- Evaluator ----
  function num(v) {
    if (v === undefined || v === null || v === '') return 0;
    var n = Number(v);
    return isNaN(n) ? 0 : n;
  }

  // Kembalikan Number, ATAU null = "tidak berlaku" (bagi 0) yang menjalar.
  function evalArith(node, scope) {
    switch (node.type) {
      case 'num': return node.value;
      case 'field': return num(scope[node.name]);
      case 'neg':
        var a = evalArith(node.arg, scope);
        return a === null ? null : -a;
      case 'bin':
        var l = evalArith(node.left, scope);
        var r = evalArith(node.right, scope);
        if (l === null || r === null) return null;
        if (node.op === '+') return l + r;
        if (node.op === '-') return l - r;
        if (node.op === '*') return l * r;
        if (node.op === '/') return r === 0 ? null : l / r; // bagi 0 → tidak berlaku
        throw new Error('Operator aritmetika tidak dikenal: ' + node.op);
      default:
        throw new Error('Simpul ekspresi tidak dikenal: ' + node.type);
    }
  }

  function evalCmp(node, scope) {
    var l = evalArith(node.left, scope);
    var r = evalArith(node.right, scope);
    if (l === null || r === null) return false; // sisi tidak berlaku → bukan anomali
    switch (node.op) {
      case '==': return l === r;
      case '!=': return l !== r;
      case '>': return l > r;
      case '>=': return l >= r;
      case '<': return l < r;
      case '<=': return l <= r;
      default: throw new Error('Operator banding tidak dikenal: ' + node.op);
    }
  }

  // ---- API publik ----
  /** Parse + validasi sintaks. Throw kalau rusak. Kembalikan AST. */
  function compile(text) {
    var ast = parse(text);
    if (ast.type !== 'cmp') throw new Error('Formula harus berupa perbandingan.');
    return ast;
  }

  /** Kumpulan alias field yang dipakai formula (untuk cek "field dikenal"). */
  function fieldsUsed(text) {
    var seen = {}, out = [];
    (function walk(node) {
      if (!node) return;
      if (node.type === 'field') { if (!seen[node.name]) { seen[node.name] = true; out.push(node.name); } return; }
      if (node.type === 'neg') { walk(node.arg); return; }
      if (node.type === 'bin' || node.type === 'cmp') { walk(node.left); walk(node.right); }
    })(compile(text));
    return out;
  }

  /** Parse (kalau string) + evaluasi → boolean. */
  function evaluate(text, scope) {
    return evalCmp(compile(text), scope || {});
  }

  return { compile: compile, evaluate: evaluate, fieldsUsed: fieldsUsed };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Formula;
}
