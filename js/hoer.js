// Player für den Hörmodus: Podcast-Folgen als Audiodatei, sonst mit der Systemstimme.
// Ein einziges Audio-Element für die ganze App. So läuft es weiter, wenn man die Seite wechselt,
// und auf dem Sperrbildschirm gibt es Knöpfe (Media Session).
import { prefs } from './db.js';
import { dayStr } from './util.js';
import { folge, satz, SPRECHER } from './podcast.js';
import * as st from './store.js';
import { speak, stopSpeaking, keepAwake, stopReading, pause, canSpeak } from './speech.js';

export const AUDIO_CACHE = 'hoer-audio';
let idx = null;
export async function index() {
  if (idx) return idx;
  try { const r = await fetch('audio/folgen.json'); idx = r.ok ? await r.json() : { folgen: {} }; } catch (e) { idx = { folgen: {} }; }
  return idx;
}
export const bereit = () => !!idx;
export const infoSync = tid => (idx && idx.folgen[tid]) || null;

const P = { audio: null, liste: [], i: 0, tid: null, info: null, sys: null, seg: -1, ab: null, auto: false, rate: prefs.get('hoerTempo', 1) };
const hoerer = new Set();
export const subscribe = f => { hoerer.add(f); return () => hoerer.delete(f); };
const emit = () => hoerer.forEach(f => { try { f(); } catch (e) { /* Seite weg */ } });

export const gehoert = () => prefs.get('hoerGehoert', {});
const merkePos = (tid, t) => { const p = prefs.get('hoerPos', {}); if (t) p[tid] = Math.round(t); else delete p[tid]; prefs.set('hoerPos', p); };

function audio() {
  if (P.audio) return P.audio;
  const a = new Audio();
  a.preload = 'auto';
  let last = 0;
  a.addEventListener('timeupdate', () => {
    if (P.ab && a.currentTime >= P.ab.end) { const r = P.ab.resolve; P.ab = null; a.pause(); r(true); return; }
    if (P.ab) return;
    const j = segAt(a.currentTime);
    if (j !== P.seg) { P.seg = j; emit(); }
    if (Math.abs(a.currentTime - last) > 5) { last = a.currentTime; if (P.tid) merkePos(P.tid, a.currentTime); }
    posState();
  });
  a.addEventListener('ended', () => { if (P.ab) return; fertig(); });
  a.addEventListener('play', () => { if (navigator.mediaSession) navigator.mediaSession.playbackState = 'playing'; emit(); });
  a.addEventListener('pause', () => { if (navigator.mediaSession) navigator.mediaSession.playbackState = 'paused'; emit(); });
  a.addEventListener('error', () => { if (P.tid && !P.ab) { const tid = P.tid; P.info = null; systemFolge(tid); } });
  P.audio = a;
  session();
  return a;
}
function segAt(t) {
  const s = P.info ? P.info.segs : [];
  let j = -1;
  for (let k = 0; k < s.length && s[k][0] <= t + 0.05; k++) j = k;
  return j;
}

/* ===== Abspielen ===== */
// liste: Themen-IDs in der Reihenfolge, i: womit anfangen
export async function spielen(liste, i = 0, auto = false) {
  stopReading(); stopSystem();
  P.liste = liste.slice(); P.i = i; P.auto = auto;
  await index();
  if (P.audio) session();
  laden();
}

/* ===== Auto-Playlist =====
 * Mehrere eingebaute Folgen am Stück, nur mit Audiodatei, weil nur die bei gesperrtem Bildschirm weiterlaufen.
 * Reihenfolge: Themen der nächsten Arbeit, dann Unterricht, dann schwache, dann lange nicht gehörte.
 */
export async function autoListe(minuten) {
  await index();
  const ex = st.nextExam();
  const g = gehoert();
  const passt = t => { const tp = st.topic(t); return infoSync(t) && !(tp.podcast && tp.podcast.length); };
  const vorne = [...((ex && ex.themaIds) || []), ...st.kvGet('aktuell', [])];
  const rest = st.allTids().filter(t => !vorne.includes(t)).map(t => ({ t, k: (st.staerke(t).stufe === 'schwach' ? 0 : 2) + (g[t] ? 1 : 0), d: g[t] || '' }))
    .sort((a, b) => a.k - b.k || (a.d < b.d ? -1 : a.d > b.d ? 1 : 0)).map(x => x.t);
  const out = [];
  let sek = 0;
  for (const t of [...new Set([...vorne, ...rest])]) {
    if (!passt(t)) continue;
    if (out.length && sek + infoSync(t).dauer > minuten * 60 + 120) continue;
    out.push(t); sek += infoSync(t).dauer;
    if (sek >= minuten * 60) break;
  }
  return out;
}
export async function autoStart(minuten) {
  const l = await autoListe(minuten);
  if (l.length) await spielen(l, 0, true);
  return l;
}
// Zurück: am Anfang der Folge zur vorherigen, sonst an den Anfang der Folge
function zurueck() {
  const a = P.audio;
  if (a && a.currentTime > 8) { a.currentTime = 0; return; }
  if (P.i > 0) folgeWechseln(-1); else if (a) a.currentTime = 0;
}
function laden() {
  const tid = P.liste[P.i];
  P.tid = tid; P.info = infoSync(tid); P.seg = -1;
  if (!tid) return emit();
  if (P.info) {
    const a = audio();
    const pos = prefs.get('hoerPos', {})[tid] || 0;
    a.src = 'audio/' + P.info.datei;
    a.playbackRate = P.rate;
    const start = () => { if (pos > 3 && pos < P.info.dauer - 15) a.currentTime = Math.max(0, pos - 3); a.playbackRate = P.rate; };
    a.addEventListener('loadedmetadata', start, { once: true });
    a.play().catch(() => emit());
    meta();
  } else systemFolge(tid);
  emit();
}
function fertig() {
  if (P.tid) { const g = gehoert(); g[P.tid] = dayStr(); prefs.set('hoerGehoert', g); merkePos(P.tid, 0); }
  if (P.i + 1 < P.liste.length) { P.i++; laden(); } else { keepAwake(false); emit(); }
}
export function umschalten() {
  if (P.sys) { P.sys.paused ? systemWeiter() : systemPause(); return; }
  const a = P.audio;
  if (!a || !P.tid) return;
  if (a.paused) a.play().catch(() => {}); else a.pause();
}
export function springen(sek) {
  if (P.sys) { P.sys.j = Math.max(0, Math.min(P.sys.segs.length - 1, P.sys.j + (sek > 0 ? 1 : -1))); systemNeu(); return; }
  const a = P.audio; if (!a || !P.info) return;
  a.currentTime = Math.max(0, Math.min(P.info.dauer - 0.5, a.currentTime + sek));
}
export function setzen(t) { const a = P.audio; if (a && P.info) a.currentTime = Math.max(0, Math.min(P.info.dauer - 0.5, t)); }
// Nächster oder vorheriger Teil: dort, wo Lena eine neue Frage stellt
export function teil(richtung) {
  if (P.sys) return springen(richtung);
  const a = P.audio; if (!a || !P.info) return;
  const s = P.info.segs, t = a.currentTime;
  const starts = s.filter((x, k) => x[2] === 'A' && (k === 0 || s[k - 1][2] !== 'A')).map(x => x[0]);
  if (richtung > 0) { const n = starts.find(x => x > t + 0.5); if (n != null) a.currentTime = n; else if (P.i + 1 < P.liste.length) { P.i++; laden(); } }
  else { const v = starts.filter(x => x < t - 2).pop(); a.currentTime = v != null ? v : 0; }
}
export function folgeWechseln(richtung) {
  const n = P.i + richtung;
  if (n < 0 || n >= P.liste.length) return;
  stopSystem(); P.i = n; laden();
}
export function tempo(r) { P.rate = r; prefs.set('hoerTempo', r); if (P.audio) P.audio.playbackRate = r; emit(); }
export function stopp() { if (P.audio) P.audio.pause(); stopSystem(); keepAwake(false); emit(); }

export function zustand() {
  const a = P.audio;
  const segs = P.sys ? P.sys.segs.map(x => [0, 0, x.wer, x.art, x.text]) : P.info ? P.info.segs : [];
  const j = P.sys ? P.sys.j : P.seg;
  return {
    tid: P.tid, liste: P.liste, i: P.i, info: P.info, system: !!P.sys, rate: P.rate, auto: P.auto,
    spielt: P.sys ? !P.sys.paused : !!(a && !a.paused && P.tid),
    zeit: a && P.info ? a.currentTime : 0, dauer: P.info ? P.info.dauer : 0,
    zeile: segs[j] ? { wer: SPRECHER[segs[j][2]], text: segs[j][4], art: segs[j][3] } : null
  };
}

/* ===== Lock-Screen und Kopfhörer ===== */
function session() {
  const ms = navigator.mediaSession;
  if (!ms) return;
  const set = (n, f) => { try { ms.setActionHandler(n, f); } catch (e) { /* nicht unterstützt */ } };
  set('play', () => umschalten());
  set('pause', () => umschalten());
  set('seekto', d => setzen(d.seekTime));
  // Im Auto: Weiter und Zurück wechseln die Folge (Lenkrad, CarPlay). Das iPhone zeigt dann
  // Weiter und Zurück statt ±15 Sekunden, beides gleichzeitig geht dort nicht.
  if (P.auto) {
    set('seekbackward', null); set('seekforward', null);
    set('previoustrack', () => zurueck());
    set('nexttrack', () => folgeWechseln(1));
  } else {
    set('seekbackward', d => springen(-((d && d.seekOffset) || 15)));
    set('seekforward', d => springen((d && d.seekOffset) || 15));
    set('previoustrack', () => teil(-1));
    set('nexttrack', () => teil(1));
  }
}
function meta() {
  if (!navigator.mediaSession || typeof MediaMetadata === 'undefined' || !P.info) return;
  navigator.mediaSession.metadata = new MediaMetadata({ title: P.info.thema, artist: 'Lena und Tom · Lernwerk' + (P.auto ? ' · Folge ' + (P.i + 1) + ' von ' + P.liste.length : ''), album: P.info.fach, artwork: [{ src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' }] });
}
function posState() {
  const a = P.audio, ms = navigator.mediaSession;
  if (!ms || !ms.setPositionState || !P.info || !isFinite(a.duration)) return;
  try { ms.setPositionState({ duration: a.duration, playbackRate: a.playbackRate, position: Math.min(a.currentTime, a.duration) }); } catch (e) { /* egal */ }
}

/* ===== Ohne Audiodatei: dieselbe Folge mit der Systemstimme ===== */
function systemFolge(tid) {
  const t = st.topic(tid);
  const segs = t ? folge(t) : [];
  if (!segs.length || !canSpeak()) { P.sys = null; emit(); return; }
  if (P.audio) P.audio.pause();
  P.sys = { segs, j: 0, paused: false, token: 0 };
  systemNeu();
}
async function systemNeu() {
  const s = P.sys; if (!s) return;
  const tok = ++s.token; s.paused = false; stopSpeaking(); keepAwake(true); emit();
  while (P.sys === s && tok === s.token && s.j < s.segs.length) {
    const x = s.segs[s.j];
    emit();
    await speak(x.text, P.rate, x.wer);
    if (P.sys !== s || tok !== s.token) return;
    await pause(Math.max(250, x.pause || 0));
    if (P.sys !== s || tok !== s.token) return;
    s.j++;
  }
  if (P.sys === s && tok === s.token) { P.sys = null; fertig(); }
}
function systemPause() { if (!P.sys) return; P.sys.paused = true; P.sys.token++; stopSpeaking(); keepAwake(false); emit(); }
function systemWeiter() { if (P.sys) systemNeu(); }
function stopSystem() { if (P.sys) { P.sys.token++; P.sys = null; stopSpeaking(); } }

/* ===== Abfragen mit der natürlichen Stimme: nur ein Ausschnitt einer Folge ===== */
// Sucht Frage und Antwort einer Karte: erst in der Kartendatei des Themas, dann in der Folge
export function kartenStelle(tid, frage) {
  const info = infoSync(tid); if (!info) return null;
  const finde = (segs, text) => { const k = segs.findIndex(x => x[3] === 'frage' && x[4] === text); return k >= 0 && segs[k + 1] && segs[k + 1][3] === 'antwort' ? k : -1; };
  if (info.karten) { const k = finde(info.karten.segs, frage); if (k >= 0) return { datei: info.karten.datei, frage: info.karten.segs[k], antwort: info.karten.segs[k + 1] }; }
  if (!info.segs) return null;
  const k = finde(info.segs, satz(frage));
  return k >= 0 ? { datei: info.datei, frage: info.segs[k], antwort: info.segs[k + 1] } : null;
}
// Spielt einen Ausschnitt und meldet sich am Ende. Bricht ab, wenn etwas anderes startet.
export function ausschnitt(datei, start, end) {
  stopSystem();
  const a = audio();
  if (P.ab) { const r = P.ab.resolve; P.ab = null; r(false); }
  P.tid = null; P.info = null;
  return new Promise(resolve => {
    P.ab = { end: end + 0.05, resolve };
    const go = () => { a.currentTime = start; a.playbackRate = P.rate; a.play().catch(() => { P.ab = null; resolve(false); }); };
    if (!a.src.endsWith('audio/' + datei)) { a.src = 'audio/' + datei; a.addEventListener('loadedmetadata', go, { once: true }); a.load(); } else go();
  });
}
export function ausschnittStopp() { if (P.ab) { const r = P.ab.resolve; P.ab = null; r(false); } if (P.audio) P.audio.pause(); }

/* ===== Offline speichern ===== */
export async function istOffline(tid) {
  const info = infoSync(tid); if (!info || !('caches' in self)) return false;
  try { return !!(await (await caches.open(AUDIO_CACHE)).match(new URL('audio/' + info.datei, location.href).href)); } catch (e) { return false; }
}
export async function offlineLaden(tids, fortschritt) {
  const c = await caches.open(AUDIO_CACHE);
  const ix = await index();
  try { await c.add('audio/folgen.json'); } catch (e) { /* offline */ }
  let n = 0;
  for (const tid of tids) {
    const info = ix.folgen[tid];
    for (const d of info ? [info.datei, info.karten && info.karten.datei].filter(Boolean) : []) if (!(await c.match(new URL('audio/' + d, location.href).href))) { try { await c.add('audio/' + d); } catch (e) { /* weiter */ } }
    fortschritt && fortschritt(++n, tids.length);
  }
}
export const groesseMB = tids => Math.round(tids.reduce((s, t) => { const i = infoSync(t) || {}; return s + (i.dauer || 0) + ((i.karten || {}).dauer || 0); }, 0) * 4 / 1024);
