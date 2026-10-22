// Ausführen mit: node tests/parser.test.mjs
import { readFileSync } from 'node:fs';
import { parseBlocks, exportBlock, mergeTopic, summary } from '../js/parser.js';
import { parseEq, evaluate, calc, checkSolved, checkStep, fml, speakFml } from '../js/formula.js';
import { checkNumber, readNumber } from '../js/check.js';
import { markdown } from '../js/util.js';
import { nextState, INTERVALS } from '../js/srs.js';

let pass = 0, fail = 0;
const ok = (cond, name, extra) => { if (cond) pass++; else { fail++; console.log('FEHLER:', name, extra !== undefined ? JSON.stringify(extra) : ''); } };
const near = (a, b) => Math.abs(a - b) < 1e-9 * Math.max(1, Math.abs(b));

const text = readFileSync(new URL('./beispiel-bloecke.txt', import.meta.url), 'utf8');
const parts = text.split(/^##### .*$/m).filter(s => s.trim());

// Fall 1
const r1 = parseBlocks(parts[0]);
ok(r1.themen.length === 1, 'F1 ein Thema', r1.themen.length);
const t1 = r1.themen[0];
ok(t1.fach === 'Elektrotechnik' && t1.thema === 'Kondensator' && t1.modul === 'M2', 'F1 Kopf', [t1.fach, t1.thema, t1.modul]);
ok(t1.begriffe.length === 2 && t1.begriffe[0].erklaerung.startsWith('Wie viel'), 'F1 Begriffe');
ok(t1.prinzip.length === 1 && t1.prinzip[0].includes('\n\nJe größer'), 'F1 Prinzip mehrzeilig', t1.prinzip);
ok(t1.formeln.length === 2 && t1.formeln[1].umgestellt.length === 2, 'F1 Formeln', t1.formeln);
ok(t1.karten.length === 2, 'F1 Karten');
ok(t1.aufgaben.length === 1, 'F1 Aufgabe');
const a = t1.aufgaben[0];
ok(a.schritte.length === 2 && a.schritte[0].ergebnis.typ === 'gleichung' && a.schritte[1].ergebnis.typ === 'ausdruck', 'F1 Schritte', a.schritte);
ok(a.ergebnis.wert.zahl === 564 && a.ergebnis.einheit === 'µC', 'F1 Ergebnis', a.ergebnis);
ok(a.variablen.length === 2 && a.variablen[0].schritt === 1, 'F1 Variablen');
ok(a.rechnung === 'C * U', 'F1 Rechnung');
ok(r1.termine.length === 1 && r1.termine[0].datum === '2026-11-24' && r1.termine[0].themen === 'Kondensator, Ohm', 'F1 Termin', r1.termine);
ok(r1.fehler.length === 0, 'F1 keine Fehler', r1.fehler);
ok(summary(t1).startsWith('1 Merksatz, 2 Begriffe, 2 Karten, 1 Aufgabe, 2 Formeln'), 'F1 Zusammenfassung', summary(t1));

// Rundreise: exportieren und wieder lesen
const back = parseBlocks(exportBlock(t1)).themen[0];
ok(JSON.stringify(back) === JSON.stringify(t1), 'F1 Rundreise identisch');

// Fall 2
const r2 = parseBlocks(parts[1]);
ok(r2.themen.length === 2, 'F2 zwei Themen', r2.themen.map(t => t.thema));
ok(r2.themen[0].fach === 'Mathematik' && r2.themen[0].thema === 'Potenzen', 'F2 Kopf trotz Markdown', r2.themen[0]);
ok(r2.themen[0].merksaetze[0] === 'Gleiche Basis, Exponenten addieren.', 'F2 Merksatz ohne Sternchen', r2.themen[0].merksaetze);
ok(r2.themen[0].karten[0].antwort === 'a⁵', 'F2 Karte nummeriert');
ok(r2.themen[0].notizen.length === 2 && r2.themen[0].notizen[1].text.includes('zwei Zeilen'), 'F2 unbekannte Schlüssel als Notiz', r2.themen[0].notizen);
ok(r2.themen[1].fach === 'Mathematik' && r2.themen[1].thema === 'Wurzeln' && r2.themen[1].formeln.length === 1, 'F2 zweites Thema erbt Fach');
ok(r2.hinweise.some(h => h.meldung.includes('Beispiel')), 'F2 Hinweis auf unbekannten Schlüssel');

// Fall 3
const r3 = parseBlocks(parts[2]);
ok(r3.themen.length === 2, 'F3 ohne Markierungen zwei Themen', r3.themen.map(t => t.thema));
ok(r3.fehler.some(f => f.meldung.includes('Antwort') && f.zeile === 4), 'F3 Karte ohne Antwort mit Zeilennummer', r3.fehler);
ok(r3.fehler.some(f => f.meldung.startsWith('Variable')), 'F3 Variable kaputt');
ok(r3.fehler.some(f => f.meldung.startsWith('Die Rechnung')), 'F3 Rechnung kaputt');
ok(r3.fehler.some(f => f.meldung.includes('Datum')), 'F3 Termin ohne Datum');
ok(r3.hinweise.some(h => h.meldung.includes('keine Zeile „Aufgabe:“')), 'F3 Schritt ohne Aufgabe');
ok(r3.themen[0].aufgaben[0].ergebnis.wert.zahl === 120 && r3.themen[0].aufgaben[0].ergebnis.einheit === 'Nm', 'F3 Ergebnis mit Einheit ohne Strich', r3.themen[0].aufgaben[0].ergebnis);
ok(r3.themen[1].karten.length === 1, 'F3 zweites Thema');

// Fall 4
const r4 = parseBlocks(parts[3]);
ok(r4.themen.length === 0 && r4.fehler.some(f => f.meldung.includes('Thema fehlt')), 'F4 Thema fehlt', r4.fehler);
ok(r4.termine.length === 1 && r4.termine[0].datum === '2026-11-24', 'F4 reiner Termin-Block', r4.termine);

// Zusammenführen ohne Duplikate
const m = mergeTopic(t1, r1.themen[0]);
ok(m.added === 0, 'Merge: nichts doppelt');
const m2 = mergeTopic(t1, parseBlocks('Fach: Elektrotechnik\nThema: Kondensator\nKarte: Neue Frage | Antwort\nKarte: Einheit der Kapazität? | F').themen[0]);
ok(m2.added === 1 && m2.topic.karten.length === 3, 'Merge: nur Neues', m2.added);

// Formel-Parser
const v = (s, vars = {}) => evaluate(parseEq(s).r, vars);
ok(near(v('2 + 3 · 4'), 14), 'Punkt vor Strich');
ok(near(v('2^3^2'), 512), 'Potenz rechtsassoziativ');
ok(near(v('-3²'), -9), 'Minus vor Quadrat');
ok(near(v('2πr', { r: 1 }), 2 * Math.PI), 'implizites Mal mit π');
ok(near(v('√(9) + √16'), 7), 'Wurzel');
ok(near(v('sin(30)'), 0.5) && near(v('atan(1)'), 45), 'Grad');
ok(near(v('3,5 * 2'), 7), 'Komma als Dezimalzeichen');
ok(near(v('R_1 + R1', { R1: 2 }), 4), 'R_1 und R1 sind gleich');
ok(near(calc('n = vc * 1000 / (pi * d)', { vc: 120, d: 10 }), 120000 / (Math.PI * 10)), 'Rechnung mit Gleichung');
ok(calc('2 +') === null, 'kaputte Rechnung gibt null');
ok(fml('I = U / R').includes('class="frac"'), 'Bruch mit echtem Bruchstrich');
ok(speakFml('P = U² / R') === 'P ist gleich U Quadrat geteilt durch R', 'gesprochen', speakFml('P = U² / R'));
let threw = false; try { parseEq('a = (b + c'); } catch (e) { threw = e.message.includes('Klammer'); } ok(threw, 'Klammerfehler erkannt');

// Umstellen prüfen
ok(checkSolved('U = R · I', 'I', 'I = U / R', 'I = U/R').ok, 'Umstellen richtig');
ok(checkSolved('U = R · I', 'I', 'I = U / R', 'U/R = I').ok, 'Umstellen andersrum');
ok(checkSolved('P = U · I', 'I', 'I = P / U', 'I = PU').ok === false, 'mal statt geteilt');
ok(checkSolved('U = R · I', 'I', 'I = U / R', 'I = R/U').fehlerart === 'Kehrwert', 'Kehrwert erkannt', checkSolved('U = R · I', 'I', 'I = U / R', 'I = R/U'));
ok(checkSolved('U = R · I', 'I', 'I = U / R', 'I = U·R').fehlerart === 'Mal und geteilt verwechselt', 'mal/geteilt erkannt', checkSolved('U = R · I', 'I', 'I = U / R', 'I = U·R'));
ok(checkSolved('R = R1 + R2', 'R1', 'R1 = R - R2', 'R1 = R + R2').fehlerart === 'Vorzeichen', 'Vorzeichen erkannt');
ok(checkSolved('W = 0,5 · C · U²', 'U', 'U = √(2 · W / C)', 'U = 2W/C').fehlerart === 'Wurzel oder Quadrat', 'Wurzel vergessen');
ok(checkSolved('F_G = m · g', 'm', 'm = F_G / g', 'm = FG/g').ok, 'Unterstrich egal');
ok(checkSolved('F = m · a', 'F', 'F = m · a', 'F = ma').ok, 'ma wird zu m · a');
ok(checkSolved('U = R · I', 'I', 'I = U / R', 'I = I').ok === false, 'nicht freigestellt');
ok(checkStep('U = R · I', 'I', 'I = U / R', 'U / R = R · I / R').ok, 'Zwischenschritt richtig');
ok(checkStep('U = R · I', 'I', 'I = U / R', 'U / R = R · I').ok === false, 'nur eine Seite umgeformt');
ok(checkStep('U = R · I', 'I', 'I = U / R', 'R · I = R · I').ok === false, 'immer wahr');

// Zahlen prüfen
ok(checkNumber('12,5', 12.5, 'A').status === 'ok', 'Zahl mit Komma');
ok(checkNumber('12.6', 12.5, 'A').status === 'ok', 'innerhalb 1 Prozent');
ok(checkNumber('12500', 12.5, 'A').fehlerart === 'Einheit (Faktor 1000)', 'Faktor 1000');
ok(checkNumber('12,5 mA', 0.0125, 'A').status === 'ok', 'Einheit umgerechnet');
ok(checkNumber('-12,5', 12.5, 'N').fehlerart === 'Vorzeichen', 'Vorzeichen');
ok(checkNumber('206,6', 26.6, '°').fehlerart === 'Quadrant beim Arcustangens', 'Quadrant');
ok(checkNumber('0,4643', 26.6, '°').fehlerart === 'Taschenrechner auf RAD', 'RAD');
ok(checkNumber('', 1).status === 'empty' && checkNumber('abc', 1).status === 'unreadable', 'leer und unlesbar');
ok(readNumber('1.234,5').value === 1234.5 && readNumber('2e-3').value === 0.002, 'Zahlformate');
ok(checkNumber('12', 12.5, 'A').fehlerart === 'Zu früh gerundet', 'knapp daneben');

// Markdown
ok(markdown('**fett** und\n- a\n- b').includes('<strong>fett</strong>') && markdown('- a\n- b').includes('<ul>'), 'Markdown');
ok(!markdown('<script>x</script>').includes('<script>'), 'Markdown sicher');

// Wiederholsystem
ok(INTERVALS.join() === '1,2,4,7,14,30', 'Abstände');
let s = nextState(null, 'richtig', '2026-10-01');
ok(s.stufe === 1 && s.faellig === '2026-10-02', 'neu richtig', s);
s = nextState(s, 'richtig', '2026-10-02'); ok(s.stufe === 2 && s.faellig === '2026-10-04', 'Stufe 2', s);
s = nextState(s, 'hilfe', '2026-10-04'); ok(s.stufe === 2 && s.faellig === '2026-10-06', 'mit Hilfe gleiche Stufe', s);
s = nextState(s, 'falsch', '2026-10-06'); ok(s.stufe === 1 && s.faellig === '2026-10-07', 'falsch zurück auf 1', s);
let t = null; for (let i = 0; i < 9; i++) t = nextState(t, 'richtig', '2026-10-01'); ok(t.stufe === 6 && t.faellig === '2026-10-31', 'höchstens 30 Tage', t);

console.log(`\n${pass} bestanden, ${fail} fehlgeschlagen`);
process.exit(fail ? 1 : 0);
