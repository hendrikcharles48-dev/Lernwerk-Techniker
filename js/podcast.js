// Podcast-Folgen für den Hörmodus: Lena fragt, Tom erklärt.
// Läuft im Browser und in Node (tools/hoer). So klingt die Folge mit Systemstimme und als Audiodatei gleich.
import { plainText } from './util.js';
import { sprechbar } from './speech.js';
import { speakFml } from './formula.js';

export const SPRECHER = { A: 'Lena', B: 'Tom' };
// Denkpause vor der Antwort in Millisekunden. In der Audiodatei ist sie fest eingebaut.
export const DENKPAUSE = 5000;

// Kleine Abwechslung, aber für jedes Thema immer gleich
function pick(list, seed) {
  let h = 0;
  for (const c of String(seed)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return list[h % list.length];
}
export const satz = s => { const t = plainText(s).trim(); return /[.!?:]$/.test(t) ? t : t + '.'; };
// Absätze in Sätze teilen, damit die Stimme natürlich atmet und die Anzeige mitläuft
const saetze = s => plainText(s).split(/(?<=[.!?])\s+(?=[A-ZÄÖÜ0-9„(])/).map(x => x.trim()).filter(Boolean);

function seg(wer, text, art = '', pause = 0) {
  return { wer, text, say: sprechbar(text), art, pause };
}

// Eine Folge aus einem Thema bauen. Hat das Thema eigene Podcast-Zeilen, gelten die.
export function folge(t) {
  const out = [];
  const A = (text, art, pause) => out.push(seg('A', text, art, pause));
  const B = (text, art, pause) => out.push(seg('B', text, art, pause));
  const name = t.thema;
  if (t.podcast && t.podcast.length) {
    for (const p of t.podcast) for (const s of saetze(p.text)) out.push(seg(p.wer, s, 'eigen'));
    return out;
  }
  A(pick([`Heute geht es um ${name}. Tom, womit fangen wir an?`, `Unser Thema heute: ${name}. Tom, erklär mal.`, `Hallo Tom. Heute nehmen wir uns ${name} vor. Wie fängst du an?`], name), 'start', 300);
  if (t.anker.length) {
    for (const s of saetze(t.anker[0])) B(s, 'anker');
    A(pick(['Okay, das Bild habe ich im Kopf. Und was steckt fachlich dahinter?', 'Gut, das kann ich mir vorstellen. Wie ist das fachlich?', 'Verstehe. Und jetzt richtig erklärt?'], name + 'a'), '', 200);
  }
  t.prinzip.forEach((p, i) => {
    for (const s of saetze(p)) B(s, 'prinzip');
    if (i < t.prinzip.length - 1) out[out.length - 1].pause = 500;
  });
  const begriffe = t.begriffe.filter(b => b.erklaerung).slice(0, 4);
  if (begriffe.length) {
    A('Welche Begriffe muss ich kennen?', '', 200);
    for (const b of begriffe) B(b.begriff.replace(/[.:]$/, '') + ': ' + satz(b.erklaerung), 'begriff', 300);
  }
  const formeln = t.formeln.slice(0, 3);
  if (formeln.length) {
    A(formeln.length > 1 ? 'Und welche Formeln brauche ich?' : 'Und welche Formel brauche ich?', '', 200);
    for (const f of formeln) {
      out.push({ wer: 'B', text: (f.name ? f.name + ': ' : '') + f.formel, say: (f.name ? sprechbar(f.name) + ': ' : '') + (/[()√]/.test(f.formel) ? sprechbar(speakFml(f.formel)) : sprechbar(f.formel.split('|')[0])) + '.', art: 'formel', pause: 300 });
      if (f.aufbau) for (const s of saetze(f.aufbau)) B(s, 'aufbau');
    }
  }
  if (t.merksaetze.length) {
    A(pick(['Gibt es einen Merksatz?', 'Was soll ich mir merken?', 'Und wie merke ich mir das?'], name + 'm'), '', 200);
    for (const m of t.merksaetze.slice(0, 3)) B(satz(m), 'merksatz', 300);
  }
  const karten = t.karten.slice(0, 5);
  if (karten.length) {
    A('Jetzt frage ich dich ab. Und du, der zuhört: Sag die Antwort laut, bevor Tom sie sagt.', '', 400);
    for (const k of karten) {
      A(satz(k.frage), 'frage', DENKPAUSE);
      B(satz(k.antwort), 'antwort', 600);
    }
  }
  if (t.fehler.length) {
    A('Wo passieren die meisten Fehler?', '', 200);
    for (const f of t.fehler.slice(0, 2)) B(satz(f.fehler) + (f.achtung ? ' ' + satz(f.achtung) : ''), 'fehler', 400);
  }
  if (t.schnellwege.length) {
    A('Und der Schnellweg für die Prüfung?', '', 200);
    for (const s of t.schnellwege.slice(0, 2)) for (const x of saetze(s)) B(x, 'schnellweg');
  }
  A(pick([`Danke, Tom. Das war ${name}.`, `Super, damit haben wir ${name}. Bis zum nächsten Mal.`, `Alles klar. Das war ${name}.`], name + 'e'), 'ende');
  return out;
}

// Länge grob schätzen, für die Liste, solange es noch keine Audiodatei gibt
export function dauerSchaetzung(segs) {
  return segs.reduce((s, x) => s + x.say.length / 14 + x.pause / 1000, 0);
}
