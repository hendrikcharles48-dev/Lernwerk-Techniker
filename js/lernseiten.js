// Lernseiten: fertige Lernzettel und Trainer aus dem Claude-Chat (Artefakte, HTML) direkt in der App.
// Gespeichert als Lernzettel mit dem Feld html (Speicher notes), deshalb laufen sie beim Abgleich mit.
// Angezeigt in einem abgeschotteten Rahmen (sandbox ohne allow-same-origin): Die Seite kommt nicht an
// die Daten der App und nicht an den GitHub-Schlüssel. Ihr Speicher (localStorage) wird nachgebildet
// und im Feld zustand der Lernseite gesichert, so bleiben Häkchen und Ergebnisse erhalten, auch auf dem iPad.
import { esc, plainText } from './util.js';
import * as st from './store.js';
import { $, icon, toast, confirmBox, saveFile } from './ui.js';

export const istHtml = t => /^\s*(<!--[\s\S]*?-->\s*)*(<!doctype html|<html[\s>])/i.test(String(t || ''));
export const istSeite = n => !!(n && n.html);
export const titelAus = html => { const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html || ''); return m ? plainText(m[1].replace(/<[^>]+>/g, '')).trim().slice(0, 80) : ''; };
// Kurzbeschreibung für Listen, Suche und Vorlesen: die ersten Sätze sichtbaren Textes
export function textAus(html, max = 600) {
  const t = String(html || '').replace(/<(script|style|svg|head)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
  return t.slice(0, max);
}
// Zuordnung aus einem Kommentar am Anfang: <!-- lernwerk fach="Werkstofftechnik" thema="Gießen" arbeit="2026-11-16" -->
export function zuordnungAus(html) {
  const m = /<!--\s*lernwerk\b([\s\S]*?)-->/i.exec(String(html || '').slice(0, 2000));
  if (!m) return {};
  const o = {};
  for (const x of m[1].matchAll(/(fach|thema|arbeit|titel)\s*=\s*"([^"]*)"/gi)) o[x[1].toLowerCase()] = x[2].trim();
  return o;
}

export const seiten = () => st.S.notes.filter(istSeite);
export const seitenFuerArbeit = ex => seiten().filter(n => n.exId === ex.id).sort((a, b) => b.zeit - a.zeit);
export const seitenFuerFach = fid => seiten().filter(n => n.fid === fid || (n.tid && (st.thema(n.tid) || {}).fach && st.thema(n.tid).fach.id === fid)).sort((a, b) => b.zeit - a.zeit);

// Neue Lernseite speichern. o: { html, titel?, fid?, tid?, exId?, quelle? }. Gleicher Titel im selben Fach ersetzt die alte Fassung, ihr Fortschritt bleibt.
export async function speichern(o) {
  const html = String(o.html || '');
  if (!istHtml(html)) throw new Error('Das ist keine HTML-Seite.');
  if (html.length > 3e6) throw new Error('Die Seite ist zu groß (über 3 MB).');
  const titel = (o.titel || titelAus(html) || 'Lernseite').trim();
  const fid = o.fid || (o.tid && st.thema(o.tid) ? st.thema(o.tid).fach.id : '');
  const alt = seiten().find(n => n.titel === titel && (n.fid || '') === (fid || ''));
  const n = Object.assign({}, alt || {}, { titel, html, text: textAus(html), fid, tid: o.tid || (alt && alt.tid) || '', exId: o.exId || (alt && alt.exId) || '', quelle: o.quelle || 'einfuegen', zeit: alt ? alt.zeit : Date.now() });
  return st.saveNote(n);
}

/* ===== Anzeigen ===== */
// Wird vor den Inhalt der Seite gesetzt: Speicher nachbilden, Änderungen an die App melden, Links nach außen in neuem Fenster
// Handybreite: nichts darf die Seite breiter als den Bildschirm machen. Breite Tabellen wischt man in sich.
const PASST = `<meta name="viewport" content="width=device-width, initial-scale=1"><style id="lw-breite">html,body{max-width:100%!important;min-width:0!important;overflow-x:hidden!important;-webkit-text-size-adjust:100%;text-size-adjust:100%}
body{overflow-wrap:break-word}img,video,canvas,svg,iframe{max-width:100%!important}img,video{height:auto}pre{white-space:pre-wrap!important;overflow-wrap:anywhere}
.lw-tab{max-width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch}</style>`;
const PASST_JS = `function passt(){var W=document.documentElement.clientWidth;[].forEach.call(document.querySelectorAll('table'),function(t){var p=t.parentElement;if(!p||p.classList.contains('lw-tab'))return;if(t.getBoundingClientRect().width>W-4||t.scrollWidth>p.clientWidth+2){var d=document.createElement('div');d.className='lw-tab';p.insertBefore(d,t);d.appendChild(t);}});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',passt);else passt();addEventListener('load',passt);addEventListener('resize',passt);
try{new MutationObserver(function(){clearTimeout(window.__lwP);window.__lwP=setTimeout(passt,120);}).observe(document.documentElement,{childList:true,subtree:true});}catch(e){}`;
function shim(id, zustand) {
  return PASST + `<script>(function(){var ID=${JSON.stringify(id)},data=${JSON.stringify(zustand || {}).replace(/</g, '\\u003c')},t=null;
function send(){clearTimeout(t);t=setTimeout(function(){try{parent.postMessage({lwSeite:ID,store:data},'*');}catch(e){}},250);}
function mk(d,persist){return{getItem:function(k){k=String(k);return Object.prototype.hasOwnProperty.call(d,k)?d[k]:null;},setItem:function(k,v){d[String(k)]=String(v);if(persist)send();},removeItem:function(k){delete d[String(k)];if(persist)send();},clear:function(){for(var k in d)delete d[k];if(persist)send();},key:function(i){return Object.keys(d)[i]||null;},get length(){return Object.keys(d).length;}};}
try{Object.defineProperty(window,'localStorage',{value:mk(data,true),configurable:true});}catch(e){}
try{Object.defineProperty(window,'sessionStorage',{value:mk({},false),configurable:true});}catch(e){}
var ausdr=false,gesehen={};
function melde(o){try{parent.postMessage({lwSeite:ID,lwAntwort:o},'*');}catch(e){}}
window.lernwerk={antwort:function(o){ausdr=true;if(o&&o.frage)melde({frage:String(o.frage),gewaehlt:String(o.gewaehlt||''),richtig:String(o.richtig||''),ok:!!o.ok,thema:String(o.thema||''),erklaerung:String(o.erklaerung||'')});}};
function txt(el){return (el.textContent||'').replace(/\\s+/g,' ').trim();}
function frageZu(el){for(var n=el;n&&n!==document.body;n=n.parentElement){var q=n.querySelector&&n.querySelector('.qq,.q,.frage,.step-q,.question,.ex-task');if(q&&txt(q))return txt(q).slice(0,300);}return '';}
var KL=/(^|\\s)(ok|good|right|correct|richtig)(\\s|$)/,KF=/(^|\\s)(bad|no|wrong|falsch|err)(\\s|$)/;
try{new MutationObserver(function(ms){if(ausdr)return;var je={};ms.forEach(function(m){var el=m.target;if(m.attributeName!=='class'||!el.closest||!el.closest('button,[role=button],.qopt,.opt,.option'))return;var c=el.className||'',a=m.oldValue||'';if(typeof c!=='string')return;var ok=KL.test(c)&&!KL.test(a),bad=KF.test(c)&&!KF.test(a);if(!ok&&!bad)return;var q=frageZu(el);if(!q||gesehen[q])return;var x=je[q]||(je[q]={ok:[],bad:[]});(bad?x.bad:x.ok).push(txt(el).slice(0,200));});
Object.keys(je).forEach(function(q){var x=je[q];gesehen[q]=1;melde({frage:q,ok:!x.bad.length,gewaehlt:x.bad.length===1?x.bad[0]:'',richtig:x.bad.length&&x.ok.length===1?x.ok[0]:'',auto:true});});}).observe(document.documentElement,{subtree:true,attributes:true,attributeFilter:['class'],attributeOldValue:true});}catch(e){}
${PASST_JS}
document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[href]');if(!a)return;var h=a.getAttribute('href')||'';if(h.charAt(0)==='#'||/^javascript:/i.test(h))return;a.setAttribute('target','_blank');a.setAttribute('rel','noopener');},true);
})();<\/script>`;
}
function mitShim(html, id, zustand) {
  const s = shim(id, zustand);
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, m => m + s);
  if (/<html[^>]*>/i.test(html)) return html.replace(/<html[^>]*>/i, m => m + '<head>' + s + '</head>');
  return s + html;
}

let offen = null;

/* ===== Antworten aus der Seite verbuchen =====
 * Jede Antwort zählt wie eine Übung der App: für Stärke, Serie und Wochenstatistik. Falsche Antworten kommen ins Fehlerbuch
 * und als Fehlerkarte in die Wiederholung. Die Seite meldet über window.lernwerk.antwort({...}) oder die App erkennt
 * richtig und falsch an den Markierungen der Antwortknöpfe (ok, bad).
 */
export async function verbuchen(noteId, o) {
  const n = st.S.notes.find(x => x.id === noteId);
  const frage = String((o && o.frage) || '').trim().slice(0, 300);
  if (!n || !frage) return null;
  let tid = n.tid && st.thema(n.tid) ? n.tid : '';
  const f = st.fach(n.fid) || (tid ? st.thema(tid).fach : null);
  if (o.thema && f) { const t = st.suggestThema(f, String(o.thema)); if (t) tid = t.id; }
  await st.addEvent({ art: 'seite', tid, ok: !!o.ok, ergebnis: o.ok ? 'richtig' : 'falsch', seite: n.id });
  if (o.ok) return null;
  const th = tid ? st.thema(tid) : null;
  return st.addError({ fach: th ? th.fach.name : f ? f.name : '', thema: th ? th.thema.name : n.titel || '', tid, aufgabe: frage, eingabe: String(o.gewaehlt || '').slice(0, 200), richtig: String(o.richtig || '').slice(0, 200), fehlerart: 'Falsche Auswahl', quelle: 'seite', notiz: [String(o.erklaerung || ''), 'Aus der Lernseite „' + (n.titel || '') + '“.'].filter(Boolean).join(' ') });
}

/* ===== Lernseiten wiederholen =====
 * Nach jeder Runde (ab drei Antworten) kommt die Seite in wachsenden Abständen wieder: 1, 3, 7, 14, 30 Tage.
 * Seiten zu einer Arbeit in den nächsten 14 Tagen, die noch nie geübt wurden, stehen gleich da.
 */
const ABSTAND = [1, 3, 7, 14, 30];
export function faellig(jetzt = Date.now()) {
  const heute = new Date(jetzt).toISOString().slice(0, 10);
  const bald = new Set(st.offeneArbeiten(heute).filter(e => (Date.parse(e.datum) - jetzt) / 864e5 <= 14).map(e => e.id));
  return seiten().map(n => {
    if (!n.letzteRunde) return bald.has(n.exId) ? { n, tage: null } : null;
    const ab = ABSTAND[Math.min((n.runden || 1) - 1, ABSTAND.length - 1)];
    const tage = Math.floor((jetzt - n.letzteRunde) / 864e5);
    return tage >= ab ? { n, tage } : null;
  }).filter(Boolean).sort((a, b) => (a.tage == null ? -1 : b.tage == null ? 1 : b.tage - a.tage));
}
if (typeof window !== 'undefined') window.addEventListener('message', async e => {
  if (!offen || !e.data || e.data.lwSeite !== offen.id || e.source !== offen.frame.contentWindow) return;
  if (e.data.lwAntwort) { offen.antworten++; if (e.data.lwAntwort.ok) offen.richtig++; await verbuchen(offen.id, e.data.lwAntwort); return; }
  const store = e.data.store;
  if (!store || typeof store !== 'object') return;
  const text = JSON.stringify(store);
  if (text.length > 300000) return;
  const n = st.S.notes.find(x => x.id === offen.id);
  if (!n || JSON.stringify(n.zustand || {}) === text) return;
  await st.saveNote(Object.assign({}, n, { zustand: JSON.parse(text) }));
});

export function oeffnen(id) {
  const n = st.S.notes.find(x => x.id === id);
  if (!n || !n.html) { toast('Diese Lernseite gibt es nicht mehr.'); return; }
  if (offen) schliessen();
  const el = document.createElement('div');
  el.className = 'seite';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.innerHTML = `<header class="seite-h"><button type="button" class="seite-x" data-s="zu">${icon('back')}<span>Fertig</span></button><div class="seite-t">${esc(n.titel || 'Lernseite')}</div><button type="button" class="seite-m" data-s="menu" aria-label="Mehr">${icon('mehr')}</button></header>
    <iframe class="seite-f" title="${esc(n.titel || 'Lernseite')}" sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms allow-modals allow-downloads" referrerpolicy="no-referrer"></iframe>`;
  document.body.appendChild(el);
  document.body.classList.add('sheet-open', 'seite-offen');
  const frame = $('.seite-f', el);
  frame.srcdoc = mitShim(n.html, n.id, n.zustand);
  offen = { id, el, frame, antworten: 0, richtig: 0 };
  st.setPlace({ art: 'seite', noteId: id, tid: n.tid || '', titel: n.titel });
  el.addEventListener('click', async ev => {
    const b = ev.target.closest('[data-s]');
    if (!b) return;
    if (b.dataset.s === 'zu') return schliessen();
    if (b.dataset.s === 'menu') menu(n.id);
  });
}
export async function schliessen() {
  if (!offen) return;
  const o = offen;
  o.el.remove();
  offen = null;
  // Eine Runde zählt ab drei Antworten. Daraus plant die Startseite die nächste Wiederholung der Seite.
  if (o.antworten >= 3) { const n = st.S.notes.find(x => x.id === o.id); if (n) await st.saveNote(Object.assign({}, n, { runden: (n.runden || 0) + 1, letzteRunde: Date.now(), quote: Math.round(o.richtig / o.antworten * 100) })); }
  document.body.classList.remove('seite-offen');
  // Nur zurücksetzen, wenn kein anderes Fenster offen ist
  if (!document.querySelector('.sheet')) document.body.classList.remove('sheet-open');
  import('./sicherung.js').then(m => m.anstossen()).catch(() => {});
}
async function menu(id) {
  const { openSheet, on } = await import('./ui.js');
  const n = st.S.notes.find(x => x.id === id);
  if (!n) return;
  openSheet({
    title: n.titel || 'Lernseite',
    render(b, api) {
      b.innerHTML = `<div class="btn-col"><button class="btn" data-a="zuordnen">${icon('list')} Fach, Thema und Klassenarbeit</button>
        <button class="btn" data-a="neu">${icon('repeat')} Fortschritt auf dieser Seite zurücksetzen</button>
        <button class="btn" data-a="nlm">${icon('copy')} Text für NotebookLM kopieren</button>
        <button class="btn" data-a="datei">${icon('save')} Als Datei sichern</button>
        <button class="btn danger" data-a="del">${icon('trash')} Lernseite löschen</button></div>
        <p class="src">Die Seite läuft abgeschottet. Sie kommt nicht an deine anderen Daten. Häkchen und Ergebnisse auf der Seite speichert Lernwerk und gleicht sie mit deinen anderen Geräten ab.</p>`;
      on(b, {
        zuordnen: () => { api.close(); zuordnenDialog(id); },
        neu: async () => { if (!(await confirmBox('Fortschritt auf dieser Seite zurücksetzen? Häkchen und Ergebnisse der Seite sind dann weg.', 'Zurücksetzen', true))) return; await st.saveNote(Object.assign({}, n, { zustand: {} })); api.close(); schliessen(); oeffnen(id); },
        nlm: async () => { const { copyText } = await import('./ui.js'); const ok = await copyText((n.titel || '') + '\n\n' + textAus(n.html, 200000)); toast(ok ? 'Text kopiert. In NotebookLM als Quelle „Kopierter Text“ einfügen.' : 'Kopieren hat nicht geklappt.'); },
        datei: () => saveFile((n.titel || 'lernseite').replace(/[^\wäöüÄÖÜß-]+/g, '-') + '.html', n.html, 'text/html'),
        del: async () => { if (!(await confirmBox('Lernseite „' + (n.titel || '') + '“ löschen?', 'Löschen', true))) return; api.close(); schliessen(); await st.deleteNote(id); toast('Lernseite gelöscht.'); }
      });
    }
  });
}
// Fach, Thema und Klassenarbeit einer Lernseite festlegen
export async function zuordnenDialog(id) {
  const { openSheet, on } = await import('./ui.js');
  const n = Object.assign({}, st.S.notes.find(x => x.id === id));
  if (!n.id) return;
  if (!n.fid && n.tid && st.thema(n.tid)) n.fid = st.thema(n.tid).fach.id;
  openSheet({
    title: 'Zuordnen', full: true,
    render(b, api) {
      const draw = () => {
        const f = st.fach(n.fid);
        const arbeiten = st.S.exams.filter(e => e.fachId === n.fid).sort((a, c) => (a.datum < c.datum ? 1 : -1));
        b.innerHTML = `<div class="form"><label class="fld"><span>Titel</span><input type="text" data-k="titel" value="${esc(n.titel || '')}"></label>
          <label class="fld"><span>Fach</span><select data-k="fid"><option value="">Kein Fach</option>${st.faecher().map(x => `<option value="${x.id}" ${x.id === n.fid ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>
          ${f ? `<label class="fld"><span>Thema (optional)</span><select data-k="tid"><option value="">Ganzes Fach</option>${f.themen.map(t => `<option value="${t.id}" ${t.id === n.tid ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select></label>
          <label class="fld"><span>Klassenarbeit (optional)</span><select data-k="exId"><option value="">Keine</option>${arbeiten.map(e => `<option value="${e.id}" ${e.id === n.exId ? 'selected' : ''}>${esc(e.fach)}, ${esc(e.datum.split('-').reverse().join('.'))}</option>`).join('')}</select></label>` : ''}
          <button class="btn filled" data-a="save">Speichern</button></div>`;
        b.querySelector('[data-k="fid"]').onchange = ev => { grab(); n.fid = ev.target.value; n.tid = ''; n.exId = ''; draw(); };
      };
      const grab = () => { for (const k of ['titel', 'tid', 'exId']) { const x = b.querySelector(`[data-k="${k}"]`); if (x) n[k] = x.value; } };
      draw();
      on(b, { save: async () => { grab(); await st.saveNote(n); api.close(); toast('Gespeichert.'); } });
    }
  });
}
