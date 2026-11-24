// Rechenweg: Zahlen würfeln, jeden Schritt im Code ausrechnen, Reihenfolge der Bausteine prüfen.
// Reine Funktionen ohne Oberfläche, getestet in tests/parser.test.mjs.
import { parseEq, evaluate, varsOf, keyOf } from './formula.js';
import { fmtNum } from './util.js';

const rundeAuf = (v, s) => Number((Math.round(v / s) * s).toFixed(6));
const SUP = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', '-': '⁻', '−': '⁻' };

// Ein Schritt: Gleichung mit Namen links (M = F · a) oder nur eine Rechnung (F * a / l)
function schrittFormel(s) {
  const e = s.ergebnis;
  if (!e || (e.typ !== 'gleichung' && e.typ !== 'ausdruck')) return null;
  try {
    const p = parseEq(e.text);
    const name = p.l && p.l.t === 'var' ? p.l.n : null;
    return { name, rechts: p.r, quelle: e.text, braucht: [...varsOf(p.r)].map(keyOf) };
  } catch (err) { return null; }
}

// Welche Schritte vor einem Schritt stehen müssen: die, deren Ergebnis er benutzt
export function abhaengigkeiten(schritte) {
  const f = schritte.map(schrittFormel);
  const wer = new Map();
  f.forEach((x, k) => { if (x && x.name) wer.set(keyOf(x.name), k); });
  const vor = f.map((x, k) => (x ? [...new Set(x.braucht.map(n => wer.get(n)).filter(j => j != null && j !== k))] : []));
  // Schritte ohne Rechnung (Skizze zeichnen, Drehpunkt wählen) bleiben an ihrem Platz: alles davor muss vorher kommen, alles danach später
  f.forEach((x, k) => {
    if (x) return;
    for (let j = 0; j < k; j++) if (!vor[k].includes(j)) vor[k].push(j);
    for (let j = k + 1; j < f.length; j++) if (!vor[j].includes(k)) vor[j].push(k);
  });
  // Ohne erkennbare Abhängigkeiten zählt die Reihenfolge, wie sie im Block steht
  const frei = f.some((x, k) => x && vor[k].some(j => f[j]));
  return { vor, streng: !frei };
}

// Reihenfolge prüfen: folge ist eine Liste von Schritt-Nummern. Ergebnis je Platz: true, wenn er dort stehen darf.
export function reihenfolgePruefen(schritte, folge) {
  const { vor, streng } = abhaengigkeiten(schritte);
  if (streng) return folge.map((k, i) => k === i);
  const gesehen = new Set();
  return folge.map(k => { const ok = vor[k].every(j => gesehen.has(j)); gesehen.add(k); return ok; });
}

// Zahlen würfeln und den Weg ausrechnen. rnd für Tests austauschbar.
export function rechenweg(a, rnd = Math.random) {
  const formeln = a.schritte.map(schrittFormel);
  let best = null;
  for (let versuch = 0; versuch < 80; versuch++) {
    const vals = {};
    for (const v of a.variablen || []) {
      const n = Math.floor((v.bis - v.von) / v.schritt + 1e-9);
      vals[keyOf(v.name)] = rundeAuf(v.von + Math.floor(rnd() * (n + 1)) * v.schritt, v.schritt);
    }
    const basis = Object.assign({}, vals);
    const steps = [];
    let ok = true;
    a.schritte.forEach((s, k) => {
      const f = formeln[k];
      const o = { was: s.was, sinn: s.tipp || '', einheit: s.einheit || '', formel: f ? f.quelle : '', name: f && f.name, wert: null, vorher: Object.assign({}, vals) };
      if (f) {
        try { o.wert = evaluate(f.rechts, vals); } catch (e) { o.wert = null; }
        if (o.wert == null || !isFinite(o.wert)) ok = false;
        else if (f.name) vals[keyOf(f.name)] = o.wert;
      } else if (s.ergebnis && s.ergebnis.typ === 'zahl') o.wert = s.ergebnis.zahl;
      steps.push(o);
    });
    let final = null;
    if (a.rechnung) {
      try { const p = parseEq(a.rechnung); final = evaluate(p.r, vals); } catch (e) { final = null; }
    }
    const letzter = [...steps].reverse().find(s => s.wert != null);
    if (final == null && letzter) final = letzter.wert;
    if (final == null || !isFinite(final) || final === 0) ok = false;
    const passt = ok && (!a.bereich || (final >= a.bereich.min && final <= a.bereich.max));
    const einheit = (a.ergebnis && a.ergebnis.einheit) || (letzter && letzter.einheit) || '';
    best = { vals: basis, alle: vals, steps, final: { wert: final, einheit }, imBereich: passt };
    if (passt || !(a.variablen || []).length) break;
  }
  // Einheit der Variable anhängen, außer sie steht schon hinter dem Platzhalter
  const fill = s => String(s || '').replace(/\{([^}]+)\}/g, (m, n, pos, ganz) => {
    const k = keyOf(n.trim());
    if (!(k in best.vals)) return m;
    const v = (a.variablen || []).find(x => keyOf(x.name) === k);
    const steht = v && v.einheit && ganz.slice(pos + m.length).trimStart().startsWith(v.einheit);
    return fmtNum(best.vals[k]) + (v && v.einheit && !steht ? ' ' + v.einheit : '');
  }).replace(/\^([−-]?\d+)(?![\d,])/g, (m, e) => [...e].map(c => SUP[c]).join(''));
  best.text = fill(a.text);
  best.gegeben = (a.gegeben || []).map(fill);
  best.gesucht = (a.gesucht || []).map(fill);
  best.tipps = (a.tipps || []).map(fill);
  best.steps.forEach(s => { s.was = fill(s.was); s.sinn = fill(s.sinn); });
  // Gegebene Werte mit Einheit, für die Liste unter der Aufgabe
  best.werte = (a.variablen || []).map(v => ({ name: v.name, wert: best.vals[keyOf(v.name)], einheit: v.einheit || '' }));
  return best;
}
