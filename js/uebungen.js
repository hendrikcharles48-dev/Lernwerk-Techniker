// Übungsarten: Aufgabe, Umstellen, Auswahl, Reihenfolge, Karten, Begriffe, Verwechslung, Zuordnen, Erklären, Fehlerkarte.
// Aufgerufen über runItem in js/engine.js.
import { esc, fmtNum, markdown, plainText, shuffle, dayStr, dayShort, norm } from './util.js';
import { fml, fmlWith, nameHTML, parseEq, keyOf, calc, checkSolved, checkStep, varNames, speakFml, mathText } from './formula.js';
import { checkNumber, showValue } from './check.js';
import * as st from './store.js';
import { $, $$, icon, row, list, seg, sw, empty, on, push, openSheet, toast, copyText, confirmBox, progress, fachIcon, hinweisTabellenbuch } from './ui.js';
import { speak, stopSpeaking, canSpeak, readAloud, stopReading } from './speech.js';
import { INTERVALS } from './srs.js';
import { prefs } from './db.js';
import * as sk from './skizzen.js';
import { editorHTML, attachEditor } from './mathedit.js';
import { wegSchritte, wegPruefen } from './aufgabe.js';
import { askClaude, claudeFrage, passendeFormeln, aufbauHTML, rich } from './engine.js';

/* ===== Aufgabe mit Zahlen füllen ===== */
const roundStep = (v, s) => Number((Math.round(v / s) * s).toFixed(6));
export function instantiate(a) {
  const vals = {};
  // Feste Werte aus Gegeben-Zeilen, zum Beispiel "R = 220 Ω"
  for (const g of a.gegeben) {
    const re = /([A-Za-zΑ-Ωα-ω][A-Za-z0-9_Α-Ωα-ω]*)\s*=\s*([-−]?\d+(?:[.,]\d+)?)/g;
    let m;
    while ((m = re.exec(g))) vals[keyOf(m[1])] = parseFloat(m[2].replace(',', '.').replace('−', '-'));
  }
  const random = a.variablen.length > 0 && !!a.rechnung;
  if (random) {
    for (let tries = 0; tries < 40; tries++) {
      for (const v of a.variablen) {
        const n = Math.floor((v.bis - v.von) / v.schritt + 1e-9);
        vals[keyOf(v.name)] = roundStep(v.von + Math.floor(Math.random() * (n + 1)) * v.schritt, v.schritt);
      }
      const r = calc(a.rechnung, vals);
      if (r != null && isFinite(r) && r !== 0) break;
    }
  }
  // Nach dem Einsetzen wird aus 10^3 eine echte Hochzahl 10³
  const SUP = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', '-': '⁻', '−': '⁻' };
  const fill = s => String(s || '').replace(/\{([^}]+)\}/g, (m, n) => (keyOf(n.trim()) in vals ? fmtNum(vals[keyOf(n.trim())]) : m))
    .replace(/\^([−-]?\d+)(?![\d,])/g, (m, e) => [...e].map(c => SUP[c]).join(''));
  const steps = a.schritte.map(s => {
    const e = s.ergebnis;
    const o = { was: fill(s.was), einheit: s.einheit, tipp: fill(s.tipp), typ: 'plan' };
    if (!e) return o;
    if (e.typ === 'gleichung') { o.typ = 'gleichung'; o.text = e.text; }
    else if (e.typ === 'ausdruck') { const v = calc(e.text, vals); if (v != null) { o.typ = 'zahl'; o.wert = v; o.rechnung = e.text; } }
    else if (e.typ === 'zahl' && !random) { o.typ = 'zahl'; o.wert = e.zahl; }
    return o;
  });
  let final = null;
  if (random) final = { wert: calc(a.rechnung, vals), einheit: (a.ergebnis && a.ergebnis.einheit) || '', rechnung: a.rechnung };
  else if (a.ergebnis) {
    const w = a.ergebnis.wert;
    const v = w.typ === 'zahl' ? w.zahl : w.typ === 'ausdruck' ? calc(w.text, vals) : null;
    if (v != null) final = { wert: v, einheit: a.ergebnis.einheit || '', rechnung: w.typ === 'ausdruck' ? w.text : null };
  }
  const lastNum = [...steps].reverse().find(s => s.typ === 'zahl');
  if (final && lastNum && Math.abs(lastNum.wert - final.wert) <= 1e-9 * Math.max(1, Math.abs(final.wert))) { if (!final.einheit) final.einheit = lastNum.einheit; final = null; if (!lastNum.einheit && a.ergebnis) lastNum.einheit = a.ergebnis.einheit; }
  if (final && !final.einheit && lastNum) final.einheit = lastNum.einheit;
  const mc = q => q && Object.assign({}, q, { frage: q.frage ? fill(q.frage) : q.frage, richtig: fill(q.richtig), falsch: q.falsch.map(fill) });
  return { text: fill(a.text), gegeben: a.gegeben.map(fill), gesucht: a.gesucht.map(fill), tipps: a.tipps.map(fill), steps, final, vals, random,
    ansatz: mc(a.ansatz), warum: mc(a.warum), kontrolle: mc(a.kontrolle), signal: fill(a.signal || '') };
}

/* ===== Eingabefeld für Formeln mit Tasten ===== */
// Formel-Eingabe mit eigener Tastatur: echter Bruch, Wurzel, Hochzahl, Funktionen
function fmlInput(vars, placeholder) {
  return `<div class="fml-in">${editorHTML(vars, placeholder)}</div>`;
}
function bindFmlInput(root) {
  const host = $('.fml-in .me', root);
  if (!host || host._me) return;
  host._me = true;
  attachEditor(host, $('.fml-in .me-pad', root));
}
// Zahlenfeld mit Taschenrechner-Tasten: Minus, Bruch, Wurzel, Hochzahl, sin, cos, tan
function numInput(unit) {
  return `<div class="fml-in calc-in">${editorHTML([], 'Zahl oder Rechnung', { calc: true, unit })}</div>`;
}

const blindLine = `<div class="ex-ctx"><span class="dot"></span>Gemischt · Das Thema erfährst du nach deiner Wahl</div>`;
const ctxLine = meta => `<div class="ex-ctx"><span class="dot" style="background:${meta.farbe}"></span>${esc(meta.fach)} · ${esc(meta.thema)}</div>`;

export function runAuffrischen(el, item, ctx, meta) {
  const T = st.topic(item.tid);
  const th = st.thema(item.tid);
  const m = T.merksaetze.slice(0, 3), sw2 = T.schnellwege.slice(0, 2);
  el.innerHTML = `<div class="ex-ctx"><span class="dot" style="background:${th ? th.fach.farbe : 'var(--accent)'}"></span>Kurz auffrischen · ${esc(th ? th.thema.name : '')}</div>
    <div class="card"><div class="card-k">Dieses Thema sitzt noch nicht sicher. Lies es einmal laut.</div>${m.map(x => `<div class="merk-line">${rich(x)}</div>`).join('')}${sw2.map(x => `<div class="fb info"><b>Schnellweg.</b> ${rich(x)}</div>`).join('')}${!m.length && !sw2.length && T.bausteine.length ? `<ol>${T.bausteine.map(x => `<li>${rich(x)}</li>`).join('')}</ol>` : ''}</div>
    <div class="btn-col"><button class="btn filled" data-a="ok">${ctx.nextLabel || 'Weiter'}</button></div>`;
  on(el, { ok: () => ctx.onDone('hilfe', { skip: true }) });
}

async function logError(meta, item, x) {
  if (x.fehlerart === 'Schreibweise' || !x.fehlerart) return;
  await st.addError({ fach: meta.fach, thema: meta.thema, tid: item.tid, aufgabe: x.aufgabe, eingabe: x.eingabe, richtig: x.richtig, fehlerart: x.fehlerart, quelle: 'app', notiz: x.meldung || '' });
}

// Die Aufgabe steht als reiner Text da. Gegeben und Gesucht sind eingeklappt: erst selbst herauslesen.
function ggHTML(A, open) {
  if (!A.gegeben.length && !A.gesucht.length) return '';
  return `<details class="disc gg-d"${open ? ' open' : ''}><summary>Gegeben und gesucht</summary><div class="gg">${A.gegeben.length ? `<div><div class="gg-k">Gegeben</div>${A.gegeben.map(g => `<div>${rich(g)}</div>`).join('')}</div>` : ''}${A.gesucht.length ? `<div><div class="gg-k">Gesucht</div>${A.gesucht.map(g => `<div>${rich(g)}</div>`).join('')}</div>` : ''}</div></details>`;
}
export function runAufgabe(el, item, ctx, meta) {
  const A = instantiate(item.aufgabe);
  const topicT = st.topic(item.tid);
  const steps = A.steps.slice();
  if (A.final) steps.push({ was: 'Ergebnis' + (A.gesucht.length ? ': ' + A.gesucht.join(', ') : ''), typ: 'zahl', wert: A.final.wert, einheit: A.final.einheit, rechnung: A.final.rechnung, final: true });
  if (ctx.exam) { runExamAufgabe(el, item, ctx, meta, A, steps); return; }
  // vor: Stand vor dem Beispiel (Ansatz und Weg sind schon beantwortet, das Beispiel zählt als Hilfe)
  const vor = ctx.vor || null;
  let i = 0, tries = 0, used = !!(vor && vor.used), shown = false, first = 0;
  const done = [];
  let tipOpen = false, solOpen = false, fb = null;
  // Ansatz zuerst: erkennen, begründen, am Ende das Ergebnis prüfen
  const T0 = { ansatz: A.ansatz, warum: A.warum, kontrolle: A.kontrolle, signal: A.signal };
  const aufbau = aufbauHTML(passendeFormeln(topicT, item.aufgabe));
  /* Erst der Weg: Bei Aufgaben mit drei oder mehr Schritten legst du zuerst die Reihenfolge fest,
   * wie beim Arbeitsplan an der Fräse. Die App zeigt nur, wo du abbiegst.
   * Schritte, die einander nicht brauchen (zum Beispiel F_x und F_y), dürfen in beliebiger Reihenfolge stehen. */
  const planSchritte = wegSchritte(A.steps);
  const planbar = !ctx.twinOf && !vor && planSchritte.length >= 3;
  let planPool = [], planSeq = [], planCheck = null, planDone = false, planFirst = vor ? vor.plan : null, ggOpen = false;
  const nachAnsatz = () => {
    if (!planbar || planDone) return 'steps';
    planPool = shuffle(planSchritte);
    for (let n = 0; n < 8 && planPool.every((x, k) => x === planSchritte[k]); n++) planPool = shuffle(planSchritte);
    planSeq = []; planCheck = null;
    return 'plan';
  };
  let ansatzFirst = vor ? vor.ansatz : null;
  let phase = vor ? 'steps' : T0.ansatz && !ctx.twinOf ? 'ansatz' : nachAnsatz();
  let opts = null, picked = null, note = '', kontrolleFirst = null;
  // Ansatz und Weg zusammen: Beides beim ersten Mal richtig zählt als „sofort erkannt“
  const ansatzInfo = () => { const a = T0.ansatz ? ansatzFirst : null; return planFirst == null ? a : a == null ? planFirst : a && planFirst; };
  // Rechenweg wie im Buch: Formel, eingesetzte Werte, Ergebnis, jeweils in einer eigenen Zeile
  const rechenweg = s => {
    if (s.typ === 'gleichung') return `<div class="rw-z">${fml(s.text)}</div>`;
    if (s.typ === 'zahl') return (s.rechnung ? `<div class="rw-z">${fml(s.rechnung)}</div><div class="rw-z"><span class="rw-g">=</span>${fmlWith(s.rechnung, A.vals)}</div>` : '') + `<div class="rw-z"><span class="rw-g">=</span><b>${esc(showValue(s.wert, s.einheit))}</b></div>`;
    return `<div class="rw-z muted">Diesen Schritt machst du auf deinem Blatt.</div>`;
  };
  const beispielMoeglich = () => level === 1 && !vor && !ctx.twinOf && A.random && steps.length > 0 && steps.every(x => x.typ === 'zahl');
  const result = () => (shown ? 'falsch' : used ? 'hilfe' : 'richtig');
  // Hilfe wird weniger: geführt mit Schritten und Rechenweg im Tipp, dann nur Schritte, frei nur mit Endergebnis.
  // Der Tipp bleibt immer zu, bis man auf Tipp drückt.
  const target = [...steps].reverse().find(s => s.typ === 'zahl' || s.typ === 'gleichung');
  const level = ctx.twinOf ? 3 : (ctx.level || st.aufgabenStufe(item.tid));
  let mode = level === 3 && target ? 'frei' : 'schritte', freiOk = false;

  function draw() {
    const s = steps[i];
    if (!s && phase === 'steps') phase = T0.kontrolle && !ctx.twinOf ? 'kontrolle' : 'done';
    const hide = ctx.blind && (phase === 'ansatz' || (!T0.ansatz && (phase === 'steps' || phase === 'plan')));
    let h = (hide ? blindLine : ctxLine(meta)) + `<div class="ex-task">${rich(A.text)}</div>`;
    h += ggHTML(A, ggOpen);
    if (done.length) h += `<div class="done-steps">${done.map(d => `<div class="ds"><span class="ds-n">${d.n}</span><span class="ds-t">${rich(d.was)}</span><span class="ds-v">${d.html}</span></div>`).join('')}</div>`;
    if (phase === 'plan') {
      h += note + `<div class="step-box"><div class="step-n">Erst der Weg</div><div class="step-q">In welcher Reihenfolge gehst du vor? Tippe die Schritte der Reihe nach an.</div>
        <div class="seq">${planSeq.map((x, k) => `<button class="seq-i ${planCheck ? (planCheck[k] ? 'ok' : 'no') : ''}" data-a="planZurueck" data-d="${k}"><span class="seq-n">${k + 1}</span><span>${rich(x.was)}</span></button>`).join('') || '<div class="muted">Noch nichts gewählt.</div>'}</div>
        ${planPool.length ? `<div class="pool">${planPool.map((x, k) => `<button class="pool-i" data-a="planWahl" data-d="${k}">${rich(x.was)}</button>`).join('')}</div>` : ''}
        <div class="act">${!planPool.length && !planCheck ? `<button class="btn filled" data-a="planPruefen">Prüfen</button>` : ''}${planCheck ? `<button class="btn filled" data-a="planNeu">Nochmal ordnen</button><button class="btn" data-a="planWeiter">Weiter zum Rechnen</button>` : `<button class="btn" data-a="planWeiter">Überspringen</button>`}</div>${fb || ''}</div>`;
      el.innerHTML = h;
      return;
    }
    if (phase === 'beispiel') {
      h += `<div class="card rweg"><div class="card-k">Beispiel mit diesen Zahlen</div>${steps.map((x, k) => `<div class="rw"><div class="rw-t"><span class="ds-n">${k + 1}</span><span>${rich(x.was)}</span></div>${rechenweg(x)}</div>`).join('')}</div>
        <p class="muted">Frag dich bei jedem Schritt, warum er kommt. Danach rechnest du dieselbe Aufgabe mit neuen Zahlen selbst.</p>
        <div class="btn-col"><button class="btn filled" data-a="selbst">Jetzt selbst, mit neuen Zahlen</button></div>`;
      el.innerHTML = h;
      return;
    }
    if (phase === 'ansatz' || phase === 'warum' || phase === 'kontrolle') {
      const q = mcOf();
      if (!opts) opts = shuffle([q.richtig, ...q.falsch]);
      const head = { ansatz: ['Erst erkennen', 'Welcher Ansatz passt?'], warum: ['Kurz begründen', 'Warum passt dieser Ansatz?'], kontrolle: ['Zum Schluss prüfen', q.frage] }[phase];
      h += note + `<div class="step-box"><div class="step-n">${head[0]}</div><div class="step-q">${rich(head[1])}</div><div class="mc">${opts.map((o, k) => `<button class="mc-o ${picked && picked.has(k) ? (o === q.richtig ? 'ok' : 'no') : ''}" data-a="pick" data-d="${k}">${rich(o)}</button>`).join('')}</div>${fb || ''}</div>`;
      el.innerHTML = h;
      return;
    }
    if (!s) {
      const twin = (used || shown) && A.random;
      h += note + `<div class="fb good"><b>Geschafft.</b> ${freiOk ? (tries ? 'Frei gelöst, im zweiten Anlauf.' : 'Frei gelöst, ohne Zwischenschritte. Stark.') : first + ' von ' + steps.length + ' Schritten beim ersten Versuch richtig.'}${T0.ansatz && !ctx.twinOf && ansatzFirst != null ? (ansatzFirst ? ' Den Ansatz hast du sofort erkannt.' : ' Den Ansatz hast du im zweiten Anlauf gefunden.') : ''}</div>`;
      if (topicT.schnellwege.length) h += `<details class="disc"><summary>${icon('bolt')} Schnellweg für die Prüfung</summary><div class="prose">${topicT.schnellwege.map(x => markdown(x, mathText)).join('')}</div></details>`;
      if (twin) h += `<p class="muted">Jetzt dieselbe Aufgabe mit neuen Zahlen, einmal ganz allein. So setzt sich der Weg fest.</p>`;
      h += `<div class="btn-col">${A.random ? `<button class="btn${twin ? ' filled' : ''}" data-a="again">${twin ? 'Zwillingsaufgabe: neue Zahlen' : 'Neue Zahlen'}</button>` : ''}<button class="btn${twin ? '' : ' filled'}" data-a="fertig">${ctx.nextLabel || 'Fertig'}</button></div>`;
      el.innerHTML = h;
      return;
    }
    if (mode === 'frei') {
      h += note + `<div class="step-box"><div class="step-n">Frei rechnen · nur das Ergebnis</div><div class="step-q">Dein Endergebnis</div>`;
      h += (target.typ === 'zahl' ? numInput(target.einheit) : fmlInput([...varNames(parseEqSafe(target.text)).values()], ''));
      h += `<div class="act"><button class="btn filled" data-a="checkFrei">Prüfen</button><button class="btn" data-a="schritte">Schritte zeigen</button></div>${fb || ''}</div>`;
      el.innerHTML = h;
      bindFmlInput(el);
      const fi = $('.inp', el);
      if (fi) fi.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); checkFrei(); } });
      return;
    }
    if (level === 1 && i === 0 && !done.length) h += `<p class="muted small lvl-hint">Geführt: Kommst du nicht weiter, drück auf Tipp. Dort steht, wie du an den Schritt herangehst.</p>` + (beispielMoeglich() ? `<div class="act bsp-act"><button class="btn small" data-a="beispiel">${icon('book')} Erst ein Beispiel ansehen</button></div>` : '');
    h += note + (level < 3 || used ? aufbau : '') + `<div class="step-box"><div class="step-n">${level === 1 ? 'Geführt · ' : ''}Schritt ${i + 1} von ${steps.length}</div><div class="step-q">${rich(s.was || 'Nächster Schritt')}</div>`;
    if (s.typ === 'gleichung') {
      const names = [...varNames(parseEqSafe(s.text)).values()];
      h += fmlInput(names, 'Gleichung, zum Beispiel ' + (names[0] || 'x') + ' = …');
    } else if (s.typ === 'zahl') h += numInput(s.einheit);
    else h += `<p class="muted">Diesen Schritt prüft die App nicht. Mach ihn auf deinem Blatt und tippe dann auf Erledigt.</p>`;
    h += `<div class="act">${s.typ === 'plan' ? `<button class="btn filled" data-a="plan">Erledigt</button>` : `<button class="btn filled" data-a="check">Prüfen</button>`}
      <button class="btn" data-a="tip">${tipOpen ? 'Tipp zu' : 'Tipp'}</button><button class="btn" data-a="sol">${solOpen ? 'Lösung zu' : 'Lösung'}</button></div>`;
    if (fb) h += fb;
    if (tipOpen) h += `<div class="fb info tipbox"><b>Tipp.</b> ${tipText()}</div>`;
    if (solOpen) h += `<div class="fb info"><b>Lösung.</b><div class="rweg">${rechenweg(s)}</div><div class="btn-row"><button class="btn" data-a="take">Übernehmen und weiter</button></div></div>`;
    h += '</div>';
    el.innerHTML = h;
    bindFmlInput(el);
    const inp = $('.inp', el);
    if (inp) { inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); check(); } }); if (!fb && !tipOpen && !solOpen) setTimeout(() => { try { inp.focus({ preventScroll: true }); } catch (e) { /* alt */ } }, 50); }
  }
  function checkFrei() {
    const inp = $('.inp', el);
    const v = inp ? inp.value : '';
    if (!v.trim()) { fb = `<div class="fb bad">Gib zuerst dein Ergebnis ein.</div>`; draw(); return; }
    let ok, msg = '', fehlerart = '', val = null;
    if (target.typ === 'zahl') { const c = checkNumber(v, target.wert, target.einheit); ok = c.status === 'ok'; msg = c.msg; fehlerart = c.fehlerart; val = c.value; if (c.status !== 'ok' && c.status !== 'wrong') { fb = `<div class="fb bad">${esc(c.msg)}</div>`; draw(); return; } }
    else { const r = checkSolved(target.text, (parseEqSafe(target.text).l || {}).n, target.text, v); ok = r.ok; msg = r.msg; fehlerart = r.fehlerart || 'Umstellen'; }
    if (ok) {
      freiOk = true;
      done.push({ n: '✓', was: 'Ergebnis', html: target.typ === 'zahl' ? esc(showValue(val, target.einheit)) : fml(v) });
      i = steps.length; fb = null; note = '';
      draw();
      return;
    }
    tries++; used = true;
    if (tries === 1) logError(meta, item, { aufgabe: A.text, eingabe: v + (target.typ === 'zahl' && target.einheit ? ' ' + target.einheit : ''), richtig: target.typ === 'zahl' ? showValue(target.wert, target.einheit) : target.text, fehlerart, meldung: msg });
    fb = `<div class="fb bad"><b>Noch nicht.</b> ${esc(msg || 'Das Ergebnis stimmt noch nicht.')} Versuch es noch einmal oder lass dir die Schritte zeigen.</div>`;
    draw();
    const inp2 = $('.inp', el); if (inp2) inp2.value = v;
  }
  function mcOf() { return phase === 'ansatz' ? T0.ansatz : phase === 'warum' ? T0.warum : T0.kontrolle; }
  function pick(k) {
    const q = mcOf(), o = opts[+k];
    picked = picked || new Set();
    picked.add(+k);
    if (o === q.richtig) {
      if (phase === 'ansatz' && ansatzFirst == null) ansatzFirst = true;
      if (phase === 'kontrolle' && kontrolleFirst == null) kontrolleFirst = true;
      note = phase === 'kontrolle' ? `<div class="fb good"><b>Passt.</b> Das Ergebnis ist plausibel.</div>`
        : phase === 'ansatz' ? `<div class="fb good"><b>Richtig erkannt: ${rich(q.richtig)}.</b> ${T0.signal ? rich(T0.signal) : ''}</div>` : `<div class="fb good"><b>Genau.</b> ${rich(q.richtig)}</div>`;
      phase = phase === 'ansatz' && T0.warum ? 'warum' : phase === 'kontrolle' ? 'done' : nachAnsatz();
      opts = null; picked = null; fb = null;
      draw();
      return;
    }
    used = true;
    if (phase === 'ansatz' && ansatzFirst == null) { ansatzFirst = false; logError(meta, item, { aufgabe: A.text, eingabe: 'Ansatz: ' + o, richtig: q.richtig, fehlerart: 'Falscher Ansatz', meldung: T0.signal || '' }); }
    if (phase === 'kontrolle' && kontrolleFirst == null) { kontrolleFirst = false; logError(meta, item, { aufgabe: A.text, eingabe: 'Kontrolle: ' + o, richtig: q.richtig, fehlerart: 'Ergebnis nicht geprüft', meldung: q.frage }); }
    fb = phase === 'ansatz' ? `<div class="fb bad"><b>Passt hier nicht.</b> ${T0.signal ? 'Achte auf das Signal in der Aufgabe: ' + rich(T0.signal) : 'Lies noch einmal, was gegeben ist und was gesucht wird.'}</div>`
      : phase === 'warum' ? `<div class="fb bad"><b>Nicht ganz.</b> Schau, welche Größen gegeben sind und wie sie mit der gesuchten zusammenhängen.</div>`
      : `<div class="fb bad"><b>Noch nicht.</b> Vergleich mit deinem Ergebnis: Stimmen Größenordnung, Einheit und Vorzeichen?</div>`;
    draw();
  }
  function tipText() {
    const cur = steps[i];
    const parts = [];
    // So gehst du heran: erst der Tipp zum Schritt, sonst der Arbeitsplan des Themas
    if (cur && cur.tipp) parts.push('<b>So gehst du heran:</b> ' + rich(cur.tipp));
    else if (topicT.bausteine.length && !A.tipps.length) parts.push('<b>So gehst du heran:</b> ' + rich(topicT.bausteine[Math.min(i, topicT.bausteine.length - 1)]));
    if (A.tipps.length) parts.push(A.tipps.map(rich).join(' '));
    // Die Rechnung mit eingesetzten Zahlen, ausrechnen musst du selbst
    if (cur && cur.rechnung && level < 3) parts.push('<b>Setz ein:</b> ' + fmlWith(cur.rechnung, A.vals));
    if (!parts.length) {
      const f = topicT.formeln.slice(0, 3).map(x => fml(x.formel)).join(', ');
      parts.push(f ? 'Passende Formeln: ' + f : 'Was ist gegeben, was ist gesucht, und welche Regel verbindet beides?');
    }
    return parts.join('<br>');
  }
  // Welcher eingesetzte Wert mit falschem Vorzeichen ergibt genau die Eingabe?
  function signFlip(expr, got) {
    if (got == null || !isFinite(got)) return null;
    for (const [k, x] of Object.entries(A.vals || {})) {
      if (!x) continue;
      const alt = calc(expr, Object.assign({}, A.vals, { [k]: -x }));
      if (alt != null && Math.abs(alt - got) <= 1e-6 * Math.max(1, Math.abs(got)) && Math.abs(calc(expr, A.vals) - alt) > 1e-9) return x;
    }
    return null;
  }
  function solText(s) {
    if (s.typ === 'gleichung') return fml(s.text);
    if (s.typ === 'zahl') return (s.rechnung ? fml(s.rechnung) + ' = ' + fmlWith(s.rechnung, A.vals) + ' = ' : '') + '<b>' + esc(showValue(s.wert, s.einheit)) + '</b>';
    return esc(s.was);
  }
  function accept(html, ok) {
    const s = steps[i];
    done.push({ n: i + 1, was: s.was, html });
    if (ok && tries === 0) first++;
    i++; tries = 0; tipOpen = false; solOpen = false; fb = null;
    if (!/du warst schon weiter/.test(note)) note = '';
    draw();
  }
  function check() {
    const s = steps[i];
    const inp = $('.inp', el);
    const v = inp ? inp.value : '';
    if (!v.trim()) { fb = `<div class="fb bad">Gib zuerst etwas ein.</div>`; draw(); return; }
    let r;
    if (s.typ === 'gleichung') {
      const target = (parseEqSafe(s.text).l || {}).n;
      r = checkSolved(s.text, target, s.text, v);
      if (r.ok) return accept(fml(v), true);
      r = { msg: r.msg, fehlerart: r.fehlerart };
    } else {
      const c = checkNumber(v, s.wert, s.einheit);
      if (c.status === 'ok') return accept(esc(showValue(c.value, s.einheit)) + (c.msg ? ' <span class="muted">' + esc(c.msg) + '</span>' : ''), true);
      // Schon weiter gerechnet? Ein richtiger Wert eines späteren Schritts zählt, die Schritte dazwischen werden ergänzt.
      if (c.status === 'wrong') for (let j = i + 1; j < steps.length; j++) {
        const sj = steps[j];
        if (sj.typ !== 'zahl' || checkNumber(v, sj.wert, sj.einheit).status !== 'ok') continue;
        while (i < j) { done.push({ n: i + 1, was: steps[i].was, html: solText(steps[i]) + ' <span class="muted">(von dir übersprungen)</span>' }); if (tries === 0) first++; i++; }
        note = `<div class="fb good"><b>Richtig, du warst schon weiter.</b> Das ist schon das Ergebnis von „${rich(sj.was)}“. Die Schritte dazwischen habe ich ergänzt.</div>`;
        return accept(esc(showValue(sj.wert, sj.einheit)), true);
      }
      r = { msg: c.msg + (c.status === 'wrong' && steps.length > 1 && i < steps.length - 1 ? ' Gefragt ist hier nur der Zwischenschritt: ' + s.was + '.' : ''), fehlerart: c.fehlerart, empty: c.status !== 'wrong' };
      // Nur ein Vorzeichen vertauscht? Dann genau das sagen. Die Form der Rechnung ist egal, es zählt der Wert.
      const flip = c.status === 'wrong' && s.rechnung ? signFlip(s.rechnung, c.value) : null;
      if (flip != null) r = { msg: `Fast. Deine Rechnung ist richtig aufgebaut, nur ein Vorzeichen stimmt nicht. Überleg bei der ${fmtNum(flip)}, ob sie dazukommt oder abgeht.`, fehlerart: 'Vorzeichen' };
    }
    if (!r.empty) {
      tries++; used = true;
      if (tries === 1) logError(meta, item, { aufgabe: A.text + ' Schritt ' + (i + 1) + ': ' + s.was, eingabe: v + (s.einheit && s.typ === 'zahl' ? ' ' + s.einheit : ''), richtig: s.typ === 'zahl' ? showValue(s.wert, s.einheit) : s.text, fehlerart: r.fehlerart, meldung: r.msg });
    }
    const q = claudeFrage({ fach: meta.fach, thema: meta.thema, aufgabe: A.text, eingabe: v, schritt: i + 1, was: s.was, meldung: r.msg });
    fb = `<div class="fb bad"><b>${r.empty ? 'Hm.' : 'Noch nicht.'}</b> ${esc(r.msg)}${r.empty ? '' : `<div class="btn-row"><button class="btn small" data-a="claude" data-d="${esc(q)}">${icon('claude')} Frag Claude</button></div>`}</div>`;
    draw();
    const inp2 = $('.inp', el); if (inp2) inp2.value = v;
  }
  el.addEventListener('toggle', e => { if (e.target.classList && e.target.classList.contains('gg-d')) ggOpen = e.target.open; }, true);
  on(el, {
    planWahl: k => { planCheck = null; fb = null; planSeq.push(planPool.splice(+k, 1)[0]); draw(); },
    planZurueck: k => { planCheck = null; fb = null; planPool.push(planSeq.splice(+k, 1)[0]); draw(); },
    planPruefen: () => {
      // Ein Schritt steht falsch, wenn er vor einem Schritt steht, den er braucht
      planCheck = wegPruefen(planSeq);
      const ok = planCheck.every(Boolean);
      if (planFirst == null) planFirst = ok;
      if (ok) { planDone = true; planCheck = null; fb = null; phase = 'steps'; note = `<div class="fb good"><b>Dein Weg stimmt.</b> Jetzt rechnest du ihn.</div>`; }
      else fb = `<div class="fb bad"><b>Hier biegst du ab.</b> Ein rot markierter Schritt braucht etwas, das bei dir erst später kommt. Überleg bei jedem Schritt, was du dafür schon haben musst.</div>`;
      draw();
    },
    planNeu: () => { planPool = shuffle(planSeq.concat(planPool)); planSeq = []; planCheck = null; fb = null; draw(); },
    planWeiter: () => { planDone = true; planCheck = null; fb = null; note = ''; phase = 'steps'; draw(); },
    beispiel: () => { phase = 'beispiel'; ggOpen = true; fb = null; draw(); },
    selbst: () => { const f = el.cloneNode(false); el.replaceWith(f); runAufgabe(f, item, Object.assign({}, ctx, { vor: { ansatz: ansatzFirst, plan: planFirst, used: true } }), meta); },
    check, pick, checkFrei, plan: () => accept('erledigt', true),
    schritte: () => { mode = 'schritte'; used = true; fb = null; draw(); },
    tip: () => { tipOpen = !tipOpen; if (tipOpen) used = true; draw(); if (tipOpen) { const tb = $('.tipbox', el); if (tb) tb.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } },
    sol: () => { solOpen = !solOpen; draw(); },
    take: () => { shown = true; const s = steps[i]; accept(solText(s) + ' <span class="muted">(Lösung angesehen)</span>', false); },
    claude: d => askClaude(d),
    // Zwillingsaufgabe: Für die Wiederholung zählt der erste Durchgang
    again: () => { const f = el.cloneNode(false); el.replaceWith(f); runAufgabe(f, item, Object.assign({}, ctx, { twinOf: ctx.twinOf || result(), ansatzOf: ctx.twinOf ? ctx.ansatzOf : ansatzInfo() }), meta); },
    fertig: () => ctx.onDone(ctx.twinOf || result(), { first, total: steps.length, ansatz: ctx.twinOf ? ctx.ansatzOf : ansatzInfo() })
  });
  draw();
}
const parseEqSafe = s => { try { return parseEq(s); } catch (e) { return { l: null, r: null }; } };

function runExamAufgabe(el, item, ctx, meta, A, steps) {
  const target = [...steps].reverse().find(s => s.typ === 'zahl' || s.typ === 'gleichung');
  let h = (ctx.blind ? blindLine.replace('Das Thema erfährst du nach deiner Wahl', 'Probeklausur ohne Themenhinweis') : ctxLine(meta)) + `<div class="ex-task">${rich(A.text)}</div>`;
  h += ggHTML(A, false);
  if (!target) { el.innerHTML = h + `<div class="btn-col"><button class="btn filled" data-a="next">Weiter</button></div>`; on(el, { next: () => ctx.onDone('hilfe', { skip: true }) }); return; }
  h += `<div class="step-box"><div class="step-q">Dein Endergebnis</div>${target.typ === 'zahl' ? numInput(target.einheit) : fmlInput([...varNames(parseEqSafe(target.text)).values()], '')}<div class="act"><button class="btn filled" data-a="next">Abgeben und weiter</button></div></div>`;
  el.innerHTML = h;
  bindFmlInput(el);
  on(el, {
    next: () => {
      const v = $('.inp', el).value;
      let ok, msg = '', fehlerart = '';
      if (target.typ === 'zahl') { const c = checkNumber(v, target.wert, target.einheit); ok = c.status === 'ok'; msg = c.msg; fehlerart = c.fehlerart || (v.trim() ? 'Rechenweg' : 'Nicht bearbeitet'); }
      else { const r = checkSolved(target.text, (parseEqSafe(target.text).l || {}).n, target.text, v); ok = r.ok; msg = r.msg; fehlerart = r.fehlerart || 'Umstellen'; }
      const richtig = target.typ === 'zahl' ? showValue(target.wert, target.einheit) : target.text;
      if (!ok) logError(meta, item, { aufgabe: A.text, eingabe: v || '(leer)', richtig, fehlerart, meldung: msg });
      ctx.onDone(ok ? 'richtig' : 'falsch', { eingabe: v, richtig, msg, aufgabe: A.text, fehlerart: ok ? '' : fehlerart });
    }
  });
}

export function runUmstellen(el, item, ctx, meta) {
  const U = item.u;
  const names = [...varNames(parseEq(U.formel)).values()];
  const pool = shuffle(['Beide Seiten durch ' + names[1] + ' teilen', 'Beide Seiten mal ' + names[0] + ' nehmen', 'Auf beiden Seiten ' + names[names.length - 1] + ' abziehen', 'Die Wurzel ziehen', 'Beide Seiten quadrieren']);
  const steps = ctx.exam ? [] : U.umformungen.map(f => ({ op: f.operation, gl: f.gleichung, opts: shuffle([f.operation, ...(f.falsch.length ? f.falsch : pool.filter(p => p !== f.operation).slice(0, 3))]) }));
  // Frei umstellen: Zeile für Zeile selbst schreiben, die App prüft jede Zeile. Die Wahl bleibt (kv umstellFrei).
  let i = 0, phase = steps.length && !st.kvGet('umstellFrei', false) ? 'op' : 'final', tries = 0, used = false, shown = false, fb = null, tipOpen = false, solOpen = false, picked = null;
  let letzte = U.formel;
  // Falsch gewählte Umformungen bleiben rot markiert, bis der Schritt geschafft ist
  const falscheOps = new Set();
  const zaehl = (n, T) => (!n ? 0 : (n.t === 'var' && keyOf(n.n) === T ? 1 : 0) + zaehl(n.a, T) + zaehl(n.b, T));
  const summe = n => { n = n && n.t === 'par' ? n.a : n; return !!n && (n.t === 'add' || n.t === 'sub'); };
  // Hinweis zu einer falschen Zeile: nur sagen, wo es abbiegt, nicht vorrechnen
  function freiHinweis(v, r, z) {
    if (z.fehlerart === 'Schreibweise') return z;
    const T = keyOf(U.nach), a = parseEqSafe(letzte), b = parseEqSafe(v);
    const nVor = zaehl(a.l, T) + zaehl(a.r, T), nNach = zaehl(b.l, T) + zaehl(b.r, T);
    if (nVor >= 2 && nNach === 1) return { msg: U.nach + ' stand in deiner letzten Zeile ' + nVor + ' mal. Teilen hilft erst, wenn ' + U.nach + ' nur noch einmal vorkommt. Erst alle Teile mit ' + U.nach + ' auf eine Seite sammeln, dann ausklammern, dann teilen.', fehlerart: 'Gesuchte Größe steht mehrfach' };
    if (r.fehlerart && !['Nicht freigestellt', 'Umstellen', 'Schreibweise'].includes(r.fehlerart)) return r;
    // Stand auf einer Seite eine Summe und steht sie dort immer noch ohne Klammer? Dann wurde oft nur ein Teil geteilt.
    const klammer = ['l', 'r'].some(k => summe(a[k]) && summe(b[k]));
    return { msg: (z.msg || r.msg) + (klammer ? ' Falls du geteilt oder malgenommen hast: Gemeint ist die ganze Seite, die Summe braucht dann eine Klammer.' : ''), fehlerart: z.fehlerart || r.fehlerart || 'Umstellen' };
  }
  const done = [];
  const prompt = `Stell ${fml(U.formel)} nach ${nameHTML(U.nach)} um.`;
  function draw() {
    let h = ctxLine(meta) + `<div class="ex-task">${prompt}</div>`;
    if (U.name) h += `<div class="muted small">${esc(U.name)}</div>`;
    h += `<div class="done-steps"><div class="ds"><span class="ds-n">0</span><span class="ds-t">Ausgangsformel</span><span class="ds-v">${fml(U.formel)}</span></div>${done.map((d, k) => `<div class="ds"><span class="ds-n">${k + 1}</span><span class="ds-t">${esc(d.op)}</span><span class="ds-v">${d.html}</span></div>`).join('')}</div>`;
    if (phase === 'end') {
      h += `<div class="fb good"><b>Richtig umgestellt.</b> ${fml(U.loesung)}</div>`;
      h += `<div class="btn-col"><button class="btn" data-a="probe">${icon('formula')} Mit Zahlen üben</button><button class="btn filled" data-a="fertig">${ctx.nextLabel || 'Fertig'}</button></div>`;
      el.innerHTML = h; return;
    }
    if (phase === 'probe') { el.innerHTML = h; probe(el, U, meta, item, () => ctx.onDone(shown ? 'falsch' : used ? 'hilfe' : 'richtig'), ctx.nextLabel); return; }
    h += '<div class="step-box">';
    if (phase === 'op') {
      const s = steps[i];
      h += `<div class="step-n">Schritt ${i + 1} von ${steps.length}</div><div class="step-q">Was machst du als Nächstes?</div><div class="mc">${s.opts.map(o => `<button class="mc-o ${picked && picked.o === o ? (picked.ok ? 'ok' : 'no') : falscheOps.has(o) ? 'no' : ''}" data-a="op" data-d="${esc(o)}">${esc(o)}</button>`).join('')}</div>${i === 0 && !done.length ? `<div class="act"><button class="btn small" data-a="frei">Lieber frei umstellen</button></div>` : ''}`;
    } else if (phase === 'eq') {
      h += `<div class="step-n">Schritt ${i + 1} von ${steps.length}</div><div class="step-q">${esc(steps[i].op)}. Schreib die neue Zeile auf.</div>` + fmlInput(names, 'Ganze Gleichung mit =') + `<div class="act"><button class="btn filled" data-a="check">Prüfen</button><button class="btn" data-a="tip">Tipp</button><button class="btn" data-a="sol">Lösung</button></div>`;
    } else {
      h += (ctx.exam ? `<div class="step-q">Deine Umstellung</div>` : `<div class="step-n">Frei umstellen</div><div class="step-q">Schreib deine nächste Zeile. Jede Zeile wird geprüft. Fertig bist du, wenn ${nameHTML(U.nach)} allein steht.</div>`) + fmlInput(names, ctx.exam ? U.nach + ' = …' : 'Ganze Gleichung mit =') + `<div class="act"><button class="btn filled" data-a="check">${ctx.exam ? 'Abgeben und weiter' : 'Prüfen'}</button>${ctx.exam ? '' : '<button class="btn" data-a="tip">Tipp</button><button class="btn" data-a="sol">Lösung</button>'}${!ctx.exam && steps.length && !done.length ? '<button class="btn" data-a="gefuehrt">Mit Schritten führen</button>' : ''}</div>`;
    }
    if (fb) h += fb;
    if (tipOpen) h += `<div class="fb info"><b>Tipp.</b> ${U.tipps.length ? U.tipps.map(rich).join(' ') : 'Schau, was an ' + esc(U.nach) + ' dranhängt. Was am weitesten außen steht, kommt zuerst weg. Jede Rechenart wird durch ihr Gegenstück aufgehoben.'}</div>`;
    if (solOpen) h += `<div class="fb info"><b>Lösung.</b> ${phase === 'eq' ? fml(steps[i].gl) : fml(U.loesung)}<div class="btn-row"><button class="btn" data-a="take">Übernehmen und weiter</button></div></div>`;
    h += '</div>';
    el.innerHTML = h;
    bindFmlInput(el);
    const inp = $('.inp', el);
    if (inp) inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); check(); } });
  }
  function next() {
    tries = 0; fb = null; tipOpen = false; solOpen = false; picked = null; falscheOps.clear();
    if (phase === 'op') phase = 'eq';
    else if (phase === 'eq') { i++; phase = i < steps.length ? 'op' : 'final'; }
    else phase = 'end';
    draw();
  }
  function fail(r, v) {
    tries++; used = true;
    if (tries === 1) logError(meta, item, { aufgabe: 'Stell ' + U.formel + ' nach ' + U.nach + ' um.' + (phase === 'eq' ? ' Schritt: ' + steps[i].op : ''), eingabe: v, richtig: phase === 'eq' ? steps[i].gl : U.loesung, fehlerart: r.fehlerart || 'Umstellen', meldung: r.msg });
    const q = claudeFrage({ fach: meta.fach, thema: meta.thema, aufgabe: 'Stell ' + U.formel + ' nach ' + U.nach + ' um', eingabe: v, schritt: phase === 'final' ? steps.length + 1 : i + 1, was: phase === 'eq' ? steps[i].op : 'freistellen', meldung: r.msg });
    fb = `<div class="fb bad"><b>Noch nicht.</b> ${esc(r.msg)}<div class="btn-row"><button class="btn small" data-a="claude" data-d="${esc(q)}">${icon('claude')} Frag Claude</button></div></div>`;
    draw();
    const inp = $('.inp', el); if (inp) inp.value = v;
  }
  function check() {
    const inp = $('.inp', el);
    const v = inp ? inp.value : '';
    if (!v.trim()) { fb = `<div class="fb bad">Gib zuerst etwas ein.</div>`; draw(); return; }
    if (ctx.exam) {
      const r = checkSolved(U.formel, U.nach, U.loesung, v);
      if (!r.ok) logError(meta, item, { aufgabe: 'Stell ' + U.formel + ' nach ' + U.nach + ' um.', eingabe: v, richtig: U.loesung, fehlerart: r.fehlerart || 'Umstellen', meldung: r.msg });
      ctx.onDone(r.ok ? 'richtig' : 'falsch', { eingabe: v, richtig: U.loesung, msg: r.msg, aufgabe: 'Stell ' + U.formel + ' nach ' + U.nach + ' um.' });
      return;
    }
    if (phase === 'eq') {
      const r = checkStep(U.formel, U.nach, U.loesung, v);
      if (!r.ok) return fail(r, v);
      done.push({ op: steps[i].op, html: fml(v) }); letzte = v;
      // Steht die gesuchte Größe schon allein? Dann ist die Umstellung fertig.
      if (i === steps.length - 1 && checkSolved(U.formel, U.nach, U.loesung, v).ok) { i++; phase = 'final'; return next(); }
      return next();
    }
    const r = checkSolved(U.formel, U.nach, U.loesung, v);
    if (!r.ok) {
      // Noch nicht freigestellt, aber eine richtige Zeile: Sie zählt als dein nächster Schritt
      const z = checkStep(U.formel, U.nach, U.loesung, v);
      if (z.ok) { done.push({ op: 'Deine Zeile', html: fml(v) }); letzte = v; tries = 0; fb = null; tipOpen = false; solOpen = false; return draw(); }
      return fail(freiHinweis(v, r, z), v);
    }
    done.push({ op: 'Freigestellt', html: fml(v) });
    next();
  }
  on(el, {
    op: o => {
      const s = steps[i];
      if (o === s.op) { if (tries === 0 && !picked) { /* erster Versuch */ } picked = { o, ok: true }; draw(); setTimeout(next, 350); }
      else { tries++; used = true; picked = { o, ok: false }; falscheOps.add(o); fb = `<div class="fb bad"><b>Das bringt dich nicht weiter.</b> Schau, was an ${esc(U.nach)} dranhängt und was davon am weitesten außen steht.</div>`; if (tries === 1) logError(meta, item, { aufgabe: 'Stell ' + U.formel + ' nach ' + U.nach + ' um. Welche Umformung?', eingabe: o, richtig: s.op, fehlerart: 'Falsche Umformung gewählt' }); draw(); }
    },
    frei: async () => { await st.kvSet('umstellFrei', true); phase = 'final'; picked = null; fb = null; tries = 0; draw(); },
    gefuehrt: async () => { await st.kvSet('umstellFrei', false); phase = 'op'; i = 0; fb = null; tries = 0; draw(); },
    check, tip: () => { tipOpen = !tipOpen; used = true; draw(); }, sol: () => { solOpen = !solOpen; draw(); },
    take: () => { shown = true; if (phase === 'eq') { done.push({ op: steps[i].op, html: fml(steps[i].gl) + ' <span class="muted">(angesehen)</span>' }); } else done.push({ op: 'Freigestellt', html: fml(U.loesung) + ' <span class="muted">(angesehen)</span>' }); next(); },
    claude: d => askClaude(d),
    probe: () => { phase = 'probe'; draw(); },
    fertig: () => ctx.onDone(shown ? 'falsch' : used ? 'hilfe' : 'richtig')
  });
  draw();
}
// Probe mit Zahlen: Ich rechne, die App prüft
function probe(el, U, meta, item, finish, nextLabel) {
  const f = parseEq(U.formel);
  const names = [...varNames(f).values()].filter(n => keyOf(n) !== keyOf(U.nach));
  let vals, t;
  for (let k = 0; k < 50; k++) {
    vals = {};
    for (const n of names) vals[keyOf(n)] = 2 + Math.floor(Math.random() * 19);
    t = calc(U.loesung, vals);
    if (t != null && isFinite(t) && t > 0) break;
  }
  const box = document.createElement('div');
  box.className = 'step-box';
  let fb = '';
  const draw = () => {
    box.innerHTML = `<div class="step-q">Rechne mit Zahlen: ${names.map(n => nameHTML(n) + ' = ' + fmtNum(vals[keyOf(n)])).join(', ')}. Wie groß ist ${nameHTML(U.nach)}?</div>${numInput('')}<div class="act"><button class="btn filled" data-a="pcheck">Prüfen</button><button class="btn" data-a="pskip">${nextLabel || 'Fertig'}</button></div>${fb}`;
    bindFmlInput(box);
  };
  draw();
  el.appendChild(box);
  on(box, {
    pcheck: () => {
      const v = $('.inp', box).value;
      const c = checkNumber(v, t, '');
      if (c.status === 'ok') { fb = `<div class="fb good"><b>Stimmt.</b> ${nameHTML(U.nach)} = ${esc(fmtNum(t))}</div>`; draw(); $('[data-a="pskip"]', box).classList.add('filled'); return; }
      if (c.status === 'wrong') logError(meta, item, { aufgabe: 'Probe zu ' + U.formel + ' mit ' + names.map(n => n + ' = ' + fmtNum(vals[keyOf(n)])).join(', '), eingabe: v, richtig: fmtNum(t), fehlerart: c.fehlerart, meldung: c.msg });
      fb = `<div class="fb bad">${esc(c.msg)}</div>`; draw(); $('.inp', box).value = v;
    },
    pskip: finish
  });
}

export function runAuswahl(el, item, ctx, meta) {
  const A = item.a;
  const opts = shuffle([A.richtig, ...A.falsch]);
  let tries = 0, solved = false, shown = false, picked = new Set();
  function draw() {
    el.innerHTML = ctxLine(meta) + `<div class="ex-task">${rich(A.frage)}</div><div class="mc">${opts.map(o => `<button class="mc-o ${picked.has(o) ? (o === A.richtig ? 'ok' : 'no') : solved && o === A.richtig ? 'ok' : ''}" data-a="pick" data-d="${esc(o)}">${rich(o)}</button>`).join('')}</div>
      ${solved && A.erklaerung ? `<div class="fb info"><b>Darum.</b> ${rich(A.erklaerung)}</div>` : ''}
      ${solved ? `<div class="btn-col"><button class="btn filled" data-a="fertig">${ctx.nextLabel || 'Weiter'}</button></div>` : ctx.exam ? '' : `<div class="act"><button class="btn" data-a="sol">Lösung zeigen</button></div>`}`;
  }
  on(el, {
    pick: o => {
      if (solved) return;
      picked.add(o);
      if (ctx.exam) { if (o !== A.richtig) logError(meta, item, { aufgabe: A.frage, eingabe: o, richtig: A.richtig, fehlerart: 'Falsche Auswahl' }); ctx.onDone(o === A.richtig ? 'richtig' : 'falsch', { eingabe: o, richtig: A.richtig, aufgabe: A.frage }); return; }
      if (o === A.richtig) solved = true;
      else { tries++; if (tries === 1) logError(meta, item, { aufgabe: A.frage, eingabe: o, richtig: A.richtig, fehlerart: 'Falsche Auswahl' }); }
      draw();
    },
    sol: () => { shown = true; solved = true; draw(); },
    fertig: () => ctx.onDone(shown ? 'falsch' : tries ? 'hilfe' : 'richtig')
  });
  draw();
}

export function runReihenfolge(el, item, ctx, meta) {
  const R = item.r;
  let pool = shuffle(R.schritte.map((s, k) => ({ s, k })));
  while (pool.length > 1 && pool.every((p, k) => p.k === k)) pool = shuffle(pool);
  let seq = [], tries = 0, checked = null, solved = false, shown = false;
  function draw() {
    let h = ctxLine(meta) + `<div class="ex-task">Bring in die richtige Reihenfolge: ${esc(R.titel)}</div>`;
    h += `<div class="seq">${seq.map((p, k) => `<button class="seq-i ${checked ? (checked[k] ? 'ok' : 'no') : ''}" data-a="unpick" data-d="${k}"><span class="seq-n">${k + 1}</span>${esc(p.s)}</button>`).join('') || '<div class="muted">Tippe die Schritte unten in der richtigen Reihenfolge an.</div>'}</div>`;
    if (!solved) h += `<div class="pool">${pool.map((p, k) => `<button class="pool-i" data-a="pick" data-d="${k}">${esc(p.s)}</button>`).join('')}</div>`;
    if (solved) h += `<div class="fb good"><b>Richtige Reihenfolge.</b></div><div class="btn-col"><button class="btn filled" data-a="fertig">${ctx.nextLabel || 'Weiter'}</button></div>`;
    else if (!pool.length) h += `<div class="act"><button class="btn filled" data-a="check">${ctx.exam ? 'Abgeben und weiter' : 'Prüfen'}</button>${ctx.exam ? '' : '<button class="btn" data-a="sol">Lösung</button>'}</div>`;
    else if (!ctx.exam) h += `<div class="act"><button class="btn" data-a="sol">Lösung</button></div>`;
    el.innerHTML = h;
  }
  on(el, {
    pick: k => { checked = null; seq.push(pool.splice(+k, 1)[0]); draw(); },
    unpick: k => { if (solved) return; checked = null; pool.push(seq.splice(+k, 1)[0]); draw(); },
    check: () => {
      checked = seq.map((p, k) => p.k === k);
      const ok = checked.every(Boolean);
      if (ctx.exam) { if (!ok) logError(meta, item, { aufgabe: 'Reihenfolge: ' + R.titel, eingabe: seq.map(p => p.s).join(', '), richtig: R.schritte.join(', '), fehlerart: 'Reihenfolge' }); ctx.onDone(ok ? 'richtig' : 'falsch', { aufgabe: R.titel, eingabe: seq.map(p => p.s).join(', '), richtig: R.schritte.join(', ') }); return; }
      if (ok) solved = true;
      else { tries++; if (tries === 1) logError(meta, item, { aufgabe: 'Reihenfolge: ' + R.titel, eingabe: seq.map(p => p.s).join(', '), richtig: R.schritte.join(', '), fehlerart: 'Reihenfolge' }); }
      draw();
    },
    sol: () => { shown = true; solved = true; seq = R.schritte.map((s, k) => ({ s, k })); pool = []; checked = seq.map(() => true); draw(); },
    fertig: () => ctx.onDone(shown ? 'falsch' : tries ? 'hilfe' : 'richtig')
  });
  draw();
}

function rateButtons() {
  return `<div class="rate"><button class="btn rate-no" data-a="rate" data-d="falsch">Nicht gewusst</button><button class="btn rate-mid" data-a="rate" data-d="hilfe">Mit Mühe</button><button class="btn rate-ok" data-a="rate" data-d="richtig">Gewusst</button></div>`;
}
// Karte als Auswahl: die richtige Antwort unter Antworten anderer Karten desselben Themas finden.
// Gibt es zu wenige andere Antworten, oder willst du lieber aufdecken, wird es eine Klappkarte.
// Falsche Antworten, die nicht sofort auffallen: gleiche Art (Begriff zu Begriff, Karte zu Karte),
// gleiche Form (Formel zu Formel, Satz zu Satz) und ähnlich lang. Reicht das Thema nicht, kommen
// passende Antworten aus anderen Themen desselben Fachs dazu.
function falscheAntworten(item, n = 3) {
  // Satz oder Formel: Ein Satz hat mindestens drei Wörter mit drei Buchstaben
  const satz = t => (String(t).match(/[A-Za-zÄÖÜäöüß]{3,}/g) || []).length >= 3;
  const form = satz(item.antwort), richtig = norm(item.antwort);
  const passt = i => (i.art === 'karte' || i.art === 'begriff') && i.antwort && i.frage !== item.frage && norm(i.antwort) !== richtig && satz(i.antwort) === form;
  const th = st.thema(item.tid);
  const hier = st.topicItems(item.tid).filter(passt);
  const fach = th ? th.fach.themen.filter(t => t.id !== item.tid).flatMap(t => st.topicItems(t.id)).filter(passt) : [];
  const L = item.antwort.length;
  const naehe = a => Math.abs(a.length - L) / Math.max(L, 20);
  // Erst gleiche Art im Thema, dann andere Art im Thema, dann gleiche Art im Fach
  const stufen = [hier.filter(i => i.art === item.art), hier.filter(i => i.art !== item.art), fach.filter(i => i.art === item.art)];
  const out = [];
  for (const g of stufen) {
    const kand = [...new Set(g.map(i => i.antwort))].filter(a => !out.includes(a) && naehe(a) < 1.2).sort((a, b) => naehe(a) - naehe(b));
    out.push(...shuffle(kand.slice(0, n + 2)).slice(0, n - out.length));
    if (out.length >= n) break;
  }
  return out;
}
export function runKarte(el, item, ctx, meta, pool) {
  const andere = pool || falscheAntworten(item);
  const kannAuswahl = andere.length >= 3 && !ctx.exam;
  if (!kannAuswahl || st.kartenArt() !== 'auswahl') return runKarteFlip(el, item, ctx, meta, kannAuswahl ? () => runKarte(el, item, ctx, meta, pool) : null);
  const L = item.antwort.length;
  const falsch = pool ? shuffle(andere.sort((a, b) => Math.abs(a.length - L) - Math.abs(b.length - L)).slice(0, 6)).slice(0, 3) : andere;
  const opts = shuffle([item.antwort, ...falsch]);
  const show = o => (looksLikeFormula(o) ? fml(o) : rich(o));
  let tries = 0, solved = false;
  const picked = new Set();
  function draw() {
    el.innerHTML = ctxLine(meta) + `<div class="ex-task">${rich(item.frage)}</div><div class="mc">${opts.map((o, k) => `<button class="mc-o ${picked.has(k) ? (o === item.antwort ? 'ok' : 'no') : solved && o === item.antwort ? 'ok' : ''}" data-a="pick" data-d="${k}">${show(o)}</button>`).join('')}</div>
      ${solved ? `<div class="btn-col"><button class="btn filled" data-a="fertig">${ctx.nextLabel || 'Weiter'}</button></div>` : `<div class="act"><button class="btn" data-a="flip">Lieber aufdecken</button></div>`}`;
  }
  on(el, {
    pick: k => {
      if (solved) return;
      picked.add(+k);
      if (opts[+k] === item.antwort) solved = true;
      else { tries++; if (tries === 1 && item.art !== 'begriff') logError(meta, item, { aufgabe: item.frage, eingabe: opts[+k], richtig: item.antwort, fehlerart: 'Fachbegriff verwechselt' }); }
      draw();
    },
    // Die Wahl gilt ab jetzt für alle Karten
    flip: async () => { await st.setKartenArt('aufdecken'); toast('Ab jetzt deckst du Karten auf. Erst selbst antworten, dann bewerten.'); runKarteFlip(el, item, ctx, meta, () => runKarte(el, item, ctx, meta, pool)); },
    fertig: () => ctx.onDone(tries === 0 ? 'richtig' : tries === 1 ? 'hilfe' : 'falsch')
  });
  draw();
}
export // Begriffe kommen abwechselnd umgedreht: Erklärung lesen, Begriff finden
function runBegriff(el, item, ctx, meta) {
  const c = st.card(item.id);
  const rund = c ? c.richtig + c.hilfe + c.falsch : 0;
  if (ctx.exam || rund % 2 === 0) return runKarte(el, item, ctx, meta);
  const namen = [...new Set(st.topicItems(item.tid).filter(i => i.art === 'begriff' && norm(i.begriff) !== norm(item.begriff)).map(i => i.begriff))];
  const rev = Object.assign({}, item, { frage: 'Wie heißt der Begriff? ' + item.antwort, antwort: item.begriff });
  runKarte(el, rev, ctx, meta, namen);
}
export // Verwechslung: Was unterscheidet A von B? Oder: Zu welchem Begriff passt die Aussage?
function runVerwechslung(el, item, ctx, meta) {
  const V = item.v, T = st.topic(item.tid);
  const erk = n => (T.begriffe.find(b => norm(b.begriff) === norm(n)) || {}).erklaerung;
  const aussagen = [[V.a, erk(V.a)], [V.b, erk(V.b)]].filter(x => x[1]);
  const c = st.card(item.id);
  const rund = c ? c.richtig + c.hilfe + c.falsch : 0;
  if (!aussagen.length || rund % 2 === 0) {
    let open = false;
    const draw = () => {
      el.innerHTML = ctxLine(meta) + `<div class="card-k">Nicht verwechseln</div><button class="flash ${open ? 'open' : ''}" data-a="flip"><div class="flash-q">Was unterscheidet ${rich(V.a)} von ${rich(V.b)}?</div>${open ? `<div class="flash-a">${rich(V.unterschied)}</div>` : '<div class="flash-hint">Erst selbst sagen, dann antippen</div>'}</button>${open ? rateButtons() : ''}`;
    };
    on(el, { flip: () => { open = true; draw(); }, rate: d => ctx.onDone(d) });
    return draw();
  }
  const [ziel, aussage] = aussagen[Math.floor(Math.random() * aussagen.length)];
  let gewaehlt = null;
  const draw = () => {
    const ok = gewaehlt != null && norm(gewaehlt) === norm(ziel);
    el.innerHTML = ctxLine(meta) + `<div class="card-k">Nicht verwechseln</div><div class="ex-task">Zu welchem Begriff passt diese Aussage?</div><div class="card"><p>${rich(aussage)}</p></div>
      <div class="mc">${[V.a, V.b].map(o => `<button class="mc-o ${gewaehlt === o ? (ok ? 'ok' : 'no') : gewaehlt != null && norm(o) === norm(ziel) ? 'ok' : ''}" data-a="pick" data-d="${esc(o)}">${rich(o)}</button>`).join('')}</div>
      ${gewaehlt != null ? `<div class="fb ${ok ? 'good' : 'info'}"><b>${ok ? 'Richtig.' : 'Das war ' + esc(ziel) + '.'}</b> ${rich(V.unterschied)}</div><div class="btn-col"><button class="btn filled" data-a="fertig">${ctx.nextLabel || 'Weiter'}</button></div>` : ''}`;
  };
  on(el, {
    pick: o => { if (gewaehlt != null) return; gewaehlt = o; if (norm(o) !== norm(ziel)) logError(meta, item, { aufgabe: 'Verwechslung: ' + V.a + ' oder ' + V.b, eingabe: o, richtig: ziel, fehlerart: 'Fachbegriff verwechselt' }); draw(); },
    fertig: () => ctx.onDone(norm(gewaehlt) === norm(ziel) ? 'richtig' : 'falsch')
  });
  draw();
}
export // Zuordnen: links Begriffe, rechts Bedeutungen. Erst Begriff, dann Bedeutung antippen.
function runZuordnen(el, item, ctx, meta) {
  const Z = item.z;
  const paare = shuffle(Z.paare.map((p, k) => Object.assign({ k }, p))).slice(0, 5);
  const rechts = shuffle(paare.slice());
  const fertigSet = new Set();
  let wahl = null, fehler = 0, falschK = null;
  function draw() {
    const done = fertigSet.size === paare.length;
    el.innerHTML = ctxLine(meta) + `<div class="ex-task">Ordne zu: ${rich(Z.titel)}</div><div class="zuo">
      <div class="zuo-col">${paare.map(p => `<button class="zuo-i ${fertigSet.has(p.k) ? 'ok' : wahl === p.k ? 'sel' : ''}" data-a="links" data-d="${p.k}" ${fertigSet.has(p.k) ? 'disabled' : ''}>${rich(p.begriff)}</button>`).join('')}</div>
      <div class="zuo-col">${rechts.map(p => `<button class="zuo-i ${fertigSet.has(p.k) ? 'ok' : falschK === p.k ? 'no' : ''}" data-a="rechts" data-d="${p.k}" ${fertigSet.has(p.k) ? 'disabled' : ''}>${rich(p.bedeutung)}</button>`).join('')}</div></div>
      ${done ? `<div class="fb ${fehler ? 'info' : 'good'}"><b>${fehler ? 'Geschafft, mit ' + fehler + (fehler === 1 ? ' Fehlgriff.' : ' Fehlgriffen.') : 'Alles richtig zugeordnet.'}</b></div><div class="btn-col"><button class="btn filled" data-a="fertig">${ctx.nextLabel || 'Weiter'}</button></div>` : `<div class="muted small">${wahl == null ? 'Tippe links einen Begriff an.' : 'Jetzt rechts die passende Bedeutung.'}</div>`}`;
  }
  on(el, {
    links: k => { wahl = +k; falschK = null; draw(); },
    rechts: k => {
      if (wahl == null) { toast('Tippe zuerst links einen Begriff an.'); return; }
      if (+k === wahl) { fertigSet.add(wahl); wahl = null; falschK = null; }
      else { fehler++; falschK = +k; if (fehler === 1) { const p = paare.find(x => x.k === wahl); logError(meta, item, { aufgabe: 'Zuordnen: ' + Z.titel + ', ' + p.begriff, eingabe: (paare.find(x => x.k === +k) || {}).bedeutung, richtig: p.bedeutung, fehlerart: 'Fachbegriff verwechselt' }); } }
      draw();
    },
    fertig: () => ctx.onDone(fehler === 0 ? 'richtig' : fehler <= 2 ? 'hilfe' : 'falsch')
  });
  draw();
}
// Karte zum Aufdecken: erst selbst antworten (im Kopf, laut oder auf dem Zettel), dann aufdecken und ehrlich bewerten.
// Das ist freies Abrufen und wirkt stärker als das Wiedererkennen bei einer Auswahl.
// alsAuswahl: Funktion, die dieselbe Karte als Auswahl zeigt, oder null, wenn es zu wenige andere Antworten gibt.
function runKarteFlip(el, item, ctx, meta, alsAuswahl) {
  let open = false;
  function draw() {
    el.innerHTML = ctxLine(meta) + `<button class="flash ${open ? 'open' : ''}" data-a="flip"><div class="flash-q">${rich(item.frage)}</div>${open ? `<div class="flash-a">${looksLikeFormula(item.antwort) ? fml(item.antwort) : rich(item.antwort)}</div>` : '<div class="flash-hint">Erst selbst antworten, dann antippen</div>'}</button>${open ? rateButtons() : alsAuswahl && !ctx.exam ? `<div class="act"><button class="btn small" data-a="auswahl">Lieber als Auswahl</button></div>` : ''}`;
  }
  on(el, {
    flip: () => { open = true; draw(); }, rate: d => ctx.onDone(d),
    auswahl: async () => { await st.setKartenArt('auswahl'); toast('Ab jetzt kommen Karten als Auswahl.'); alsAuswahl(); }
  });
  draw();
}
export // Erklären oder Skizzieren: aus dem Kopf, dann die Kernpunkte abhaken. Alle Punkte: gewusst, ab der Hälfte: mit Mühe.
function runErklaeren(el, item, ctx, meta) {
  const skizze = item.art === 'skizze';
  const haken = new Set();
  let open = false, text = '';
  function draw() {
    let h = ctxLine(meta) + `<div class="card-k">${skizze ? 'Skizze aus dem Kopf' : 'Erklären, ohne nachzusehen'}</div><div class="ex-task">${rich(item.frage)}</div>`;
    if (!open) h += (skizze ? `<p class="muted">Zeichne auf Papier oder unten im Zettel. Beschrifte alles, was dazugehört.</p>` : `<textarea class="big-ta" rows="4" data-k="antw" placeholder="Laut erklären oder Stichworte tippen">${esc(text)}</textarea>`)
      + `<div class="btn-col"><button class="btn filled" data-a="zeigen">Kernpunkte zeigen</button></div>`;
    else h += `<div class="card korr">${text ? `<div class="korr-a"><span class="muted small">Deine Stichworte</span><p>${esc(text)}</p></div>` : ''}<div class="muted small">Hak ab, was du ${skizze ? 'gezeichnet' : 'wirklich gesagt oder geschrieben'} hast.</div>
      ${item.kern.map((x, j) => `<label class="korr-k"><input type="checkbox" data-j="${j}" ${haken.has(j) ? 'checked' : ''}><span>${rich(x)}</span></label>`).join('')}</div>
      <div class="btn-col"><button class="btn filled" data-a="fertig">${ctx.nextLabel || 'Weiter'}</button></div>`;
    el.innerHTML = h;
  }
  el.addEventListener('change', e => { const c = e.target.closest('[data-j]'); if (c) { c.checked ? haken.add(+c.dataset.j) : haken.delete(+c.dataset.j); } });
  on(el, {
    zeigen: () => { const ta = $('[data-k="antw"]', el); text = ta ? ta.value.trim() : ''; open = true; draw(); },
    fertig: () => { const q = haken.size / item.kern.length; ctx.onDone(q >= 1 ? 'richtig' : q >= 0.5 ? 'hilfe' : 'falsch'); }
  });
  draw();
}
const looksLikeFormula = s => /^[^.!?]{1,60}=[^.!?]{1,80}$/.test(String(s)) && !/\s(ist|sind|und|der|die|das)\s/.test(s);
export function runFehler(el, item, ctx, meta) {
  const e = item.err;
  let open = false;
  function draw() {
    el.innerHTML = ctxLine(meta) + `<div class="card-k">Fehlerkarte</div><button class="flash ${open ? 'open' : ''}" data-a="flip"><div class="flash-q">Worauf musst du hier achten?</div><div class="flash-sub">${esc(e.aufgabe)}${e.eingabe ? '<br>Deine Eingabe damals: <b>' + esc(e.eingabe) + '</b>' : ''}</div>${open ? `<div class="flash-a">${e.richtig ? 'Richtig wäre: <b>' + esc(e.richtig) + '</b><br>' : ''}Fehlerart: ${esc(e.fehlerart)}${e.notiz ? '<br>' + esc(e.notiz) : ''}</div>` : '<div class="flash-hint">Erst selbst überlegen, dann antippen</div>'}</button>${open ? rateButtons() : ''}`;
  }
  on(el, { flip: () => { open = true; draw(); }, rate: d => ctx.onDone(d) });
  draw();
}
