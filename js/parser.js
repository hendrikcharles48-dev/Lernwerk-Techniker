// Liest Lernwerk-Blöcke aus Text (zum Beispiel aus dem Claude-Chat) und schreibt sie wieder zurück.
// Eingebaute Inhalte unter inhalte/ nutzen dasselbe Format.
import { norm, toDay } from './util.js';
import { parseEq, parseExpr, evaluate, varsOf } from './formula.js';
import { readNumber } from './check.js';
import { bereinigen, istSvg } from './svg.js';
import { rechenweg } from './rechenweg.js';

const KEYS = {
  fach: 'fach', thema: 'thema', modul: 'modul',
  anker: 'anker', bild: 'anker',
  begriff: 'begriff', begriffe: 'begriff', fachbegriff: 'begriff', fachbegriffe: 'begriff',
  merksatz: 'merksatz', merksaetze: 'merksatz', merksatze: 'merksatz', eselsbruecke: 'merksatz', merke: 'merksatz',
  prinzip: 'prinzip',
  baustein: 'baustein', bausteine: 'baustein', loesungsbaustein: 'baustein',
  schnellweg: 'schnellweg', schnellwege: 'schnellweg',
  fehler: 'fehler', typischerfehler: 'fehler',
  formel: 'formel', formeln: 'formel', aufbau: 'aufbau', formelaufbau: 'aufbau',
  karte: 'karte', karten: 'karte',
  aufgabe: 'aufgabe', aufgaben: 'aufgabe',
  gegeben: 'gegeben', gesucht: 'gesucht',
  schritt: 'schritt', schritte: 'schritt',
  ergebnis: 'ergebnis',
  variable: 'variable', variablen: 'variable',
  rechnung: 'rechnung',
  termin: 'termin', termine: 'termin',
  // Stand im Unterricht setzen: Unterricht: Fach | Thema; Thema  und  Abgeschlossen: Fach | Thema; Thema
  unterricht: 'unterricht', imunterricht: 'unterricht', aktuell: 'unterricht', abgeschlossen: 'abgeschlossen', fertig: 'abgeschlossen',
  tipp: 'tipp',
  // Erweiterungen für eingebaute Trainer
  umstellen: 'umstellen', umformung: 'umformung', auswahl: 'auswahl', reihenfolge: 'reihenfolge', quelle: 'quelle',
  // Ansatz zuerst: Aufgabe erkennen, begründen, Ergebnis prüfen
  // Hörmodus: eigenes Podcast-Skript, eine Person erklärt der anderen
  podcast: 'podcast',
  // Stufen, Prüfzeile und weitere Fragearten
  stufe: 'stufe', inhalt: 'inhalt',
  verwechslung: 'verwechslung', verwechslungen: 'verwechslung', zuordnen: 'zuordnen', zuordnung: 'zuordnen',
  erklaeren: 'erklaeren', erklaere: 'erklaeren', skizze: 'skizze', skizzen: 'skizze',
  // Fertige Zeichnung als SVG: Zeichnung: Titel | <svg …>…</svg>
  zeichnung: 'zeichnung', zeichnungen: 'zeichnung', svg: 'zeichnung',
  // Rückmeldung zu einer falschen Antwort und Fälle mit Schrittfragen (wie in den Trainern aus dem Chat)
  falsch: 'falsch', warumfalsch: 'falsch', fall: 'fall', faelle: 'fall', gleichung: 'gleichung', schrittfrage: 'schrittfrage', frage: 'schrittfrage',
  ansatz: 'ansatz', signal: 'signal', erkennen: 'signal', warum: 'warum', begruendung: 'warum', kontrolle: 'kontrolle', probe: 'kontrolle',
  // Aufgabenarten nach Lernart (Stufe 1 Verstehen, 2 Abläufe, 3 Rechnen)
  luecke: 'luecke', lueckentext: 'luecke', warumfrage: 'warumfrage', fallbeispiel: 'fallbeispiel', beispielfall: 'fallbeispiel',
  rechnen: 'rechnen', rechenweg: 'rechnen', bereich: 'bereich', ergebnisbereich: 'bereich',
  tabelle: 'tabelle', zeile: 'zeile', grundprinzip: 'grundprinzip'
};
const keyNorm = s => String(s).toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z]/g, '');

const START = /^=*\s*lernwerk(?:[\s-]*block)?\s*=*$/i;
const END = /^=*\s*ende\s*=*$/i;

export function emptyTopic(fach = '', thema = '') {
  return {
    fach, thema, modul: '',
    anker: [], begriffe: [], merksaetze: [], prinzip: [], bausteine: [], schnellwege: [], fehler: [],
    formeln: [], karten: [], aufgaben: [], umstellen: [], auswahl: [], reihenfolgen: [], podcast: [], quellen: [], notizen: [],
    verwechslungen: [], zuordnen: [], erklaeren: [], skizzen: [], zeichnungen: [], faelle: [],
    luecken: [], warumfragen: [], fallbeispiele: [], rechnen: [], tabellen: [], ankerkarten: [], grundprinzipien: []
  };
}
const LISTS = ['anker', 'begriffe', 'merksaetze', 'prinzip', 'bausteine', 'schnellwege', 'fehler', 'formeln', 'karten', 'aufgaben', 'umstellen', 'auswahl', 'reihenfolgen', 'podcast', 'quellen', 'notizen', 'verwechslungen', 'zuordnen', 'erklaeren', 'skizzen', 'zeichnungen', 'faelle',
  'luecken', 'warumfragen', 'fallbeispiele', 'rechnen', 'tabellen', 'ankerkarten', 'grundprinzipien'];
// Neue Aufgabenarten: Der Block legt die Stufe fest. Ohne Stufe-Zeile gilt diese Vorgabe.
export const NEUE_STUFE = { luecken: 1, ankerkarten: 1, warumfragen: 2, fallbeispiele: 2, rechnen: 3 };

// Prüfzeile „Inhalt: 6 Karten; 2 Aufgaben“: welches Wort zu welcher Liste gehört
const INHALT = [
  [/^karte/, 'karten', 'Karten'], [/^aufgabe/, 'aufgaben', 'Aufgaben'], [/^(fach)?begriff/, 'begriffe', 'Begriffe'], [/^formel/, 'formeln', 'Formeln'],
  [/^merks/, 'merksaetze', 'Merksätze'], [/^baustein/, 'bausteine', 'Bausteine'], [/^(typische)?fehler/, 'fehler', 'Fehler'], [/^schnellweg/, 'schnellwege', 'Schnellwege'],
  [/^auswahl/, 'auswahl', 'Auswahlfragen'], [/^reihenfolge/, 'reihenfolgen', 'Reihenfolgen'], [/^umstell/, 'umstellen', 'Umstellaufgaben'], [/^verwechslung/, 'verwechslungen', 'Verwechslungen'],
  [/^zuordn/, 'zuordnen', 'Zuordnungen'], [/^erklaer/, 'erklaeren', 'Erklär-Aufgaben'], [/^skizze/, 'skizzen', 'Skizzen'], [/^(zeichnung|svg)/, 'zeichnungen', 'Zeichnungen'], [/^(anker|bild)/, 'anker', 'Bilder'], [/^podcast/, 'podcast', 'Podcast-Zeilen'], [/^(fallbeispiel|beispielfall)/, 'fallbeispiele', 'Fallbeispiele'], [/^(fall|faelle)/, 'faelle', 'Fälle'],
  [/^luecke/, 'luecken', 'Lückentexte'], [/^warum/, 'warumfragen', 'Warum-Fragen'], [/^(rechnen|rechenweg|rechenaufgabe)/, 'rechnen', 'Rechenwege'], [/^tabelle/, 'tabellen', 'Tabellen']
];
export function readInhalt(val) {
  const out = [];
  for (const teil of splitList(String(val).replace(/,/g, ';'))) {
    const m = /^(\d+)\s*(.+)$/.exec(teil.trim());
    if (!m) continue;
    const w = keyNorm(m[2]);
    const hit = INHALT.find(x => x[0].test(w));
    if (hit) out.push({ liste: hit[1], name: hit[2], soll: +m[1] });
  }
  return out;
}
export const hasContent = t => LISTS.some(k => t[k] && t[k].length);

// Für die Schlüsselerkennung: Markdown-Reste vorne entfernen
function cleanLine(raw) {
  return raw.replace(/\t/g, ' ').replace(/`/g, '').trim()
    .replace(/^(?:>\s*)+/, '')
    .replace(/^#{1,6}\s+/, '')
    .replace(/^(?:[-*•+]|\d{1,2}[.)])\s+/, '')
    .trim();
}
const KEYLINE = /^(?:\*\*|__)?([A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß \-]{0,24}?)(?:\*\*|__)?\s*:(?:\*\*|__)?\s*(.*)$/;
const stripMd = v => v.replace(/^(\*\*|__)+|(\*\*|__)+$/g, '').trim();
const pipes = v => v.split('|').map(s => s.trim());

// Ergebnis-Wert: Zahl, Ausdruck mit Variablen oder Gleichung
export function readValue(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  if (s.includes('=')) { try { parseEq(s); return { typ: 'gleichung', text: s }; } catch (e) { return { typ: 'text', text: s }; } }
  const n = readNumber(s);
  if (!n.error && !n.empty && !n.unit) return { typ: 'zahl', zahl: n.value, text: s };
  if (!n.error && !n.empty && /^[A-Za-zäöüµμΩ°%²³/]+$/.test(n.unit)) return { typ: 'zahl', zahl: n.value, einheit: n.unit, text: s };
  try { const e = parseExpr(s); return { typ: varsOf(e).size ? 'ausdruck' : 'zahl', zahl: varsOf(e).size ? null : evaluate(e), text: s }; } catch (e) { /* weiter */ }
  if (!n.error && !n.empty) return { typ: 'zahl', zahl: n.value, einheit: n.unit, text: s };
  return { typ: 'text', text: s };
}

/*
 * Rückgabe: { themen: [...], termine: [...], fehler: [{zeile, text, meldung}], hinweise: [...] }
 */
export function parseBlocks(text) {
  const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
  const res = { themen: [], termine: [], stand: [], fehler: [], hinweise: [], luecken: [], abgeschnitten: false };
  const hasMarkers = lines.some(l => START.test(cleanLine(l)));
  let inBlock = !hasMarkers;
  let cur = null, field = null, task = null, umst = null, ctx = null, blockLine = 0, stufe = 0, inhalt = null, lastMc = null, fall = null, ziel = null, tab = null;
  // Stufe-Zeile: alle folgenden Einträge gehören zu dieser Stufe
  const mark = o => { if (stufe) o.stufe = stufe; return o; };
  // Zeichnung, Tabelle und Grundprinzip direkt unter einer neuen Aufgabe gehören zu dieser Aufgabe
  const zielSetzen = o => { ziel = o; return o; };

  const err = (i, meldung) => res.fehler.push({ zeile: i + 1, text: lines[i].trim(), meldung });
  const warn = (i, meldung) => res.hinweise.push({ zeile: i + 1, text: lines[i].trim(), meldung });

  function finish() {
    if (!cur) return;
    const t = cur, soll = inhalt;
    cur = null; field = null; task = null; umst = null; ctx = null; stufe = 0; inhalt = null; lastMc = null; fall = null; ziel = null; tab = null;
    // leere Einträge entfernen
    for (const k of ['anker', 'merksaetze', 'prinzip', 'bausteine', 'schnellwege', 'quellen']) t[k] = t[k].map(s => s.trim()).filter(Boolean);
    t.karten = t.karten.filter(k => k.frage && k.antwort);
    t.begriffe = t.begriffe.filter(b => b.begriff);
    t.faelle = t.faelle.filter(f => f.schritte.length);
    t.tabellen = t.tabellen.filter(x => x.zeilen.length);
    for (const a of t.rechnen) {
      // Probe: Lässt sich der Weg mit gewürfelten Zahlen ausrechnen? Ohne Rechnung-Zeile zählt der letzte Schritt.
      if (a.schritte.length >= 2) {
        const probe = rechenweg(a);
        if (probe.final.wert == null || !isFinite(probe.final.wert)) res.fehler.push({ zeile: a._z, text: a.text.slice(0, 60), meldung: 'Den Rechenweg kann ich nicht ausrechnen. Prüfe, ob jeder Schritt nur Variablen und Ergebnisse früherer Schritte benutzt.' });
        else if (a.bereich && !probe.imBereich) res.hinweise.push({ zeile: a._z, text: a.text.slice(0, 60), meldung: 'Mit diesen Wertebereichen liegt das Ergebnis selten im Bereich. Prüfe Variable- und Bereich-Zeilen.' });
      }
      if (a.schritte.length < 2) res.fehler.push({ zeile: a._z, text: a.text.slice(0, 60), meldung: 'Ein Rechenweg braucht mindestens zwei Schritt-Zeilen: was | Rechnung | Einheit | Sinn.' });
      else if (a.schritte.length > 7) res.hinweise.push({ zeile: a._z, text: a.text.slice(0, 60), meldung: 'Mehr als sieben Bausteine sind am Handy schwer zu sortieren. Fasse Schritte zusammen.' });
      if (!a.variablen.length) res.hinweise.push({ zeile: a._z, text: a.text.slice(0, 60), meldung: 'Rechenweg ohne Variable-Zeilen: Die Zahlen bleiben jedes Mal gleich.' });
    }
    t.rechnen = t.rechnen.filter(a => a.schritte.length >= 2);
    for (const a of [...t.aufgaben, ...t.rechnen]) {
      a.text = a.text.trim();
      if (a.weg) { if (a.rechnung && rechenweg(a).final.wert == null) { res.fehler.push({ zeile: a._r || a._z, text: a.rechnung, meldung: 'Die Rechnung kann ich nicht ausrechnen.' }); a.rechnung = ''; } delete a._z; delete a._r; continue; }
      if (a.variablen.length && !a.rechnung) res.hinweise.push({ zeile: a._z, text: a.text.slice(0, 60), meldung: 'Aufgabe hat Variablen, aber keine Rechnung. Ich nutze die festen Zahlen.' });
      if (a.rechnung) {
        const vals = Object.fromEntries(a.variablen.map(v => [v.name.replace(/_/g, ''), v.von]));
        try { evaluate(parseEq(a.rechnung).r, vals); } catch (e) {
          res.fehler.push({ zeile: a._r || a._z, text: a.rechnung, meldung: 'Die Rechnung kann ich nicht ausrechnen: ' + e.message });
          a.rechnung = '';
        }
      }
      delete a._z; delete a._r;
    }
    if (!t.fach && !t.thema && !hasContent(t)) return;
    if (!t.fach || !t.thema) {
      if (!hasContent(t)) return; // reiner Termin-Block
      res.fehler.push({ zeile: blockLine + 1, text: lines[blockLine] ? lines[blockLine].trim() : '', meldung: 'Block ab Zeile ' + (blockLine + 1) + ': ' + (!t.fach ? 'Fach' : 'Thema') + ' fehlt. Ohne ' + (!t.fach ? 'Fach' : 'Thema') + ' kann ich den Block nicht einsortieren.' });
      return;
    }
    // Prüfzeile: Ist alles angekommen, was der Block verspricht?
    if (soll) for (const x of soll) { const ist = (t[x.liste] || []).length; if (ist < x.soll) res.luecken.push({ thema: t.thema, name: x.name, soll: x.soll, ist }); }
    res.themen.push(t);
  }
  function start(i) { finish(); cur = emptyTopic(); blockLine = i; }
  function ensureTask(i) {
    if (!task) {
      warn(i, 'Diese Zeile gehört zu einer Aufgabe, aber davor steht keine Zeile „Aufgabe:“. Ich lege eine Aufgabe ohne Text an.');
      task = newTask(i, ''); cur.aufgaben.push(task);
    }
    ctx = 'aufgabe';
    return task;
  }
  const newTask = (i, text) => ({ text, gegeben: [], gesucht: [], schritte: [], ergebnis: null, variablen: [], rechnung: '', tipps: [], ansatz: null, signal: '', warum: null, kontrolle: null, _z: i + 1 });
  const setField = (obj, prop) => { field = { obj, prop }; };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const c = cleanLine(raw);
    if (/^```/.test(c)) continue;
    if (hasMarkers && START.test(c)) { start(i); inBlock = true; continue; }
    if (hasMarkers && END.test(c)) { finish(); inBlock = false; continue; }
    if (!inBlock) continue;
    if (!c) { if (field && field.prop === 'prinzipText') field.obj[field.idx] += '\n'; continue; }

    const m = KEYLINE.exec(c);
    let key = null, val = '', rawKey = '';
    if (m) {
      rawKey = m[1].trim();
      const k = KEYS[keyNorm(rawKey)];
      if (k) { key = k; val = stripMd(m[2]); }
      else if (!/\s/.test(rawKey) && /^[A-ZÄÖÜ]/.test(rawKey) && rawKey.length <= 20) { key = '?'; val = stripMd(m[2]); }
    }

    // Ohne Markierungen: erst ab der ersten Fach- oder Thema-Zeile lesen
    if (!cur) {
      if (key === 'fach' || key === 'thema' || key === 'termin' || key === 'unterricht' || key === 'abgeschlossen') start(i);
      else continue;
    }

    if (!key) {
      // Fortsetzungszeile: gehört zum vorherigen Feld
      const text = raw.replace(/`/g, '').trim();
      if (!field) { warn(i, 'Diese Zeile gehört zu keinem Feld und wird übersprungen.'); continue; }
      const o = field.obj, p = field.prop;
      if (Array.isArray(o)) o[field.idx] = (o[field.idx] ? o[field.idx] + '\n' : '') + text;
      else o[p] = (o[p] ? o[p] + '\n' : '') + text;
      continue;
    }

    if (!['zeichnung', 'tabelle', 'zeile', 'grundprinzip', 'falsch', 'gegeben', 'gesucht', 'tipp', 'schritt', 'ergebnis', 'variable', 'rechnung', 'bereich', 'luecke', 'warumfrage', 'fallbeispiel', 'rechnen'].includes(key)) ziel = null;
    if (key !== 'zeile') tab = key === 'tabelle' ? tab : null;
    switch (key) {
      case 'fach':
        if (cur.fach && (cur.thema || hasContent(cur))) start(i);
        cur.fach = val; field = null; break;
      case 'thema':
        if (cur.thema && hasContent(cur)) { const f = cur.fach, mo = cur.modul; start(i); cur.fach = f; cur.modul = mo; }
        cur.thema = val; field = null; break;
      case 'modul': cur.modul = val.replace(/^\(?optional.*$/i, ''); field = null; break;
      case 'anker': if (val.includes('|')) {
        // Anker: Bild | Fachbegriff. Das Bild bleibt ein Anker, dazu kommt eine Karte, die den Anker abfragt.
        const [bild, ...b] = pipes(val);
        const begriff = b.join(' | ');
        if (bild && begriff) { cur.anker.push(bild); cur.ankerkarten.push(mark({ bild, begriff })); field = null; break; }
      }
      // fällt durch
      case 'merksatz': case 'baustein': case 'schnellweg': case 'quelle': case 'prinzip': {
        const prop = { anker: 'anker', merksatz: 'merksaetze', baustein: 'bausteine', schnellweg: 'schnellwege', quelle: 'quellen', prinzip: 'prinzip' }[key];
        cur[prop].push(val);
        field = { obj: cur[prop], idx: cur[prop].length - 1, prop: key === 'prinzip' ? 'prinzipText' : prop };
        break;
      }
      case 'stufe': {
        const n = parseInt(val, 10);
        if (!(n >= 1 && n <= 3)) { warn(i, 'Stufe bitte als 1, 2 oder 3 schreiben.'); break; }
        stufe = n; field = null; break;
      }
      case 'inhalt': inhalt = readInhalt(val); field = null; break;
      case 'begriff': {
        let [b, ...e] = pipes(val);
        let erk = e.join(' | ');
        if (!e.length) { const s = /^(.+?)\s+[–-]\s+(.+)$/.exec(val); if (s) { b = s[1]; erk = s[2]; } }
        const o = mark({ begriff: b, erklaerung: erk });
        cur.begriffe.push(o); setField(o, 'erklaerung');
        if (!erk) warn(i, 'Begriff ohne Erklärung. Trenne Begriff und Erklärung mit |.');
        break;
      }
      case 'fehler': {
        const [f, ...a] = pipes(val);
        const o = mark({ fehler: f, achtung: a.join(' | ') });
        cur.fehler.push(o); setField(o, 'achtung'); break;
      }
      case 'formel': {
        const p = pipes(val);
        let o;
        if (p.length === 1) o = { name: '', formel: p[0], umgestellt: [] };
        else if (p.length === 2 && p[0].includes('=') && p[1].includes('=')) o = { name: '', formel: p[0], umgestellt: splitList(p[1]) };
        else o = { name: p[0], formel: p[1], umgestellt: splitList(p.slice(2).join(';')) };
        try { parseEq(o.formel); } catch (e) { warn(i, 'Die Formel kann ich nicht als Rechnung lesen (' + e.message + '). Ich zeige sie als Text.'); }
        for (const u of o.umgestellt) { try { parseEq(u); } catch (e) { warn(i, 'Die Umstellung „' + u + '“ kann ich nicht lesen.'); } }
        cur.formeln.push(mark(o)); field = null; break;
      }
      // Aufbau: kurz erklären, warum die Formel davor so zusammengesetzt ist
      case 'aufbau': {
        const fo = cur.formeln[cur.formeln.length - 1];
        if (!fo) { warn(i, 'Aufbau gehört direkt unter eine Formel-Zeile.'); break; }
        fo.aufbau = val; setField(fo, 'aufbau'); break;
      }
      case 'karte': {
        const [f, ...a] = pipes(val);
        const o = mark({ frage: f, antwort: a.join(' | ') });
        if (!a.length) err(i, 'Bei dieser Karte fehlt die Antwort. Trenne Frage und Antwort mit einem senkrechten Strich |.');
        cur.karten.push(o); setField(o, 'antwort'); break;
      }
      case 'aufgabe':
        task = mark(newTask(i, val)); cur.aufgaben.push(task); umst = null; ctx = 'aufgabe'; setField(task, 'text'); break;
      case 'gegeben': case 'gesucht': {
        const t = ensureTask(i); t[key].push(val); field = { obj: t[key], idx: t[key].length - 1 }; break;
      }
      case 'tipp': {
        const target = ctx === 'umstellen' && umst ? umst : ensureTask(i);
        target.tipps.push(val); field = { obj: target.tipps, idx: target.tipps.length - 1 }; break;
      }
      case 'schritt': {
        const t = ensureTask(i);
        const [was, erg, einheit, tipp] = pipes(val);
        const s = { was: was || '', ergebnis: readValue(erg), einheit: einheit || '', tipp: tipp || '' };
        if (!erg && !t.weg) warn(i, 'Schritt ohne Ergebnis. Ich zeige ihn als Planungsschritt ohne Prüfung.');
        if (s.ergebnis && s.ergebnis.einheit && !s.einheit) s.einheit = s.ergebnis.einheit;
        t.schritte.push(s); field = null; break;
      }
      case 'ergebnis': {
        const t = ensureTask(i);
        const [z, einheit] = pipes(val);
        const v = readValue(z);
        if (!v) { err(i, 'Hier fehlt das Ergebnis.'); break; }
        t.ergebnis = { wert: v, einheit: einheit || v.einheit || '' };
        field = null; break;
      }
      case 'variable': {
        const t = ensureTask(i);
        const [name, von, bis, step, einheit] = pipes(val);
        const a = readNumber(von), b = readNumber(bis), s = step ? readNumber(step) : null;
        if (!name || a.error || a.empty || b.error || b.empty) { err(i, 'Variable bitte so schreiben: Name | von | bis | Schrittweite, zum Beispiel R | 100 | 1000 | 10.'); break; }
        let sw = s && !s.error && !s.empty ? s.value : 0;
        if (!(sw > 0)) sw = (b.value - a.value) / 10 || 1;
        const v = { name: name.replace(/\s/g, ''), von: Math.min(a.value, b.value), bis: Math.max(a.value, b.value), schritt: sw };
        if (einheit) v.einheit = einheit;
        t.variablen.push(v);
        field = null; break;
      }
      case 'rechnung': {
        const t = ensureTask(i);
        try { parseEq(val); t.rechnung = val; t._r = i + 1; } catch (e) { err(i, 'Die Rechnung kann ich nicht lesen: ' + e.message); }
        field = null; break;
      }
      case 'ansatz': case 'warum': {
        const t = ensureTask(i);
        const [richtig, falsch] = pipes(val);
        const f = splitList(falsch || '');
        if (!richtig || !f.length) { err(i, (key === 'ansatz' ? 'Ansatz' : 'Warum') + ' bitte so schreiben: richtige Antwort | falsch; falsch; falsch.'); break; }
        t[key] = { richtig, falsch: f }; lastMc = t[key]; field = null; break;
      }
      case 'signal': { const t = ensureTask(i); t.signal = val; setField(t, 'signal'); break; }
      case 'kontrolle': {
        const t = ensureTask(i);
        const [frage, richtig, falsch] = pipes(val);
        if (!frage || !richtig || !falsch) { err(i, 'Kontrolle bitte so schreiben: Frage | richtige Antwort | falsch; falsch.'); break; }
        t.kontrolle = { frage, richtig, falsch: splitList(falsch) }; lastMc = t.kontrolle; field = null; break;
      }
      case 'termin': {
        const p = pipes(val);
        let fach = cur.fach, datum = null, themen = '';
        const di = p.findIndex(x => toDay(x));
        if (di < 0) { err(i, 'Im Termin fehlt ein Datum. Schreib es als JJJJ-MM-TT, zum Beispiel 2026-11-24.'); break; }
        datum = toDay(p[di]);
        if (di > 0) fach = p.slice(0, di).join(' ');
        themen = p.slice(di + 1).join(', ');
        if (!fach) { err(i, 'Im Termin fehlt das Fach.'); break; }
        res.termine.push({ fach, datum, themen });
        field = null; break;
      }
      case 'unterricht': case 'abgeschlossen': {
        // Themen mit Semikolon trennen, weil Themennamen Kommas enthalten können
        const p = pipes(val);
        const fach = p.length > 1 ? p[0] : cur.fach;
        const themen = (p.length > 1 ? p.slice(1).join('|') : p[0] || '').split(';').map(s => s.trim()).filter(Boolean);
        if (!fach || !themen.length) { err(i, 'Bitte so schreiben: ' + (key === 'unterricht' ? 'Unterricht' : 'Abgeschlossen') + ': Fach | Thema; Thema'); break; }
        for (const thema of themen) res.stand.push({ zustand: key === 'unterricht' ? 'aktuell' : 'fertig', fach, thema });
        field = null; break;
      }
      case 'umstellen': {
        const [formel, nach, loesung] = pipes(val);
        if (!formel || !nach || !loesung) { err(i, 'Umstellen bitte so schreiben: Formel | nach welcher Größe | Lösung.'); break; }
        try { parseEq(formel); parseEq(loesung); } catch (e) { err(i, 'Diese Umstellaufgabe kann ich nicht lesen: ' + e.message); break; }
        umst = mark({ formel, nach, loesung, umformungen: [], tipps: [] });
        cur.umstellen.push(umst); task = null; ctx = 'umstellen'; field = null; break;
      }
      case 'umformung': {
        if (!umst) { err(i, 'Vor dieser Umformung fehlt eine Zeile „Umstellen:“.'); break; }
        const [op, gl, falsch] = pipes(val);
        umst.umformungen.push({ operation: op, gleichung: gl || '', falsch: splitList(falsch || '') });
        field = null; break;
      }
      case 'auswahl': {
        const [frage, richtig, falsch, erklaerung] = pipes(val);
        if (!frage || !richtig || !falsch) { err(i, 'Auswahl bitte so schreiben: Frage | richtige Antwort | falsche Antwort; falsche Antwort.'); break; }
        lastMc = mark({ frage, richtig, falsch: splitList(falsch), erklaerung: erklaerung || '' });
        cur.auswahl.push(lastMc); field = null; break;
      }
      case 'reihenfolge': {
        const [titel, schritte] = pipes(val);
        const s = splitList(schritte || '');
        if (s.length < 2) { err(i, 'Reihenfolge bitte so schreiben: Titel | Schritt 1; Schritt 2; Schritt 3.'); break; }
        cur.reihenfolgen.push(mark({ titel, schritte: s })); field = null; break;
      }
      case 'verwechslung': {
        const [a, b, unterschied] = pipes(val);
        if (!a || !b || !unterschied) { err(i, 'Verwechslung bitte so schreiben: Begriff A | Begriff B | Unterschied in einem Satz.'); break; }
        const o = mark({ a, b, unterschied });
        cur.verwechslungen.push(o); setField(o, 'unterschied'); break;
      }
      case 'zuordnen': {
        const [titel, rest] = pipes(val);
        const paare = splitList(rest || '').map(x => { const k = x.indexOf('='); return k > 0 ? { begriff: x.slice(0, k).trim(), bedeutung: x.slice(k + 1).trim() } : null; }).filter(x => x && x.begriff && x.bedeutung);
        if (!titel || paare.length < 2) { err(i, 'Zuordnen bitte so schreiben: Titel | Begriff = Bedeutung; Begriff = Bedeutung.'); break; }
        cur.zuordnen.push(mark({ titel, paare })); field = null; break;
      }
      case 'erklaeren': case 'skizze': {
        const [aufgabe, punkte] = pipes(val);
        const kern = splitList(punkte || '');
        const name = key === 'skizze' ? 'Skizze' : 'Erklären';
        if (!aufgabe || !kern.length) { err(i, name + ' bitte so schreiben: Aufgabe | Kernpunkt; Kernpunkt; Kernpunkt.'); break; }
        cur[key === 'skizze' ? 'skizzen' : 'erklaeren'].push(mark({ aufgabe, kern })); field = null; break;
      }
      case 'zeichnung': {
        // Nur am ersten Trennstrich teilen, im SVG dürfen weitere stehen. Die Rohzeile nehmen, damit
        // Markdown-Bereinigung nichts im SVG verändert. Ein SVG darf über mehrere Zeilen gehen.
        const roh = raw.slice(raw.indexOf(':') + 1);
        const k = roh.indexOf('|');
        const titel = stripMd(k < 0 ? roh : roh.slice(0, k)).trim();
        let svg = k < 0 ? '' : roh.slice(k + 1).replace(/`+\s*$/, '').trim();
        if (/<svg[\s>]/i.test(svg) && !/<\/svg>/i.test(svg)) {
          let j = i + 1;
          while (j < lines.length && !/<\/svg>/i.test(lines[j]) && !(hasMarkers && END.test(cleanLine(lines[j])))) j++;
          if (j < lines.length && /<\/svg>/i.test(lines[j])) { svg += '\n' + lines.slice(i + 1, j + 1).join('\n'); i = j; }
        }
        svg = svg.replace(/(<\/svg>)[\s\S]*$/i, '$1').trim();
        if (!titel || !istSvg(svg)) { err(i, 'Zeichnung bitte so schreiben: Titel | <svg …>…</svg>. Nach dem Trennstrich fehlt ein vollständiges SVG.'); field = null; break; }
        const sauber = bereinigen(svg);
        if (!sauber) { err(i, 'Die Zeichnung „' + titel + '“ kann ich nicht lesen. Das SVG ist fehlerhaft.'); field = null; break; }
        cur.zeichnungen.push({ titel, svg: sauber });
        if (ziel) (ziel.bilder = ziel.bilder || []).push(titel);
        field = null; break;
      }
      // Falsch: Antwort | warum sie falsch ist. Gehört zur letzten Auswahl, Schrittfrage, zum Ansatz oder zur Kontrolle.
      case 'falsch': {
        const [antw, ...w] = pipes(val);
        if (!lastMc || !antw || !w.length) { warn(i, 'Falsch bitte direkt unter eine Auswahl, Schrittfrage oder einen Ansatz schreiben: falsche Antwort | warum sie falsch ist.'); field = null; break; }
        if (!lastMc.falsch.some(x => norm(x) === norm(antw)) && !(lastMc.woerter && lastMc.woerter.some(x => norm(x) === norm(antw)))) warn(i, 'Die Antwort „' + antw + '“ steht nicht bei den falschen Antworten darüber.');
        const o = { a: antw, w: w.join(' | ') };
        (lastMc.wf = lastMc.wf || []).push(o); setField(o, 'w'); break;
      }
      // Fall: Titel | Ausgangslage. Darunter Gleichung- und Schrittfrage-Zeilen, wie im Trainer „Weg planen“.
      case 'fall': {
        const [titel, ...rest] = pipes(val);
        if (!titel) { err(i, 'Fall bitte so schreiben: Titel | Ausgangslage.'); break; }
        fall = mark({ titel, text: rest.join(' | '), gleichungen: [], schritte: [] });
        cur.faelle.push(fall); task = null; umst = null; ctx = 'fall'; setField(fall, 'text'); break;
      }
      case 'gleichung': {
        if (!fall) { warn(i, 'Gleichung gehört unter eine Zeile „Fall:“.'); break; }
        const p = pipes(val);
        const gl = p.length > 1 ? p.slice(1).join(' | ') : p[0], name = p.length > 1 ? p[0] : '';
        try { parseEq(gl); } catch (e) { warn(i, 'Die Gleichung kann ich nicht als Rechnung lesen (' + e.message + '). Ich zeige sie als Text.'); }
        fall.gleichungen.push({ name, gl }); field = null; break;
      }
      case 'schrittfrage': {
        if (!fall) { err(i, 'Schrittfrage gehört unter eine Zeile „Fall:“.'); break; }
        const [frage, richtig, falsch, erklaerung] = pipes(val);
        if (!frage || !richtig || !falsch) { err(i, 'Schrittfrage bitte so schreiben: Frage | richtige Antwort | falsch; falsch | Erklärung (optional).'); break; }
        lastMc = { frage, richtig, falsch: splitList(falsch), erklaerung: erklaerung || '' };
        fall.schritte.push(lastMc); field = null; break;
      }
      // Luecke: Satz mit [Wort] | falsch; falsch | Erklärung
      case 'luecke': {
        const [satz, falsch, erklaerung] = pipes(val);
        const woerter = [...String(satz || '').matchAll(/\[([^\]]+)\]/g)].map(m => m[1].trim()).filter(Boolean);
        if (!woerter.length) { err(i, 'Lücke bitte so schreiben: Satz mit [fehlendem Wort] | falsch; falsch | Erklärung. Das fehlende Wort steht in eckigen Klammern.'); break; }
        if (woerter.length > 3) warn(i, 'Mehr als drei Lücken in einem Satz sind schwer. Teile den Satz.');
        lastMc = zielSetzen(mark({ satz, woerter, falsch: splitList(falsch || ''), erklaerung: erklaerung || '' }));
        cur.luecken.push(lastMc); field = null; break;
      }
      // Warumfrage: Frage | Antwort | falsch; falsch | Erklärung. Fallbeispiel: Lage | Frage | Antwort | falsch; falsch | Erklärung
      case 'warumfrage': case 'fallbeispiel': {
        const p = pipes(val);
        const lage = key === 'fallbeispiel' ? p.shift() : '';
        const [frage, antwort, falsch, erklaerung] = p;
        if (!frage || !antwort || (key === 'fallbeispiel' && !lage)) { err(i, key === 'warumfrage' ? 'Warumfrage bitte so schreiben: Frage | Antwort | falsch; falsch | Erklärung. Falsche Antworten und Erklärung sind optional.' : 'Fallbeispiel bitte so schreiben: Lage | Frage | Antwort | falsch; falsch | Erklärung.'); break; }
        const o = { frage, antwort, falsch: splitList(falsch || ''), erklaerung: erklaerung || '' };
        if (lage) o.lage = lage;
        lastMc = zielSetzen(mark(o));
        cur[key === 'warumfrage' ? 'warumfragen' : 'fallbeispiele'].push(lastMc); field = null; break;
      }
      // Rechnen: Aufgabentext mit {Platzhaltern}. Darunter Variable, Schritt, Rechnung, Ergebnis, Bereich wie bei Aufgabe.
      case 'rechnen':
        task = zielSetzen(mark(newTask(i, val))); task.weg = true; cur.rechnen.push(task); umst = null; fall = null; ctx = 'aufgabe'; setField(task, 'text'); break;
      case 'bereich': {
        const t = ensureTask(i);
        const [a, b] = pipes(val).map(x => readNumber(x));
        if (!a || !b || a.error || a.empty || b.error || b.empty) { err(i, 'Bereich bitte so schreiben: kleinstes Ergebnis | größtes Ergebnis, zum Beispiel 50 | 400.'); break; }
        t.bereich = { min: Math.min(a.value, b.value), max: Math.max(a.value, b.value) }; field = null; break;
      }
      // Tabelle: Titel | Spalte; Spalte. Darunter Zeile: Zelle; Zelle. [Text] in einer Zelle wird ein kleines Label.
      case 'tabelle': {
        const [titel, kopf] = pipes(val);
        if (!titel) { err(i, 'Tabelle bitte so schreiben: Titel | Spalte; Spalte; Spalte.'); break; }
        const vorher = ziel;
        tab = { titel, kopf: splitList(kopf || ''), zeilen: [] };
        cur.tabellen.push(tab);
        if (vorher) (vorher.tabellen = vorher.tabellen || []).push(titel);
        ziel = vorher; field = null; break;
      }
      case 'zeile': {
        if (!tab) { warn(i, 'Zeile gehört unter eine Zeile „Tabelle:“.'); break; }
        tab.zeilen.push(String(val).split(';').map(x => x.trim())); field = null; break;
      }
      // Grundprinzip: Anker | Fachbegriff | Merksatz. Unter einer Aufgabe gilt es für diese, sonst für das Thema.
      case 'grundprinzip': {
        const [anker, begriff, merksatz] = pipes(val);
        if (!anker && !begriff && !merksatz) { warn(i, 'Grundprinzip bitte so schreiben: Anker | Fachbegriff | Merksatz.'); break; }
        const o = { anker: anker || '', begriff: begriff || '', merksatz: merksatz || '' };
        if (ziel) ziel.grund = o; else cur.grundprinzipien.push(o);
        field = null; break;
      }
      case 'podcast': {
        // Podcast: Lena | Text  oder  Podcast: Tom | Text. Tom erklärt, Lena fragt.
        const [wer, ...rest] = pipes(val);
        const text = rest.join(' | ');
        if (!text) { err(i, 'Podcast bitte so schreiben: Lena | Text oder Tom | Text.'); break; }
        const o = { wer: /^(b|tom|erkl)/i.test(wer) ? 'B' : 'A', text };
        cur.podcast.push(o); setField(o, 'text'); break;
      }
      case '?': {
        const o = { schluessel: rawKey, text: val };
        cur.notizen.push(o); setField(o, 'text');
        warn(i, 'Den Schlüssel „' + rawKey + '“ kenne ich nicht. Ich behalte die Zeile als Notiz.');
        break;
      }
    }
  }
  if (hasMarkers && inBlock && cur) { res.abgeschnitten = true; res.hinweise.push({ zeile: lines.length, text: '', meldung: 'Die Zeile „=== ENDE ===“ fehlt. Ich habe bis zum Schluss gelesen.' }); }
  finish();
  return res;
}

function splitList(s) {
  s = String(s || '').trim();
  if (!s) return [];
  return s.split(';').map(x => x.trim()).filter(Boolean);
}

/* ===== Zusammenfassung für die Vorschau ===== */
export function summary(t) {
  const parts = [
    [t.merksaetze.length, 'Merksatz', 'Merksätze'],
    [t.begriffe.length, 'Begriff', 'Begriffe'],
    [t.karten.length, 'Karte', 'Karten'],
    [t.aufgaben.length, 'Aufgabe', 'Aufgaben'],
    [t.formeln.length, 'Formel', 'Formeln'],
    [t.bausteine.length, 'Baustein', 'Bausteine'],
    [t.umstellen.length, 'Umstellaufgabe', 'Umstellaufgaben'],
    [t.auswahl.length, 'Auswahlfrage', 'Auswahlfragen'],
    [t.reihenfolgen.length, 'Reihenfolge', 'Reihenfolgen'],
    [(t.verwechslungen || []).length, 'Verwechslung', 'Verwechslungen'],
    [(t.zuordnen || []).length, 'Zuordnung', 'Zuordnungen'],
    [(t.erklaeren || []).length, 'Erklär-Aufgabe', 'Erklär-Aufgaben'],
    [(t.skizzen || []).length, 'Skizze', 'Skizzen'],
    [(t.zeichnungen || []).length, 'Zeichnung', 'Zeichnungen'],
    [(t.faelle || []).length, 'Fall', 'Fälle'],
    [(t.luecken || []).length, 'Lückentext', 'Lückentexte'],
    [(t.warumfragen || []).length, 'Warum-Frage', 'Warum-Fragen'],
    [(t.fallbeispiele || []).length, 'Fallbeispiel', 'Fallbeispiele'],
    [(t.rechnen || []).length, 'Rechenweg', 'Rechenwege'],
    [(t.tabellen || []).length, 'Tabelle', 'Tabellen'],
    [(t.ankerkarten || []).length, 'Anker-Karte', 'Anker-Karten'],
    [t.schnellwege.length, 'Schnellweg', 'Schnellwege'],
    [t.fehler.length, 'typischer Fehler', 'typische Fehler'],
    [t.prinzip.length ? 1 : 0, 'Prinzip-Text', 'Prinzip-Texte'],
    [t.anker.length, 'Bild', 'Bilder'],
    [t.notizen.length, 'Notiz', 'Notizen']
  ].filter(p => p[0] > 0).map(p => p[0] + ' ' + (p[0] === 1 ? p[1] : p[2]));
  return parts.length ? parts.join(', ') : 'kein Inhalt';
}

/* ===== Zusammenführen ohne Duplikate ===== */
const KEYFN = {
  anker: s => norm(s), merksaetze: s => norm(s), prinzip: s => norm(s), bausteine: s => norm(s), schnellwege: s => norm(s), quellen: s => norm(s),
  begriffe: b => norm(b.begriff), fehler: f => norm(f.fehler), formeln: f => norm(f.formel), karten: k => norm(k.frage),
  aufgaben: a => norm(a.text + a.gegeben.join('')), umstellen: u => norm(u.formel + '|' + u.nach), auswahl: a => norm(a.frage),
  reihenfolgen: r => norm(r.titel), podcast: p => norm(p.wer + p.text), notizen: n => norm(n.schluessel + n.text),
  verwechslungen: v => norm(v.a + '|' + v.b), zuordnen: z => norm(z.titel), erklaeren: e => norm(e.aufgabe), skizzen: e => norm(e.aufgabe), zeichnungen: z => norm(z.titel), faelle: f => norm(f.titel),
  luecken: l => norm(l.satz), warumfragen: w => norm(w.frage), fallbeispiele: f => norm(f.lage + '|' + f.frage), rechnen: a => norm(a.text),
  tabellen: x => norm(x.titel), ankerkarten: a => norm(a.bild + '|' + a.begriff), grundprinzipien: g => norm(g.anker + g.begriff + g.merksatz)
};
// opt.zeichnungBleibt: bei gleichem Titel behält base seine Zeichnung (Abgleich: base ist die neuere Fassung).
// Sonst ersetzt eine gleichnamige Zeichnung aus add die alte.
export function mergeTopic(base, add, opt = {}) {
  const out = emptyTopic(base.fach || add.fach, base.thema || add.thema);
  out.modul = base.modul || add.modul || '';
  let added = 0;
  for (const k of LISTS) {
    const seen = new Map();
    for (const x of base[k] || []) { seen.set(KEYFN[k](x), x); out[k].push(x); }
    for (const x of add[k] || []) {
      const key = KEYFN[k](x);
      if (!key) continue;
      if (seen.has(key)) {
        const old = seen.get(key);
        if (k === 'zeichnungen' || k === 'tabellen') { if (!opt.zeichnungBleibt && JSON.stringify(old) !== JSON.stringify(x)) { out[k][out[k].indexOf(old)] = x; seen.set(key, x); added++; } continue; }
        if (k === 'begriffe' && !old.erklaerung && x.erklaerung) old.erklaerung = x.erklaerung;
        if (k === 'formeln') for (const u of x.umgestellt) if (!old.umgestellt.some(o => norm(o) === norm(u))) old.umgestellt.push(u);
        if (k === 'formeln' && x.aufbau && !old.aufbau) old.aufbau = x.aufbau;
        continue;
      }
      seen.set(key, x); out[k].push(x); added++;
    }
  }
  // Listen, die eine spätere Version kennt, diese aber nicht: unverändert behalten, damit beim Abgleich nichts verloren geht
  for (const src of [add, base]) for (const k of Object.keys(src || {})) if (!(k in out) && Array.isArray(src[k])) out[k] = src[k];
  return { topic: out, added };
}

/* ===== Zurück ins Blockformat ===== */
const fmtVal = v => (v == null ? '' : v.text != null ? v.text : String(v.zahl));
function lineOut(key, value) {
  const parts = String(value == null ? '' : value).split('\n');
  return key + ': ' + parts[0] + (parts.length > 1 ? '\n' + parts.slice(1).join('\n') : '');
}
export function exportBlock(t, termine = []) {
  const L0 = ['=== LERNWERK ===', 'Fach: ' + t.fach, 'Thema: ' + t.thema];
  // Stufe-Zeilen nur, wenn Einträge eine Stufe haben. Sie gelten bis zur nächsten Stufe-Zeile.
  let aktStufe = 0;
  const L = { push(...x) { L0.push(...x); }, join: s => L0.join(s) };
  const st = (o, d = 1) => { const n = (o && o.stufe) || d; if (n !== aktStufe && (aktStufe || n !== 1 || (o && o.stufe))) L0.push('Stufe: ' + n); aktStufe = n; };
  if (t.modul) L.push('Modul: ' + t.modul);
  const ankerKarte = new Set((t.ankerkarten || []).map(a => norm(a.bild)));
  t.anker.filter(a => !ankerKarte.has(norm(a))).forEach(a => L.push(lineOut('Anker', a)));
  t.begriffe.forEach(b => { st(b); L.push(lineOut('Begriff', b.begriff + ' | ' + b.erklaerung)); });
  t.merksaetze.forEach(m => L.push(lineOut('Merksatz', m)));
  t.prinzip.forEach(p => L.push(lineOut('Prinzip', p)));
  t.bausteine.forEach(b => L.push(lineOut('Baustein', b)));
  t.schnellwege.forEach(s => L.push(lineOut('Schnellweg', s)));
  t.fehler.forEach(f => { st(f); L.push(lineOut('Fehler', f.fehler + ' | ' + f.achtung)); });
  t.formeln.forEach(f => { st(f); L.push('Formel: ' + (f.name || '') + ' | ' + f.formel + (f.umgestellt.length ? ' | ' + f.umgestellt.join('; ') : '')); if (f.aufbau) L.push('Aufbau: ' + f.aufbau); });
  t.karten.forEach(k => { st(k); L.push(lineOut('Karte', k.frage + ' | ' + k.antwort)); });
  const wfOut = q => (q && q.wf ? q.wf.forEach(x => L.push(lineOut('Falsch', x.a + ' | ' + x.w))) : null);
  t.aufgaben.forEach(a => {
    st(a);
    L.push(lineOut('Aufgabe', a.text));
    a.gegeben.forEach(g => L.push(lineOut('Gegeben', g)));
    a.gesucht.forEach(g => L.push(lineOut('Gesucht', g)));
    a.tipps.forEach(g => L.push(lineOut('Tipp', g)));
    a.schritte.forEach(s => L.push('Schritt: ' + s.was + ' | ' + fmtVal(s.ergebnis) + (s.einheit || s.tipp ? ' | ' + s.einheit : '') + (s.tipp ? ' | ' + s.tipp : '')));
    if (a.ergebnis) L.push('Ergebnis: ' + fmtVal(a.ergebnis.wert) + (a.ergebnis.einheit ? ' | ' + a.ergebnis.einheit : ''));
    a.variablen.forEach(v => L.push('Variable: ' + v.name + ' | ' + v.von + ' | ' + v.bis + ' | ' + v.schritt));
    if (a.rechnung) L.push('Rechnung: ' + a.rechnung);
    if (a.ansatz) { L.push('Ansatz: ' + a.ansatz.richtig + ' | ' + a.ansatz.falsch.join('; ')); wfOut(a.ansatz); }
    if (a.signal) L.push(lineOut('Signal', a.signal));
    if (a.warum) { L.push('Warum: ' + a.warum.richtig + ' | ' + a.warum.falsch.join('; ')); wfOut(a.warum); }
    if (a.kontrolle) { L.push('Kontrolle: ' + a.kontrolle.frage + ' | ' + a.kontrolle.richtig + ' | ' + a.kontrolle.falsch.join('; ')); wfOut(a.kontrolle); }
  });
  t.umstellen.forEach(u => {
    st(u);
    L.push('Umstellen: ' + u.formel + ' | ' + u.nach + ' | ' + u.loesung);
    u.umformungen.forEach(f => L.push('Umformung: ' + f.operation + ' | ' + f.gleichung + (f.falsch.length ? ' | ' + f.falsch.join('; ') : '')));
    u.tipps.forEach(g => L.push(lineOut('Tipp', g)));
  });
  t.auswahl.forEach(a => { st(a); L.push('Auswahl: ' + a.frage + ' | ' + a.richtig + ' | ' + a.falsch.join('; ') + (a.erklaerung ? ' | ' + a.erklaerung : '')); wfOut(a); });
  (t.faelle || []).forEach(f => { st(f); L.push(lineOut('Fall', f.titel + (f.text ? ' | ' + f.text : ''))); f.gleichungen.forEach(g => L.push('Gleichung: ' + (g.name ? g.name + ' | ' : '') + g.gl)); f.schritte.forEach(q => { L.push('Schrittfrage: ' + q.frage + ' | ' + q.richtig + ' | ' + q.falsch.join('; ') + (q.erklaerung ? ' | ' + q.erklaerung : '')); wfOut(q); }); });
  t.reihenfolgen.forEach(r => st(r) || L.push('Reihenfolge: ' + r.titel + ' | ' + r.schritte.join('; ')));
  (t.verwechslungen || []).forEach(v => st(v) || L.push(lineOut('Verwechslung', v.a + ' | ' + v.b + ' | ' + v.unterschied)));
  (t.zuordnen || []).forEach(z => st(z) || L.push('Zuordnen: ' + z.titel + ' | ' + z.paare.map(p => p.begriff + ' = ' + p.bedeutung).join('; ')));
  (t.erklaeren || []).forEach(e => st(e) || L.push('Erklären: ' + e.aufgabe + ' | ' + e.kern.join('; ')));
  (t.skizzen || []).forEach(e => st(e) || L.push('Skizze: ' + e.aufgabe + ' | ' + e.kern.join('; ')));
  const zusatz = o => {
    (o.bilder || []).forEach(n => { const z = (t.zeichnungen || []).find(x => norm(x.titel) === norm(n)); if (z) L.push('Zeichnung: ' + z.titel + ' | ' + String(z.svg).replace(/\s*\n\s*/g, ' ')); });
    (o.tabellen || []).forEach(n => { const x = (t.tabellen || []).find(y => norm(y.titel) === norm(n)); if (x) tabOut(x); });
    if (o.grund) L.push('Grundprinzip: ' + o.grund.anker + ' | ' + o.grund.begriff + ' | ' + o.grund.merksatz);
  };
  const benutzt = new Set(), tabBenutzt = new Set();
  const tabOut = x => { L.push('Tabelle: ' + x.titel + (x.kopf.length ? ' | ' + x.kopf.join('; ') : '')); x.zeilen.forEach(z => L.push('Zeile: ' + z.join('; '))); };
  for (const o of [...(t.luecken || []), ...(t.warumfragen || []), ...(t.fallbeispiele || []), ...(t.rechnen || [])]) { (o.bilder || []).forEach(n => benutzt.add(norm(n))); (o.tabellen || []).forEach(n => tabBenutzt.add(norm(n))); }
  (t.tabellen || []).filter(x => !tabBenutzt.has(norm(x.titel))).forEach(tabOut);
  (t.grundprinzipien || []).forEach(g => L.push('Grundprinzip: ' + g.anker + ' | ' + g.begriff + ' | ' + g.merksatz));
  (t.zeichnungen || []).filter(z => !benutzt.has(norm(z.titel))).forEach(z => L.push('Zeichnung: ' + z.titel + ' | ' + String(z.svg).replace(/\s*\n\s*/g, ' ')));
  (t.ankerkarten || []).forEach(a => { st(a, 1); L.push('Anker: ' + a.bild + ' | ' + a.begriff); });
  (t.luecken || []).forEach(l => { st(l, 1); L.push('Luecke: ' + l.satz + (l.falsch.length || l.erklaerung ? ' | ' + l.falsch.join('; ') : '') + (l.erklaerung ? ' | ' + l.erklaerung : '')); wfOut(l); zusatz(l); });
  (t.warumfragen || []).forEach(w => { st(w, 2); L.push('Warumfrage: ' + w.frage + ' | ' + w.antwort + (w.falsch.length || w.erklaerung ? ' | ' + w.falsch.join('; ') : '') + (w.erklaerung ? ' | ' + w.erklaerung : '')); wfOut(w); zusatz(w); });
  (t.fallbeispiele || []).forEach(w => { st(w, 2); L.push('Fallbeispiel: ' + w.lage + ' | ' + w.frage + ' | ' + w.antwort + (w.falsch.length || w.erklaerung ? ' | ' + w.falsch.join('; ') : '') + (w.erklaerung ? ' | ' + w.erklaerung : '')); wfOut(w); zusatz(w); });
  (t.rechnen || []).forEach(a => {
    st(a, 3);
    L.push(lineOut('Rechnen', a.text));
    a.gegeben.forEach(g => L.push(lineOut('Gegeben', g)));
    a.gesucht.forEach(g => L.push(lineOut('Gesucht', g)));
    a.variablen.forEach(v => L.push('Variable: ' + v.name + ' | ' + v.von + ' | ' + v.bis + ' | ' + v.schritt + (v.einheit ? ' | ' + v.einheit : '')));
    a.schritte.forEach(s => L.push('Schritt: ' + s.was + ' | ' + fmtVal(s.ergebnis) + (s.einheit || s.tipp ? ' | ' + s.einheit : '') + (s.tipp ? ' | ' + s.tipp : '')));
    if (a.rechnung) L.push('Rechnung: ' + a.rechnung);
    if (a.ergebnis) L.push('Ergebnis: ' + fmtVal(a.ergebnis.wert) + (a.ergebnis.einheit ? ' | ' + a.ergebnis.einheit : ''));
    if (a.bereich) L.push('Bereich: ' + a.bereich.min + ' | ' + a.bereich.max);
    a.tipps.forEach(g => L.push(lineOut('Tipp', g)));
    zusatz(a);
  });
  (t.podcast || []).forEach(p => L.push('Podcast: ' + (p.wer === 'B' ? 'Tom' : 'Lena') + ' | ' + p.text));
  t.quellen.forEach(q => L.push(lineOut('Quelle', q)));
  t.notizen.forEach(n => L.push(lineOut(n.schluessel, n.text)));
  termine.forEach(x => L.push('Termin: ' + x.fach + ' | ' + x.datum + ' | ' + (x.themen || '')));
  L.push('=== ENDE ===');
  return L.join('\n');
}

export const TEMPLATE = `Mach aus dem Material unten einen Lernwerk-Block für meine Lern-App. Halte dich an mein Lernprinzip: erst ein Bild aus meiner Welt (Fräse, Werkstatt, Training, Alltag), dann der Fachbegriff, dann ein kurzer Merksatz. Aufgaben in Bausteinen (gegeben, gesucht, Regel, nächster Schritt) mit Schnellweg. Prüfe Fakten sorgfältig. Gib nur den Block in einem Codeblock aus, in genau diesem Format, jede Zeile beginnt mit einem Schlüssel, Schlüssel dürfen mehrfach vorkommen:
=== LERNWERK ===
Fach:
Thema:
Modul: (optional, zum Beispiel M2)
Stufe: 1
Anker: Bild aus meiner Welt
Begriff: Fachbegriff | Erklärung in einem Satz
Merksatz:
Prinzip: Erklärung in ganzen Sätzen, darf mehrere Zeilen haben
Baustein: ein Lösungsbaustein pro Zeile
Schnellweg:
Fehler: typischer Fehler | worauf ich achten muss
Formel: Name | Formel | umgestellt nach den anderen Größen
Aufbau: Warum die Formel so aussieht, in ein bis zwei Sätzen
Karte: kurze Frage | kurze Antwort
Aufgabe: Aufgabentext
Gegeben:
Gesucht:
Schritt: was berechnet wird | Ergebnis | Einheit
Ergebnis: Zahl | Einheit
Variable: Name | von | bis | Schrittweite
Rechnung: Formel mit den Variablennamen
Ansatz: richtiger Lösungsansatz | falscher Ansatz; falscher Ansatz; falscher Ansatz
Signal: woran ich in der Aufgabe erkenne, dass dieser Ansatz passt
Warum: richtige Begründung | falsche Begründung; falsche Begründung
Kontrolle: Frage zur Plausibilität des Ergebnisses | richtige Antwort | falsch; falsch
Auswahl: kurzer Fall aus der Praxis | richtige Antwort | falsch; falsch; falsch | Erklärung, warum
Falsch: eine der falschen Antworten | warum genau sie falsch ist (für jede falsche Antwort eine Zeile, auch unter Ansatz)
Fall: Titel | Ausgangslage, gegeben und gesucht
Gleichung: I | 0 = F_Ax − F · cos(α)
Schrittfrage: In welcher Gleichung steht F_Ay? | Gleichung II | Gleichung I; Gleichung III | warum das der richtige Schritt ist
Falsch: Gleichung I | In I steht nur F_Ax.
Luecke: Merksatz mit [fehlendem Wort] | falsches Wort; falsches Wort | Erklärung
Tabelle: Titel | Spalte; Spalte; Spalte
Zeile: [Label] Zelle; Zelle; Zelle
Grundprinzip: Bild aus meiner Welt | Fachbegriff | Merksatz
Stufe: 2
Warumfrage: Warum kommt dieser Schritt hier? | richtige Begründung | falsch; falsch | Erklärung
Fallbeispiel: kurze Lage aus Werkstatt, Training oder Alltag | Frage | richtige Antwort | falsch; falsch | Erklärung
Verwechslung: Begriff A | Begriff B | Unterschied in einem Satz
Zuordnen: Titel | Begriff = Bedeutung; Begriff = Bedeutung; Begriff = Bedeutung
Stufe: 3
Rechnen: Aufgabentext mit Platzhaltern wie {F} und {l}
Variable: F | 1000 | 5000 | 500 | N
Schritt: was ich mache | Name = Formel mit Variablen und früheren Namen | Einheit | warum dieser Schritt, ein Satz
Ergebnis: Name | Einheit
Bereich: kleinstes | größtes sinnvolles Ergebnis
Erklären: Prüfungsaufgabe zum Erklären | Kernpunkt; Kernpunkt; Kernpunkt
Skizze: Prüfungsaufgabe zum Zeichnen | Kernpunkt; Kernpunkt
Zeichnung: Titel | <svg viewBox="0 0 300 200">…</svg> (optional, fertige Skizze als SVG, Farben über die Klassen l, d, r, b, g, o, t2)
Termin: Fach | JJJJ-MM-TT | Themen
Inhalt: 6 Karten; 2 Aufgaben; 3 Begriffe
=== ENDE ===
Fragen wie in einem guten Trainer: Jede falsche Antwort ist ein typischer Denkfehler, und zu jeder steht in einer Falsch-Zeile, warum sie nicht passt. Bei Rechenthemen zusätzlich Fälle: Erst den Weg planen (welche Gleichung, welches Zwischenziel, wohin der Drehpunkt) in Schrittfragen, dann rechnen. Erklären-Zeilen im Stil der Klausur: Aussage und Begründung als getrennte Kernpunkte.
Zu jeder Aufgabe gehören Ansatz, Signal, Warum und Kontrolle. Die falschen Ansätze sollen plausibel sein, am besten Verfahren aus verwandten Themen, die man leicht verwechselt. Alle Antworten einer Auswahl gleich lang und gleich aufgebaut, damit die richtige nicht auffällt.
Stufen: Stufe 1 sind Grundlagen (Anker, Begriffe, Merksatz, einfache Karten), Stufe 2 Zusammenhänge (Prinzip, Formeln, Bausteine, Verwechslungen, Zuordnen), Stufe 3 Anwenden (Aufgaben, Fehler, Schnellweg, schwere Karten, Erklären, Skizze). Eine Stufe-Zeile gilt für alle Zeilen danach bis zur nächsten Stufe-Zeile.
Die Zeile Inhalt zählt am Ende, was im Block steht, damit ich sehe, ob alles angekommen ist.
Formeln schreibst du in einer Zeile mit Leerzeichen um die Rechenzeichen und mit Klammern, zum Beispiel R = U / I oder F_B = F · a / (l1 + l2). Die App zeigt daraus echte Brüche wie im Buch. Einheiten ohne Leerzeichen, zum Beispiel N/mm².
Material:
`;
