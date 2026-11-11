// Automatische Sicherung in ein privates GitHub-Repository, direkt aus der App, ohne eigenen Server.
// Der Zugangsschlüssel liegt nur auf diesem Gerät (localStorage). Er steht nie in einer Sicherungsdatei
// und nie im öffentlichen Repository. Fotos werden nicht mitgesichert.
import { prefs } from './db.js';
import * as st from './store.js';
import { zusammenfuehren } from './abgleich.js';
import { toast } from './ui.js';
import * as rueckfall from './rueckfall.js';

const API = 'https://api.github.com';
const DATEI = 'lernwerk-sicherung.json';

// Vorschlag für das Repository: Besitzer aus der Pages-Adresse (name.github.io)
export function repoVorschlag() {
  const m = /^([a-z0-9-]+)\.github\.io$/i.exec(location.hostname);
  return (m ? m[1] : 'dein-name') + '/Lernwerk-Sicherung';
}
export const konfig = () => ({ token: prefs.get('ghToken', ''), repo: prefs.get('ghRepo', '') });
const verbunden = () => { const k = konfig(); return !!(k.token && k.repo && prefs.get('ghVerbunden', false)); };
// Pausiert: Nach dem Laden einer Rückfall-Kopie ruht der Abgleich, bis du entscheidest, wie es weitergeht.
export const pausiert = () => verbunden() && !!prefs.get('ghPause', false);
export const aktiv = () => verbunden() && !prefs.get('ghPause', false);
export function pausieren() { if (verbunden()) { prefs.set('ghPause', true); melden(); } }
export function fortsetzen() { prefs.set('ghPause', false); melden(); }
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

// Stand auf GitHub holen: Kennung (sha) und Inhalt. Große Dateien kommen über den Rohtext.
function text64(b64) {
  const bin = atob(String(b64).replace(/\s/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
async function holen() {
  const pfad = '/repos/' + konfig().repo + '/contents/' + DATEI;
  const r = await gh(pfad);
  if (r.status === 404) return { sha: null, daten: null };
  if (!r.ok) return { fehler: meldung(r.status) };
  const j = await r.json();
  let txt = j.content && j.encoding === 'base64' ? text64(j.content) : '';
  if (!txt) { const raw = await gh(pfad, { headers: { Accept: 'application/vnd.github.raw+json' } }); if (!raw.ok) return { fehler: meldung(raw.status) }; txt = await raw.text(); }
  let daten = null;
  try { daten = JSON.parse(txt); } catch (e) { daten = null; }
  // Eine beschädigte Datei wird nie still überschrieben
  if (txt.trim() && (!daten || !daten.kv)) return { fehler: 'Die Sicherung auf GitHub kann ich nicht lesen. Ich überschreibe sie nicht von selbst. Unter Datensicherung, Notfall, kannst du den Stand dieses Geräts nach GitHub übernehmen.' };
  return { sha: j.sha, daten };
}

// Läuft gerade eine Lerneinheit oder ein anderes Fenster? Dann nichts vom anderen Gerät einspielen.
const fensterOffen = () => typeof document !== 'undefined' && document.body.classList.contains('sheet-open');
let warten = null;
function nachDemFenster() {
  if (warten) return;
  warten = new MutationObserver(() => { if (!fensterOffen()) { warten.disconnect(); warten = null; anstossen(800); } });
  warten.observe(document.body, { attributes: true, attributeFilter: ['class'] });
}

/*
 * Abgleich: erst holen und zusammenführen, dann hochladen. Nie blind überschreiben.
 * Hat GitHub inzwischen einen neueren Stand (Antwort 409 oder 422), beginnt es von vorn, höchstens dreimal.
 */
let laeuft = null;
export async function abgleichen() {
  if (!aktiv()) return false;
  if (laeuft) return laeuft;
  if (fensterOffen()) { prefs.set('ghOffen', true); nachDemFenster(); return false; }
  laeuft = (async () => {
    if (!navigator.onLine) { prefs.set('ghOffen', true); return false; }
    try {
      for (let versuch = 0; versuch < 3; versuch++) {
        const fern = await holen();
        if (fern.fehler) { prefs.set('ghFehler', fern.fehler); melden(); return false; }
        const lokal = await st.exportBackup(false);
        let daten = lokal, hoch = true;
        if (fern.daten) {
          const m = zusammenfuehren(lokal, fern.daten);
          daten = m.daten; hoch = m.vonLokal;
          if (m.vonFern) {
            if (fensterOffen()) { prefs.set('ghOffen', true); nachDemFenster(); return false; }
            // Vorher eine Rückfall-Kopie dieses Geräts, höchstens alle zwölf Stunden
            await rueckfall.sichernWennAlt('Vor dem Abgleich', () => Promise.resolve(lokal));
            await st.uebernehmen(m.daten);
            toast('Stand vom anderen Gerät übernommen.');
          }
        }
        prefs.set('ghSha', fern.sha);
        if (hoch) {
          const text = JSON.stringify(daten);
          prefs.set('ghGroesse', text.length);
          const body = { message: 'Abgleich ' + new Date().toISOString().slice(0, 16).replace('T', ' '), content: base64(text) };
          if (fern.sha) body.sha = fern.sha;
          const r = await gh('/repos/' + konfig().repo + '/contents/' + DATEI, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
          // Ein anderes Gerät war schneller: neu holen und noch einmal zusammenführen
          if (r.status === 409 || r.status === 422) continue;
          if (!r.ok) { prefs.set('ghFehler', meldung(r.status)); melden(); return false; }
          const j = await r.json();
          prefs.set('ghSha', j.content && j.content.sha);
        }
        prefs.set('ghZuletzt', new Date().toISOString());
        prefs.set('ghFehler', null);
        prefs.set('ghOffen', false);
        await st.markBackup();
        melden();
        return true;
      }
      return false;
    } catch (e) {
      // Offline oder Netz weg: beim nächsten Mal nachholen, keine Warnung
      prefs.set('ghOffen', true);
      return false;
    }
  })();
  try { return await laeuft; } finally { laeuft = null; letzter = Date.now(); }
}

// Nach einer Lerneinheit oder nach dem Einfügen. Kurz warten, damit alles gespeichert ist.
let tmr = null, letzter = 0;
export function anstossen(ms = 1500) {
  if (!aktiv()) return;
  prefs.set('ghOffen', true);
  clearTimeout(tmr);
  tmr = setTimeout(() => abgleichen(), ms);
}
// Beim Öffnen, wenn die App wieder sichtbar wird und wenn wieder Netz da ist.
// Beim Sichtbarwerden höchstens einmal pro Minute, außer es wartet noch etwas von diesem Gerät.
export function nachholen(immer = false) {
  if (!aktiv()) return;
  if (!immer && !prefs.get('ghOffen', false) && Date.now() - letzter < 60000) return;
  clearTimeout(tmr);
  tmr = setTimeout(() => abgleichen(), 1200);
}
export function start() {
  nachholen(true);
  window.addEventListener('online', () => nachholen(true));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') nachholen(); });
}

// Notfall: Stand von GitHub komplett übernehmen und den Stand dieses Geräts ersetzen. Fotos bleiben.
export async function laden() {
  const r = await gh('/repos/' + konfig().repo + '/contents/' + DATEI, { headers: { Accept: 'application/vnd.github.raw+json' } });
  if (r.status === 404) throw new Error('Auf GitHub liegt noch keine Sicherung.');
  if (!r.ok) throw new Error(meldung(r.status));
  const data = JSON.parse(await r.text());
  await rueckfall.sichern('Vor „Stand von GitHub übernehmen“', await st.exportBackup(false));
  await st.importBackup(data);
  const f = await gh('/repos/' + konfig().repo + '/contents/' + DATEI);
  if (f.ok) prefs.set('ghSha', (await f.json()).sha);
  prefs.set('ghOffen', false);
  return data;
}

// Notfall in die andere Richtung: Der Stand dieses Geräts ersetzt den Stand auf GitHub, ohne Zusammenführen.
// Gedacht nach dem Laden einer Rückfall-Kopie. Danach läuft der Abgleich wieder.
export async function ueberschreiben() {
  const pfad = '/repos/' + konfig().repo + '/contents/' + DATEI;
  const r = await gh(pfad);
  let sha = null;
  if (r.ok) sha = (await r.json()).sha;
  else if (r.status !== 404) throw new Error(meldung(r.status));
  const daten = await st.exportBackup(false);
  const body = { message: 'Stand eines Geräts übernommen ' + new Date().toISOString().slice(0, 16).replace('T', ' '), content: base64(JSON.stringify(daten)) };
  if (sha) body.sha = sha;
  const p = await gh(pfad, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!p.ok) throw new Error(meldung(p.status));
  const j = await p.json();
  prefs.set('ghSha', j.content && j.content.sha);
  prefs.set('ghZuletzt', new Date().toISOString());
  prefs.set('ghFehler', null); prefs.set('ghOffen', false); prefs.set('ghPause', false);
  await st.markBackup();
  melden();
}
