/**
 * ConfigLogic — transformasi murni tab Questions & Rules untuk halaman config
 * (Fase 4). Tanpa dependency GAS; di-unit-test di Node. Immutable: fungsi
 * mengembalikan array BARU, input tidak diubah.
 *
 * Pengecekan adminPassword BUKAN di sini — itu urusan DataAccess (boundary
 * server) dan WAJIB dilakukan di tiap panggilan privileged.
 *
 * Konvensi id:
 * - question_id (alias) dipasok admin, unik PER JENIS (fakta data riil:
 *   alias bisa sama antar jenis), regex [a-z0-9_]+.
 * - rule_id dibuat SERVER: 'U100'/'K100' dst — mulai 100 supaya tidak
 *   menabrak kode historis U1-U8/K1-K7 (termasuk yang belum diimpor).
 */
var ConfigLogic = (function () {
  // GAS: global antar-file; Node: require (resolusi ditunda ke saat panggil).
  function evaluator() {
    if (typeof module !== 'undefined' && module.exports) return require('./RuleEvaluator.js');
    return RuleEvaluator;
  }

  var TYPES = ['text', 'number', 'currency', 'select', 'date', 'textarea', 'kbli'];
  var SEVERITIES = ['error', 'warning'];
  var ALIAS_RE = /^[a-z0-9_]+$/i;
  var RULE_ID_RE = /^[a-z0-9_-]+$/i;

  function s(v) { return String(v == null ? '' : v).trim(); }

  function jenisValid(jenis) { return jenis === 'usaha' || jenis === 'keluarga'; }

  function findIndex(arr, pred) {
    for (var i = 0; i < arr.length; i++) if (pred(arr[i])) return i;
    return -1;
  }

  function replaceAt(arr, idx, item) {
    var copy = arr.slice();
    copy[idx] = item;
    return copy;
  }

  function shallow(obj) {
    var out = {};
    Object.keys(obj).forEach(function (k) { out[k] = obj[k]; });
    return out;
  }

  // options valid = array non-kosong berisi {value, label non-kosong}.
  function normalizeOptions(options) {
    if (!Array.isArray(options) || !options.length) return null;
    var out = [];
    for (var i = 0; i < options.length; i++) {
      var o = options[i];
      if (!o || o.value === undefined || o.value === null || !s(o.label)) return null;
      out.push({ value: o.value, label: s(o.label) });
    }
    return out;
  }

  // ==== QUESTIONS ====

  function applyCreateQuestion(questions, jenis, input) {
    if (!jenisValid(jenis)) return { ok: false, error: 'INVALID_JENIS' };
    input = input || {};
    var alias = s(input.question_id).toLowerCase();
    if (!alias || !ALIAS_RE.test(alias)) return { ok: false, error: 'INVALID_ALIAS' };
    if (findIndex(questions, function (q) { return q.jenis === jenis && q.question_id === alias; }) !== -1) {
      return { ok: false, error: 'DUPLICATE_ALIAS' };
    }
    var label = s(input.label);
    if (!label) return { ok: false, error: 'INVALID_LABEL' };
    if (TYPES.indexOf(input.type) === -1) return { ok: false, error: 'INVALID_TYPE' };
    var options = null;
    if (input.type === 'select') {
      options = normalizeOptions(input.options);
      if (!options) return { ok: false, error: 'INVALID_OPTIONS' };
    }
    var maxOrder = 0;
    questions.forEach(function (q) { if (q.jenis === jenis && q.order > maxOrder) maxOrder = q.order; });

    var question = {
      question_id: alias, jenis: jenis, order: maxOrder + 1,
      label: label, type: input.type, options: options,
      required: input.required === true, help: s(input.help),
      active: true, roster_group: '' // roster TIDAK bisa dibuat dari config v1
    };
    return { ok: true, questions: questions.concat([question]), question: question };
  }

  // Whitelist patch — jenis/question_id/order/roster_group/active TIDAK bisa
  // diubah lewat update (order via reorder, active via setQuestionActive).
  function applyUpdateQuestion(questions, jenis, questionId, patch) {
    if (!jenisValid(jenis)) return { ok: false, error: 'INVALID_JENIS' };
    var idx = findIndex(questions, function (q) { return q.jenis === jenis && q.question_id === questionId; });
    if (idx === -1) return { ok: false, error: 'NOT_FOUND' };
    patch = patch || {};
    var q = shallow(questions[idx]);

    if ('label' in patch) {
      if (!s(patch.label)) return { ok: false, error: 'INVALID_LABEL' };
      q.label = s(patch.label);
    }
    if ('type' in patch) {
      if (TYPES.indexOf(patch.type) === -1) return { ok: false, error: 'INVALID_TYPE' };
      q.type = patch.type;
    }
    if ('options' in patch) q.options = normalizeOptions(patch.options);
    // Konsistensi AKHIR: select wajib punya options; non-select tanpa options.
    if (q.type === 'select') {
      if (!q.options) return { ok: false, error: 'INVALID_OPTIONS' };
    } else {
      q.options = null;
    }
    if ('required' in patch) q.required = patch.required === true;
    if ('help' in patch) q.help = s(patch.help);

    return { ok: true, questions: replaceAt(questions, idx, q), question: q };
  }

  function applySetQuestionActive(questions, jenis, questionId, active) {
    if (!jenisValid(jenis)) return { ok: false, error: 'INVALID_JENIS' };
    var idx = findIndex(questions, function (q) { return q.jenis === jenis && q.question_id === questionId; });
    if (idx === -1) return { ok: false, error: 'NOT_FOUND' };
    var q = shallow(questions[idx]);
    q.active = active === true;
    return { ok: true, questions: replaceAt(questions, idx, q), question: q };
  }

  /**
   * orderedIds = permutasi LENGKAP question_id jenis tsb (termasuk nonaktif).
   * Server assign order 1..n mengikuti urutan itu; jenis lain tak tersentuh.
   */
  function applyReorderQuestions(questions, jenis, orderedIds) {
    if (!jenisValid(jenis)) return { ok: false, error: 'INVALID_JENIS' };
    if (!Array.isArray(orderedIds)) return { ok: false, error: 'INVALID_ORDER' };
    var ownIds = questions.filter(function (q) { return q.jenis === jenis; })
      .map(function (q) { return q.question_id; });
    if (orderedIds.length !== ownIds.length) return { ok: false, error: 'INVALID_ORDER' };
    var seen = {};
    for (var i = 0; i < orderedIds.length; i++) {
      if (seen[orderedIds[i]] || ownIds.indexOf(orderedIds[i]) === -1) {
        return { ok: false, error: 'INVALID_ORDER' }; // duplikat / id asing
      }
      seen[orderedIds[i]] = true;
    }
    var orderOf = {};
    orderedIds.forEach(function (id, pos) { orderOf[id] = pos + 1; });
    var updated = questions.map(function (q) {
      if (q.jenis !== jenis) return q;
      var copy = shallow(q);
      copy.order = orderOf[q.question_id];
      return copy;
    });
    return { ok: true, questions: updated };
  }

  // ==== RULES ====

  function nextRuleId(rules, jenis) {
    var prefix = jenis === 'usaha' ? 'U' : 'K';
    var max = 99; // id buatan config mulai 100 (U1-U8/K1-K7 historis aman)
    rules.forEach(function (r) {
      if (String(r.rule_id).charAt(0) !== prefix) return;
      var n = Number(String(r.rule_id).slice(1));
      if (!isNaN(n) && n > max) max = n;
    });
    return prefix + (max + 1);
  }

  // when boleh objek ATAU string JSON → disimpan sebagai OBJEK tervalidasi.
  function normalizeWhen(when) {
    var parsed = when;
    if (typeof when === 'string') {
      try { parsed = JSON.parse(when); } catch (e) { return { ok: false, error: 'JSON tidak valid: ' + e.message }; }
    }
    var v = evaluator().validateWhen(parsed);
    if (!v.ok) return { ok: false, error: v.error };
    return { ok: true, when: parsed };
  }

  // rule_id unik GLOBAL. Kosong/tidak dipasok → server generate (nextRuleId);
  // dipasok → dipakai apa adanya (admin boleh menamai sendiri, mis. "K8"
  // atau "K_status_cerai") supaya lebih gampang dikelola orang lain.
  function applyCreateRule(rules, jenis, input) {
    if (!jenisValid(jenis)) return { ok: false, error: 'INVALID_JENIS' };
    input = input || {};
    if (SEVERITIES.indexOf(input.severity) === -1) return { ok: false, error: 'INVALID_SEVERITY' };
    if (!s(input.message)) return { ok: false, error: 'INVALID_MESSAGE' };
    var w = normalizeWhen(input.when);
    if (!w.ok) return { ok: false, error: 'INVALID_WHEN', detail: w.error };

    var ruleId = s(input.rule_id);
    if (ruleId) {
      if (!RULE_ID_RE.test(ruleId)) return { ok: false, error: 'INVALID_RULE_ID' };
      if (findIndex(rules, function (r) { return r.rule_id === ruleId; }) !== -1) {
        return { ok: false, error: 'DUPLICATE_RULE_ID' };
      }
    } else {
      ruleId = nextRuleId(rules, jenis);
    }

    var rule = {
      rule_id: ruleId, jenis: jenis,
      severity: input.severity, message: s(input.message),
      when: w.when, active: true
    };
    return { ok: true, rules: rules.concat([rule]), rule: rule };
  }

  // rule_id unik GLOBAL (prefix U/K per jenis menjamin) — tidak perlu jenis.
  // Rename (patch.rule_id) TIDAK memutus anomali yang sudah tersimpan di
  // record lama — 'anomalies' disimpan sebagai snapshot {rule_id, severity,
  // message} saat submit, bukan live-join ke tab Rules.
  function applyUpdateRule(rules, ruleId, patch) {
    var idx = findIndex(rules, function (r) { return r.rule_id === ruleId; });
    if (idx === -1) return { ok: false, error: 'NOT_FOUND' };
    patch = patch || {};
    var r = shallow(rules[idx]);

    if ('rule_id' in patch) {
      var newId = s(patch.rule_id);
      if (!newId || !RULE_ID_RE.test(newId)) return { ok: false, error: 'INVALID_RULE_ID' };
      if (newId !== ruleId && findIndex(rules, function (x) { return x.rule_id === newId; }) !== -1) {
        return { ok: false, error: 'DUPLICATE_RULE_ID' };
      }
      r.rule_id = newId;
    }
    if ('severity' in patch) {
      if (SEVERITIES.indexOf(patch.severity) === -1) return { ok: false, error: 'INVALID_SEVERITY' };
      r.severity = patch.severity;
    }
    if ('message' in patch) {
      if (!s(patch.message)) return { ok: false, error: 'INVALID_MESSAGE' };
      r.message = s(patch.message);
    }
    if ('when' in patch) {
      var w = normalizeWhen(patch.when);
      if (!w.ok) return { ok: false, error: 'INVALID_WHEN', detail: w.error };
      r.when = w.when;
    }
    return { ok: true, rules: replaceAt(rules, idx, r), rule: r };
  }

  function applySetRuleActive(rules, ruleId, active) {
    var idx = findIndex(rules, function (r) { return r.rule_id === ruleId; });
    if (idx === -1) return { ok: false, error: 'NOT_FOUND' };
    var r = shallow(rules[idx]);
    r.active = active === true;
    return { ok: true, rules: replaceAt(rules, idx, r), rule: r };
  }

  return {
    applyCreateQuestion: applyCreateQuestion,
    applyUpdateQuestion: applyUpdateQuestion,
    applySetQuestionActive: applySetQuestionActive,
    applyReorderQuestions: applyReorderQuestions,
    applyCreateRule: applyCreateRule,
    applyUpdateRule: applyUpdateRule,
    applySetRuleActive: applySetRuleActive
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ConfigLogic;
}
