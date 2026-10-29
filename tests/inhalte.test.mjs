// Prüft alle Inhaltsdateien: Lesefehler, Hinweise, Formeln mathematisch, Lehrplan-Namen, Vorlesbarkeit.
// Ausführen mit: node tests/inhalte.test.mjs
import fs from 'node:fs';
import { parseBlocks, summary } from '../js/parser.js';
import { checkSolved, samples, parseEq, calc, keyOf } from '../js/formula.js';
import { norm } from '../js/util.js';
const L = JSON.parse(fs.readFileSync(new URL('../lehrplan.json', import.meta.url), 'utf8'));
let bad = 0;
const idx = JSON.parse(fs.readFileSync(new URL('../inhalte/index.json', import.meta.url), 'utf8'));
const files = idx.dateien.map(f => new URL('../inhalte/' + (typeof f === 'string' ? f : f.datei), import.meta.url));
const faecher = JSON.parse(fs.readFileSync(new URL('../inhalte/faecher.json', import.meta.url), 'utf8'));
for (const f of L.faecher) if (!faecher[f.id]) { console.log('FACH-EINLEITUNG fehlt', f.id); bad++; }
const covered = new Set();
for (const file of files) {
  const r = parseBlocks(fs.readFileSync(file, 'utf8'));
  for (const e of r.fehler) { console.log('FEHLER', file, e); bad++; }
  for (const e of r.hinweise) { console.log('HINWEIS', file, e.zeile, e.meldung, '|', e.text); bad++; }
  for (const t of r.themen) {
    const f = L.faecher.find(x => norm(x.name) === norm(t.fach));
    const th = f && f.themen.find(x => norm(x.name) === norm(t.thema));
    if (!th) { console.log('KEIN LEHRPLAN-THEMA', t.fach, '|', t.thema); bad++; } else covered.add(th.id);
    for (const fo of t.formeln) {
      try { parseEq(fo.formel); } catch (e) { console.log('FORMEL unlesbar', fo.formel); bad++; continue; }
      for (const g of fo.umgestellt) {
        let target; try { const e = parseEq(g); target = e.l && e.l.t === 'var' ? e.l.n : null; } catch (e) { console.log('UMST unlesbar', g); bad++; continue; }
        if (!target) { console.log('UMST ohne Ziel', g); bad++; continue; }
        if (!samples(fo.formel, target, g).length) { console.log('UMST FALSCH?', fo.formel, '→', g); bad++; }
      }
    }
    for (const u of t.umstellen) if (!samples(u.formel, u.nach, u.loesung).length) { console.log('UMSTELLEN FALSCH?', u.formel, u.loesung); bad++; }
    // Volle Lernblöcke: Mindestumfang und Ansatz-Training
    // Einführungen werden nicht geprüft, Ergänzungen brauchen keine 10 Karten (sie ergänzen ein volles Thema)
    const entry = idx.dateien.find(f => (typeof f === 'string' ? f : f.datei) === String(file).split('/inhalte/')[1]);
    const art = typeof entry === 'object' ? entry.art : '';
    if (art !== 'einfuehrung' && t.aufgaben.length) {
      if (art !== 'ergaenzung' && t.karten.length < 10) { console.log('ZU WENIG KARTEN', t.thema, t.karten.length); bad++; }
      for (const a of t.aufgaben) {
        const kurz = a.text.slice(0, 50);
        if (!a.ansatz || !a.signal || !a.kontrolle) { console.log('ANSATZ, SIGNAL ODER KONTROLLE FEHLT', t.thema, '|', kurz); bad++; }
        for (const q of [a.ansatz, a.warum, a.kontrolle]) if (q && (q.falsch.length < 2 || q.falsch.includes(q.richtig))) { console.log('AUSWAHL UNSAUBER', t.thema, '|', kurz); bad++; }
        // Die richtige Antwort darf sich nicht durch ihre Länge verraten
        for (const q of [a.ansatz, a.warum, a.kontrolle]) if (q) { const L = q.falsch.map(x => x.length); if (q.richtig.length > Math.max(...L) * 1.35 + 6 || q.richtig.length > Math.min(...L) * 2.2 + 10) { console.log('RICHTIGE ANTWORT AUFFÄLLIG LANG', t.thema, '|', q.richtig); bad++; } }
        // Platzhalter müssen Variablen sein
        const names = new Set(a.variablen.map(v => keyOf(v.name)));
        for (const m of (a.text + a.gegeben.join(' ') + a.tipps.join(' ') + a.schritte.map(x => x.was + ' ' + (x.tipp || '')).join(' ') + [a.ansatz, a.warum, a.kontrolle].filter(Boolean).flatMap(q => [q.frage || '', q.richtig, ...q.falsch]).join(' ') + (a.signal || '')).matchAll(/\{([^}]+)\}/g)) if (!names.has(keyOf(m[1]))) { console.log('PLATZHALTER OHNE VARIABLE', m[1], '|', kurz); bad++; }
        // Zufallswerte: Rechnung und alle Schritte müssen gültige Zahlen liefern
        if (a.variablen.length && a.rechnung) {
          for (let k = 0; k < 40; k++) {
            const vals = {};
            for (const v of a.variablen) { const n = Math.floor((v.bis - v.von) / v.schritt + 1e-9); vals[keyOf(v.name)] = v.von + Math.floor(Math.random() * (n + 1)) * v.schritt; }
            const r = calc(a.rechnung, vals);
            if (r == null || !isFinite(r)) { console.log('RECHNUNG UNGÜLTIG', kurz, JSON.stringify(vals)); bad++; break; }
            let last = null, badStep = false;
            for (const st of a.schritte) if (st.ergebnis && st.ergebnis.typ === 'ausdruck') { const x = calc(st.ergebnis.text, vals); if (x == null || !isFinite(x)) { console.log('SCHRITT UNGÜLTIG', kurz, st.ergebnis.text, JSON.stringify(vals)); bad++; badStep = true; break; } last = st.ergebnis.text; }
            if (badStep) break;
            if (k === 0 && last && Math.abs(calc(last, vals) - r) > 1e-9 * Math.max(1, Math.abs(r))) { console.log('LETZTER SCHRITT UNGLEICH RECHNUNG', kurz); bad++; }
          }
        }
        // Jeder Schritt soll eine Formel anwenden oder umrechnen, kein bloßes Rechen-Zwischenstück
        // In Mathe gehören solche Teilschritte zum Verfahren, zum Beispiel beim Logarithmus
        if (t.fach !== 'Mathematik') for (const st of a.schritte) if (/^(Produkt|Summe der Widerstände|Verhältnis|Faktor|Halbe|Anteil von)|zum Quadrat$/.test(st.was)) { console.log('SCHRITT OHNE FORMEL', t.thema, '|', st.was); bad++; }
        for (const st of a.schritte) if (st.ergebnis && st.ergebnis.typ === 'gleichung') { try { parseEq(st.ergebnis.text); } catch (e) { console.log('SCHRITT-GLEICHUNG unlesbar', st.ergebnis.text); bad++; } }
      }
    }
    // Pfeile und Abkürzungen vermeiden (vorlesbar)
    const all = JSON.stringify(t);
    for (const bad2 of ['→', '=>', 'z. B.', 'z.B.', 'bzw.', 'usw.', 'ca.', 'd. h.']) if (all.includes(bad2)) { console.log('VORLESEN', t.thema, bad2); bad++; }
    // Rechenzeichen, Hochzahlen und Vorzeichen als Zeichen, nicht als Wort
    for (const re of [/\bhoch (\d|zwei|drei|null|\{)/, /geteilt durch/, /\d mal \d/, /zum Quadrat/, /\b(plus|minus) \d/, /\d (plus|minus) /, /Wurzel aus [A-Za-z]_?\w*²/]) { const m = all.match(re); if (m) { console.log('ZEICHEN STATT WORT', t.thema, '|', all.slice(Math.max(0, m.index - 30), m.index + 30)); bad++; } }
  }
  console.log(String(file).split('/').pop(), r.themen.length, 'Themen');
}
for (const f of L.faecher) for (const t of f.themen) if (!covered.has(t.id)) { console.log('THEMA OHNE EINFÜHRUNG', t.id); bad++; }
// Hörmodus: veraltete oder fehlende Podcast-Folgen nur als Hinweis melden, die App fällt dann auf die Systemstimme zurück
{
  const { alleFolgen } = await import('../tools/hoer/folgen.mjs');
  const ap = new URL('../audio/folgen.json', import.meta.url);
  const audio = fs.existsSync(ap) ? JSON.parse(fs.readFileSync(ap, 'utf8')).folgen : {};
  const alt = alleFolgen().filter(f => !audio[f.tid] || audio[f.tid].hash !== f.hash);
  for (const f of Object.values(audio)) if (!fs.existsSync(new URL('../audio/' + f.datei, import.meta.url))) { console.log('AUDIO FEHLT', f.datei); bad++; }
  if (alt.length) console.log('HINWEIS Hörmodus:', alt.length, 'Folgen ohne aktuelle Audiodatei. Neu erzeugen mit node tools/hoer/skript.mjs und python3 tools/hoer/erzeugen.py');
}
// Versionsnummer muss in sw.js und js/app.js gleich sein, sonst kommt kein Update an
const swV = /const VERSION = '([^']+)'/.exec(fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8'))[1];
const appV = /export const VERSION = '([^']+)'/.exec(fs.readFileSync(new URL('../js/app.js', import.meta.url), 'utf8'))[1];
if (swV !== appV) { console.log('VERSION ungleich: sw.js', swV, 'app.js', appV); bad++; }
// Alle Dateien aus sw.js müssen existieren
const swText = fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
for (const f of [...swText.split('FILES = [')[1].split('];')[0].matchAll(/'([^']+)'/g)].map(m => m[1])) {
  if (f !== './' && !fs.existsSync(new URL('../' + f, import.meta.url))) { console.log('FEHLT für Offline:', f); bad++; }
}
console.log('Probleme:', bad);
process.exit(bad ? 1 : 0);
