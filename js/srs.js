// Wiederholsystem und Lernplan. Reine Funktionen, damit sie testbar sind.
import { addDays, daysBetween, parseDay } from './util.js';

export const INTERVALS = [1, 2, 4, 7, 14, 30];

// ergebnis: 'richtig' (erster Versuch), 'hilfe' (mit Tipp oder zweitem Versuch), 'falsch'
export function nextState(st, ergebnis, today) {
  const s = Object.assign({ stufe: 0, richtig: 0, hilfe: 0, falsch: 0 }, st || {});
  if (ergebnis === 'richtig') { s.stufe = Math.min(INTERVALS.length, s.stufe + 1); s.richtig++; }
  else if (ergebnis === 'hilfe') { s.stufe = Math.max(1, s.stufe); s.hilfe++; }
  else { s.stufe = 1; s.falsch++; }
  s.zuletzt = today;
  s.faellig = addDays(today, INTERVALS[s.stufe - 1]);
  return s;
}

// Vor einer Klassenarbeit werden deren Themen vorgezogen.
export function isDue(card, today, tageBisArbeit) {
  if (!card || !card.faellig) return false;
  if (card.faellig <= today) return true;
  if (tageBisArbeit == null || tageBisArbeit < 0 || tageBisArbeit > 14) return false;
  const vorlauf = tageBisArbeit <= 2 ? 30 : tageBisArbeit <= 7 ? 3 : 1;
  return daysBetween(today, card.faellig) <= vorlauf;
}

// Grobe Zeit pro Karte in Sekunden, um "Heute dran" auf etwa 15 Minuten zu deckeln.
export const SEKUNDEN = { karte: 25, begriff: 25, fehler: 40, aufgabe: 150, umstellen: 70, auswahl: 30, reihenfolge: 60, trainer: 300 };

/*
 * Lernplan rückwärts bis zur Klassenarbeit.
 * Dienstag und Donnerstag sind volle Tage: dort nur halb so viel.
 * Letzter Tag vor der Arbeit: nur Wiederholung und Fehlerbuch.
 */
export function lernplan(datum, themen, today) {
  const tage = daysBetween(today, datum);
  if (tage <= 0) return [];
  const plan = [];
  for (let i = 0; i < tage; i++) {
    const d = addDays(today, i);
    const wt = parseDay(d).getDay();
    plan.push({ datum: d, leicht: wt === 2 || wt === 4, themen: [], art: 'lernen' });
  }
  const last = plan[plan.length - 1];
  last.art = 'wiederholen';
  const lernTage = plan.slice(0, -1);
  if (!themen.length || !lernTage.length) return plan;
  const gewicht = lernTage.reduce((s, p) => s + (p.leicht ? 0.5 : 1), 0);
  const proEinheit = Math.max(1, themen.length / gewicht);
  let k = 0, runde = 0;
  for (const p of lernTage) {
    const n = Math.max(1, Math.round(proEinheit * (p.leicht ? 0.5 : 1)));
    for (let j = 0; j < n; j++) {
      p.themen.push({ thema: themen[k], neu: runde === 0 });
      k++;
      if (k >= themen.length) { k = 0; runde++; }
    }
    if (p.leicht && p.themen.length > 1 && themen.length <= lernTage.length) p.themen.length = 1;
  }
  return plan;
}
