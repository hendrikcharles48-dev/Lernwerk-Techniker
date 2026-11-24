// Ausführen mit: node tests/parser.test.mjs
import { readFileSync } from 'node:fs';
import { parseBlocks, exportBlock, mergeTopic, summary, readInhalt } from '../js/parser.js';
import { parseEq, evaluate, calc, checkSolved, checkStep, fml, speakFml } from '../js/formula.js';
import { checkNumber, readNumber } from '../js/check.js';
import { markdown } from '../js/util.js';
import { nextState, INTERVALS, verteilen, serie } from '../js/srs.js';

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
s = nextState(s, 'falsch', '2026-10-06'); ok(s.stufe === 1 && s.faellig === '2026-10-07', 'falsch auf Stufe 2 zurück auf 1', s);
let t = null; for (let i = 0; i < 9; i++) t = nextState(t, 'richtig', '2026-10-01'); ok(t.stufe === 6 && t.faellig === '2026-10-31', 'höchstens 30 Tage', t);

// Ansatz zuerst: Ansatz, Signal, Warum, Kontrolle
const ra = parseBlocks(`=== LERNWERK ===
Fach: Elektrotechnik
Thema: Ohm
Aufgabe: R gesucht
Ansatz: Ohmsches Gesetz | Leistung; Reihe
Signal: Ein Bauteil, U und I gegeben.
Warum: Weil U, R und I zusammenhängen | Weil es immer so ist; Weil P gesucht ist
Kontrolle: Passt die Größe? | Ja | Nein; Egal
Schritt: R ausrechnen | 10 | Ω
=== ENDE ===`);
const ta = ra.themen[0].aufgaben[0];
ok(ra.fehler.length === 0 && ta.ansatz.richtig === 'Ohmsches Gesetz' && ta.ansatz.falsch.length === 2, 'Ansatz gelesen', ta.ansatz);
ok(ta.signal === 'Ein Bauteil, U und I gegeben.' && ta.warum.falsch.length === 2 && ta.kontrolle.frage === 'Passt die Größe?', 'Signal, Warum, Kontrolle', ta);
ok(JSON.stringify(parseBlocks(exportBlock(ra.themen[0])).themen[0]) === JSON.stringify(ra.themen[0]), 'Ansatz Rundreise');
ok(parseBlocks('Fach: A\nThema: B\nAufgabe: x\nAnsatz: nur richtig').fehler.length === 1, 'Ansatz ohne falsche Antworten meldet Fehler');
ok(Math.abs(calc('e^1', {}) - Math.E) < 1e-12 && Math.abs(calc('U0 * e^(-t / tau)', { U0: 10, t: 1, tau: 1 }) - 10 / Math.E) < 1e-12, 'e ist die Eulersche Zahl');
ok(parseEq('U = û / √2').r && checkSolved('u = U0 · e^(−t / τ)', 't', 't = −τ · ln(u / U0)', 't = −τ · ln(u / U0)').ok, 'û und e in Formeln');
ok(calc('mu * FG', { mu: 0.2, FG: 100 }) === 20 && parseEq('F_R = µ · F_N').r, 'µ als Formelzeichen');

// Taschenrechner-Feld: Rechnungen werden ausgerechnet
ok(checkNumber('-3,5', -3.5, '').status === 'ok' && checkNumber('−3,5', -3.5, '').status === 'ok', 'negative Zahl');
ok(checkNumber('(3)/(4)', 0.75, '').status === 'ok' && checkNumber('-(3)/(4)', -0.75, '').status === 'ok', 'Bruch aus dem Feld');
ok(checkNumber('sin(30)', 0.5, '').status === 'ok' && checkNumber('arctan(1)', 45, '°').status === 'ok', 'Winkelfunktionen in Grad');
ok(checkNumber('2,5·10^(3)', 2500, 'N').status === 'ok' && checkNumber('√(2)', Math.SQRT2, '').status === 'ok', 'Zehnerpotenz und Wurzel');
ok(checkNumber('12 - 20', -8, '').status === 'ok' && checkNumber('12,5 mA', 0.0125, 'A').status === 'ok', 'Rechnung und Einheit bleiben lesbar');
ok(checkNumber('12 N/mm²', 12, 'N/mm²').status === 'ok', 'Einheit mit Bruchstrich');

{
  const r = parseBlocks('=== LERNWERK ===\nFach: Mathematik\nThema: T\nAufgabe: Rechne {a} · 2.\nSchritt: Produkt | a * 2 | | Nimm {a} mal 2.\nVariable: a | 1 | 5 | 1\nRechnung: a * 2\n=== ENDE ===');
  const st = r.themen[0].aufgaben[0].schritte[0];
  ok(st.tipp === 'Nimm {a} mal 2.' && st.einheit === '', 'Schritt mit Tipp als viertem Feld', st);
}

{
  const r = parseBlocks('=== LERNWERK ===\nFach: Mathematik\nThema: T\nPodcast: Lena | Tom, was ist das?\nPodcast: Tom | Das ist | ein Test.\n=== ENDE ===');
  const pc = r.themen[0].podcast;
  ok(pc.length === 2 && pc[0].wer === 'A' && pc[1].wer === 'B' && pc[1].text === 'Das ist | ein Test.', 'Podcast-Zeilen mit Lena und Tom', pc);
  ok(/Podcast: Tom \| Das ist/.test(exportBlock(r.themen[0])), 'Podcast-Zeilen im Export');
}

// Wiederholsystem: Falsch fällt nur zwei Stufen zurück
{
  let c = null; for (let i = 0; i < 6; i++) c = nextState(c, 'richtig', '2026-10-01');
  const f = nextState(c, 'falsch', '2026-10-31');
  ok(f.stufe === 4 && f.faellig === '2026-11-07', 'falsch von 30 auf 7 Tage', f);
  const jung = nextState(nextState(null, 'richtig', '2026-10-01'), 'richtig', '2026-10-02');
  ok(nextState(jung, 'falsch', '2026-10-04').stufe === 1, 'junge Karte falsch zurück auf 1');
  const v = verteilen([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }, { id: 6 }], '2026-10-10');
  ok(v.filter(x => x.faellig === '2026-10-11').length === 2 && v.filter(x => x.faellig === '2026-10-13').length === 2, 'Rest auf drei Tage verteilt', v);
}
// Serie: ein freier Tag pro Woche bricht sie nicht
{
  ok(serie(['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29'], '2026-10-29') === 4, 'Serie 4 Tage');
  ok(serie(['2026-10-26', '2026-10-28', '2026-10-29'], '2026-10-29') === 3, 'ein freier Tag in der Woche bricht nicht');
  ok(serie(['2026-10-26', '2026-10-29'], '2026-10-29') === 1, 'zwei freie Tage in einer Woche brechen');
  ok(serie(['2026-10-28'], '2026-10-29') === 1, 'heute noch nicht gelernt bricht nicht');
}
// Stufen, Prüfzeile und neue Fragearten
{
  const r = parseBlocks('=== LERNWERK ===\nFach: Mathematik\nThema: T\nKarte: a | b\nStufe: 2\nVerwechslung: Spannung | Strom | Spannung treibt, Strom fließt.\nZuordnen: Größen | U = Spannung; I = Strom; R = Widerstand\nStufe: 3\nErklären: Erkläre das Ohmsche Gesetz. | U = R · I; R bleibt gleich\nSkizze: Zeichne einen Stromkreis. | Quelle; Verbraucher\nInhalt: 2 Karten; 1 Verwechslung; 1 Zuordnung\n=== ENDE ===');
  const t = r.themen[0];
  ok(!t.karten[0].stufe && t.verwechslungen[0].stufe === 2 && t.zuordnen[0].stufe === 2 && t.erklaeren[0].stufe === 3, 'Stufe gilt bis zur nächsten Stufe-Zeile', t);
  ok(t.zuordnen[0].paare.length === 3 && t.zuordnen[0].paare[0].begriff === 'U' && t.zuordnen[0].paare[0].bedeutung === 'Spannung', 'Zuordnen-Paare');
  ok(t.erklaeren[0].kern.length === 2 && t.skizzen[0].kern.length === 2, 'Erklären und Skizze mit Kernpunkten');
  ok(r.luecken.length === 1 && r.luecken[0].name === 'Karten' && r.luecken[0].ist === 1 && r.luecken[0].soll === 2, 'Prüfzeile meldet fehlende Karten', r.luecken);
  ok(!r.abgeschnitten && !t.notizen.length, 'kein Abschnitt, keine Notiz');
  const back = parseBlocks(exportBlock(t)).themen[0];
  ok(back.verwechslungen[0].stufe === 2 && back.skizzen[0].stufe === 3 && !back.karten[0].stufe, 'Stufen im Export erhalten', exportBlock(t));
  ok(parseBlocks('=== LERNWERK ===\nFach: M\nThema: T\nKarte: a | b').abgeschnitten, 'fehlendes ENDE wird erkannt');
  ok(readInhalt('6 Karten; 2 Aufgaben, 3 Begriffe').length === 3, 'Inhalt lesen');
  ok(/Verwechslung/.test(summary(t)), 'Zusammenfassung zählt Verwechslungen');
}


// Trainer-Fragen: Rückmeldung je falscher Antwort und Fälle mit Schrittfragen
{
  const r = parseBlocks(`=== LERNWERK ===
Fach: Technische Mechanik
Thema: Lagerkräfte
Fall: Balken | Gesucht: F_Ay
Gleichung: II | 0 = F_Ay + F_B − F
Schrittfrage: In welcher Gleichung steht F_Ay? | Gleichung II | Gleichung I; Gleichung III | Nur in II.
Falsch: Gleichung I | In I steht nur F_Ax.
Auswahl: Drehpunkt? | In A | In B; In der Mitte | Dann fallen F_Ax und F_Ay raus.
Falsch: In B | Dann fällt F_B raus.
Aufgabe: Test
Ansatz: Momentensumme | Kräftesumme; Pythagoras
Falsch: Pythagoras | Es gibt kein rechtwinkliges Dreieck.
Falsch: Kreisfläche | gibt es nicht
=== ENDE ===`);
  const t = r.themen[0];
  ok(t.faelle.length === 1 && t.faelle[0].gleichungen.length === 1 && t.faelle[0].schritte[0].wf[0].w === 'In I steht nur F_Ax.', 'Fall mit Schrittfrage und Falsch-Zeile', t.faelle);
  ok(t.auswahl[0].wf.length === 1 && t.aufgaben[0].ansatz.wf.length === 2, 'Falsch-Zeilen bei Auswahl und Ansatz');
  ok(r.hinweise.some(h => h.meldung.includes('Kreisfläche')), 'Hinweis bei unbekannter falscher Antwort');
  ok(JSON.stringify(parseBlocks(exportBlock(t)).themen[0]) === JSON.stringify(t), 'Rundreise mit Fall und Falsch-Zeilen');
  ok(summary(t).includes('1 Fall'), 'Zusammenfassung zählt Fälle', summary(t));
  ok(parseBlocks('Fach: X\nThema: Y\nFalsch: a | b').hinweise.length === 1, 'Falsch ohne Frage gibt einen Hinweis');
}
// Stand im Unterricht aus dem Block
{
  const r = parseBlocks('=== LERNWERK ===\nUnterricht: Elektrotechnik | Leiterwiderstand; Temperaturabhängige Widerstände\nAbgeschlossen: Elektrotechnik | Ohmsches Gesetz; Leistung, Arbeit, Wirkungsgrad\n=== ENDE ===');
  ok(r.fehler.length === 0 && r.themen.length === 0 && r.stand.length === 4, 'Unterricht- und Abgeschlossen-Zeilen werden gelesen', r);
  ok(r.stand[0].zustand === 'aktuell' && r.stand[3].zustand === 'fertig' && r.stand[3].thema === 'Leistung, Arbeit, Wirkungsgrad', 'Komma im Themennamen bleibt, Semikolon trennt');
  const r2 = parseBlocks('Fach: Elektrotechnik\nThema: Neu\nKarte: a | b\nIm Unterricht: Neu');
  ok(r2.stand.length === 1 && r2.stand[0].fach === 'Elektrotechnik' && r2.themen.length === 1, 'Ohne Fach gilt das Fach des Blocks');
}
// Aufgabenarten nach Lernart: Anker-Karte, Lücke, Warum-Frage, Fallbeispiel, Rechenweg, Tabelle, Grundprinzip
{
  const { rechenweg, reihenfolgePruefen, abhaengigkeiten } = await import('../js/rechenweg.js');
  const r = parseBlocks(readFileSync(new URL('./aufgabenarten-block.txt', import.meta.url), 'utf8'));
  ok(!r.fehler.length && !r.hinweise.length && !r.luecken.length, 'Beispielblock Aufgabenarten ohne Fehler', [r.fehler, r.hinweise, r.luecken]);
  const t = r.themen[0];
  ok(t.ankerkarten.length === 1 && t.ankerkarten[0].begriff === 'Loslager' && t.anker.length === 1 && t.ankerkarten[0].stufe === 1, 'Anker mit Fachbegriff wird Anker-Karte');
  ok(t.luecken[0].woerter.join() === 'zwei,eine' && t.luecken[0].falsch.length === 2 && t.luecken[0].wf.length === 2, 'Lücke mit zwei Wörtern und Falsch-Zeilen', t.luecken);
  ok(t.warumfragen[0].stufe === 2 && t.warumfragen[0].falsch.length === 2 && t.warumfragen[0].wf.length === 2, 'Warum-Frage in Stufe 2');
  ok(t.fallbeispiele[0].lage.includes('Schraubstock') && t.fallbeispiele[0].antwort === 'Feste Einspannung', 'Fallbeispiel mit Lage');
  const a = t.rechnen[0];
  ok(a.weg && a.stufe === 3 && a.schritte.length === 3 && a.variablen[0].einheit === 'N' && a.bereich.min === 100, 'Rechenweg mit Variablen, Einheiten und Bereich');
  ok(a.bilder[0] === 'Balken auf zwei Lagern' && a.grund.begriff === 'Momentengleichgewicht um A' && t.grundprinzipien.length === 1, 'Zeichnung und Grundprinzip gehören zur Aufgabe');
  ok(t.tabellen[0].zeilen.length === 3 && t.tabellen[0].kopf.length === 3, 'Tabelle mit Kopf und drei Zeilen');
  ok(JSON.stringify(parseBlocks(exportBlock(t)).themen[0]) === JSON.stringify(t), 'Rundreise mit allen neuen Arten');
  // Neue Zahlen bei jedem Durchgang, Lösung selbst gerechnet
  const gesehen = new Set();
  let richtig = true, imBereich = true;
  for (let n = 0; n < 40; n++) {
    const R = rechenweg(a);
    const { F, a: x, l } = R.vals;
    gesehen.add(F + '|' + x + '|' + l);
    if (!near(R.final.wert, F - F * x / l) || !near(R.steps[1].wert, F * x / l)) richtig = false;
    if (R.final.wert < 100 || R.final.wert > 8000 || R.final.einheit !== 'N') imBereich = false;
  }
  ok(gesehen.size > 10, 'Rechenweg würfelt neue Zahlen', gesehen.size);
  ok(richtig && imBereich, 'Rechenweg rechnet richtig und bleibt im Bereich');
  const R0 = rechenweg(a, () => 0);
  ok(R0.text.includes('Länge 3 m') && R0.text.includes('Kraft 2000 N') && R0.werte[1].einheit === 'm', 'Platzhalter mit Einheit', R0.text);
  // Reihenfolge: Freikörperbild zuerst, F_B vor F_A
  ok(reihenfolgePruefen(a.schritte, [0, 1, 2]).every(Boolean), 'Reihenfolge richtig');
  ok(reihenfolgePruefen(a.schritte, [0, 2, 1]).join() === 'true,false,true', 'F_A vor F_B ist an Platz 2 falsch');
  ok(reihenfolgePruefen(a.schritte, [1, 0, 2])[0] === false, 'Freikörperbild bleibt vorn');
  ok(!abhaengigkeiten(a.schritte).streng, 'Abhängigkeit über Namen erkannt');
  const unabh = [{ was: 'x', ergebnis: { typ: 'ausdruck', text: 'a * 2' } }, { was: 'y', ergebnis: { typ: 'ausdruck', text: 'a * 3' } }];
  ok(reihenfolgePruefen(unabh, [1, 0]).join() === 'false,false', 'Ohne Abhängigkeiten zählt die Reihenfolge des Blocks');
  // Fehler und alte Blöcke
  ok(parseBlocks('Fach: X\nThema: Y\nLuecke: Satz ohne Klammer').fehler.length === 1, 'Lücke ohne [Wort] ist ein Fehler');
  ok(parseBlocks('Fach: X\nThema: Y\nRechnen: a\nSchritt: s | x = b * c').fehler.length === 1, 'Rechenweg mit einem Schritt ist ein Fehler');
  ok(parseBlocks('Fach: X\nThema: Y\nRechnen: a\nVariable: b | 1 | 2\nSchritt: s | x = b * c\nSchritt: t | y = x * 2').fehler.length === 1, 'Rechenweg mit unbekannter Größe ist ein Fehler');
  const alt = parseBlocks('Fach: X\nThema: Y\nAnker: Nur ein Bild\nKarte: a | b').themen[0];
  ok(alt.anker[0] === 'Nur ein Bild' && !alt.ankerkarten.length && alt.karten.length === 1, 'Alter Anker ohne Strich bleibt ein Bild');
  const ohneListen = { fach: 'X', thema: 'Y', karten: [{ frage: 'a', antwort: 'b' }] };
  ok(mergeTopic(ohneListen, t).topic.rechnen.length === 1 && mergeTopic(t, ohneListen).topic.luecken.length === 1, 'Zusammenführen mit alten Themen ohne neue Listen');
  ok(mergeTopic(Object.assign({ zukunft: [{ x: 1 }] }, ohneListen), ohneListen).topic.zukunft.length === 1, 'Unbekannte Listen bleiben beim Zusammenführen erhalten');
}
console.log(`\n${pass} bestanden, ${fail} fehlgeschlagen`);
process.exit(fail ? 1 : 0);
