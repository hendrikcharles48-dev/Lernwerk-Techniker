// Lernzettel zur Klassenarbeit: alle Themen der Arbeit auf einer Seite, in der Reihenfolge der Arbeit.
// Je Thema Bild aus deiner Welt, Skizze, Merksätze, Fachbegriffe, Formeln, Prüfungsfallen und Schnellweg.
// Thema für Thema abhaken, danach die Probeklausur. Gebaut aus den Inhalten der App, nichts Neues.
// Gespeichert in kv „zettelGelernt“: { Arbeits-ID: { Themen-ID: Zeitpunkt } }, läuft beim Abgleich mit.
import { esc, dayLong, daysBetween, dayStr, markdown } from './util.js';
import { mathText } from './formula.js';
import * as st from './store.js';
import { $, $$, icon, on, push, toast, progress, empty } from './ui.js';
import { formelCard, topicPage } from './engine.js';
import * as sk from './skizzen.js';
import * as lernseiten from './lernseiten.js';

const gelernt = exId => Object.assign({}, (st.kvGet('zettelGelernt', {}) || {})[exId] || {});
async function setGelernt(exId, tid, an) {
  const alle = Object.assign({}, st.kvGet('zettelGelernt', {}));
  const g = Object.assign({}, alle[exId] || {});
  if (an) g[tid] = Date.now(); else delete g[tid];
  alle[exId] = g;
  await st.kvSet('zettelGelernt', alle);
}
// Fehler-Training: offene Fehler und Fragen der Arbeit, die schon einmal falsch beantwortet wurden
function fehlerItems(ex) {
  const tids = new Set(ex.themaIds || []);
  const its = [...tids].flatMap(t => st.topicItems(t)).filter(i => (st.card(i.id) || {}).falsch > 0);
  const errs = st.S.errors.filter(e => !e.erledigt && tids.has(e.tid)).map(st.errorItem);
  return [...errs, ...its];
}
export const istGelernt = (exId, tid) => !!gelernt(exId)[tid];
export const zettelStand = ex => { const tids = (ex.themaIds || []).filter(t => st.thema(t)); const g = gelernt(ex.id); return { n: tids.length, ok: tids.filter(t => g[t]).length }; };

function themaHTML(tid, k, exId, g) {
  const th = st.thema(tid), T = st.topic(tid), f = th.fach;
  const r = mathText;
  let h = `<section class="az-t" id="az-${esc(tid)}" style="--fc:${f.farbe}"><div class="az-kopf"><span class="az-nr">${k + 1}</span><h2>${esc(th.thema.name)}</h2></div>`;
  if (T.anker[0]) h += `<div class="card anchor"><div class="card-k">Bild aus deiner Welt</div><p>${r(T.anker[0])}</p></div>`;
  if (sk.fuer(tid).length) h += sk.html(tid, false, false);
  T.merksaetze.slice(0, 4).forEach(m => { h += `<div class="card merk"><div class="card-k">Merksatz</div><p>${r(m)}</p></div>`; });
  const bs = T.begriffe.filter(b => b.erklaerung);
  if (bs.length) h += `<div class="sec-h">Fachbegriffe</div><div class="tw az-tab"><table>${bs.map(b => `<tr><td><b>${esc(b.begriff)}</b></td><td>${r(b.erklaerung)}</td></tr>`).join('')}</table></div>`;
  if (T.formeln.length) h += `<div class="sec-h">Formeln</div>` + T.formeln.map(formelCard).join('');
  (T.verwechslungen || []).slice(0, 3).forEach(v => { h += `<div class="fb info az-vw"><b>Nicht verwechseln: ${esc(v.a)} und ${esc(v.b)}.</b> ${r(v.unterschied)}</div>`; });
  T.fehler.slice(0, 4).forEach(x => { h += `<div class="az-falle"><b>Prüfungsfalle:</b> ${r(x.fehler)}${x.achtung ? '. ' + r(x.achtung) : ''}</div>`; });
  if (T.schnellwege.length) h += `<details class="disc"><summary>${icon('bolt')} Schnellweg für die Prüfung</summary><div class="prose">${T.schnellwege.map(x => markdown(x, mathText)).join('')}</div></details>`;
  if (!T.anker.length && !T.merksaetze.length && !bs.length && !T.formeln.length) h += `<p class="muted">Zu diesem Thema gibt es noch keine Inhalte. Füge sie über Einfügen hinzu.</p>`;
  h += `<div class="az-fuss"><button class="az-ok ${g[tid] ? 'on' : ''}" data-a="gelernt" data-d="${esc(tid)}">${g[tid] ? icon('check') + ' Gelernt' : 'Als gelernt abhaken'}</button>${g[tid] ? `<button class="btn small filled" data-a="fragen" data-d="${esc(tid)}">${icon('bolt')} Fragen dazu</button>` : ''}<button class="btn small" data-a="thema" data-d="${esc(tid)}">Thema öffnen</button></div></section>`;
  return h;
}

// startTid: zu diesem Thema springen, zum Beispiel vom Lernplan aus
export function arbeitsZettel(exId, startTid) {
  let gesprungen = false;
  return {
    title: 'Lernzettel',
    render(b) {
      const ex = st.S.exams.find(e => e.id === exId);
      if (!ex) { b.innerHTML = empty('Diese Klassenarbeit gibt es nicht mehr.'); return; }
      const tids = (ex.themaIds || []).filter(t => st.thema(t));
      const g = gelernt(exId), s = zettelStand(ex);
      const d = daysBetween(dayStr(), ex.datum);
      const sp = lernseiten.seitenFuerArbeit(ex);
      let h = `<div class="az-h"><div class="muted">${esc(ex.fach)} · ${esc(dayLong(ex.datum))}${d >= 0 ? ' · ' + (d === 0 ? 'heute' : d === 1 ? 'morgen' : 'in ' + d + ' Tagen') : ''}</div>
        <div class="az-stand"><b>Gelernt: ${s.ok} von ${s.n}</b>${progress(s.n ? s.ok / s.n : 0, 'var(--green)')}</div></div>`;
      if (sp.length) h += `<div class="sec-h">Deine Lernseiten zur Arbeit</div><div class="seiten-btns">${sp.map(n => `<button class="btn-big" data-a="seite" data-d="${esc(n.id)}" style="--fc:#FF9F0A">${icon('book')}<span><b>${esc(n.titel)}</b><small>Lernseite aus dem Chat</small></span></button>`).join('')}</div>`;
      if (!tids.length) { b.innerHTML = h + empty('Die Arbeit hat noch keine Themen.', 'Wähl sie unter Termine aus.'); on(b, { seite: id => lernseiten.oeffnen(id) }); return; }
      h += `<nav class="az-nav chips noswipe">${tids.map((t, k) => `<button class="chip ${g[t] ? 'az-done' : ''}" data-a="spring" data-d="${esc(t)}">${k + 1} ${esc(st.thema(t).thema.name)}</button>`).join('')}</nav>`;
      h += tids.map((t, k) => themaHTML(t, k, exId, g)).join('');
      const alle = s.n && s.ok === s.n;
      // Mini-Prüfungen: je Thema, sobald es abgehakt ist, und gemischt, wenn alles gelernt ist. Bestes Ergebnis steht dabei.
      const best = k => { const l = st.proben().filter(p => p.exId === exId && p.schluessel === k); return l.length ? Math.max(...l.map(p => p.proz)) : null; };
      const fehlerN = fehlerItems(ex).length;
      h += `<section class="az-pr" id="az-pruefung"><h2>Mini-Prüfungen</h2><p class="muted small">Wie im Ernstfall: ohne Tipps, Rechnen auf Papier, Erklären mit Kernpunkten zum Abhaken. Was unter 60 Prozent liegt, kommt im Lernplan nochmal dran.</p>
        <div class="az-pk ${alle ? '' : 'zu'}"><button class="btn-big" data-a="pruefAlle" style="--fc:var(--accent)">${icon(alle ? 'exam' : 'lock')}<span><b>Alle Themen gemischt</b><small>${alle ? '10 Aufgaben, 30 Minuten' : 'Erst alle Themen abhaken'}${best('alle') != null ? ' · bestes Ergebnis ' + best('alle') + ' %' : ''}</small></span></button></div>
        <div class="az-pt">${tids.map((t, k) => { const b2 = best(t); return `<button class="az-pti ${g[t] ? '' : 'zu'}" data-a="pruefThema" data-d="${esc(t)}"><b>${k + 1}</b><span>${esc(st.thema(t).thema.name)}</span><small>${g[t] ? (b2 != null ? 'bestes ' + b2 + ' %' : '5 Aufgaben') : 'erst abhaken'}</small></button>`; }).join('')}</div>
        ${fehlerN ? `<button class="btn-big" data-a="fehlerTraining" style="--fc:var(--red)">${icon('fehler')}<span><b>Fehler-Training</b><small>${fehlerN} Fragen, die bei dir schon einmal falsch waren</small></span></button>` : ''}
        ${alle ? '' : `<button class="btn small" data-a="trotzdem">Trotzdem alles prüfen</button>`}
        <div class="btn-col"><button class="btn" data-a="ueben">${icon('bolt')} Themen der Arbeit üben</button><button class="btn" data-a="nlm">${icon('copy')} Text für NotebookLM kopieren</button></div></section>`;
      b.innerHTML = h;
      sk.fuellen(b);
      if (startTid && !gesprungen) { gesprungen = true; setTimeout(() => { const el = $('#az-' + CSS.escape(startTid), b); if (el) el.scrollIntoView({ block: 'start' }); }, 60); }
      const pruef = async (its, min, key, titel) => { if (!its.length) { toast('Zu diesem Thema gibt es noch keine Prüfungsfragen.'); return; } const p = await import('./probeklausur.js'); p.runExam(its, min, exId, key); };
      on(b, {
        gelernt: async tid => { const an = !gelernt(exId)[tid]; await setGelernt(exId, tid, an); const y = b.closest('.page-scroll'), top = y ? y.scrollTop : 0; this.render(b); if (y) y.scrollTop = top; if (an) { const z = zettelStand(ex); toast(z.ok === z.n ? 'Alle Themen gelernt. Jetzt die Probeklausur.' : 'Abgehakt. ' + z.ok + ' von ' + z.n + '.'); } },
        spring: tid => { const el = $('#az-' + CSS.escape(tid), b); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); },
        thema: tid => push(topicPage(tid)),
        seite: id => lernseiten.oeffnen(id),
        probe: async () => { const x = await import('./extra.js'); push(x.probePage(ex)); },
        pruefAlle: async () => { if (!alle) { toast('Hak erst alle Themen als gelernt ab. Oder tippe unten auf „Trotzdem alles prüfen“.'); return; } const p = await import('./probeklausur.js'); pruef(p.probeAufgaben(tids, 10), 30, 'alle'); },
        trotzdem: async () => { const p = await import('./probeklausur.js'); pruef(p.probeAufgaben(tids, 10), 30, 'alle'); },
        pruefThema: async tid => { if (!gelernt(exId)[tid]) { toast('Lies das Thema erst und hak es ab. Dann prüfst du, ob es sitzt.'); const el = $('#az-' + CSS.escape(tid), b); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; } const p = await import('./probeklausur.js'); pruef(p.probeAufgaben([tid], 5), 0, tid); },
        fehlerTraining: async () => { const x = await import('./engine.js'); x.runSession(fehlerItems(ex).slice(0, 15), 'Fehler-Training'); },
        // Für Erklärvideos in NotebookLM: der ganze Lernzettel als Text
        nlm: async () => {
          const { copyText } = await import('./ui.js');
          const L = ['Lernzettel ' + ex.fach + ', Klassenarbeit am ' + dayLong(ex.datum), ''];
          tids.forEach((t, k) => {
            const T = st.topic(t);
            L.push((k + 1) + '. ' + st.thema(t).thema.name, '');
            T.anker.slice(0, 1).forEach(a => L.push('Bild aus der Werkstatt: ' + a));
            T.merksaetze.slice(0, 4).forEach(m => L.push('Merksatz: ' + m));
            T.begriffe.filter(x => x.erklaerung).forEach(x => L.push(x.begriff + ': ' + x.erklaerung));
            T.formeln.forEach(fo => L.push('Formel ' + (fo.name ? fo.name + ': ' : '') + fo.formel + (fo.aufbau ? '. ' + fo.aufbau : '')));
            T.prinzip.forEach(p => L.push(p));
            T.fehler.slice(0, 4).forEach(x => L.push('Prüfungsfalle: ' + x.fehler + (x.achtung ? '. ' + x.achtung : '')));
            L.push('');
          });
          const ok = await copyText(L.join('\n'));
          toast(ok ? 'Text kopiert. In NotebookLM als Quelle „Kopierter Text“ einfügen.' : 'Kopieren hat nicht geklappt.');
        },
        fragen: async tid => { const x = await import('./engine.js'); const its = x.sortForPractice(st.topicItems(tid).filter(i => i.art !== 'fehler')).slice(0, 8); if (!its.length) { toast('Zu diesem Thema gibt es noch keine Fragen.'); return; } x.runSession(its, st.thema(tid).thema.name); },
        ueben: async () => { const x = await import('./engine.js'); const q = st.buildQueue(1200, { tids, exam: ex, mitFehlern: true, maxNeu: 12 }); x.runSession(q.items.length ? q.items : x.sortForPractice(tids.flatMap(t => st.uebItems(t))).slice(0, 12), 'Arbeit: ' + ex.fach); }
      });
    }
  };
}
