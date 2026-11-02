// Ausführen mit: node tests/abgleich.test.mjs
// Prüft das Zusammenführen zweier Gerätestände (iPhone und iPad) für den Abgleich über GitHub.
import { zusammenfuehren, planZusammen } from '../js/abgleich.js';
import { emptyTopic } from '../js/parser.js';

let pass = 0, fail = 0;
const ok = (cond, name, extra) => { if (cond) pass++; else { fail++; console.log('FEHLER:', name, extra !== undefined ? JSON.stringify(extra) : ''); } };

const plan = (faecher, t = 0) => ({ baseVersion: 5, module: [{ id: 'M2', name: 'M2' }], faecher });
const fach = (id, themen, angelegt) => Object.assign({ id, name: id, themen: themen.map(x => (typeof x === 'string' ? { id: x, name: x } : x)) }, angelegt ? { angelegt } : {});
const stand = (o = {}) => Object.assign({ app: 'Lernwerk Techniker', format: 1, kv: {}, content: [], notes: [], cards: [], errors: [], events: [], exams: [] }, o);
const karte = (id, stufe, zeit, extra = {}) => Object.assign({ id, stufe, richtig: stufe, hilfe: 0, falsch: 0, zuletzt: '2026-11-01', faellig: '2026-11-05', zeit }, extra);

// 1. Beide Geräte offline gelernt: beide Fortschritte bleiben
{
  const L = stand({ cards: [karte('k:a', 2, 100), karte('k:b', 1, 100)], events: [{ id: 'e1', zeit: 100, ok: true }] });
  const F = stand({ cards: [karte('k:b', 3, 200), karte('k:c', 1, 150)], events: [{ id: 'e2', zeit: 150, ok: false }] });
  const r = zusammenfuehren(L, F);
  const c = id => r.daten.cards.find(x => x.id === id);
  ok(c('k:a') && c('k:c'), 'Karten von beiden Geräten');
  ok(c('k:b').stufe === 3, 'neuere Wiederholung gewinnt', c('k:b'));
  ok(r.daten.events.length === 2, 'Events vereinigt');
  ok(r.vonFern && r.vonLokal, 'beide Seiten haben etwas beigetragen', [r.vonFern, r.vonLokal]);
}
// 2. Gleicher Stand: nichts zu tun
{
  const L = stand({ cards: [karte('k:a', 2, 100)], kv: { kvZeit: { x: 1 }, x: 5 } });
  const r = zusammenfuehren(L, JSON.parse(JSON.stringify(L)));
  ok(!r.vonFern && !r.vonLokal, 'gleicher Stand ohne Änderung', [r.vonFern, r.vonLokal]);
}
// 3. Gelöschtes Fach kommt nicht zurück, neu angelegtes Fach auf dem anderen Gerät bleibt
{
  const L = stand({ kv: { lehrplan: plan([fach('mathe', ['t1'])]), kvZeit: { lehrplan: 300 }, geloescht: { 'fach:et': 250 } } });
  const F = stand({ kv: { lehrplan: plan([fach('mathe', ['t1', 't2']), fach('et', ['e1']), fach('neu', ['n1'], 400)]), kvZeit: { lehrplan: 200 } } });
  const p = zusammenfuehren(L, F).daten.kv.lehrplan;
  ok(!p.faecher.some(f => f.id === 'et'), 'gelöschtes Fach bleibt weg', p.faecher.map(f => f.id));
  ok(p.faecher.some(f => f.id === 'neu'), 'neues Fach vom anderen Gerät kommt dazu');
  ok(p.faecher.find(f => f.id === 'mathe').themen.some(t => t.id === 't2'), 'neues Thema vom anderen Gerät kommt dazu');
  // Gleicher Name später wieder angelegt: das neue bleibt
  const p2 = planZusammen(plan([fach('et', [], 500)]), plan([]), 600, 100, { 'fach:et': 250 });
  ok(p2.faecher.some(f => f.id === 'et'), 'nach dem Löschen neu angelegtes Fach bleibt');
  // Gelöschtes Thema
  const p3 = planZusammen(plan([fach('mathe', ['t1'])]), plan([fach('mathe', ['t1', 't9'])]), 300, 200, { 'thema:t9': 250 });
  ok(!p3.faecher[0].themen.some(t => t.id === 't9'), 'gelöschtes Thema bleibt weg');
}
// 4. Gelöschter Lernzettel und Termin tauchen nicht wieder auf
{
  const L = stand({ kv: { geloescht: { 'notes:n1': 500, 'exams:x1': 500 } } });
  const F = stand({ notes: [{ id: 'n1', zeit: 100, text: 'alt' }, { id: 'n2', zeit: 100, text: 'bleibt' }], exams: [{ id: 'x1', datum: '2026-11-20', geaendert: 100 }] });
  const d = zusammenfuehren(L, F).daten;
  ok(d.notes.length === 1 && d.notes[0].id === 'n2', 'gelöschter Lernzettel bleibt weg', d.notes);
  ok(!d.exams.length, 'gelöschter Termin bleibt weg');
  ok(d.kv.geloescht['notes:n1'] === 500, 'Löschmarke wandert mit');
}
// 5. Schlüssel-Wert-Daten: neuere Änderung gewinnt, Gerätedaten bleiben
{
  const L = stand({ kv: { notenschluessel: [90, 80, 70, 50, 30], zuletzt: { tid: 'a' }, kvZeit: { notenschluessel: 100 } } });
  const F = stand({ kv: { notenschluessel: [92, 81, 67, 50, 30], zuletzt: { tid: 'b' }, kvZeit: { notenschluessel: 200 } } });
  const kv = zusammenfuehren(L, F).daten.kv;
  ok(kv.notenschluessel[0] === 92, 'neuerer Notenschlüssel gewinnt');
  ok(kv.zuletzt.tid === 'a', 'Weiter, wo du warst bleibt pro Gerät');
}
// 6. Status pro Thema: beide Geräte haben verschiedene Themen umgestellt
{
  const L = stand({ kv: { aktuell: ['a'], abgeschlossen: [], zustandZeit: { a: 100 } } });
  const F = stand({ kv: { aktuell: ['b'], abgeschlossen: ['a'], zustandZeit: { b: 200, a: 50 } } });
  const kv = zusammenfuehren(L, F).daten.kv;
  ok(kv.aktuell.includes('a') && kv.aktuell.includes('b') && !kv.abgeschlossen.includes('a'), 'Status pro Thema abgeglichen', kv);
}
// 7. Inhalte desselben Themas von beiden Geräten werden zusammengelegt
{
  const tA = Object.assign(emptyTopic('Mathe', 'T'), { karten: [{ frage: 'A?', antwort: 'a' }] });
  const tB = Object.assign(emptyTopic('Mathe', 'T'), { karten: [{ frage: 'B?', antwort: 'b' }] });
  const d = zusammenfuehren(stand({ content: [{ id: 't', topic: tA, zeit: 100 }] }), stand({ content: [{ id: 't', topic: tB, zeit: 200 }] })).daten;
  ok(d.content[0].topic.karten.length === 2, 'Inhalte beider Geräte im Thema', d.content[0].topic.karten);
}
// 8. Alte Sicherung ohne Zeitstempel bleibt nutzbar
{
  const alt = stand({ kv: { aktuell: ['x'], lehrplan: plan([fach('mathe', ['t1'])]) }, cards: [{ id: 'k:a', stufe: 2, zuletzt: '2026-10-01' }] });
  const neu = stand({ cards: [karte('k:a', 1, Date.parse('2026-11-01T10:00:00'))] });
  const d = zusammenfuehren(neu, alt).daten;
  ok(d.cards[0].stufe === 1, 'neuere Karte schlägt alte ohne Zeitstempel');
  ok(d.kv.aktuell.includes('x') && d.kv.lehrplan.faecher.length === 1, 'alte Daten kommen an', d.kv);
}
// 9. Fehlerbuch: geänderter Fehler gewinnt, keine Doppelten
{
  const L = stand({ errors: [{ id: 'f1', zeit: 100, erledigt: true, geaendert: 300 }] });
  const F = stand({ errors: [{ id: 'f1', zeit: 100 }, { id: 'f2', zeit: 200 }] });
  const d = zusammenfuehren(L, F).daten;
  ok(d.errors.length === 2 && d.errors.find(e => e.id === 'f1').erledigt, 'Fehlerbuch ohne Doppelte, erledigt bleibt');
}
// 10. Kein Stand auf GitHub: einfach hochladen
{
  const r = zusammenfuehren(stand(), null);
  ok(r.vonLokal && !r.vonFern, 'ohne Stand auf GitHub nur hochladen');
}

// 11. Nach einem Abgleich ist der nächste ruhig, auch wenn das andere Gerät nur „Weiter, wo du warst“ geändert hat
{
  const t = Object.assign(emptyTopic('Mathe', 'T'), { karten: [{ frage: 'A?', antwort: 'a' }] });
  const L = stand({ kv: { zuletzt: { tid: 'a' }, kvZeit: { zuletzt: 100 } }, content: [{ id: 't', topic: t, zeit: 0 }] });
  const F = stand({ kv: { zuletzt: { tid: 'b' }, kvZeit: { zuletzt: 900 } }, content: [{ id: 't', topic: JSON.parse(JSON.stringify(t)), zeit: 0 }] });
  const r = zusammenfuehren(L, F);
  ok(!r.vonFern, 'Gerätedaten des anderen Geräts lösen keine Übernahme aus', r);
}

// 12. Auf einem Gerät ersetzter Inhalt: die alte Fassung vom anderen Gerät kommt nicht wieder dazu
{
  const falsch = Object.assign(emptyTopic('Werkstofftechnik', 'T'), { karten: [{ frage: 'Falsch?', antwort: 'falsch' }] });
  const richtig = Object.assign(emptyTopic('Werkstofftechnik', 'T'), { karten: [{ frage: 'Richtig?', antwort: 'richtig' }] });
  const d = zusammenfuehren(stand({ content: [{ id: 't', topic: richtig, zeit: 500, ersetzt: 500 }] }), stand({ content: [{ id: 't', topic: falsch, zeit: 100 }] })).daten;
  ok(d.content[0].topic.karten.length === 1 && d.content[0].topic.karten[0].frage === 'Richtig?', 'ersetzter Inhalt bleibt ersetzt', d.content[0].topic.karten);
  const d2 = zusammenfuehren(stand({ content: [{ id: 't', topic: falsch, zeit: 100 }] }), stand({ content: [{ id: 't', topic: richtig, zeit: 500, ersetzt: 500 }] })).daten;
  ok(d2.content[0].topic.karten[0].frage === 'Richtig?' && d2.content[0].topic.karten.length === 1, 'auch in der anderen Richtung');
}

console.log(`\n${pass} bestanden, ${fail} fehlgeschlagen`);
process.exit(fail ? 1 : 0);
