// Speicher und Lernrunden: Start, Einfügen, Karten, Runden, Sicherung laden, alte Sicherungen.
// Läuft ohne Browser: js/db.js fällt ohne IndexedDB auf einen Speicher im Arbeitsspeicher zurück.
// Ausführen mit: node tests/speicher.test.mjs
import fs from 'node:fs';

// Die App lädt lehrplan.json und die Inhalte über fetch. Hier kommen sie von der Platte.
globalThis.fetch = async url => {
  try { const t = fs.readFileSync(new URL('../' + String(url), import.meta.url), 'utf8'); return { ok: true, text: async () => t, json: async () => JSON.parse(t) }; }
  catch (e) { return { ok: false, status: 404, text: async () => '' }; }
};
const st = await import('../js/store.js');
const { parseBlocks } = await import('../js/parser.js');
const { zusammenfuehren } = await import('../js/abgleich.js');
const { dayStr, addDays } = await import('../js/util.js');

let pass = 0, fail = 0;
const ok = (cond, name, extra) => { if (cond) pass++; else { fail++; console.log('FEHLER:', name, extra !== undefined ? JSON.stringify(extra) : ''); } };

await st.init();
ok(st.faecher().length >= 16, 'Lehrplan geladen', st.faecher().length);
ok(st.hasTopicContent('et-ohmsches-gesetz'), 'eingebaute Inhalte geladen');
ok(st.kartenArt() === 'aufdecken', 'Karten: Aufdecken ist die Vorgabe');

// Einfügen
const block = `=== LERNWERK ===
Fach: Werkstoffkunde
Thema: Gießverfahren
Karte: Was ist Sandguss? | Gießen in eine verlorene Form aus Formsand.
Karte: Was ist Kokillenguss? | Gießen in eine Dauerform aus Metall.
Begriff: Lunker | Hohlraum durch Schwindung beim Erstarren.
Stufe: 3
Erklären: Erkläre den Feinguss. | Wachsmodell; Keramikschale; ausschmelzen; gießen
Skizze: Skizziere eine Sandform. | Einguss; Speiser
Zeichnung: Form | <svg viewBox="0 0 10 10"><rect width="10" height="10"/></svg>
=== ENDE ===`;
const r = parseBlocks(block);
ok(!r.fehler.length && r.themen.length === 1, 'Block gelesen', r.fehler);
const out = await st.saveBlocks(r.themen.map(t => ({ topic: t, fachId: '', themaId: '' })));
const tid = out[0].thema.id;
ok(out[0].fach.id === 'ws', 'Werkstoffkunde landet bei Werkstofftechnik', out[0].fach.id);
const items = st.topicItems(tid);
ok(items.filter(i => i.art === 'karte').length === 2 && items.some(i => i.art === 'begriff'), 'Karten und Begriff als Übungen');
ok(items.some(i => i.art === 'erklaeren') && items.some(i => i.art === 'skizze'), 'Erklären und Skizze sind Übungen', items.map(i => i.art));
ok(items.every(i => i.eigen && st.sichtbar(i)), 'eigene Inhalte sind immer frei');
ok(st.pruefItems(tid).find(i => i.art === 'erklaeren').id === items.find(i => i.art === 'erklaeren').id, 'Erklären: gleiche Kennung in Runde und Probeklausur');

// Karten und Wiederholung
const k = items.find(i => i.art === 'karte');
await st.recordCard(k, 'richtig');
ok(st.card(k.id).stufe === 1 && st.card(k.id).faellig > dayStr(), 'richtig: Stufe 1, morgen oder später wieder', st.card(k.id));
await st.recordCard(k, 'falsch');
ok(st.card(k.id).stufe === 1 && st.card(k.id).falsch === 1, 'falsch auf Stufe 1 bleibt bei 1');
await st.setZustand(tid, 'aktuell');
const q = st.buildQueue(900, { tids: [tid] });
ok(q.items.length >= 3 && q.items.every(i => i.tid === tid), 'Runde aus dem Thema', q.items.length);
ok(!q.items.some(i => i.id === k.id), 'gerade geübte Karte ist heute nicht mehr fällig');

// Termin, Fehler, Lernzettel
const ex = await st.addExam({ fachId: 'ws', datum: addDays(dayStr(), 5), themaIds: [tid] });
ok(st.nextExam().id === ex.id && st.bereitschaft(ex) != null, 'Klassenarbeit und Prüfungsbereitschaft');
const fe = await st.addError({ tid, aufgabe: 'Testaufgabe', eingabe: '1', richtig: '2', fehlerart: 'Vorzeichen' });
const no = await st.saveNote({ tid, titel: 'Zettel', text: 'Text' });
await st.kvSet('umstellFrei', true);

// Sicherung: erstellen, Stand verändern, laden, alles wieder da
const sich = JSON.parse(JSON.stringify(await st.exportBackup(false)));
ok(sich.format === 1 && sich.cards.length >= 1 && sich.content.length === 1 && sich.bloecke.includes('Gießverfahren'), 'Sicherung enthält Karten, Inhalte und Blöcke');
await st.deleteError(fe.id); await st.deleteNote(no.id); await st.deleteExam(ex.id); await st.recordCard(k, 'richtig');
await st.importBackup(sich);
await st.init();
ok(st.S.errors.some(e => e.id === fe.id) && st.S.notes.some(n => n.id === no.id) && st.S.exams.some(e => e.id === ex.id), 'nach dem Laden: Fehler, Lernzettel und Termin wieder da');
ok(st.card(k.id).falsch === 1 && st.card(k.id).richtig === 1, 'nach dem Laden: Kartenstand wie in der Sicherung', st.card(k.id));
ok(st.zustand(tid) === 'aktuell' && st.kvGet('umstellFrei') === true, 'nach dem Laden: Status und Einstellungen');
ok(st.topic(tid).zeichnungen.length === 1 && st.topicItems(tid).length === items.length, 'nach dem Laden: Inhalte und Zeichnung');

// Alte Sicherung (vor Abgleich, Stufen, Zeichnungen): muss weiter geladen werden können
const altTid = 'et-ohmsches-gesetz';
const alt = {
  app: 'Lernwerk Techniker', format: 1, erstellt: '2026-10-25T10:00:00.000Z',
  kv: { ersterStart: '2026-10-22', aktuell: [altTid], abgeschlossen: [], planErledigt: { e1: ['2026-10-24'] }, letzteSicherung: '2026-10-25' },
  content: [{ id: altTid, topic: { fach: 'Elektrotechnik', thema: 'Ohmsches Gesetz', modul: '', anker: [], begriffe: [], merksaetze: ['Eigener Merksatz aus dem Oktober.'], prinzip: [], bausteine: [], schnellwege: [], fehler: [], formeln: [], karten: [{ frage: 'Eigene alte Frage?', antwort: 'Eigene alte Antwort.' }], aufgaben: [], umstellen: [], auswahl: [], reihenfolgen: [], podcast: [], quellen: [], notizen: [] } }],
  notes: [{ id: 'n1', tid: altTid, titel: 'Alter Zettel', text: 'Text', zeit: 1 }],
  cards: [{ id: 't:' + altTid, tid: altTid, art: 'trainer', stufe: 3, richtig: 3, hilfe: 0, falsch: 0, zuletzt: '2026-10-24', faellig: '2026-10-28' }],
  errors: [{ id: 'f1', zeit: 2, tid: altTid, fach: 'Elektrotechnik', thema: 'Ohmsches Gesetz', aufgabe: 'Alt', eingabe: '', richtig: '', fehlerart: 'Vorzeichen', quelle: 'app', notiz: '' }],
  events: [{ id: 'e1', zeit: 3, art: 'karte', tid: altTid, ok: true, ergebnis: 'richtig' }],
  exams: [{ id: 'e1', fachId: 'et', fach: 'Elektrotechnik', datum: '2026-09-29', themen: 'Ohm', themaIds: [altTid] }], photos: []
};
await st.importBackup(alt);
await st.init();
ok(st.zustand(altTid) === 'aktuell', 'alte Sicherung: Status');
ok(st.topic(altTid).merksaetze.includes('Eigener Merksatz aus dem Oktober.') && st.topic(altTid).karten.some(c => c.frage === 'Eigene alte Frage?'), 'alte Sicherung: eigene Inhalte, auch ohne die neuen Listen');
ok(st.topicItems(altTid).some(i => i.eigen && i.art === 'karte'), 'alte Sicherung: eigene Karte ist eine Übung');
ok(st.card('t:' + altTid).stufe === 3, 'alte Sicherung: Kartenstand ohne Zeitstempel');
ok(st.S.notes.length === 1 && st.S.errors.length === 1 && st.S.exams.length === 1 && st.S.events.length === 1, 'alte Sicherung: Lernzettel, Fehler, Termin, Ereignis');
ok(st.planErledigt({ id: 'e1' })['2026-10-24'] === '2026-10-24', 'alte Sicherung: erledigte Plantage im alten Format');
ok(st.freigabe(altTid) === 3, 'alte Sicherung: Thema mit Trainer-Fortschritt behält alle Stufen', st.freigabe(altTid));

// Abgleich: alter Stand (Gerät) und neuer Stand (GitHub) zusammen, nichts geht verloren
const neuerStand = JSON.parse(JSON.stringify(sich));
const m = zusammenfuehren(JSON.parse(JSON.stringify(await st.exportBackup(false))), neuerStand);
ok(m.daten.content.some(c => c.id === altTid) && m.daten.content.some(c => c.id === tid), 'Abgleich: Inhalte beider Seiten');
ok(m.daten.cards.some(c => c.id === 't:' + altTid) && m.daten.cards.some(c => c.id === k.id), 'Abgleich: Karten beider Seiten');
ok(m.daten.kv.aktuell.includes(altTid) && m.daten.kv.aktuell.includes(tid), 'Abgleich: Status beider Seiten');
ok(m.daten.kv.kartenArt === undefined || m.daten.kv.kartenArt === 'aufdecken', 'Abgleich: neue Einstellungen stören alte Stände nicht');

console.log('\n' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
