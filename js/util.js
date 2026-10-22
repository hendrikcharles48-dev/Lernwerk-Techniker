// Kleine Helfer ohne Abhängigkeiten. Läuft im Browser und in Node (Tests).

export const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function slug(s) {
  return String(s || '').toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'x';
}

// Für Vergleiche: klein, ohne Satzzeichen und Leerraum.
export const norm = s => String(s || '').toLowerCase()
  .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
  .replace(/[^a-z0-9α-ω]+/g, '');

export function hash(s) {
  let h = 2166136261;
  s = String(s);
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

/* ===== Datum: immer lokale Kalendertage als JJJJ-MM-TT ===== */
const pad = n => String(n).padStart(2, '0');
export const dayStr = (d = new Date()) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
export function parseDay(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
}
export function addDays(s, n) { const d = parseDay(s); d.setDate(d.getDate() + n); return dayStr(d); }
export function daysBetween(a, b) { return Math.round((parseDay(b) - parseDay(a)) / 86400000); }
export const WOCHENTAG = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
export const MONAT = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
export function dayLong(s) { const d = parseDay(s); return d ? WOCHENTAG[d.getDay()] + ', ' + d.getDate() + '. ' + MONAT[d.getMonth()] : s; }
export function dayShort(s) { const d = parseDay(s); return d ? d.getDate() + '. ' + MONAT[d.getMonth()].slice(0, 3) + '.' : s; }
// Akzeptiert JJJJ-MM-TT und TT.MM.JJJJ
export function toDay(s) {
  s = String(s || '').trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (m) return m[1] + '-' + pad(+m[2]) + '-' + pad(+m[3]);
  m = /^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/.exec(s);
  if (m) return (m[3].length === 2 ? '20' + m[3] : m[3]) + '-' + pad(+m[2]) + '-' + pad(+m[1]);
  return null;
}

/* ===== Zahlen wie in der Schule ===== */
export function fmtNum(v, maxDec) {
  if (v == null || !isFinite(v)) return '–';
  const a = Math.abs(v);
  let r;
  if (maxDec != null) r = Math.round(v * 10 ** maxDec) / 10 ** maxDec;
  else if (a >= 1000) r = Math.round(v * 10) / 10;
  else if (a >= 1) r = Math.round(v * 1000) / 1000;
  else if (a === 0) r = 0;
  else r = Number(v.toPrecision(4));
  if (Object.is(r, -0)) r = 0;
  return r.toLocaleString('de-DE', { maximumFractionDigits: 10, useGrouping: false });
}

export function plural(n, eins, viele) { return n + ' ' + (n === 1 ? eins : viele); }

/* ===== Mini-Markdown: sicher, weil zuerst escaped wird ===== */
function inline(s) {
  return esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
}
export function markdown(src) {
  const lines = String(src || '').replace(/\r/g, '').split('\n');
  let out = '', list = null, para = [];
  const flushPara = () => { if (para.length) { out += '<p>' + para.map(inline).join('<br>') + '</p>'; para = []; } };
  const closeList = () => { if (list) { out += '</' + list + '>'; list = null; } };
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i], l = raw.trim();
    if (/^```/.test(l)) {
      flushPara(); closeList();
      const code = []; i++;
      while (i < lines.length && !/^```/.test(lines[i].trim())) code.push(lines[i++]);
      out += '<pre>' + esc(code.join('\n')) + '</pre>';
      continue;
    }
    if (!l) { flushPara(); closeList(); continue; }
    let m;
    if ((m = /^(#{1,4})\s+(.*)$/.exec(l))) { flushPara(); closeList(); const n = Math.min(4, m[1].length + 1); out += `<h${n}>${inline(m[2])}</h${n}>`; continue; }
    if (/^(-{3,}|\*{3,})$/.test(l)) { flushPara(); closeList(); out += '<hr>'; continue; }
    if ((m = /^[-*•+]\s+(.*)$/.exec(l))) { flushPara(); if (list !== 'ul') { closeList(); out += '<ul>'; list = 'ul'; } out += '<li>' + inline(m[1]) + '</li>'; continue; }
    if ((m = /^\d+[.)]\s+(.*)$/.exec(l))) { flushPara(); if (list !== 'ol') { closeList(); out += '<ol>'; list = 'ol'; } out += '<li>' + inline(m[1]) + '</li>'; continue; }
    if ((m = /^>\s?(.*)$/.exec(l))) { flushPara(); closeList(); out += '<blockquote>' + inline(m[1]) + '</blockquote>'; continue; }
    if (/^\|.*\|$/.test(l)) {
      flushPara(); closeList();
      const rows = [];
      while (i < lines.length && /^\|.*\|$/.test(lines[i].trim())) rows.push(lines[i++].trim());
      i--;
      const cells = r => r.slice(1, -1).split('|').map(c => c.trim());
      const body = rows.filter(r => !/^\|[\s:|-]+\|$/.test(r));
      out += '<div class="tw"><table>' + body.map((r, k) => '<tr>' + cells(r).map(c => k === 0 && rows.length > 1 && /^\|[\s:|-]+\|$/.test(rows[1]) ? `<th>${inline(c)}</th>` : `<td>${inline(c)}</td>`).join('') + '</tr>').join('') + '</table></div>';
      continue;
    }
    closeList();
    para.push(l);
  }
  flushPara(); closeList();
  return out;
}

// Markdown zu Klartext, zum Vorlesen und für die Suche.
export function plainText(src) {
  return String(src || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^#+\s*/gm, '').replace(/^[-*•+]\s+/gm, '').replace(/^\d+[.)]\s+/gm, '')
    .replace(/\*\*|__|`/g, '').replace(/\|/g, ' ').replace(/[ \t]+/g, ' ').trim();
}

export function shuffle(a) {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
