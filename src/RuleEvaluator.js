/**
 * RuleEvaluator — evaluator kondisi `when` untuk rule anomali (server + Fase 4
 * preview). Logic murni: TANPA dependency GAS, TANPA eval/Function — struktur
 * kondisi di-interpretasi langsung. Di-unit-test di Node.
 *
 * Bentuk kondisi (lihat CLAUDE.md "Format rule"):
 *   { field, op, value }            — operator dasar
 *   { field, op, field2 }           — bandingkan antar-field
 *   { all: [...] } / { any: [...] } — kombinator, boleh bersarang
 *   { roster_any: grup, condition } — ada baris roster yang memenuhi
 *   { roster_all: grup, condition } — SEMUA baris memenuhi (roster kosong = false,
 *                                     supaya "semua anggota X" tidak vakum-benar)
 *   { roster_count: grup, condition?, op, value }
 *                                   — jumlah baris yang memenuhi, dibanding value
 *   { formula: "a / b >= 0.5" }     — satu perbandingan aritmetika antar-field
 *                                     (parser aman di Formula.js, tanpa eval)
 *
 * Semantik nilai kosong (undefined/null/''): SEMUA operator perbandingan
 * menghasilkan false (data belum terisi ≠ anomali) — kecuali `empty` (true)
 * dan `not_empty` (false). Angka 0 BUKAN kosong.
 *
 * Kondisi malformed (op tak dikenal, bentuk tak dikenali, JSON rusak) THROW —
 * evaluateRules menangkapnya per-rule supaya satu rule rusak tidak
 * menggagalkan submit; rule itu dilewati dan dicatat di `errors`.
 */
var RuleEvaluator = (function () {
  // GAS: Formula global antar-file; Node: require (ditunda ke saat panggil).
  function formulaLib() {
    if (typeof module !== 'undefined' && module.exports) return require('./Formula.js');
    return Formula;
  }

  function isMissing(v) {
    return v === undefined || v === null || v === '';
  }

  // Perbandingan longgar yang disengaja: nilai kategorik bisa bolak-balik
  // number/string (select DOM, JSON, sel Sheets) — 1 harus sama dengan '1'.
  function eq(a, b) {
    var na = Number(a), nb = Number(b);
    if (!isNaN(na) && !isNaN(nb) && String(a).trim() !== '' && String(b).trim() !== '') {
      return na === nb;
    }
    return String(a) === String(b);
  }

  function cmpNumeric(a, b, op) {
    var na = Number(a), nb = Number(b);
    if (isNaN(na) || isNaN(nb)) return false;
    if (op === '>') return na > nb;
    if (op === '>=') return na >= nb;
    if (op === '<') return na < nb;
    return na <= nb; // '<='
  }

  function evalLeaf(cond, scope) {
    var left = scope[cond.field];
    var op = cond.op;

    if (op === 'empty') return isMissing(left);
    if (op === 'not_empty') return !isMissing(left);

    var right = ('field2' in cond) ? scope[cond.field2] : cond.value;
    if (isMissing(left) || isMissing(right)) return false;

    switch (op) {
      case '==': return eq(left, right);
      case '!=': return !eq(left, right);
      case '>': case '>=': case '<': case '<=':
        return cmpNumeric(left, right, op);
      case 'in':
      case 'not_in':
        if (!Array.isArray(right)) throw new Error('Operator ' + op + ' butuh value array');
        var found = right.some(function (v) { return eq(left, v); });
        return op === 'in' ? found : !found;
      case 'regex':
        return new RegExp(String(right)).test(String(left));
      default:
        throw new Error('Operator tidak dikenal: ' + op);
    }
  }

  function rosterRows(answers, group) {
    var roster = answers && answers.roster;
    var rows = roster && roster[group];
    return Array.isArray(rows) ? rows : [];
  }

  /**
   * @param when objek kondisi ATAU string JSON (kolom `when` di sheet).
   * @param answers scope pencarian field. Kondisi di dalam roster_* dievaluasi
   *        dengan scope BARIS roster (tidak melihat field datar) — sederhana
   *        dan cukup untuk 16 anomali riil.
   */
  function evaluate(when, answers) {
    if (typeof when === 'string') when = JSON.parse(when);
    if (!when || typeof when !== 'object') throw new Error('Kondisi bukan objek');
    answers = answers || {};

    if (Array.isArray(when.all)) {
      return when.all.every(function (c) { return evaluate(c, answers); });
    }
    if (Array.isArray(when.any)) {
      return when.any.some(function (c) { return evaluate(c, answers); });
    }
    if (typeof when.roster_any === 'string') {
      return rosterRows(answers, when.roster_any).some(function (row) {
        return evaluate(when.condition, row);
      });
    }
    if (typeof when.roster_all === 'string') {
      var rows = rosterRows(answers, when.roster_all);
      if (!rows.length) return false; // "semua baris" atas roster kosong = false
      return rows.every(function (row) { return evaluate(when.condition, row); });
    }
    if (typeof when.roster_count === 'string') {
      var matched = rosterRows(answers, when.roster_count).filter(function (row) {
        return when.condition ? evaluate(when.condition, row) : true;
      }).length;
      if (when.op === '==') return matched === Number(when.value);
      if (when.op === '!=') return matched !== Number(when.value);
      if (when.op === '>' || when.op === '>=' || when.op === '<' || when.op === '<=') {
        return cmpNumeric(matched, when.value, when.op);
      }
      throw new Error('roster_count butuh op perbandingan numerik, dapat: ' + when.op);
    }
    if (typeof when.formula === 'string') return formulaLib().evaluate(when.formula, answers);
    if (typeof when.field === 'string') return evalLeaf(when, answers);

    throw new Error('Bentuk kondisi tidak dikenali: ' + JSON.stringify(Object.keys(when)));
  }

  /**
   * Kumpulkan field yang MEMBUAT kondisi terpicu, berikut nilai jawabannya —
   * dipanggil HANYA setelah evaluate(when, answers) === true. Turun cuma ke
   * cabang yang benar: anak `all` pasti semuanya benar, anak `any` disaring
   * evaluate ulang, roster_* cuma baris yang cocok (roster_all = semua baris).
   * Nilai diambil dari scope saat itu (baris roster untuk kondisi roster) —
   * snapshot bersama anomali, bukan live-join ke answers.
   * @return [{field, value, roster_group?, row_index?}] — value undefined
   *         dinormalkan ke null supaya selamat JSON round-trip ke Sheets.
   */
  function collectTriggered(when, answers) {
    var out = [];
    var seen = {};
    function push(field, scope, ctx) {
      var key = (ctx ? ctx.group + '#' + ctx.index : '') + '|' + field;
      if (seen[key]) return;
      seen[key] = true;
      var entry = { field: field, value: scope[field] === undefined ? null : scope[field] };
      if (ctx) { entry.roster_group = ctx.group; entry.row_index = ctx.index; }
      out.push(entry);
    }
    function walk(node, scope, ctx) {
      if (typeof node === 'string') node = JSON.parse(node);
      if (Array.isArray(node.all)) {
        node.all.forEach(function (c) { walk(c, scope, ctx); });
        return;
      }
      if (Array.isArray(node.any)) {
        node.any.forEach(function (c) { if (evaluate(c, scope)) walk(c, scope, ctx); });
        return;
      }
      if (typeof node.roster_any === 'string' || typeof node.roster_all === 'string') {
        var group = node.roster_any !== undefined ? node.roster_any : node.roster_all;
        rosterRows(scope, group).forEach(function (row, i) {
          // roster_all: semua baris pasti cocok (induk sudah true) — evaluate
          // tetap dipakai sebagai satu jalur seragam dengan roster_any.
          if (evaluate(node.condition, row)) walk(node.condition, row, { group: group, index: i });
        });
        return;
      }
      if (typeof node.roster_count === 'string') {
        if (!node.condition) return; // hitung semua baris: tak ada field per-baris
        rosterRows(scope, node.roster_count).forEach(function (row, i) {
          if (evaluate(node.condition, row)) walk(node.condition, row, { group: node.roster_count, index: i });
        });
        return;
      }
      if (typeof node.formula === 'string') {
        formulaLib().fieldsUsed(node.formula).forEach(function (f) { push(f, scope, ctx); });
        return;
      }
      if (typeof node.field === 'string') {
        push(node.field, scope, ctx);
        if (typeof node.field2 === 'string') push(node.field2, scope, ctx);
      }
    }
    walk(when, answers || {}, null);
    return out;
  }

  var VALID_OPS = ['==', '!=', '>', '>=', '<', '<=', 'in', 'not_in', 'empty', 'not_empty', 'regex'];
  var COUNT_OPS = ['==', '!=', '>', '>=', '<', '<='];

  // Validasi STRUKTUR tanpa evaluasi — dipakai halaman config (create/update
  // rule) supaya `when` rusak ditolak saat disimpan, bukan meledak saat
  // submit. Evaluasi biasa TIDAK cukup untuk ini karena all/any
  // short-circuit: cabang setelah leaf false pertama tidak pernah disentuh.
  function validateNode(node) {
    if (!node || typeof node !== 'object' || Array.isArray(node)) {
      throw new Error('Kondisi harus objek');
    }
    if ('all' in node || 'any' in node) {
      var arr = node.all !== undefined ? node.all : node.any;
      var key = node.all !== undefined ? 'all' : 'any';
      if (!Array.isArray(arr) || !arr.length) throw new Error(key + ' harus array berisi minimal 1 kondisi');
      arr.forEach(validateNode);
      return;
    }
    if ('roster_any' in node || 'roster_all' in node) {
      var g = node.roster_any !== undefined ? node.roster_any : node.roster_all;
      if (typeof g !== 'string' || !g) throw new Error('roster_any/roster_all harus nama grup roster');
      if (!node.condition) throw new Error('roster_any/roster_all butuh condition');
      validateNode(node.condition);
      return;
    }
    if ('roster_count' in node) {
      if (typeof node.roster_count !== 'string' || !node.roster_count) throw new Error('roster_count harus nama grup roster');
      if (COUNT_OPS.indexOf(node.op) === -1) throw new Error('roster_count butuh op perbandingan numerik');
      if (isNaN(Number(node.value))) throw new Error('roster_count butuh value numerik');
      if (node.condition) validateNode(node.condition);
      return;
    }
    if (typeof node.formula === 'string') {
      formulaLib().compile(node.formula); // sintaks rusak → throw (INVALID_WHEN saat simpan)
      return;
    }
    if (typeof node.field === 'string' && node.field) {
      if (VALID_OPS.indexOf(node.op) === -1) throw new Error('Operator tidak dikenal: ' + node.op);
      if (node.op === 'empty' || node.op === 'not_empty') return; // tanpa value
      if (node.op === 'in' || node.op === 'not_in') {
        if (!Array.isArray(node.value) || !node.value.length) throw new Error('Operator ' + node.op + ' butuh value array non-kosong');
        return;
      }
      if (node.op === 'regex') {
        if (typeof node.value !== 'string') throw new Error('regex butuh value string pola');
        new RegExp(node.value); // pola rusak → throw
        return;
      }
      if (!('value' in node) && typeof node.field2 !== 'string') {
        throw new Error('Operator ' + node.op + ' butuh value atau field2');
      }
      return;
    }
    throw new Error('Bentuk kondisi tidak dikenali: ' + JSON.stringify(Object.keys(node)));
  }

  /** @return { ok:true } | { ok:false, error } — when boleh objek atau string JSON. */
  function validateWhen(when) {
    try {
      validateNode(typeof when === 'string' ? JSON.parse(when) : when);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: String((e && e.message) || e) };
    }
  }

  /**
   * Jalankan daftar rule (HARUS sudah difilter active oleh caller) atas
   * answers yang sudah ditambah computed fields.
   * @return { anomalies: [{rule_id, severity, message, fields}], errors: [{rule_id, error}] }
   */
  function evaluateRules(rules, answers) {
    var anomalies = [];
    var errors = [];
    (rules || []).forEach(function (rule) {
      try {
        if (evaluate(rule.when, answers)) {
          var a = { rule_id: rule.rule_id, severity: rule.severity, message: rule.message };
          // fields = pelengkap tampilan — gagal mengumpulkan TIDAK boleh
          // menggugurkan anomali yang sudah terbukti terpicu.
          try { a.fields = collectTriggered(rule.when, answers); } catch (e) { a.fields = []; }
          anomalies.push(a);
        }
      } catch (e) {
        errors.push({ rule_id: rule.rule_id, error: String(e && e.message || e) });
      }
    });
    return { anomalies: anomalies, errors: errors };
  }

  return {
    evaluate: evaluate, evaluateRules: evaluateRules, validateWhen: validateWhen,
    collectTriggered: collectTriggered
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = RuleEvaluator;
}
