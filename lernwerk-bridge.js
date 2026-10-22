/*
 * lernwerk-bridge.js
 * Wird von jedem alten Trainer unter trainer/ eingebunden.
 * - schmaler Zurück-Knopf "Lernwerk" oben
 * - Darstellung (hell, dunkel) aus Lernwerk übernehmen
 * - alte Klausur-Kopfzeilen ausblenden
 * - Ergebnisse (Thema, richtig oder falsch, Fehlerart, Zeitpunkt) in den gemeinsamen Speicher schreiben
 * - Knopf "Sitzung abschließen" mit Selbsteinschätzung
 * Die App liest den Eingang (localStorage "lernwerk:inbox") beim nächsten Öffnen in IndexedDB ein.
 */
(function () {
  'use strict';
  var FILE = (location.pathname.split('/').pop() || '').replace(/\?.*$/, '');
  var KEY = 'lernwerk:inbox';

  function emit(x) {
    try {
      var box = JSON.parse(localStorage.getItem(KEY) || '[]');
      x.datei = FILE; x.zeit = Date.now();
      box.push(x);
      if (box.length > 500) box = box.slice(-500);
      localStorage.setItem(KEY, JSON.stringify(box));
    } catch (e) { /* Speicher voll oder gesperrt: nicht schlimm */ }
  }
  window.Lernwerk = { emit: emit };

  /* ===== Darstellung ===== */
  try {
    var th = JSON.parse(localStorage.getItem('lernwerk:theme') || '"auto"');
    if (th === 'hell') document.documentElement.setAttribute('data-theme', 'light');
    if (th === 'dunkel') document.documentElement.setAttribute('data-theme', 'dark');
  } catch (e) { /* egal */ }
  function isDark() {
    var t = document.documentElement.getAttribute('data-theme');
    if (t) return t === 'dark';
    return window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches;
  }

  /* ===== Fehlerart aus dem Meldungstext ===== */
  function fehlerart(msg) {
    var m = String(msg || '');
    if (/Einheit|Faktor 1000|mA|falschen Einheit/.test(m)) return 'Einheit (Faktor 1000)';
    if (/Vorzeichen/.test(m)) return 'Vorzeichen';
    if (/RAD|DEG/.test(m)) return 'Taschenrechner auf RAD';
    if (/Quadrant/.test(m)) return 'Quadrant beim Arcustangens';
    if (/^Nicht (Zusammenfassen|Ohm|Knoten|Masche|Kirchhoff)/.test(m) || /^Nicht [A-ZÄÖÜ]/.test(m) && !/^Nicht das/.test(m)) return 'Falsche Regel gewählt';
    if (/^Nicht das/.test(m)) return 'Falsche Auswahl';
    if (/gerundet|Rundung/.test(m)) return 'Zu früh gerundet';
    if (/Kehrwert/.test(m)) return 'Kehrwert';
    return 'Rechenweg';
  }
  var txt = function (el) { return el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : ''; };
  var seen = {};
  function once(k) { if (seen[k]) return false; seen[k] = 1; return true; }
  function modeLabel() { return txt(document.querySelector('#pick button.on, .pick button.on, [data-k].on')); }

  /* ===== Andocken an die Trainer, die Richtig und Falsch auswerten ===== */
  function wrap(name, after, before) {
    var orig = window[name];
    if (typeof orig !== 'function') return false;
    window[name] = function () {
      var ctx = before ? before.apply(this, arguments) : null;
      var r = orig.apply(this, arguments);
      try { after.call(this, ctx, arguments, r); } catch (e) { /* Trainer läuft weiter */ }
      return r;
    };
    return true;
  }

  // Statik-Trainer, Rückrechen-Trainer, IT ablesen: gleicher Aufbau mit check, fb und finish
  function stepTrainer() {
    var ok = wrap('check', function (c) {
      var fb = document.getElementById('fb');
      if (!fb) return;
      var msg = txt(fb);
      if (/\bbadf\b/.test(fb.className) && c.v.trim() && !/Gib eine Zahl|Wähl zuerst/.test(msg)) {
        if (once(c.task + '|' + c.q)) emit({ art: 'fehler', thema: modeLabel(), aufgabe: (c.task ? c.task + ' Schritt: ' : '') + c.q, eingabe: c.v + (c.u ? ' ' + c.u : ''), meldung: msg, fehlerart: fehlerart(msg) });
        else emit({ art: 'schritt', thema: modeLabel(), ok: false });
      } else if (/\bgood\b/.test(fb.className)) emit({ art: 'schritt', thema: modeLabel(), ok: !seen[c.task + '|' + c.q] });
    }, function () {
      var inp = document.getElementById('inp');
      var unit = inp && inp.parentNode ? txt(inp.parentNode.querySelector('span')) : '';
      return { v: inp ? inp.value : '', q: txt(document.querySelector('#stepbox .step .q')), task: txt(document.getElementById('task')).slice(0, 220), u: unit };
    });
    // Falsche Regel oder falsche Auswahl
    var fbWrap = function (cls, msg) {
      if (cls !== 'badf') return;
      var m = String(msg || '').replace(/<[^>]+>/g, '');
      if (!/^Nicht /.test(m)) return;
      var q = txt(document.querySelector('#stepbox .step .q'));
      var task = txt(document.getElementById('task')).slice(0, 220);
      if (once('r|' + task + '|' + q)) emit({ art: 'fehler', thema: modeLabel(), aufgabe: task + ' Schritt: ' + q, eingabe: m.split('.')[0], meldung: m, fehlerart: fehlerart(m) });
    };
    wrap('addFb', function (c, a) { fbWrap(a[0], a[1]); });
    wrap('rfb', function (c, a) { var o = a[0] || {}; fbWrap(o.c, o.t); });
    wrap('finish', function () {
      setTimeout(function () {
        var m = /(\d+) von (\d+) Schritten beim ersten Versuch/.exec(txt(document.getElementById('stepbox')));
        if (m) emit({ art: 'aufgabe', thema: modeLabel(), ok: m[1] === m[2], richtig: +m[1], von: +m[2] });
      }, 0);
    });
    return ok;
  }

  // SolidWorks-Kürzel
  function solidworks() {
    var n = 0, bad = 0;
    return wrap('answer', function (c, a) {
      var o = a[1], q = a[2];
      if (!o || !q) return;
      var ok = o === q;
      n++; if (!ok) bad++;
      emit({ art: 'schritt', thema: 'Kürzel', ok: ok });
      if (!ok && once(q.k + q.a)) emit({ art: 'fehler', thema: 'Kürzel', aufgabe: 'Kürzel für: ' + q.a, eingabe: o.k + ' (' + o.a + ')', richtig: q.k, fehlerart: 'Kürzel verwechselt' });
      if (n % 10 === 0) { emit({ art: 'aufgabe', thema: 'Kürzel', ok: bad <= 1 }); bad = 0; }
    });
  }

  // Mathe trainieren
  function mathe() {
    var strip = function (h) { var d = document.createElement('div'); d.innerHTML = String(h || ''); return txt(d); };
    var a = wrap('doCheck', function (c) {
      if (!c || typeof S === 'undefined' || !S || !S.c || !S.c.fb) return;
      if (S.c.fb.status === 'wrong' && once(c.id + '|' + c.v)) emit({ art: 'fehler', thema: c.topic, aufgabe: c.text, eingabe: c.v, richtig: c.ans, fehlerart: 'Termumformung' });
      else emit({ art: 'schritt', thema: c.topic, ok: S.c.fb.status === 'ok' });
    }, function () {
      try {
        var t = S.q[S.i], inp = document.querySelector('#inp');
        return { id: S.i + '|' + (t.show || ''), topic: t.topic, text: strip(t.show).slice(0, 200), ans: t.ans || '', v: inp ? inp.value : '' };
      } catch (e) { return null; }
    });
    wrap('finish', function () {
      try {
        var by = {};
        (S.res || []).forEach(function (r) { by[r.topic] = by[r.topic] || { r: 0, n: 0 }; by[r.topic].n++; if (r.ok) by[r.topic].r++; });
        Object.keys(by).forEach(function (k) { emit({ art: 'aufgabe', thema: k, ok: by[k].r === by[k].n }); });
      } catch (e) { /* egal */ }
    });
    wrap('xCount', function (c, args) { try { emit({ art: 'aufgabe', thema: X.task.topic, ok: !!args[0] }); } catch (e) { /* egal */ } });
    wrap('prCount', function (c, args) { emit({ art: 'aufgabe', thema: 'bruchplus', ok: !!args[0] }); });
    return a;
  }

  var auto = false;
  if (/^(statik-trainer|et-rueckrechen-trainer|toleranzen-it-ablesen)\.html$/.test(FILE)) auto = stepTrainer();
  else if (FILE === 'solidworks-kuerzel.html') auto = solidworks();
  else if (FILE === 'mathe-trainieren.html') auto = mathe();

  /* ===== Oberfläche: Zurück-Knopf und Sitzung abschließen ===== */
  function css() {
    var d = isDark();
    var fg = d ? '#0A84FF' : '#007AFF', bg = d ? 'rgba(28,28,30,.92)' : 'rgba(255,255,255,.92)', bd = d ? 'rgba(84,84,88,.6)' : 'rgba(60,60,67,.18)', tx = d ? '#fff' : '#000';
    return '#lw-bar{display:flex;align-items:center;justify-content:space-between;gap:8px;max-width:760px;margin:0 auto;padding:6px 12px 2px;font:15px/1.2 -apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;position:relative;z-index:9}' +
      '#lw-bar button{border:0;background:none;color:' + fg + ';font:inherit;font-weight:600;min-height:44px;display:inline-flex;align-items:center;gap:2px;padding:0 6px;cursor:pointer;-webkit-tap-highlight-color:transparent}' +
      '#lw-bar svg{width:22px;height:22px}' +
      '#lw-sheet{position:fixed;inset:0;z-index:2147483000;background:rgba(0,0,0,.35);display:flex;align-items:flex-end;justify-content:center}' +
      '#lw-sheet .in{background:' + bg + ';-webkit-backdrop-filter:blur(20px);backdrop-filter:blur(20px);color:' + tx + ';width:100%;max-width:560px;border-radius:16px 16px 0 0;padding:18px 16px calc(18px + env(safe-area-inset-bottom,0px));border-top:.5px solid ' + bd + ';font:17px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif}' +
      '#lw-sheet h3{margin:0 0 4px;font-size:19px}#lw-sheet p{margin:0 0 14px;opacity:.7;font-size:15px}' +
      '#lw-sheet .b{display:block;width:100%;min-height:50px;border:0;border-radius:12px;margin:0 0 8px;font:600 17px/1 inherit;font-family:inherit;cursor:pointer}' +
      '#lw-sheet .ok{background:#34C759;color:#fff}#lw-sheet .mid{background:#FF9F0A;color:#fff}#lw-sheet .no{background:#FF3B30;color:#fff}#lw-sheet .x{background:none;color:' + fg + '}';
  }
  function back() {
    try {
      if (document.referrer && new URL(document.referrer).origin === location.origin && history.length > 1) { history.back(); return; }
    } catch (e) { /* egal */ }
    location.href = '../index.html';
  }
  function sessionSheet() {
    var s = document.createElement('div');
    s.id = 'lw-sheet';
    s.innerHTML = '<div class="in" role="dialog" aria-modal="true"><h3>Sitzung abschließen</h3><p>Wie sitzt der Stoff?' + (auto ? ' Richtig und Falsch hat Lernwerk schon mitgezählt.' : '') + '</p>' +
      '<button class="b ok" data-v="sitzt">Sitzt</button><button class="b mid" data-v="wackelt">Wackelt</button><button class="b no" data-v="sitztnicht">Sitzt nicht</button><button class="b x" data-v="">Abbrechen</button></div>';
    s.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-v]') : null;
      if (e.target === s || (b && !b.dataset.v)) { s.remove(); return; }
      if (!b) return;
      emit({ art: 'sitzung', thema: modeLabel(), bewertung: b.dataset.v });
      s.remove();
      back();
    });
    document.body.appendChild(s);
  }
  function bar() {
    if (document.getElementById('lw-bar')) return;
    var st = document.createElement('style');
    st.textContent = css();
    document.head.appendChild(st);
    var b = document.createElement('div');
    b.id = 'lw-bar';
    b.innerHTML = '<button type="button" data-lw="back" aria-label="Zurück zu Lernwerk"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 4.5L7.5 12 15 19.5"/></svg>Lernwerk</button>' +
      '<button type="button" data-lw="done">Sitzung abschließen</button>';
    b.addEventListener('click', function (e) {
      var t = e.target.closest ? e.target.closest('[data-lw]') : null;
      if (!t) return;
      if (t.dataset.lw === 'back') back(); else sessionSheet();
    });
    document.body.insertBefore(b, document.body.firstChild);
    if (window.matchMedia) try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () { st.textContent = css(); }); } catch (e) { /* alt */ }
  }
  // Alte Kopfzeilen mit Klausurdaten (Ende September, Anfang Oktober 2026) ausblenden
  function hideExamDates() {
    var cells = document.querySelectorAll('.tb > div');
    for (var i = 0; i < cells.length; i++) {
      var k = cells[i].querySelector('small');
      if (k && /Klassenarbeit|Klausur/i.test(k.textContent)) cells[i].style.display = 'none';
    }
  }
  function ready() { bar(); hideExamDates(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready); else ready();
})();
