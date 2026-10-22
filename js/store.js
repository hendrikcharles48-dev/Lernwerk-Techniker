// Zentraler Zustand der App: Lehrplan, Inhalte, Wiederholungen, Fehlerbuch, Termine.
import * as db from './db.js';
import { parseBlocks, mergeTopic, emptyTopic, exportBlock, hasContent } from './parser.js';
import { parseEq, keyOf } from './formula.js';
import { norm, slug, uid, dayStr, addDays, daysBetween, hash, toDay } from './util.js';
import { nextState, isDue, SEKUNDEN } from './srs.js';

export const S = {
  base: null, plan: null,
  builtin: new Map(), content: new Map(), introOnly: new Set(), fachIntro: {},
  notes: [], cards: new Map(), errors: [], events: [], exams: [], kv: new Map(),
  photoMeta: [], ready: false
};
const listeners = new Set();
export const onChange = fn => listeners.add(fn);
const changed = what => listeners.forEach(fn => { try { fn(what); } catch (e) { console.error(e); } });

const kvGet = (k, d) => (S.kv.has(k) ? S.kv.get(k) : d);
async function kvSet(k, v) { S.kv.set(k, v); await db.put('kv', v, k); }
export { kvGet, kvSet };

/* ===== Start ===== */
async function fetchText(url) {
  try { const r = await fetch(url, { cache: 'no-cache' }); if (r.ok) return await r.text(); } catch (e) { /* offline: Service Worker liefert */ }
  try { const r = await fetch(url); if (r.ok) return await r.text(); } catch (e) { /* nichts */ }
  return null;
}

export async function init() {
  const [kv, content, notes, cards, errors, events, exams, photos] = await Promise.all(
    ['kv', 'content', 'notes', 'cards', 'errors', 'events', 'exams', 'photos'].map(s => (s === 'kv' ? db.allKV() : db.all(s))));
  S.kv = new Map(kv);
  S.content = new Map(content.map(c => [c.id, c.topic]));
  S.notes = notes; S.cards = new Map(cards.map(c => [c.id, c])); S.errors = errors; S.events = events; S.exams = exams;
  S.photoMeta = photos.map(p => ({ id: p.id, tid: p.tid, zeit: p.zeit, titel: p.titel }));

  const lp = await fetchText('lehrplan.json');
  S.base = lp ? JSON.parse(lp) : { version: 0, module: [], faecher: [] };
  let plan = kvGet('lehrplan', null);
  if (!plan) plan = JSON.parse(JSON.stringify(S.base));
  else if ((plan.baseVersion || 0) < S.base.version) plan = upgradePlan(plan, S.base);
  plan.baseVersion = S.base.version;
  S.plan = plan;

  await loadBuiltin();
  if (!kvGet('ersterStart')) await kvSet('ersterStart', dayStr());
  await ingestInbox();
  db.requestPersist();
  S.ready = true;
}

// Neue Themen aus einer neueren lehrplan.json übernehmen, eigene Änderungen behalten
function upgradePlan(plan, base) {
  for (const bf of base.faecher) {
    let f = plan.faecher.find(x => x.id === bf.id);
    if (!f) { plan.faecher.push(JSON.parse(JSON.stringify(bf))); continue; }
    for (const bt of bf.themen) {
      const t = f.themen.find(x => x.id === bt.id);
      if (!t) f.themen.push(JSON.parse(JSON.stringify(bt)));
      else { if (bt.trainer && !t.trainer) t.trainer = bt.trainer; if (bt.inhalt && !t.inhalt) t.inhalt = bt.inhalt; if (bt.trainerThemen) t.trainerThemen = bt.trainerThemen; }
    }
  }
  for (const m of base.module) if (!plan.module.find(x => x.id === m.id)) plan.module.push(m);
  return plan;
}

async function loadBuiltin() {
  const idx = await fetchText('inhalte/index.json');
  if (!idx) return;
  let files = [];
  try { files = (JSON.parse(idx).dateien || []).map(f => (typeof f === 'string' ? { datei: f } : f)); } catch (e) { return; }
  const texts = await Promise.all(files.map(f => fetchText('inhalte/' + f.datei)));
  const voll = new Set();
  texts.forEach((txt, i) => {
    if (!txt) return;
    const intro = files[i].art === 'einfuehrung';
    const r = parseBlocks(txt);
    if (r.fehler.length) console.warn('Inhaltsdatei ' + files[i].datei, r.fehler);
    for (const t of r.themen) {
      const m = findThema(t.fach, t.thema, 'inhalte/' + files[i].datei);
      if (!m) { console.warn('Kein Lehrplan-Thema für', t.fach, t.thema); continue; }
      const old = S.builtin.get(m.thema.id);
      S.builtin.set(m.thema.id, old ? mergeTopic(old, t).topic : t);
      if (intro) S.introOnly.add(m.thema.id); else voll.add(m.thema.id);
    }
  });
  for (const tid of voll) S.introOnly.delete(tid);
  const fi = await fetchText('inhalte/faecher.json');
  if (fi) { try { S.fachIntro = JSON.parse(fi); } catch (e) { console.warn('faecher.json', e); } }
}
// Einleitung eines Fachs (Markdown) oder leer
export const fachIntro = fid => S.fachIntro[fid] || '';
// Hat das Thema nur die eingebaute Einführung, aber noch nichts aus dem Unterricht?
export const isIntroOnly = tid => S.introOnly.has(tid) && !(S.content.get(tid) && hasContent(S.content.get(tid)));

/* ===== Lehrplan ===== */
export const faecher = () => S.plan.faecher;
export const fach = id => S.plan.faecher.find(f => f.id === id);
export function thema(tid) {
  for (const f of S.plan.faecher) { const t = f.themen.find(x => x.id === tid); if (t) return { fach: f, thema: t }; }
  return null;
}
export function findFach(name) {
  const n = norm(name);
  if (!n) return null;
  return S.plan.faecher.find(f => norm(f.name) === n || norm(f.kurz) === n || norm(f.id) === n)
    || S.plan.faecher.find(f => norm(f.name).startsWith(n) || n.startsWith(norm(f.name)))
    || null;
}
export function findThema(fachName, themaName, inhalt) {
  for (const f of S.plan.faecher) for (const t of f.themen) if (inhalt && t.inhalt === inhalt) return { fach: f, thema: t };
  const f = findFach(fachName);
  if (!f) return null;
  const n = norm(themaName);
  const t = f.themen.find(x => norm(x.name) === n);
  return t ? { fach: f, thema: t } : null;
}
// Vorschlag für die Vorschau beim Einfügen
export function suggestThema(f, themaName) {
  if (!f) return null;
  const n = norm(themaName);
  return f.themen.find(x => norm(x.name) === n)
    || f.themen.find(x => n.length > 3 && (norm(x.name).includes(n) || n.includes(norm(x.name))))
    || null;
}

export async function savePlan() { await kvSet('lehrplan', S.plan); changed('plan'); }

const FARBEN = ['#FF9F0A', '#30D158', '#0A84FF', '#BF5AF2', '#FF375F', '#64D2FF', '#AC8E68', '#5E5CE6', '#FFD60A', '#00C7BE'];
export async function addFach(name, modul = '') {
  const id = slug(name);
  let fid = id, i = 2;
  while (fach(fid)) fid = id + '-' + i++;
  const f = { id: fid, name, kurz: name.length > 16 ? name.split(/\s/)[0] : name, module: modul ? [modul] : [], farbe: FARBEN[S.plan.faecher.length % FARBEN.length], themen: [], eigen: true };
  S.plan.faecher.push(f);
  await savePlan();
  return f;
}
export async function addThema(f, name) {
  let tid = f.id + '-' + slug(name), i = 2;
  while (thema(tid)) tid = f.id + '-' + slug(name) + '-' + i++;
  const t = { id: tid, name, eigen: true };
  f.themen.push(t);
  await savePlan();
  return t;
}

export const topic = tid => {
  const b = S.builtin.get(tid), u = S.content.get(tid);
  const th = thema(tid);
  if (!b && !u) { const e = emptyTopic(th ? th.fach.name : '', th ? th.thema.name : ''); return e; }
  const t = mergeTopic(b || emptyTopic(), u || emptyTopic()).topic;
  if (th) { t.fach = th.fach.name; t.thema = th.thema.name; }
  return t;
};
export const hasTopicContent = tid => !!(S.builtin.get(tid) && hasContent(S.builtin.get(tid))) || !!(S.content.get(tid) && hasContent(S.content.get(tid)));
export function status(tid) {
  if (kvGet('aktuell', []).includes(tid)) return 'aktuell';
  const th = thema(tid);
  if (th && th.thema.trainer && th.thema.trainer.length) return 'vorhanden';
  if (S.notes.some(n => n.tid === tid) || S.photoMeta.some(p => p.tid === tid)) return 'vorhanden';
  if (hasTopicContent(tid) && !isIntroOnly(tid)) return 'vorhanden';
  return 'geplant';
}
export async function setAktuell(tid, on) {
  const a = new Set(kvGet('aktuell', []));
  on ? a.add(tid) : a.delete(tid);
  await kvSet('aktuell', [...a]);
  changed('aktuell');
}

/* ===== Inhalte aus Blöcken übernehmen ===== */
// zuordnung: [{topic, fachId|null (neu), themaId|null (neu)}]
export async function saveBlocks(zuordnung, termine = []) {
  const out = [];
  for (const z of zuordnung) {
    let f = z.fachId ? fach(z.fachId) : findFach(z.topic.fach);
    if (!f) f = await addFach(z.topic.fach, z.topic.modul);
    if (z.topic.modul && !f.module.includes(z.topic.modul) && /^M\d$/.test(z.topic.modul)) { f.module.push(z.topic.modul); await savePlan(); }
    let t = z.themaId ? f.themen.find(x => x.id === z.themaId) : null;
    if (!t) t = await addThema(f, z.topic.thema);
    const old = S.content.get(t.id) || emptyTopic(f.name, t.name);
    const base = S.builtin.get(t.id);
    const neu = mergeTopic(base ? mergeTopic(base, old).topic : old, z.topic);
    const merged = mergeTopic(old, z.topic).topic;
    merged.fach = f.name; merged.thema = t.name;
    S.content.set(t.id, merged);
    await db.put('content', { id: t.id, topic: merged, zeit: Date.now() });
    out.push({ fach: f, thema: t, added: neu.added });
  }
  for (const x of termine) await addExam({ fach: x.fach, datum: x.datum, themen: x.themen });
  changed('content');
  return out;
}
export async function setUserTopic(tid, topicObj) {
  S.content.set(tid, topicObj);
  await db.put('content', { id: tid, topic: topicObj, zeit: Date.now() });
  changed('content');
}
export function exportTopic(tid) {
  const t = topic(tid);
  const ex = S.exams.filter(e => (e.themaIds || []).includes(tid)).map(e => ({ fach: fach(e.fachId) ? fach(e.fachId).name : e.fach, datum: e.datum, themen: e.themen }));
  return exportBlock(t, ex);
}

/* ===== Übungs-Elemente und Karten ===== */
export function topicItems(tid) {
  const t = topic(tid);
  const items = [];
  t.karten.forEach(k => items.push({ id: 'k:' + tid + ':' + hash(norm(k.frage)), art: 'karte', tid, frage: k.frage, antwort: k.antwort }));
  t.begriffe.forEach(b => b.erklaerung && items.push({ id: 'b:' + tid + ':' + hash(norm(b.begriff)), art: 'begriff', tid, frage: 'Was bedeutet „' + b.begriff + '“?', antwort: b.erklaerung, begriff: b.begriff }));
  t.aufgaben.forEach(a => items.push({ id: 'a:' + tid + ':' + hash(norm(a.text + a.gegeben.join(''))), art: 'aufgabe', tid, aufgabe: a }));
  const seen = new Set();
  t.umstellen.forEach(u => { seen.add(norm(u.formel) + '|' + keyOf(u.nach)); items.push({ id: 'u:' + tid + ':' + hash(norm(u.formel) + keyOf(u.nach)), art: 'umstellen', tid, u }); });
  t.formeln.forEach(f => f.umgestellt.forEach(g => {
    let nach;
    try { const e = parseEq(g); if (!e.l || e.l.t !== 'var') return; nach = e.l.n; parseEq(f.formel); } catch (err) { return; }
    const key = norm(f.formel) + '|' + keyOf(nach);
    if (seen.has(key)) return;
    seen.add(key);
    items.push({ id: 'u:' + tid + ':' + hash(norm(f.formel) + keyOf(nach)), art: 'umstellen', tid, u: { formel: f.formel, nach, loesung: g, umformungen: [], tipps: [], name: f.name } });
  }));
  t.auswahl.forEach(a => items.push({ id: 'w:' + tid + ':' + hash(norm(a.frage)), art: 'auswahl', tid, a }));
  t.reihenfolgen.forEach(r => items.push({ id: 'r:' + tid + ':' + hash(norm(r.titel)), art: 'reihenfolge', tid, r }));
  return items;
}
export const errorItem = e => ({ id: 'f:' + e.id, art: 'fehler', tid: e.tid, err: e });

export const card = id => S.cards.get(id);
export async function recordCard(item, ergebnis) {
  const today = dayStr();
  const old = S.cards.get(item.id);
  const st = nextState(old, ergebnis, today);
  st.id = item.id; st.tid = item.tid; st.art = item.art;
  S.cards.set(item.id, st);
  await db.put('cards', st);
  await addEvent({ art: item.art, tid: item.tid, ok: ergebnis === 'richtig', ergebnis });
  changed('cards');
  return st;
}

/* ===== Heute dran ===== */
export function nextExam(today = dayStr()) {
  return S.exams.filter(e => e.datum >= today).sort((a, b) => (a.datum < b.datum ? -1 : 1))[0] || null;
}
export function allTids() { return S.plan.faecher.flatMap(f => f.themen.map(t => t.id)); }

export function buildQueue(maxSec = 900, opt = {}) {
  const today = dayStr();
  const ex = opt.exam !== undefined ? opt.exam : nextExam(today);
  const exT = new Set(ex ? ex.themaIds || [] : []);
  const dEx = ex ? daysBetween(today, ex.datum) : null;
  const akt = new Set(kvGet('aktuell', []));
  const tids = opt.tids || allTids();
  const pool = [];
  for (const tid of tids) for (const it of topicItems(tid)) pool.push(it);
  if (!opt.tids || opt.mitFehlern) for (const e of S.errors) if (!e.erledigt && (!opt.tids || opt.tids.includes(e.tid))) pool.push(errorItem(e));
  const prio = it => (exT.has(it.tid) ? 0 : akt.has(it.tid) ? 1 : 2);
  const due = pool.filter(it => isDue(S.cards.get(it.id), today, exT.has(it.tid) ? dEx : null))
    .sort((a, b) => prio(a) - prio(b) || (S.cards.get(a.id).faellig < S.cards.get(b.id).faellig ? -1 : 1));
  const neu = pool.filter(it => !S.cards.get(it.id) && it.art !== 'fehler' && (exT.has(it.tid) || akt.has(it.tid) || opt.tids))
    .sort((a, b) => prio(a) - prio(b));
  const out = [];
  let sec = 0;
  const add = it => { const s = SEKUNDEN[it.art] || 40; if (sec + s > maxSec && out.length) return false; out.push(it); sec += s; return true; };
  for (const it of due) if (!add(it)) break;
  let n = 0;
  for (const it of neu) { if (n >= (opt.maxNeu || 8) || !add(it)) break; n++; }
  return { items: out, sekunden: sec, faellig: due.length };
}
export function dueTrainers(today = dayStr()) {
  const out = [];
  for (const f of S.plan.faecher) for (const t of f.themen) {
    if (!t.trainer || !t.trainer.length) continue;
    const c = S.cards.get('t:' + t.id);
    if (c && c.faellig <= today) out.push({ fach: f, thema: t, card: c });
  }
  return out;
}

/* ===== Termine ===== */
export function matchThemen(f, text) {
  if (!f || !text) return [];
  const parts = String(text).split(/[,;]| und /).map(s => norm(s)).filter(s => s.length > 2);
  return f.themen.filter(t => parts.some(p => norm(t.name).includes(p) || p.includes(norm(t.name)))).map(t => t.id);
}
export async function addExam(x) {
  let f = x.fachId ? fach(x.fachId) : findFach(x.fach);
  if (!f && x.fach) f = await addFach(x.fach);
  const e = { id: x.id || uid(), fachId: f ? f.id : '', fach: f ? f.name : x.fach, datum: toDay(x.datum) || x.datum, themen: x.themen || '', themaIds: x.themaIds || matchThemen(f, x.themen) };
  const dup = S.exams.find(o => o.id !== e.id && o.fachId === e.fachId && o.datum === e.datum);
  if (dup) e.id = dup.id;
  S.exams = S.exams.filter(o => o.id !== e.id).concat(e);
  await db.put('exams', e);
  changed('exams');
  return e;
}
export async function deleteExam(id) { S.exams = S.exams.filter(e => e.id !== id); await db.del('exams', id); changed('exams'); }

/* ===== Fehlerbuch ===== */
export async function addError(x) {
  const e = Object.assign({ id: uid(), zeit: Date.now(), fach: '', thema: '', tid: '', aufgabe: '', eingabe: '', richtig: '', fehlerart: 'Sonstiges', quelle: 'app', notiz: '' }, x);
  // Gleicher Fehler in derselben Minute: nicht doppelt eintragen
  if (S.errors.some(o => o.tid === e.tid && o.aufgabe === e.aufgabe && o.eingabe === e.eingabe && Math.abs(o.zeit - e.zeit) < 60000)) return null;
  S.errors.push(e);
  await db.put('errors', e);
  const c = { id: 'f:' + e.id, tid: e.tid, art: 'fehler', stufe: 0, richtig: 0, hilfe: 0, falsch: 0, faellig: addDays(dayStr(), 1) };
  S.cards.set(c.id, c);
  await db.put('cards', c);
  changed('errors');
  return e;
}
export async function updateError(e) { await db.put('errors', e); changed('errors'); }
export async function deleteError(id) {
  S.errors = S.errors.filter(e => e.id !== id);
  await db.del('errors', id); S.cards.delete('f:' + id); await db.del('cards', 'f:' + id);
  changed('errors');
}

/* ===== Ereignisse, Statistik, Weiter wo du warst ===== */
export async function addEvent(x) {
  const e = Object.assign({ id: uid(), zeit: Date.now() }, x);
  S.events.push(e);
  if (S.events.length > 5000) { const old = S.events.shift(); db.del('events', old.id); }
  await db.put('events', e);
}
export function weekStats() {
  const now = new Date();
  const mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  const tage = [0, 0, 0, 0, 0, 0, 0];
  let n = 0, ok = 0;
  for (const e of S.events) {
    if (e.zeit < mon.getTime()) continue;
    const d = new Date(e.zeit);
    tage[(d.getDay() + 6) % 7]++;
    if (e.ok != null) { n++; if (e.ok) ok++; }
  }
  return { tage, n, ok, aktiv: tage.filter(Boolean).length };
}
export async function setPlace(p) { await kvSet('zuletzt', Object.assign({ zeit: Date.now() }, p)); }
export const place = () => kvGet('zuletzt', null);

/* ===== Lernzettel ===== */
export async function saveNote(n) {
  const x = Object.assign({ id: uid(), zeit: Date.now() }, n);
  S.notes = S.notes.filter(o => o.id !== x.id).concat(x);
  await db.put('notes', x); changed('notes'); return x;
}
export async function deleteNote(id) { S.notes = S.notes.filter(n => n.id !== id); await db.del('notes', id); changed('notes'); }
export const notesFor = tid => S.notes.filter(n => n.tid === tid).sort((a, b) => b.zeit - a.zeit);

/* ===== Fotos ===== */
export async function savePhoto(tid, blob, titel = '') {
  const p = { id: uid(), tid, blob, titel, zeit: Date.now() };
  await db.put('photos', p);
  S.photoMeta.push({ id: p.id, tid, zeit: p.zeit, titel });
  changed('photos');
  return p;
}
export const photo = id => db.get('photos', id);
export const photosFor = tid => S.photoMeta.filter(p => p.tid === tid).sort((a, b) => b.zeit - a.zeit);
export async function deletePhoto(id) { S.photoMeta = S.photoMeta.filter(p => p.id !== id); await db.del('photos', id); changed('photos'); }

/* ===== Alte Trainer: Eingang aus lernwerk-bridge.js ===== */
export function trainerThema(datei, label) {
  const hits = [];
  for (const f of S.plan.faecher) for (const t of f.themen) if ((t.trainer || []).some(x => x.datei === 'trainer/' + datei || x.datei === datei)) hits.push({ fach: f, thema: t });
  if (!hits.length) return null;
  const l = norm(label);
  if (l) {
    const h = hits.find(x => (x.thema.trainerThemen || []).some(k => l.includes(norm(k)) || norm(k) === l));
    if (h) return h;
  }
  return hits[0];
}
export async function ingestInbox() {
  let box = [];
  try { box = JSON.parse(localStorage.getItem('lernwerk:inbox') || '[]'); } catch (e) { box = []; }
  if (!box.length) return 0;
  try { localStorage.removeItem('lernwerk:inbox'); } catch (e) { /* egal */ }
  const today = dayStr();
  for (const x of box) {
    const m = trainerThema(x.datei, x.thema);
    const tid = m ? m.thema.id : '';
    const it = { id: 't:' + tid, tid, art: 'trainer' };
    if (x.art === 'fehler') {
      await addError({ zeit: x.zeit, fach: m ? m.fach.name : '', thema: m ? m.thema.name : x.thema, tid, aufgabe: x.aufgabe || '', eingabe: x.eingabe || '', richtig: x.richtig || '', fehlerart: x.fehlerart || 'Sonstiges', quelle: 'trainer', notiz: x.meldung || '' });
      await addEvent({ art: 'trainer-schritt', tid, ok: false, zeit: x.zeit, quelle: x.datei });
    } else if (x.art === 'schritt') {
      await addEvent({ art: 'trainer-schritt', tid, ok: !!x.ok, zeit: x.zeit, quelle: x.datei });
    } else if (x.art === 'aufgabe' && tid) {
      const c = S.cards.get(it.id);
      const erg = x.ok ? 'richtig' : 'hilfe';
      // pro Tag zählt nur die erste gelöste Aufgabe für die Wiederholung
      if (!c || c.zuletzt !== today) await recordCard(it, erg);
      else await addEvent({ art: 'trainer', tid, ok: !!x.ok, zeit: x.zeit, quelle: x.datei });
    } else if (x.art === 'sitzung' && tid) {
      await recordCard(it, { sitzt: 'richtig', wackelt: 'hilfe', sitztnicht: 'falsch' }[x.bewertung] || 'hilfe');
    }
    if (tid && x.art !== 'schritt') await setPlace({ art: 'trainer', tid, datei: x.datei, titel: m.thema.name });
  }
  changed('inbox');
  return box.length;
}

/* ===== Datensicherung ===== */
const blobToDataURL = b => new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => res(null); r.readAsDataURL(b); });
async function dataURLToBlob(u) { const r = await fetch(u); return r.blob(); }

export async function exportBackup(mitFotos) {
  const photos = [];
  if (mitFotos) for (const m of S.photoMeta) { const p = await db.get('photos', m.id); if (p && p.blob) photos.push({ id: p.id, tid: p.tid, titel: p.titel, zeit: p.zeit, data: await blobToDataURL(p.blob) }); }
  const bloecke = [...S.content.keys()].map(tid => exportBlock(S.content.get(tid))).join('\n\n');
  const kv = {};
  for (const [k, v] of S.kv) kv[k] = v;
  return {
    app: 'Lernwerk Techniker', format: 1, erstellt: new Date().toISOString(),
    hinweis: 'Eigene Inhalte stehen zusätzlich im Lernwerk-Format unter "bloecke".',
    kv, content: [...S.content].map(([id, topic]) => ({ id, topic })), notes: S.notes, cards: [...S.cards.values()],
    errors: S.errors, events: S.events, exams: S.exams, photos, bloecke,
    einstellungen: { theme: db.prefs.get('theme', 'auto') }
  };
}
export async function importBackup(data) {
  if (!data || data.format !== 1 || !data.kv) throw new Error('Das ist keine Lernwerk-Sicherung.');
  for (const s of ['kv', 'content', 'notes', 'cards', 'errors', 'events', 'exams']) await db.clear(s);
  for (const [k, v] of Object.entries(data.kv)) await db.put('kv', v, k);
  for (const c of data.content || []) await db.put('content', c);
  for (const s of ['notes', 'cards', 'errors', 'events', 'exams']) for (const x of data[s] || []) await db.put(s, x);
  if (data.photos && data.photos.length) {
    await db.clear('photos');
    for (const p of data.photos) { const blob = await dataURLToBlob(p.data); await db.put('photos', { id: p.id, tid: p.tid, titel: p.titel, zeit: p.zeit, blob }); }
  }
  if (data.einstellungen && data.einstellungen.theme) db.prefs.set('theme', data.einstellungen.theme);
  await kvSet('letzteSicherung', kvGet('letzteSicherung', null));
}
export async function markBackup() { await kvSet('letzteSicherung', dayStr()); changed('backup'); }
export function backupDue() {
  const last = kvGet('letzteSicherung', null);
  const first = kvGet('ersterStart', dayStr());
  const ref = last || first;
  const hasData = S.events.length || S.content.size || S.notes.length || S.errors.length;
  return hasData && daysBetween(ref, dayStr()) >= 14;
}

/* ===== Suche ===== */
export function searchAll(q) {
  const n = String(q || '').toLowerCase().trim();
  if (n.length < 2) return [];
  const hit = s => String(s || '').toLowerCase().includes(n);
  const out = [];
  for (const f of S.plan.faecher) for (const t of f.themen) {
    if (hit(t.name)) out.push({ art: 'Thema', titel: t.name, sub: f.name, tid: t.id });
    const c = topic(t.id);
    c.karten.forEach(k => (hit(k.frage) || hit(k.antwort)) && out.push({ art: 'Karte', titel: k.frage, sub: k.antwort, tid: t.id }));
    c.begriffe.forEach(b => (hit(b.begriff) || hit(b.erklaerung)) && out.push({ art: 'Lexikon', titel: b.begriff, sub: b.erklaerung, tid: t.id }));
    c.formeln.forEach(fo => (hit(fo.name) || hit(fo.formel) || fo.umgestellt.some(hit)) && out.push({ art: 'Formel', titel: fo.name || fo.formel, sub: fo.formel, tid: t.id, formel: fo.formel }));
    c.merksaetze.forEach(m => hit(m) && out.push({ art: 'Merksatz', titel: m, sub: t.name, tid: t.id }));
    c.prinzip.forEach(p => hit(p) && out.push({ art: 'Prinzip', titel: t.name, sub: excerpt(p, n), tid: t.id }));
  }
  for (const no of S.notes) if (hit(no.titel) || hit(no.text)) out.push({ art: 'Lernzettel', titel: no.titel || 'Lernzettel', sub: excerpt(no.text, n), tid: no.tid, noteId: no.id });
  for (const e of S.errors) if (hit(e.aufgabe) || hit(e.fehlerart) || hit(e.notiz)) out.push({ art: 'Fehlerbuch', titel: e.fehlerart, sub: e.aufgabe, errId: e.id, tid: e.tid });
  return out.slice(0, 200);
}
function excerpt(text, n) {
  const s = String(text || '').replace(/\s+/g, ' ');
  const i = s.toLowerCase().indexOf(n);
  if (i < 0) return s.slice(0, 120);
  return (i > 40 ? '…' : '') + s.slice(Math.max(0, i - 40), i + 80) + '…';
}
