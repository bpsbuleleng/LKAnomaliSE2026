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
    if (typeof when.field === 'string') return evalLeaf(when, answers);

    throw new Error('Bentuk kondisi tidak dikenali: ' + JSON.stringify(Object.keys(when)));
  }

  /**
   * Jalankan daftar rule (HARUS sudah difilter active oleh caller) atas
   * answers yang sudah ditambah computed fields.
   * @return { anomalies: [{rule_id, severity, message}], errors: [{rule_id, error}] }
   */
  function evaluateRules(rules, answers) {
    var anomalies = [];
    var errors = [];
    (rules || []).forEach(function (rule) {
      try {
        if (evaluate(rule.when, answers)) {
          anomalies.push({ rule_id: rule.rule_id, severity: rule.severity, message: rule.message });
        }
      } catch (e) {
        errors.push({ rule_id: rule.rule_id, error: String(e && e.message || e) });
      }
    });
    return { anomalies: anomalies, errors: errors };
  }

  return { evaluate: evaluate, evaluateRules: evaluateRules };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = RuleEvaluator;
}
