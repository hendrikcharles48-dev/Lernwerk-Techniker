// Ausführen mit: node tests/zeichnung.test.mjs
// Prüft eingefügte Zeichnungen (Schlüssel „Zeichnung“): Lesen, Fehler, keine Doppelten, Bereinigung.
// Die Bereinigung läuft hier ohne DOMParser. Ist Playwright mit Chromium da, wird zusätzlich
// der Weg über DOMParser im Browser geprüft.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { parseBlocks, mergeTopic, emptyTopic, exportBlock, summary } from '../js/parser.js';
import { bereinigen } from '../js/svg.js';

let pass = 0, fail = 0;
const ok = (cond, name, extra) => { if (cond) pass++; else { fail++; console.log('FEHLER:', name, extra !== undefined ? JSON.stringify(extra) : ''); } };

const svgA = '<svg viewBox="0 0 100 50"><line class="l" x1="0" y1="25" x2="100" y2="25"/><text class="t2" x="5" y="20">F</text></svg>';
const svgB = '<svg viewBox="0 0 100 50"><rect class="fb" x="10" y="10" width="30" height="20"/><text x="50" y="30">a | b</text></svg>';
const block = `=== LERNWERK ===
Fach: Technische Mechanik
Thema: Hebel
Karte: Was ist ein Hebel? | Ein starrer Körper, der sich um einen Drehpunkt dreht.
Zeichnung: Einseitiger Hebel | ${svgA}
Zeichnung: Kräfte | ${svgB}
Zeichnung: Kaputt | <svg viewBox="0 0 10 10"><line x1="0"
Zeichnung: Ohne Bild | nur Text
=== ENDE ===`;

// 1. Zwei Zeichnungen, eine mit „|“ im SVG
const r = parseBlocks(block);
const t = r.themen[0];
ok(t && t.zeichnungen.length === 2, 'zwei gültige Zeichnungen gelesen', t && t.zeichnungen.map(z => z.titel));
ok(t.zeichnungen[0].titel === 'Einseitiger Hebel', 'Titel vor dem ersten Trennstrich');
ok(t.zeichnungen[1].svg.includes('a | b'), 'Trennstrich im SVG bleibt erhalten', t.zeichnungen[1].svg);
ok(t.zeichnungen[0].svg.includes('class="l"'), 'class-Attribute bleiben');
ok(/2 Zeichnungen/.test(summary(t)), 'Vorschau zählt Zeichnungen', summary(t));

// 2. Ungültige Zeilen ergeben Fehler mit Zeilennummer
ok(r.fehler.length === 2, 'zwei Fehler für ungültige Zeichnungen', r.fehler);
ok(r.fehler.some(e => e.zeile === 7) && r.fehler.some(e => e.zeile === 8), 'Fehler nennen die Zeile', r.fehler.map(e => e.zeile));

// 3. Mehrzeiliges SVG
const mehr = parseBlocks(`Fach: Mathe\nThema: Kreis\nZeichnung: Kreis | <svg viewBox="0 0 10 10">\n  <circle class="b" cx="5" cy="5" r="4"/>\n</svg>\nKarte: Frage | Antwort`);
ok(mehr.themen[0].zeichnungen.length === 1 && mehr.themen[0].zeichnungen[0].svg.includes('circle'), 'SVG über mehrere Zeilen', mehr.themen[0].zeichnungen);
ok(mehr.themen[0].karten.length === 1, 'nach dem SVG geht es normal weiter');

// 4. Zweites Einfügen verdoppelt nichts, gleichnamige Zeichnung ersetzt die alte
const zweimal = mergeTopic(t, parseBlocks(block).themen[0]);
ok(zweimal.topic.zeichnungen.length === 2 && zweimal.added === 0, 'doppeltes Einfügen ohne Doppelte', zweimal.topic.zeichnungen.length);
const neu = parseBlocks(`Fach: Technische Mechanik\nThema: Hebel\nZeichnung: einseitiger  Hebel | <svg viewBox="0 0 10 10"><circle class="r" cx="5" cy="5" r="3"/></svg>`).themen[0];
const ersetzt = mergeTopic(t, neu).topic;
ok(ersetzt.zeichnungen.length === 2 && ersetzt.zeichnungen[0].svg.includes('circle'), 'gleichnamige Zeichnung ersetzt die alte', ersetzt.zeichnungen);
const bleibt = mergeTopic(t, neu, { zeichnungBleibt: true }).topic;
ok(bleibt.zeichnungen[0].svg.includes('line'), 'beim Abgleich bleibt die neuere Fassung', bleibt.zeichnungen[0]);

// 5. Export und wieder Einlesen
const zurueck = parseBlocks(exportBlock(t)).themen[0];
ok(zurueck.zeichnungen.length === 2 && zurueck.zeichnungen[1].svg.includes('a | b'), 'Export im Blockformat und wieder eingelesen', zurueck.zeichnungen);

// 6. Bereinigung ohne DOMParser
const boese = '<svg viewBox="0 0 10 10" onload="alert(1)"><script>alert(2)</script><foreignObject><div>x</div></foreignObject><image href="https://example.com/a.png"/><a href="javascript:alert(3)"><rect class="l" onclick="x()" style="fill:url(https://x)" width="5" height="5"/></a><use href="#m"/></svg>';
const sauber = bereinigen(boese);
ok(sauber && !/<script/i.test(sauber) && !/onload|onclick/i.test(sauber), 'script und on…-Attribute entfernt', sauber);
ok(!/foreignObject|example\.com|javascript:|url\(/i.test(sauber), 'foreignObject, fremde Bilder, fremde Verweise und url( entfernt', sauber);
ok(/href="#m"/.test(sauber) && /class="l"/.test(sauber), 'Verweis mit # und class bleiben', sauber);
ok(bereinigen('<div>kein svg</div>') === '', 'kein SVG ergibt leer');
const ausBlock = parseBlocks(`Fach: A\nThema: B\nZeichnung: Böse | ${boese}`).themen[0].zeichnungen[0];
ok(ausBlock && !/<script|onload/i.test(ausBlock.svg), 'Parser speichert nur die bereinigte Fassung', ausBlock);

// 7. Alte Themen ohne Liste „zeichnungen“
ok(mergeTopic(Object.assign(emptyTopic('A', 'B'), { zeichnungen: undefined }), t).topic.zeichnungen.length === 2, 'alte Themen ohne Zeichnungen');

// 8. Weg über DOMParser im Browser, wenn Chromium da ist
let chromium = null;
try { chromium = createRequire(import.meta.url)('playwright').chromium; } catch (e) {
  try { chromium = createRequire(process.env.NODE_PATH ? process.env.NODE_PATH + '/' : '/usr/lib/node_modules/')('playwright').chromium; } catch (e2) { chromium = null; }
}
if (chromium) {
  let b = null;
  try {
    b = await chromium.launch();
    const p = await b.newPage();
    const code = readFileSync(new URL('../js/svg.js', import.meta.url), 'utf8').replace(/^export /gm, '');
    const out = await p.evaluate(([c, s]) => new Function(c + '\nreturn bereinigen(arguments[0]);')(s), [code, boese]);
    ok(out && !/<script|onload|onclick|foreignObject|example\.com|javascript:|url\(/i.test(out), 'DOMParser: alles Gefährliche entfernt', out);
    ok(/href="#m"/.test(out) && /class="l"/.test(out), 'DOMParser: erlaubte Teile bleiben', out);
    const kaputt = await p.evaluate(([c]) => new Function(c + '\nreturn bereinigen(\'<svg><line></svg>\');')(), [code]);
    ok(kaputt === '', 'DOMParser: fehlerhaftes SVG ergibt leer', kaputt);
  } catch (e) { console.log('Hinweis: Browser-Prüfung übersprungen:', e.message.split('\n')[0]); }
  finally { if (b) await b.close(); }
} else console.log('Hinweis: Playwright fehlt, Browser-Prüfung übersprungen.');

console.log(`\n${pass} bestanden, ${fail} fehlgeschlagen`);
process.exit(fail ? 1 : 0);
