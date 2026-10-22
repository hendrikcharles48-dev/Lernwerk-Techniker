// Prüft alle Inhaltsdateien: Lesefehler, Hinweise, Formeln mathematisch, Lehrplan-Namen, Vorlesbarkeit.
// Ausführen mit: node tests/inhalte.test.mjs
import fs from 'node:fs';
import { parseBlocks, summary } from '../js/parser.js';
import { checkSolved, samples, parseEq } from '../js/formula.js';
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
    // Pfeile und Abkürzungen vermeiden (vorlesbar)
    const all = JSON.stringify(t);
    for (const bad2 of ['→', '=>', 'z. B.', 'z.B.', 'bzw.', 'usw.', 'ca.', 'd. h.']) if (all.includes(bad2)) { console.log('VORLESEN', t.thema, bad2); bad++; }
  }
  console.log(String(file).split('/').pop(), r.themen.length, 'Themen');
}
for (const f of L.faecher) for (const t of f.themen) if (!covered.has(t.id)) { console.log('THEMA OHNE EINFÜHRUNG', t.id); bad++; }
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
