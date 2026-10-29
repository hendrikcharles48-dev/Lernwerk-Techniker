// Skizzen zu den Themen: Vektorgrafiken unter inhalte/bilder/, Farben aus der App (Klassen .sk).
// Sie werden direkt ins Dokument gesetzt, damit Hell und Dunkel stimmen.
import { esc } from './util.js';
import { $$, openSheet } from './ui.js';

let idx = null;
const svgs = new Map();
// F_N in der Bildunterschrift als F mit tiefgestelltem N
const tief = t => esc(t).replace(/([A-Za-zσταμΔ])_([A-Za-z0-9]+)/g, '$1<sub>$2</sub>');
export async function laden() {
  if (idx) return idx;
  try { const r = await fetch('inhalte/bilder/index.json'); idx = r.ok ? await r.json() : {}; } catch (e) { idx = {}; }
  return idx;
}
export const fuer = tid => (idx && idx[tid]) || [];
const fuer_datei = d => Object.values(idx || {}).flat().find(x => x.datei === d);
async function svg(datei) {
  if (svgs.has(datei)) return svgs.get(datei);
  let t = '';
  try { const r = await fetch('inhalte/bilder/' + datei); if (r.ok) t = await r.text(); } catch (e) { /* offline ohne Cache */ }
  // Nur echte SVG-Dateien aus dem eigenen Ordner, ohne Skripte
  if (!/^<svg[\s>]/.test(t) || /<script|on\w+=/i.test(t)) t = '';
  svgs.set(datei, t);
  return t;
}
// Platzhalter für die Skizzen eines Themas. Danach fuellen() aufrufen.
export function html(tid, klein = false) {
  return fuer(tid).map(s => `<figure class="sk-fig sk${klein ? ' klein' : ''}" data-sk="${esc(s.datei)}"><div class="sk-box" role="button" tabindex="0" aria-label="Skizze groß ansehen"></div><figcaption>${tief(s.text)}</figcaption></figure>`).join('');
}
export function fuellen(root) {
  $$('[data-sk]', root).forEach(async f => {
    const box = f.querySelector('.sk-box');
    if (box.childElementCount) return;
    box.innerHTML = await svg(f.dataset.sk);
    box.onclick = () => gross(f.dataset.sk, (fuer_datei(f.dataset.sk) || {}).text || '');
  });
}
function gross(datei, text) {
  openSheet({ title: 'Skizze', full: true, render: async b => { b.innerHTML = `<figure class="sk-fig sk"><div class="sk-box">${await svg(datei)}</div><figcaption>${tief(text)}</figcaption></figure>`; } });
}
