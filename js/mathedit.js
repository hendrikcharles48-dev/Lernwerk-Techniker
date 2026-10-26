// Formel-Editor mit echtem Bruchstrich, Wurzel, Hochzahl und Funktionen.
// Eigene Tastatur, damit auf dem iPhone keine Handy-Tastatur aufspringt.
// Der Wert wird als Text für den Formel-Parser ausgegeben, zum Beispiel "I = (U)/(R)".
import { esc } from './util.js';
import { nameHTML, parseEq } from './formula.js';

const FN = { sin: 'sin', cos: 'cos', tan: 'tan', asin: 'arcsin', acos: 'arccos', atan: 'arctan', ln: 'ln', lg: 'lg' };
const OPS = { '·': '*', '−': '-', '+': '+', '=': '=', '(': '(', ')': ')' };
const slots = n => (n.k === 'frac' ? [n.n, n.d] : n.k === 'sqrt' || n.k === 'fn' ? [n.b] : n.k === 'pow' ? [n.e] : []);
const atomRun = n => n.k === 'd' || n.k === 'v' || n.k === 'pi' || n.k === 'l';

/* ===== Text aus dem Modell ===== */
export function serialize(list) {
  let out = '', prev = null;
  list.forEach((n, i) => {
    let s, kind;
    switch (n.k) {
      case 'd': s = n.v; kind = 'num'; break;
      case 'l': s = n.v; kind = 'word'; break;
      case 'v': s = n.v; kind = 'var'; break;
      case 'pi': s = 'π'; kind = 'var'; break;
      case 'o': s = OPS[n.v] || n.v; kind = 'op'; break;
      case 'frac': s = '(' + serialize(n.n) + ')/(' + serialize(n.d) + ')'; kind = 'grp'; break;
      case 'sqrt': s = '√(' + serialize(n.b) + ')'; kind = 'grp'; break;
      case 'fn': s = n.f + '(' + serialize(n.b) + ')'; kind = 'grp'; break;
      case 'pow': s = '^(' + serialize(n.e) + ')'; kind = 'pow'; break;
      default: s = ''; kind = 'op';
    }
    // Ein Bruch vor einer Hochzahl wird geklammert: (a/b)²
    if (n.k === 'frac' && list[i + 1] && list[i + 1].k === 'pow') s = '(' + s + ')';
    const sep = prev && kind !== 'op' && kind !== 'pow' && prev !== 'op' && !(prev === 'num' && kind === 'num') && !(prev === 'word' && kind === 'word');
    out += (sep ? ' ' : '') + s;
    prev = kind;
  });
  return out;
}

/* ===== Modell aus Text (zum Wiederherstellen nach einer Prüfung) ===== */
const strip = a => (a && a.t === 'par' ? a.a : a);
function fromAst(n) {
  switch (n.t) {
    case 'num': return String(+n.v.toFixed(10)).replace('.', ',').split('').map(c => ({ k: 'd', v: c }));
    case 'const': return n.v === 'e' ? [{ k: 'v', v: 'e' }] : [{ k: 'pi' }];
    case 'var': return [{ k: 'v', v: n.n }];
    case 'par': return [{ k: 'o', v: '(' }, ...fromAst(n.a), { k: 'o', v: ')' }];
    case 'neg': return [{ k: 'o', v: '−' }, ...fromAst(n.a)];
    case 'add': return [...fromAst(n.a), { k: 'o', v: '+' }, ...fromAst(n.b)];
    case 'sub': return [...fromAst(n.a), { k: 'o', v: '−' }, ...fromAst(n.b)];
    case 'mul': return [...fromAst(n.a), { k: 'o', v: '·' }, ...fromAst(n.b)];
    case 'div': return [{ k: 'frac', n: fromAst(strip(n.a)), d: fromAst(strip(n.b)) }];
    case 'pow': return [...fromAst(n.a), { k: 'pow', e: fromAst(strip(n.b)) }];
    case 'root': return [{ k: 'sqrt', b: fromAst(n.a) }];
    case 'fn': return [{ k: 'fn', f: n.f, b: fromAst(n.a) }];
  }
  return [];
}
export function parseToModel(text) {
  const t = String(text || '').trim();
  if (!t) return [];
  try {
    const e = parseEq(t);
    return e.l ? [...fromAst(e.l), { k: 'o', v: '=' }, ...fromAst(e.r)] : fromAst(e.r);
  } catch (err) {
    return [...t.replace(/\s/g, '')].map(c => (/[0-9,.]/.test(c) ? { k: 'd', v: c === '.' ? ',' : c } : OPS[c] || c === '*' || c === '-' ? { k: 'o', v: c === '*' ? '·' : c === '-' ? '−' : c } : { k: 'l', v: c }));
  }
}

/* ===== Editor ===== */
const KEYS = [
  ['7', '8', '9', '(', ')', '⌫'],
  ['4', '5', '6', 'frac', 'sqrt', 'pow'],
  ['1', '2', '3', '·', '−', '+'],
  ['0', ',', 'sq', '=', 'left', 'right']
];
// Taschenrechner für Zahlenfelder: statt = gibt es mal zehn hoch
const CALC_KEYS = [
  ['7', '8', '9', '(', ')', '⌫'],
  ['4', '5', '6', 'frac', 'sqrt', 'pow'],
  ['1', '2', '3', '·', '−', '+'],
  ['0', ',', 'sq', 'sci', 'left', 'right']
];
const KEY_LABEL = {
  sci: '·10ⁿ',
  frac: '<span class="k-frac"><i></i><i></i></span>', sqrt: '√▢', pow: 'xⁿ', sq: 'x²',
  left: '‹', right: '›', '⌫': '⌫'
};
const KEY_ARIA = { sci: 'mal zehn hoch', frac: 'Bruch', sqrt: 'Wurzel', pow: 'Hochzahl', sq: 'hoch zwei', left: 'Cursor nach links', right: 'Cursor nach rechts', '⌫': 'Löschen' };

// opts.calc: Zahlenfeld mit Taschenrechner-Tasten, opts.unit: Einheit hinter dem Feld
export function editorHTML(vars, placeholder, opts = {}) {
  const varKeys = vars.map(v => `<button type="button" class="mk mk-var" data-mk="var" data-v="${esc(v)}">${nameHTML(v)}</button>`).join('') + `<button type="button" class="mk mk-var" data-mk="pi">π</button>`
    + (opts.calc ? `<button type="button" class="mk mk-var" data-mk="var" data-v="e" aria-label="Eulersche Zahl">e</button>` : '');
  const fnKeys = Object.entries(FN).map(([f, l]) => `<button type="button" class="mk mk-fn" data-mk="fn" data-v="${f}">${l}</button>`).join('');
  const grid = (opts.calc ? CALC_KEYS : KEYS).flat().map(k => `<button type="button" class="mk${/^[0-9,]$/.test(k) ? ' mk-num' : ''}${k === '⌫' ? ' mk-del' : ''}" data-mk="${esc(k)}" ${KEY_ARIA[k] ? `aria-label="${KEY_ARIA[k]}"` : ''}>${KEY_LABEL[k] || esc(k)}</button>`).join('');
  const field = `<div class="me inp" tabindex="0" role="textbox" aria-label="${opts.calc ? 'Zahl eingeben' : 'Formel eingeben'}" data-ph="${esc(placeholder || '')}"></div>`;
  return (opts.calc ? `<div class="me-numrow">${field}${opts.unit ? `<span class="unit">${esc(opts.unit)}</span>` : ''}</div>` : field) + `
    <div class="me-pad no-swipe"><div class="me-row">${varKeys}</div><div class="me-row me-fns">${fnKeys}</div><div class="me-grid">${grid}</div></div>`;
}

export function attachEditor(host, pad, opts = {}) {
  let root = [];
  let cur = { list: root, i: 0 };
  let reg = [];

  function parentOf(list, nodes = root, plist = null) {
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      for (const s of slots(n)) {
        if (s === list) return { node: n, plist: nodes, pi: i };
        const r = parentOf(list, s);
        if (r) return r;
      }
    }
    return null;
  }
  const CUR = '<span class="me-cur"></span>';
  function rl(list) {
    const id = reg.push(list) - 1;
    let h = `<span class="me-l">`;
    if (!list.length) h += (cur.list === list ? CUR : '') + `<span class="me-slot" data-l="${id}" data-i="0"></span>`;
    list.forEach((n, i) => { if (cur.list === list && cur.i === i) h += CUR; h += rn(n, id, i); });
    if (list.length && cur.list === list && cur.i === list.length) h += CUR;
    return h + '</span>';
  }
  function rn(n, id, i) {
    const a = `data-l="${id}" data-i="${i}"`;
    switch (n.k) {
      case 'd': case 'l': return `<span class="me-t" ${a}>${esc(n.v)}</span>`;
      case 'v': return `<span class="me-t" ${a}>${nameHTML(n.v)}</span>`;
      case 'pi': return `<span class="me-t" ${a}><var>π</var></span>`;
      case 'o': return `<span class="me-t ${/[·−+=]/.test(n.v) ? 'me-op' : 'me-p'}" ${a}>${esc(n.v)}</span>`;
      case 'frac': return `<span class="me-t me-frac" ${a}><span class="me-num">${rl(n.n)}</span><span class="me-den">${rl(n.d)}</span></span>`;
      case 'sqrt': return `<span class="me-t me-sqrt" ${a}><span class="me-rad">√</span><span class="me-body">${rl(n.b)}</span></span>`;
      case 'pow': return `<span class="me-t me-pow" ${a}>${rl(n.e)}</span>`;
      case 'fn': return `<span class="me-t me-fn" ${a}><span class="me-fname">${FN[n.f] || n.f}</span><span class="me-p">(</span>${rl(n.b)}<span class="me-p">)</span></span>`;
    }
    return '';
  }
  function render() {
    reg = [];
    host.innerHTML = root.length || cur.list !== root ? rl(root) : `${CUR}<span class="me-ph">${esc(host.dataset.ph || '')}</span>`;
    if (opts.onChange) opts.onChange(serialize(root));
  }

  function insert(n, into) {
    cur.list.splice(cur.i, 0, n);
    if (into && slots(n).length) cur = { list: slots(n)[0], i: 0 };
    else cur.i++;
  }
  function moveRight() {
    const { list, i } = cur;
    if (i < list.length) { const n = list[i]; const s = slots(n); if (s.length) cur = { list: s[0], i: 0 }; else cur.i++; return; }
    const p = parentOf(list);
    if (!p) return;
    const s = slots(p.node), k = s.indexOf(list);
    if (k < s.length - 1) cur = { list: s[k + 1], i: 0 };
    else cur = { list: p.plist, i: p.pi + 1 };
  }
  function moveLeft() {
    const { list, i } = cur;
    if (i > 0) { const n = list[i - 1]; const s = slots(n); if (s.length) cur = { list: s[s.length - 1], i: s[s.length - 1].length }; else cur.i--; return; }
    const p = parentOf(list);
    if (!p) return;
    const s = slots(p.node), k = s.indexOf(list);
    if (k > 0) cur = { list: s[k - 1], i: s[k - 1].length };
    else cur = { list: p.plist, i: p.pi };
  }
  function del() {
    const { list, i } = cur;
    if (i > 0) {
      const n = list[i - 1], s = slots(n);
      if (!s.length || s.every(x => !x.length)) { list.splice(i - 1, 1); cur.i--; }
      else cur = { list: s[s.length - 1], i: s[s.length - 1].length };
      return;
    }
    const p = parentOf(list);
    if (!p) return;
    const s = slots(p.node);
    if (s.every(x => !x.length)) { p.plist.splice(p.pi, 1); cur = { list: p.plist, i: p.pi }; }
    else if (s.indexOf(list) > 0) { const prev = s[s.indexOf(list) - 1]; cur = { list: prev, i: prev.length }; }
    else cur = { list: p.plist, i: p.pi };
  }
  function frac() {
    // Was direkt vor dem Cursor steht (Zahl oder Größe), wandert in den Zähler
    const { list, i } = cur;
    let j = i;
    while (j > 0 && (atomRun(list[j - 1]) || (list[j - 1].k === 'pow' && j - 1 > 0))) j--;
    if (j < i && list[j].k === 'pow') j++;
    const num = list.splice(j, i - j);
    const n = { k: 'frac', n: num, d: [] };
    list.splice(j, 0, n);
    cur = num.length ? { list: n.d, i: 0 } : { list: n.n, i: 0 };
  }
  function key(k, v) {
    if (/^[0-9]$/.test(k) || k === ',') insert({ k: 'd', v: k });
    else if (k in OPS && k.length === 1) insert({ k: 'o', v: k });
    else if (k === 'var') insert({ k: 'v', v });
    else if (k === 'pi') insert({ k: 'pi' });
    else if (k === 'fn') insert({ k: 'fn', f: v, b: [] }, true);
    else if (k === 'frac') frac();
    else if (k === 'sqrt') insert({ k: 'sqrt', b: [] }, true);
    else if (k === 'pow') insert({ k: 'pow', e: [] }, true);
    else if (k === 'sci') { insert({ k: 'o', v: '·' }); insert({ k: 'd', v: '1' }); insert({ k: 'd', v: '0' }); insert({ k: 'pow', e: [] }, true); }
    else if (k === 'sq') insert({ k: 'pow', e: [{ k: 'd', v: '2' }] });
    else if (k === 'left') moveLeft();
    else if (k === 'right') moveRight();
    else if (k === '⌫') del();
    render();
  }

  // Tippen in die Formel setzt den Cursor
  host.addEventListener('click', e => {
    const t = e.target.closest('[data-l]');
    if (!t || !host.contains(t)) { cur = { list: root, i: root.length }; render(); return; }
    const list = reg[+t.dataset.l];
    let i = +t.dataset.i;
    if (!t.classList.contains('me-slot')) { const r = t.getBoundingClientRect(); if (e.clientX > r.left + r.width / 2) i++; }
    cur = { list, i };
    render();
  });
  pad.addEventListener('click', e => {
    const b = e.target.closest('[data-mk]');
    if (!b) return;
    e.preventDefault();
    key(b.dataset.mk, b.dataset.v);
  });
  // Tastatur am Laptop
  host.addEventListener('keydown', e => {
    const c = e.key;
    if (c === 'Enter') { if (opts.onEnter) opts.onEnter(); e.preventDefault(); return; }
    const map = { Backspace: '⌫', ArrowLeft: 'left', ArrowRight: 'right', '/': 'frac', '^': 'pow', '*': '·', '-': '−', '.': ',' };
    if (map[c]) { e.preventDefault(); key(map[c]); return; }
    if (/^[0-9,+=()]$/.test(c)) { e.preventDefault(); key(c); return; }
    if (/^[A-Za-zÄÖÜäöüα-ωΑ-Ω_]$/.test(c) && !e.metaKey && !e.ctrlKey) { e.preventDefault(); insert({ k: 'l', v: c }); render(); }
  });

  Object.defineProperty(host, 'value', {
    configurable: true,
    get: () => serialize(root),
    set: v => { root = parseToModel(v); cur = { list: root, i: root.length }; render(); }
  });
  render();
  return host;
}
