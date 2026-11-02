// Zentraler Zustand der App: Lehrplan, Inhalte, Wiederholungen, Fehlerbuch, Termine.
import * as db from './db.js';
import { parseBlocks, mergeTopic, emptyTopic, exportBlock, hasContent } from './parser.js';
import { parseEq, keyOf } from './formula.js';
import { norm, slug, uid, dayStr, addDays, daysBetween, hash, toDay } from './util.js';
import { nextState, isDue, SEKUNDEN, verteilen, serie } from './srs.js';

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
// Jede Änderung bekommt einen Zeitstempel, damit beim Abgleich zwischen Geräten die neuere gewinnt
async function kvSet(k, v) {
  S.kv.set(k, v); await db.put('kv', v, k);
  if (k === 'kvZeit' || k === 'geloescht') return;
  const z = Object.assign({}, kvGet('kvZeit', {})); z[k] = Date.now();
  S.kv.set('kvZeit', z); await db.put('kv', z, 'kvZeit');
}
// Löschmarke: Was hier gelöscht wird, kommt beim Abgleich nicht vom anderen Gerät zurück
export async function loeschmarke(...keys) {
  const g = Object.assign({}, kvGet('geloescht', {}));
  for (const k of keys) g[k] = Date.now();
  S.kv.set('geloescht', g); await db.put('kv', g, 'geloescht');
}
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
  S.contentZeit = new Map(content.map(c => [c.id, c.zeit || 0]));
  S.contentErsetzt = new Map(content.filter(c => c.ersetzt).map(c => [c.id, c.ersetzt]));
  S.notes = notes; S.cards = new Map(cards.map(c => [c.id, c])); S.errors = errors; S.events = events; S.exams = exams;
  S.photoMeta = photos.map(p => ({ id: p.id, tid: p.tid, zeit: p.zeit, titel: p.titel }));

  const lp = await fetchText('lehrplan.json');
  S.base = lp ? JSON.parse(lp) : { version: 0, module: [], faecher: [] };
  let plan = kvGet('lehrplan', null);
  if (!plan) plan = JSON.parse(JSON.stringify(S.base));
  else if ((plan.baseVersion || 0) < S.base.version) plan = upgradePlan(plan, S.base);
  plan.baseVersion = S.base.version;
  S.plan = plan;
  S.planIds = planIds(plan);

  await loadBuiltin();
  await unterrichtVorgabe();
  await freigabeStart();
  if (!kvGet('ersterStart')) await kvSet('ersterStart', dayStr());
  await ingestInbox();
  db.requestPersist();
  S.ready = true;
}

// Themen, die laut lehrplan.json gerade neu im Unterricht sind, einmalig auf „Im Unterricht“ setzen.
// Nur bei bisherigen Nutzern und nur einmal je Thema, damit eigene Einstellungen danach bleiben.
async function unterrichtVorgabe() {
  const done = new Set(kvGet('unterrichtVorgabe', []));
  const neu = S.base.faecher.flatMap(f => f.themen).filter(t => t.unterricht && !done.has(t.id) && thema(t.id)).map(t => t.id);
  if (!neu.length) return;
  if (kvGet('ersterStart')) for (const tid of neu) if (zustand(tid) === 'kommt') await setZustand(tid, 'aktuell');
  await kvSet('unterrichtVorgabe', [...done, ...neu]);
}

// Neue Themen aus einer neueren lehrplan.json übernehmen, eigene Änderungen behalten.
// Was gelöscht wurde, holt das Update nicht zurück.
function upgradePlan(plan, base) {
  const gel = kvGet('geloescht', {});
  for (const bf of base.faecher) {
    let f = plan.faecher.find(x => x.id === bf.id);
    if (!f) { if (!gel['fach:' + bf.id]) plan.faecher.push(JSON.parse(JSON.stringify(bf))); continue; }
    for (const bt of bf.themen) {
      const t = f.themen.find(x => x.id === bt.id);
      if (!t) { if (!gel['thema:' + bt.id]) f.themen.push(JSON.parse(JSON.stringify(bt))); }
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
// Andere Namen, die im Unterricht oder im Chat für dieselben Fächer vorkommen
const FACH_ALIAS = {
  werkstoffkunde: 'ws', werkstoffe: 'ws', werkstoff: 'ws', mathe: 'mathe', elektro: 'et', mechanik: 'tm', statik: 'tm', festigkeitslehre: 'tm',
  maschinenelemente: 'tm', technischeszeichnen: 'tol', toleranzen: 'tol', pneumatik: 'st', sps: 'st', steuerungstechnik: 'st', automatisierungstechnik: 'auto',
  projektmanagement: 'pm', qualitaetsmanagement: 'm7', qm: 'm7', bwl: 'm8', betriebswirtschaft: 'm8', betriebswirtschaftslehre: 'm8', oekonomie: 'm8',
  personal: 'm6', personalwesen: 'm6', fuehrung: 'm6', instandhaltung: 'm5', arbeitssicherheit: 'm5', deutsch: 'de', englisch: 'en'
};
const ae = s => String(s).toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');
// Erstes richtiges Wort eines Fachnamens, zum Beispiel „werkstofftechnik“
const kernwort = s => (ae(s).match(/[a-z]{3,}/g) || []).find(w => !['und', 'der', 'die', 'das', 'technische', 'technisches'].includes(w)) || '';
const gemeinsam = (a, b) => { let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++; return i; };
export function findFach(name) {
  const n = norm(name);
  if (!n) return null;
  const al = FACH_ALIAS[ae(name).replace(/[^a-z]/g, '')];
  return S.plan.faecher.find(f => norm(f.name) === n || norm(f.kurz) === n || norm(f.id) === n)
    || S.plan.faecher.find(f => norm(f.name).startsWith(n) || n.startsWith(norm(f.name)))
    || (al && S.plan.faecher.find(f => f.id === al))
    // Gleicher Wortstamm, zum Beispiel Werkstoffkunde und Werkstofftechnik
    || S.plan.faecher.find(f => { const a = kernwort(name), b = kernwort(f.name), k = kernwort(f.kurz || ''); return a.length >= 6 && (gemeinsam(a, b) >= 7 || gemeinsam(a, k) >= 7); })
    || null;
}
// Eigenes Fach, das wohl dasselbe ist wie ein anderes (zum Beispiel Werkstoffkunde und Werkstofftechnik)
export function aehnlichesFach(f) {
  if (!f || !f.eigen) return null;
  const al = FACH_ALIAS[ae(f.name).replace(/[^a-z]/g, '')];
  const a = kernwort(f.name);
  return S.plan.faecher.find(x => x !== f && ((al && x.id === al) || (a.length >= 6 && (gemeinsam(a, kernwort(x.name)) >= 7 || gemeinsam(a, kernwort(x.kurz || '')) >= 7)))) || null;
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

const planIds = p => new Set((p ? p.faecher : []).flatMap(f => ['fach:' + f.id, ...f.themen.map(t => 'thema:' + t.id)]));
// Gelöschte Fächer und Themen erkennt der Vergleich mit dem letzten gespeicherten Lehrplan
export async function savePlan() {
  const jetzt = planIds(S.plan);
  const weg = [...(S.planIds || [])].filter(k => !jetzt.has(k));
  if (weg.length) await loeschmarke(...weg);
  S.planIds = jetzt;
  await kvSet('lehrplan', S.plan); changed('plan');
}

const FARBEN = ['#FF9F0A', '#30D158', '#0A84FF', '#BF5AF2', '#FF375F', '#64D2FF', '#AC8E68', '#5E5CE6', '#FFD60A', '#00C7BE'];
export async function addFach(name, modul = '') {
  const id = slug(name);
  let fid = id, i = 2;
  while (fach(fid)) fid = id + '-' + i++;
  const f = { id: fid, name, kurz: name.length > 16 ? name.split(/\s/)[0] : name, module: modul ? [modul] : [], farbe: FARBEN[S.plan.faecher.length % FARBEN.length], themen: [], eigen: true, angelegt: Date.now() };
  S.plan.faecher.push(f);
  await savePlan();
  return f;
}
export async function addThema(f, name) {
  let tid = f.id + '-' + slug(name), i = 2;
  while (thema(tid)) tid = f.id + '-' + slug(name) + '-' + i++;
  const t = { id: tid, name, eigen: true, angelegt: Date.now() };
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
  if (kvGet('abgeschlossen', []).includes(tid)) return 'abgeschlossen';
  const th = thema(tid);
  if (th && th.thema.trainer && th.thema.trainer.length) return 'vorhanden';
  if (S.notes.some(n => n.tid === tid) || S.photoMeta.some(p => p.tid === tid)) return 'vorhanden';
  if (hasTopicContent(tid) && !isIntroOnly(tid)) return 'vorhanden';
  return 'geplant';
}
export async function setAktuell(tid, on) { await setZustand(tid, on ? 'aktuell' : 'kommt'); }
/* ===== Zustand eines Themas: kommt noch, im Unterricht, abgeschlossen ===== */
export function zustand(tid) {
  if (kvGet('aktuell', []).includes(tid)) return 'aktuell';
  if (kvGet('abgeschlossen', []).includes(tid)) return 'fertig';
  return 'kommt';
}
export async function setZustand(tid, z) {
  const a = new Set(kvGet('aktuell', [])), f = new Set(kvGet('abgeschlossen', []));
  const seit = Object.assign({}, kvGet('aktuellSeit', {}));
  a.delete(tid); f.delete(tid);
  if (z === 'aktuell') { a.add(tid); if (!seit[tid]) seit[tid] = dayStr(); } else delete seit[tid];
  if (z === 'fertig') f.add(tid);
  await kvSet('aktuell', [...a]);
  await kvSet('abgeschlossen', [...f]);
  await kvSet('aktuellSeit', seit);
  await kvSet('zustandZeit', Object.assign({}, kvGet('zustandZeit', {}), { [tid]: Date.now() }));
  changed('aktuell');
}
export const abgeschlosseneTids = () => kvGet('abgeschlossen', []).filter(t => thema(t));
// Seit über fünf Wochen im Unterricht und zwei Wochen nicht geübt: Vorschlag zum Abschließen
export function abschliessenVorschlag(today = dayStr()) {
  const seit = kvGet('aktuellSeit', {});
  const grenze = Date.now() - 14 * 86400000;
  return kvGet('aktuell', []).filter(t => thema(t) && seit[t] && daysBetween(seit[t], today) >= 35 && !S.events.some(e => e.tid === t && e.zeit >= grenze));
}

/* ===== Stärke eines Themas: schwach, mittel oder sicher =====
 * Aus den letzten Übungen (erster Versuch richtig), dem Ansatz, offenen Fehlern und der letzten Klausur.
 * Die Klausur zählt am Anfang stark und mit jeder Übung danach weniger, nach zehn Übungen gar nicht mehr.
 */
export function staerke(tid) {
  const ev = S.events.filter(e => e.tid === tid && e.ok != null && e.art !== 'ansatz' && e.art !== 'trainer-schritt').slice(-12);
  const an = S.events.filter(e => e.tid === tid && e.art === 'ansatz').slice(-8);
  const offen = S.errors.filter(e => !e.erledigt && e.tid === tid).length;
  let base = null;
  if (ev.length >= 3) {
    const q = ev.filter(e => e.ok).length / ev.length;
    const a = an.length >= 2 ? an.filter(e => e.ok).length / an.length : q;
    base = 0.7 * q + 0.3 * a;
  }
  let k = null, w = 0;
  const ex = S.exams.filter(e => (e.note != null || e.prozent != null) && (e.themaIds || []).includes(tid)).sort((a, b) => (a.datum < b.datum ? 1 : -1))[0];
  if (ex) {
    k = { gut: 0.9, mittel: 0.65, schlecht: 0.3 }[themaErgebnis(ex, tid)];
    const ab = new Date(ex.datum).getTime();
    w = Math.max(0, 1 - S.events.filter(e => e.tid === tid && e.ok != null && e.art !== 'trainer-schritt' && e.zeit >= ab).length / 10);
  }
  let v = base == null ? (k == null ? null : k) : k == null ? base : w * k + (1 - w) * base;
  if (v == null) return { wert: null, stufe: offen ? 'schwach' : 'mittel', n: ev.length };
  v = Math.max(0, v - 0.05 * Math.min(offen, 4));
  return { wert: v, stufe: v < 0.6 ? 'schwach' : v < 0.8 ? 'mittel' : 'sicher', n: ev.length };
}

/* ===== Thema oder Fach zusammenlegen =====
 * Falsch angelegt, zum Beispiel „Werkstoffkunde“ neben „Werkstofftechnik“: Alles wandert ins richtige Thema,
 * mit Fortschritt, Lernzetteln, Fotos und Fehlern. Das alte Thema verschwindet, auch auf den anderen Geräten.
 */
export async function themaZusammenlegen(von, nach) {
  if (von === nach) return;
  const marken = [];
  const c = S.content.get(von);
  if (c) {
    const ziel = S.content.get(nach) || emptyTopic();
    const m = mergeTopic(ziel, c).topic;
    const th = thema(nach); if (th) { m.fach = th.fach.name; m.thema = th.thema.name; }
    S.content.set(nach, m); S.contentZeit.set(nach, Date.now());
    await db.put('content', { id: nach, topic: m, zeit: Date.now() });
    S.content.delete(von); S.contentZeit.delete(von); await db.del('content', von); marken.push('content:' + von);
  }
  // Karten tragen das Thema in der Kennung: umbenennen, der bessere Stand gewinnt
  for (const card of [...S.cards.values()]) {
    const m = /^([a-z]+):(.+?):([^:]+)$/.exec(card.id);
    if (!(m && m[2] === von) && card.id !== 't:' + von) { if (card.tid === von) { card.tid = nach; card.zeit = Date.now(); await db.put('cards', card); } continue; }
    const neu = card.id === 't:' + von ? 't:' + nach : m[1] + ':' + nach + ':' + m[3];
    const da = S.cards.get(neu);
    if (!da || (card.stufe || 0) > (da.stufe || 0)) { const x = Object.assign({}, card, { id: neu, tid: nach, zeit: Date.now() }); S.cards.set(neu, x); await db.put('cards', x); }
    S.cards.delete(card.id); await db.del('cards', card.id); marken.push('cards:' + card.id);
  }
  const zt = thema(nach);
  for (const n of S.notes) if (n.tid === von) { n.tid = nach; n.geaendert = Date.now(); await db.put('notes', n); }
  for (const e of S.errors) if (e.tid === von) { e.tid = nach; if (zt) { e.thema = zt.thema.name; e.fach = zt.fach.name; } e.geaendert = Date.now(); await db.put('errors', e); }
  for (const e of S.events) if (e.tid === von) { e.tid = nach; await db.put('events', e); }
  for (const p of S.photoMeta) if (p.tid === von) { p.tid = nach; const x = await db.get('photos', p.id); if (x) { x.tid = nach; await db.put('photos', x); } }
  for (const x of S.exams) if ((x.themaIds || []).includes(von)) { x.themaIds = [...new Set(x.themaIds.map(t => (t === von ? nach : t)))]; x.geaendert = Date.now(); await db.put('exams', x); }
  // Status und Stufe übernehmen, wenn das Ziel noch keine hat
  if (zustand(von) !== 'kommt' && zustand(nach) === 'kommt') await setZustand(nach, zustand(von));
  const fr = Object.assign({}, kvGet('freigabe', {}));
  if (fr[von] && !(fr[nach] >= fr[von])) { fr[nach] = fr[von]; await kvSet('freigabe', fr); }
  if (marken.length) await loeschmarke(...marken);
  const alt = thema(von);
  if (alt) alt.fach.themen = alt.fach.themen.filter(t => t.id !== von);
  await savePlan();
  changed('content');
}
// Fach in ein anderes legen: gleichnamige Themen werden zusammengelegt, die anderen wandern mit
export async function fachZusammenlegen(vonFid, nachFid) {
  const von = fach(vonFid), nach = fach(nachFid);
  if (!von || !nach || von === nach) return 0;
  let n = 0;
  for (const t of von.themen.slice()) {
    const ziel = suggestThema(nach, t.name);
    if (ziel) await themaZusammenlegen(t.id, ziel.id);
    else { von.themen = von.themen.filter(x => x.id !== t.id); nach.themen.push(t); for (const e of S.errors) if (e.tid === t.id) { e.fach = nach.name; e.geaendert = Date.now(); await db.put('errors', e); } }
    n++;
  }
  for (const x of S.exams) if (x.fachId === vonFid) { x.fachId = nachFid; x.fach = nach.name; x.geaendert = Date.now(); await db.put('exams', x); }
  S.plan.faecher = S.plan.faecher.filter(f => f.id !== vonFid);
  await savePlan();
  changed('content');
  return n;
}

/* ===== Inhalte aus Blöcken übernehmen ===== */
// zuordnung: [{topic, fachId|null (neu), themaId|null (neu)}]
// opt.ersetzen: Was bisher in diesen Themen eingefügt war, fliegt raus und wird durch den neuen Text ersetzt.
// Mehrere Blöcke zum selben Thema in einem Text werden dabei zusammen übernommen.
export async function saveBlocks(zuordnung, termine = [], opt = {}) {
  const out = [], ersetzt = new Set();
  for (const z of zuordnung) {
    let f = z.fachId ? fach(z.fachId) : findFach(z.topic.fach);
    if (!f) f = await addFach(z.topic.fach, z.topic.modul);
    if (z.topic.modul && !f.module.includes(z.topic.modul) && /^M\d$/.test(z.topic.modul)) { f.module.push(z.topic.modul); await savePlan(); }
    let t = z.themaId ? f.themen.find(x => x.id === z.themaId) : null;
    if (!t) t = await addThema(f, z.topic.thema);
    const ersetzen = opt.ersetzen && !ersetzt.has(t.id);
    if (ersetzen) ersetzt.add(t.id);
    const old = (!ersetzen && S.content.get(t.id)) || emptyTopic(f.name, t.name);
    const base = S.builtin.get(t.id);
    const neu = mergeTopic(base ? mergeTopic(base, old).topic : old, z.topic);
    const merged = mergeTopic(old, z.topic).topic;
    merged.fach = f.name; merged.thema = t.name;
    S.content.set(t.id, merged); S.contentZeit.set(t.id, Date.now());
    if (opt.ersetzen) S.contentErsetzt.set(t.id, Date.now());
    // „ersetzt“ sagt dem Abgleich: ältere Fassungen auf anderen Geräten nicht wieder dazumischen
    await db.put('content', Object.assign({ id: t.id, topic: merged, zeit: Date.now() }, S.contentErsetzt.get(t.id) ? { ersetzt: S.contentErsetzt.get(t.id) } : {}));
    out.push({ fach: f, thema: t, added: neu.added });
  }
  for (const x of termine) await addExam({ fach: x.fach, datum: x.datum, themen: x.themen });
  changed('content');
  return out;
}
export async function setUserTopic(tid, topicObj) {
  S.content.set(tid, topicObj); S.contentZeit.set(tid, Date.now());
  await db.put('content', { id: tid, topic: topicObj, zeit: Date.now() });
  changed('content');
}
export function exportTopic(tid) {
  const t = topic(tid);
  const ex = S.exams.filter(e => (e.themaIds || []).includes(tid)).map(e => ({ fach: fach(e.fachId) ? fach(e.fachId).name : e.fach, datum: e.datum, themen: e.themen }));
  return exportBlock(t, ex);
}

/* ===== Übungs-Elemente und Karten ===== */
function itemsOf(t, tid) {
  const items = [];
  const st = o => (o && o.stufe) || 0;
  t.karten.forEach(k => items.push({ id: 'k:' + tid + ':' + hash(norm(k.frage)), art: 'karte', tid, frage: k.frage, antwort: k.antwort, s: st(k) }));
  t.begriffe.forEach(b => b.erklaerung && items.push({ id: 'b:' + tid + ':' + hash(norm(b.begriff)), art: 'begriff', tid, frage: 'Was bedeutet „' + b.begriff + '“?', antwort: b.erklaerung, begriff: b.begriff, s: st(b) }));
  t.aufgaben.forEach(a => items.push({ id: 'a:' + tid + ':' + hash(norm(a.text + a.gegeben.join(''))), art: 'aufgabe', tid, aufgabe: a, s: st(a) }));
  const seen = new Set();
  t.umstellen.forEach(u => { seen.add(norm(u.formel) + '|' + keyOf(u.nach)); items.push({ id: 'u:' + tid + ':' + hash(norm(u.formel) + keyOf(u.nach)), art: 'umstellen', tid, u, s: st(u) }); });
  t.formeln.forEach(f => f.umgestellt.forEach(g => {
    let nach;
    try { const e = parseEq(g); if (!e.l || e.l.t !== 'var') return; nach = e.l.n; parseEq(f.formel); } catch (err) { return; }
    const key = norm(f.formel) + '|' + keyOf(nach);
    if (seen.has(key)) return;
    seen.add(key);
    items.push({ id: 'u:' + tid + ':' + hash(norm(f.formel) + keyOf(nach)), art: 'umstellen', tid, u: { formel: f.formel, nach, loesung: g, umformungen: [], tipps: [], name: f.name }, s: st(f) });
  }));
  t.auswahl.forEach(a => items.push({ id: 'w:' + tid + ':' + hash(norm(a.frage)), art: 'auswahl', tid, a, s: st(a) }));
  t.reihenfolgen.forEach(r => items.push({ id: 'r:' + tid + ':' + hash(norm(r.titel)), art: 'reihenfolge', tid, r, s: st(r) }));
  (t.verwechslungen || []).forEach(v => items.push({ id: 'v:' + tid + ':' + hash(norm(v.a + '|' + v.b)), art: 'verwechslung', tid, v, s: st(v) }));
  (t.zuordnen || []).forEach(z => z.paare.length >= 2 && items.push({ id: 'z:' + tid + ':' + hash(norm(z.titel)), art: 'zuordnen', tid, z, s: st(z) }));
  return items;
}
/* ===== Stufen pro Thema =====
 * 1 Grundlagen, 2 Zusammenhänge, 3 Anwenden. Ohne Stufe-Zeile ordnet die App selbst zu.
 * Abgefragt wird nur, was freigeschaltet ist. Eigene eingefügte Inhalte sind immer frei.
 */
export const STUFEN_NAMEN = { 1: 'Grundlagen', 2: 'Zusammenhänge', 3: 'Anwenden' };
const SCHWER = /^(warum|wieso|weshalb|wie hängt|wie hangen|was passiert|was ändert|was bewirkt|wann |wodurch|welche folge|vergleiche|worin unterscheid)/i;
export function autoStufe(it) {
  if (it.s) return it.s;
  if (it.art === 'begriff') return 1;
  if (it.art === 'karte') return SCHWER.test(it.frage.trim()) || it.antwort.length > 140 ? 2 : 1;
  if (it.art === 'aufgabe' || it.art === 'auswahl') return 3;
  return 2; // umstellen, reihenfolge, verwechslung, zuordnen
}
export function topicItems(tid) {
  const b = S.builtin.get(tid), u = S.content.get(tid);
  const eigen = new Set(u ? itemsOf(u, tid).map(i => i.id) : []);
  const items = itemsOf(topic(tid), tid);
  for (const it of items) { it.stufe = autoStufe(it); it.eigen = !b || eigen.has(it.id); delete it.s; }
  return items;
}
// Freigeschaltete Stufe eines Themas (1 bis 3)
export function freigabe(tid) {
  const v = kvGet('freigabe', {})[tid];
  if (v) return v;
  return S.builtin.get(tid) ? 1 : 3;
}
export async function setFreigabe(tid, n) {
  const f = Object.assign({}, kvGet('freigabe', {}));
  f[tid] = Math.max(1, Math.min(3, n));
  await kvSet('freigabe', f);
  changed('freigabe');
}
// Einmalig beim Update: Themen, in denen schon gelernt wurde, behalten alles, was schon dran war.
async function freigabeStart() {
  if (kvGet('freigabeStart')) return;
  const f = {};
  const fertig = new Set(kvGet('abgeschlossen', []));
  for (const tid of allTids()) {
    if (!S.builtin.get(tid)) continue;
    let n = fertig.has(tid) || S.cards.get('t:' + tid) ? 3 : 1;
    for (const it of topicItems(tid)) if (S.cards.get(it.id)) n = Math.max(n, it.stufe);
    if (n > 1) f[tid] = n;
  }
  await kvSet('freigabe', Object.assign(f, kvGet('freigabe', {})));
  await kvSet('freigabeStart', dayStr());
}
// Übungsmodus: frei (nur freigeschaltet), alles (auch gesperrte Stufen), schwer (Stufe 3 und Karten mit vielen Fehlern)
export const MODI = [['frei', 'Freigeschaltet'], ['alles', 'Alles gemischt'], ['schwer', 'Nur schwere']];
export const modus = () => kvGet('uebModus', 'frei');
export async function setModus(m) { await kvSet('uebModus', m); changed('modus'); }
export function sichtbar(it, m = modus()) {
  if (!it.tid || it.art === 'fehler' || it.art === 'auffrischen') return true;
  if (m === 'alles') return true;
  if (m === 'schwer') { const c = S.cards.get(it.id); return it.stufe === 3 || !!(c && c.falsch >= 2); }
  // Rechenaufgaben aus Themen mit Trainer sind immer frei: Die hast du im Trainer schon gerechnet.
  return it.eigen || it.stufe <= freigabe(it.tid) || (hatTrainer(it.tid) && (it.art === 'aufgabe' || it.art === 'umstellen'));
}
export const hatTrainer = tid => { const th = thema(tid); return !!(th && th.thema.trainer && th.thema.trainer.length); };
// Nur die Übungen, die im gewählten Modus dran sind
export const uebItems = (tid, m) => topicItems(tid).filter(it => sichtbar(it, m));
// Sitzt die freigeschaltete Stufe? 70 % ihrer Fragen mindestens auf Wiederhol-Stufe 3 (4 Tage).
export function stufeSitzt(tid) {
  const n = freigabe(tid);
  if (n >= 3) return false;
  const its = topicItems(tid).filter(it => !it.eigen && it.stufe === n);
  if (its.length < 2) return its.length > 0 && its.every(it => (S.cards.get(it.id) || {}).stufe >= 3);
  return its.filter(it => (S.cards.get(it.id) || {}).stufe >= 3).length / its.length >= 0.7;
}
// Aufgaben nur für die Probeklausur: Erklären, Skizze und Text aus Begriffen und Karten
export function pruefItems(tid) {
  const t = topic(tid), out = [];
  (t.erklaeren || []).forEach(e => out.push({ id: 'e:' + tid + ':' + hash(norm(e.aufgabe)), art: 'erklaeren', tid, frage: e.aufgabe, kern: e.kern }));
  (t.skizzen || []).forEach(e => out.push({ id: 's:' + tid + ':' + hash(norm(e.aufgabe)), art: 'skizze', tid, frage: e.aufgabe, kern: e.kern }));
  t.begriffe.forEach(b => b.erklaerung && out.push({ id: 'b:' + tid + ':' + hash(norm(b.begriff)), art: 'erklaeren', tid, frage: 'Erkläre den Begriff „' + b.begriff + '“.', kern: kernAus(b.erklaerung) }));
  t.karten.forEach(k => out.push({ id: 'k:' + tid + ':' + hash(norm(k.frage)), art: 'text', tid, frage: k.frage, kern: kernAus(k.antwort) }));
  return out;
}
// Musterantwort in abhakbare Kernpunkte teilen: an Semikolon oder Satzende
function kernAus(text) {
  const t = String(text || '').trim();
  const teile = (t.includes(';') ? t.split(';') : t.replace(/([.!?])\s+(?=[A-ZÄÖÜ])/g, '$1\n').split('\n')).map(x => x.trim()).filter(Boolean);
  return teile.length ? teile.slice(0, 4) : [t];
}
export const errorItem = e => ({ id: 'f:' + e.id, art: 'fehler', tid: e.tid, err: e });

export const card = id => S.cards.get(id);
export async function recordCard(item, ergebnis) {
  const today = dayStr();
  const old = S.cards.get(item.id);
  const st = nextState(old, ergebnis, today);
  // Schwache Themen kommen früher wieder, sichere später
  if (item.tid && item.art !== 'fehler') {
    const f = { schwach: 0.6, mittel: 1, sicher: 1.4 }[staerke(item.tid).stufe];
    if (f !== 1) st.faellig = addDays(today, Math.max(1, Math.round(daysBetween(today, st.faellig) * f)));
  }
  st.id = item.id; st.tid = item.tid; st.art = item.art; st.zeit = Date.now();
  S.cards.set(item.id, st);
  await db.put('cards', st);
  await addEvent({ art: item.art, tid: item.tid, ok: ergebnis === 'richtig', ergebnis });
  changed('cards');
  return st;
}

/* ===== Heute dran ===== */
export function nextExam(today = dayStr()) {
  return S.exams.filter(e => e.datum >= today && e.note == null && e.prozent == null).sort((a, b) => (a.datum < b.datum ? -1 : 1))[0] || null;
}
export function allTids() { return S.plan.faecher.flatMap(f => f.themen.map(t => t.id)); }

export function buildQueue(maxSec = 900, opt = {}) {
  const today = dayStr();
  const ex = opt.exam !== undefined ? opt.exam : nextExam(today);
  const exT = new Set(ex ? ex.themaIds || [] : []);
  const dEx = ex ? daysBetween(today, ex.datum) : null;
  const akt = new Set(kvGet('aktuell', []));
  const nach = nacharbeitThemen(today);
  const tids = opt.tids || allTids();
  const pool = [];
  const m = opt.modus || modus();
  for (const tid of tids) for (const it of topicItems(tid)) if (sichtbar(it, m)) pool.push(it);
  if (!opt.tids || opt.mitFehlern) for (const e of S.errors) if (!e.erledigt && (!opt.tids || opt.tids.includes(e.tid))) pool.push(errorItem(e));
  const stk = new Map();
  const stufe = tid => { if (!stk.has(tid)) stk.set(tid, tid ? staerke(tid).stufe : 'mittel'); return stk.get(tid); };
  const prio = it => (exT.has(it.tid) ? 0 : stufe(it.tid) === 'schwach' ? 1 : akt.has(it.tid) ? 2 : stufe(it.tid) === 'mittel' ? 3 : 4);
  const due = pool.filter(it => isDue(S.cards.get(it.id), today, exT.has(it.tid) ? dEx : null))
    .sort((a, b) => prio(a) - prio(b) || (S.cards.get(a.id).faellig < S.cards.get(b.id).faellig ? -1 : 1));
  const neu = pool.filter(it => !S.cards.get(it.id) && it.art !== 'fehler' && (exT.has(it.tid) || akt.has(it.tid) || nach.has(it.tid) || opt.tids))
    .sort((a, b) => prio(a) - prio(b));
  const out = [];
  let sec = 0;
  const add = it => { const s = SEKUNDEN[it.art] || 40; if (sec + s > maxSec && out.length) return false; out.push(it); sec += s; return true; };
  for (const it of due) if (!add(it)) break;
  let n = 0;
  for (const it of neu) { if (n >= (opt.maxNeu || 8) || !add(it)) break; n++; }
  return { items: out, sekunden: sec, faellig: due.length };
}
// Zeit um: fällige Karten, die heute nicht mehr drankamen, auf die nächsten drei Tage verteilen.
export async function verteileRest() {
  const today = dayStr();
  const q = buildQueue(1e9, { maxNeu: 0 });
  const rest = q.items.map(it => S.cards.get(it.id)).filter(c => c && c.faellig <= today && c.zuletzt !== today);
  for (const c of verteilen(rest, today)) { S.cards.set(c.id, c); await db.put('cards', c); }
  if (rest.length) changed('cards');
  return rest.length;
}
// Prüfungsbereitschaft in Prozent: Stand der freigeschalteten Fragen der Themen.
// Eine Frage zählt voll ab Wiederhol-Stufe 4, neue zählen 0. Jeder offene Fehler zieht 3 Punkte ab, höchstens 15.
export function bereitschaft(ex) {
  const tids = (ex && ex.themaIds) || [];
  const its = tids.flatMap(t => uebItems(t, 'frei'));
  if (!its.length) return null;
  let s = 0;
  for (const it of its) { const c = S.cards.get(it.id); if (c) s += Math.min(c.stufe, 4) / 4; }
  const offen = S.errors.filter(e => !e.erledigt && tids.includes(e.tid)).length;
  return Math.max(0, Math.round(s / its.length * 100 - Math.min(15, 3 * offen)));
}
// Serie: Tage am Stück gelernt, ein freier Tag pro Woche ist erlaubt
export function lernSerie() { return serie(S.events.filter(e => e.ok != null).map(e => dayStr(new Date(e.zeit))), dayStr()); }
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
  const e = { geaendert: Date.now(), id: x.id || uid(), fachId: f ? f.id : '', fach: f ? f.name : x.fach, datum: toDay(x.datum) || x.datum, themen: x.themen || '', themaIds: x.themaIds || matchThemen(f, x.themen) };
  // Ergebnis der Arbeit: Note, Prozent und wie es je Thema lief (gut, mittel, schlecht)
  for (const k of ['note', 'prozent', 'ergebnis', 'notiz']) if (x[k] != null && x[k] !== '') e[k] = x[k];
  const dup = S.exams.find(o => o.id !== e.id && o.fachId === e.fachId && o.datum === e.datum);
  if (dup) e.id = dup.id;
  S.exams = S.exams.filter(o => o.id !== e.id).concat(e);
  await db.put('exams', e);
  changed('exams');
  return e;
}
// Note nach dem IHK-Schlüssel aus Prozent, nur als Vorschlag
// Notenschlüssel: ab wie viel Prozent es die Noten 1 bis 5 gibt, darunter 6. Standard ist der IHK-Schlüssel.
export const IHK_SCHLUESSEL = [92, 81, 67, 50, 30];
export const notenSchluessel = () => { const k = kvGet('notenschluessel', null); return Array.isArray(k) && k.length === 5 ? k : IHK_SCHLUESSEL; };
export async function setNotenSchluessel(k) { await kvSet('notenschluessel', k); changed('noten'); }
export function noteAusProzent(p) {
  if (p == null || !isFinite(p)) return null;
  const k = notenSchluessel();
  for (let i = 0; i < 5; i++) if (p >= k[i]) return i + 1;
  return 6;
}
// Wie viel Prozent fehlen bis zur nächstbesseren Note? null bei der 1
export function bisZurBesserenNote(p) {
  const n = noteAusProzent(p);
  if (!n || n === 1) return null;
  return { note: n - 1, fehlt: Math.round((notenSchluessel()[n - 2] - p) * 10) / 10 };
}
// Wie lief ein Thema in der Arbeit? Ohne eigene Angabe zählt das Gesamtergebnis
export function themaErgebnis(e, tid) {
  if (e.ergebnis && e.ergebnis[tid]) return e.ergebnis[tid];
  // Note 1 und 2 sind gut, 3 ist mittel, ab 4 schlecht. Prozent laufen über den Notenschlüssel.
  const n = e.prozent != null ? noteAusProzent(e.prozent) : e.note != null ? e.note : null;
  if (n == null) return null;
  return n < 2.5 ? 'gut' : n < 3.5 ? 'mittel' : 'schlecht';
}
// Themen zum Nacharbeiten: In der letzten benoteten Arbeit mittel oder schlecht, nicht älter als 120 Tage
export function nacharbeitThemen(today = dayStr()) {
  const out = new Map();
  const graded = S.exams.filter(e => (e.note != null || e.prozent != null) && e.datum <= today && daysBetween(e.datum, today) <= 120)
    .sort((a, b) => (a.datum < b.datum ? 1 : -1));
  for (const e of graded) for (const tid of e.themaIds || []) {
    if (out.has(tid) || !thema(tid)) continue;
    out.set(tid, { bewertung: themaErgebnis(e, tid), exam: e });
  }
  for (const [tid, v] of out) if (v.bewertung !== 'mittel' && v.bewertung !== 'schlecht') out.delete(tid);
  return out;
}
// Der Lernplan beginnt an dem Tag, an dem er zum ersten Mal gezeigt wurde, und läuft dann Tag für Tag weiter
export function planStart(ex, today = dayStr()) {
  const ps = kvGet('planStart', {});
  if (ps[ex.id] && ps[ex.id] <= today) return ps[ex.id];
  kvSet('planStart', Object.assign({}, ps, { [ex.id]: today }));
  return today;
}
// Erledigte Tage im Lernplan: Plantag zu dem Tag, an dem er wirklich gelernt wurde.
// Ältere Stände speichern nur eine Liste von Tagen, die zählen als am selben Tag gelernt.
export function planErledigt(ex) {
  const v = kvGet('planErledigt', {})[ex.id];
  if (Array.isArray(v)) return Object.fromEntries(v.map(d => [d, d]));
  return Object.assign({}, v || {});
}
export async function planAbhaken(ex, planTag, heute = dayStr()) {
  const alle = Object.assign({}, kvGet('planErledigt', {}));
  alle[ex.id] = Object.assign(planErledigt(ex), { [planTag]: heute });
  await kvSet('planErledigt', alle);
}
// Themen, die in einer Lernplan-Runde schlecht liefen, kommen am nächsten Plantag zusätzlich dran
export const planNachholen = ex => (kvGet('planNachholen', {})[ex.id] || []).filter(t => thema(t));
export async function planNachholenSetzen(ex, tids) {
  const alle = Object.assign({}, kvGet('planNachholen', {}));
  alle[ex.id] = [...new Set(tids)];
  await kvSet('planNachholen', alle);
}
export async function deleteExam(id) { S.exams = S.exams.filter(e => e.id !== id); await db.del('exams', id); await loeschmarke('exams:' + id); changed('exams'); }

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
export async function updateError(e) { e.geaendert = Date.now(); await db.put('errors', e); changed('errors'); }
export async function deleteError(id) {
  S.errors = S.errors.filter(e => e.id !== id);
  await db.del('errors', id); S.cards.delete('f:' + id); await db.del('cards', 'f:' + id);
  await loeschmarke('errors:' + id, 'cards:f:' + id);
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
  const tage = [0, 0, 0, 0, 0, 0, 0], uebTage = [0, 0, 0, 0, 0, 0, 0], okTage = [0, 0, 0, 0, 0, 0, 0];
  let n = 0, ok = 0;
  for (const e of S.events) {
    if (e.zeit < mon.getTime()) continue;
    const i = (new Date(e.zeit).getDay() + 6) % 7;
    tage[i]++;
    if (e.ok != null && e.art !== 'ansatz') { n++; uebTage[i]++; if (e.ok) { ok++; okTage[i]++; } }
  }
  return { tage, uebTage, okTage, n, ok, aktiv: tage.filter(Boolean).length };
}
// Hilfestufe für Rechenaufgaben eines Themas: 1 geführt, 2 mit Schritten, 3 frei.
// Neu: geführt. Dreimal hintereinander ohne Hilfe: frei. Zuletzt zweimal falsch: wieder geführt.
export const STUFEN = { 1: 'geführt', 2: 'mit Schritten', 3: 'frei' };
export function aufgabenStufe(tid) {
  const r = S.events.filter(e => e.tid === tid && e.art === 'aufgabe' && e.ergebnis).slice(-3).map(e => e.ergebnis);
  const s = staerke(tid).stufe;
  const l2 = r.slice(-2);
  const zweiFalsch = l2.length === 2 && l2.every(x => x === 'falsch');
  const dreiRichtig = r.length === 3 && r.every(x => x === 'richtig');
  // Schwach: geführt, erst nach drei sicheren Lösungen mit Schritten. Sicher: frei, außer nach zwei Fehlern.
  if (s === 'schwach') return dreiRichtig ? 2 : 1;
  if (s === 'sicher') return zweiFalsch ? 1 : 3;
  if (!r.length || zweiFalsch) return 1;
  return dreiRichtig ? 3 : 2;
}
// Wie oft wurde der Ansatz sofort erkannt? Für die Wochenübersicht.
export function ansatzQuote(seit = 0) {
  const e = S.events.filter(x => x.art === 'ansatz' && x.zeit >= seit);
  return { n: e.length, ok: e.filter(x => x.ok).length };
}
export async function setPlace(p) { await kvSet('zuletzt', Object.assign({ zeit: Date.now() }, p)); }
export const place = () => kvGet('zuletzt', null);

/* ===== Lernzettel ===== */
export async function saveNote(n) {
  const x = Object.assign({ id: uid(), zeit: Date.now() }, n, { geaendert: Date.now() });
  S.notes = S.notes.filter(o => o.id !== x.id).concat(x);
  await db.put('notes', x); changed('notes'); return x;
}
export async function deleteNote(id) { S.notes = S.notes.filter(n => n.id !== id); await db.del('notes', id); await loeschmarke('notes:' + id); changed('notes'); }
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
    kv, content: [...S.content].map(([id, topic]) => Object.assign({ id, topic, zeit: (S.contentZeit && S.contentZeit.get(id)) || 0 }, S.contentErsetzt && S.contentErsetzt.get(id) ? { ersetzt: S.contentErsetzt.get(id) } : {})), notes: S.notes, cards: [...S.cards.values()],
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
// Abgleich: den zusammengeführten Stand auf diesem Gerät einspielen, ohne Neustart.
// Fotos und die Einstellungen dieses Geräts bleiben.
export async function uebernehmen(d) {
  await db.ersetzen('kv', Object.entries(d.kv));
  for (const st of ['content', 'notes', 'cards', 'errors', 'events', 'exams']) await db.ersetzen(st, d[st] || []);
  S.kv = new Map(Object.entries(d.kv));
  S.content = new Map((d.content || []).map(c => [c.id, c.topic]));
  S.contentZeit = new Map((d.content || []).map(c => [c.id, c.zeit || 0]));
  S.contentErsetzt = new Map((d.content || []).filter(c => c.ersetzt).map(c => [c.id, c.ersetzt]));
  S.notes = d.notes || []; S.cards = new Map((d.cards || []).map(c => [c.id, c]));
  S.errors = d.errors || []; S.events = (d.events || []).slice().sort((a, b) => a.zeit - b.zeit); S.exams = d.exams || [];
  if (d.kv.lehrplan) { S.plan = d.kv.lehrplan; if (S.base && (S.plan.baseVersion || 0) < S.base.version) { S.plan = upgradePlan(S.plan, S.base); S.plan.baseVersion = S.base.version; } }
  S.planIds = planIds(S.plan);
  changed('abgleich');
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
