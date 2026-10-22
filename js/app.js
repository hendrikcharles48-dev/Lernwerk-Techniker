// Lernwerk Techniker: App-Hülle mit Heute, Fächer, Einfügen, Fehlerbuch und Mehr.
import { esc, dayStr, dayLong, daysBetween, plural, fmtNum, markdown, plainText, uid } from './util.js';
import { parseBlocks, summary, TEMPLATE } from './parser.js';
import * as st from './store.js';
import { $, $$, icon, row, list, seg, sw, empty, on, push, initTabs, showTab, tab, openSheet, toast, copyText, readClipboard, progress, confirmBox, refreshAll, refreshTop, initEdgeSwipe, hinweisTabellenbuch } from './ui.js';
import { topicPage, runSession, sortForPractice, fachProgress, topicProgress, openTrainer, askClaude, shrinkImage, noteReader, firstLine, itemTitle } from './engine.js';
import { mehrPage, termineDetail, termEditor, datensicherung, applyTheme } from './extra.js';
import { prefs } from './db.js';

export const VERSION = '1.0.1';

/* ===== Heute ===== */
const heute = {
  title: 'Heute',
  render(b) {
    const today = dayStr();
    let h = `<div class="today-date">${esc(dayLong(today))}</div>`;
    if (st.backupDue()) h += `<button class="banner warn" data-a="backup">${icon('save')}<span><b>Zeit für eine Sicherung.</b> Deine letzte Sicherung ist älter als 14 Tage. Tippe hier.</span></button>`;
    const ex = st.nextExam(today);
    if (ex) {
      const d = daysBetween(today, ex.datum);
      const f = st.fach(ex.fachId);
      const tops = (ex.themaIds || []).map(id => st.thema(id)).filter(Boolean);
      h += `<button class="card count" data-a="exam" data-d="${ex.id}" style="--fc:${f ? f.farbe : 'var(--accent)'}">
        <div class="count-n">${d === 0 ? 'Heute' : d === 1 ? 'Morgen' : 'In ' + d + ' Tagen'}</div>
        <div class="count-t">${esc(ex.fach)}</div><div class="muted">${esc(dayLong(ex.datum))}</div>
        ${tops.length ? `<div class="count-tops">${tops.map(t => { const p = topicProgress(t.thema.id); return `<div class="ct"><span>${esc(t.thema.name)}</span>${progress(p || 0, f ? f.farbe : null)}</div>`; }).join('')}</div>` : ex.themen ? `<div class="muted">${esc(ex.themen)}</div>` : ''}
        <div class="count-more">Lernplan ansehen ${icon('chev', 'chev')}</div></button>`;
    } else {
      h += `<button class="card count empty-count" data-a="newexam"><div class="count-t">Keine Klassenarbeit eingetragen</div><div class="muted">Tippe hier, um eine Arbeit einzutragen. Dann zieht Lernwerk deren Themen vor.</div></button>`;
    }
    const q = st.buildQueue(900);
    h += `<button class="five" data-a="five">${icon('bolt')}<span><b>5 Minuten</b><small>Sofort loslegen mit fälligen Karten</small></span></button>`;
    h += `<div class="sec-h">Heute dran</div>`;
    if (q.items.length) {
      const by = new Map();
      for (const it of q.items) { const k = it.art === 'fehler' ? 'Fehlerbuch' : (st.thema(it.tid) || { thema: { name: 'Sonstiges' } }).thema.name; by.set(k, (by.get(k) || 0) + 1); }
      h += list([...by].map(([k, n]) => row({ title: k, detail: String(n) })).concat(row({ a: 'today', title: 'Starten', titleHTML: '<b>Starten</b>', sub: plural(q.items.length, 'Übung', 'Übungen') + ', etwa ' + Math.max(1, Math.round(q.sekunden / 60)) + ' Minuten', cls: 'accent-row' })));
    } else h += list([row({ title: 'Alles erledigt für heute.', sub: 'Markiere Themen als „aktuell im Unterricht“, dann kommen neue Karten dazu.' })]);
    const tr = st.dueTrainers(today);
    if (tr.length) h += `<div class="sec-h">Alte Trainer zum Wiederholen</div>` + list(tr.map(x => row({ a: 'topic', d: x.thema.id, dot: x.fach.farbe, title: x.thema.name, sub: x.fach.name + ' · fällig' })));
    const p = st.place();
    if (p && p.tid && st.thema(p.tid)) {
      const t = st.thema(p.tid);
      h += `<div class="sec-h">Weiter, wo du warst</div>` + list([row({ a: 'weiter', dot: t.fach.farbe, title: t.thema.name, sub: t.fach.name + (p.art === 'trainer' ? ' · alter Trainer' : '') })]);
    }
    const w = st.weekStats();
    const tage = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
    h += `<div class="sec-h">Diese Woche</div><div class="card week"><div class="week-days">${w.tage.map((n, i) => `<div class="wd ${n ? 'on' : ''}"><span></span><small>${tage[i]}</small></div>`).join('')}</div>
      <div class="muted">${w.n ? plural(w.n, 'Übung', 'Übungen') + ', davon ' + w.ok + ' beim ersten Mal gewusst.' : 'Noch nichts geübt diese Woche. Fünf Minuten reichen für den Anfang.'}</div></div>`;
    b.innerHTML = h;
    on(b, {
      backup: () => push(datensicherung()),
      exam: id => push(termineDetail(id)),
      newexam: () => termEditor({}),
      five: () => fiveMinutes(),
      today: () => runSession(st.buildQueue(900).items, 'Heute dran', { onClose: () => refreshTop() }),
      topic: tid => push(topicPage(tid)),
      weiter: () => { const pl = st.place(); if (pl.art === 'trainer' && pl.datei) openTrainer(pl.tid, 'trainer/' + pl.datei); else push(topicPage(pl.tid, pl.tab)); }
    });
  }
};
export function fiveMinutes() {
  let items = st.buildQueue(300).items;
  if (!items.length) {
    const akt = st.kvGet('aktuell', []);
    const tids = akt.length ? akt : st.allTids().filter(t => st.hasTopicContent(t));
    items = sortForPractice(tids.flatMap(t => st.topicItems(t)).filter(i => i.art !== 'aufgabe')).slice(0, 10);
    if (items.length) toast('Gerade ist nichts fällig. Ich nehme Karten aus deinen Themen.');
  }
  runSession(items, '5 Minuten', { minutes: 5, onClose: () => refreshTop() });
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
      return row({ a: 'fach', d: f.id, icon: 'book', color: f.farbe, title: f.name, sub: [modLabel(f.module), n ? v + ' von ' + n + ' Themen vorhanden' : 'Noch leer, kommt über Einfügen'].filter(Boolean).join(' · '), html: progress(fachProgress(f), f.farbe) });
    };
    if (faecherView === 'faecher') h += list(st.faecher().map(fachRow), 'fach-list');
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
    on(b, { 'seg:view': v => { faecherView = v; this.render(b); }, fach: id => push(fachPage(id)) });
  }
};
export function fachPage(fid) {
  return {
    title: (st.fach(fid) || { name: 'Fach' }).name,
    render(b) {
      const f = st.fach(fid);
      if (!f) { b.innerHTML = empty('Dieses Fach gibt es nicht mehr.'); return; }
      const g = { aktuell: [], vorhanden: [], geplant: [] };
      for (const t of f.themen) g[st.status(t.id)].push(t);
      const tRow = t => {
        const items = st.topicItems(t.id);
        const due = items.filter(i => { const c = st.card(i.id); return c && c.faellig <= dayStr(); }).length;
        const bits = [];
        if (t.trainer && t.trainer.length) bits.push('alter Trainer');
        const k = items.filter(i => i.art === 'karte' || i.art === 'begriff').length, a = items.length - k;
        if (k) bits.push(plural(k, 'Karte', 'Karten'));
        if (a) bits.push(plural(a, 'Übung', 'Übungen'));
        if (due) bits.push(due + ' fällig');
        const p = topicProgress(t.id);
        return row({ a: 'topic', d: t.id, title: t.name, sub: bits.join(' · ') || 'noch leer', html: p != null ? progress(p, f.farbe) : '' });
      };
      let h = `<div class="chips"><span class="chip" style="background:${f.farbe}">${esc(f.kurz || f.name)}</span>${(f.module || []).map(m => `<span class="chip ghost">${esc(m === 'Ü' ? 'übergreifend' : m)}</span>`).join('')}${f.hinweis ? `<span class="chip ghost">${esc(f.hinweis)}</span>` : ''}</div>`;
      if (g.aktuell.length) h += `<div class="sec-h">Aktuell im Unterricht</div>` + list(g.aktuell.map(tRow));
      if (g.vorhanden.length) h += `<div class="sec-h">Vorhanden</div>` + list(g.vorhanden.map(tRow));
      if (g.geplant.length) h += `<div class="sec-h">Kommt noch</div>` + list(g.geplant.map(tRow));
      if (!f.themen.length) h += empty('Noch keine Themen.', 'Füge einen Lernwerk-Block oder einen Lernzettel über Einfügen hinzu.');
      h += `<div class="sec-f">Ein Thema öffnen und „Aktuell im Unterricht“ einschalten, dann steht es hier oben und kommt in Heute zuerst.</div>`;
      b.innerHTML = h;
      on(b, { topic: tid => push(topicPage(tid)) });
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
    <div class="card how"><p><b>So geht es:</b> Vorlage kopieren, im Claude-Chat zusammen mit deinem Material einfügen, den Block aus der Antwort kopieren und hier einfügen.</p>
      <button class="btn filled" data-a="tpl">${icon('copy')} Vorlage für Claude kopieren</button></div>
    <div class="sec-h">Block aus dem Chat</div>
    <textarea class="big-ta" rows="9" placeholder="=== LERNWERK ===&#10;Fach: …&#10;Thema: …" data-k="block">${esc(insText)}</textarea>
    <div class="btn-row"><button class="btn" data-a="paste">${icon('paste')} Aus Zwischenablage einfügen</button><button class="btn" data-a="clear">Leeren</button></div>
    <div class="preview"></div>`;
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
    paste: async () => { const t = await readClipboard(); if (t == null) { toast('Tippe ins Feld und wähle Einsetzen.'); ta.focus(); return; } ta.value = t; update(); },
    clear: () => { ta.value = ''; update(); },
    save: async () => {
      if (!parsed) return;
      const p = parsed;
      ta.value = ''; insText = ''; parsed = null;
      const res = await st.saveBlocks(zu, p.termine);
      const n = res.reduce((s, x) => s + x.added, 0);
      toast(res.length ? 'Gespeichert: ' + res.map(x => x.thema.name).join(', ') + (n ? ' (' + plural(n, 'neuer Eintrag', 'neue Einträge') + ')' : ' (nichts Neues)') : 'Termine gespeichert.');
      insResult = res.map(x => ({ tid: x.thema.id, name: x.thema.name, fach: x.fach.name, farbe: x.fach.farbe }));
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
    if (!errs.length) h += empty('Noch keine Fehler eingetragen.', 'Fehler aus den Übungen und alten Trainern landen automatisch hier. Fehler aus einer zurückgegebenen Klassenarbeit trägst du oben selbst ein.');
    else {
      const groups = new Map();
      for (const e of offen) { if (!groups.has(e.fehlerart)) groups.set(e.fehlerart, []); groups.get(e.fehlerart).push(e); }
      const sorted = [...groups].sort((a, b) => b[1].length - a[1].length);
      if (sorted.length) h += `<div class="card pattern"><div class="card-k">Dein häufigstes Muster</div><p><b>${esc(sorted[0][0])}</b>: ${plural(sorted[0][1].length, 'Mal', 'Mal')}.${tipFor(sorted[0][0])}</p></div>`;
      for (const [art, es] of sorted) {
        h += `<div class="sec-h">${esc(art)} · ${es.length}</div>` + list(es.sort((a, b) => b.zeit - a.zeit).map(e => row({ a: 'err', d: e.id, title: e.aufgabe || '(ohne Aufgabentext)', sub: [e.thema || e.fach, new Date(e.zeit).toLocaleDateString('de-DE'), e.quelle === 'trainer' ? 'alter Trainer' : e.quelle === 'manuell' ? 'selbst eingetragen' : ''].filter(Boolean).join(' · ') })));
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
  document.getElementById('boot').remove();
  window.__lw = { showTab, VERSION };
  initTabs({ heute, faecher: faecherRoot, plus: einfuegen, fehler: fehlerbuch, mehr: mehrPage() });
  $$('.tabbar [data-tab]').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));
  showTab('heute');
  initEdgeSwipe();
  st.onChange(() => refreshAll());
  // Zurück aus einem alten Trainer: Thema wieder öffnen
  const ret = prefs.get('return', null);
  if (ret && Date.now() - ret.zeit < 3 * 3600 * 1000 && st.thema(ret.tid)) { showTab('faecher'); push(topicPage(ret.tid)); }
  prefs.set('return', null);
  const recheck = async () => { if (document.visibilityState === 'visible') { const n = await st.ingestInbox(); if (n) refreshAll(); } };
  document.addEventListener('visibilitychange', recheck);
  window.addEventListener('pageshow', recheck);
  registerSW();
}

function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('sw.js').then(reg => {
    const offer = w => {
      const bar = document.getElementById('update');
      bar.classList.add('on');
      bar.onclick = () => { w.postMessage('skipWaiting'); bar.textContent = 'Lade neue Version …'; };
    };
    if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w && w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) offer(w); });
    });
    setInterval(() => reg.update().catch(() => {}), 30 * 60 * 1000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
  }).catch(e => console.warn('Service Worker', e));
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (reloaded) return; reloaded = true; location.reload(); });
}

boot();
