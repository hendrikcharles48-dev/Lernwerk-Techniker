// Kleine Diagramme als SVG, ohne Bibliothek, offline. Farben kommen aus CSS-Klassen,
// damit hell und dunkel passen. Antippen eines Balkens oder Punkts zeigt den Wert.
import { esc } from './util.js';

const fmt = n => String(Math.round(n * 10) / 10).replace('.', ',');
const tip = t => ` data-tip="${esc(t)}"`;

// Stand von Fragen: neu, wackelt, sitzt. Ein Hauptton, von hell nach dunkel.
export const STAND = [['neu', 'neu', 'dg-s0'], ['wackelt', 'wackelt', 'dg-s1'], ['sitzt', 'sitzt', 'dg-s2']];
export function standVon(items, card) {
  const s = { neu: 0, wackelt: 0, sitzt: 0 };
  for (const it of items) { const c = card(it.id); if (!c) s.neu++; else if (c.stufe >= 3) s.sitzt++; else s.wackelt++; }
  return s;
}

// Waagerechter gestapelter Balken mit 2 px Lücke zwischen den Teilen
export function stapel(werte, opt = {}) {
  const teile = STAND.map(([k, name, cls]) => ({ k, name, cls, n: werte[k] || 0 })).filter(x => x.n);
  const sum = teile.reduce((a, x) => a + x.n, 0);
  if (!sum) return '';
  const h = opt.hoch || 10;
  let x = 0;
  const W = 100, gap = teile.length > 1 ? 0.8 : 0;
  const rects = teile.map((t, i) => {
    const w = t.n / sum * (W - gap * (teile.length - 1));
    const r = `<rect x="${x}" y="0" width="${Math.max(w, 0.5)}" height="${h}" rx="${Math.min(2, w / 2)}" class="${t.cls}"${tip(t.n + ' ' + t.name)}/>`;
    x += w + gap;
    return r;
  }).join('');
  const leg = opt.legende ? `<div class="dg-leg">${teile.map(t => `<span><i class="${t.cls}"></i>${t.n} ${t.name}</span>`).join('')}</div>` : '';
  return `<div class="dg dg-stapel"><svg viewBox="0 0 100 ${h}" preserveAspectRatio="none" role="img" aria-label="${esc(teile.map(t => t.n + ' ' + t.name).join(', '))}" style="height:${h}px">${rects}</svg>${leg}<div class="dg-tip" hidden></div></div>`;
}

// Senkrechte Balken, zum Beispiel pro Wochentag. werte: [{label, n, ok, aktiv}]
// ok ist der dunkle Teil unten (beim ersten Mal gewusst), der Rest hell darüber.
export function saeulen(werte, opt = {}) {
  const max = Math.max(1, ...werte.map(w => w.n));
  const W = 300, H = opt.hoch || 90, unten = 18, bw = W / werte.length;
  const sw = Math.min(26, bw * 0.55);
  const top = werte.reduce((m, w, i) => (w.n > (werte[m] || { n: -1 }).n ? i : m), 0);
  let svg = `<line x1="0" x2="${W}" y1="${H - unten}" y2="${H - unten}" class="dg-achse"/>`;
  werte.forEach((w, i) => {
    const cx = i * bw + bw / 2, x = cx - sw / 2, hoeheGes = (H - unten - 14) * w.n / max;
    const okH = w.ok != null ? (H - unten - 14) * w.ok / max : 0;
    const t = w.tip || (w.n ? w.n + (w.ok != null ? ', davon ' + w.ok + ' gewusst' : '') : 'nichts');
    // Großes, unsichtbares Ziel zum Antippen
    svg += `<rect x="${i * bw}" y="0" width="${bw}" height="${H - unten}" class="dg-ziel"${tip(w.label + ': ' + t)}/>`;
    if (w.n) {
      if (w.ok != null && w.n - w.ok > 0) svg += `<rect x="${x}" y="${H - unten - hoeheGes}" width="${sw}" height="${hoeheGes - okH - (w.ok ? 1 : 0)}" rx="3" class="dg-hell"/>`;
      if (w.ok == null || w.ok > 0) svg += `<rect x="${x}" y="${H - unten - (w.ok == null ? hoeheGes : okH)}" width="${sw}" height="${w.ok == null ? hoeheGes : okH}" rx="3" class="dg-voll"/>`;
    }
    if (i === top && w.n) svg += `<text x="${cx}" y="${H - unten - hoeheGes - 4}" class="dg-wert">${w.n}</text>`;
    svg += `<text x="${cx}" y="${H - 4}" class="dg-lbl${w.aktiv ? ' dg-jetzt' : ''}">${esc(w.label)}</text>`;
  });
  const leg = opt.legende ? `<div class="dg-leg">${opt.legende.map(([cls, t]) => `<span><i class="${cls}"></i>${esc(t)}</span>`).join('')}</div>` : '';
  return `<div class="dg"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opt.titel || 'Säulendiagramm')}">${svg}</svg>${leg}<div class="dg-tip" hidden></div></div>`;
}

// Waagerechte Balken mit Namen links und Wert rechts. zeilen: [{name, n, max?, text?}]
export function balken(zeilen, opt = {}) {
  if (!zeilen.length) return '';
  const max = opt.max || Math.max(1, ...zeilen.map(z => z.max || z.n));
  return `<div class="dg dg-balken">${zeilen.map(z => {
    const m = z.max || max, p = Math.max(0, Math.min(1, z.n / m));
    return `<div class="dg-b"${tip(z.name + ': ' + (z.text || fmt(z.n)))}><span class="dg-bn">${esc(z.name)}</span><span class="dg-bw"><i style="width:${Math.max(p * 100, z.n ? 3 : 0)}%"></i></span><span class="dg-bv">${esc(z.text || fmt(z.n))}</span></div>`;
  }).join('')}<div class="dg-tip" hidden></div></div>`;
}

// Linie über die Zeit. serien: [{name, farbe, punkte: [{x: Datum 'JJJJ-MM-TT', y, tip}]}]
// y: Note von 1 (oben) bis 6 (unten). Eine Achse, die Farbe folgt dem Fach.
export function linie(serien, opt = {}) {
  const alle = serien.flatMap(s => s.punkte);
  if (alle.length < 2) return '';
  const t = d => new Date(d + 'T12:00').getTime();
  const x0 = Math.min(...alle.map(p => t(p.x))), x1 = Math.max(...alle.map(p => t(p.x)));
  const W = 300, H = opt.hoch || 150, L = 22, R = 10, O = 10, U = 22;
  const [ya, yb] = opt.y || [1, 6];
  const X = d => L + (x1 === x0 ? (W - L - R) / 2 : (t(d) - x0) / (x1 - x0) * (W - L - R));
  const Y = v => O + (v - ya) / (yb - ya) * (H - O - U);
  let svg = '';
  for (let v = ya; v <= yb; v++) svg += `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" class="dg-gitter"/><text x="${L - 6}" y="${Y(v) + 3.5}" class="dg-lbl dg-y">${v}</text>`;
  const mon = d => new Date(d + 'T12:00').toLocaleDateString('de-DE', { day: 'numeric', month: 'numeric' });
  svg += `<text x="${L}" y="${H - 6}" class="dg-lbl" text-anchor="start">${mon(new Date(x0).toISOString().slice(0, 10))}</text><text x="${W - R}" y="${H - 6}" class="dg-lbl" text-anchor="end">${mon(new Date(x1).toISOString().slice(0, 10))}</text>`;
  for (const s of serien) {
    const ps = s.punkte.slice().sort((a, b) => (a.x < b.x ? -1 : 1));
    if (ps.length > 1) svg += `<polyline points="${ps.map(p => X(p.x) + ',' + Y(p.y)).join(' ')}" class="dg-linie" style="stroke:${s.farbe}"/>`;
    for (const p of ps) svg += `<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="4.5" class="dg-punkt" style="fill:${s.farbe}"/><circle cx="${X(p.x)}" cy="${Y(p.y)}" r="14" class="dg-ziel"${tip(s.name + ', ' + mon(p.x) + ': ' + (p.tip || fmt(p.y)))}/>`;
  }
  const leg = serien.length > 1 ? `<div class="dg-leg">${serien.map(s => `<span><i style="background:${s.farbe}"></i>${esc(s.name)}</span>`).join('')}</div>` : '';
  return `<div class="dg"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opt.titel || 'Verlauf')}">${svg}</svg>${leg}<div class="dg-tip" hidden></div></div>`;
}

// Antippen zeigt den Wert in einem kleinen Schild über dem Diagramm
if (typeof document !== 'undefined') {
  document.addEventListener('click', e => {
    let el = e.target instanceof Element && e.target.closest('[data-tip]');
    // In Knöpfen und antippbaren Zeilen gilt der Knopf, nicht das Schild
    if (el && el.closest('button, [data-a]')) el = null;
    document.querySelectorAll('.dg-tip:not([hidden])').forEach(x => { if (!el || !x.parentElement.contains(el)) x.hidden = true; });
    if (!el) return;
    const dg = el.closest('.dg'), box = dg && dg.querySelector('.dg-tip');
    if (!box) return;
    e.stopPropagation();
    const r = el.getBoundingClientRect(), d = dg.getBoundingClientRect();
    box.textContent = el.dataset.tip;
    box.hidden = false;
    const x = Math.max(4, Math.min(d.width - box.offsetWidth - 4, r.left - d.left + r.width / 2 - box.offsetWidth / 2));
    box.style.left = x + 'px';
    box.style.top = Math.max(0, r.top - d.top - box.offsetHeight - 6) + 'px';
  }, true);
}
