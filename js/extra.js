// Mehr: Termine, Lexikon, Formelsammlung, Probeklausur, Erklär-Training, Hörmodus, Suche,
// Lehrplan bearbeiten, Datensicherung, Darstellung, Erinnerung.
import { esc, dayStr, dayLong, dayShort, daysBetween, plural, plainText, norm, shuffle, fmtNum, markdown } from './util.js';
import { fml, speakFml, varsOf, parseEq, keyOf } from './formula.js';
import { lernplan } from './srs.js';
import * as st from './store.js';
import { $, $$, icon, row, list, seg, sw, empty, on, push, pop, openSheet, toast, copyText, progress, confirmBox, saveFile, refreshTop, hinweisTabellenbuch } from './ui.js';
import { topicPage, runSession, runItem, sortForPractice, topicProgress, formelCard, askClaude, noteReader, openTrainer, itemTitle, rich } from './engine.js';
import { speak, stopSpeaking, canSpeak, keepAwake, pause, readAloud, stopReading } from './speech.js';
import { prefs } from './db.js';

export function applyTheme(t) {
  const r = document.documentElement;
  if (t === 'hell') r.setAttribute('data-theme', 'light');
  else if (t === 'dunkel') r.setAttribute('data-theme', 'dark');
  else r.removeAttribute('data-theme');
  const dark = t === 'dunkel' || (t !== 'hell' && matchMedia('(prefers-color-scheme: dark)').matches);
  const m = document.querySelector('meta[name="theme-color"]:not([media])');
  if (m) m.setAttribute('content', dark ? '#000000' : '#F2F2F7');
}

function notenSub() {
  const g = st.S.exams.filter(e => e.note != null || e.prozent != null);
  const n = st.nacharbeitThemen().size;
  return g.length ? plural(g.length, 'Arbeit', 'Arbeiten') + ' eingetragen' + (n ? ', ' + plural(n, 'Thema', 'Themen') + ' zum Nacharbeiten' : '') : 'Noten und Themen der Klassenarbeiten';
}
export function mehrPage() {
  return {
    title: 'Mehr',
    render(b) {
      const ex = st.nextExam();
      const nAkt = st.kvGet('aktuell', []).filter(id => st.thema(id)).length;
      b.innerHTML = list([
        row({ a: 'unterricht', icon: 'check', color: '#0A84FF', title: 'Im Unterricht', sub: nAkt ? plural(nAkt, 'Thema', 'Themen') + ' angewählt' : 'Noch keine Themen angewählt' })
      ]) + list([
        row({ a: 'noten', icon: 'exam', color: '#FFD60A', title: 'Noten', sub: notenSub() }),
        row({ a: 'termine', icon: 'calendar', color: '#FF453A', title: 'Termine', sub: ex ? 'Nächste Arbeit: ' + ex.fach + ', ' + dayShort(ex.datum) : 'Klassenarbeiten eintragen' }),
        row({ a: 'probe', icon: 'exam', color: '#FF9F0A', title: 'Probeklausur' }),
        row({ a: 'hoer', icon: 'ear', color: '#30D158', title: 'Hörmodus', sub: 'Karten und Lernzettel vorlesen, zum Beispiel im Auto' }),
        row({ a: 'erklaer', icon: 'mic', color: '#BF5AF2', title: 'Erklär-Training', sub: 'Für Fachgespräche und mündliche Prüfungen' })
      ]) + list([
        row({ a: 'lexikon', icon: 'book', color: '#0A84FF', title: 'Lexikon der Fachbegriffe' }),
        row({ a: 'formeln', icon: 'formula', color: '#5E5CE6', title: 'Formelsammlung' }),
        row({ a: 'suche', icon: 'search', color: '#8E8E93', title: 'Suche' })
      ]) + list([
        row({ a: 'lehrplan', icon: 'list', color: '#64D2FF', title: 'Lehrplan bearbeiten', sub: 'Fächer, Module und Themen' }),
        row({ a: 'backup', icon: 'save', color: '#34C759', title: 'Datensicherung', sub: st.kvGet('letzteSicherung') ? 'Letzte Sicherung: ' + dayShort(st.kvGet('letzteSicherung')) : 'Noch keine Sicherung' }),
        row({ a: 'theme', icon: 'theme', color: '#636366', title: 'Darstellung', detail: { auto: 'Automatisch', hell: 'Hell', dunkel: 'Dunkel' }[prefs.get('theme', 'auto')] }),
        row({ a: 'remind', icon: 'bell', color: '#FF375F', title: 'Erinnerung einrichten' }),
        row({ a: 'info', icon: 'info', color: '#8E8E93', title: 'Über Lernwerk' })
      ]) + hinweisTabellenbuch();
      on(b, {
        unterricht: () => push(unterrichtPage()), noten: () => push(notenPage()), termine: () => push(terminePage()), probe: () => push(probePage()), hoer: () => push(hoerPage()), erklaer: () => push(erklaerPage()),
        lexikon: () => push(lexikonPage()), formeln: () => push(formelPage()), suche: () => push(suchePage()),
        lehrplan: () => push(lehrplanPage()), backup: () => push(datensicherung()), theme: () => push(themePage()),
        remind: () => push(erinnerungPage()), info: () => push(infoPage())
      });
    }
  };
}

/* ===== Termine ===== */
export function terminePage() {
  return {
    title: 'Termine',
    actions: [{ label: 'Neu', icon: 'plus', onClick: () => termEditor({}) }],
    render(b) {
      const today = dayStr();
      const up = st.S.exams.filter(e => e.datum >= today).sort((a, b) => (a.datum < b.datum ? -1 : 1));
      const past = st.S.exams.filter(e => e.datum < today).sort((a, b) => (a.datum > b.datum ? -1 : 1));
      const r = e => { const f = st.fach(e.fachId); const d = daysBetween(today, e.datum); return row({ a: 'ex', d: e.id, dot: f ? f.farbe : '#888', title: e.fach, sub: dayLong(e.datum) + (e.themen ? ' · ' + e.themen : ''), detail: d >= 0 ? (d === 0 ? 'heute' : 'in ' + d + ' T.') : '' }); };
      let h = `<div class="btn-row"><button class="btn filled" data-a="neu">${icon('calendar')} Klassenarbeit eintragen</button></div>`;
      h += up.length ? `<div class="sec-h">Kommende Arbeiten</div>` + list(up.map(r)) : empty('Keine Klassenarbeit eingetragen.', 'Trag Fach, Datum und Themen ein. Lernwerk plant dann rückwärts bis zur Arbeit. Termine kommen auch über Termin-Zeilen im Lernwerk-Block.');
      if (past.length) h += `<details class="disc"><summary>Vergangene (${past.length})</summary>${list(past.map(r))}</details>`;
      b.innerHTML = h;
      on(b, { neu: () => termEditor({}), ex: id => push(termineDetail(id)) });
    }
  };
}
export function termEditor(e0) {
  const e = Object.assign({ fachId: '', datum: '', themen: '', themaIds: [] }, JSON.parse(JSON.stringify(e0)));
  openSheet({
    title: e0.id ? 'Termin bearbeiten' : 'Klassenarbeit eintragen', full: true,
    render(b, api) {
      const draw = () => {
        const f = st.fach(e.fachId);
        b.innerHTML = `<div class="form">
          <label class="fld"><span>Fach</span><select data-k="fach"><option value="">Fach wählen</option>${st.faecher().map(x => `<option value="${x.id}" ${x.id === e.fachId ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>
          <label class="fld"><span>Datum</span><input type="date" data-k="datum" value="${esc(e.datum)}" min="${dayStr()}"></label>
          ${f ? `<div class="sec-h">Themen der Arbeit</div>${list(f.themen.map(t => row({ title: t.name, right: `<label class="switch"><input type="checkbox" data-t="${t.id}" ${e.themaIds.includes(t.id) ? 'checked' : ''}><span></span></label>` })))}` : ''}
          <label class="fld"><span>Themen als Text (optional)</span><input type="text" data-k="themen" value="${esc(e.themen)}" placeholder="Zum Beispiel: Ohm, Reihenschaltung"></label>
          <button class="btn filled" data-a="save">Speichern</button>${e0.id ? `<button class="btn danger" data-a="del">${icon('trash')} Termin löschen</button>` : ''}</div>`;
        $('[data-k="fach"]', b).onchange = ev => { e.fachId = ev.target.value; e.themaIds = []; grab(); draw(); };
        $$('[data-t]', b).forEach(c => c.onchange = () => { const s = new Set(e.themaIds); c.checked ? s.add(c.dataset.t) : s.delete(c.dataset.t); e.themaIds = [...s]; });
      };
      const grab = () => { const d = $('[data-k="datum"]', b), t = $('[data-k="themen"]', b); if (d) e.datum = d.value; if (t) e.themen = t.value; };
      draw();
      on(b, {
        save: async () => {
          grab();
          if (!e.fachId) { toast('Bitte ein Fach wählen.'); return; }
          if (!e.datum) { toast('Bitte ein Datum wählen.'); return; }
          const f = st.fach(e.fachId);
          const ids = e.themaIds.length ? e.themaIds : st.matchThemen(f, e.themen);
          await st.addExam({ id: e0.id, fachId: e.fachId, fach: f.name, datum: e.datum, themen: e.themen, themaIds: ids });
          api.close(); toast('Termin gespeichert.'); refreshTop();
        },
        del: async () => { if (await confirmBox('Termin löschen?', 'Löschen', true)) { await st.deleteExam(e0.id); api.close(); pop(); } }
      });
    }
  });
}
export function termineDetail(id) {
  return {
    title: 'Klassenarbeit',
    actions: [{ label: 'Bearbeiten', icon: 'edit', onClick: () => { const e = st.S.exams.find(x => x.id === id); if (e) termEditor(e); } }],
    render(b) {
      const e = st.S.exams.find(x => x.id === id);
      if (!e) { b.innerHTML = empty('Diesen Termin gibt es nicht mehr.'); return; }
      const f = st.fach(e.fachId);
      const today = dayStr();
      const d = daysBetween(today, e.datum);
      const tops = (e.themaIds || []).map(t => st.thema(t)).filter(Boolean);
      let h = `<div class="card count" style="--fc:${f ? f.farbe : 'var(--accent)'}"><div class="count-n">${d < 0 ? 'Vorbei' : d === 0 ? 'Heute' : d === 1 ? 'Morgen' : 'In ' + d + ' Tagen'}</div><div class="count-t">${esc(e.fach)}</div><div class="muted">${esc(dayLong(e.datum))}</div>${e.themen ? `<div class="muted">${esc(e.themen)}</div>` : ''}</div>`;
      if (d < 0) h += `<div class="btn-row"><button class="btn filled" data-a="note">${icon('exam')} ${e.note != null || e.prozent != null ? 'Note ansehen: ' + [e.note != null ? fmtNote(e.note) : '', e.prozent != null ? fmtNum(e.prozent, 1) + ' %' : ''].filter(Boolean).join(', ') : 'Note eintragen'}</button></div>`;
      if (tops.length) h += `<div class="sec-h">Dein Stand</div>` + list(tops.map(t => { const p = topicProgress(t.thema.id); return row({ a: 'topic', d: t.thema.id, title: t.thema.name, html: progress(p || 0, f ? f.farbe : null), detail: Math.round((p || 0) * 100) + ' %' }); }));
      else h += `<div class="fb info">Wähl die Themen der Arbeit aus (oben rechts bearbeiten). Dann zieht Lernwerk sie in Heute vor und plant rückwärts.</div>`;
      h += `<div class="btn-row"><button class="btn filled" data-a="ueben">${icon('bolt')} Themen der Arbeit üben</button><button class="btn" data-a="probe">${icon('exam')} Probeklausur</button><button class="btn" data-a="hoer">${icon('ear')} Hörmodus</button></div>`;
      if (d > 0) {
        const plan = lernplan(e.datum, tops.map(t => t.thema), today);
        h += `<div class="sec-h">Lernplan bis zur Arbeit</div>` + list(plan.map(p => row({
          title: (p.datum === today ? 'Heute, ' : '') + dayLong(p.datum),
          sub: p.art === 'wiederholen' ? 'Nur Wiederholung und Fehlerbuch' : p.themen.length ? p.themen.map(x => x.thema.name + (x.neu ? '' : ' wiederholen')).join(', ') + (p.leicht ? ' · voller Tag, nur kurz' : '') : 'Fällige Karten',
          cls: p.datum === today ? 'today-row' : ''
        })));
        h += `<div class="sec-f">Dienstag und Donnerstag sind bei dir volle Tage. Dort plane ich weniger ein.</div>`;
      }
      b.innerHTML = h;
      on(b, {
        topic: tid => push(topicPage(tid)),
        note: () => notenEditor(e),
        ueben: () => { const q = st.buildQueue(1200, { tids: tops.map(t => t.thema.id), exam: e, mitFehlern: true, maxNeu: 12 }); runSession(q.items.length ? q.items : sortForPractice(tops.flatMap(t => st.topicItems(t.thema.id))).slice(0, 12), 'Arbeit: ' + e.fach, { onClose: () => refreshTop() }); },
        probe: () => push(probePage(e)),
        hoer: () => push(hoerPage({ exam: e }))
      });
    }
  };
}

/* ===== Lexikon ===== */
export function lexikonPage() {
  let q = '';
  return {
    title: 'Lexikon',
    render(b) {
      const entries = [];
      for (const f of st.faecher()) for (const t of f.themen) {
        const T = st.topic(t.id);
        T.begriffe.forEach(x => entries.push({ b: x.begriff, e: x.erklaerung, f, t, anker: T.anker[0], merk: T.merksaetze }));
      }
      entries.sort((a, c) => a.b.localeCompare(c.b, 'de'));
      b.innerHTML = `<input type="search" class="search" placeholder="Begriff suchen" value="${esc(q)}" data-k="q"><div class="lx"></div>`;
      const out = $('.lx', b);
      const draw = () => {
        const n = q.toLowerCase();
        const hits = entries.filter(x => !n || x.b.toLowerCase().includes(n) || x.e.toLowerCase().includes(n));
        if (!hits.length) { out.innerHTML = empty(entries.length ? 'Nichts gefunden.' : 'Noch keine Fachbegriffe.', 'Begriffe kommen aus den Begriff-Zeilen aller Themen.'); return; }
        let h = '', letter = '';
        const groups = [];
        for (const x of hits) { const L = x.b[0].toUpperCase(); if (L !== letter) { letter = L; groups.push([L, []]); } groups[groups.length - 1][1].push(x); }
        for (const [L, xs] of groups) h += `<div class="sec-h">${esc(L)}</div>` + list(xs.map(x => row({ a: 'lx', d: entries.indexOf(x), titleHTML: `<b>${esc(x.b)}</b>`, sub: x.e, dot: x.f.farbe })));
        out.innerHTML = h;
      };
      $('[data-k="q"]', b).oninput = ev => { q = ev.target.value; draw(); };
      on(b, {
        lx: i => {
          const x = entries[+i];
          openSheet({
            title: x.b,
            render(sb, api) {
              sb.innerHTML = `<div class="card"><div class="card-k">${esc(x.f.name)} · ${esc(x.t.name)}</div><p><b>${esc(x.b)}</b>: ${esc(x.e)}</p></div>
                ${x.anker ? `<div class="card anchor"><div class="card-k">Bild aus deiner Welt</div><p>${esc(x.anker)}</p></div>` : ''}
                ${x.merk.map(m => `<div class="card merk" style="--fc:${x.f.farbe}"><div class="card-k">Merksatz</div><p>${esc(m)}</p></div>`).join('')}
                <div class="btn-col">${canSpeak() ? `<button class="btn" data-a="sp">${icon('ear')} Vorlesen</button>` : ''}<button class="btn filled" data-a="go">Zum Thema</button></div>`;
              on(sb, { sp: () => readAloud(x.b + '. ' + x.e + '. ' + x.merk.join('. '), x.b), go: () => { api.close(); push(topicPage(x.t.id)); } });
            }
          });
        }
      });
      draw();
    }
  };
}

/* ===== Formelsammlung ===== */
export function formelPage() {
  let q = '';
  return {
    title: 'Formelsammlung',
    render(b) {
      const all = [];
      for (const f of st.faecher()) for (const t of f.themen) st.topic(t.id).formeln.forEach(fo => all.push({ fo, f, t }));
      b.innerHTML = `<input type="search" class="search" placeholder="Nach Größe oder Name suchen, zum Beispiel I oder σ" value="${esc(q)}" data-k="q">
        ${list([row({ a: 'statik', icon: 'formula', color: '#FF453A', title: 'Formelsammlung Statik', sub: 'Trainer, fertig umgestellt' })])}<div class="fs"></div>`;
      const out = $('.fs', b);
      const varsFor = fo => { const s = new Set(); for (const x of [fo.formel, ...fo.umgestellt]) { try { const e = parseEq(x); varsOf(e.l, varsOf(e.r, s)); } catch (err) { /* Text */ } } return s; };
      const draw = () => {
        const n = q.trim();
        let hits = all;
        if (n) {
          const k = keyOf(n);
          const byVar = all.filter(x => varsFor(x.fo).has(k));
          const byText = all.filter(x => !byVar.includes(x) && (x.fo.name.toLowerCase().includes(n.toLowerCase()) || x.t.name.toLowerCase().includes(n.toLowerCase())));
          hits = byVar.concat(byText);
        }
        if (!hits.length) { out.innerHTML = empty(all.length ? 'Nichts gefunden.' : 'Noch keine Formeln.', 'Formeln kommen aus den Formel-Zeilen aller Themen.'); return; }
        let h = '', last = '';
        for (const x of hits) {
          const key = x.f.name;
          if (!n && key !== last) { h += `<div class="sec-h">${esc(key)}</div>`; last = key; }
          h += `<button class="fs-item" data-a="topic" data-d="${x.t.id}">${formelCard(x.fo)}<div class="fs-src">${esc(x.t.name)}</div></button>`;
        }
        out.innerHTML = h;
      };
      $('[data-k="q"]', b).oninput = ev => { q = ev.target.value; draw(); };
      on(b, { topic: tid => push(topicPage(tid)), statik: () => openTrainer('tm-formelsammlung-statik', 'trainer/statik-formelsammlung.html') });
      draw();
    }
  };
}

/* ===== Probeklausur ===== */
const GRADABLE = ['aufgabe', 'umstellen', 'auswahl', 'reihenfolge'];
export function probePage(exam) {
  let mode = exam ? 'arbeit' : 'themen';
  let sel = new Set(exam ? exam.themaIds || [] : []);
  let anzahl = 10, zeit = true;
  return {
    title: 'Probeklausur',
    render(b) {
      const next = exam || st.nextExam();
      const withItems = st.faecher().map(f => ({ f, ts: f.themen.filter(t => st.topicItems(t.id).some(i => GRADABLE.includes(i.art))) })).filter(x => x.ts.length);
      let h = `<div class="card how"><p>Gemischte Aufgaben, Tipps gesperrt. Du gibst jeweils nur dein Ergebnis ein. Am Ende siehst du die Auswertung pro Thema, Fehler gehen ins Fehlerbuch.</p></div>`;
      h += seg('mode', [['arbeit', 'Nächste Arbeit'], ['themen', 'Themen wählen']], mode);
      if (mode === 'arbeit') {
        if (!next) h += empty('Keine Klassenarbeit eingetragen.', 'Trag unter Termine eine Arbeit ein oder wähl Themen.');
        else { sel = new Set(next.themaIds || []); h += list([row({ title: next.fach + ', ' + dayLong(next.datum), sub: (next.themaIds || []).map(t => (st.thema(t) || { thema: { name: '' } }).thema.name).join(', ') || 'Keine Themen gewählt' })]); }
      } else {
        if (!withItems.length) h += empty('Noch keine Themen mit Aufgaben.', 'Aufgaben kommen über Aufgabe-Zeilen im Lernwerk-Block. „Formeln umstellen“ in Mathematik hat schon welche.');
        for (const x of withItems) h += `<div class="sec-h">${esc(x.f.name)}</div>` + list(x.ts.map(t => row({ title: t.name, right: `<label class="switch"><input type="checkbox" data-t="${t.id}" ${sel.has(t.id) ? 'checked' : ''}><span></span></label>` })));
      }
      h += `<div class="sec-h">Umfang</div>` + seg('n', [['5', '5 Aufgaben'], ['10', '10 Aufgaben'], ['15', '15 Aufgaben']], String(anzahl));
      h += list([row({ title: 'Zeit anzeigen', right: sw('zeit', zeit) })]);
      h += `<button class="btn filled wide" data-a="start">Probeklausur starten</button>`;
      b.innerHTML = h;
      $$('[data-t]', b).forEach(c => c.onchange = () => { c.checked ? sel.add(c.dataset.t) : sel.delete(c.dataset.t); });
      on(b, {
        'seg:mode': v => { mode = v; this.render(b); }, 'seg:n': v => { anzahl = +v; }, 'sw:zeit': v => { zeit = v; },
        start: () => {
          const tids = [...sel];
          let items = shuffle(tids.flatMap(t => st.topicItems(t).filter(i => GRADABLE.includes(i.art))));
          // gleichmäßig über die Themen verteilen
          const by = tids.map(t => items.filter(i => i.tid === t));
          const mix = [];
          while (mix.length < anzahl && by.some(x => x.length)) for (const x of by) if (x.length && mix.length < anzahl) mix.push(x.shift());
          if (!mix.length) { toast('Wähl Themen mit Aufgaben aus.'); return; }
          runExam(mix, zeit);
        }
      });
    }
  };
}
function runExam(items, zeigeZeit) {
  const res = [];
  let i = 0;
  const t0 = Date.now();
  let tm = null;
  let sheet = null;
  openSheet({
    title: 'Probeklausur', full: true,
    confirmClose: () => i >= items.length || confirm('Probeklausur abbrechen?'),
    onClose: () => clearInterval(tm),
    render(body, api) { sheet = api; body.innerHTML = `<div class="sess-top">${progress(0)}<div class="sess-info"></div></div><div class="sess-item"></div>`; show(); }
  });
  function fmtT(ms) { const s = Math.floor(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  function info() { const n = $('.sess-info', sheet.body); if (n) n.textContent = (i < items.length ? 'Aufgabe ' + (i + 1) + ' von ' + items.length : 'Auswertung') + (zeigeZeit ? ' · ' + fmtT(Date.now() - t0) : ''); }
  if (zeigeZeit) tm = setInterval(info, 1000);
  function show() {
    info();
    $('.bar i', sheet.body).style.width = Math.round(i / items.length * 100) + '%';
    const box = $('.sess-item', sheet.body);
    const fresh = box.cloneNode(false); box.replaceWith(fresh);
    if (i >= items.length) return auswertung(fresh);
    const it = items[i];
    runItem(fresh, it, { exam: true, blind: true, onDone: async (erg, inf) => { res.push({ it, erg, inf: inf || {} }); await st.recordCard(it, erg); i++; show(); $('.sheet-body', sheet.el).scrollTop = 0; } });
  }
  function auswertung(box) {
    clearInterval(tm);
    const by = new Map();
    for (const r of res) { const k = r.it.tid; if (!by.has(k)) by.set(k, []); by.get(k).push(r); }
    const ok = res.filter(r => r.erg === 'richtig').length;
    let h = `<div class="sum"><div class="sum-big">${ok} von ${res.length}</div><div class="muted">richtig${zeigeZeit ? ' in ' + fmtT(Date.now() - t0) + ' Minuten' : ''}</div></div>`;
    h += `<div class="sec-h">Pro Thema</div>` + list([...by].map(([tid, rs]) => { const th = st.thema(tid); const n = rs.filter(r => r.erg === 'richtig').length; return row({ title: th ? th.thema.name : tid, detail: n + ' von ' + rs.length, html: progress(n / rs.length, th ? th.fach.farbe : null) }); }));
    const wrong = res.filter(r => r.erg !== 'richtig');
    // Woran es lag: Fehlerarten zählen, damit klar ist, was als Nächstes geübt wird
    const arten = new Map();
    for (const r of wrong) { const k = r.inf.fehlerart || (r.inf.eingabe ? 'Rechenweg' : 'Nicht bearbeitet'); arten.set(k, (arten.get(k) || 0) + 1); }
    if (arten.size) h += `<div class="sec-h">Nach Fehlerart</div>` + list([...arten].sort((a, b) => b[1] - a[1]).map(([k, n]) => row({ title: k, detail: String(n) })));
    if (wrong.length) h += `<div class="sec-h">Das schaust du dir nochmal an</div>` + list(wrong.map(r => row({ titleHTML: rich(r.inf.aufgabe || itemTitle(r.it)), sub: 'Deine Eingabe: ' + (r.inf.eingabe || 'keine') + (r.inf.richtig ? ' · richtig: ' + r.inf.richtig : '') }))) + `<div class="sec-f">Diese Fehler stehen jetzt auch im Fehlerbuch.</div>`;
    h += `<div class="btn-col"><button class="btn filled" data-a="close">Fertig</button></div>`;
    box.innerHTML = h;
    on(box, { close: () => sheet.close() });
    $('.bar i', sheet.body).style.width = '100%';
  }
}

/* ===== Erklär-Training ===== */
const FUELL = ['quasi', 'ähm', 'äh', 'öhm', 'halt', 'irgendwie', 'sozusagen', 'eigentlich', 'praktisch', 'irgendwas', 'dings', 'gewissermaßen', 'im prinzip'];
export function erklaerPage() {
  let tid = '', text = '';
  return {
    title: 'Erklär-Training',
    render(b) {
      const opts = st.faecher().flatMap(f => f.themen.filter(t => st.topic(t.id).begriffe.length).map(t => ({ f, t })));
      b.innerHTML = `<div class="card how"><p>Erklär ein Thema so, als ob du es im Fachgespräch erklärst. Tipp ins Textfeld und dann auf das Mikrofon der iPhone-Tastatur, um zu diktieren.</p></div>
        <label class="fld"><span>Thema</span><select data-k="t"><option value="">Thema wählen</option>${opts.map(o => `<option value="${o.t.id}" ${o.t.id === tid ? 'selected' : ''}>${esc(o.f.kurz || o.f.name)}: ${esc(o.t.name)}</option>`).join('')}</select></label>
        <textarea class="big-ta" rows="9" data-k="x" placeholder="Deine Erklärung">${esc(text)}</textarea>
        <button class="btn filled wide" data-a="go">Auswerten</button><div class="er"></div>`;
      $('[data-k="t"]', b).onchange = e => { tid = e.target.value; };
      $('[data-k="x"]', b).oninput = e => { text = e.target.value; };
      on(b, {
        go: () => {
          if (!tid) { toast('Bitte ein Thema wählen.'); return; }
          if (!text.trim()) { toast('Erklär erst etwas.'); return; }
          const T = st.topic(tid);
          const low = ' ' + text.toLowerCase().replace(/[^a-zäöüß0-9 ]+/g, ' ') + ' ';
          const stem = w => w.toLowerCase().replace(/(en|e|n|s)$/, '');
          const has = term => term.toLowerCase().split(/[\s-]+/).filter(w => w.length > 2).every(w => low.includes(stem(w)));
          const used = T.begriffe.filter(x => has(x.begriff)), miss = T.begriffe.filter(x => !has(x.begriff));
          const fill = FUELL.map(w => [w, (low.match(new RegExp('\\s' + w + '\\s', 'g')) || []).length]).filter(x => x[1]);
          const words = text.trim().split(/\s+/).length;
          const fillN = fill.reduce((s, x) => s + x[1], 0);
          const q = `Ich erkläre in Lernwerk das Thema ${T.thema} (${T.fach}). Bewerte meine Erklärung wie in einem Fachgespräch: Was stimmt, was fehlt, welche Fachbegriffe sollte ich benutzen und wie kann ich es klarer sagen? Rechne nichts vor. Meine Erklärung: ${text.trim()}`;
          $('.er', b).innerHTML = `<div class="sec-h">Fachbegriffe</div><div class="card">${used.length ? `<div class="tags">${used.map(x => `<span class="tag ok">${esc(x.begriff)}</span>`).join('')}</div>` : ''}${miss.length ? `<div class="muted small">Nicht benutzt:</div><div class="tags">${miss.map(x => `<span class="tag">${esc(x.begriff)}</span>`).join('')}</div>` : '<p>Alle Fachbegriffe benutzt.</p>'}</div>
            <div class="sec-h">Füllwörter</div><div class="card"><p>${fillN ? plural(fillN, 'Füllwort', 'Füllwörter') + ' bei ' + words + ' Wörtern: ' + fill.map(([w, n]) => esc(w) + ' ' + n + ' mal').join(', ') + '.' : 'Keine Füllwörter gefunden. Stark.'}</p></div>
            ${T.merksaetze.length ? `<div class="sec-h">Zum Vergleich</div>` + T.merksaetze.map(m => `<div class="card merk"><div class="card-k">Merksatz</div><p>${esc(m)}</p></div>`).join('') : ''}
            <button class="btn wide" data-a="claude" data-d="${esc(q)}">${icon('claude')} Frag Claude nach einer Bewertung</button>`;
        },
        claude: d => askClaude(d)
      });
    }
  };
}

/* ===== Hörmodus ===== */
export function hoerPage(opt = {}) {
  let quelle = 'arbeit', fid = '', noteId = '', formeln = true;
  let run = 0, idx = 0, playing = false, queue = [];
  return {
    title: 'Hörmodus',
    render(b) {
      const ex = opt.exam || st.nextExam();
      const notes = st.S.notes.slice().sort((a, c) => c.zeit - a.zeit);
      let h = `<div class="fb info"><b>Bildschirm anlassen.</b> iOS stoppt das Vorlesen, wenn der Bildschirm sperrt. Lernwerk versucht, ihn wach zu halten. Teste es am besten einmal im Stand.</div>`;
      h += seg('q', [['arbeit', 'Nächste Arbeit'], ['fach', 'Fach'], ['zettel', 'Lernzettel']], quelle);
      if (quelle === 'arbeit') h += ex ? list([row({ title: ex.fach + ', ' + dayShort(ex.datum), sub: (ex.themaIds || []).map(t => (st.thema(t) || { thema: { name: '' } }).thema.name).join(', ') || 'Ganzes Fach' })]) : empty('Keine Arbeit eingetragen.', 'Wähl ein Fach.');
      if (quelle === 'fach') h += `<label class="fld"><span>Fach</span><select data-k="f"><option value="">Fach wählen</option>${st.faecher().map(f => `<option value="${f.id}" ${f.id === fid ? 'selected' : ''}>${esc(f.name)}</option>`).join('')}</select></label>`;
      if (quelle === 'zettel') h += notes.length ? `<label class="fld"><span>Lernzettel</span><select data-k="n"><option value="">Lernzettel wählen</option>${notes.map(n => `<option value="${n.id}" ${n.id === noteId ? 'selected' : ''}>${esc(n.titel || 'Lernzettel')}</option>`).join('')}</select></label>` : empty('Noch keine Lernzettel.');
      if (quelle !== 'zettel') h += list([row({ title: 'Formeln mit vorlesen', right: sw('fo', formeln) })]);
      h += `<div class="player"><div class="pl-q">Tippe auf Start.</div><div class="pl-a"></div><div class="pl-n muted"></div>
        <div class="pl-btns"><button class="pl-b" data-a="rep" aria-label="Wiederholen">${icon('repeat')}</button><button class="pl-b big" data-a="play" aria-label="Start oder Pause">${icon('play')}</button><button class="pl-b" data-a="next" aria-label="Weiter">${icon('next')}</button></div></div>`;
      if (!canSpeak()) h += `<div class="fb bad">Dieser Browser kann nicht vorlesen.</div>`;
      b.innerHTML = h;
      const sel = $('[data-k="f"]', b); if (sel) sel.onchange = e => { fid = e.target.value; stop(); };
      const nsel = $('[data-k="n"]', b); if (nsel) nsel.onchange = e => { noteId = e.target.value; stop(); };
      const ui = () => {
        const it = queue[idx];
        $('.pl-q', b).textContent = it ? it.q : playing ? '' : 'Tippe auf Start.';
        $('.pl-a', b).textContent = it && it.shown ? it.a : '';
        $('.pl-n', b).textContent = queue.length ? (idx + 1) + ' von ' + queue.length : '';
        $('[data-a="play"]', b).innerHTML = icon(playing ? 'pause' : 'play');
      };
      const build = () => {
        if (quelle === 'zettel') {
          const n = st.S.notes.find(x => x.id === noteId);
          if (!n) return [];
          return plainText(n.text).split(/(?<=[.!?])\s+/).reduce((acc, s) => { if (acc.length && acc[acc.length - 1].q.length < 220) acc[acc.length - 1].q += ' ' + s; else acc.push({ q: s, a: '', text: true }); return acc; }, []);
        }
        let tids = [];
        if (quelle === 'arbeit' && ex) tids = (ex.themaIds || []).length ? ex.themaIds : (st.fach(ex.fachId) || { themen: [] }).themen.map(t => t.id);
        if (quelle === 'fach') tids = (st.fach(fid) || { themen: [] }).themen.map(t => t.id);
        const out = [];
        for (const t of tids) {
          for (const it of st.topicItems(t)) if (it.art === 'karte' || it.art === 'begriff') out.push({ q: it.frage, a: it.antwort, sq: speakable(it.frage), sa: speakable(it.antwort) });
          if (formeln) st.topic(t).formeln.forEach(fo => out.push({ q: 'Wie lautet die Formel ' + (fo.name ? 'für ' + fo.name : '') + '?', a: fo.formel, sa: speakFml(fo.formel) + (fo.umgestellt.length ? '. Umgestellt: ' + fo.umgestellt.map(speakFml).join('. ') : '') }));
        }
        return sortForPractice(out.map((x, k) => Object.assign(x, { id: 'h' + k }))).slice(0, 60);
      };
      async function loop(token) {
        while (playing && token === run && idx < queue.length) {
          const it = queue[idx];
          it.shown = !!it.text; ui();
          await speak(it.sq || it.q, 0.95);
          if (token !== run) return;
          if (!it.text) {
            await pause(400); if (token !== run) return;
            await speak('drei, zwei, eins', 1.05);
            if (token !== run) return;
            it.shown = true; ui();
            await speak(it.sa || it.a, 0.95);
          }
          if (token !== run) return;
          await pause(1200);
          if (token !== run) return;
          idx++;
        }
        if (token === run && idx >= queue.length && playing) { playing = false; keepAwake(false); ui(); $('.pl-q', b).textContent = 'Fertig. Gut gemacht.'; }
      }
      const start = () => { stopReading(); if (!queue.length || idx >= queue.length) { queue = build(); idx = 0; } if (!queue.length) { toast('Hier gibt es nichts vorzulesen.'); return; } playing = true; run++; keepAwake(true); loop(run); ui(); };
      function stop() { playing = false; run++; stopSpeaking(); keepAwake(false); queue = []; idx = 0; ui(); }
      on(b, {
        'seg:q': v => { quelle = v; stop(); this.render(b); },
        'sw:fo': v => { formeln = v; stop(); },
        play: () => { if (playing) { playing = false; run++; stopSpeaking(); keepAwake(false); ui(); } else start(); },
        next: () => { if (!queue.length) return start(); run++; stopSpeaking(); idx = Math.min(idx + 1, queue.length - 1); if (queue[idx]) queue[idx].shown = false; if (playing) loop(run); ui(); },
        rep: () => { if (!queue.length) return start(); run++; stopSpeaking(); if (queue[idx]) queue[idx].shown = false; if (!playing) { playing = true; keepAwake(true); } loop(run); ui(); }
      });
      ui();
    }
  };
}
// Formeln in Karten aussprechbar machen
function speakable(s) {
  const t = String(s || '');
  if (/^[^.!?]{1,60}=[^.!?]{1,80}$/.test(t) && !/\s(ist|sind|und|der|die|das)\s/.test(t)) return speakFml(t);
  return t.replace(/z\.\s?B\./g, 'zum Beispiel').replace(/d\.\s?h\./g, 'das heißt').replace(/u\.\s?a\./g, 'unter anderem');
}

/* ===== Suche ===== */
export function suchePage() {
  let q = '';
  return {
    title: 'Suche',
    render(b) {
      b.innerHTML = `<input type="search" class="search" placeholder="Themen, Karten, Lernzettel, Begriffe, Formeln" value="${esc(q)}" data-k="q"><div class="sr"></div>`;
      const out = $('.sr', b);
      const draw = () => {
        const r = st.searchAll(q);
        if (q.trim().length < 2) { out.innerHTML = '<p class="muted center">Mindestens zwei Zeichen eingeben.</p>'; return; }
        if (!r.length) { out.innerHTML = empty('Nichts gefunden.'); return; }
        const by = new Map();
        r.forEach((x, i) => { x.i = i; if (!by.has(x.art)) by.set(x.art, []); by.get(x.art).push(x); });
        out.innerHTML = [...by].map(([art, xs]) => `<div class="sec-h">${esc(art)}</div>` + list(xs.map(x => row({ a: 'hit', d: x.i, titleHTML: x.formel ? fml(x.formel) : esc(x.titel), sub: x.formel ? x.titel : x.sub })))).join('');
        out._r = r;
      };
      const inp = $('[data-k="q"]', b);
      inp.oninput = e => { q = e.target.value; draw(); };
      setTimeout(() => { try { inp.focus(); } catch (e) { /* egal */ } }, 300);
      on(b, {
        hit: i => {
          const x = out._r[+i];
          if (x.noteId) return noteReader(x.noteId);
          if (x.errId) { const { showTab } = window.__lw; showTab('fehler'); return; }
          if (x.tid && st.thema(x.tid)) push(topicPage(x.tid, x.art === 'Karte' || x.art === 'Lexikon' ? 'karten' : x.art === 'Formel' ? 'bausteine' : 'prinzip'));
        }
      });
      draw();
    }
  };
}

/* ===== Lehrplan bearbeiten ===== */
export function lehrplanPage() {
  return {
    title: 'Lehrplan',
    render(b) {
      const P = st.S.plan;
      let h = `<div class="card how"><p>Hier passt du Fächer, Module und Themen an. Dein Schulblatt nummeriert die Module anders? Dann änderst du einfach Nummer und Namen.</p></div>`;
      h += `<div class="sec-h">Fächer</div>` + list(P.faecher.map(f => row({ a: 'fach', d: f.id, icon: 'book', color: f.farbe, title: f.name, sub: (f.module || []).map(m => (m === 'Ü' ? 'übergreifend' : m)).join(', ') + ' · ' + plural(f.themen.length, 'Thema', 'Themen') })));
      h += `<div class="btn-row"><button class="btn" data-a="newfach">Fach hinzufügen</button></div>`;
      h += `<div class="sec-h">Module</div>` + list(P.module.map(m => row({ a: 'mod', d: m.id, title: m.id + ' ' + m.name, sub: [m.klasse ? 'Klasse ' + m.klasse : '', m.stunden ? m.stunden + ' Stunden' : ''].filter(Boolean).join(', ') })));
      h += `<div class="btn-row"><button class="btn" data-a="newmod">Modul hinzufügen</button></div>`;
      if (P.pruefung) h += `<div class="sec-f">${esc(P.pruefung)}</div>`;
      h += `<div class="btn-col"><button class="btn danger" data-a="reset">Auf Standard zurücksetzen</button></div>`;
      b.innerHTML = h;
      on(b, {
        fach: id => fachEditor(st.fach(id)),
        newfach: async () => { const n = prompt('Name des neuen Fachs'); if (n && n.trim()) { const f = await st.addFach(n.trim()); fachEditor(f); } },
        mod: id => modEditor(P.module.find(m => m.id === id)),
        newmod: () => modEditor(null),
        reset: async () => {
          if (!(await confirmBox('Lehrplan auf den Standard zurücksetzen? Deine Inhalte, Lernzettel und Fortschritte bleiben. Eigene Fächer und Themen ohne Inhalt verschwinden.', 'Zurücksetzen', true))) return;
          const base = JSON.parse(JSON.stringify(st.S.base));
          for (const f of st.S.plan.faecher) {
            const bf = base.faecher.find(x => x.id === f.id);
            for (const t of f.themen) if (!bf || !bf.themen.find(x => x.id === t.id)) {
              if (st.S.content.has(t.id) || st.notesFor(t.id).length) { let tf = base.faecher.find(x => x.id === f.id); if (!tf) { tf = Object.assign({}, f, { themen: [] }); base.faecher.push(tf); } tf.themen.push(t); }
            }
          }
          st.S.plan = base; await st.savePlan(); toast('Lehrplan zurückgesetzt.');
        }
      });
    }
  };
}
function fachEditor(f) {
  openSheet({
    title: f.name, full: true,
    render(b, api) {
      b.innerHTML = `<div class="form">
        <label class="fld"><span>Name</span><input type="text" data-k="name" value="${esc(f.name)}"></label>
        <label class="fld"><span>Kurzname</span><input type="text" data-k="kurz" value="${esc(f.kurz || '')}"></label>
        <label class="fld"><span>Module, mit Komma getrennt</span><input type="text" data-k="module" value="${esc((f.module || []).join(', '))}" placeholder="M2"></label>
        <label class="fld"><span>Farbe</span><input type="color" data-k="farbe" value="${esc(f.farbe)}"></label>
        <div class="sec-h">Themen</div>
        ${f.themen.map((t, i) => `<div class="edit-row"><input type="text" data-ti="${i}" value="${esc(t.name)}"><button class="btn small" data-a="up" data-d="${i}" aria-label="Nach oben">↑</button><button class="btn small danger" data-a="deltopic" data-d="${i}" aria-label="Löschen">${icon('trash')}</button></div>`).join('')}
        <div class="edit-row"><input type="text" data-k="neu" placeholder="Neues Thema"><button class="btn small" data-a="addtopic">Hinzufügen</button></div>
        <button class="btn filled" data-a="save">Speichern</button>
        ${f.eigen ? `<button class="btn danger" data-a="delfach">${icon('trash')} Fach löschen</button>` : ''}</div>`;
      const grab = () => {
        f.name = $('[data-k="name"]', b).value.trim() || f.name;
        f.kurz = $('[data-k="kurz"]', b).value.trim();
        f.module = $('[data-k="module"]', b).value.split(',').map(s => s.trim()).filter(Boolean);
        f.farbe = $('[data-k="farbe"]', b).value;
        $$('[data-ti]', b).forEach(inp => { const t = f.themen[+inp.dataset.ti]; if (t && inp.value.trim()) t.name = inp.value.trim(); });
      };
      on(b, {
        save: async () => { grab(); await st.savePlan(); api.close(); toast('Gespeichert.'); },
        up: i => { grab(); i = +i; if (i > 0) { const t = f.themen.splice(i, 1)[0]; f.themen.splice(i - 1, 0, t); } api.refresh(); },
        addtopic: () => { grab(); const n = $('[data-k="neu"]', b).value.trim(); if (!n) return; f.themen.push({ id: f.id + '-' + Math.random().toString(36).slice(2, 7), name: n, eigen: true }); api.refresh(); },
        deltopic: async i => {
          grab(); const t = f.themen[+i];
          const hat = st.S.content.has(t.id) || st.notesFor(t.id).length || (t.trainer && t.trainer.length);
          if (!(await confirmBox('Thema „' + t.name + '“ aus dem Lehrplan entfernen?' + (hat ? ' Inhalte und Lernzettel bleiben gespeichert, sind aber nicht mehr sichtbar.' : ''), 'Entfernen', true))) return;
          f.themen.splice(+i, 1); api.refresh();
        },
        delfach: async () => { if (!(await confirmBox('Fach „' + f.name + '“ löschen?', 'Löschen', true))) return; st.S.plan.faecher = st.S.plan.faecher.filter(x => x !== f); await st.savePlan(); api.close(); }
      });
    }
  });
}
function modEditor(m) {
  const isNew = !m;
  m = m || { id: 'M' + (st.S.plan.module.length + 1), name: '', klasse: '', stunden: '' };
  openSheet({
    title: isNew ? 'Neues Modul' : 'Modul ' + m.id, full: true,
    render(b, api) {
      b.innerHTML = `<div class="form">
        <label class="fld"><span>Nummer</span><input type="text" data-k="id" value="${esc(m.id)}"></label>
        <label class="fld"><span>Name</span><input type="text" data-k="name" value="${esc(m.name)}"></label>
        <label class="fld"><span>Klasse</span><input type="text" data-k="klasse" value="${esc(m.klasse || '')}"></label>
        <label class="fld"><span>Stunden</span><input type="text" inputmode="numeric" data-k="stunden" value="${esc(m.stunden || '')}"></label>
        <button class="btn filled" data-a="save">Speichern</button>${isNew ? '' : `<button class="btn danger" data-a="del">${icon('trash')} Modul löschen</button>`}</div>`;
      on(b, {
        save: async () => {
          const old = m.id;
          const id = $('[data-k="id"]', b).value.trim();
          if (!id) { toast('Die Nummer fehlt.'); return; }
          Object.assign(m, { id, name: $('[data-k="name"]', b).value.trim(), klasse: $('[data-k="klasse"]', b).value.trim(), stunden: $('[data-k="stunden"]', b).value.trim() });
          if (isNew) st.S.plan.module.push(m);
          else if (old !== id) for (const f of st.S.plan.faecher) f.module = (f.module || []).map(x => (x === old ? id : x));
          await st.savePlan(); api.close(); toast('Gespeichert.');
        },
        del: async () => { if (!(await confirmBox('Modul ' + m.id + ' löschen? Die Fächer bleiben.', 'Löschen', true))) return; st.S.plan.module = st.S.plan.module.filter(x => x !== m); for (const f of st.S.plan.faecher) f.module = (f.module || []).filter(x => x !== m.id); await st.savePlan(); api.close(); }
      });
    }
  });
}

/* ===== Datensicherung ===== */
export function datensicherung() {
  let fotos = false;
  return {
    title: 'Datensicherung',
    render(b) {
      const last = st.kvGet('letzteSicherung');
      b.innerHTML = `<div class="card how"><p>Deine Lerndaten liegen nur auf diesem Gerät. Mit einer Sicherung bringst du sie auf den Laptop oder rettest sie bei einem neuen iPhone. Die Datei enthält auch deine eingefügten Inhalte im Lernwerk-Format.</p><p class="muted">${last ? 'Letzte Sicherung: ' + esc(dayLong(last)) : 'Noch keine Sicherung gemacht.'}</p></div>
        ${list([row({ title: 'Fotos mitsichern', sub: 'Macht die Datei größer', right: sw('fotos', fotos) })])}
        <div class="btn-col"><button class="btn filled" data-a="export">${icon('save')} Sicherung erstellen</button>
        <label class="btn">${icon('open')} Sicherung laden<input type="file" accept=".json,application/json" data-k="file" hidden></label>
        <button class="btn" data-a="blocks">${icon('block')} Eigene Inhalte als Blöcke kopieren</button></div>
        <div class="sec-f">Auf dem iPhone öffnet sich das Teilen-Menü. Wähl „In Dateien sichern“. Zum Laden die Datei wieder auswählen. Laden ersetzt den Stand auf diesem Gerät.</div>`;
      $('[data-k="file"]', b).addEventListener('change', async e => {
        const file = e.target.files[0];
        if (!file) return;
        let data;
        try { data = JSON.parse(await file.text()); } catch (err) { toast('Die Datei kann ich nicht lesen.'); return; }
        if (!(await confirmBox('Sicherung vom ' + (data.erstellt ? new Date(data.erstellt).toLocaleDateString('de-DE') : '?') + ' laden? Der jetzige Stand auf diesem Gerät wird ersetzt.', 'Laden', true))) return;
        try { await st.importBackup(data); toast('Sicherung geladen. Lernwerk startet neu.'); setTimeout(() => location.reload(), 900); }
        catch (err) { toast(err.message); }
      });
      on(b, {
        'sw:fotos': v => { fotos = v; },
        export: async () => {
          const data = await st.exportBackup(fotos);
          const ok = await saveFile('lernwerk-sicherung-' + dayStr() + '.json', JSON.stringify(data));
          if (ok) { await st.markBackup(); toast('Sicherung erstellt.'); }
        },
        blocks: async () => {
          const txt = [...st.S.content.keys()].map(tid => st.exportTopic(tid)).join('\n\n');
          if (!txt) { toast('Noch keine eigenen Inhalte.'); return; }
          const ok = await copyText(txt); toast(ok ? 'Alle eigenen Inhalte kopiert.' : 'Kopieren hat nicht geklappt.');
        }
      });
    }
  };
}

/* ===== Darstellung, Erinnerung, Info ===== */
function themePage() {
  return {
    title: 'Darstellung',
    render(b) {
      const t = prefs.get('theme', 'auto');
      b.innerHTML = seg('t', [['auto', 'Automatisch'], ['hell', 'Hell'], ['dunkel', 'Dunkel']], t) + `<div class="sec-f">Automatisch folgt der Einstellung deines iPhones. Die Trainer übernehmen die Wahl.</div>`;
      on(b, { 'seg:t': v => { prefs.set('theme', v); applyTheme(v); } });
    }
  };
}
function erinnerungPage() {
  return {
    title: 'Erinnerung',
    render(b) {
      const url = location.origin + location.pathname.replace(/index\.html$/, '');
      b.innerHTML = `<div class="card prose"><p>Eine Web-App ohne Server kann keine Mitteilungen schicken. Mit der App <b>Kurzbefehle</b> auf dem iPhone geht es trotzdem:</p>
        <ol><li>Öffne die App Kurzbefehle und tippe unten auf <b>Automation</b>.</li>
        <li>Tippe auf <b>Neue Automation</b> und wähle <b>Tageszeit</b>.</li>
        <li>Stell die Uhrzeit ein, zum Beispiel 17:30 Uhr, und wähle die Wochentage. Dienstag und Donnerstag kannst du weglassen.</li>
        <li>Wähl <b>Sofort ausführen</b>, dann <b>Weiter</b>.</li>
        <li>Tippe auf <b>Neuer leerer Kurzbefehl</b>, such die Aktion <b>URL öffnen</b> und füge die Adresse unten ein.</li>
        <li>Fertig. Zur eingestellten Zeit öffnet sich Lernwerk.</li></ol>
        <p>Wenn du lieber eine Mitteilung willst: Statt URL öffnen die Aktion <b>Mitteilung anzeigen</b> nehmen, zum Beispiel mit dem Text „5 Minuten Lernwerk“.</p></div>
        <div class="card"><div class="card-k">Adresse der App</div><p class="url">${esc(url)}</p><button class="btn" data-a="copy">${icon('copy')} Adresse kopieren</button></div>`;
      on(b, { copy: async () => { const ok = await copyText(url); toast(ok ? 'Adresse kopiert.' : 'Kopieren hat nicht geklappt.'); } });
    }
  };
}
function infoPage() {
  return {
    title: 'Über Lernwerk',
    render(b) {
      b.innerHTML = `<div class="card prose"><p><b>Lernwerk Techniker</b>, Version ${esc(window.__lw ? window.__lw.VERSION : '')}</p>
        <p>Deine Lern-App für die Fachschule Technik. Alles läuft auf deinem Gerät, ohne Anmeldung und ohne Server. Deine Lerndaten, Fotos und eingefügten Inhalte bleiben auf diesem Gerät.</p>
        <p>Erst das Prinzip, dann die Aufgabe. Du rechnest, die App prüft.</p>
        <p><b>Im Zweifel gilt dein Tabellenbuch und der Unterricht.</b></p></div>
        <div class="sec-f">${esc(st.S.plan.schule || '')}</div>`;
    }
  };
}

/* ===== Im Unterricht: alle Themen auf einen Blick an- und ausschalten ===== */
const unterrichtOffen = new Set();
export function unterrichtPage() {
  return {
    title: 'Im Unterricht',
    render(b) {
      const akt = new Set(st.kvGet('aktuell', []));
      const swT = (tid, on) => `<span class="sw-wrap" data-t="${esc(tid)}">${sw('akt', on)}</span>`;
      const art = tid => st.isIntroOnly(tid) ? 'Einführung' : st.hasTopicContent(tid) ? 'Mit Übungen' : st.status(tid) === 'geplant' ? 'Noch leer' : 'Eigene Inhalte';
      const aktive = [...akt].map(id => st.thema(id)).filter(Boolean);
      let h = `<p class="src">Was du hier einschaltest, kommt in Heute und in 5 Minuten zuerst dran.</p>`;
      h += `<div class="sec-h">Gerade angewählt: ${aktive.length}</div>`;
      h += aktive.length
        ? list(aktive.map(({ fach: f, thema: t }) => row({ dot: f.farbe, title: t.name, sub: f.name, right: swT(t.id, true) })))
          + `<button class="btn small" data-a="alleaus">Alle abwählen</button>`
        : `<div class="sec-f">Noch nichts angewählt. Schalte unten die Themen ein, die gerade im Unterricht dran sind.</div>`;
      h += `<div class="sec-h">Alle Themen nach Fach</div>`;
      for (const f of st.faecher()) {
        if (!f.themen.length) continue;
        const n = f.themen.filter(t => akt.has(t.id)).length;
        h += `<details class="disc unt" data-f="${esc(f.id)}" ${unterrichtOffen.has(f.id) ? 'open' : ''}><summary><span class="row-dot" style="background:${f.farbe}"></span>${esc(f.name)}<span class="unt-n">${n ? n + ' von ' + f.themen.length + ' an' : f.themen.length + ' Themen'}</span></summary>`
          + list(f.themen.map(t => row({ title: t.name, sub: art(t.id), right: swT(t.id, akt.has(t.id)) }))) + `</details>`;
      }
      b.innerHTML = h;
      if (!b._untToggle) {
        b._untToggle = true;
        b.addEventListener('toggle', e => { const d = e.target.closest && e.target.closest('details[data-f]'); if (d) d.open ? unterrichtOffen.add(d.dataset.f) : unterrichtOffen.delete(d.dataset.f); }, true);
      }
      on(b, {
        'sw:akt': (v, el) => { const tid = el.closest('[data-t]').dataset.t; st.setAktuell(tid, v); toast(v ? 'Angewählt. Kommt in Heute zuerst.' : 'Abgewählt.'); },
        alleaus: async () => {
          if (!(await confirmBox('Alle Themen abwählen? Dein Fortschritt bleibt erhalten.', 'Abwählen', true))) return;
          for (const id of [...akt]) await st.setAktuell(id, false);
          toast('Alle abgewählt.');
        }
      });
    }
  };
}

/* ===== Noten: Ergebnisse der Klassenarbeiten ===== */
const fmtNote = n => (n == null ? '' : String(Math.round(n * 10) / 10).replace('.', ','));
const BEW = [['gut', 'Gut'], ['mittel', 'Mittel'], ['schlecht', 'Schlecht']];
export function notenPage() {
  return {
    title: 'Noten',
    actions: [{ label: 'Neu', icon: 'plus', onClick: () => notenEditor({}) }],
    render(b) {
      const today = dayStr();
      const graded = st.S.exams.filter(e => e.note != null || e.prozent != null).sort((a, c) => (a.datum > c.datum ? -1 : 1));
      const offen = st.S.exams.filter(e => e.note == null && e.prozent == null && e.datum < today).sort((a, c) => (a.datum > c.datum ? -1 : 1));
      let h = `<div class="btn-row"><button class="btn filled" data-a="neu">${icon('plus')} Note eintragen</button></div>`;
      if (offen.length) h += `<div class="sec-h">Note fehlt noch</div>` + list(offen.map(e => { const f = st.fach(e.fachId); return row({ a: 'ed', d: e.id, dot: f ? f.farbe : '#888', title: e.fach, sub: dayLong(e.datum), detail: 'eintragen' }); }));
      if (graded.length) {
        // Schnitt je Fach
        const by = new Map();
        for (const e of graded) if (e.note != null) { const k = e.fachId || e.fach; const x = by.get(k) || { fach: e.fach, f: st.fach(e.fachId), n: [] }; x.n.push(e.note); by.set(k, x); }
        if (by.size) h += `<div class="sec-h">Schnitt je Fach</div>` + list([...by.values()].map(x => row({ dot: x.f ? x.f.farbe : '#888', title: x.fach, sub: plural(x.n.length, 'Arbeit', 'Arbeiten'), detail: fmtNote(x.n.reduce((s, v) => s + v, 0) / x.n.length) })));
        h += `<div class="sec-h">Alle Arbeiten</div>` + list(graded.map(e => {
          const f = st.fach(e.fachId);
          const schwach = (e.themaIds || []).filter(t => ['mittel', 'schlecht'].includes(st.themaErgebnis(e, t))).length;
          return row({ a: 'ed', d: e.id, dot: f ? f.farbe : '#888', title: e.fach, sub: dayLong(e.datum) + ((e.themaIds || []).length ? ' · ' + plural(e.themaIds.length, 'Thema', 'Themen') : '') + (schwach ? ', ' + schwach + ' zum Nacharbeiten' : ''), detail: [e.note != null ? 'Note ' + fmtNote(e.note) : '', e.prozent != null ? fmtNum(e.prozent, 1) + ' %' : ''].filter(Boolean).join(' · ') });
        }));
      } else if (!offen.length) h += empty('Noch keine Note eingetragen.', 'Trag nach jeder Arbeit Note, Prozent und die Themen ein. Themen, die nicht gut liefen, zieht Lernwerk danach beim Lernen vor.');
      const nach = st.nacharbeitThemen(today);
      if (nach.size) h += `<div class="sec-h">Zum Nacharbeiten</div>` + list([...nach].map(([tid, v]) => row({ a: 'topic', d: tid, title: st.thema(tid).thema.name, sub: (v.bewertung === 'schlecht' ? 'Lief schlecht' : 'Lief mittel') + ' in ' + v.exam.fach + ', ' + dayShort(v.exam.datum) }))) + `<div class="btn-row"><button class="btn filled" data-a="nach">${icon('bolt')} Jetzt nacharbeiten</button></div>`;
      h += `<div class="sec-f">So wirkt es aufs Lernen: Themen, die in einer Arbeit schlecht liefen, kommen bei Alles wiederholen zuerst, mittel gelaufene direkt danach. Aus beiden kommen auch neue Karten dazu, selbst wenn sie nicht im Unterricht angewählt sind. Ohne eigene Bewertung zählt das Gesamtergebnis: ab 81 Prozent gut, ab 60 Prozent mittel, darunter schlecht. Das gilt 120 Tage nach der Arbeit oder bis eine neuere Arbeit das Thema gut bewertet. Deine Noten bleiben nur auf diesem Gerät und in deiner Datensicherung.</div>`;
      b.innerHTML = h;
      on(b, {
        neu: () => notenEditor({}),
        ed: id => { const e = st.S.exams.find(x => x.id === id); if (e) notenEditor(e); },
        topic: tid => push(topicPage(tid)),
        nach: () => {
          const tids = [...nach.keys()];
          const q = st.buildQueue(1200, { tids, mitFehlern: true, maxNeu: 12 });
          runSession(q.items.length ? q.items : sortForPractice(tids.flatMap(t => st.topicItems(t))).slice(0, 12), 'Nacharbeiten', { onClose: () => refreshTop() });
        }
      });
    }
  };
}
export function notenEditor(e0) {
  const e = Object.assign({ fachId: '', datum: dayStr(), themaIds: [], ergebnis: {}, note: null, prozent: null, notiz: '' }, JSON.parse(JSON.stringify(e0)));
  e.ergebnis = e.ergebnis || {};
  const num = v => { const x = parseFloat(String(v).replace(',', '.')); return isFinite(x) ? x : null; };
  const hint = p => { const n = st.noteAusProzent(p); return n ? 'Nach dem IHK-Schlüssel wären ' + fmtNum(p, 1) + ' Prozent etwa die Note ' + n + '. Achtung, deine Schule kann einen anderen Schlüssel haben.' : ''; };
  openSheet({
    title: e0.id ? 'Note bearbeiten' : 'Note eintragen', full: true,
    render(b, api) {
      const draw = () => {
        const f = st.fach(e.fachId);
        b.innerHTML = `<div class="form">
          <label class="fld"><span>Fach</span><select data-k="fach"><option value="">Fach wählen</option>${st.faecher().map(x => `<option value="${x.id}" ${x.id === e.fachId ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>
          <label class="fld"><span>Datum der Arbeit</span><input type="date" data-k="datum" value="${esc(e.datum)}"></label>
          <label class="fld"><span>Note, zum Beispiel 2 oder 2,3</span><input type="text" inputmode="decimal" data-k="note" value="${esc(fmtNote(e.note))}"></label>
          <label class="fld"><span>Prozent</span><input type="text" inputmode="decimal" data-k="prozent" value="${e.prozent != null ? esc(fmtNum(e.prozent, 1)) : ''}"></label>
          <div class="sec-f" data-k="vorschlag">${hint(e.prozent)}</div>
          ${f ? `<div class="sec-h">Welche Themen kamen dran?</div>${list(f.themen.map(t => row({ title: t.name, right: `<label class="switch"><input type="checkbox" data-t="${t.id}" ${e.themaIds.includes(t.id) ? 'checked' : ''}><span></span></label>`, html: e.themaIds.includes(t.id) ? seg('b:' + t.id, BEW, e.ergebnis[t.id] || st.themaErgebnis({ prozent: e.prozent, note: e.note }, t.id) || '') : '' })))}
            <div class="sec-f">Bei jedem Thema wählst du, wie es lief. Ohne Auswahl zählt das Gesamtergebnis.</div>` : ''}
          <label class="fld"><span>Notiz (optional)</span><input type="text" data-k="notiz" value="${esc(e.notiz || '')}" placeholder="Zum Beispiel: Zeit hat nicht gereicht"></label>
          <button class="btn filled" data-a="save">Speichern</button>${e0.id ? `<button class="btn danger" data-a="del">${icon('trash')} Arbeit löschen</button>` : ''}</div>`;
        $('[data-k="fach"]', b).onchange = ev => { grab(); e.fachId = ev.target.value; e.themaIds = []; e.ergebnis = {}; draw(); };
        $('[data-k="prozent"]', b).oninput = ev => { $('[data-k="vorschlag"]', b).textContent = hint(num(ev.target.value)); };
        $$('[data-t]', b).forEach(c => c.onchange = () => { grab(); const s = new Set(e.themaIds); c.checked ? s.add(c.dataset.t) : s.delete(c.dataset.t); e.themaIds = [...s]; draw(); });
      };
      const grab = () => {
        const v = k => { const el = $('[data-k="' + k + '"]', b); return el ? el.value : null; };
        if (v('datum') != null) e.datum = v('datum');
        if (v('note') != null) e.note = num(v('note'));
        if (v('prozent') != null) e.prozent = num(v('prozent'));
        if (v('notiz') != null) e.notiz = v('notiz');
      };
      draw();
      on(b, {
        save: async () => {
          grab();
          if (!e.fachId) { toast('Bitte ein Fach wählen.'); return; }
          if (!e.datum) { toast('Bitte das Datum wählen.'); return; }
          if (e.note == null && e.prozent == null) { toast('Trag eine Note oder die Prozent ein.'); return; }
          if (e.note != null && (e.note < 1 || e.note > 6)) { toast('Die Note muss zwischen 1 und 6 liegen.'); return; }
          if (e.prozent != null && (e.prozent < 0 || e.prozent > 100)) { toast('Prozent müssen zwischen 0 und 100 liegen.'); return; }
          const f = st.fach(e.fachId);
          const erg = {};
          for (const t of e.themaIds) if (e.ergebnis[t]) erg[t] = e.ergebnis[t];
          await st.addExam({ id: e0.id, fachId: e.fachId, fach: f.name, datum: e.datum, themen: e0.themen || '', themaIds: e.themaIds, note: e.note, prozent: e.prozent, ergebnis: erg, notiz: e.notiz });
          api.close(); toast('Note gespeichert. Schwache Themen ziehe ich beim Lernen vor.'); refreshTop();
        },
        del: async () => { if (await confirmBox('Diese Arbeit mit Note löschen?', 'Löschen', true)) { await st.deleteExam(e0.id); api.close(); refreshTop(); } }
      });
      b.addEventListener('click', ev => {
        const btn = ev.target.closest('[data-seg] button');
        if (!btn) return;
        const k = btn.closest('[data-seg]').dataset.seg;
        if (k.startsWith('b:')) e.ergebnis[k.slice(2)] = btn.dataset.v;
      });
    }
  });
}
