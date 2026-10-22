// Oberfläche: Navigationsstapel je Tab, Sheets, Toast, Listen-Bausteine.
import { esc } from './util.js';

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* ===== Symbole (selbst gezeichnet) ===== */
const P = {
  heute: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/>',
  faecher: '<rect x="3.5" y="4" width="4.5" height="16" rx="1.2"/><rect x="9.8" y="4" width="4.5" height="16" rx="1.2"/><path d="M16.6 5.2l3.9-1 3 15.4-3.9 1z" transform="translate(-1.5 0)"/>',
  plus: '<path d="M12 6v12M6 12h12"/>',
  fehler: '<path d="M5 4.5h10.5a3 3 0 0 1 3 3V20H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h10.5"/><path d="M11.7 7.5v3.3M11.7 12.2v.1"/>',
  mehr: '<circle cx="12" cy="12" r="9"/><path d="M7.8 12h.1M12 12h.1M16.2 12h.1" stroke-width="2.6"/>',
  chev: '<path d="M9 5.5l6.5 6.5L9 18.5"/>',
  back: '<path d="M15 4.5L7.5 12 15 19.5"/>',
  close: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  copy: '<rect x="8" y="8" width="11.5" height="12" rx="2"/><path d="M15.5 8V6a2 2 0 0 0-2-2H6.5a2 2 0 0 0-2 2v8.5a2 2 0 0 0 2 2H8"/>',
  paste: '<rect x="5" y="5" width="14" height="16" rx="2"/><path d="M9 5V3.8h6V5M8.5 11h7M8.5 15h5"/>',
  photo: '<rect x="3" y="6" width="18" height="14" rx="2.5"/><circle cx="12" cy="13" r="3.6"/><path d="M8.5 6l1.5-2.2h4L15.5 6"/>',
  note: '<path d="M6 3.5h8.5L19 8v12.5H6z"/><path d="M14 3.5V8.5h5M9 12.5h7M9 16h7"/>',
  block: '<path d="M8.5 7L4 12l4.5 5M15.5 7L20 12l-4.5 5"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  book: '<path d="M4 5.5c2.7-1 5.3-1 8 .7 2.7-1.7 5.3-1.7 8-.7v13c-2.7-1-5.3-1-8 .7-2.7-1.7-5.3-1.7-8-.7z"/><path d="M12 6.2v13.2"/>',
  formula: '<path d="M14.5 4.5c-2.5 0-3 1.7-3.4 4L9.6 17c-.4 2.3-1 3.5-3.1 3.5M7.5 10.5h7.5M14 13.5l5 6M19 13.5l-5 6"/>',
  exam: '<rect x="5" y="3.5" width="14" height="17" rx="2"/><path d="M8.5 8h7M8.5 12h7M8.5 16h4"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',
  ear: '<path d="M7 9a5 5 0 0 1 10 0c0 3.5-3.5 4.3-3.5 7.5a2.7 2.7 0 0 1-5.2 1"/><path d="M10 9.5a2 2 0 0 1 4 0"/>',
  search: '<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  save: '<path d="M12 3.5v11M7.5 10l4.5 4.5 4.5-4.5"/><path d="M4.5 15v4.5h15V15"/>',
  theme: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor"/>',
  bell: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z"/><path d="M10 20.5a2.2 2.2 0 0 0 4 0"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.1"/>',
  play: '<path d="M7 4.5v15l13-7.5z" fill="currentColor"/>',
  pause: '<path d="M7 4.5h3.5v15H7zM13.5 4.5H17v15h-3.5z" fill="currentColor"/>',
  next: '<path d="M5 4.5v15l10-7.5z" fill="currentColor"/><path d="M17.5 4.5v15" stroke-width="2.6"/>',
  repeat: '<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3L4.5 9"/><path d="M4.5 4v5h5"/>',
  bolt: '<path d="M13 2.5L5 13.5h6l-1 8 8-11h-6z"/>',
  trash: '<path d="M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13"/>',
  claude: '<path d="M12 3l1.6 6.2L20 7.5l-4.6 4.5L20 16.5l-6.4-1.7L12 21l-1.6-6.2L4 16.5l4.6-4.5L4 7.5l6.4 1.7z"/>',
  cards: '<rect x="3.5" y="7" width="13" height="13" rx="2"/><path d="M8 7V5.5a2 2 0 0 1 2-2h8.5a2 2 0 0 1 2 2V14a2 2 0 0 1-2 2H16.5"/>',
  open: '<path d="M14 4.5h5.5V10M19.5 4.5L11 13M17 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 4 18.5v-10A1.5 1.5 0 0 1 5.5 7H10"/>',
  list: '<path d="M9 6.5h11M9 12h11M9 17.5h11M4.5 6.5h.1M4.5 12h.1M4.5 17.5h.1" stroke-width="2.2"/>',
  tools: '<path d="M14.5 4.5a4 4 0 0 0-4.8 5.2L4 15.4V20h4.6l5.7-5.7a4 4 0 0 0 5.2-4.8l-2.6 2.6-2.8-.7-.7-2.8z"/>'
};
export const icon = (n, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${P[n] || ''}</svg>`;

/* ===== Bausteine ===== */
export const sec = (title, footer) => `<div class="sec-h">${esc(title)}</div>` + (footer ? '' : '');
export const foot = t => `<div class="sec-f">${t}</div>`;

/*
 * Zeile einer gruppierten Liste.
 * o: {a: Aktionsname, d: data-Wert, icon, color, title, sub, detail, chev, html, cls}
 */
export function row(o) {
  const tag = o.a ? 'button' : 'div';
  return `<${tag} class="row ${o.cls || ''}" ${o.a ? `data-a="${o.a}"` : ''} ${o.d != null ? `data-d="${esc(o.d)}"` : ''} ${o.a ? 'type="button"' : ''}>
    ${o.icon ? `<span class="row-ic" style="background:${o.color || 'var(--accent)'}">${icon(o.icon)}</span>` : ''}
    ${o.dot ? `<span class="row-dot" style="background:${o.dot}"></span>` : ''}
    <span class="row-main"><span class="row-t">${o.titleHTML || esc(o.title)}</span>${o.sub || o.subHTML ? `<span class="row-s">${o.subHTML || esc(o.sub)}</span>` : ''}${o.html || ''}</span>
    ${o.detail != null ? `<span class="row-d">${o.detailHTML ? o.detail : esc(o.detail)}</span>` : ''}
    ${o.right || ''}
    ${o.chev !== false && o.a ? icon('chev', 'chev') : ''}
  </${tag}>`;
}
export const list = (rows, cls = '') => `<div class="list ${cls}">${rows.join('')}</div>`;
export const seg = (name, opts, val) => `<div class="seg" role="tablist" data-seg="${name}">${opts.map(([v, l]) => `<button type="button" role="tab" data-v="${esc(v)}" class="${v === val ? 'on' : ''}" aria-selected="${v === val}">${esc(l)}</button>`).join('')}</div>`;
export const sw = (name, on) => `<label class="switch"><input type="checkbox" data-sw="${name}" ${on ? 'checked' : ''}><span></span></label>`;
export const progress = (v, color) => `<div class="bar"><i style="width:${Math.round(Math.max(0, Math.min(1, v)) * 100)}%;${color ? 'background:' + color : ''}"></i></div>`;
export const empty = (t, sub = '') => `<div class="empty"><div class="empty-t">${esc(t)}</div>${sub ? `<div class="empty-s">${sub}</div>` : ''}</div>`;
export const hinweisTabellenbuch = () => `<p class="tb-hint">Im Zweifel gilt dein Tabellenbuch und der Unterricht.</p>`;

// Ereignisse über data-a verteilen. Mehrfaches Aufrufen ersetzt nur die Handler.
export function on(root, handlers) {
  const first = !root._h;
  root._h = handlers;
  if (!first) return;
  root.addEventListener('click', e => {
    const h = root._h;
    const el = e.target.closest('[data-a]');
    if (el && root.contains(el)) {
      const fn = h[el.dataset.a];
      if (fn) { e.preventDefault(); fn(el.dataset.d, el, e); return; }
    }
    const b = e.target.closest('[data-seg] button');
    if (b && root.contains(b)) {
      const s = b.closest('[data-seg]');
      $$('button', s).forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-selected', x === b); });
      const fn = h['seg:' + s.dataset.seg];
      if (fn) fn(b.dataset.v, b);
    }
  });
  root.addEventListener('change', e => {
    const s = e.target.closest('[data-sw]');
    if (s && root._h['sw:' + s.dataset.sw]) root._h['sw:' + s.dataset.sw](s.checked, s);
  });
}

/* ===== Navigationsstapel ===== */
const stacks = {};
let currentTab = 'heute';
export const tab = () => currentTab;

function makePage(def, tabName, depth) {
  const el = document.createElement('div');
  el.className = 'page';
  el.innerHTML = `
    <header class="navbar">
      <div class="nav-l">${depth > 0 ? `<button class="nav-back" type="button" aria-label="Zurück">${icon('back')}<span>${esc(def.backLabel || 'Zurück')}</span></button>` : ''}</div>
      <div class="nav-title">${esc(def.title)}</div>
      <div class="nav-r"></div>
    </header>
    <div class="page-scroll"><div class="page-in">
      ${def.large === false ? '' : `<h1 class="large-title">${esc(def.title)}</h1>`}
      <div class="page-body"></div>
    </div></div>`;
  const scroll = $('.page-scroll', el);
  const nb = $('.navbar', el);
  scroll.addEventListener('scroll', () => {
    const y = scroll.scrollTop;
    nb.classList.toggle('scrolled', def.large === false ? y > 4 : y > 38);
  }, { passive: true });
  if (def.large === false) nb.classList.add('compact');
  const back = $('.nav-back', el);
  if (back) back.onclick = () => pop(tabName);
  el._def = def;
  el.refresh = () => render(el);
  return el;
}
function render(el) {
  const def = el._def;
  const body = $('.page-body', el);
  const r = $('.nav-r', el);
  r.innerHTML = '';
  if (def.actions) for (const a of def.actions) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'nav-btn'; b.setAttribute('aria-label', a.label);
    b.innerHTML = a.icon ? icon(a.icon) : esc(a.label);
    b.onclick = a.onClick;
    r.appendChild(b);
  }
  const t = $('.nav-title', el), lt = $('.large-title', el);
  if (t) t.textContent = def.title;
  if (lt) lt.textContent = def.title;
  try { def.render(body, el); } catch (e) { console.error(e); body.innerHTML = empty('Hier ist etwas schiefgegangen.', esc(e.message)); }
}

export function initTabs(rootTabs) {
  for (const [name, def] of Object.entries(rootTabs)) {
    const scr = document.querySelector(`.tabscreen[data-tab="${name}"]`);
    const p = makePage(def, name, 0);
    scr.appendChild(p);
    stacks[name] = [p];
    render(p);
  }
}
export function showTab(name) {
  if (name === currentTab) {
    // Nochmal tippen: zurück zum Anfang
    const s = stacks[name];
    if (s.length > 1) { while (s.length > 1) s.pop().remove(); s[0].classList.remove('under'); render(s[0]); }
    else $('.page-scroll', s[0]).scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  currentTab = name;
  $$('.tabscreen').forEach(s => s.classList.toggle('on', s.dataset.tab === name));
  $$('.tabbar [data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === name));
  const top = stacks[name][stacks[name].length - 1];
  render(top);
}
export function push(def, tabName = currentTab) {
  const s = stacks[tabName];
  const prev = s[s.length - 1];
  def.backLabel = def.backLabel || prev._def.title;
  const p = makePage(def, tabName, s.length);
  document.querySelector(`.tabscreen[data-tab="${tabName}"]`).appendChild(p);
  s.push(p);
  render(p);
  p.classList.add('enter');
  requestAnimationFrame(() => requestAnimationFrame(() => { p.classList.remove('enter'); prev.classList.add('under'); }));
  return p;
}
export function pop(tabName = currentTab) {
  const s = stacks[tabName];
  if (s.length < 2) return;
  const p = s.pop();
  const prev = s[s.length - 1];
  prev.classList.remove('under');
  render(prev);
  p.classList.add('leave');
  setTimeout(() => p.remove(), 320);
}
export function refreshAll() {
  for (const name in stacks) {
    const s = stacks[name];
    if (name === currentTab) render(s[s.length - 1]);
    else s.forEach(p => { p._stale = true; });
  }
  sheets.forEach(sh => sh.live && sh.refresh());
}
export function refreshTop() { const s = stacks[currentTab]; render(s[s.length - 1]); }

// Wischen vom linken Rand: zurück
export function initEdgeSwipe() {
  let sx = 0, sy = 0, active = false, page = null;
  document.addEventListener('touchstart', e => {
    const t = e.touches[0];
    if (sheets.length || t.clientX > 24) return;
    const s = stacks[currentTab];
    if (s.length < 2) return;
    sx = t.clientX; sy = t.clientY; active = true; page = s[s.length - 1];
  }, { passive: true });
  document.addEventListener('touchmove', e => {
    if (!active) return;
    const t = e.touches[0];
    const dx = t.clientX - sx, dy = Math.abs(t.clientY - sy);
    if (dy > 40 && dx < 30) { active = false; page.style.transform = ''; return; }
    if (dx > 0) { page.style.transition = 'none'; page.style.transform = `translateX(${dx}px)`; }
  }, { passive: true });
  document.addEventListener('touchend', e => {
    if (!active) return;
    active = false;
    const dx = (e.changedTouches[0].clientX - sx);
    page.style.transition = '';
    page.style.transform = '';
    if (dx > 90) pop();
  });
}

/* ===== Sheets: von unten, nach unten wegwischen ===== */
const sheets = [];
export function openSheet(def) {
  const host = document.getElementById('sheets');
  const back = document.createElement('div');
  back.className = 'sheet-back';
  const el = document.createElement('div');
  el.className = 'sheet' + (def.full ? ' full' : '');
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.innerHTML = `
    <div class="sheet-grab"><span></span></div>
    <header class="sheet-h">
      <button type="button" class="sheet-x" aria-label="Schließen">${def.closeLabel ? esc(def.closeLabel) : icon('close')}</button>
      <div class="sheet-t">${esc(def.title || '')}</div>
      <div class="sheet-r"></div>
    </header>
    <div class="sheet-body"></div>`;
  host.append(back, el);
  const body = $('.sheet-body', el);
  const api = {
    el, body, live: !!def.live,
    close(result) {
      if (api.closed) return;
      if (def.confirmClose && !def.confirmClose()) return;
      api.closed = true;
      el.classList.remove('on'); back.classList.remove('on');
      const i = sheets.indexOf(api); if (i >= 0) sheets.splice(i, 1);
      setTimeout(() => { el.remove(); back.remove(); }, 330);
      document.body.classList.toggle('sheet-open', sheets.length > 0);
      if (def.onClose) def.onClose(result);
    },
    setTitle(t) { $('.sheet-t', el).textContent = t; },
    setRight(html, fn) { const r = $('.sheet-r', el); r.innerHTML = html; if (fn) r.firstElementChild.onclick = fn; },
    refresh() { if (def.render) def.render(body, api); }
  };
  $('.sheet-x', el).onclick = () => api.close();
  back.onclick = () => api.close();
  sheets.push(api);
  document.body.classList.add('sheet-open');
  if (def.render) def.render(body, api);
  requestAnimationFrame(() => requestAnimationFrame(() => { el.classList.add('on'); back.classList.add('on'); }));
  // Nach unten wegwischen
  let y0 = null, dy = 0, fromBody = false;
  el.addEventListener('touchstart', e => {
    const inBody = body.contains(e.target);
    if (inBody && body.scrollTop > 0) { y0 = null; return; }
    if (e.target.closest('input, textarea, select, .no-swipe')) { y0 = null; return; }
    fromBody = inBody; y0 = e.touches[0].clientY; dy = 0;
  }, { passive: true });
  el.addEventListener('touchmove', e => {
    if (y0 == null) return;
    dy = e.touches[0].clientY - y0;
    if (fromBody && body.scrollTop > 0) { y0 = null; el.style.transform = ''; return; }
    if (dy > 0) { el.style.transition = 'none'; el.style.transform = `translateY(${dy}px)`; }
  }, { passive: true });
  el.addEventListener('touchend', () => {
    if (y0 == null) return;
    el.style.transition = ''; el.style.transform = '';
    if (dy > 120) api.close();
    y0 = null;
  });
  return api;
}
export const topSheet = () => sheets[sheets.length - 1];

/* ===== Meldungen ===== */
let toastT = null;
export function toast(msg, ms = 2600) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('on');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('on'), ms);
}
export function confirmBox(text, okLabel = 'OK', danger = false) {
  return new Promise(res => {
    const s = openSheet({
      title: '', onClose: r => res(!!r),
      render(b, api) {
        b.innerHTML = `<p class="confirm-t">${esc(text)}</p><div class="btn-col"><button class="btn ${danger ? 'danger' : 'filled'}" data-a="ok">${esc(okLabel)}</button><button class="btn" data-a="no">Abbrechen</button></div>`;
        on(b, { ok: () => api.close(true), no: () => api.close(false) });
      }
    });
    s.el.classList.add('small');
  });
}

/* ===== Zwischenablage ===== */
export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch (e) { /* Fallback */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy'); ta.remove(); return ok;
  } catch (e) { return false; }
}
export async function readClipboard() {
  try { return await navigator.clipboard.readText(); } catch (e) { return null; }
}

/* ===== Datei speichern (iPhone: Teilen-Menü, sonst Download) ===== */
export async function saveFile(name, text, mime = 'application/json') {
  const blob = new Blob([text], { type: mime });
  try {
    const file = new File([blob], name, { type: mime });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: name }); return true; }
  } catch (e) { if (e && e.name === 'AbortError') return false; }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  return true;
}
