// Automatische Sicherung in ein privates GitHub-Repository, direkt aus der App, ohne eigenen Server.
// Der Zugangsschlüssel liegt nur auf diesem Gerät (localStorage). Er steht nie in einer Sicherungsdatei
// und nie im öffentlichen Repository. Fotos werden nicht mitgesichert.
import { prefs } from './db.js';
import * as st from './store.js';

const API = 'https://api.github.com';
const DATEI = 'lernwerk-sicherung.json';

// Vorschlag für das Repository: Besitzer aus der Pages-Adresse (name.github.io)
export function repoVorschlag() {
  const m = /^([a-z0-9-]+)\.github\.io$/i.exec(location.hostname);
  return (m ? m[1] : 'dein-name') + '/Lernwerk-Sicherung';
}
export const konfig = () => ({ token: prefs.get('ghToken', ''), repo: prefs.get('ghRepo', '') });
export const aktiv = () => { const k = konfig(); return !!(k.token && k.repo && prefs.get('ghVerbunden', false)); };
export const zuletzt = () => prefs.get('ghZuletzt', null);
export const fehler = () => prefs.get('ghFehler', null);

const listeners = new Set();
export const beobachten = f => { listeners.add(f); return () => listeners.delete(f); };
const melden = () => listeners.forEach(f => { try { f(); } catch (e) { /* Seite weg */ } });

async function gh(pfad, opt = {}) {
  const { token } = konfig();
  const r = await fetch(API + pfad, Object.assign({}, opt, {
    cache: 'no-store',
    headers: Object.assign({ Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }, opt.headers || {})
  }));
  return r;
}
function meldung(status) {
  if (status === 401) return 'Der Schlüssel stimmt nicht oder ist abgelaufen. Erstell auf GitHub einen neuen und trag ihn hier ein.';
  if (status === 403) return 'Der Schlüssel darf nicht schreiben. Bei „Contents“ muss „Read and write“ stehen.';
  if (status === 404) return 'Repository nicht gefunden. Prüf den Namen und ob der Schlüssel für dieses Repository gilt.';
  return 'GitHub antwortet mit Fehler ' + status + '. Ich versuche es später wieder.';
}
// UTF-8-Text als Base64, in Stücken, damit auch große Sicherungen gehen
function base64(text) {
  const b = new TextEncoder().encode(text);
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
  return btoa(s);
}

// Verbindung prüfen. Rückgabe: { ok, meldung, vorhanden: Datum der Sicherung auf GitHub oder null }
export async function pruefen(token, repo) {
  prefs.set('ghToken', token.trim()); prefs.set('ghRepo', repo.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\/$/, ''));
  prefs.set('ghVerbunden', false); prefs.set('ghSha', null);
  try {
    const r = await gh('/repos/' + konfig().repo);
    if (!r.ok) return { ok: false, meldung: meldung(r.status) };
    const j = await r.json();
    if (!j.private) return { ok: false, meldung: 'Dieses Repository ist öffentlich. Für die Sicherung brauchst du ein privates Repository.' };
    const f = await gh('/repos/' + konfig().repo + '/contents/' + DATEI);
    if (f.status === 404) return { ok: true, vorhanden: null };
    if (!f.ok) return { ok: false, meldung: meldung(f.status) };
    const info = await f.json();
    prefs.set('ghSha', info.sha);
    const c = await gh('/repos/' + konfig().repo + '/commits?per_page=1&path=' + DATEI);
    const datum = c.ok ? ((await c.json())[0] || {}).commit : null;
    return { ok: true, vorhanden: datum ? datum.committer.date : 'unbekannt' };
  } catch (e) {
    return { ok: false, meldung: 'Keine Verbindung zu GitHub. Bist du online?' };
  }
}
export function verbinden() { prefs.set('ghVerbunden', true); prefs.set('ghFehler', null); melden(); }
export function trennen() { for (const k of ['ghToken', 'ghVerbunden', 'ghSha', 'ghFehler']) prefs.set(k, null); melden(); }

// Hochladen. Läuft immer nur einmal gleichzeitig.
let laeuft = null;
export async function hochladen() {
  if (!aktiv()) return false;
  if (laeuft) return laeuft;
  laeuft = (async () => {
    prefs.set('ghOffen', true);
    if (!navigator.onLine) return false;
    try {
      const data = await st.exportBackup(false);
      const body = { message: 'Sicherung ' + new Date().toISOString().slice(0, 16).replace('T', ' '), content: base64(JSON.stringify(data)) };
      const pfad = '/repos/' + konfig().repo + '/contents/' + DATEI;
      const senden = () => gh(pfad, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({}, body, prefs.get('ghSha', null) ? { sha: prefs.get('ghSha', null) } : {})) });
      let r = await senden();
      // Stand auf GitHub hat sich geändert (anderes Gerät): aktuelle Kennung holen und nochmal
      if (r.status === 409 || r.status === 422) {
        const f = await gh(pfad);
        prefs.set('ghSha', f.ok ? (await f.json()).sha : null);
        r = await senden();
      }
      if (!r.ok) { prefs.set('ghFehler', meldung(r.status)); melden(); return false; }
      const j = await r.json();
      prefs.set('ghSha', j.content && j.content.sha);
      prefs.set('ghZuletzt', new Date().toISOString());
      prefs.set('ghFehler', null);
      prefs.set('ghOffen', false);
      await st.markBackup();
      melden();
      return true;
    } catch (e) {
      // Offline oder Netz weg: beim nächsten Mal nachholen, keine Warnung
      return false;
    }
  })();
  try { return await laeuft; } finally { laeuft = null; }
}

// Nach einer Lerneinheit oder nach dem Einfügen. Kurz warten, damit alles gespeichert ist.
let tmr = null;
export function anstossen(ms = 1500) {
  if (!aktiv()) return;
  prefs.set('ghOffen', true);
  clearTimeout(tmr);
  tmr = setTimeout(() => hochladen(), ms);
}
// Beim Öffnen und wenn wieder Netz da ist: Offenes nachholen
export function nachholen() {
  if (aktiv() && prefs.get('ghOffen', false)) anstossen(4000);
}
export function start() {
  nachholen();
  window.addEventListener('online', nachholen);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') nachholen(); });
}

// Stand von GitHub laden und auf diesem Gerät einspielen. Fotos auf dem Gerät bleiben.
export async function laden() {
  const r = await gh('/repos/' + konfig().repo + '/contents/' + DATEI, { headers: { Accept: 'application/vnd.github.raw+json' } });
  if (r.status === 404) throw new Error('Auf GitHub liegt noch keine Sicherung.');
  if (!r.ok) throw new Error(meldung(r.status));
  const data = JSON.parse(await r.text());
  await st.importBackup(data);
  const f = await gh('/repos/' + konfig().repo + '/contents/' + DATEI);
  if (f.ok) prefs.set('ghSha', (await f.json()).sha);
  prefs.set('ghOffen', false);
  return data;
}
