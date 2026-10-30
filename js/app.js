// Lernwerk Techniker: App-Hülle mit Heute, Fächer, Einfügen, Fehlerbuch und Mehr.
import { esc, dayStr, dayLong, daysBetween, plural, fmtNum, markdown, plainText, uid, shuffle } from './util.js';
import { parseBlocks, summary, TEMPLATE } from './parser.js';
import * as st from './store.js';
import { $, $$, icon, row, list, seg, sw, empty, on, push, initTabs, showTab, tab, openSheet, toast, copyText, readClipboard, progress, ring, fachIcon, confirmBox, refreshAll, refreshTop, initEdgeSwipe, initTabSwipe, hinweisTabellenbuch } from './ui.js';
import { topicPage, runSession, sortForPractice, fachProgress, topicProgress, openTrainer, askClaude, shrinkImage, noteReader, firstLine, itemTitle } from './engine.js';
import { mehrPage, unterrichtPage, termineDetail, termEditor, datensicherung, applyTheme, hoerPage } from './extra.js';
import { prefs } from './db.js';
import { saeulen, stapel, standVon, balken } from './diagramm.js';
import * as sicherung from './sicherung.js';
import { laden as skizzenLaden } from './skizzen.js';
import { canSpeak, readAloud } from './speech.js';

export const VERSION = '1.18.0';

/* ===== Heute ===== */
// Kurze, wechselnde Sätze für den Start. Ohne Druck.
const MUT = [
  'Erst planen, dann fräsen.',
  'Wiederholen ist Schlichten.',
  'Fehler sind Messwerte.',
  'Ein bisschen besser als gestern reicht.',
  'Kurz und oft schlägt lang und selten.',
  'Fünf Minuten sind ein Anfang.',
  'Sauber gespannt ist halb gefräst.'
];
function gruss() {
  const h = new Date().getHours();
  return h < 5 ? 'Noch wach?' : h < 11 ? 'Moin!' : h < 18 ? 'Hallo!' : 'Guten Abend!';
}
// Bausteine der Startseite. Reihenfolge und Sichtbarkeit stellst du unten unter „Startseite anpassen“ ein.
const START_TEILE = [
  ['spruch', 'Spruch des Tages'], ['tag', 'Fortschritt heute'], ['unterricht', 'Lernknopf Unterricht'], ['alles', 'Lernknopf Alles wiederholen'],
  ['wahl', 'Lernzeit, Fragen und Mini'], ['imunterricht', 'Im Unterricht'], ['arbeit', 'Nächste Klassenarbeit'], ['kacheln', 'Trainer und Hörmodus'], ['woche', 'Diese Woche']
];
export function startLayout() {
  const l = (prefs.get('startLayout', null) || []).filter(x => START_TEILE.some(t => t[0] === x.id));
  for (const [id] of START_TEILE) if (!l.some(x => x.id === id)) l.push({ id, an: true });
  return l;
}
function startAnpassen() {
  openSheet({
    title: 'Startseite anpassen',
    render(body) {
      const l = startLayout();
      const name = id => START_TEILE.find(t => t[0] === id)[1];
      body.innerHTML = `<p class="src">Schalte aus, was du nicht brauchst. Mit den Pfeilen änderst du die Reihenfolge.</p>
        <div class="list">${l.map((x, k) => `<div class="row sa-row"><span class="row-main"><span class="row-t">${esc(name(x.id))}</span></span>
          <button class="sa-b" data-a="hoch" data-d="${k}" ${k ? '' : 'disabled'} aria-label="nach oben">${icon('chev', 'sa-hoch')}</button><button class="sa-b" data-a="runter" data-d="${k}" ${k < l.length - 1 ? '' : 'disabled'} aria-label="nach unten">${icon('chev', 'sa-runter')}</button>
          <label class="switch"><input type="checkbox" data-sw="an" data-k="${k}" ${x.an ? 'checked' : ''}><span></span></label></div>`).join('')}</div>
        <button class="btn wide" data-a="zurueck">Wie am Anfang</button>`;
      const speichern = neu => { prefs.set('startLayout', neu); this.render(body); refreshAll(); };
      on(body, {
        hoch: k => { const n = startLayout(); k = +k; [n[k - 1], n[k]] = [n[k], n[k - 1]]; speichern(n); },
        runter: k => { const n = startLayout(); k = +k; [n[k + 1], n[k]] = [n[k], n[k + 1]]; speichern(n); },
        'sw:an': (v, el) => { const n = startLayout(); n[+el.dataset.k].an = v; prefs.set('startLayout', n); refreshAll(); },
        zurueck: () => { prefs.set('startLayout', null); this.render(body); refreshAll(); }
      });
    }
  });
}
let wahlOffen = null;
const heute = {
  title: 'Heute',
  large: false,
  render(b) {
    const today = dayStr();
    const d0 = new Date(); d0.setHours(0, 0, 0, 0);
    const doy = Math.floor((d0 - new Date(d0.getFullYear(), 0, 0)) / 86400000);
    const T = {};
    // Kopf: Gruß und Datum in einer Zeile
    let h = `<div class="kopf"><b>${esc(gruss())}</b><span>${esc(new Date().toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' }))}</span></div>`;
    T.spruch = `<p class="spruch">${icon('sparkle')}<span>${esc(MUT[doy % MUT.length])}</span></p>`;
    if (sicherung.aktiv() && sicherung.fehler()) h += `<button class="banner warn" data-a="backup">${icon('cloud')}<span><b>Sicherung klappt nicht.</b> ${esc(sicherung.fehler())}</span></button>`;
    else if (st.backupDue()) h += `<button class="banner warn" data-a="backup">${icon('save')}<span><b>Zeit für eine Sicherung.</b> Deine letzte Sicherung ist älter als 14 Tage. Tippe hier.</span></button>`;
    const qu = unterrichtQueue(), qa = allesQueue();
    // Heute: ein schmaler Fortschritt für den ganzen Tag. Was offen ist, steht direkt an den Lernknöpfen.
    const q = st.buildQueue(900);
    const erledigt = st.S.events.filter(e => e.zeit >= d0.getTime() && e.ok != null && e.art !== 'ansatz').length;
    const offen = q.items.length;
    const anteil = erledigt + offen ? erledigt / (erledigt + offen) : 1;
    T.tag = `<div class="tagline">${ring(anteil, 34, offen ? 'var(--accent)' : 'var(--green)', offen ? '' : icon('check', 'ring-check'))}<span>${offen ? `<b>Heute:</b> ${erledigt ? erledigt + ' geschafft, ' : ''}noch ${plural(offen, 'Übung', 'Übungen')} offen` : erledigt ? `<b>Alles geschafft für heute!</b> ${plural(erledigt, 'Übung', 'Übungen')}.` : '<b>Heute:</b> gerade nichts fällig'}</span></div>`;
    const minuten = x => Math.max(1, Math.round(x.sekunden / 60));
    // Aus welchen Themen die offenen Übungen kommen, als kleine Schilder im Knopf
    const themenTags = items => {
      const by = new Map();
      for (const it of items) { const k = it.art === 'fehler' ? 'Fehlerbuch' : (st.thema(it.tid) || { thema: { name: '' } }).thema.name; if (k) by.set(k, (by.get(k) || 0) + 1); }
      const l = [...by].sort((a, c) => c[1] - a[1]);
      return l.length ? `<span class="lern-tags">${l.slice(0, 3).map(([k, n]) => `<span>${esc(k)} ${n}</span>`).join('')}${l.length > 3 ? `<span>und ${l.length - 3} weitere</span>` : ''}</span>` : '';
    };
    T.unterricht = `<button class="five" data-a="lernU">${icon('bolt')}<span><b>Unterricht</b><small>${aktTids().length ? (qu.items.length ? plural(qu.items.length, 'Übung', 'Übungen') + ' offen · etwa ' + minuten(qu) + ' Min' : 'Nichts fällig, du kannst trotzdem üben.') : 'Noch keine Themen angewählt. Tippe hier.'}</small>${themenTags(qu.items)}</span></button>`;
    T.alles = `<button class="mixbtn" data-a="lernA">${icon('mix')}<span><b>Alles wiederholen</b><small>${qa.faellig ? plural(qa.faellig, 'Übung', 'Übungen') + ' fällig · etwa ' + minuten(qa) + ' Min' : 'Nichts fällig. Alles, was schon dran war, schwache Themen öfter.'}</small>${qa.faellig ? themenTags(qa.items) : ''}</span></button>`;
    // Lernzeit und Fragen vor dem Start wählen. Die letzte Wahl bleibt.
    // Zwei Knöpfe nebeneinander. Antippen klappt die Optionen auf, eine Wahl klappt sie wieder zu.
    const zeitWert = prefs.get('lernzeit', '10'), zeitText = (ZEITEN.find(z => z[0] === zeitWert) || ZEITEN[2])[1];
    const modusText = (st.MODI.find(m => m[0] === st.modus()) || st.MODI[0])[1];
    // Jeder Knopf klappt seine Optionen als Spalte darunter auf
    const wk = (k, l, v, opts, cur) => `<div class="lw-col"><button class="lw-k ${wahlOffen === k ? 'on' : ''}" data-a="wahl" data-d="${k}" aria-expanded="${wahlOffen === k}"><small>${l}</small><b>${esc(v)}</b>${icon('chev', 'lw-chev')}</button>
      ${wahlOffen === k ? `<div class="lw-liste">${opts.map(([v2, l2]) => `<button class="${v2 === cur ? 'on' : ''}" data-a="waehle" data-d="${k}|${esc(v2)}">${esc(l2)}${v2 === cur ? icon('check') : ''}</button>`).join('')}</div>` : ''}</div>`;
    T.wahl = `<div class="lernwahl"><div class="lw-knoepfe">${wk('zeit', 'Lernzeit', zeitText, ZEITEN, zeitWert)}${wk('modus', 'Fragen', modusText, st.MODI, st.modus())}</div>
      <button class="mini" data-a="mini">${icon('bolt')}<span><b>Mini</b> · 2 Minuten, etwa 5 Fragen</span></button></div>`;
    const aktT = st.kvGet('aktuell', []).map(id => st.thema(id)).filter(Boolean);
    T.imunterricht = `<button class="unt-zeile" data-a="unterricht">${icon('check')}<b>Im Unterricht</b><span class="unt-tags">${aktT.length ? aktT.map(({ fach: f, thema: t }) => `<span class="tag" style="--fc:${f.farbe}">${esc(t.name)}</span>`).join('') : '<span class="muted">nichts angewählt, tippe hier</span>'}</span>${aktT.length ? `<span class="muted">${aktT.length}</span>` : ''}${icon('chev', 'chev')}</button>`;
    const ex = st.nextExam(today);
    if (ex) {
      const d = daysBetween(today, ex.datum);
      const bereit = st.bereitschaft(ex);
      const f = st.fach(ex.fachId);
      const tops = (ex.themaIds || []).map(id => st.thema(id)).filter(Boolean);
      T.arbeit = `<div class="sec-h">Nächste Klassenarbeit</div><button class="card count" data-a="exam" data-d="${ex.id}" style="--fc:${f ? f.farbe : 'var(--accent)'}">
        <div class="count-head"><span class="count-badge"><b>${d === 0 ? '!' : d}</b><small>${d === 0 ? 'heute' : d === 1 ? 'Tag' : 'Tage'}</small></span><span><div class="count-t">${esc(ex.fach)}</div><div class="muted">${esc(dayLong(ex.datum))}</div></span>${bereit != null ? `<span class="bereit">${ring(bereit / 100, 56, bereit >= 75 ? 'var(--green)' : bereit >= 45 ? 'var(--orange)' : 'var(--red)', `<b>${bereit}</b><small>%</small>`)}<small>vorbereitet</small></span>` : ''}</div>
        ${tops.length ? `<div class="count-tops">${tops.map(t => { const p = topicProgress(t.thema.id); return `<div class="ct"><span>${esc(t.thema.name)}</span>${progress(p || 0, f ? f.farbe : null)}</div>`; }).join('')}</div>` : ex.themen ? `<div class="muted">${esc(ex.themen)}</div>` : ''}
        <div class="count-more">Lernplan ansehen ${icon('chev', 'chev')}</div></button>`;
    }
    // Trainer und Hörmodus: je eine Kachel. Die Trainer liegen dahinter in Ordnern nach Fach.
    const tr = trainerOrdnerListe(today);
    const fae = tr.reduce((n, o) => n + o.due, 0);
    T.kacheln = `<div class="tr-grid">`;
    if (tr.length) T.kacheln += `<button class="tr-tile" data-a="trainerAlle" style="--fc:#5E5CE6"><span class="tr-ic">${icon('tools')}</span><b>Trainer</b><small>${plural(tr.reduce((n, o) => n + o.n, 0), 'Trainer', 'Trainer')} in ${tr.length} Ordnern${fae ? ' · ' + fae + ' fällig' : ''}</small></button>`;
    T.kacheln += `<button class="tr-tile" data-a="hoer" style="--fc:#30D158"><span class="tr-ic">${icon('ear')}</span><b>Hörmodus</b><small>Folgen und Abfragen</small></button></div>`;
    const w = st.weekStats();
    const mon = new Date(); mon.setHours(0, 0, 0, 0); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
    const aq = st.ansatzQuote(mon.getTime());
    const tage = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
    const heuteIdx = (new Date().getDay() + 6) % 7;
    const serie = st.lernSerie();
    T.woche = `<div class="sec-h">Diese Woche</div><div class="card week">${serie >= 2 ? `<div class="serie">${icon('flame')}<span><b>${serie} Tage</b> am Stück gelernt. Ein freier Tag pro Woche bricht die Serie nicht.</span></div>` : ''}${w.n ? saeulen(w.uebTage.map((n, i) => ({ label: tage[i], n, ok: w.okTage[i], aktiv: i === heuteIdx })), { titel: 'Übungen pro Tag', legende: [['dg-voll', 'beim ersten Mal gewusst'], ['dg-hell', 'mit Hilfe oder falsch']] }) : `<div class="week-days">${w.tage.map((n, i) => `<div class="wd ${n ? 'on' : ''} ${i === heuteIdx ? 'now' : ''}"><span>${n ? icon('check') : ''}</span><small>${tage[i]}</small></div>`).join('')}</div>`}
      <div class="muted">${w.n ? 'An ' + plural(w.aktiv, 'Tag', 'Tagen') + ' gelernt, ' + plural(w.n, 'Übung', 'Übungen') + ', davon ' + w.ok + ' beim ersten Mal gewusst.' : 'Noch nichts geübt diese Woche. Fünf Minuten reichen für den Anfang.'}</div>${aq.n ? `<div class="week-ansatz">${icon('target')}<span>Ansatz sofort erkannt: <b>${aq.ok} von ${aq.n}</b>. Das ist dein wichtigster Wert.</span></div>` : ''}</div>`;
    for (const x of startLayout()) if (x.an && T[x.id]) h += T[x.id];
    h += `<button class="sa-link" data-a="anpassen">${icon('list')} Startseite anpassen</button>`;
    b.innerHTML = h;
    on(b, {
      anpassen: () => startAnpassen(),
      waehle: d => { const [k, v] = d.split('|'); wahlOffen = null; if (k === 'zeit') prefs.set('lernzeit', v); else st.setModus(v); this.render(b); },
      backup: () => push(datensicherung()),
      exam: id => push(termineDetail(id)),
      newexam: () => termEditor({}),
      lernU: () => lernenUnterricht(),
      mini: () => (aktTids().length ? lernenUnterricht(MINI) : lernenAlles(MINI)),
      wahl: k => { wahlOffen = wahlOffen === k ? null : k; this.render(b); },
      'seg:zeit': v => { prefs.set('lernzeit', v); wahlOffen = null; this.render(b); },
      'seg:modus': v => { wahlOffen = null; st.setModus(v); this.render(b); },
      trmix: () => trainerGemischt(),
      trainer: d => { const i = d.indexOf('|'); openTrainer(d.slice(0, i), d.slice(i + 1)); },
      trainerAlle: () => push(trainerSeite()),
      hoer: () => push(hoerPage()),
      lernA: () => lernenAlles(),
      unterricht: () => push(unterrichtPage()),
      topic: tid => push(topicPage(tid)),
      weiter: () => { const pl = st.place(); if (pl.art === 'trainer' && pl.datei) openTrainer(pl.tid, 'trainer/' + pl.datei); else push(topicPage(pl.tid, pl.tab)); }
    });
  }
};
// Trainer nach Fach gruppiert, mit Anzahl und fälligen
function trainerOrdnerListe(today) {
  const ordner = new Map(), seen = new Set();
  for (const f of st.faecher()) for (const t of f.themen) for (const x of t.trainer || []) {
    if (seen.has(x.datei)) continue;
    seen.add(x.datei);
    const c = st.card('t:' + t.id);
    if (!ordner.has(f.id)) ordner.set(f.id, { f, n: 0, due: 0 });
    const o = ordner.get(f.id); o.n++; if (c && c.faellig <= today) o.due++;
  }
  return [...ordner.values()];
}
// Alle Trainer: gemischt oder in Ordnern nach Fach
function trainerSeite() {
  return {
    title: 'Trainer',
    render(b) {
      const today = dayStr();
      const tr = trainerOrdnerListe(today);
      let h = `<div class="tr-grid"><button class="tr-tile tr-all" data-a="trmix"><span class="tr-ic">${icon('mix')}</span><b>Alle Trainer gemischt</b><small>Aufgaben aus allen Trainern durcheinander, ohne Themenhinweis</small></button>`;
      h += tr.map(({ f, n, due }) => `<button class="tr-tile" data-a="ordner" data-d="${esc(f.id)}" style="--fc:${f.farbe}"><span class="tr-ic">${icon(fachIcon(f))}</span><b>${esc(f.kurz && f.kurz.length > 3 ? f.kurz : f.name)}</b><small>${plural(n, 'Trainer', 'Trainer')}${due ? ' · ' + due + ' fällig' : ''}</small></button>`).join('') + '</div>';
      b.innerHTML = h;
      on(b, { trmix: () => trainerGemischt(), ordner: fid => push(trainerOrdner(fid)) });
    }
  };
}
const kurzListe = n => n.length > 3 ? n.slice(0, 3).join(', ') + ' und ' + (n.length - 3) + ' weitere' : n.join(', ');
// Ordner eines Fachs: alle Trainer dieses Fachs, fällige zuerst
function trainerOrdner(fid) {
  return {
    title: (st.fach(fid) || { name: 'Trainer' }).name,
    render(b) {
      const f = st.fach(fid), today = dayStr();
      const by = new Map();
      for (const t of (f ? f.themen : [])) for (const x of t.trainer || []) {
        if (!by.has(x.datei)) by.set(x.datei, { x, t, namen: [], due: false });
        const o = by.get(x.datei), c = st.card('t:' + t.id);
        o.namen.push(t.name); if (c && c.faellig <= today) o.due = true;
      }
      const rows = [...by.values()].map(o => ({ due: o.due, html: row({ a: 'trainer', d: o.t.id + '|' + o.x.datei, icon: fachIcon(f), color: f.farbe, title: o.x.titel, sub: (o.due ? 'fällig · ' : '') + kurzListe(o.namen.map(n => n.replace(/^[^:]{3,30}:\s*/, ''))) }) }));
      rows.sort((a, c) => c.due - a.due);
      b.innerHTML = rows.length ? list(rows.map(r => r.html)) : empty('In diesem Fach gibt es keine Trainer.');
      on(b, { trainer: d => { const i = d.indexOf('|'); openTrainer(d.slice(0, i), d.slice(i + 1)); } });
    }
  };
}
// Zwei Wege zum Lernen auf der Startseite:
// Unterricht: nur die Themen, die gerade im Unterricht dran sind.
// Alles: alles, was schon einmal dran war, gemischt und ohne Themenhinweis.
const aktTids = () => st.kvGet('aktuell', []).filter(id => st.thema(id));
// Themen, die schon dran waren: angewählt oder schon einmal geübt
function gelernteTids() {
  const akt = new Set(aktTids());
  const nach = st.nacharbeitThemen();
  const fertig = new Set(st.abgeschlosseneTids());
  return st.allTids().filter(t => akt.has(t) || fertig.has(t) || nach.has(t) || st.card('t:' + t) || st.topicItems(t).some(i => st.card(i.id)));
}
// Lernzeit: n Fragen, min Minuten (dann endet die Runde sauber), rechnen Anzahl Rechenaufgaben
const ZEITEN = [['2', '2 Min'], ['5', '5 Min'], ['10', '10 Min'], ['20', '20 Min'], ['f10', '10 Fragen'], ['f20', '20 Fragen']];
const MINI = { n: 5, min: 2, rechnen: 0 };
export function lernzeit() {
  const v = prefs.get('lernzeit', '10');
  const z = { 2: MINI, 5: { n: 8, min: 5, rechnen: 2 }, 10: { n: 12, min: 10, rechnen: 6 }, 20: { n: 24, min: 20, rechnen: 12 }, f10: { n: 10, rechnen: 5 }, f20: { n: 20, rechnen: 10 } }[v];
  return z || { n: 12, min: 10, rechnen: 6 };
}
// Mindestens die Hälfte zum Mitrechnen: Rechen- und Umstellaufgaben, die du Schritt für Schritt löst
const zumRechnen = it => it.art === 'aufgabe' || it.art === 'umstellen';
// Eine Runde hat etwa 12 Übungen: 6 zum Mitrechnen, 6 andere. Fällige Übungen gehen vor.
export function mitRechnen(items, tids, n = 12, halb = n / 2) {
  const rechnen = items.filter(zumRechnen).slice(0, halb);
  const ids = new Set(items.map(i => i.id));
  if (rechnen.length < halb) rechnen.push(...mixAufgaben(tids, halb).filter(i => !ids.has(i.id)).slice(0, halb - rechnen.length));
  const rest = items.filter(i => !zumRechnen(i)).slice(0, n - rechnen.length);
  return shuffle([...rechnen, ...rest]);
}
// Rechenaufgaben verschiedener Themen im Wechsel, zuerst die mit Ansatz-Frage
function mixAufgaben(tids, n) {
  const pick = (lists, out) => { for (let r = 0; out.length < n && lists.some(l => l.length); r++) for (const l of lists) if (l.length && out.length < n) out.push(l.shift()); };
  const ts = shuffle([...tids]);
  const mitAnsatz = ts.map(t => shuffle(st.uebItems(t).filter(i => i.art === 'aufgabe' && i.aufgabe.ansatz))).filter(l => l.length);
  const rest = ts.map(t => shuffle(st.uebItems(t).filter(i => (i.art === 'aufgabe' && !i.aufgabe.ansatz) || i.art === 'umstellen'))).filter(l => l.length);
  const out = [];
  pick(mitAnsatz, out);
  pick(rest, out);
  return out;
}
export function unterrichtQueue() { const t = aktTids(); return t.length ? st.buildQueue(900, { tids: t, mitFehlern: true }) : { items: [], sekunden: 0 }; }
// Neue Karten nur aus Themen, die in einer Arbeit nicht gut liefen
export function allesQueue() { return st.buildQueue(900, { maxNeu: st.nacharbeitThemen().size ? 6 : 0 }); }
export function lernenUnterricht(z = lernzeit()) {
  const tids = aktTids();
  if (!tids.length) { toast('Wähl zuerst aus, was gerade im Unterricht dran ist.'); push(unterrichtPage()); return; }
  let items = unterrichtQueue().items;
  items = mitRechnen(items, tids, z.n, z.rechnen);
  if (!items.length) {
    items = sortForPractice(tids.flatMap(t => st.uebItems(t))).slice(0, z.n);
    if (items.length) toast('Gerade ist nichts fällig. Ich nehme Übungen aus deinen Unterrichtsthemen.');
  }
  if (!items.length) { toast('Für deine Unterrichtsthemen gibt es noch keine Übungen. Füge Inhalte über Einfügen hinzu.'); return; }
  runSession(items, 'Unterricht', { minutes: z.min, onClose: () => refreshTop() });
}
// Aufgaben aus allen Themen, zu denen es einen Trainer gibt, gemischt und ohne Themenhinweis
export function trainerGemischt() {
  const tids = st.allTids().filter(t => ((st.thema(t) || { thema: {} }).thema.trainer || []).length);
  const auf = mixAufgaben(tids, 7);
  const mc = shuffle(tids.flatMap(t => st.topicItems(t).filter(i => i.art === 'auswahl'))).slice(0, 3);
  const items = shuffle([...auf, ...mc]);
  if (!items.length) { toast('Für die Trainer gibt es noch keine Aufgaben.'); return; }
  runSession(items, 'Alle Trainer gemischt', { blind: true, onClose: () => refreshTop() });
}
// Alles wiederholen: etwa die Hälfte aus schwachen Themen, ein Drittel aus mittleren, der Rest aus sicheren.
// Fehlt eine Gruppe, bekommt die nächste ihren Anteil. Schwache Themen bekommen danach eine kurze Auffrischung.
export function lernenAlles(z = lernzeit()) {
  const tids = gelernteTids();
  if (!tids.length) { toast('Es war noch nichts dran. Fang mit Unterricht an.'); return; }
  const grp = { schwach: [], mittel: [], sicher: [] };
  for (const t of tids) grp[st.staerke(t).stufe].push(t);
  const N = z.n, ziel = { schwach: Math.round(N / 2), mittel: Math.round(N / 3), sicher: N - Math.round(N / 2) - Math.round(N / 3) };
  const anteil = z.rechnen / z.n;
  const due = allesQueue().items;
  const used = new Set();
  const take = (it, out) => { if (used.has(it.id)) return; used.add(it.id); out.push(it); };
  const pickFor = (ts, n, mitLosen) => {
    const set = new Set(ts), out = [];
    // Erst die Hälfte zum Mitrechnen: fällige Rechenaufgaben, dann neue
    const halb = Math.ceil(n * anteil), rechnen = () => out.filter(zumRechnen).length;
    for (const it of due) if (rechnen() < halb && zumRechnen(it) && set.has(it.tid)) take(it, out);
    for (const it of mixAufgaben(ts, halb)) if (rechnen() < halb) take(it, out);
    for (const it of due) if (out.length < n && (set.has(it.tid) || (mitLosen && it.art === 'fehler' && !st.thema(it.tid)))) take(it, out);
    if (anteil) for (const it of mixAufgaben(ts, n)) if (out.length < n) take(it, out);
    for (const it of sortForPractice(ts.flatMap(t => st.uebItems(t)))) { if (out.length >= n) break; take(it, out); }
    return out;
  };
  let items = [], rest = 0;
  for (const g of ['schwach', 'mittel', 'sicher']) {
    const n = ziel[g] + rest;
    const got = grp[g].length ? pickFor(grp[g], n, g === 'schwach') : [];
    items = items.concat(got);
    rest = n - got.length;
  }
  if (items.length < N) items = items.concat(pickFor(tids, N - items.length, true));
  items = shuffle(items);
  // Nach der ersten Übung eines schwachen Themas: kurz Merksätze und Schnellweg
  const schwach = new Set(grp.schwach), done = new Set(), out = [];
  for (const it of items) {
    out.push(it);
    if (schwach.has(it.tid) && !done.has(it.tid)) { done.add(it.tid); const T = st.topic(it.tid); if (T.merksaetze.length || T.schnellwege.length) out.push({ id: 'auffrischen:' + it.tid, art: 'auffrischen', tid: it.tid }); }
  }
  if (!out.length) { toast('Gerade gibt es nichts zu wiederholen.'); return; }
  runSession(out.slice(0, N + 3), 'Alles wiederholen', { blind: true, minutes: z.min, onClose: () => refreshTop() });
}

/* ===== Fächer ===== */
const modLabel = ms => (ms || []).map(m => (m === 'Ü' ? 'übergreifend' : m)).join(', ');
let faecherView = 'faecher';
const faecherRoot = {
  title: 'Fächer',
  render(b) {
    let h = seg('view', [['faecher', 'Fächer'], ['module', 'Nach Modulen']], faecherView);
    const fachRow = f => {
      const n = f.themen.length, v = f.themen.filter(t => st.status(t.id) !== 'geplant').length;
      return row({ a: 'fach', d: f.id, icon: fachIcon(f), color: f.farbe, title: f.name, sub: [modLabel(f.module), n ? v + ' von ' + n + ' Themen vorhanden' : 'Noch leer, kommt über Einfügen'].filter(Boolean).join(' · '), html: progress(fachProgress(f), f.farbe) });
    };
    const tile = f => {
      const n = f.themen.length, v = f.themen.filter(t => st.status(t.id) !== 'geplant').length, a = f.themen.filter(t => st.status(t.id) === 'aktuell').length;
      return `<button class="ftile" data-a="fach" data-d="${esc(f.id)}" style="--fc:${f.farbe}"><span class="ftile-ic">${icon(fachIcon(f))}</span><span class="ftile-t">${esc(f.name)}</span>
        <span class="ftile-s">${a ? a + ' aktuell · ' : ''}${n ? v + ' von ' + n + ' Themen' : 'Kommt über Einfügen'}</span>${progress(fachProgress(f), f.farbe)}</button>`;
    };
    const nAkt = st.kvGet('aktuell', []).filter(id => st.thema(id)).length;
    h += list([row({ a: 'unterricht', icon: 'check', color: '#0A84FF', title: 'Im Unterricht', sub: nAkt ? plural(nAkt, 'Thema', 'Themen') + ' angewählt' : 'Themen für den Unterricht anwählen' })]);
    if (faecherView === 'faecher') h += `<div class="fach-grid">${st.faecher().map(tile).join('')}</div>`;
    else {
      for (const m of st.S.plan.module) {
        const fs = st.faecher().filter(f => (f.module || []).includes(m.id));
        if (!fs.length) continue;
        h += `<div class="sec-h">${esc(m.id === 'Ü' ? '' : m.id + ' ')}${esc(m.name)}</div>` + list(fs.map(fachRow), 'fach-list');
        if (m.klasse) h += `<div class="sec-f">Klasse ${esc(m.klasse)}${m.stunden ? ', ' + m.stunden + ' Stunden' : ''}</div>`;
      }
      const ohne = st.faecher().filter(f => !(f.module || []).length);
      if (ohne.length) h += `<div class="sec-h">Ohne Modul</div>` + list(ohne.map(fachRow), 'fach-list');
      h += `<p class="src">Module und Zuordnung änderst du unter Mehr, Lehrplan bearbeiten.</p>`;
    }
    b.innerHTML = h;
    on(b, { 'seg:view': v => { faecherView = v; this.render(b); }, fach: id => push(fachPage(id)), unterricht: () => push(unterrichtPage()) });
  }
};
export function fachPage(fid) {
  return {
    title: (st.fach(fid) || { name: 'Fach' }).name,
    render(b) {
      const f = st.fach(fid);
      if (!f) { b.innerHTML = empty('Dieses Fach gibt es nicht mehr.'); return; }
      const g = { aktuell: [], abgeschlossen: [], vorhanden: [], geplant: [] };
      for (const t of f.themen) g[st.status(t.id)].push(t);
      const tRow = t => {
        const items = st.topicItems(t.id);
        const due = items.filter(i => { const c = st.card(i.id); return c && c.faellig <= dayStr(); }).length;
        const bits = [];
        if (t.trainer && t.trainer.length) bits.push('Trainer');
        const k = items.filter(i => i.art === 'karte' || i.art === 'begriff').length, a = items.length - k;
        if (k) bits.push(plural(k, 'Karte', 'Karten'));
        if (a) bits.push(plural(a, 'Übung', 'Übungen'));
        if (due) bits.push(due + ' fällig');
        const p = topicProgress(t.id);
        const nurIntro = st.status(t.id) === 'geplant' && st.isIntroOnly(t.id);
        if (nurIntro) bits.unshift('Einführung lesen');
        return row({ a: 'topic', d: t.id, title: t.name, sub: bits.join(' · ') || 'noch leer', html: items.length && !nurIntro ? stapel(standVon(items, st.card), { hoch: 7 }) : p != null && !nurIntro ? progress(p, f.farbe) : '' });
      };
      // Stand des ganzen Fachs: neu, wackelt, sitzt
      const fachItems = f.themen.filter(t => !(st.status(t.id) === 'geplant' && st.isIntroOnly(t.id))).flatMap(t => st.topicItems(t.id));
      let h = `<div class="chips"><span class="chip chip-ic" style="background:${f.farbe}">${icon(fachIcon(f))}${esc(f.kurz || f.name)}</span>${(f.module || []).map(m => `<span class="chip ghost">${esc(m === 'Ü' ? 'übergreifend' : m)}</span>`).join('')}${f.hinweis ? `<span class="chip ghost">${esc(f.hinweis)}</span>` : ''}</div>`;
      const intro = st.fachIntro(f.id);
      if (intro) {
        const parts = intro.split(/\n\s*\n/);
        h += `<div class="card intro" style="--fc:${f.farbe}"><div class="card-k">Worum es in diesem Fach geht</div><div class="prose">${markdown(parts[0])}</div>${parts.length > 1 ? `<details class="more"><summary>Weiterlesen</summary><div class="prose">${markdown(parts.slice(1).join('\n\n'))}</div></details>` : ''}${canSpeak() ? `<button class="btn small" data-a="introvor">${icon('ear')} Vorlesen</button>` : ''}</div>`;
      }
      if (fachItems.some(i => st.card(i.id))) h += `<div class="sec-h">Stand im Fach</div><div class="card">${stapel(standVon(fachItems, st.card), { hoch: 12, legende: true })}<p class="muted small">Sitzt heißt: kommt erst in 4 oder mehr Tagen wieder.</p></div>`;
      if (g.aktuell.length) h += `<div class="sec-h">Aktuell im Unterricht</div>` + list(g.aktuell.map(tRow));
      if (g.abgeschlossen.length) h += `<div class="sec-h">Abgeschlossen</div>` + list(g.abgeschlossen.map(tRow));
      if (g.vorhanden.length) h += `<div class="sec-h">Vorhanden</div>` + list(g.vorhanden.map(tRow));
      if (g.geplant.length) h += `<div class="sec-h">Kommt noch</div>` + list(g.geplant.map(tRow));
      if (!f.themen.length) h += empty('Noch keine Themen.', 'Füge einen Lernwerk-Block oder einen Lernzettel über Einfügen hinzu.');
      h += `<div class="sec-f">Unter Im Unterricht legst du fest, was gerade dran ist und was abgeschlossen ist.</div>`;
      b.innerHTML = h;
      on(b, { topic: tid => push(topicPage(tid)), introvor: () => readAloud(plainText(st.fachIntro(f.id)), f.name) });
    }
  };
}

/* ===== Einfügen ===== */
let insMode = 'block';
let insText = '';
let insResult = null;
let insNote = { text: '', titel: '', fid: '', tid: '', neu: '' };
const einfuegen = {
  title: 'Einfügen',
  render(b) {
    let h = seg('mode', [['block', 'Lernwerk-Block'], ['zettel', 'Lernzettel'], ['foto', 'Foto']], insMode) + '<div class="ins-body"></div>';
    b.innerHTML = h;
    const body = $('.ins-body', b);
    const draw = () => (insMode === 'block' ? drawBlock(body) : insMode === 'zettel' ? drawZettel(body) : drawFoto(body));
    on(b, { 'seg:mode': v => { insMode = v; draw(); } });
    draw();
  }
};
function drawBlock(el) {
  el.innerHTML = `
    <button class="paste-big" data-a="paste">${icon('paste')}<span><b>Aus Zwischenablage einfügen</b><small>Block im Chat kopieren, hier tippen, fertig.</small></span></button>
    <div class="preview"></div>
    <div class="card how"><p><b>So geht es:</b> Vorlage kopieren, im Claude-Chat zusammen mit deinem Material einfügen, den Block aus der Antwort kopieren und oben einfügen.</p>
      <button class="btn" data-a="tpl">${icon('copy')} Vorlage für Claude kopieren</button></div>
    <div class="sec-h">Block von Hand einfügen</div>
    <textarea class="big-ta" rows="7" placeholder="=== LERNWERK ===&#10;Fach: …&#10;Thema: …" data-k="block">${esc(insText)}</textarea>
    <div class="btn-row"><button class="btn" data-a="clear">Leeren</button></div>`;
  const ta = $('[data-k="block"]', el);
  const pv = $('.preview', el);
  let parsed = null, zu = [];
  const update = () => {
    insText = ta.value;
    if (!ta.value.trim()) { pv.innerHTML = ''; parsed = null; return; }
    parsed = parseBlocks(ta.value);
    zu = parsed.themen.map(t => {
      const f = st.findFach(t.fach);
      const th = f ? st.suggestThema(f, t.thema) : null;
      return { topic: t, fachId: f ? f.id : '', themaId: th ? th.id : '' };
    });
    drawPreview();
  };
  const fachOpts = (sel, name) => `<option value="">Neues Fach: ${esc(name)}</option>` + st.faecher().map(f => `<option value="${f.id}" ${f.id === sel ? 'selected' : ''}>${esc(f.name)}</option>`).join('');
  const themaOpts = (fid, sel, name) => { const f = st.fach(fid); return `<option value="">Neues Thema: ${esc(name)}</option>` + (f ? f.themen.map(t => `<option value="${t.id}" ${t.id === sel ? 'selected' : ''}>${esc(t.name)}</option>`).join('') : ''); };
  function drawPreview() {
    const r = parsed;
    let h = '';
    if (!r.themen.length && !r.termine.length) h += `<div class="fb bad">Ich finde keinen Lernwerk-Block. Er beginnt mit „=== LERNWERK ===“ oder mit den Zeilen „Fach:“ und „Thema:“.</div>`;
    // Prüfzeile und Ende: Ist alles angekommen?
    if (r.abgeschnitten || r.luecken.length) h += `<div class="fb bad pv-check"><b>Da fehlt etwas.</b>${r.abgeschnitten ? '<div>Die Zeile „=== ENDE ===“ fehlt. Der Block wirkt abgeschnitten. Kopier ihn im Chat noch einmal ganz.</div>' : ''}${r.luecken.map(x => `<div>${esc(x.thema)}: ${x.ist} von ${x.soll} ${esc(x.name)} angekommen.</div>`).join('')}<div class="muted small">Du kannst trotzdem speichern. Den Rest fügst du später einfach dazu, doppelte Einträge lasse ich weg.</div></div>`;
    else if (r.themen.length && /^\s*inhalt\s*:/im.test(ta.value)) h += `<div class="fb good">Alles angekommen, wie in der Zeile „Inhalt“ angegeben.</div>`;
    r.themen.forEach((t, i) => {
      const z = zu[i];
      const ziel = z.themaId ? 'ergänzt ein vorhandenes Thema' : 'legt ein neues Thema an';
      h += `<div class="card pv"><div class="pv-t">${esc(t.fach)}, ${esc(t.thema)}: ${esc(summary(t))}.</div><div class="muted small">Das ${ziel}. Doppelte Einträge lasse ich weg.</div>
        <label class="fld"><span>Fach</span><select data-i="${i}" data-k="fach">${fachOpts(z.fachId, t.fach)}</select></label>
        <label class="fld"><span>Thema</span><select data-i="${i}" data-k="thema">${themaOpts(z.fachId, z.themaId, t.thema)}</select></label></div>`;
    });
    if (r.termine.length) h += `<div class="card pv"><div class="pv-t">${plural(r.termine.length, 'Termin', 'Termine')}</div>${r.termine.map(x => `<div>${esc(x.fach)}: ${esc(dayLong(x.datum))}${x.themen ? ', ' + esc(x.themen) : ''}</div>`).join('')}</div>`;
    if (r.fehler.length) h += `<div class="fb bad"><b>${plural(r.fehler.length, 'Problem', 'Probleme')} beim Lesen:</b>${r.fehler.map(e => `<div class="pv-err">Zeile ${e.zeile}: ${esc(e.meldung)}${e.text ? `<code>${esc(e.text.slice(0, 80))}</code>` : ''}</div>`).join('')}</div>`;
    if (r.hinweise.length) h += `<details class="disc"><summary>${plural(r.hinweise.length, 'Hinweis', 'Hinweise')}</summary>${r.hinweise.map(e => `<div class="pv-err">Zeile ${e.zeile}: ${esc(e.meldung)}</div>`).join('')}</details>`;
    if (r.themen.length || r.termine.length) h += `<button class="btn filled wide" data-a="save">Speichern?</button>`;
    pv.innerHTML = h;
    $$('select', pv).forEach(s => s.addEventListener('change', () => {
      const z = zu[+s.dataset.i];
      if (s.dataset.k === 'fach') { z.fachId = s.value; const f = st.fach(s.value); const th = f ? st.suggestThema(f, z.topic.thema) : null; z.themaId = th ? th.id : ''; }
      else z.themaId = s.value;
      drawPreview();
    }));
  }
  let tmr = null;
  ta.addEventListener('input', () => { clearTimeout(tmr); tmr = setTimeout(update, 250); });
  on(el, {
    tpl: async () => { const ok = await copyText(TEMPLATE); toast(ok ? 'Vorlage kopiert. Im Chat einfügen und dein Material darunter.' : 'Kopieren hat nicht geklappt.'); },
    paste: async () => {
      const t = await readClipboard();
      if (t == null) { toast('Tippe ins Feld und wähle Einsetzen.'); ta.focus(); return; }
      if (!t.trim()) { toast('Die Zwischenablage ist leer. Kopier den Block im Chat.'); return; }
      ta.value = t; update();
    },
    clear: () => { ta.value = ''; update(); },
    save: async () => {
      if (!parsed) return;
      const p = parsed;
      ta.value = ''; insText = ''; parsed = null;
      const res = await st.saveBlocks(zu, p.termine);
      const n = res.reduce((s, x) => s + x.added, 0);
      toast(res.length ? 'Gespeichert: ' + res.map(x => x.thema.name).join(', ') + (n ? ' (' + plural(n, 'neuer Eintrag', 'neue Einträge') + ')' : ' (nichts Neues)') : 'Termine gespeichert.');
      insResult = res.map(x => ({ tid: x.thema.id, name: x.thema.name, fach: x.fach.name, farbe: x.fach.farbe }));
      import('./sicherung.js').then(m => m.anstossen()).catch(() => {});
      refreshTop();
    },
    open: tid => { showTab('faecher'); push(topicPage(tid)); }
  });
  if (insText) update();
  else if (insResult && insResult.length) pv.innerHTML = `<div class="sec-h">Gerade gespeichert</div>` + list(insResult.map(x => row({ a: 'open', d: x.tid, dot: x.farbe, title: x.name, sub: x.fach + ' · öffnen' })));
  ta.addEventListener('input', () => { insResult = null; }, { once: true });
}
function pickerHTML(fid, tid, neu) {
  const f = st.fach(fid);
  return `<label class="fld"><span>Fach</span><select data-k="pf"><option value="">Fach wählen</option>${st.faecher().map(x => `<option value="${x.id}" ${x.id === fid ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>
    <label class="fld"><span>Thema</span><select data-k="pt" ${f ? '' : 'disabled'}><option value="">${f ? 'Neues Thema anlegen' : 'Erst ein Fach wählen'}</option>${f ? f.themen.map(t => `<option value="${t.id}" ${t.id === tid ? 'selected' : ''}>${esc(t.name)}</option>`).join('') : ''}</select></label>
    ${f && !tid ? `<label class="fld"><span>Name des neuen Themas</span><input type="text" data-k="pn" value="${esc(neu || '')}" placeholder="Zum Beispiel: Kondensator"></label>` : ''}`;
}
async function resolvePick(o) {
  const f = st.fach(o.fid);
  if (!f) { toast('Bitte zuerst ein Fach wählen.'); return null; }
  if (o.tid) return o.tid;
  if (!o.neu || !o.neu.trim()) { toast('Bitte ein Thema wählen oder einen Namen eingeben.'); return null; }
  const ex = f.themen.find(t => t.name.toLowerCase() === o.neu.trim().toLowerCase());
  return ex ? ex.id : (await st.addThema(f, o.neu.trim())).id;
}
function bindPicker(el, o, redraw) {
  const pf = $('[data-k="pf"]', el), pt = $('[data-k="pt"]', el), pn = $('[data-k="pn"]', el);
  pf.onchange = () => { o.fid = pf.value; o.tid = ''; redraw(); };
  pt.onchange = () => { o.tid = pt.value; redraw(); };
  if (pn) pn.oninput = () => { o.neu = pn.value; };
}
function drawZettel(el) {
  const o = insNote;
  el.innerHTML = `<div class="card how"><p>Eine Erklärung aus dem Chat einfach einfügen, Fach und Thema wählen, speichern. Fettschrift und Listen werden sauber dargestellt.</p></div>
    <textarea class="big-ta" rows="10" data-k="text" placeholder="Erklärung hier einfügen">${esc(o.text)}</textarea>
    <div class="btn-row"><button class="btn" data-a="paste">${icon('paste')} Aus Zwischenablage einfügen</button><button class="btn" data-a="prev">Vorschau</button></div>
    <div class="zprev"></div>
    <label class="fld"><span>Titel (optional)</span><input type="text" data-k="titel" value="${esc(o.titel)}"></label>
    ${pickerHTML(o.fid, o.tid, o.neu)}
    <button class="btn filled wide" data-a="save">Lernzettel speichern</button>`;
  const ta = $('[data-k="text"]', el);
  ta.oninput = () => { o.text = ta.value; };
  $('[data-k="titel"]', el).oninput = e => { o.titel = e.target.value; };
  bindPicker(el, o, () => drawZettel(el));
  on(el, {
    paste: async () => { const t = await readClipboard(); if (t == null) { toast('Tippe ins Feld und wähle Einsetzen.'); ta.focus(); return; } ta.value = t; o.text = t; },
    prev: () => { $('.zprev', el).innerHTML = o.text.trim() ? `<div class="card prose">${markdown(o.text)}</div>` : ''; },
    save: async () => {
      if (!o.text.trim()) { toast('Der Text ist noch leer.'); return; }
      const tid = await resolvePick(o);
      if (!tid) return;
      const n = await st.saveNote({ tid, titel: o.titel.trim() || firstLine(o.text), text: o.text });
      import('./sicherung.js').then(m => m.anstossen()).catch(() => {});
      insNote = { text: '', titel: '', fid: o.fid, tid: '', neu: '' };
      toast('Lernzettel gespeichert.');
      drawZettel(el);
      noteReader(n.id);
    }
  });
}
let insFoto = { fid: '', tid: '', neu: '', titel: '' };
function drawFoto(el) {
  const o = insFoto;
  el.innerHTML = `<div class="card how"><p>Foto einer Mitschrift oder eines Arbeitsblatts einem Thema zuordnen. Es bleibt nur auf diesem Gerät.</p></div>
    ${pickerHTML(o.fid, o.tid, o.neu)}
    <label class="fld"><span>Titel (optional)</span><input type="text" data-k="titel" value="${esc(o.titel)}" placeholder="Zum Beispiel: Arbeitsblatt 3"></label>
    <label class="btn filled wide">${icon('photo')} Foto aufnehmen oder auswählen<input type="file" accept="image/*" data-k="file" hidden></label>`;
  bindPicker(el, o, () => drawFoto(el));
  $('[data-k="titel"]', el).oninput = e => { o.titel = e.target.value; };
  $('[data-k="file"]', el).addEventListener('change', async e => {
    const files = [...e.target.files];
    if (!files.length) return;
    const tid = await resolvePick(o);
    if (!tid) return;
    for (const file of files) await st.savePhoto(tid, await shrinkImage(file), o.titel || file.name || '');
    toast(plural(files.length, 'Foto', 'Fotos') + ' gespeichert.');
    insFoto = { fid: o.fid, tid, neu: '', titel: '' };
    drawFoto(el);
  });
}

/* ===== Fehlerbuch ===== */
let fbFach = '';
export const FEHLERARTEN = ['Einheit (Faktor 1000)', 'Vorzeichen', 'Quadrant beim Arcustangens', 'Taschenrechner auf RAD', 'Komma verrutscht', 'Kehrwert', 'Wurzel oder Quadrat', 'Mal und geteilt verwechselt', 'Nur eine Seite umgeformt', 'Zu früh gerundet', 'Falsche Regel gewählt', 'Aufgabe falsch verstanden', 'Fachbegriff verwechselt', 'Rechenweg', 'Flüchtigkeitsfehler', 'Sonstiges'];
const fehlerbuch = {
  title: 'Fehlerbuch',
  render(b) {
    const errs = st.S.errors.filter(e => !fbFach || (st.thema(e.tid) || {}).fach && st.thema(e.tid).fach.id === fbFach || (!st.thema(e.tid) && e.fach === (st.fach(fbFach) || {}).name));
    const offen = errs.filter(e => !e.erledigt);
    const due = st.S.errors.filter(e => !e.erledigt && (st.card('f:' + e.id) || {}).faellig <= dayStr()).length;
    let h = `<div class="btn-row"><button class="btn filled" data-a="ueben">${icon('cards')} Fehlerkarten üben${due ? ' (' + due + ' fällig)' : ''}</button><button class="btn" data-a="neu">${icon('edit')} Fehler eintragen</button></div>`;
    const fs = st.faecher().filter(f => st.S.errors.some(e => (st.thema(e.tid) || {}).fach === f || e.fach === f.name));
    if (fs.length > 1) h += `<label class="fld inline"><span>Fach</span><select data-k="ff"><option value="">Alle Fächer</option>${fs.map(f => `<option value="${f.id}" ${f.id === fbFach ? 'selected' : ''}>${esc(f.name)}</option>`).join('')}</select></label>`;
    if (!errs.length) h += empty('Noch keine Fehler eingetragen.', 'Fehler aus den Übungen und Trainern landen automatisch hier. Fehler aus einer zurückgegebenen Klassenarbeit trägst du oben selbst ein.');
    else {
      const groups = new Map();
      for (const e of offen) { if (!groups.has(e.fehlerart)) groups.set(e.fehlerart, []); groups.get(e.fehlerart).push(e); }
      const sorted = [...groups].sort((a, b) => b[1].length - a[1].length);
      if (sorted.length) h += `<div class="card pattern"><div class="card-k">Dein Muster</div><p>Häufigster Fehler: <b>${esc(sorted[0][0])}</b>, ${plural(sorted[0][1].length, 'Mal', 'Mal')}.${tipFor(sorted[0][0])}</p>${sorted[1] ? `<p class="muted small">Danach: ${sorted.slice(1, 3).map(([k, es]) => esc(k) + ' (' + es.length + ')').join(', ')}</p>` : ''}</div>`;
      // Diagramme: wo die Fehler liegen und ob sie weniger werden
      if (sorted.length > 1) h += `<div class="sec-h">Offene Fehler nach Art</div><div class="card">${balken(sorted.slice(0, 6).map(([k, es]) => ({ name: k, n: es.length, text: String(es.length) })))}</div>`;
      const woche = 7 * 86400000, mo = new Date(); mo.setHours(0, 0, 0, 0); mo.setDate(mo.getDate() - ((mo.getDay() + 6) % 7));
      const wochen = Array.from({ length: 8 }, (_, k) => { const von = mo.getTime() - (7 - k) * woche; return { von, bis: von + woche }; });
      const proWoche = wochen.map((w, k) => ({ label: k === 7 ? 'jetzt' : 'KW ' + kw(new Date(w.von)), n: errs.filter(e => e.zeit >= w.von && e.zeit < w.bis).length, aktiv: k === 7 }));
      if (errs.length >= 3 && proWoche.filter(x => x.n).length >= 2) h += `<div class="sec-h">Neue Fehler pro Woche</div><div class="card">${saeulen(proWoche, { titel: 'Neue Fehler pro Woche', hoch: 80 })}<p class="muted small">Werden die Säulen kleiner, wirkt das Üben.</p></div>`;
      for (const [art, es] of sorted) {
        h += `<div class="sec-h">${esc(art)} · ${es.length}</div>` + list(es.sort((a, b) => b.zeit - a.zeit).map(e => row({ a: 'err', d: e.id, title: e.aufgabe || '(ohne Aufgabentext)', sub: [e.thema || e.fach, new Date(e.zeit).toLocaleDateString('de-DE'), e.quelle === 'trainer' ? 'Trainer' : e.quelle === 'manuell' ? 'selbst eingetragen' : ''].filter(Boolean).join(' · ') })));
      }
      const erl = errs.filter(e => e.erledigt);
      if (erl.length) h += `<details class="disc"><summary>Verstanden (${erl.length})</summary>${list(erl.map(e => row({ a: 'err', d: e.id, title: e.aufgabe || e.fehlerart, sub: e.fehlerart })))}</details>`;
    }
    b.innerHTML = h;
    const ff = $('[data-k="ff"]', b);
    if (ff) ff.onchange = () => { fbFach = ff.value; this.render(b); };
    on(b, {
      ueben: () => { const items = st.S.errors.filter(e => !e.erledigt).map(st.errorItem); runSession(sortForPractice(items).slice(0, 20), 'Fehlerkarten', { onClose: () => refreshTop() }); },
      neu: () => errorEditor({}),
      err: id => errorDetail(id)
    });
  }
};
// Kalenderwoche nach ISO 8601
function kw(d) { const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const n = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - n); const j = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return Math.ceil(((t - j) / 86400000 + 1) / 7); }
function tipFor(art) {
  const t = {
    'Einheit (Faktor 1000)': ' Schreib vor dem Rechnen jede Größe in der Grundeinheit auf: A statt mA, N statt kN, m statt mm.',
    Vorzeichen: ' Zeichne vorher die Richtung ein und leg fest, was positiv ist.',
    'Quadrant beim Arcustangens': ' Prüf nach jedem Arcustangens, ob x und y positiv oder negativ sind.',
    'Taschenrechner auf RAD': ' Schau vor jeder Arbeit, ob oben im Display D oder DEG steht.',
    'Mal und geteilt verwechselt': ' Was auf der einen Seite mal steht, kommt auf der anderen Seite geteilt an.',
    'Zu früh gerundet': ' Rechne mit allen Stellen weiter und runde erst am Ende.'
  }[art];
  return t || '';
}
function errorDetail(id) {
  openSheet({
    title: 'Fehler',
    render(b, api) {
      const e = st.S.errors.find(x => x.id === id);
      if (!e) { api.close(); return; }
      b.innerHTML = list([
        row({ title: 'Fach und Thema', sub: [e.fach, e.thema].filter(Boolean).join(', ') || 'nicht zugeordnet' }),
        row({ title: 'Aufgabe', sub: e.aufgabe || '–' }),
        row({ title: 'Meine Eingabe', sub: e.eingabe || '–' }),
        row({ title: 'Richtig wäre', sub: e.richtig || '–' }),
        row({ title: 'Fehlerart', sub: e.fehlerart }),
        ...(e.notiz ? [row({ title: 'Hinweis', sub: e.notiz })] : [])
      ]) + `<div class="btn-col"><button class="btn filled" data-a="claude">${icon('claude')} Frag Claude</button>
        <button class="btn" data-a="done">${e.erledigt ? 'Wieder als offen markieren' : icon('check') + ' Verstanden, nicht mehr abfragen'}</button>
        <button class="btn" data-a="edit">${icon('edit')} Bearbeiten</button><button class="btn danger" data-a="del">${icon('trash')} Löschen</button></div>`;
      on(b, {
        claude: () => askClaude(`Ich übe in Lernwerk: ${e.fach}, ${e.thema}. Aufgabe: ${e.aufgabe}. Meine Eingabe: ${e.eingabe || 'keine'}. Die App meldet einen Fehler (${e.fehlerart})${e.notiz ? ': ' + e.notiz : ''}.${e.richtig ? ' Richtig wäre laut App: ' + e.richtig + '.' : ''} Erklär mir nach meinem Schulskill, wo mein Denkfehler liegt, ohne vorzurechnen.`),
        done: async () => { e.erledigt = !e.erledigt; await st.updateError(e); api.close(); toast(e.erledigt ? 'Als verstanden markiert.' : 'Wieder offen.'); refreshTop(); },
        edit: () => { api.close(); errorEditor(e); },
        del: async () => { if (await confirmBox('Fehler wirklich löschen?', 'Löschen', true)) { await st.deleteError(id); api.close(); refreshTop(); } }
      });
    }
  });
}
function errorEditor(e0) {
  const e = Object.assign({ fid: '', tid: e0.tid || '', neu: '' }, e0);
  if (e.tid && st.thema(e.tid)) e.fid = st.thema(e.tid).fach.id;
  openSheet({
    title: e0.id ? 'Fehler bearbeiten' : 'Fehler eintragen', full: true,
    render(b, api) {
      const draw = () => {
        b.innerHTML = `<div class="form">${pickerHTML(e.fid, e.tid, e.neu)}
          <label class="fld"><span>Aufgabe</span><textarea data-k="aufgabe" rows="3" placeholder="Was war die Aufgabe?">${esc(e.aufgabe || '')}</textarea></label>
          <label class="fld"><span>Meine Eingabe</span><input type="text" data-k="eingabe" value="${esc(e.eingabe || '')}"></label>
          <label class="fld"><span>Richtig wäre</span><input type="text" data-k="richtig" value="${esc(e.richtig || '')}"></label>
          <label class="fld"><span>Fehlerart</span><select data-k="fehlerart">${FEHLERARTEN.map(a => `<option ${a === e.fehlerart ? 'selected' : ''}>${esc(a)}</option>`).join('')}${e.fehlerart && !FEHLERARTEN.includes(e.fehlerart) ? `<option selected>${esc(e.fehlerart)}</option>` : ''}</select></label>
          <label class="fld"><span>Worauf ich achten muss</span><textarea data-k="notiz" rows="2">${esc(e.notiz || '')}</textarea></label>
          <button class="btn filled" data-a="save">Speichern</button></div>`;
        bindPicker(b, e, () => { grab(); draw(); });
      };
      const grab = () => ['aufgabe', 'eingabe', 'richtig', 'fehlerart', 'notiz'].forEach(k => { const x = $(`[data-k="${k}"]`, b); if (x) e[k] = x.value; });
      draw();
      on(b, {
        save: async () => {
          grab();
          let tid = e.tid;
          if (e.fid && !tid && e.neu) tid = await resolvePick(e);
          const th = tid ? st.thema(tid) : null;
          const f = st.fach(e.fid);
          const data = { tid: tid || '', fach: th ? th.fach.name : f ? f.name : '', thema: th ? th.thema.name : '', aufgabe: e.aufgabe, eingabe: e.eingabe, richtig: e.richtig, fehlerart: e.fehlerart || 'Sonstiges', notiz: e.notiz };
          if (e0.id) { Object.assign(e0, data); await st.updateError(e0); }
          else await st.addError(Object.assign(data, { quelle: 'manuell' }));
          api.close(); toast('Gespeichert. Wird zur Fehlerkarte.'); refreshTop();
        }
      });
    }
  });
}

/* ===== Start ===== */
async function boot() {
  applyTheme(prefs.get('theme', 'auto'));
  document.body.addEventListener('touchstart', () => {}, { passive: true });
  try { await st.init(); } catch (e) { console.error(e); document.getElementById('boot').textContent = 'Lernwerk konnte nicht starten: ' + e.message; return; }
  await skizzenLaden();
  document.getElementById('boot').remove();
  window.__lw = { showTab, VERSION };
  initTabs({ heute, faecher: faecherRoot, plus: einfuegen, fehler: fehlerbuch, mehr: mehrPage() });
  $$('.tabbar [data-tab]').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));
  showTab('heute');
  initEdgeSwipe();
  initTabSwipe();
  st.onChange(() => refreshAll());
  // Zurück aus einem alten Trainer: Thema wieder öffnen
  const ret = prefs.get('return', null);
  if (ret && Date.now() - ret.zeit < 3 * 3600 * 1000 && st.thema(ret.tid)) { showTab('faecher'); push(topicPage(ret.tid)); }
  prefs.set('return', null);
  const recheck = async () => { if (document.visibilityState === 'visible') { const n = await st.ingestInbox(); if (n) { refreshAll(); sicherung.anstossen(); } } };
  document.addEventListener('visibilitychange', recheck);
  window.addEventListener('pageshow', recheck);
  registerSW();
  sicherung.start();
  sicherung.beobachten(() => { if (tab() === 'heute') refreshTop(); });
  const neu = prefs.get('aktualisiert', null);
  if (neu) { prefs.set('aktualisiert', null); setTimeout(() => toast('Lernwerk wurde aktualisiert.'), 600); }
}

// Automatische Updates: Beim Öffnen und beim Zurückkehren in die App wird nach einer neuen Version
// gesucht. Sie wird im Hintergrund geladen und sofort aktiv. Neu geladen wird nur, wenn gerade
// nichts offen ist (keine Übung, keine Eingabe). Sonst wartet die App auf den nächsten ruhigen Moment.
function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  const hadController = !!navigator.serviceWorker.controller;
  let pending = false, reloaded = false;
  const ruhig = () => !document.body.classList.contains('sheet-open') && !(document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName));
  const reload = () => { if (reloaded) return; reloaded = true; prefs.set('aktualisiert', VERSION); location.reload(); };
  const tryReload = () => { if (pending && ruhig()) reload(); };
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(reg => {
    if (!reg) return;
    const check = () => reg.update().catch(() => {});
    setInterval(check, 30 * 60 * 1000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { check(); tryReload(); } });
    if (reg.waiting) reg.waiting.postMessage('skipWaiting');
  }).catch(e => console.warn('Service Worker', e));
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) return; // allererster Start: nichts neu laden
    pending = true;
    if (ruhig()) return reload();
    const bar = document.getElementById('update');
    bar.textContent = 'Neue Version bereit. Sie lädt, wenn du fertig bist, oder tippe hier.';
    bar.classList.add('on');
    bar.onclick = reload;
  });
  // Nach einer Übung oder beim Verlassen eines Feldes nachholen
  document.addEventListener('focusout', () => setTimeout(tryReload, 300));
  new MutationObserver(tryReload).observe(document.body, { attributes: true, attributeFilter: ['class'] });
}

boot();
