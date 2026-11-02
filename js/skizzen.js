// Skizzen zu den Themen: Vektorgrafiken unter inhalte/bilder/, Farben aus der App (Klassen .sk).
// Sie werden direkt ins Dokument gesetzt, damit Hell und Dunkel stimmen.
// Dazu kommen die eingefügten Zeichnungen eines Themas (Schlüssel „Zeichnung“), die direkt aus dem Thema kommen.
import { esc } from './util.js';
import { $$, openSheet, confirmBox, toast } from './ui.js';
import * as st from './store.js';
import { bereinigen } from './svg.js';

let idx = null;
const svgs = new Map();
// F_N in der Bildunterschrift als F mit tiefgestelltem N
const tief = t => esc(t).replace(/([A-Za-zσταμΔ])_([A-Za-z0-9]+)/g, '$1<sub>$2</sub>');
export async function laden() {
  if (idx) return idx;
  try { const r = await fetch('inhalte/bilder/index.json'); idx = r.ok ? await r.json() : {}; } catch (e) { idx = {}; }
  return idx;
}
// Themen ohne eigene Skizze nutzen die eines verwandten Themas
const VERWANDT = { 'et-rueckrechnen': 'et-gemischte-schaltungen', 'tm-formelsammlung-statik': 'tm-lagerkraefte', 'tm-wandschwenkkran': 'tm-zentrales-kraeftesystem' };
const eingebaut = tid => (idx && (idx[tid] || idx[VERWANDT[tid]])) || [];
// Eingefügte Zeichnungen des Themas: { titel, svg }, beim Anzeigen noch einmal bereinigt
const eigene = tid => { const u = st.S.content && st.S.content.get(tid); return ((u && u.zeichnungen) || []).filter(z => z && z.titel && z.svg); };
export const fuer = tid => [...eingebaut(tid), ...eigene(tid).map(z => ({ titel: z.titel, text: z.titel, svg: z.svg, eigen: true }))];
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
// ohneText: bei Fragen ohne Bildunterschrift, damit sie die Antwort nicht verrät
// loeschen: kleines Löschen-Symbol an eingefügten Zeichnungen (nur in der Themenansicht)
export function html(tid, klein = false, ohneText = false, loeschen = false) {
  return fuer(tid).map(s => {
    const cap = ohneText ? '' : `<figcaption>${tief(s.text)}</figcaption>`;
    if (!s.eigen) return `<figure class="sk-fig sk${klein ? ' klein' : ''}" data-sk="${esc(s.datei)}"><div class="sk-box" role="button" tabindex="0" aria-label="Skizze groß ansehen"></div>${cap}</figure>`;
    const weg = loeschen ? `<button class="zg-weg" data-zg-weg="${esc(s.titel)}" data-tid="${esc(tid)}" aria-label="Zeichnung löschen"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12"/></svg></button>` : '';
    return `<figure class="sk-fig sk zg${klein ? ' klein' : ''}" data-zg="${esc(s.titel)}" data-tid="${esc(tid)}"><div class="sk-box" role="button" tabindex="0" aria-label="Zeichnung groß ansehen">${bereinigen(s.svg)}</div>${cap}${weg}</figure>`;
  }).join('');
}
export function fuellen(root) {
  $$('[data-zg]', root).forEach(f => {
    const box = f.querySelector('.sk-box');
    box.onclick = () => grossSvg(box.innerHTML, f.dataset.zg);
    const weg = f.querySelector('[data-zg-weg]');
    if (weg) weg.onclick = async e => {
      e.stopPropagation();
      if (!(await confirmBox('Zeichnung „' + f.dataset.zg + '“ löschen?', 'Löschen', true))) return;
      await st.zeichnungLoeschen(weg.dataset.tid, f.dataset.zg);
      f.remove();
      toast('Zeichnung gelöscht.');
    };
  });
  $$('[data-sk]', root).forEach(async f => {
    const box = f.querySelector('.sk-box');
    if (box.childElementCount) return;
    box.innerHTML = await svg(f.dataset.sk);
    box.onclick = () => gross(f.dataset.sk, (fuer_datei(f.dataset.sk) || {}).text || '');
  });
}
function grossSvg(inhalt, text) {
  openSheet({ title: 'Zeichnung', full: true, render: b => { b.innerHTML = `<figure class="sk-fig sk"><div class="sk-box">${inhalt}</div><figcaption>${tief(text)}</figcaption></figure>`; } });
}
function gross(datei, text) {
  openSheet({ title: 'Skizze', full: true, render: async b => { b.innerHTML = `<figure class="sk-fig sk"><div class="sk-box">${await svg(datei)}</div><figcaption>${tief(text)}</figcaption></figure>`; } });
}
