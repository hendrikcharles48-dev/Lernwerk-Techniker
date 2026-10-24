// Sicherer Formel-Parser. Kein eval.
// Kann: + − · / ^ ² ³, Klammern, Wurzel, sin cos tan (Grad), asin acos atan (Ergebnis in Grad),
// ln, lg, abs, π, implizites Mal (2πd, 2(a+b), m g).
import { esc, fmtNum } from './util.js';

const FUNCS = {
  sin: 'sin', cos: 'cos', tan: 'tan',
  asin: 'asin', acos: 'acos', atan: 'atan', arcsin: 'asin', arccos: 'acos', arctan: 'atan',
  sqrt: 'sqrt', wurzel: 'sqrt', ln: 'ln', lg: 'lg', log: 'lg', abs: 'abs'
};
const ID_START = /[A-Za-zÄÖÜäöüßΑ-Ωα-ωµû]/;
const ID_PART = /[A-Za-z0-9_ÄÖÜäöüßΑ-Ωα-ωµû]/;

export class FormulaError extends Error {
  constructor(msg, pos) { super(msg); this.pos = pos; }
}

export function tokenize(src) {
  const s = String(src);
  const t = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/[0-9]/.test(c) || (/[.,]/.test(c) && /[0-9]/.test(s[i + 1] || ''))) {
      let j = i;
      while (j < s.length && /[0-9]/.test(s[j])) j++;
      if (/[.,]/.test(s[j] || '') && /[0-9]/.test(s[j + 1] || '')) { j++; while (j < s.length && /[0-9]/.test(s[j])) j++; }
      t.push({ k: 'num', v: parseFloat(s.slice(i, j).replace(',', '.')), p: i });
      i = j; continue;
    }
    if (c === 'π') { t.push({ k: 'const', v: 'pi', p: i }); i++; continue; }
    if (c === '√' || c === '∛') { t.push({ k: 'root', v: c === '√' ? 2 : 3, p: i }); i++; continue; }
    if (ID_START.test(c)) {
      let j = i + 1;
      while (j < s.length && ID_PART.test(s[j])) j++;
      const w = s.slice(i, j);
      const lw = w.toLowerCase();
      if (lw === 'pi') t.push({ k: 'const', v: 'pi', p: i });
      else if (w === 'e') t.push({ k: 'const', v: 'e', p: i });   // Eulersche Zahl
      else if (FUNCS[lw]) t.push({ k: 'fn', v: FUNCS[lw], p: i });
      else t.push({ k: 'id', v: w, p: i });
      i = j; continue;
    }
    if ('+-−–'.includes(c)) { t.push({ k: 'op', v: c === '+' ? '+' : '-', p: i }); i++; continue; }
    if ('*·×⋅∙'.includes(c)) { t.push({ k: 'op', v: '*', p: i }); i++; continue; }
    if ('/:÷'.includes(c)) { t.push({ k: 'op', v: '/', p: i }); i++; continue; }
    if (c === '^') { t.push({ k: 'op', v: '^', p: i }); i++; continue; }
    if (c === '²' || c === '³') { t.push({ k: 'sup', v: c === '²' ? 2 : 3, p: i }); i++; continue; }
    if ('([{'.includes(c)) { t.push({ k: '(', p: i }); i++; continue; }
    if (')]}'.includes(c)) { t.push({ k: ')', p: i }); i++; continue; }
    if (c === '=') { t.push({ k: '=', p: i }); i++; continue; }
    if (c === '%') { t.push({ k: 'pct', p: i }); i++; continue; }
    throw new FormulaError('Das Zeichen „' + c + '“ kann ich nicht lesen.', i);
  }
  return t;
}

function parser(tokens) {
  let p = 0;
  const peek = () => tokens[p];
  const next = () => tokens[p++];
  const isOp = v => peek() && peek().k === 'op' && peek().v === v;
  const startsPrimary = tk => tk && (tk.k === 'num' || tk.k === 'id' || tk.k === 'const' || tk.k === 'fn' || tk.k === 'root' || tk.k === '(');

  function expr() {
    let a = term();
    while (isOp('+') || isOp('-')) {
      const o = next().v;
      a = { t: o === '+' ? 'add' : 'sub', a, b: term() };
    }
    return a;
  }
  function term() {
    let a = unary();
    for (;;) {
      if (isOp('*')) { next(); a = { t: 'mul', a, b: unary() }; }
      else if (isOp('/')) { next(); a = { t: 'div', a, b: unary() }; }
      else if (startsPrimary(peek())) a = { t: 'mul', a, b: power(), imp: true };
      else return a;
    }
  }
  function unary() {
    if (isOp('-')) { next(); return { t: 'neg', a: unary() }; }
    if (isOp('+')) { next(); return unary(); }
    return power();
  }
  function power() {
    const base = postfix();
    if (isOp('^')) { next(); return { t: 'pow', a: base, b: unary() }; }
    return base;
  }
  function postfix() {
    let a = primary();
    for (;;) {
      const tk = peek();
      if (tk && tk.k === 'sup') { next(); a = { t: 'pow', a, b: { t: 'num', v: tk.v } }; }
      else if (tk && tk.k === 'pct') { next(); a = { t: 'div', a, b: { t: 'num', v: 100 } }; }
      else return a;
    }
  }
  function primary() {
    const tk = next();
    if (!tk) throw new FormulaError('Da fehlt noch etwas am Ende.', Infinity);
    if (tk.k === 'num') return { t: 'num', v: tk.v };
    if (tk.k === 'const') return { t: 'const', v: tk.v };
    if (tk.k === 'id') return { t: 'var', n: tk.v };
    if (tk.k === '(') {
      const e = expr();
      const c = next();
      if (!c || c.k !== ')') throw new FormulaError('Eine Klammer wird nicht geschlossen.', tk.p);
      return { t: 'par', a: e };
    }
    if (tk.k === 'fn') {
      const arg = peek() && peek().k === '(' ? postfix() : power();
      return tk.v === 'sqrt' ? { t: 'root', n: 2, a: strip(arg) } : { t: 'fn', f: tk.v, a: strip(arg) };
    }
    if (tk.k === 'root') return { t: 'root', n: tk.v, a: strip(postfix()) };
    if (tk.k === ')') throw new FormulaError('Hier ist eine Klammer zu viel.', tk.p);
    if (tk.k === '=') throw new FormulaError('Vor dem Gleichheitszeichen fehlt etwas.', tk.p);
    throw new FormulaError('An dieser Stelle erwarte ich eine Zahl oder Größe.', tk.p);
  }
  return {
    full() {
      const e = expr();
      if (p < tokens.length) {
        const tk = peek();
        if (tk.k === ')') throw new FormulaError('Hier ist eine Klammer zu viel.', tk.p);
        if (tk.k === '=') throw new FormulaError('Hier darf kein zweites Gleichheitszeichen stehen.', tk.p);
        throw new FormulaError('Das passt hier nicht hin.', tk.p);
      }
      return e;
    }
  };
}
const strip = n => (n && n.t === 'par' ? n.a : n);

export function parseExpr(src) {
  const t = tokenize(src);
  if (!t.length) throw new FormulaError('Das Feld ist leer.', 0);
  if (t.some(x => x.k === '=')) throw new FormulaError('Hier ist kein Gleichheitszeichen erlaubt.', t.find(x => x.k === '=').p);
  return parser(t).full();
}

// Gleichung: gibt {l, r} zurück; ohne Gleichheitszeichen nur {r}.
export function parseEq(src) {
  const t = tokenize(src);
  const eqs = t.filter(x => x.k === '=');
  if (eqs.length > 1) throw new FormulaError('Nur ein Gleichheitszeichen, bitte.', eqs[1].p);
  if (!eqs.length) return { l: null, r: parser(t).full() };
  const i = t.indexOf(eqs[0]);
  if (i === 0) throw new FormulaError('Links vom Gleichheitszeichen fehlt etwas.', 0);
  if (i === t.length - 1) throw new FormulaError('Rechts vom Gleichheitszeichen fehlt etwas.', eqs[0].p);
  return { l: parser(t.slice(0, i)).full(), r: parser(t.slice(i + 1)).full() };
}

/* ===== Rechnen ===== */
const RAD = Math.PI / 180;
export const keyOf = n => String(n).replace(/_/g, '');

export function evaluate(n, vars = {}) {
  switch (n.t) {
    case 'num': return n.v;
    case 'const': return n.v === 'e' ? Math.E : Math.PI;
    case 'var': {
      const k = keyOf(n.n);
      if (k in vars) return vars[k];
      throw new FormulaError('Die Größe ' + n.n + ' kenne ich hier nicht.', 0);
    }
    case 'par': return evaluate(n.a, vars);
    case 'neg': return -evaluate(n.a, vars);
    case 'add': return evaluate(n.a, vars) + evaluate(n.b, vars);
    case 'sub': return evaluate(n.a, vars) - evaluate(n.b, vars);
    case 'mul': return evaluate(n.a, vars) * evaluate(n.b, vars);
    case 'div': return evaluate(n.a, vars) / evaluate(n.b, vars);
    case 'pow': return Math.pow(evaluate(n.a, vars), evaluate(n.b, vars));
    case 'root': { const v = evaluate(n.a, vars); return n.n === 3 ? Math.cbrt(v) : Math.sqrt(v); }
    case 'fn': {
      const v = evaluate(n.a, vars);
      switch (n.f) {
        case 'sin': return Math.sin(v * RAD);
        case 'cos': return Math.cos(v * RAD);
        case 'tan': return Math.tan(v * RAD);
        case 'asin': return Math.asin(v) / RAD;
        case 'acos': return Math.acos(v) / RAD;
        case 'atan': return Math.atan(v) / RAD;
        case 'ln': return Math.log(v);
        case 'lg': return Math.log10(v);
        case 'abs': return Math.abs(v);
      }
    }
  }
  throw new FormulaError('Unbekannter Ausdruck.', 0);
}

export function varsOf(n, out = new Set()) {
  if (!n) return out;
  if (n.t === 'var') out.add(keyOf(n.n));
  for (const k of ['a', 'b', 'l', 'r']) if (n[k]) varsOf(n[k], out);
  return out;
}
// Originalschreibweise der Variablen (R_ges statt Rges)
export function varNames(n, out = new Map()) {
  if (!n) return out;
  if (n.t === 'var' && !out.has(keyOf(n.n))) out.set(keyOf(n.n), n.n);
  for (const k of ['a', 'b', 'l', 'r']) if (n[k]) varNames(n[k], out);
  return out;
}

// Rechnet einen Ausdruck aus Text aus. Gibt null zurück, wenn es nicht geht.
export function calc(src, vars = {}) {
  try {
    const e = parseEq(src);
    const v = evaluate(e.r, vars);
    return isFinite(v) ? v : null;
  } catch (e) { return null; }
}

/* ===== Darstellung als HTML mit echtem Bruchstrich ===== */
const GREEK_NAME = {
  α: 'Alpha', β: 'Beta', γ: 'Gamma', δ: 'Delta', Δ: 'Delta', ε: 'Epsilon', η: 'Eta', θ: 'Theta', λ: 'Lambda',
  μ: 'My', ν: 'Ny', π: 'Pi', ρ: 'Rho', σ: 'Sigma', τ: 'Tau', φ: 'Phi', ϕ: 'Phi', ω: 'Omega', Ω: 'Omega', ξ: 'Xi'
};
function splitName(name) {
  const s = String(name);
  if (s.includes('_')) { const i = s.indexOf('_'); return [s.slice(0, i), s.slice(i + 1).replace(/_/g, '')]; }
  let base = s[0];
  let rest = s.slice(1);
  if (base === 'Δ' && rest) { base += rest[0]; rest = rest.slice(1); }
  return [base, rest];
}
export function nameHTML(name) {
  const [b, sub] = splitName(name);
  return '<span class="v"><var>' + esc(b) + '</var>' + (sub ? '<sub>' + esc(sub) + '</sub>' : '') + '</span>';
}
const PREC = { add: 1, sub: 1, neg: 2, mul: 3, div: 3, pow: 5 };
function prec(n) { return PREC[n.t] || 9; }

const OP = o => '<span class="op">' + o + '</span>';
export function toHTML(n) {
  const wrap = (x, min) => (prec(x) < min ? '<span class="paren">(</span>' + toHTML(x) + '<span class="paren">)</span>' : toHTML(x));
  switch (n.t) {
    case 'num': return '<span class="n">' + fmtNum(n.v, 6) + '</span>';
    case 'const': return n.v === 'e' ? '<var>e</var>' : '<var>π</var>';
    case 'var': return nameHTML(n.n);
    case 'par': return '<span class="paren">(</span>' + toHTML(n.a) + '<span class="paren">)</span>';
    case 'neg': return '<span class="sg">−</span>' + wrap(n.a, 3);
    case 'add': return toHTML(n.a) + OP('+') + wrap(n.b, 1);
    case 'sub': return toHTML(n.a) + OP('−') + wrap(n.b, 2);
    case 'mul': return wrap(n.a, 3) + OP('·') + wrap(n.b, 3);
    case 'div': return '<span class="frac"><span class="fn">' + toHTML(strip(n.a)) + '</span><span class="fd">' + toHTML(strip(n.b)) + '</span></span>';
    case 'pow': return '<span class="pw">' + wrap(n.a, 6) + '<sup>' + toHTML(strip(n.b)) + '</sup></span>';
    case 'root': return '<span class="root">' + (n.n === 3 ? '<sup class="ri">3</sup>' : '') + '√<span class="rad">' + toHTML(n.a) + '</span></span>';
    case 'fn': return n.f.replace('asin', 'arcsin').replace('acos', 'arccos').replace('atan', 'arctan') + '<span class="paren">(</span>' + toHTML(n.a) + '<span class="paren">)</span>';
  }
  return '';
}

// Ganze Gleichung oder Ausdruck aus Text. Fällt bei Lesefehlern auf den Text zurück.
export function fml(src) {
  try {
    const e = parseEq(src);
    return '<span class="fml">' + (e.l ? toHTML(e.l) + OP('=') : '') + toHTML(e.r) + '</span>';
  } catch (err) { return '<span class="fml">' + esc(src) + '</span>'; }
}

/* ===== Gesprochene Fassung für den Hörmodus ===== */
const ZAHLWORT = ['null', 'eins', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun'];
function nameSpeech(name) {
  const [b, sub] = splitName(name);
  const sp = ch => GREEK_NAME[ch] || ch;
  const base = [...b].map(sp).join(' ');
  if (!sub) return base;
  if (/^\d$/.test(sub)) return base + ' ' + ZAHLWORT[+sub];
  return base + ' ' + [...sub].map(sp).join('');
}
export function toSpeech(n) {
  const grouped = x => (prec(x) < 9 && x.t !== 'pow' && x.t !== 'root' && x.t !== 'fn' ? 'Klammer ' + toSpeech(x) + ' Klammer zu' : toSpeech(x));
  switch (n.t) {
    case 'num': return fmtNum(n.v, 6);
    case 'const': return n.v === 'e' ? 'e' : 'Pi';
    case 'var': return nameSpeech(n.n);
    case 'par': return toSpeech(n.a);
    case 'neg': return 'minus ' + toSpeech(n.a);
    case 'add': return toSpeech(n.a) + ' plus ' + toSpeech(n.b);
    case 'sub': return toSpeech(n.a) + ' minus ' + toSpeech(n.b);
    case 'mul': return toSpeech(n.a) + ' mal ' + toSpeech(n.b);
    case 'div': {
      const a = strip(n.a), b = strip(n.b);
      const simple = x => prec(x) >= 5;
      if (simple(a) && simple(b)) return toSpeech(a) + ' geteilt durch ' + toSpeech(b);
      return 'Bruch, oben ' + toSpeech(a) + ', unten ' + toSpeech(b) + ', Bruch Ende';
    }
    case 'pow': {
      const e = strip(n.b);
      if (e.t === 'num' && e.v === 2) return grouped(n.a) + ' Quadrat';
      if (e.t === 'num' && e.v === 3) return grouped(n.a) + ' hoch drei';
      return grouped(n.a) + ' hoch ' + toSpeech(e);
    }
    case 'root': return (n.n === 3 ? 'dritte Wurzel aus ' : 'Wurzel aus ') + toSpeech(n.a) + (prec(n.a) < 5 ? ', Wurzel Ende' : '');
    case 'fn': return { sin: 'Sinus', cos: 'Kosinus', tan: 'Tangens', asin: 'Arkussinus', acos: 'Arkuskosinus', atan: 'Arkustangens', ln: 'natürlicher Logarithmus', lg: 'Logarithmus', abs: 'Betrag' }[n.f] + ' von ' + toSpeech(n.a);
  }
  return '';
}
export function speakFml(src) {
  try {
    const e = parseEq(src);
    return (e.l ? toSpeech(e.l) + ' ist gleich ' : '') + toSpeech(e.r);
  } catch (err) { return String(src); }
}

// Unbekannte Namen wie "mg" in bekannte Größen zerlegen (m · g).
function splitVar(name, known) {
  const k = keyOf(name);
  if (known.has(k)) return null;
  const sorted = [...known].sort((a, b) => b.length - a.length);
  const parts = [];
  let rest = k;
  while (rest) {
    const hit = sorted.find(x => rest.startsWith(x));
    if (!hit) return null;
    parts.push(hit); rest = rest.slice(hit.length);
  }
  return parts.length > 1 ? parts : null;
}
function splitAst(n, known) {
  if (!n) return n;
  if (n.t === 'var') {
    const p = splitVar(n.n, known);
    return p ? p.map(x => ({ t: 'var', n: x })).reduce((a, b) => ({ t: 'mul', a, b, imp: true })) : n;
  }
  const c = Object.assign({}, n);
  for (const k of ['a', 'b']) if (c[k]) c[k] = splitAst(c[k], known);
  return c;
}
function splitEq(e, formula) {
  const f = parseEq(formula);
  const known = varsOf(f.l, varsOf(f.r));
  return { l: e.l && splitAst(e.l, known), r: splitAst(e.r, known) };
}

/* ===== Umstellen prüfen: Zahlenproben statt Computeralgebra ===== */
const rnd = () => 1.3 + Math.random() * 8.4;
const close = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));

// Erzeugt Belegungen, die die Ausgangsformel erfüllen. ref = Lösung "ziel = ..."
export function samples(formula, target, refSolution, n = 6) {
  const f = parseEq(formula);
  const ref = parseEq(refSolution);
  const all = varsOf(f.l, varsOf(f.r));
  const T = keyOf(target);
  const out = [];
  for (let k = 0; k < 80 && out.length < n; k++) {
    const v = {};
    for (const x of all) if (x !== T) v[x] = rnd();
    let t;
    try { t = evaluate(ref.r, v); } catch (e) { continue; }
    if (!isFinite(t)) continue;
    v[T] = t;
    try {
      const l = f.l ? evaluate(f.l, v) : 0, r = evaluate(f.r, v);
      if (isFinite(l) && isFinite(r) && close(l, r, 1e-7)) out.push(v);
    } catch (e) { /* weiter */ }
  }
  return out;
}

// Prüft eine Eingabe "ziel = ..." gegen die Ausgangsformel.
// Ergebnis: {ok, msg, fehlerart}
export function checkSolved(formula, target, refSolution, input) {
  let u;
  try { u = splitEq(parseEq(input), formula); } catch (e) { return { ok: false, msg: e.message, fehlerart: 'Schreibweise' }; }
  const T = keyOf(target);
  const tName = target;
  let side;
  if (!u.l) side = u.r;
  else if (u.l.t === 'var' && keyOf(u.l.n) === T) side = u.r;
  else if (u.r.t === 'var' && keyOf(u.r.n) === T) side = u.l;
  else return { ok: false, msg: tName + ' muss allein auf einer Seite stehen. Schreib es so: ' + tName + ' = …', fehlerart: 'Nicht freigestellt' };
  if (varsOf(side).has(T)) return { ok: false, msg: tName + ' steht noch auf beiden Seiten. Es muss ganz allein stehen.', fehlerart: 'Nicht freigestellt' };
  const known = varsOf(parseEq(formula).l, varsOf(parseEq(formula).r));
  for (const x of varsOf(side)) if (!known.has(x)) return { ok: false, msg: 'Die Größe ' + x + ' kommt in der Formel nicht vor. Vertippt?', fehlerart: 'Schreibweise' };
  const S = samples(formula, target, refSolution);
  if (!S.length) return { ok: false, msg: 'Diese Aufgabe kann ich gerade nicht prüfen.', fehlerart: '' };
  const pairs = [];
  for (const v of S) {
    let x;
    try { x = evaluate(side, v); } catch (e) { return { ok: false, msg: e.message, fehlerart: 'Schreibweise' }; }
    pairs.push([x, v[T], v]);
  }
  if (pairs.every(([x, t]) => close(x, t))) return { ok: true };
  return Object.assign({ ok: false }, diagnose(pairs, T));
}

function constRatio(pairs, f) {
  const r = pairs.map(f);
  if (r.some(x => !isFinite(x))) return null;
  return r.every(x => close(x, r[0], 1e-5)) ? r[0] : null;
}
function diagnose(pairs, T) {
  const r = constRatio(pairs, ([x, t]) => x / t);
  if (r != null) {
    if (close(r, -1)) return { msg: 'Der Betrag stimmt, aber das Vorzeichen nicht. Wenn du etwas auf die andere Seite bringst, wird aus plus minus und aus minus plus.', fehlerart: 'Vorzeichen' };
    if (close(r, 1000) || close(r, 0.001)) return { msg: 'Du liegst um den Faktor 1000 daneben. Prüf die Umrechnungszahl in der Formel.', fehlerart: 'Faktor 1000' };
    return { msg: 'Fast: Die Größen stimmen, aber ein Zahlenfaktor nicht. Prüf Zahlen wie 2, 4 oder 1000 in der Formel.', fehlerart: 'Zahlenfaktor' };
  }
  if (constRatio(pairs, ([x, t]) => x * t) != null) return { msg: 'Dein Bruch steht auf dem Kopf. Prüf, was über und was unter den Bruchstrich gehört.', fehlerart: 'Kehrwert' };
  if (constRatio(pairs, ([x, t]) => x / (t * t)) != null) return { msg: 'Du hast ein Quadrat zu viel. Hast du vergessen, die Wurzel zu ziehen?', fehlerart: 'Wurzel oder Quadrat' };
  if (constRatio(pairs, ([x, t]) => (x * x) / t) != null) return { msg: 'Da ist eine Wurzel zu viel. Am Ende musst du nur so oft die Wurzel ziehen, wie das Quadrat vorkommt.', fehlerart: 'Wurzel oder Quadrat' };
  const names = Object.keys(pairs[0][2]).filter(k => k !== T);
  for (const n of names) {
    if (constRatio(pairs, ([x, t, v]) => x / (t * v[n] * v[n])) != null || constRatio(pairs, ([x, t, v]) => (x * v[n] * v[n]) / t) != null)
      return { msg: 'Bei ' + n + ' hast du mal und geteilt verwechselt. Was auf der einen Seite mal steht, kommt auf der anderen Seite geteilt an.', fehlerart: 'Mal und geteilt verwechselt' };
    if (constRatio(pairs, ([x, t, v]) => (x - t) / v[n]) != null)
      return { msg: 'Bei ' + n + ' stimmt das Vorzeichen nicht. Aus plus wird beim Rüberbringen minus.', fehlerart: 'Vorzeichen' };
  }
  return { msg: 'Das stimmt noch nicht. Mach die Probe: setz einfache Zahlen ein und schau, ob beide Seiten gleich sind. Geh dann Schritt für Schritt von außen nach innen.', fehlerart: 'Umstellen' };
}

// Prüft einen Zwischenschritt: Die Gleichung muss aus der Formel folgen und darf nicht immer wahr sein.
export function checkStep(formula, target, refSolution, input) {
  let u;
  try { u = splitEq(parseEq(input), formula); } catch (e) { return { ok: false, msg: e.message, fehlerart: 'Schreibweise' }; }
  if (!u.l) return { ok: false, msg: 'Schreib die ganze Gleichung mit Gleichheitszeichen.', fehlerart: 'Schreibweise' };
  const f = parseEq(formula);
  const known = varsOf(f.l, varsOf(f.r));
  for (const x of varsOf(u.l, varsOf(u.r))) if (!known.has(x)) return { ok: false, msg: 'Die Größe ' + x + ' kommt in der Formel nicht vor. Vertippt?', fehlerart: 'Schreibweise' };
  const S = samples(formula, target, refSolution);
  let holds = true;
  try { holds = S.every(v => close(evaluate(u.l, v), evaluate(u.r, v), 1e-6)); } catch (e) { return { ok: false, msg: e.message, fehlerart: 'Schreibweise' }; }
  if (!holds) return { ok: false, msg: 'Diese Gleichung stimmt nicht mehr mit der Formel überein. Hast du auf beiden Seiten genau dasselbe gemacht?', fehlerart: 'Nur eine Seite umgeformt' };
  // Immer wahr? Dann mit zufälligen, nicht passenden Werten prüfen
  const T = keyOf(target);
  let always = true;
  for (const v of S) {
    const w = Object.assign({}, v, { [T]: v[T] * 1.37 + 0.5 });
    try { if (!close(evaluate(u.l, w), evaluate(u.r, w), 1e-6)) { always = false; break; } } catch (e) { always = false; }
  }
  if (always) return { ok: false, msg: 'Das stimmt zwar immer, bringt dich aber nicht weiter.', fehlerart: 'Umstellen' };
  return { ok: true };
}

// Ausdruck mit eingesetzten Zahlen als HTML, zum Beispiel für die Lösung
export function fmlWith(src, vals) {
  try {
    const e = parseEq(src);
    const sub = n => {
      if (!n) return n;
      if (n.t === 'var' && keyOf(n.n) in vals) return { t: 'num', v: vals[keyOf(n.n)] };
      const c = Object.assign({}, n);
      for (const k of ['a', 'b']) if (c[k]) c[k] = sub(c[k]);
      return c;
    };
    return '<span class="fml">' + toHTML(sub(e.r)) + '</span>';
  } catch (err) { return esc(src); }
}
