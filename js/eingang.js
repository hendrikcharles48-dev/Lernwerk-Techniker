// Eingang und Lernstand im privaten Sicherungs-Repository.
// Eingang: Claude legt neue Lernseiten (.html) oder Lernwerk-Blöcke (.txt, .md) in den Ordner eingang/.
// Beim Abgleich holt die App sie: Lernseiten werden gleich gespeichert, Blöcke warten auf der Startseite auf deine Vorschau.
// Nichts im Repository wird gelöscht. Was schon geholt ist, merkt sich kv „eingang“ (Pfad und Stand), das läuft mit.
// Lernstand: eine kurze Datei lernstand.md mit deinen Schwächen, damit Claude gezielt Lernseiten und Blöcke bauen kann.
import * as st from './store.js';
import { prefs } from './db.js';
import { hash, dayStr, dayLong, daysBetween } from './util.js';
import * as lernseiten from './lernseiten.js';

const ORDNER = 'eingang';

// gh: Funktion (pfad, opt) aus sicherung.js, repo: „name/Repository“
export async function holen(gh, repo) {
  const r = await gh('/repos/' + repo + '/contents/' + ORDNER);
  if (r.status === 404 || !r.ok) return [];
  const liste = await r.json();
  if (!Array.isArray(liste)) return [];
  const erledigt = Object.assign({}, st.kvGet('eingang', {}));
  const offen = (st.kvGet('eingangOffen', []) || []).slice();
  const neu = [];
  for (const x of liste) {
    if (x.type !== 'file' || erledigt[x.path] === x.sha || !/\.(html?|txt|md)$/i.test(x.name) || x.size > 3e6) continue;
    const f = await gh('/repos/' + repo + '/contents/' + x.path.split('/').map(encodeURIComponent).join('/'), { headers: { Accept: 'application/vnd.github.raw+json' } });
    if (!f.ok) continue;
    const text = await f.text();
    if (/\.html?$/i.test(x.name)) {
      if (!lernseiten.istHtml(text)) { erledigt[x.path] = x.sha; continue; }
      const z = lernseiten.zuordnungAus(text);
      const fa = z.fach ? st.findFach(z.fach) : null;
      const th = fa && z.thema ? st.suggestThema(fa, z.thema) : null;
      const arbeiten = fa ? st.S.exams.filter(e => e.fachId === fa.id) : [];
      const ex = arbeiten.find(e => e.datum === z.arbeit) || arbeiten.filter(e => e.datum >= dayStr()).sort((a, b) => (a.datum < b.datum ? -1 : 1))[0];
      try {
        const n = await lernseiten.speichern({ html: text, titel: z.titel, fid: fa ? fa.id : '', tid: th ? th.id : '', exId: ex ? ex.id : '', quelle: 'eingang' });
        neu.push(n.titel);
      } catch (e) { /* zu groß oder kaputt: überspringen */ }
    } else if (/===\s*lernwerk|^\s*fach\s*:/im.test(text)) {
      if (!offen.some(o => o.id === x.path && o.sha === x.sha)) offen.push({ id: x.path, sha: x.sha, titel: x.name.replace(/\.(txt|md)$/i, ''), text, zeit: Date.now() });
      neu.push(x.name);
    }
    erledigt[x.path] = x.sha;
  }
  if (neu.length) {
    await st.kvSet('eingang', erledigt);
    await st.kvSet('eingangOffen', offen.slice(-20));
  }
  return neu;
}
export const offen = () => (st.kvGet('eingangOffen', []) || []).filter(o => o && o.text);
export async function erledigen(id) { await st.kvSet('eingangOffen', offen().filter(o => o.id !== id)); }

/* ===== Lernstand für Claude ===== */
export function lernstandText() {
  const L = [];
  const heute = dayStr();
  L.push('# Lernstand aus Lernwerk', '');
  L.push('Diese Datei schreibt die App Lernwerk beim Abgleich. Sie zeigt, wo es gerade hakt. Bitte daraus gezielt Lernseiten oder Lernwerk-Blöcke bauen, nur aus dem Unterrichtsmaterial, nichts erfinden.', '');
  L.push('## So kommt etwas in die App', '');
  L.push('- Neue Lernseiten (eine HTML-Datei, wie ein Artefakt) und Lernwerk-Blöcke (.txt) in den Ordner `eingang/` dieses Repositorys legen.');
  L.push('- Am Anfang einer Lernseite optional: `<!-- lernwerk fach="Werkstofftechnik" thema="Gusseisen" arbeit="JJJJ-MM-TT" -->`. Ohne Angabe kommt sie zur nächsten Arbeit im Fach.');
  L.push('- Lernseiten laufen in der App abgeschottet und offline. Ihr localStorage wird gespeichert und zwischen den Geräten abgeglichen. Externe Schriften gehen nur mit Netz.');
  L.push('- Eine Datei mit gleichem Namen und neuem Inhalt wird neu geholt. Eine Lernseite mit gleichem Titel im selben Fach ersetzt die alte, der Fortschritt bleibt.', '');
  const kommende = st.S.exams.filter(e => e.datum >= heute).sort((a, b) => (a.datum < b.datum ? -1 : 1));
  if (kommende.length) {
    L.push('## Kommende Klassenarbeiten', '');
    for (const e of kommende.slice(0, 4)) {
      const b = st.bereitschaft(e);
      L.push(`- ${e.fach}, ${dayLong(e.datum)} (in ${daysBetween(heute, e.datum)} Tagen)${b != null ? ', vorbereitet ' + b + ' %' : ''}`);
      for (const t of (e.themaIds || []).filter(x => st.thema(x))) { const s = st.staerke(t); L.push(`  - ${st.thema(t).thema.name}: ${s.wert == null ? 'noch zu wenig geübt' : s.stufe + ' (' + Math.round(s.wert * 100) + ' %)'}`); }
    }
    L.push('');
  }
  const schwach = st.allTids().filter(t => st.staerke(t).stufe === 'schwach' && st.staerke(t).wert != null);
  if (schwach.length) { L.push('## Schwache Themen', ''); for (const t of schwach.slice(0, 12)) { const th = st.thema(t); L.push(`- ${th.fach.name}: ${th.thema.name} (${Math.round(st.staerke(t).wert * 100)} %)`); } L.push(''); }
  const fehler = st.S.errors.filter(e => !e.erledigt);
  if (fehler.length) {
    const arten = new Map(); for (const e of fehler) arten.set(e.fehlerart, (arten.get(e.fehlerart) || 0) + 1);
    L.push('## Fehlerbuch (offen)', '', 'Häufigste Fehlerarten: ' + [...arten].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, n]) => k + ' ' + n).join(', ') + '.', '');
    for (const e of fehler.slice().sort((a, b) => b.zeit - a.zeit).slice(0, 12)) L.push(`- ${e.fach || ''}${e.thema ? ', ' + e.thema : ''}: ${String(e.aufgabe || '').slice(0, 160)}${e.eingabe ? ' | meine Eingabe: ' + String(e.eingabe).slice(0, 60) : ''}${e.richtig ? ' | richtig: ' + String(e.richtig).slice(0, 60) : ''} (${e.fehlerart})`);
    L.push('');
  }
  const wackel = [...st.S.cards.values()].filter(c => (c.falsch || 0) >= 2 && c.tid && st.thema(c.tid) && !String(c.id).startsWith('f:')).sort((a, b) => b.falsch - a.falsch).slice(0, 15);
  if (wackel.length) {
    L.push('## Fragen, die immer wieder falsch sind', '');
    for (const c of wackel) { const it = st.topicItems(c.tid).find(i => i.id === c.id); if (it) L.push(`- ${st.thema(c.tid).thema.name}: ${String(it.frage || (it.aufgabe && it.aufgabe.text) || (it.u && it.u.formel + ' nach ' + it.u.nach) || (it.a && it.a.frage) || (it.v && it.v.a + ' oder ' + it.v.b) || '').slice(0, 160)} (${c.falsch} mal falsch)`); }
    L.push('');
  }
  const proben = st.proben().slice().sort((a, b) => b.zeit - a.zeit).slice(0, 3);
  if (proben.length) {
    L.push('## Letzte Probeklausuren', '');
    for (const p of proben) L.push(`- ${p.datum}: ${p.proz} %` + (p.themen ? ' · ' + Object.entries(p.themen).filter(([t]) => st.thema(t)).map(([t, q]) => st.thema(t).thema.name + ' ' + q + ' %').join(', ') : ''));
    L.push('');
  }
  const sp = lernseiten.seiten();
  if (sp.length) { L.push('## Lernseiten in der App', ''); for (const n of sp) L.push('- ' + n.titel); L.push(''); }
  return L.join('\n');
}
// Höchstens alle sechs Stunden und nur, wenn sich etwas geändert hat, damit nicht jeder Abgleich eine neue Fassung anlegt
export async function lernstandSchreiben(gh, repo, base64) {
  const text = lernstandText();
  const h = hash(text);
  if (prefs.get('lernstandHash', '') === h || Date.now() - prefs.get('lernstandZeit', 0) < 6 * 3600000) return false;
  const pfad = '/repos/' + repo + '/contents/lernstand.md';
  const alt = await gh(pfad);
  const body = { message: 'Lernstand ' + dayStr(), content: base64('Stand: ' + new Date().toLocaleString('de-DE') + '\n\n' + text) };
  if (alt.ok) body.sha = (await alt.json()).sha;
  else if (alt.status !== 404) return false;
  const r = await gh(pfad, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (r.ok) { prefs.set('lernstandHash', h); prefs.set('lernstandZeit', Date.now()); }
  return r.ok;
}
