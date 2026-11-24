// Aufgabenarten nach Lernart: Anker-Karte und Lückentext (Stufe 1), Warum-Frage und Fallbeispiel (Stufe 2),
// Rechenweg mit Bausteinen und neuen Zahlen (Stufe 3). Aufgerufen über runItem in js/engine.js.
// Bei einem Fehler zeigt die App die Fehlerstelle und das Grundprinzip zum Aufklappen.
// Beim nächsten Mal kommt die Aufgabe in der anderen Form oder mit neuen Zahlen.
import { esc, fmtNum, shuffle, norm } from './util.js';
import { fml, fmlWith } from './formula.js';
import * as st from './store.js';
import { on, icon } from './ui.js';
import { rich } from './engine.js';
import { rechenweg, reihenfolgePruefen, abhaengigkeiten } from './rechenweg.js';

const ctxLine = meta => `<div class="ex-ctx"><span class="dot" style="background:${meta.farbe}"></span>${esc(meta.fach)} · ${esc(meta.thema)}</div>`;
const rateButtons = () => `<div class="rate"><button class="btn rate-no" data-a="rate" data-d="falsch">Nicht gewusst</button><button class="btn rate-mid" data-a="rate" data-d="hilfe">Mit Mühe</button><button class="btn rate-ok" data-a="rate" data-d="richtig">Gewusst</button></div>`;
const weiterBtn = ctx => `<div class="btn-col"><button class="btn filled" data-a="fertig">${ctx.nextLabel || 'Weiter'}</button></div>`;
const RANG = { richtig: 0, hilfe: 1, falsch: 2 };
const schlechter = (a, b) => (RANG[a] >= RANG[b] ? a : b);
// Wie oft die Übung schon dran war. Daran wechselt die Form: einmal Auswahl, einmal selbst überlegen.
const runden = item => { const c = st.card(item.id); return c ? (c.richtig || 0) + (c.hilfe || 0) + (c.falsch || 0) : 0; };
const warumFalsch = (q, a) => { const x = (q && q.wf || []).find(w => norm(w.a) === norm(a)); return x ? x.w : ''; };

async function logError(meta, item, x) {
  await st.addError({ fach: meta.fach, thema: meta.thema, tid: item.tid, aufgabe: x.aufgabe, eingabe: x.eingabe, richtig: x.richtig, fehlerart: x.fehlerart, quelle: 'app', notiz: x.meldung || '' });
}

/* ===== Tabelle, Zeichnung und Grundprinzip zur Aufgabe ===== */
// [Text] in einer Zelle wird ein kleines Label
const zelle = c => String(c || '').split(/\[([^\]]+)\]/).map((x, k) => (k % 2 ? `<span class="lw-lbl">${rich(x)}</span>` : rich(x))).join('');
export function tabelleHTML(x) {
  const kopf = x.kopf && x.kopf.length ? `<thead><tr>${x.kopf.map(k => `<th>${zelle(k)}</th>`).join('')}</tr></thead>` : '';
  return `<figure class="lw-tab-w"><figcaption>${esc(x.titel)}</figcaption><div class="lw-tab-s"><table class="lw-tab">${kopf}<tbody>${x.zeilen.map(z => `<tr>${z.map(c => `<td>${zelle(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></figure>`;
}
export function zusatzHTML(item, o) {
  const t = st.topic(item.tid);
  let h = '';
  for (const n of o.bilder || []) {
    const z = (t.zeichnungen || []).find(x => norm(x.titel) === norm(n));
    if (z) h += `<figure class="sk-fig sk lw-bild"><div class="sk-box">${z.svg}</div><figcaption>${esc(z.titel)}</figcaption></figure>`;
  }
  for (const n of o.tabellen || []) {
    const x = (t.tabellen || []).find(y => norm(y.titel) === norm(n));
    if (x) h += tabelleHTML(x);
  }
  return h;
}
export const hatZusatz = item => { const o = item.l || item.w || (item.art === 'rechenweg' && item.aufgabe); return !!(o && ((o.bilder || []).length || (o.tabellen || []).length)); };
// Grundprinzip: Anker aus deiner Welt, Fachbegriff, Merksatz. Erst von der Aufgabe, sonst vom Thema.
export function grundHTML(item, o, offen = false) {
  const t = st.topic(item.tid);
  const g = (o && o.grund) || (t.grundprinzipien || [])[0] || { anker: t.anker[0] || '', begriff: '', merksatz: t.merksaetze[0] || '' };
  if (!g.anker && !g.begriff && !g.merksatz) return '';
  const z = (k, v) => (v ? `<div class="gp-z"><span class="gp-k">${k}</span><span>${rich(v)}</span></div>` : '');
  return `<details class="disc gp" ${offen ? 'open' : ''}><summary>${icon('info')} Grundprinzip</summary>${z('Bild', g.anker)}${z('Fachbegriff', g.begriff)}${z('Merksatz', g.merksatz)}</details>`;
}

/* ===== Anker-Karte: Bild und Fachbegriff, abwechselnd in beide Richtungen ===== */
export function runAnker(el, item, ctx, meta) {
  const A = item.anker;
  const umgedreht = runden(item) % 2 === 1;
  const frage = umgedreht ? `Welches Bild aus deiner Welt gehört zu „${A.begriff}“?` : `Welcher Fachbegriff steckt hinter diesem Bild? ${A.bild}`;
  const antwort = umgedreht ? A.bild : A.begriff;
  let open = false;
  function draw() {
    el.innerHTML = ctxLine(meta) + `<div class="card-k">Anker</div><button class="flash ${open ? 'open' : ''}" data-a="flip"><div class="flash-q">${rich(frage)}</div>${open ? `<div class="flash-a">${rich(antwort)}</div>` : '<div class="flash-hint">Erst selbst antworten, dann antippen</div>'}</button>${open ? rateButtons() : ''}`;
  }
  on(el, { flip: () => { open = true; draw(); }, rate: d => { if (d === 'falsch') logError(meta, item, { aufgabe: frage, eingabe: '', richtig: antwort, fehlerart: 'Anker vergessen' }); ctx.onDone(d); } });
  draw();
}

/* ===== Lückentext: fehlende Wörter einsetzen oder selbst ergänzen ===== */
export function runLuecke(el, item, ctx, meta) {
  const L = item.l;
  const teile = L.satz.split(/\[[^\]]+\]/);
  const kannWaehlen = L.falsch.length > 0 || L.woerter.length > 1;
  const waehlen = kannWaehlen && (ctx.exam || runden(item) % 2 === 0);
  const opts = shuffle([...new Set([...L.woerter, ...L.falsch])]);
  let slots = L.woerter.map(() => null), checked = null, tries = 0, shown = false, solved = false, open = false;
  const luecke = k => {
    if (!waehlen) return open ? `<b class="lk lk-on">${rich(L.woerter[k])}</b>` : '<span class="lk">&#8203;</span>';
    const w = slots[k];
    const cls = checked ? (checked[k] ? 'ok' : 'no') : '';
    return `<button class="lk ${w != null ? 'lk-on' : ''} ${cls}" data-a="leer" data-d="${k}" aria-label="Lücke ${k + 1}${w != null ? ': ' + esc(opts[w]) : ''}">${w != null ? rich(opts[w]) : '&#8203;'}</button>`;
  };
  const satzHTML = () => teile.map((x, k) => rich(x) + (k < L.woerter.length ? luecke(k) : '')).join('');
  function draw() {
    let h = ctxLine(meta) + `<div class="card-k">Lückentext</div>` + zusatzHTML(item, L) + `<div class="ex-task lk-satz">${satzHTML()}</div>`;
    if (!waehlen) {
      h += open ? (L.erklaerung ? `<div class="fb info">${rich(L.erklaerung)}</div>` : '') + grundHTML(item, L) + rateButtons()
        : `<p class="muted">Ergänze den Satz im Kopf. Dann deck auf.</p><div class="btn-col"><button class="btn filled" data-a="auf">Aufdecken</button></div>`;
    } else {
      const frei = new Set(slots.filter(x => x != null));
      if (!solved) h += `<div class="pool lk-pool">${opts.map((o, j) => `<button class="pool-i" data-a="wort" data-d="${j}" ${frei.has(j) ? 'disabled' : ''}><span>${rich(o)}</span></button>`).join('')}</div>`;
      if (checked && !solved) {
        const falscheWoerter = slots.map((w, k) => (checked[k] || w == null ? '' : warumFalsch(L, opts[w]))).filter(Boolean);
        h += `<div class="fb bad"><b>Die rot markierte Lücke stimmt nicht.</b> Tipp sie an, dann wählst du neu. ${falscheWoerter.map(rich).join(' ')}</div>` + grundHTML(item, L);
      }
      if (solved) h += `<div class="fb ${shown ? 'info' : 'good'}"><b>${shown ? 'So heißt der Satz.' : 'Richtig.'}</b> ${L.erklaerung ? rich(L.erklaerung) : ''}</div>` + weiterBtn(ctx);
      else if (slots.every(x => x != null)) h += `<div class="act"><button class="btn filled" data-a="pruefen">${ctx.exam ? 'Abgeben und weiter' : 'Prüfen'}</button>${ctx.exam ? '' : '<button class="btn" data-a="sol">Lösung</button>'}</div>`;
      else if (!ctx.exam) h += `<div class="act"><button class="btn" data-a="sol">Lösung</button></div>`;
    }
    el.innerHTML = h;
  }
  on(el, {
    auf: () => { open = true; draw(); },
    rate: d => { if (d === 'falsch') logError(meta, item, { aufgabe: L.satz, eingabe: '', richtig: L.woerter.join(', '), fehlerart: 'Lücke nicht gewusst' }); ctx.onDone(d); },
    wort: j => { if (solved) return; const k = slots.indexOf(null); if (k < 0) return; slots[k] = +j; checked = null; draw(); },
    leer: k => { if (solved) return; slots[+k] = null; checked = null; draw(); },
    pruefen: () => {
      checked = slots.map((w, k) => norm(opts[w]) === norm(L.woerter[k]));
      const ok = checked.every(Boolean);
      const falschK = checked.findIndex(x => !x);
      if (!ok && tries === 0) logError(meta, item, { aufgabe: L.satz, eingabe: slots.map(w => opts[w]).join(', '), richtig: L.woerter.join(', '), fehlerart: 'Falsches Wort', meldung: 'Lücke ' + (falschK + 1) });
      if (ctx.exam) { ctx.onDone(ok ? 'richtig' : 'falsch', { aufgabe: L.satz, eingabe: slots.map(w => opts[w]).join(', '), richtig: L.woerter.join(', ') }); return; }
      if (ok) solved = true; else tries++;
      draw();
    },
    sol: () => { shown = solved = true; slots = L.woerter.map(w => opts.findIndex(o => norm(o) === norm(w))); checked = slots.map(() => true); draw(); },
    fertig: () => ctx.onDone(shown ? 'falsch' : tries ? 'hilfe' : 'richtig')
  });
  draw();
}

/* ===== Warum-Frage und Fallbeispiel: abwechselnd Auswahl und selbst überlegen ===== */
export function runWarum(el, item, ctx, meta) {
  const W = item.w;
  const fall = item.art === 'fallbeispiel';
  const kannWaehlen = W.falsch.length > 0;
  // Erst frei abrufen, beim nächsten Mal als Auswahl. Was falsch war, kommt so in der anderen Form wieder.
  const waehlen = kannWaehlen && (ctx.exam || runden(item) % 2 === 1);
  const opts = shuffle([W.antwort, ...W.falsch]);
  const picked = new Set();
  let open = false, solved = false, shown = false, tries = 0, letzte = null, text = '';
  const kopf = () => ctxLine(meta) + `<div class="card-k">${fall ? 'Fallbeispiel' : 'Warum?'}</div>` + zusatzHTML(item, W)
    + (fall ? `<div class="card fb-lage"><p>${rich(W.lage)}</p></div>` : '') + `<div class="ex-task">${rich(W.frage)}</div>`;
  function draw() {
    let h = kopf();
    if (!waehlen) {
      if (!open) h += `<textarea class="big-ta" rows="3" data-k="antw" placeholder="Erst selbst überlegen, Stichworte reichen">${esc(text)}</textarea><div class="btn-col"><button class="btn filled" data-a="auf">Antwort aufdecken</button></div>`;
      else h += (text ? `<div class="card korr"><span class="muted small">Deine Stichworte</span><p>${esc(text)}</p></div>` : '')
        + `<div class="fb info"><b>${rich(W.antwort)}</b>${W.erklaerung ? '<br>' + rich(W.erklaerung) : ''}</div>` + grundHTML(item, W) + `<p class="muted small">Passt deine Antwort dazu?</p>` + rateButtons();
    } else {
      const wf = !solved && letzte ? warumFalsch(W, letzte) : '';
      h += `<div class="mc">${opts.map((o, j) => `<button class="mc-o ${picked.has(j) ? (o === W.antwort ? 'ok' : 'no') : solved && o === W.antwort ? 'ok' : ''}" data-a="pick" data-d="${j}" ${solved ? 'disabled' : ''}>${rich(o)}</button>`).join('')}</div>`;
      if (letzte != null && !solved) h += `<div class="fb bad"><b>Nicht das.</b> ${rich(wf || 'Überleg, was ohne diesen Schritt passieren würde.')}</div>` + grundHTML(item, W);
      if (solved) h += (W.erklaerung ? `<div class="fb info"><b>Darum.</b> ${rich(W.erklaerung)}</div>` : '') + weiterBtn(ctx);
      else if (!ctx.exam) h += `<div class="act"><button class="btn" data-a="sol">Lösung zeigen</button></div>`;
    }
    el.innerHTML = h;
  }
  on(el, {
    auf: () => { const ta = el.querySelector('[data-k="antw"]'); text = ta ? ta.value.trim() : ''; open = true; draw(); },
    rate: d => { if (d === 'falsch') logError(meta, item, { aufgabe: W.frage, eingabe: text, richtig: W.antwort, fehlerart: fall ? 'Fall falsch eingeschätzt' : 'Begründung gefehlt' }); ctx.onDone(d); },
    pick: j => {
      if (solved) return;
      const o = opts[+j];
      picked.add(+j);
      if (ctx.exam) { if (o !== W.antwort) logError(meta, item, { aufgabe: W.frage, eingabe: o, richtig: W.antwort, fehlerart: 'Falsche Auswahl', meldung: warumFalsch(W, o) }); ctx.onDone(o === W.antwort ? 'richtig' : 'falsch', { aufgabe: W.frage, eingabe: o, richtig: W.antwort }); return; }
      if (o === W.antwort) solved = true;
      else { letzte = o; tries++; if (tries === 1) logError(meta, item, { aufgabe: W.frage, eingabe: o, richtig: W.antwort, fehlerart: 'Falsche Auswahl', meldung: warumFalsch(W, o) }); }
      draw();
    },
    sol: () => { shown = solved = true; opts.forEach((o, j) => { if (o === W.antwort) picked.add(j); }); draw(); },
    fertig: () => ctx.onDone(shown ? 'falsch' : tries ? 'hilfe' : 'richtig')
  });
  draw();
}

/* ===== Rechenweg: Bausteine ordnen, im Kopf oder auf Papier rechnen, dann aufdecken =====
 * Jedes Mal neue Zahlen. Die Lösung rechnet die App selbst aus. Keine Eingabe des Ergebnisses.
 */
export function schrittGrafik(R) {
  const zeile = s => {
    if (!s.formel || s.wert == null) return s.wert != null ? `<div class="rw-f"><b>${fmtNum(s.wert)}</b> ${esc(s.einheit)}</div>` : '';
    const links = s.name ? fml(s.name) + ' = ' : '= ';
    return `<div class="rw-f">${fml(s.formel)}</div><div class="rw-f">${links}${fmlWith(s.formel, s.vorher)}</div><div class="rw-f">${links}<b>${fmtNum(s.wert)}</b>${s.einheit ? ' ' + esc(s.einheit) : ''}</div>`;
  };
  return `<ol class="rw-weg">${R.steps.map((s, k) => `<li class="rw-s"><span class="rw-n">${k + 1}</span><div class="rw-b"><div class="rw-was">${rich(s.was)}</div>${s.sinn ? `<div class="rw-sinn">${rich(s.sinn)}</div>` : ''}${zeile(s)}</div></li>`).join('')}</ol>`
    + `<div class="rw-end"><span>Ergebnis</span><b>${fmtNum(R.final.wert)}${R.final.einheit ? ' ' + esc(R.final.einheit) : ''}</b></div>`;
}
export function runRechenweg(el, item, ctx, meta) {
  const A = item.aufgabe;
  const R = rechenweg(A);
  const { vor, streng } = abhaengigkeiten(A.schritte);
  let pool = shuffle(R.steps.map((s, k) => k));
  while (pool.length > 1 && pool.every((p, k) => p === k)) pool = shuffle(pool);
  let seq = [], checked = null, tries = 0, shown = false, phase = 'ordnen', hinweis = '';
  const kopf = () => ctxLine(meta) + `<div class="card-k">Rechenweg · neue Zahlen</div>` + zusatzHTML(item, A) + `<div class="ex-task">${rich(R.text)}</div>`
    + (R.gegeben.length || R.gesucht.length ? `<details class="disc gg"><summary>Gegeben und gesucht</summary>${R.gegeben.map(g => `<p>${rich(g)}</p>`).join('')}${R.gesucht.map(g => `<p><b>Gesucht:</b> ${rich(g)}</p>`).join('')}</details>` : '');
  function draw() {
    let h = kopf();
    if (phase === 'ordnen') {
      h += `<p class="muted">Was machst du zuerst? Tippe die Bausteine in der Reihenfolge an, in der du rechnest.</p>`;
      h += `<div class="seq">${seq.map((k, i) => `<button class="seq-i ${checked ? (checked[i] ? 'ok' : 'no') : ''}" data-a="raus" data-d="${i}"><span class="seq-n">${i + 1}</span><span>${rich(R.steps[k].was)}</span></button>`).join('') || '<div class="muted small">Noch leer.</div>'}</div>`;
      if (pool.length) h += `<div class="pool">${pool.map((k, i) => `<button class="pool-i" data-a="rein" data-d="${i}"><span>${rich(R.steps[k].was)}</span></button>`).join('')}</div>`;
      if (checked && !checked.every(Boolean)) h += `<div class="fb bad"><b>Rot heißt: Dieser Baustein steht hier zu früh.</b> ${rich(hinweis)} Tipp ihn an, dann kommt er zurück nach unten.</div>` + grundHTML(item, A);
      h += !pool.length ? `<div class="act"><button class="btn filled" data-a="pruefen">Prüfen</button><button class="btn" data-a="sol">Lösung</button></div>` : `<div class="act"><button class="btn" data-a="sol">Lösung</button></div>`;
    } else if (phase === 'rechnen') {
      h += `<div class="fb ${shown ? 'info' : 'good'}"><b>${shown ? 'So ist der Weg.' : 'Der Weg stimmt.'}</b> Rechne jetzt im Kopf oder auf Papier. Dann deck auf.</div>`;
      h += `<ol class="rw-weg rw-zu">${R.steps.map((s, k) => `<li class="rw-s"><span class="rw-n">${k + 1}</span><div class="rw-b"><div class="rw-was">${rich(s.was)}</div></div></li>`).join('')}</ol>`;
      h += `<div class="btn-col"><button class="btn filled" data-a="auf">Ergebnis aufdecken</button></div>`;
    } else {
      h += schrittGrafik(R) + `<p class="muted small">Stimmt dein Ergebnis?</p>` + rateButtons();
    }
    el.innerHTML = h;
  }
  on(el, {
    rein: i => { checked = null; seq.push(pool.splice(+i, 1)[0]); draw(); },
    raus: i => { checked = null; pool.push(seq.splice(+i, 1)[0]); draw(); },
    pruefen: () => {
      checked = reihenfolgePruefen(A.schritte, seq);
      if (checked.every(Boolean)) {
        // Erlaubte Reihenfolge: die Bausteine so anzeigen, wie du sie gelegt hast
        R.steps = seq.map(k => R.steps[k]); phase = 'rechnen'; draw(); return;
      }
      const i = checked.findIndex(x => !x), k = seq[i];
      const fehlt = streng ? [] : vor[k].filter(j => !seq.slice(0, i).includes(j));
      hinweis = fehlt.length ? 'Baustein ' + (i + 1) + ' braucht vorher: ' + fehlt.map(j => '„' + R.steps[j].was + '“').join(', ') + '.' : 'Ab Baustein ' + (i + 1) + ' weicht dein Weg ab.';
      tries++;
      if (tries === 1) logError(meta, item, { aufgabe: 'Rechenweg: ' + A.text.replace(/\{[^}]+\}/g, '…'), eingabe: seq.map(j => R.steps[j].was).join(' → '), richtig: R.steps.map(s => s.was).join(' → '), fehlerart: 'Reihenfolge', meldung: hinweis });
      draw();
    },
    sol: () => { shown = true; seq = R.steps.map((s, k) => k); pool = []; phase = 'rechnen'; draw(); },
    auf: () => { phase = 'offen'; draw(); },
    rate: d => {
      const weg = shown ? 'falsch' : tries ? 'hilfe' : 'richtig';
      if (d === 'falsch') logError(meta, item, { aufgabe: R.text, eingabe: '', richtig: fmtNum(R.final.wert) + ' ' + R.final.einheit, fehlerart: 'Rechenfehler' });
      ctx.onDone(schlechter(weg, d));
    }
  });
  draw();
}
