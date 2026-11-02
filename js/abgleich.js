// Abgleich zwischen Geräten: zwei Stände (dieses Gerät und GitHub) zusammenführen, statt einen zu ersetzen.
// Reine Funktionen ohne Speicherzugriff, damit sie testbar sind.
//
// - Speicher mit Kennung (content, notes, cards, errors, events, exams): Vereinigung über die id,
//   bei gleicher id gewinnt der neuere Eintrag. Inhalte desselben Themas werden ohne Doppelte zusammengelegt.
// - Schlüssel-Wert-Daten: pro Schlüssel gewinnt die neuere Änderung (kvZeit).
// - Lehrplan: Fach für Fach und Thema für Thema, Status der Themen pro Thema (zustandZeit).
// - Löschmarken (kv „geloescht“): Was gelöscht wurde, kommt nicht zurück, außer es wurde danach neu angelegt.
import { mergeTopic } from './parser.js';

// Bleiben auf jedem Gerät für sich
export const NUR_GERAET = new Set(['zuletzt', 'letzteSicherung', 'ersterStart', 'unterrichtVorgabe', 'freigabeStart']);
const SONDER = new Set(['kvZeit', 'geloescht', 'lehrplan', 'aktuell', 'abgeschlossen', 'aktuellSeit', 'zustandZeit', 'freigabe']);
export const SPEICHER = ['content', 'notes', 'cards', 'errors', 'events', 'exams'];
const MAX_EVENTS = 5000;

const tag = d => { const t = d ? Date.parse(d + 'T12:00:00') : 0; return isFinite(t) ? t : 0; };
// Wann wurde ein Eintrag zuletzt geändert? Alte Einträge ohne Zeitstempel zählen als alt.
export function zeitVon(store, x) {
  if (!x) return 0;
  if (store === 'cards') return x.zeit || tag(x.zuletzt);
  if (store === 'exams') return x.geaendert || 0;
  return x.geaendert || x.zeit || 0;
}
const clone = o => JSON.parse(JSON.stringify(o));
const maxMap = (a = {}, b = {}) => { const o = Object.assign({}, a); for (const [k, v] of Object.entries(b)) o[k] = Math.max(o[k] || 0, v || 0); return o; };

// Vergleichbarer Fingerabdruck: gleiche Daten, gleicher Text, egal in welcher Reihenfolge
function stabil(v) {
  if (Array.isArray(v)) return '[' + v.map(stabil).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + stabil(v[k])).join(',') + '}';
  return JSON.stringify(v === undefined ? null : v);
}
const leer = v => v == null || (Array.isArray(v) && !v.length) || (typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length);
export function fingerabdruck(d) {
  const kv = Object.assign({}, d.kv || {});
  for (const k of NUR_GERAET) delete kv[k];
  for (const k of Object.keys(kv)) if (leer(kv[k])) delete kv[k];
  if (kv.kvZeit) { kv.kvZeit = Object.assign({}, kv.kvZeit); for (const k of NUR_GERAET) delete kv.kvZeit[k]; }
  const o = { kv };
  for (const s of SPEICHER) o[s] = (d[s] || []).slice().sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return stabil(o);
}

function zustandVon(kv, tid) {
  if ((kv.aktuell || []).includes(tid)) return 'aktuell';
  if ((kv.abgeschlossen || []).includes(tid)) return 'fertig';
  return 'kommt';
}

// Lehrplan: Grundlage ist der neuer geänderte Plan. Was nur im anderen steht, kommt dazu,
// außer es trägt eine Löschmarke, die neuer ist als das Anlegen.
export function planZusammen(pL, pF, tL, tF, gel) {
  if (!pL) return pF ? clone(pF) : pL;
  if (!pF) return clone(pL);
  const [neu, alt] = tF > tL ? [pF, pL] : [pL, pF];
  const out = clone(neu);
  const weg = (k, x) => (gel[k] || 0) > ((x && x.angelegt) || 0);
  for (const fa of alt.faecher || []) {
    const f = out.faecher.find(x => x.id === fa.id);
    if (!f) { out.faecher.push(clone(fa)); continue; }
    for (const ta of fa.themen || []) if (!f.themen.some(t => t.id === ta.id)) f.themen.push(clone(ta));
  }
  out.faecher = out.faecher.filter(f => !weg('fach:' + f.id, f));
  for (const f of out.faecher) f.themen = (f.themen || []).filter(t => !weg('thema:' + t.id, t));
  for (const m of alt.module || []) if (!(out.module || []).some(x => x.id === m.id)) (out.module = out.module || []).push(clone(m));
  out.baseVersion = Math.max(neu.baseVersion || 0, alt.baseVersion || 0);
  return out;
}

/*
 * L: Stand dieses Geräts, F: Stand von GitHub. Beide im Format von exportBackup.
 * Rückgabe: { daten, vonFern, vonLokal }
 *   vonFern: Das andere Gerät hat etwas beigetragen, dieses Gerät muss übernehmen.
 *   vonLokal: Dieses Gerät hat etwas, das auf GitHub noch fehlt, also hochladen.
 */
export function zusammenfuehren(L, F) {
  if (!F || !F.kv) return { daten: L, vonFern: false, vonLokal: true };
  const kvL = L.kv || {}, kvF = F.kv || {};
  const zL = kvL.kvZeit || {}, zF = kvF.kvZeit || {};
  const gel = maxMap(kvL.geloescht, kvF.geloescht);
  const kv = {}, kvZeit = maxMap(zL, zF);
  // Zeiten von Gerätedaten bleiben die dieses Geräts
  for (const k of NUR_GERAET) { if (k in zL) kvZeit[k] = zL[k]; else delete kvZeit[k]; }

  // Einfache Schlüssel: die neuere Änderung gewinnt
  for (const k of new Set([...Object.keys(kvL), ...Object.keys(kvF)])) {
    if (SONDER.has(k)) continue;
    if (NUR_GERAET.has(k)) { if (k in kvL) kv[k] = kvL[k]; continue; }
    const nimmF = !(k in kvL) || ((k in kvF) && (zF[k] || 0) > (zL[k] || 0));
    kv[k] = clone(nimmF ? kvF[k] : kvL[k]);
  }

  // Status der Themen: pro Thema die neuere Änderung
  const zzL = kvL.zustandZeit || {}, zzF = kvF.zustandZeit || {};
  const seitL = kvL.aktuellSeit || {}, seitF = kvF.aktuellSeit || {};
  const tids = new Set([...(kvL.aktuell || []), ...(kvL.abgeschlossen || []), ...(kvF.aktuell || []), ...(kvF.abgeschlossen || []), ...Object.keys(zzL), ...Object.keys(zzF)]);
  const aktuell = [], abgeschlossen = [], aktuellSeit = {};
  for (const tid of tids) {
    const tL = zzL[tid] || 0, tF = zzF[tid] || 0;
    const vonF = tF > tL;
    // Gleich alt, zum Beispiel alte Sicherung ohne Zeitstempel: was gesetzt ist, gewinnt vor „Kommt noch“
    const zL1 = zustandVon(kvL, tid), zF1 = zustandVon(kvF, tid);
    const z = tF !== tL ? (vonF ? zF1 : zL1) : zL1 === 'aktuell' || zF1 === 'aktuell' ? 'aktuell' : zL1 === 'fertig' || zF1 === 'fertig' ? 'fertig' : 'kommt';
    if (z === 'aktuell') { aktuell.push(tid); const s = (vonF ? seitF : seitL)[tid] || seitL[tid] || seitF[tid]; if (s) aktuellSeit[tid] = s; }
    if (z === 'fertig') abgeschlossen.push(tid);
  }
  kv.aktuell = aktuell; kv.abgeschlossen = abgeschlossen; kv.aktuellSeit = aktuellSeit;
  kv.zustandZeit = maxMap(zzL, zzF);

  // Freigeschaltete Stufen: der neuere Stand, Themen nur auf der anderen Seite kommen dazu
  const frNeu = (zF.freigabe || 0) > (zL.freigabe || 0);
  kv.freigabe = Object.assign({}, frNeu ? kvL.freigabe : kvF.freigabe, frNeu ? kvF.freigabe : kvL.freigabe);

  kv.lehrplan = planZusammen(kvL.lehrplan, kvF.lehrplan, zL.lehrplan || 0, zF.lehrplan || 0, gel);
  kv.geloescht = gel;
  kv.kvZeit = kvZeit;
  for (const k of Object.keys(kv)) if (kv[k] === undefined) delete kv[k];

  // Speicher mit Kennung
  const out = { app: L.app || F.app, format: 1, erstellt: new Date().toISOString(), kv };
  for (const s of SPEICHER) {
    const m = new Map();
    const rein = x => {
      if (!x || x.id == null) return;
      const alt = m.get(x.id);
      if (!alt) { m.set(x.id, x); return; }
      if (stabil(alt) === stabil(x)) return;
      const ta = zeitVon(s, alt), tx = zeitVon(s, x);
      if (s === 'content') {
        // Beide Geräte haben etwas zum Thema eingefügt: zusammenlegen, die neuere Fassung zuerst
        const [n, a] = tx > ta ? [x, alt] : [alt, x];
        m.set(x.id, { id: x.id, topic: mergeTopic(n.topic, a.topic).topic, zeit: Math.max(ta, tx) || undefined });
        return;
      }
      if (s === 'cards' && tx === ta) { const n = c => (c.richtig || 0) + (c.hilfe || 0) + (c.falsch || 0); if (n(x) > n(alt)) m.set(x.id, x); return; }
      if (tx > ta) m.set(x.id, x);
    };
    (L[s] || []).forEach(rein);
    (F[s] || []).forEach(rein);
    let liste = [...m.values()].filter(x => !((gel[s + ':' + x.id] || 0) >= (zeitVon(s, x) || 1)));
    if (s === 'events' && liste.length > MAX_EVENTS) liste = liste.sort((a, b) => a.zeit - b.zeit).slice(-MAX_EVENTS);
    out[s] = liste.map(clone);
  }
  if (L.bloecke) out.bloecke = L.bloecke;
  const fp = fingerabdruck(out);
  return { daten: out, vonFern: fp !== fingerabdruck(L), vonLokal: fp !== fingerabdruck(F) };
}
