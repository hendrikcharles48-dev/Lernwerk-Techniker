// Fach-Trainer: ein Trainer im Stil der alten Trainer, gebaut aus den Lernwerk-Blöcken.
// Die Seite unter trainer/ legt vorher window.FACHTRAINER fest:
// { id, titel, fach, text, farbe, themen: [{ datei, thema, kurz }] }
// Modi: Zufall, nur ein Thema, Kann-Liste der Reihe nach, Lernblatt, Prüfung.
import { parseBlocks } from './parser.js';
import { calc, keyOf, fml, fmlWith, parseEq, checkSolved, varNames } from './formula.js';
import { checkNumber, showValue } from './check.js';
import { esc, fmtNum, norm, shuffle } from './util.js';
import { editorHTML, attachEditor } from './mathedit.js';

const C = window.FACHTRAINER;
const $ = (s, r = document) => r.querySelector(s);
const rich = s => esc(s).replace(/(^|[^A-Za-z0-9])([A-Za-zΑ-Ωα-ωΔ])_([A-Za-z0-9]+)/g, '$1$2<sub>$3</sub>');
const emit = x => { try { if (window.Lernwerk) window.Lernwerk.emit(x); } catch (e) { /* egal */ } };
const roundStep = (v, s) => Number((Math.round(v / s) * s).toFixed(6));
const parseEqSafe = s => { try { return parseEq(s); } catch (e) { return { l: null, r: null }; } };

/* ===== Gespeicherter Stand auf diesem Gerät ===== */
const KEY = 'lw-ft:' + C.id;
let save = {};
try { save = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { save = {}; }
save.kann = save.kann || {};
const store = () => { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) { /* egal */ } };

/* ===== Inhalte laden ===== */
const TOPICS = [];
const ITEMS = [];
async function load() {
  const files = [...new Set(C.themen.map(t => t.datei))];
  const texts = await Promise.all(files.map(f => fetch('../inhalte/' + f).then(r => (r.ok ? r.text() : '')).catch(() => '')));
  const parsed = {};
  files.forEach((f, i) => { parsed[f] = parseBlocks(texts[i]).themen; });
  for (const c of C.themen) {
    const T = (parsed[c.datei] || []).find(t => norm(t.thema) === norm(c.thema));
    if (!T) continue;
    const k = TOPICS.push({ name: c.thema, kurz: c.kurz || c.thema, T }) - 1;
    T.aufgaben.forEach((a, j) => ITEMS.push({ key: k + ':a' + j, kind: 'auf', t: k, a }));
    T.auswahl.forEach((q, j) => ITEMS.push({ key: k + ':m' + j, kind: 'mc', t: k, q }));
  }
}

/* ===== Aufgabe mit Zufallszahlen füllen ===== */
function instantiate(a) {
  const vals = {};
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
  const fill = s => String(s || '').replace(/\{([^}]+)\}/g, (m, n) => (keyOf(n.trim()) in vals ? fmtNum(vals[keyOf(n.trim())]) : m));
  const steps = a.schritte.map(s => {
    const e = s.ergebnis;
    const o = { was: fill(s.was), einheit: s.einheit, typ: 'plan' };
    if (!e) return o;
    if (e.typ === 'gleichung') { o.typ = 'gleichung'; o.text = e.text; }
    else if (e.typ === 'ausdruck') { const v = calc(e.text, vals); if (v != null) { o.typ = 'zahl'; o.wert = v; o.rechnung = e.text; } }
    else if (e.typ === 'zahl' && !random) { o.typ = 'zahl'; o.wert = e.zahl; }
    return o;
  });
  const mc = q => q && { frage: q.frage ? fill(q.frage) : '', richtig: fill(q.richtig), falsch: q.falsch.map(fill) };
  return { text: fill(a.text), gegeben: a.gegeben.map(fill), gesucht: a.gesucht.map(fill), tipps: a.tipps.map(fill), steps, vals, random,
    ansatz: mc(a.ansatz), kontrolle: mc(a.kontrolle), signal: fill(a.signal || '') };
}
const finalStep = A => [...A.steps].reverse().find(s => s.typ === 'zahl');

/* ===== Eingabefelder mit eigener Tastatur ===== */
const numInput = unit => `<div class="fml-in">${editorHTML([], 'Zahl oder Rechnung', { calc: true, unit })}</div>`;
const fmlInput = names => `<div class="fml-in">${editorHTML(names, 'Gleichung, zum Beispiel ' + (names[0] || 'x') + ' = …')}</div>`;
function bindInput(root, onEnter) {
  const host = $('.fml-in .me', root);
  if (!host) return null;
  attachEditor(host, $('.fml-in .me-pad', root), { onEnter });
  return host;
}

/* ===== Oberfläche ===== */
let mode = save.mode || 'zufall';
let blattT = 0;
let ansatzOn = save.ansatz !== false;
const area = () => $('#area');

function modes() {
  const m = [['zufall', 'Zufall: alles gemischt']];
  TOPICS.forEach((t, i) => { if (ITEMS.some(x => x.t === i)) m.push(['t' + i, 'Nur ' + t.kurz]); });
  m.push(['kann', 'Kann-Liste der Reihe nach'], ['blatt', 'Lernblatt'], ['pruef', 'Prüfung']);
  return m;
}
function drawPick() {
  $('#pick').innerHTML = modes().map(([k, l]) => `<button type="button" data-k="${k}" class="${k === mode ? 'on' : ''}">${esc(l)}</button>`).join('');
  $('#togrow').hidden = mode === 'blatt' || mode === 'pruef';
}
function setMode(k) {
  mode = k; save.mode = k; store();
  drawPick();
  const on = $('#pick button.on');
  if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest', inline: 'center' });
  start();
}
function start() {
  $('#kl').hidden = mode !== 'kann';
  if (mode === 'blatt') return drawBlatt();
  if (mode === 'pruef') return startPruefung();
  if (mode === 'kann') return nextKann(0);
  nextRandom();
}
let lastKey = '';
function nextRandom() {
  let pool = ITEMS;
  if (/^t\d+$/.test(mode)) pool = ITEMS.filter(x => x.t === +mode.slice(1));
  // Rechenaufgaben kommen öfter dran als Auswahlfragen
  const weighted = pool.flatMap(x => (x.kind === 'auf' ? [x, x, x] : [x])).filter(x => x.key !== lastKey || pool.length === 1);
  const it = weighted[Math.floor(Math.random() * weighted.length)];
  if (!it) { area().innerHTML = `<div class="given">Für diese Auswahl gibt es noch keine Aufgaben.</div>`; return; }
  lastKey = it.key;
  runItem(it, { next: nextRandom });
}

/* ===== Kann-Liste ===== */
let kannI = save.kannI || 0;
function drawKann() {
  const n = ITEMS.length, d = ITEMS.filter(x => save.kann[x.key]).length;
  $('#klp').textContent = d + ' von ' + n + ' geschafft' + (d === n ? '. Alles durch, stark.' : '');
  $('#klb').style.width = (n ? d / n * 100 : 0) + '%';
  let h = '', last = -1;
  ITEMS.forEach((x, i) => {
    if (x.t !== last) { h += `<div class="sub2">${esc(TOPICS[x.t].kurz)}</div>`; last = x.t; }
    const st = save.kann[x.key];
    const title = x.kind === 'auf' ? x.a.text.replace(/\{[^}]+\}/g, '…') : x.q.frage;
    h += `<button type="button" data-kl="${i}" class="${st ? 'kn' : ''} ${i === kannI ? 'cur' : ''}"><span>${rich(title.length > 80 ? title.slice(0, 78) + ' …' : title)}${x.kind === 'mc' ? '<span class="katag">Auswahl</span>' : ''}</span><span class="v">${st === 2 ? '✓' : st === 1 ? 'mit Hilfe' : i === kannI ? '<span class="go">jetzt</span>' : ''}</span></button>`;
  });
  $('#klq').innerHTML = h;
}
function nextKann(step) {
  if (!ITEMS.length) return;
  kannI = (kannI + step + ITEMS.length) % ITEMS.length;
  save.kannI = kannI; store();
  drawKann();
  runItem(ITEMS[kannI], {
    next: () => nextKann(1),
    nextLabel: kannI === ITEMS.length - 1 ? 'Alles durch. Von vorn' : 'Nächster Punkt',
    done: clean => { save.kann[ITEMS[kannI].key] = Math.max(save.kann[ITEMS[kannI].key] || 0, clean ? 2 : 1); store(); drawKann(); }
  });
}

/* ===== Eine Übung ===== */
function runItem(it, o) {
  if (it.kind === 'mc') return runMC(it, o);
  runAufgabe(it, o);
}
function head(it) {
  return `<div class="ctx"><span class="dot"></span>${esc(C.fach)} · ${esc(TOPICS[it.t].name)}</div>`;
}
function mcBox(q, label, onRight, onWrong) {
  const opts = shuffle([q.richtig, ...q.falsch]);
  const box = document.createElement('div');
  box.className = 'step';
  box.innerHTML = `<div class="n">${esc(label)}</div><div class="q">${rich(q.frage)}</div><div class="mc">${opts.map((x, k) => `<button type="button" data-o="${k}">${rich(x)}</button>`).join('')}</div><div class="mcfb"></div>`;
  let wrong = 0;
  box.addEventListener('click', e => {
    const b = e.target.closest('[data-o]');
    if (!b || b.disabled) return;
    const x = opts[+b.dataset.o];
    if (x === q.richtig) {
      b.classList.add('ok');
      box.querySelectorAll('[data-o]').forEach(y => { y.disabled = true; });
      onRight(wrong === 0, box);
    } else {
      b.classList.add('no'); b.disabled = true; wrong++;
      onWrong(x, box);
    }
  });
  return box;
}
function runMC(it, o) {
  const q = it.q;
  area().innerHTML = head(it);
  const box = mcBox({ frage: q.frage, richtig: q.richtig, falsch: q.falsch }, 'Auswahl', (first, bx) => {
    $('.mcfb', bx).innerHTML = `<div class="fb good"><b>${first ? 'Richtig.' : 'Jetzt stimmt es.'}</b> ${q.erklaerung ? rich(q.erklaerung) : ''}</div><div class="act"><button type="button" class="main" data-a="next">${esc(o.nextLabel || 'Weiter')}</button></div>`;
    $('[data-a="next"]', bx).onclick = o.next;
    emit({ art: 'aufgabe', thema: TOPICS[it.t].name, ok: first });
    if (o.done) o.done(first);
  }, (x, bx) => {
    $('.mcfb', bx).innerHTML = `<div class="fb badf"><b>Nicht das.</b> Lies die Frage noch einmal und überleg, was genau gefragt ist.</div>`;
    emit({ art: 'fehler', thema: TOPICS[it.t].name, aufgabe: q.frage, eingabe: x, richtig: q.richtig, fehlerart: 'Falsche Auswahl', meldung: q.erklaerung || '' });
  });
  area().appendChild(box);
}

function runAufgabe(it, o) {
  const T = TOPICS[it.t].T;
  const name = TOPICS[it.t].name;
  const A = instantiate(it.a);
  const steps = A.steps.filter(s => s.typ !== 'plan' || A.steps.length === 1);
  let i = 0, tries = 0, first = 0, used = false, loggedStep = -1;
  const done = [];
  area().innerHTML = head(it) + `<div class="given" id="task"><div class="tt">${rich(A.text)}</div>${A.gegeben.length ? `<div class="gg"><b>Gegeben:</b> ${A.gegeben.map(rich).join(', ')}</div>` : ''}${A.gesucht.length ? `<div class="gg"><b>Gesucht:</b> ${A.gesucht.map(rich).join(', ')}</div>` : ''}</div><div id="pre"></div><div id="stepbox"></div><div id="valsw" hidden><h3>Deine Werte</h3><div class="tw"><table id="vals"></table></div></div>`;
  const vals = () => {
    $('#valsw').hidden = !done.length;
    $('#vals').innerHTML = done.map(d => `<tr><td>${rich(d.was)}</td><td>${d.html}</td></tr>`).join('');
  };
  const goSteps = () => drawStep();
  // Erst den Ansatz wählen, wie im Statik-Trainer: Was brauchst du?
  if (ansatzOn && A.ansatz) {
    const box = mcBox({ frage: 'Welcher Ansatz passt?', richtig: A.ansatz.richtig, falsch: A.ansatz.falsch }, 'Erst erkennen', (firstTry, bx) => {
      $('.mcfb', bx).innerHTML = `<div class="fb good"><b>Richtig erkannt.</b> ${rich(A.signal)}</div>`;
      if (!firstTry) used = true;
      goSteps();
    }, (x, bx) => {
      used = true;
      $('.mcfb', bx).innerHTML = `<div class="fb badf"><b>Nicht das.</b> ${A.signal ? 'Achte darauf: ' + rich(A.signal) : 'Was ist gegeben, was ist gesucht?'}</div>`;
      if (loggedStep !== -2) { loggedStep = -2; emit({ art: 'fehler', thema: name, aufgabe: A.text, eingabe: 'Ansatz: ' + x, richtig: A.ansatz.richtig, fehlerart: 'Falscher Ansatz', meldung: A.signal }); }
    });
    $('#pre').appendChild(box);
  } else goSteps();

  function drawStep(fb = '', extra = '') {
    vals();
    const sb = $('#stepbox');
    if (i >= steps.length) return finish();
    const s = steps[i];
    let inp = '';
    if (s.typ === 'zahl') inp = numInput(s.einheit);
    else if (s.typ === 'gleichung') inp = fmlInput([...varNames(parseEqSafe(s.text)).values()]);
    else inp = `<p class="mut">Diesen Schritt machst du auf dem Blatt. Tippe dann auf Erledigt.</p>`;
    sb.innerHTML = `<div class="step"><div class="n">Schritt ${i + 1} von ${steps.length}</div><div class="q">${rich(s.was)}</div>${inp}
      <div class="act">${s.typ === 'plan' ? '<button type="button" class="main" data-a="plan">Erledigt</button>' : '<button type="button" class="main" data-a="chk">Prüfen</button>'}<button type="button" data-a="tip">Tipp</button><button type="button" data-a="sol" ${tries >= 2 ? '' : 'hidden'}>Lösung zeigen</button></div>
      <div class="act"><button type="button" data-a="stuck">Ich hänge: Was geht jetzt?</button></div>${fb}${extra}</div>`;
    const host = bindInput(sb, check);
    sb.onclick = e => {
      const b = e.target.closest('[data-a]');
      if (!b) return;
      const a = b.dataset.a;
      if (a === 'chk') check();
      else if (a === 'plan') accept('erledigt', true);
      else if (a === 'tip') { used = true; const v = host ? host.value : ''; drawStep(fb, `<div class="fb info"><b>Tipp.</b> ${tipText(s)}</div>`); if (v) $('#stepbox .me').value = v; }
      else if (a === 'stuck') { used = true; const v = host ? host.value : ''; drawStep(fb, `<div class="fb info">${stuckText(s)}</div>`); if (v) $('#stepbox .me').value = v; }
      else if (a === 'sol') { used = true; drawStep('', `<div class="fb info"><b>Lösung.</b> ${solText(s)}</div><div class="act"><button type="button" class="main" data-a="take">Übernehmen und weiter</button></div>`); }
      else if (a === 'take') accept((s.typ === 'zahl' ? '<b>' + esc(showValue(s.wert, s.einheit)) + '</b>' : solText(s)) + ' <span class="mut">(Lösung)</span>', false);
    };
    if (host && !fb && !extra) try { host.focus({ preventScroll: true }); } catch (e) { /* alt */ }
  }
  function tipText(s) {
    if (A.tipps.length) return A.tipps.map(rich).join(' ');
    if (s.rechnung) return 'So rechnest du diesen Schritt: ' + fml(s.rechnung.replace(/\*/g, '·'));
    const f = T.formeln.slice(0, 3).map(x => fml(x.formel)).join(', ');
    return f ? 'Passende Formeln: ' + f : 'Was ist gegeben, was ist gesucht, und welche Regel verbindet beides?';
  }
  function stuckText(s) {
    let h = `<b>So gehst du vor.</b>`;
    if (A.signal) h += `<div class="stk">Erkennen: ${rich(A.signal)}</div>`;
    if (A.ansatz) h += `<div class="stk">Ansatz: ${rich(A.ansatz.richtig)}</div>`;
    if (T.bausteine.length) h += `<ol class="stl">${T.bausteine.map(b => `<li>${rich(b)}</li>`).join('')}</ol>`;
    h += `<div class="stk">Jetzt dran: ${rich(s.was)}${s.einheit ? ', Ergebnis in ' + esc(s.einheit) : ''}.</div>`;
    return h;
  }
  function solText(s) {
    if (s.typ === 'gleichung') return fml(s.text);
    if (s.typ === 'zahl') return (s.rechnung ? fml(s.rechnung.replace(/\*/g, '·')) + ' = ' + fmlWith(s.rechnung, A.vals) + ' = ' : '') + '<b>' + esc(showValue(s.wert, s.einheit)) + '</b>';
    return esc(s.was);
  }
  function accept(html, ok) {
    done.push({ was: steps[i].was, html });
    if (ok && tries === 0) first++;
    i++; tries = 0;
    emit({ art: 'schritt', thema: name, ok });
    drawStep();
  }
  function check() {
    const s = steps[i];
    const host = $('#stepbox .me');
    const v = host ? host.value : '';
    if (!v.trim()) return drawStep(`<div class="fb badf">Gib zuerst etwas ein.</div>`);
    let r;
    if (s.typ === 'gleichung') {
      const target = (parseEqSafe(s.text).l || {}).n;
      const c = checkSolved(s.text, target, s.text, v);
      if (c.ok) return accept(fml(v), true);
      r = { msg: c.msg, fehlerart: c.fehlerart || 'Umstellen' };
    } else {
      const c = checkNumber(v, s.wert, s.einheit);
      if (c.status === 'ok') return accept(esc(showValue(c.value, s.einheit)), true);
      // Schon weiter gerechnet: späteren Schritt anerkennen, Zwischenschritte ergänzen
      if (c.status === 'wrong') for (let j = i + 1; j < steps.length; j++) {
        const sj = steps[j];
        if (sj.typ !== 'zahl' || checkNumber(v, sj.wert, sj.einheit).status !== 'ok') continue;
        while (i < j) { done.push({ was: steps[i].was, html: solText(steps[i]) + ' <span class="mut">(übersprungen)</span>' }); if (tries === 0) first++; i++; }
        return accept(esc(showValue(sj.wert, sj.einheit)) + ' <span class="mut">(du warst schon weiter)</span>', true);
      }
      r = { msg: c.msg + (c.status === 'wrong' && i < steps.length - 1 ? ' Gefragt ist hier nur der Zwischenschritt: ' + s.was + '.' : ''), fehlerart: c.fehlerart, empty: c.status !== 'wrong' };
    }
    if (!r.empty) {
      tries++; used = true;
      if (loggedStep !== i) { loggedStep = i; emit({ art: 'fehler', thema: name, aufgabe: A.text + ' Schritt: ' + s.was, eingabe: v + (s.einheit && s.typ === 'zahl' ? ' ' + s.einheit : ''), richtig: s.typ === 'zahl' ? showValue(s.wert, s.einheit) : s.text, fehlerart: r.fehlerart, meldung: r.msg }); }
    }
    drawStep(`<div class="fb badf"><b>${r.empty ? 'Hm.' : 'Noch nicht.'}</b> ${esc(r.msg)}</div>`);
    const h2 = $('#stepbox .me'); if (h2) h2.value = v;
  }
  function finish() {
    const clean = !used && first === steps.length;
    const sb = $('#stepbox');
    const end = () => {
      sb.innerHTML = `<div class="step"><div class="fb good"><b>Geschafft.</b> ${first} von ${steps.length} Schritten beim ersten Versuch richtig.${clean ? ' Ohne Hilfe, stark.' : ''}</div>
        ${T.schnellwege.length ? `<div class="fast"><b>Schnellweg:</b> ${rich(T.schnellwege[0])}</div>` : ''}
        <div class="act">${A.random ? '<button type="button" data-a="again">Gleiche Art, neue Zahlen</button>' : ''}<button type="button" class="main" data-a="next">${esc(o.nextLabel || 'Nächste Aufgabe')}</button></div></div>`;
      sb.onclick = e => { const b = e.target.closest('[data-a]'); if (!b) return; if (b.dataset.a === 'next') o.next(); else runAufgabe(it, o); };
    };
    emit({ art: 'aufgabe', thema: name, ok: clean });
    if (o.done) o.done(clean);
    // Zum Schluss: Ergebnis prüfen
    if (A.kontrolle) {
      sb.innerHTML = '';
      const box = mcBox(A.kontrolle, 'Zum Schluss prüfen', (firstTry, bx) => {
        $('.mcfb', bx).innerHTML = `<div class="fb good"><b>Passt.</b> Das Ergebnis ist plausibel.</div>`;
        end();
        sb.prepend(bx);
      }, (x, bx) => { $('.mcfb', bx).innerHTML = `<div class="fb badf"><b>Noch nicht.</b> Vergleich mit deinem Ergebnis: Stimmen Größenordnung, Einheit und Vorzeichen?</div>`; });
      sb.appendChild(box);
    } else end();
  }
}

/* ===== Lernblatt ===== */
function drawBlatt() {
  const T = TOPICS[blattT] ? TOPICS[blattT].T : null;
  let h = `<div class="elchips">${TOPICS.map((t, i) => `<button type="button" data-bt="${i}" class="${i === blattT ? 'on' : ''}">${esc(t.kurz)}</button>`).join('')}</div>`;
  if (!T) { area().innerHTML = h; return; }
  h += `<h2>${esc(TOPICS[blattT].name)}</h2>`;
  if (T.anker.length) h += `<p class="mut">${rich(T.anker[0])}</p>`;
  const prinzip = [].concat(T.prinzip || []).join('\n\n');
  if (prinzip.trim()) h += `<section>${prinzip.split(/\n\s*\n|\n/).filter(p => p.trim()).map(p => `<p>${rich(p.trim())}</p>`).join('')}</section>`;
  if (T.merksaetze.length) h += `<h3>Merksätze</h3>` + T.merksaetze.map(m => `<div class="merk">${rich(m)}</div>`).join('');
  if (T.formeln.length) h += `<h3>Formeln</h3><div class="tw"><table>${T.formeln.map(f => `<tr><td>${rich(f.name || '')}</td><td>${fml(f.formel)}${f.umgestellt.length ? `<div class="umg">${f.umgestellt.map(u => fml(u)).join('<br>')}</div>` : ''}</td></tr>`).join('')}</table></div>`;
  if (T.begriffe.length) h += `<h3>Begriffe</h3><div class="trio">${T.begriffe.map(b => `<div><span class="k">${rich(b.begriff)}</span>${rich(b.erklaerung)}</div>`).join('')}</div>`;
  if (T.bausteine.length) h += `<h3>So gehst du vor</h3><section><ol>${T.bausteine.map(b => `<li>${rich(b)}</li>`).join('')}</ol></section>`;
  if (T.schnellwege.length) h += `<h3>Schnellweg</h3>` + T.schnellwege.map(s => `<div class="fast">${rich(s)}</div>`).join('');
  if (T.fehler.length) h += `<h3>Typische Fehler</h3><div class="trio">${T.fehler.map(f => `<div><span class="k bad">${rich(f.fehler)}</span>${rich(f.achtung || '')}</div>`).join('')}</div>`;
  if (T.quellen.length) h += `<p class="mut small">${rich(T.quellen.join(' '))}</p>`;
  area().innerHTML = h;
}

/* ===== Prüfung: ohne Hilfe, gemischt, Auswertung am Ende ===== */
function startPruefung() {
  const pool = shuffle(ITEMS.filter(x => x.kind === 'auf'));
  const pick = [], seenT = new Set();
  for (const x of pool) if (!seenT.has(x.t) && pick.length < 6) { pick.push(x); seenT.add(x.t); }
  for (const x of pool) if (pick.length < 6 && !pick.includes(x)) pick.push(x);
  const tasks = pick.map(it => { const A = instantiate(it.a); return { it, A, f: finalStep(A) }; }).filter(x => x.f);
  const res = [];
  const t0 = Date.now();
  area().innerHTML = `<div class="given"><b>Prüfung.</b> ${tasks.length} Aufgaben aus allen Themen, ohne Tipps. Rechne auf dem Blatt und gib nur das Endergebnis ein. Am Ende siehst du, was gut lief und welche Fehler du machst.</div><div class="act"><button type="button" class="main" data-a="go">Prüfung starten</button></div>`;
  $('[data-a="go"]', area()).onclick = () => show(0);
  function show(k) {
    if (k >= tasks.length) return auswertung();
    const { it, A, f } = tasks[k];
    area().innerHTML = `<div class="prog">Aufgabe ${k + 1} von ${tasks.length}<div class="bar"><i style="width:${k / tasks.length * 100}%"></i></div></div>
      <div class="given"><div class="tt">${rich(A.text)}</div>${A.gegeben.length ? `<div class="gg"><b>Gegeben:</b> ${A.gegeben.map(rich).join(', ')}</div>` : ''}${A.gesucht.length ? `<div class="gg"><b>Gesucht:</b> ${A.gesucht.map(rich).join(', ')}</div>` : ''}</div>
      <div class="step"><div class="n">Dein Endergebnis</div><div class="q">${rich(f.was)}</div>${numInput(f.einheit)}<div class="act"><button type="button" class="main" data-a="ab">Abgeben und weiter</button><button type="button" data-a="skip">Weiß ich nicht</button></div></div>`;
    const host = bindInput(area(), () => abgeben(false));
    const abgeben = skip => {
      const v = skip ? '' : host.value;
      const c = v.trim() ? checkNumber(v, f.wert, f.einheit) : { status: 'empty', fehlerart: 'Nicht bearbeitet' };
      const ok = c.status === 'ok';
      res.push({ it, A, f, v, ok, fehlerart: ok ? '' : (c.status === 'wrong' ? c.fehlerart : c.status === 'empty' ? 'Nicht bearbeitet' : 'Unlesbare Eingabe') });
      emit({ art: 'aufgabe', thema: TOPICS[it.t].name, ok });
      if (!ok && v.trim()) emit({ art: 'fehler', thema: TOPICS[it.t].name, aufgabe: A.text, eingabe: v + (f.einheit ? ' ' + f.einheit : ''), richtig: showValue(f.wert, f.einheit), fehlerart: c.fehlerart || 'Rechenweg', meldung: c.msg || '' });
      show(k + 1);
    };
    $('[data-a="ab"]', area()).onclick = () => { if (!host.value.trim()) { host.focus(); return; } abgeben(false); };
    $('[data-a="skip"]', area()).onclick = () => abgeben(true);
  }
  function auswertung() {
    const n = res.filter(r => r.ok).length;
    const min = Math.max(1, Math.round((Date.now() - t0) / 60000));
    const arten = {};
    res.filter(r => !r.ok).forEach(r => { arten[r.fehlerart] = (arten[r.fehlerart] || 0) + 1; });
    area().innerHTML = `<div class="given"><b>${n} von ${res.length} richtig</b> in etwa ${min} Minuten. ${n === res.length ? 'Alles richtig, stark.' : n >= res.length * 0.7 ? 'Gut, schau dir die Fehler unten an.' : 'Die Fehler unten zeigen dir, was du noch üben solltest.'}</div>
      <div class="tw"><table><tr><th>Thema</th><th>Du</th><th>Richtig</th></tr>${res.map(r => `<tr><td>${esc(TOPICS[r.it.t].kurz)}</td><td class="${r.ok ? 'ok' : 'bad'}">${r.v ? esc(r.v) : '–'}</td><td>${esc(showValue(r.f.wert, r.f.einheit))}</td></tr>`).join('')}</table></div>
      ${Object.keys(arten).length ? `<h3>Nach Fehlerart</h3><div class="trio">${Object.entries(arten).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<div><span class="k">${esc(k)}</span>${v} mal</div>`).join('')}</div>` : ''}
      <div class="act"><button type="button" class="main" data-a="neu">Neue Prüfung</button></div>`;
    $('[data-a="neu"]', area()).onclick = startPruefung;
  }
}

/* ===== Start ===== */
async function init() {
  document.title = C.titel;
  const r = document.documentElement.style;
  r.setProperty('--accent', C.farbe);
  r.setProperty('--accent-ink', C.farbe);
  $('#h1').textContent = C.titel;
  $('#lead').textContent = C.text;
  $('#fach').textContent = C.fach;
  await load();
  $('#themen').textContent = TOPICS.length + ' Themen, ' + ITEMS.filter(x => x.kind === 'auf').length + ' Rechenaufgaben, ' + ITEMS.filter(x => x.kind === 'mc').length + ' Auswahlfragen';
  if (!modes().some(([k]) => k === mode)) mode = 'zufall';
  $('#ansatzOn').checked = ansatzOn;
  $('#ansatzOn').onchange = e => { ansatzOn = e.target.checked; save.ansatz = ansatzOn; store(); };
  $('#pick').onclick = e => { const b = e.target.closest('[data-k]'); if (b) setMode(b.dataset.k); };
  $('#klq').onclick = e => { const b = e.target.closest('[data-kl]'); if (b) { kannI = +b.dataset.kl; nextKann(0); $('#kld').open = false; } };
  $('#klprev').onclick = () => nextKann(-1);
  $('#klskip').onclick = () => nextKann(1);
  $('#klreset').onclick = () => { if (confirm('Kann-Liste auf null setzen?')) { save.kann = {}; kannI = 0; store(); nextKann(0); } };
  area().addEventListener('click', e => { const b = e.target.closest('[data-bt]'); if (b) { blattT = +b.dataset.bt; drawBlatt(); } });
  drawPick();
  start();
}
init();
