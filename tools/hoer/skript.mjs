// Schreibt die Skripte aller Podcast-Folgen nach tools/hoer/skripte.json.
// Ausführen mit: node tools/hoer/skript.mjs
// Danach erzeugt tools/hoer/erzeugen.py daraus die Audiodateien unter audio/.
import fs from 'node:fs';
import { alleFolgen } from './folgen.mjs';
import { SPRECHER } from '../../js/podcast.js';

const out = alleFolgen();
fs.writeFileSync(new URL('skripte.json', import.meta.url), JSON.stringify({ sprecher: SPRECHER, folgen: out }, null, 1));
const zeichen = out.reduce((s, f) => s + f.segs.reduce((a, x) => a + x.say.length, 0), 0);
console.log(out.length, 'Folgen,', zeichen, 'Zeichen');
