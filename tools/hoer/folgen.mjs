// Baut die Skripte aller Podcast-Folgen aus den eingebauten Inhalten. Genutzt von skript.mjs und vom Inhalte-Test.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { parseBlocks, mergeTopic } from '../../js/parser.js';
import { norm } from '../../js/util.js';
import { folge } from '../../js/podcast.js';
import { sprechbar } from '../../js/speech.js';
import { speakFml } from '../../js/formula.js';

export function alleFolgen() {
  const root = new URL('../../', import.meta.url);
  const L = JSON.parse(fs.readFileSync(new URL('lehrplan.json', root), 'utf8'));
  const idx = JSON.parse(fs.readFileSync(new URL('inhalte/index.json', root), 'utf8'));
  const themen = new Map();
  for (const f of idx.dateien) {
    const datei = typeof f === 'string' ? f : f.datei;
    const r = parseBlocks(fs.readFileSync(new URL('inhalte/' + datei, root), 'utf8'));
    for (const t of r.themen) {
      const fa = L.faecher.find(x => norm(x.name) === norm(t.fach));
      const th = fa && fa.themen.find(x => norm(x.name) === norm(t.thema));
      if (!th) continue;
      const old = themen.get(th.id);
      themen.set(th.id, { fach: fa.name, tid: th.id, t: old ? mergeTopic(old.t, t).topic : t });
    }
  }
  const out = [];
  for (const { fach, tid, t } of themen.values()) {
    const segs = folge(t);
    if (segs.length < 6) continue;
    const hash = crypto.createHash('sha1').update(JSON.stringify(segs.map(s => [s.wer, s.say, s.pause]))).digest('hex').slice(0, 12);
    // Alle Karten, Begriffe und Formeln für das Abfragen, mit denselben Fragen wie im Hörmodus
    const karten = [];
    for (const k of t.karten) karten.push({ q: k.frage, a: k.antwort, sq: sprechbar(k.frage), sa: sprechbar(k.antwort) });
    for (const b of t.begriffe) if (b.erklaerung) { const q = 'Was bedeutet „' + b.begriff + '“?'; karten.push({ q, a: b.erklaerung, sq: sprechbar(q), sa: sprechbar(b.erklaerung) }); }
    for (const fo of t.formeln) { const q = 'Wie lautet die Formel ' + (fo.name ? 'für ' + fo.name : '') + '?'; karten.push({ q, a: fo.formel, sq: sprechbar(q), sa: sprechbar(speakFml(fo.formel) + (fo.umgestellt.length ? '. Umgestellt: ' + fo.umgestellt.map(speakFml).join('. ') : '')) }); }
    const khash = crypto.createHash('sha1').update(JSON.stringify(karten.map(k => [k.sq, k.sa]))).digest('hex').slice(0, 12);
    out.push({ tid, fach, thema: t.thema, hash, segs, karten, khash });
  }
  return out;
}
