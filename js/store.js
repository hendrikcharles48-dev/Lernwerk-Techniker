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
  return it.eigen || it.stufe <= freigabe(it.tid);
}
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
  st.id = item.id; st.tid = item.tid; st.art = item.art;
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
  const e = { id: x.id || uid(), fachId: f ? f.id : '', fach: f ? f.name : x.fach, datum: toDay(x.datum) || x.datum, themen: x.themen || '', themaIds: x.themaIds || matchThemen(f, x.themen) };
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
