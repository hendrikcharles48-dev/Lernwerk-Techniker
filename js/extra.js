// Mehr: Termine, Lexikon, Formelsammlung, Probeklausur, Erklär-Training, Hörmodus, Suche,
// Lehrplan bearbeiten, Datensicherung, Darstellung, Erinnerung.
import { esc, dayStr, dayLong, dayShort, daysBetween, plural, plainText, norm, shuffle, fmtNum, markdown } from './util.js';
import { fml, speakFml, varsOf, parseEq, keyOf } from './formula.js';
import { lernplan } from './srs.js';
import * as st from './store.js';
import { $, $$, icon, row, list, seg, sw, empty, on, push, pop, openSheet, toast, copyText, progress, confirmBox, saveFile, refreshTop, hinweisTabellenbuch } from './ui.js';
import { topicPage, runSession, runItem, ZUSTAENDE, staerkeHTML, sortForPractice, topicProgress, formelCard, askClaude, noteReader, openTrainer, itemTitle, rich, schmierKnopf, schmierzettel } from './engine.js';
import { speak, stopSpeaking, canSpeak, keepAwake, pause, readAloud, stopReading, deVoices } from './speech.js';
import * as hoer from './hoer.js';
import * as sk from './skizzen.js';
import { folge, dauerSchaetzung, DENKPAUSE } from './podcast.js';
import { prefs } from './db.js';
import * as gh from './sicherung.js';

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
  const g = st.S.exams.filter(e => e.note != null || e.prozent != null).length;
  return g ? plural(g, 'Klausur', 'Klausuren') + ' eingetragen' : 'Noten der Klausuren';
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
        row({ a: 'backup', icon: 'save', color: '#34C759', title: 'Datensicherung', sub: gh.aktiv() ? (gh.fehler() ? 'Sicherung hat ein Problem' : 'Automatisch über GitHub' + (gh.zuletzt() ? ', zuletzt ' + zeitKurz(gh.zuletzt()) : '')) : st.kvGet('letzteSicherung') ? 'Letzte Sicherung: ' + dayShort(st.kvGet('letzteSicherung')) : 'Noch keine Sicherung' }),
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
        note: () => push(klausurPage(e.id)),
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

/* ===== Probeklausur =====
 * Wie im Ernstfall: echte Zeitvorgabe, keine Tipps, Rechnen auf Papier, nur Ergebnisse eintippen.
 * Vier Aufgabenarten: Rechnen (App prüft), Begriffe erklären, Skizzen (auf Papier) und Text.
 * Auswertung erst am Ende: Kernpunkte abhaken, daraus rechnet die App Punkte und Note.
 */
const GRADABLE = ['aufgabe', 'umstellen', 'auswahl', 'reihenfolge'];
const PUNKTE_RECHNEN = 3;
const ART_NAME = { erklaeren: 'Erklären', skizze: 'Skizze', text: 'Text' };
export function probePage(exam) {
  let mode = exam ? 'arbeit' : 'themen';
  let sel = new Set(exam ? exam.themaIds || [] : []);
  let anzahl = 10, minuten = prefs.get('probeMin', 45);
  const hatAufgaben = tid => st.topicItems(tid).some(i => GRADABLE.includes(i.art)) || st.pruefItems(tid).length;
  return {
    title: 'Probeklausur',
    render(b) {
      const next = exam || st.nextExam();
      const withItems = st.faecher().map(f => ({ f, ts: f.themen.filter(t => hatAufgaben(t.id)) })).filter(x => x.ts.length);
      let h = `<div class="card how"><p>Wie im Ernstfall: Die Zeit läuft, Tipps sind gesperrt. Du rechnest auf Papier und tippst nur das Ergebnis ein. Erklär- und Textaufgaben schreibst du kurz, Skizzen zeichnest du auf Papier. Die Auswertung kommt erst am Ende.</p></div>`;
      h += seg('mode', [['arbeit', 'Nächste Arbeit'], ['themen', 'Themen wählen']], mode);
      if (mode === 'arbeit') {
        if (!next) h += empty('Keine Klassenarbeit eingetragen.', 'Trag unter Termine eine Arbeit ein oder wähl Themen.');
        else { sel = new Set(next.themaIds || []); h += list([row({ title: next.fach + ', ' + dayLong(next.datum), sub: (next.themaIds || []).map(t => (st.thema(t) || { thema: { name: '' } }).thema.name).join(', ') || 'Keine Themen zugeordnet' })]); }
      } else {
        if (!withItems.length) h += empty('Noch keine Themen mit Aufgaben.', 'Aufgaben kommen über Aufgabe-Zeilen im Lernwerk-Block. „Formeln umstellen“ in Mathematik hat schon welche.');
        for (const x of withItems) h += `<div class="sec-h">${esc(x.f.name)}</div>` + list(x.ts.map(t => row({ title: t.name, right: `<label class="switch"><input type="checkbox" data-t="${t.id}" ${sel.has(t.id) ? 'checked' : ''}><span></span></label>` })));
      }
      h += `<div class="sec-h">Umfang</div>` + seg('n', [['5', '5 Aufgaben'], ['10', '10 Aufgaben'], ['15', '15 Aufgaben']], String(anzahl));
      h += `<div class="sec-h">Zeitvorgabe</div>` + seg('min', [['0', 'Ohne'], ['30', '30 Min'], ['45', '45 Min'], ['60', '60 Min'], ['90', '90 Min']], String(minuten));
      h += `<p class="src">Etwa 6 von 10 Aufgaben sind Rechenaufgaben, der Rest Erklären, Skizzen und Text, soweit das Thema sie hat.</p>`;
      h += `<button class="btn filled wide" data-a="start">Probeklausur starten</button>`;
      b.innerHTML = h;
      $$('[data-t]', b).forEach(c => c.onchange = () => { c.checked ? sel.add(c.dataset.t) : sel.delete(c.dataset.t); });
      on(b, {
        'seg:mode': v => { mode = v; this.render(b); }, 'seg:n': v => { anzahl = +v; }, 'seg:min': v => { minuten = +v; prefs.set('probeMin', minuten); },
        start: () => {
          const tids = [...sel];
          // gleichmäßig über die Themen verteilen, erst Rechnen, dann die anderen Arten
          const rund = (lists, n, out) => { while (out.length < n && lists.some(x => x.length)) for (const x of lists) if (x.length && out.length < n) out.push(x.shift()); return out; };
          const rechnen = tids.map(t => shuffle(st.topicItems(t).filter(i => GRADABLE.includes(i.art))));
          const andere = tids.map(t => shuffle(st.pruefItems(t)).sort((a, c) => (a.art === 'text') - (c.art === 'text')));
          const nR = andere.some(x => x.length) ? Math.round(anzahl * 0.6) : anzahl;
          const mix = rund(rechnen, nR, []);
          rund(andere, anzahl, mix);
          rund(rechnen, anzahl, mix);
          if (!mix.length) { toast('Wähl Themen mit Aufgaben aus.'); return; }
          runExam(shuffle(mix), minuten);
        }
      });
    }
  };
}
function runExam(items, minuten) {
  const res = [];
  let i = 0, fertig = false;
  const t0 = Date.now(), limit = minuten * 60000;
  let tm = null, sheet = null, zettel = null;
  openSheet({
    title: 'Probeklausur', full: true,
    confirmClose: () => fertig || confirm('Probeklausur abbrechen?'),
    onClose: () => { clearInterval(tm); if (res.length) gh.anstossen(); },
    render(body, api) { sheet = api; body.innerHTML = `<div class="sess-top">${progress(0)}<div class="sess-info"></div>${schmierKnopf()}</div><div class="sess-item"></div>`; zettel = schmierzettel(body); show(); }
  });
  function fmtT(ms) { const s = Math.max(0, Math.floor(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  function info() {
    const n = $('.sess-info', sheet.body); if (!n) return;
    const z = Date.now() - t0;
    n.textContent = (fertig ? 'Auswertung' : 'Aufgabe ' + (i + 1) + ' von ' + items.length) + (fertig ? '' : limit ? ' · noch ' + fmtT(limit - z) : ' · ' + fmtT(z));
    n.classList.toggle('knapp', !!limit && !fertig && limit - z < 5 * 60000);
    if (limit && !fertig && z >= limit) { toast('Zeit um. Die Arbeit wird abgegeben.'); abgeben(); }
  }
  tm = setInterval(info, 1000);
  function abgeben() { fertig = true; clearInterval(tm); show(); }
  function weiter(r) { if (fertig) return; res.push(r); i++; show(); $('.sheet-body', sheet.el).scrollTop = 0; }
  function show() {
    if (i >= items.length) fertig = true;
    info();
    zettel.neu();
    $('.bar i', sheet.body).style.width = Math.round(Math.min(i, items.length) / items.length * 100) + '%';
    const box = $('.sess-item', sheet.body);
    const fresh = box.cloneNode(false); box.replaceWith(fresh);
    if (fertig) return auswertung(fresh);
    const it = items[i];
    if (GRADABLE.includes(it.art)) return runItem(fresh, it, { exam: true, blind: true, onDone: async (erg, inf) => { await st.recordCard(it, erg); weiter({ it, erg, inf: inf || {} }); } });
    // Erklären, Text, Skizze: kein Prüfen jetzt, erst bei der Auswertung
    const th = st.thema(it.tid);
    fresh.innerHTML = `<div class="ex-ctx"><span class="dot"></span>Probeklausur · ${ART_NAME[it.art]}</div><div class="ex-task">${rich(it.frage)}</div>
      ${it.art === 'skizze' ? `<div class="card how"><p>Zeichne die Skizze auf Papier. Beschrifte alles, was dazugehört. Bei der Auswertung hakst du ab, was drauf ist.</p></div>` : `<textarea class="big-ta" rows="6" data-k="antw" placeholder="${it.art === 'erklaeren' ? 'Erklär in ganzen Sätzen …' : 'Deine Antwort …'}"></textarea>`}
      <div class="btn-col"><button class="btn filled" data-a="next">${it.art === 'skizze' ? 'Fertig gezeichnet, weiter' : 'Abgeben und weiter'}</button></div>`;
    on(fresh, { next: () => { const ta = $('[data-k="antw"]', fresh); weiter({ it, erg: null, inf: { antwort: ta ? ta.value.trim() : '' }, fach: th ? th.fach.name : '' }); } });
  }
  function auswertung(box) {
    clearInterval(tm);
    const offen = items.slice(res.length).map(it => ({ it, erg: GRADABLE.includes(it.art) ? 'falsch' : null, inf: { antwort: '', offen: true } }));
    const alle = res.concat(offen);
    const rech = alle.filter(r => GRADABLE.includes(r.it.art)), kern = alle.filter(r => !GRADABLE.includes(r.it.art));
    const haken = kern.map(() => new Set());
    const draw = () => {
      const pRech = rech.filter(r => r.erg === 'richtig').length * PUNKTE_RECHNEN, maxRech = rech.length * PUNKTE_RECHNEN;
      const pKern = haken.reduce((s, x) => s + x.size, 0), maxKern = kern.reduce((s, r) => s + r.it.kern.length, 0);
      const max = maxRech + maxKern, p = pRech + pKern, proz = max ? Math.round(p / max * 100) : 0;
      const note = st.noteAusProzent(proz);
      let h = `<div class="sum"><div class="sum-big">${p} von ${max} Punkten</div><div class="muted">${proz} %${note ? ', Note ' + note : ''}${minuten ? ' · ' + fmtT(Math.min(Date.now() - t0, limit)) + ' von ' + minuten + ':00 Minuten' : ' · ' + fmtT(Date.now() - t0) + ' Minuten'}</div>${offen.length ? `<p class="muted small">${plural(offen.length, 'Aufgabe', 'Aufgaben')} nicht mehr geschafft, zählt mit 0 Punkten.</p>` : ''}</div>`;
      if (kern.length) {
        h += `<div class="sec-h">Selbst korrigieren</div><p class="src">Hak jeden Kernpunkt ab, den deine Antwort oder Skizze wirklich enthält. Daraus rechne ich die Punkte.</p>`;
        h += kern.map((r, k) => `<div class="card korr"><div class="card-k">${ART_NAME[r.it.art]} · ${r.it.kern.length} ${r.it.kern.length === 1 ? 'Punkt' : 'Punkte'}</div><div class="ex-task">${rich(r.it.frage)}</div>
          ${r.it.art !== 'skizze' ? `<div class="korr-a"><span class="muted small">Deine Antwort</span><p>${r.inf.antwort ? esc(r.inf.antwort) : '<i class="muted">nichts geschrieben</i>'}</p></div>` : ''}
          <div class="muted small">Musterlösung, Kernpunkte zum Abhaken</div>
          ${r.it.kern.map((x, j) => `<label class="korr-k"><input type="checkbox" data-k="${k}" data-j="${j}" ${haken[k].has(j) ? 'checked' : ''}><span>${rich(x)}</span></label>`).join('')}
          ${r.it.art !== 'skizze' && r.inf.antwort ? `<button class="btn small" data-a="claude" data-d="${k}">${icon('claude')} An Claude zur Korrektur</button>` : ''}</div>`).join('');
      }
      const by = new Map();
      for (const r of rech) { const key = r.it.tid; if (!by.has(key)) by.set(key, []); by.get(key).push(r); }
      if (by.size) h += `<div class="sec-h">Rechnen pro Thema</div>` + list([...by].map(([tid, rs]) => { const th = st.thema(tid); const n = rs.filter(r => r.erg === 'richtig').length; return row({ title: th ? th.thema.name : 'Thema', sub: th ? th.fach.name : '', detail: n + ' von ' + rs.length, html: progress(n / rs.length, n / rs.length >= 0.8 ? 'var(--green)' : n / rs.length >= 0.5 ? 'var(--orange)' : 'var(--red)') }); }));
      const wrong = rech.filter(r => r.erg !== 'richtig');
      const arten = new Map();
      for (const r of wrong) { const k = r.inf.fehlerart || (r.inf.eingabe ? 'Rechenweg' : 'Nicht bearbeitet'); arten.set(k, (arten.get(k) || 0) + 1); }
      if (arten.size) h += `<div class="sec-h">Nach Fehlerart</div>` + list([...arten].sort((a, c) => c[1] - a[1]).map(([k, n]) => row({ title: k, detail: String(n) })));
      if (wrong.length) h += `<div class="sec-h">Das schaust du dir nochmal an</div>` + list(wrong.map(r => row({ titleHTML: rich(r.inf.aufgabe || itemTitle(r.it)), sub: r.inf.offen ? 'Nicht mehr geschafft' : 'Deine Eingabe: ' + (r.inf.eingabe || '–') + (r.inf.richtig ? ' · richtig: ' + r.inf.richtig : '') })));
      h += `<div class="btn-col">${kern.some(r => r.inf.antwort) ? `<button class="btn" data-a="claudeAlle">${icon('claude')} Alle Antworten an Claude zur Korrektur</button>` : ''}<button class="btn filled" data-a="close">Fertig</button></div>`;
      box.innerHTML = h;
      $$('[data-j]', box).forEach(c => c.onchange = () => { const s = haken[+c.dataset.k]; c.checked ? s.add(+c.dataset.j) : s.delete(+c.dataset.j); const sc = $('.sheet-body', sheet.el).scrollTop; draw(); $('.sheet-body', sheet.el).scrollTop = sc; });
    };
    const frage = r => { const th = st.thema(r.it.tid); return `Aufgabe${th ? ' (' + th.fach.name + ', ' + th.thema.name + ')' : ''}: ${r.it.frage}\nMeine Antwort: ${r.inf.antwort}\nMusterlösung laut Lernwerk, Kernpunkte: ${r.it.kern.join('; ')}`; };
    on(box, {
      close: () => sheet.close(),
      claude: k => askClaude('Korrigier bitte meine Antwort aus einer Probeklausur wie ein Lehrer an der Fachschule Technik. Sag, welche Kernpunkte fehlen oder falsch sind, wie viele Punkte du geben würdest und wie eine gute Antwort klingt.\n\n' + frage(kern[+k])),
      claudeAlle: () => askClaude('Korrigier bitte meine Antworten aus einer Probeklausur wie ein Lehrer an der Fachschule Technik. Sag je Aufgabe, welche Kernpunkte fehlen oder falsch sind und wie viele Punkte du geben würdest.\n\n' + kern.filter(r => r.inf.antwort).map((r, k) => (k + 1) + '. ' + frage(r)).join('\n\n'))
    });
    draw();
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
// Folgen: Lena fragt, Tom erklärt. Abfragen: Karten mit Denkpause und Selbstbewertung. Lernzettel: vorlesen.
const MIN = s => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
export function hoerPage(opt = {}) {
  let art = prefs.get('hoerArt', 'folgen'), quelle = opt.exam ? 'arbeit' : prefs.get('hoerQuelle', 'unterricht'), fid = '', noteId = '';
  let formeln = true, run = 0, idx = 0, playing = false, queue = [], warte = null, off = null;
  const denk = () => prefs.get('hoerDenk', 5);
  return {
    title: 'Hörmodus',
    render(b) {
      if (off) off();
      const ex = opt.exam || st.nextExam();
      const tidsQuelle = () => {
        if (quelle === 'arbeit') return ex ? ((ex.themaIds || []).length ? ex.themaIds : (st.fach(ex.fachId) || { themen: [] }).themen.map(t => t.id)) : [];
        if (quelle === 'fach') return (st.fach(fid) || { themen: [] }).themen.map(t => t.id);
        if (quelle === 'schwach') return st.faecher().flatMap(f => f.themen.map(t => t.id)).filter(t => st.topicItems(t).length && st.staerke(t).stufe === 'schwach');
        return st.kvGet('aktuell', []).filter(t => st.thema(t));
      };
      let h = seg('art', [['folgen', 'Folgen'], ['abfragen', 'Abfragen'], ['zettel', 'Lernzettel']], art);
      if (art !== 'zettel') {
        h += seg('q', [['unterricht', 'Unterricht'], ['arbeit', 'Nächste Arbeit'], ['schwach', 'Schwach'], ['fach', 'Fach']], quelle);
        if (quelle === 'arbeit') h += ex ? `<p class="muted small">${esc(ex.fach)}, ${esc(dayShort(ex.datum))}</p>` : empty('Keine Arbeit eingetragen.', 'Wähl ein Fach.');
        if (quelle === 'fach') h += `<label class="fld"><span>Fach</span><select data-k="f"><option value="">Fach wählen</option>${st.faecher().map(f => `<option value="${f.id}" ${f.id === fid ? 'selected' : ''}>${esc(f.name)}</option>`).join('')}</select></label>`;
      }
      if (art === 'folgen') h += folgenHTML(tidsQuelle());
      if (art === 'abfragen') h += abfragenHTML();
      if (art === 'zettel') h += zettelHTML();
      h += stimmeHTML();
      b.innerHTML = h;
      const sel = $('[data-k="f"]', b); if (sel) sel.onchange = e => { fid = e.target.value; stopAbfrage(); this.render(b); };
      const nsel = $('[data-k="n"]', b); if (nsel) nsel.onchange = e => { noteId = e.target.value; };
      const rng = $('[data-k="pos"]', b); if (rng) rng.oninput = e => hoer.setzen(+e.target.value);
      ['A', 'B'].forEach(w => { const vs = $(`[data-k="st${w}"]`, b); if (vs) vs.onchange = e => prefs.set('stimme' + w, e.target.value); });
      if (canSpeak() && !deVoices().length) speechSynthesis.onvoiceschanged = () => { speechSynthesis.onvoiceschanged = null; if (b.isConnected) this.render(b); };

      // Folgen-Player live aktualisieren, solange die Seite offen ist
      const live = () => {
        if (!b.isConnected) { if (off) off(); return; }
        const z = hoer.zustand();
        const pl = $('.fplayer', b); if (!pl) return;
        pl.classList.toggle('on', !!z.tid);
        $('.fp-t', b).textContent = z.info ? z.info.thema : z.tid ? (st.thema(z.tid) || { thema: { name: '' } }).thema.name : '';
        $('.fp-f', b).textContent = (z.info ? z.info.fach : z.system ? 'Systemstimme' : '') + (z.auto && z.tid ? ' · Auto-Playlist, Folge ' + (z.i + 1) + ' von ' + z.liste.length : '');
        $('.fp-z', b).innerHTML = z.zeile ? `<b>${esc(z.zeile.wer)}:</b> ${esc(z.zeile.text)}` : '';
        $('[data-a="fplay"]', b).innerHTML = icon(z.spielt ? 'pause' : 'play');
        const r = $('[data-k="pos"]', b);
        if (r) { r.hidden = z.system || !z.dauer; r.max = z.dauer || 1; if (document.activeElement !== r) r.value = z.zeit; }
        $('.fp-zeit', b).textContent = z.dauer ? MIN(z.zeit) + ' / ' + MIN(z.dauer) : '';
        $$('[data-a="tempo"]', b).forEach(x => x.classList.toggle('on', +x.dataset.d === z.rate));
        $$('.ep', b).forEach(x => x.classList.toggle('now', x.dataset.d === z.tid));
        // Skizze zum Thema, solange die Folge läuft
        const skb = $('.fp-sk', b);
        if (skb && skb.dataset.tid !== (z.tid || '')) { skb.dataset.tid = z.tid || ''; skb.innerHTML = z.tid ? sk.html(z.tid, true) : ''; sk.fuellen(skb); }
      };
      off = hoer.subscribe(live);
      live();

      /* ===== Abfragen ===== */
      const ui = () => {
        const it = queue[idx];
        const q = $('.pl-q', b); if (!q) return;
        q.textContent = it ? it.q : playing ? '' : 'Tippe auf Start.';
        $('.pl-a', b).textContent = it && it.shown ? it.a : '';
        $('.pl-n', b).textContent = queue.length ? (idx + 1) + ' von ' + queue.length : '';
        $('[data-a="play"]', b).innerHTML = icon(playing ? 'pause' : 'play');
        $('.pl-r', b).hidden = !(it && it.shown && !it.text && it.item);
      };
      const build = () => {
        const out = [];
        for (const t of tidsQuelle()) {
          for (const it of st.topicItems(t)) if (it.art === 'karte' || it.art === 'begriff') out.push({ q: it.frage, a: it.antwort, sq: speakable(it.frage), sa: speakable(it.antwort), item: it, stelle: hoer.kartenStelle(t, it.frage) });
          if (formeln) st.topic(t).formeln.forEach(fo => { const q = 'Wie lautet die Formel ' + (fo.name ? 'für ' + fo.name : '') + '?'; out.push({ q, a: fo.formel, sa: speakFml(fo.formel) + (fo.umgestellt.length ? '. Umgestellt: ' + fo.umgestellt.map(speakFml).join('. ') : ''), stelle: hoer.kartenStelle(t, q) }); });
        }
        return sortForPractice(out.map((x, k) => Object.assign(x, { id: x.item ? x.item.id : 'h' + k }))).slice(0, 40);
      };
      // Frage, Denkpause, Antwort. Mit Audiodatei in Toms und Lenas Stimme, sonst Systemstimme.
      const sag = async (it, teil) => {
        if (it.stelle) { const s = it.stelle[teil]; return hoer.ausschnitt(it.stelle.datei, s[0], s[1]); }
        return speak(teil === 'frage' ? (it.sq || it.q) : (it.sa || it.a), 0.95, teil === 'frage' ? 'A' : 'B');
      };
      async function loop(token) {
        while (playing && token === run && idx < queue.length) {
          const it = queue[idx];
          it.shown = false; ui();
          await sag(it, 'frage');
          if (token !== run) return;
          $('.pl-a', b).textContent = 'Sag die Antwort laut …';
          await pause(denk() * 1000); if (token !== run) return;
          it.shown = true; ui();
          await sag(it, 'antwort');
          if (token !== run) return;
          // Kurz Zeit für die Selbstbewertung. Ohne Antippen geht es weiter, dann zählt nichts.
          if (it.item) { const r = await new Promise(res => { warte = res; setTimeout(() => res(null), 4500); }); warte = null; if (token !== run) return; if (r) await st.recordCard(it.item, r); }
          else await pause(1200);
          if (token !== run) return;
          idx++;
        }
        if (token === run && idx >= queue.length && playing) { playing = false; keepAwake(false); ui(); const q = $('.pl-q', b); if (q) q.textContent = 'Fertig. Gut gemacht.'; }
      }
      const start = () => { hoer.stopp(); stopReading(); if (!queue.length || idx >= queue.length) { queue = build(); idx = 0; } if (!queue.length) { toast('Hier gibt es nichts abzufragen.'); return; } playing = true; run++; keepAwake(true); loop(run); ui(); };
      function stopAbfrage() { playing = false; run++; stopSpeaking(); hoer.ausschnittStopp(); keepAwake(false); queue = []; idx = 0; }
      const bewerten = r => { if (warte) warte(r); };
      const alle = () => { const l = tidsQuelle().filter(t => st.topic(t) && folge(st.topic(t)).length > 5); if (!l.length) return toast('Hier gibt es keine Folgen.'); const g = hoer.gehoert(); const i = l.findIndex(t => !g[t]); hoer.spielen(l, i < 0 ? 0 : i); };
      if (!hoer.bereit()) hoer.index().then(() => { if (b.isConnected) this.render(b); });

      on(b, {
        'seg:art': v => { art = v; prefs.set('hoerArt', v); stopAbfrage(); this.render(b); },
        'seg:q': v => { quelle = v; prefs.set('hoerQuelle', v); stopAbfrage(); this.render(b); },
        'sw:fo': v => { formeln = v; stopAbfrage(); },
        ep: tid => { const l = tidsQuelle().filter(t => st.topic(t) && folge(st.topic(t)).length > 5); hoer.spielen(l, Math.max(0, l.indexOf(tid))); },
        alle: () => alle(),
        fplay: () => { const z = hoer.zustand(); if (!z.tid) return alle(); hoer.umschalten(); },
        fback: () => hoer.springen(-15), ffwd: () => hoer.springen(15), fprev: () => hoer.teil(-1), fnext: () => hoer.teil(1),
        tempo: d => hoer.tempo(+d),
        automin: d => { prefs.set('autoMin', +d); this.render(b); },
        auto: async () => {
          const l = await hoer.autoStart(prefs.get('autoMin', 30));
          if (!l.length) return toast('Gerade gibt es keine Folgen mit Audiodatei.');
          toast(plural(l.length, 'Folge', 'Folgen') + ' in der Playlist. Gute Fahrt!');
        },
        offline: async (d, el) => {
          const l = tidsQuelle().filter(t => hoer.infoSync(t));
          if (!l.length) return toast('Für diese Auswahl gibt es keine Audiodateien.');
          el.disabled = true;
          await hoer.offlineLaden(l, (n, m) => { el.textContent = 'Lade ' + n + ' von ' + m + ' …'; });
          el.textContent = 'Offline gespeichert'; toast('Die Folgen gehen jetzt auch ohne Netz.');
        },
        play: () => { if (playing) { playing = false; run++; stopSpeaking(); hoer.ausschnittStopp(); keepAwake(false); ui(); } else start(); },
        next: () => { if (!queue.length) return start(); run++; stopSpeaking(); hoer.ausschnittStopp(); idx = Math.min(idx + 1, queue.length - 1); if (playing) loop(run); ui(); },
        rep: () => { if (!queue.length) return start(); run++; stopSpeaking(); hoer.ausschnittStopp(); if (!playing) { playing = true; keepAwake(true); } loop(run); ui(); },
        gut: () => bewerten('richtig'), schlecht: () => bewerten('falsch'),
        denk: d => { prefs.set('hoerDenk', +d); this.render(b); },
        zettel: () => {
          const n = st.S.notes.find(x => x.id === noteId);
          if (!n) return toast('Wähl zuerst einen Lernzettel.');
          hoer.stopp();
          const txt = plainText(n.text);
          // Zettel mit Zeilen wie „Lena: …“ und „Tom: …“ werden als Gespräch mit zwei Stimmen gelesen
          if (/^(Lena|Tom|A|B)\s*:/m.test(txt)) return gespraech(n.text);
          readAloud(txt, n.titel || 'Lernzettel');
        },
        probe: w => speak(w === 'A' ? 'Hallo, ich bin Lena. Ich stelle die Fragen.' : 'Und ich bin Tom. Ich erkläre dir das Prinzip.', 1, w),
        systempo: d => { prefs.set('sysTempo', +d); this.render(b); }
      });
      ui();
    }
  };
  function folgenHTML(tids) {
    const g = hoer.gehoert();
    const rows = tids.map(t => {
      const th = st.thema(t); if (!th) return '';
      const tp = st.topic(t); const segs = tp ? folge(tp) : [];
      if (segs.length < 6) return '';
      const info = hoer.infoSync(t);
      const eigen = tp.podcast && tp.podcast.length;
      const sub = [th.fach.name, MIN(info ? info.dauer : dauerSchaetzung(segs)) + ' Min', info && !eigen ? '' : 'Systemstimme', g[t] ? 'gehört' : ''].filter(Boolean).join(' · ');
      return row({ a: 'ep', d: t, cls: 'ep', title: th.thema.name, sub, icon: g[t] ? 'check' : 'ear', color: g[t] ? '#30D158' : '#0A84FF' });
    }).filter(Boolean);
    let h = `<div class="fplayer"><div class="fp-f muted small"></div><div class="fp-t"></div><div class="fp-z"></div><div class="fp-sk"></div>
      <input type="range" data-k="pos" min="0" max="1" step="1" value="0" aria-label="Position"><div class="fp-zeit muted small"></div>
      <div class="pl-btns"><button class="pl-b" data-a="fprev" aria-label="Vorheriger Teil">${icon('prev')}</button><button class="pl-b" data-a="fback" aria-label="15 Sekunden zurück">${icon('back15')}</button><button class="pl-b big" data-a="fplay" aria-label="Start oder Pause">${icon('play')}</button><button class="pl-b" data-a="ffwd" aria-label="15 Sekunden vor">${icon('fwd15')}</button><button class="pl-b" data-a="fnext" aria-label="Nächster Teil">${icon('next')}</button></div>
      <div class="chips fp-tempo">${[0.8, 1, 1.2, 1.5].map(r => `<button class="tchip sm" data-a="tempo" data-d="${r}">${String(r).replace('.', ',')}×</button>`).join('')}</div></div>`;
    const am = prefs.get('autoMin', 30);
    h = `<div class="card auto-card"><div class="card-k">${icon('car')} Im Auto</div><p class="small">Mehrere Folgen am Stück, Themen der nächsten Arbeit zuerst. Läuft bei gesperrtem Bildschirm weiter. Weiter, Zurück und Pause gehen über Lenkrad, CarPlay und Sperrbildschirm.</p>
      <div class="chips">${[15, 30, 45, 60].map(m => `<button class="tchip sm ${am === m ? 'on' : ''}" data-a="automin" data-d="${m}">${m} Min</button>`).join('')}</div>
      <button class="btn filled wide" data-a="auto">${icon('play')} Auto-Playlist starten</button></div>` + h;
    if (!rows.length) return h + empty('Hier gibt es noch keine Folgen.', 'Wähl Themen im Unterricht aus oder nimm ein Fach.');
    h += `<div class="btn-row"><button class="btn filled" data-a="alle">${icon('play')} Alle abspielen</button><button class="btn" data-a="offline">${icon('download')} Offline laden, rund ${hoer.groesseMB(tids)} MB</button></div>`;
    h += list(rows);
    h += `<p class="muted small">Lena fragt, Tom erklärt. Vor jeder Antwort sind ${Math.round(DENKPAUSE / 1000)} Sekunden Pause: Sag die Antwort laut, das bringt am meisten. Mit Kopfhörern und auf dem Sperrbildschirm kannst du pausieren und springen.</p>`;
    h += `<details class="disc"><summary>${icon('edit')} Eigene Folge schreiben</summary><div class="prose"><p>Schreib in einen Lernwerk-Block Zeilen wie diese und füge ihn über Einfügen hinzu:</p><p><code>Podcast: Lena | Tom, was ist eigentlich ein Moment?</code><br><code>Podcast: Tom | Stell dir einen Schraubenschlüssel vor …</code></p><p>Dann spielt die App deine Folge statt der automatischen, mit den Systemstimmen. Claude kann dir so ein Skript schreiben: Bitte um ein Gespräch, in dem Tom Lena das Thema erklärt.</p></div></details>`;
    return h;
  }
  function abfragenHTML() {
    let h = list([row({ title: 'Formeln mit abfragen', right: sw('fo', formeln) })]);
    h += `<div class="sec-h">Denkpause vor der Antwort</div><div class="chips">${[3, 5, 8, 12].map(s => `<button class="tchip sm ${denk() === s ? 'on' : ''}" data-a="denk" data-d="${s}">${s} s</button>`).join('')}</div>`;
    h += `<div class="player"><div class="pl-q">Tippe auf Start.</div><div class="pl-a"></div><div class="pl-n muted"></div>
      <div class="pl-r" hidden><button class="btn small" data-a="schlecht">Noch nicht</button><button class="btn small filled" data-a="gut">Wusste ich</button></div>
      <div class="pl-btns"><button class="pl-b" data-a="rep" aria-label="Wiederholen">${icon('repeat')}</button><button class="pl-b big" data-a="play" aria-label="Start oder Pause">${icon('play')}</button><button class="pl-b" data-a="next" aria-label="Weiter">${icon('next')}</button></div></div>`;
    h += `<p class="muted small">Nach der Antwort kannst du kurz antippen, ob du es wusstest. Das zählt für die Wiederholung wie bei den Karten. Tippst du nichts, geht es einfach weiter. Fragen aus den Folgen hörst du mit Lenas und Toms Stimme.</p>`;
    return h;
  }
  function zettelHTML() {
    const notes = st.S.notes.slice().sort((a, c) => c.zeit - a.zeit);
    if (!notes.length) return empty('Noch keine Lernzettel.');
    return `<label class="fld"><span>Lernzettel</span><select data-k="n"><option value="">Lernzettel wählen</option>${notes.map(n => `<option value="${n.id}" ${n.id === noteId ? 'selected' : ''}>${esc(n.titel || 'Lernzettel')}</option>`).join('')}</select></label>
      <div class="btn-row"><button class="btn filled" data-a="zettel">${icon('play')} Vorlesen</button></div>
      <p class="muted small">Lernzettel bleiben auf deinem Gerät und werden mit der Systemstimme gelesen. Stehen Zeilen mit „Lena:“ und „Tom:“ darin, hörst du ein Gespräch mit zwei Stimmen.</p>`;
  }
  function stimmeHTML() {
    const vs = deVoices();
    const opts = w => `<option value="">Automatisch</option>` + vs.map(v => `<option value="${esc(v.name)}" ${prefs.get('stimme' + w, '') === v.name ? 'selected' : ''}>${esc(v.name)}</option>`).join('');
    return `<details class="disc"><summary>${icon('mic')} Stimmen</summary><div class="prose">
      <p><b>Lena und Tom sind eingebaut.</b> Für die Folgen und das Abfragen musst du nichts herunterladen und nichts einstellen.</p>
      <p>Nur deine eigenen Lernzettel und selbst eingefügte Themen liest die Stimme des iPhones. Die kannst du hier wählen.</p>
      ${vs.length ? `<label class="fld"><span>Stimme für Lena</span><select data-k="stA">${opts('A')}</select></label><button class="btn small" data-a="probe" data-d="A">Probe hören</button>
      <label class="fld"><span>Stimme für Tom</span><select data-k="stB">${opts('B')}</select></label><button class="btn small" data-a="probe" data-d="B">Probe hören</button>
      <div class="sec-h">Tempo</div><div class="chips">${[0.85, 1, 1.15, 1.3].map(r => `<button class="tchip sm ${(prefs.get('sysTempo', 1)) === r ? 'on' : ''}" data-a="systempo" data-d="${r}">${String(r).replace('.', ',')}×</button>`).join('')}</div>` : '<p>Dieser Browser zeigt keine deutschen Stimmen.</p>'}
      <p class="muted small">Achtung: Safari gibt Web-Apps nicht immer alle Stimmen des iPhones frei. Stimmen, die du unter Bedienungshilfen lädst, tauchen hier deshalb manchmal nicht auf.</p></div></details>`;
  }
}
// Lernzettel als Gespräch: Zeilen mit Lena oder Tom bekommen je ihre Stimme
async function gespraech(text) {
  stopReading();
  const zeilen = String(text).split('\n').map(l => /^\s*(Lena|Tom|A|B)\s*:\s*(.+)$/.exec(l)).filter(Boolean).map(m => ({ wer: /^(Tom|B)$/.test(m[1]) ? 'B' : 'A', text: m[2] }));
  keepAwake(true);
  for (const z of zeilen) { if (!(await speak(z.text, 1, z.wer))) break; await pause(300); }
  keepAwake(false);
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
export const zeitKurz = iso => { const d = new Date(iso); const heute = dayStr() === dayStr(d); return (heute ? 'heute' : d.toLocaleDateString('de-DE', { day: 'numeric', month: 'numeric' })) + ', ' + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) + ' Uhr'; };
const GH_SCHRITTE = `<ol class="steps-list small">
  <li>In Safari github.com öffnen und anmelden. Oben rechts auf Plus, dann „New repository“.</li>
  <li>Name: Lernwerk-Sicherung. „Private“ wählen. „Create repository“.</li>
  <li>Profilbild, „Settings“, ganz unten „Developer settings“, „Personal access tokens“, „Fine-grained tokens“, „Generate new token“.</li>
  <li>Name: Lernwerk. Ablauf: 1 Jahr oder kein Ablauf.</li>
  <li>„Repository access“: „Only select repositories“ und Lernwerk-Sicherung wählen.</li>
  <li>„Permissions“, „Repository permissions“, „Contents“: „Read and write“. Sonst nichts ändern.</li>
  <li>„Generate token“, den Schlüssel kopieren und hier unten einfügen.</li></ol>`;
function ghBereich() {
  if (!gh.aktiv()) {
    const k = gh.konfig();
    return `<div class="sec-h">Automatisch über GitHub</div><div class="card"><p>Nach jeder Lerneinheit und nach dem Einfügen sichert Lernwerk deinen Stand in dein privates Repository. Fotos bleiben nur auf dem Gerät. Der Schlüssel bleibt nur auf diesem Gerät.</p>
      <details class="disc"><summary>So richtest du es ein</summary>${GH_SCHRITTE}</details>
      <label class="fld"><span>Repository</span><input type="text" data-k="repo" value="${esc(k.repo || gh.repoVorschlag())}" autocapitalize="off" autocomplete="off" spellcheck="false"></label>
      <label class="fld"><span>Schlüssel</span><input type="password" data-k="token" value="" placeholder="github_pat_…" autocapitalize="off" autocomplete="off" spellcheck="false"></label>
      <button class="btn filled wide" data-a="ghcon">${icon('cloud')} Verbinden</button></div>`;
  }
  const z = gh.zuletzt(), f = gh.fehler();
  return `<div class="sec-h">Automatisch über GitHub</div><div class="card"><p>${icon('cloud')} <b>Zuletzt gesichert:</b> ${z ? esc(zeitKurz(z)) : 'noch nicht'}</p><p class="muted small">In ${esc(gh.konfig().repo)}. Ohne Netz holt Lernwerk die Sicherung später nach.</p>
    ${f ? `<div class="fb bad">${esc(f)}</div>` : ''}
    <div class="btn-col"><button class="btn" data-a="ghnow">Jetzt sichern</button><button class="btn" data-a="ghload">Stand von GitHub laden</button><button class="btn" data-a="ghoff">Schlüssel entfernen</button></div></div>`;
}
export function datensicherung() {
  let fotos = false;
  return {
    title: 'Datensicherung',
    render(b) {
      const last = st.kvGet('letzteSicherung');
      if (!this._gh) this._gh = gh.beobachten(() => { if (b.isConnected) this.render(b); else this._gh(); });
      b.innerHTML = ghBereich() + `<div class="sec-h">Von Hand</div><div class="card how"><p>Deine Lerndaten liegen nur auf diesem Gerät. Mit einer Sicherung bringst du sie auf den Laptop oder rettest sie bei einem neuen iPhone. Die Datei enthält auch deine eingefügten Inhalte im Lernwerk-Format.</p><p class="muted">${last ? 'Letzte Sicherung: ' + esc(dayLong(last)) : 'Noch keine Sicherung gemacht.'}</p></div>
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
        ghcon: async () => {
          const token = $('[data-k="token"]', b).value.trim(), repo = $('[data-k="repo"]', b).value.trim();
          if (!token || !/^[\w.-]+\/[\w.-]+$/.test(repo)) { toast('Bitte Repository als name/Lernwerk-Sicherung und den Schlüssel eintragen.'); return; }
          toast('Ich prüfe die Verbindung …');
          const r = await gh.pruefen(token, repo);
          if (!r.ok) { toast(r.meldung, 6000); return; }
          if (r.vorhanden) {
            const datum = r.vorhanden === 'unbekannt' ? '' : ' vom ' + zeitKurz(r.vorhanden);
            if (await confirmBox('Auf GitHub liegt schon eine Sicherung' + datum + '. Diesen Stand auf dieses Gerät laden? Der jetzige Stand auf dem Gerät wird ersetzt.', 'Laden')) {
              try { await gh.laden(); gh.verbinden(); toast('Stand geladen. Lernwerk startet neu.'); setTimeout(() => location.reload(), 900); } catch (e) { toast(e.message, 5000); }
              return;
            }
            if (!(await confirmBox('Dann überschreibe ich die Sicherung auf GitHub mit dem Stand dieses Geräts. Die alte Fassung bleibt im Verlauf auf GitHub erhalten.', 'Überschreiben', true))) return;
          }
          gh.verbinden();
          toast((await gh.hochladen()) ? 'Verbunden und gesichert.' : 'Verbunden. Die erste Sicherung kommt, sobald Netz da ist.');
          this.render(b);
        },
        ghnow: async () => { toast((await gh.hochladen()) ? 'Gesichert.' : gh.fehler() || 'Gerade keine Verbindung. Ich hole es später nach.'); this.render(b); },
        ghload: async () => {
          if (!(await confirmBox('Stand von GitHub laden? Der jetzige Stand auf diesem Gerät wird ersetzt. Fotos auf dem Gerät bleiben.', 'Laden', true))) return;
          try { await gh.laden(); toast('Stand geladen. Lernwerk startet neu.'); setTimeout(() => location.reload(), 900); } catch (e) { toast(e.message, 5000); }
        },
        ghoff: async () => { if (await confirmBox('Schlüssel von diesem Gerät entfernen? Die automatische Sicherung stoppt. Die Sicherung auf GitHub bleibt.', 'Entfernen', true)) { gh.trennen(); this.render(b); } },
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

/* ===== Im Unterricht: Zustand aller Themen auf einen Blick ===== */
const unterrichtOffen = new Set();
// Nach dem Umschalten bleibt das angetippte Thema an derselben Stelle auf dem Bildschirm
let unterrichtAnker = null;
export function unterrichtPage() {
  return {
    title: 'Im Unterricht',
    render(b) {
      const zSeg = tid => `<div class="zst" data-t="${esc(tid)}">${seg('z', ZUSTAENDE, st.zustand(tid))}</div>`;
      const art = tid => st.isIntroOnly(tid) ? 'Einführung' : st.hasTopicContent(tid) ? 'Mit Übungen' : st.status(tid) === 'geplant' ? 'Noch leer' : 'Eigene Inhalte';
      const tRow = (f, t, mitFach) => row({ dot: mitFach ? f.farbe : null, title: t.name, sub: mitFach ? f.name : art(t.id), html: staerkeHTML(st.staerke(t.id), true) + zSeg(t.id) });
      const alle = st.faecher().flatMap(f => f.themen.map(t => ({ f, t })));
      const akt = alle.filter(x => st.zustand(x.t.id) === 'aktuell');
      const fertig = alle.filter(x => st.zustand(x.t.id) === 'fertig');
      const vorschlag = st.abschliessenVorschlag();
      let h = `<p class="src">Im Unterricht kommt bei Unterricht dran. Abgeschlossen kommt bei Alles wiederholen dran, schwache Themen öfter.</p>`;
      if (vorschlag.length) h += `<div class="fb info"><b>Schon lange im Unterricht und zwei Wochen nicht geübt:</b> ${vorschlag.map(t => esc(st.thema(t).thema.name)).join(', ')}. Sind diese Themen abgeschlossen?<div class="btn-row"><button class="btn small" data-a="vorschlag">Ja, abschließen</button></div></div>`;
      h += `<div class="sec-h">Gerade im Unterricht: ${akt.length}</div>`;
      h += akt.length ? list(akt.map(x => tRow(x.f, x.t, true))) + `<button class="btn small" data-a="alleab">Alle abschließen</button>` : `<div class="sec-f">Noch nichts im Unterricht. Wähl unten bei den Fächern aus, was gerade dran ist.</div>`;
      if (fertig.length) h += `<details class="disc unt" data-f="__fertig" ${unterrichtOffen.has('__fertig') ? 'open' : ''}><summary>Abgeschlossen<span class="unt-n">${fertig.length} Themen</span></summary>` + list(fertig.map(x => tRow(x.f, x.t, true))) + `</details>`;
      h += `<div class="sec-h">Alle Themen nach Fach</div>`;
      for (const f of st.faecher()) {
        if (!f.themen.length) continue;
        const n = f.themen.filter(t => st.zustand(t.id) === 'aktuell').length, d = f.themen.filter(t => st.zustand(t.id) === 'fertig').length;
        h += `<details class="disc unt" data-f="${esc(f.id)}" ${unterrichtOffen.has(f.id) ? 'open' : ''}><summary><span class="row-dot" style="background:${f.farbe}"></span>${esc(f.name)}<span class="unt-n">${[n ? n + ' im Unterricht' : '', d ? d + ' fertig' : ''].filter(Boolean).join(', ') || f.themen.length + ' Themen'}</span></summary>`
          + list(f.themen.map(t => tRow(f, t, false))) + `<button class="zu-btn" data-a="zu" data-d="${esc(f.id)}">${esc(f.kurz || f.name)} zuklappen</button></details>`;
      }
      const sc = b.closest('.page-scroll');
      const y = sc ? sc.scrollTop : 0;
      b.innerHTML = h;
      if (sc) {
        sc.scrollTop = y;
        if (unterrichtAnker) {
          const el = b.querySelector(`details[data-f="${unterrichtAnker.f}"] .zst[data-t="${unterrichtAnker.tid}"]`) || b.querySelector(`.zst[data-t="${unterrichtAnker.tid}"]`);
          if (el) sc.scrollTop += el.getBoundingClientRect().top - unterrichtAnker.top;
          unterrichtAnker = null;
        }
      }
      if (!b._untToggle) {
        b._untToggle = true;
        b.addEventListener('toggle', e => { const d = e.target.closest && e.target.closest('details[data-f]'); if (d) d.open ? unterrichtOffen.add(d.dataset.f) : unterrichtOffen.delete(d.dataset.f); }, true);
        b.addEventListener('click', e => {
          const btn = e.target.closest('.zst [data-seg] button');
          if (!btn) return;
          const z = btn.closest('.zst'), tid = z.dataset.t, v = btn.dataset.v;
          if (st.zustand(tid) === v) return;
          const d = z.closest('details[data-f]');
          unterrichtAnker = { tid, f: d ? d.dataset.f : '', top: z.getBoundingClientRect().top };
          st.setZustand(tid, v);
          toast({ kommt: 'Kommt noch.', aktuell: 'Im Unterricht.', fertig: 'Abgeschlossen.' }[v]);
        });
      }
      on(b, {
        zu: fid => {
          const d = b.querySelector(`details[data-f="${fid}"]`);
          if (!d) return;
          d.open = false;
          unterrichtOffen.delete(fid);
          const sc = b.closest('.page-scroll'), r = d.getBoundingClientRect();
          if (sc && r.top < 60) sc.scrollTop += r.top - 100;
        },
        vorschlag: async () => { for (const t of vorschlag) await st.setZustand(t, 'fertig'); toast('Abgeschlossen.'); },
        alleab: async () => {
          if (!(await confirmBox('Alle Themen im Unterricht als abgeschlossen markieren? Sie kommen dann bei Alles wiederholen dran.', 'Abschließen'))) return;
          for (const x of akt) await st.setZustand(x.t.id, 'fertig');
          toast('Alle abgeschlossen.');
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
      // Alle Klausuren: benotete und vergangene Termine ohne Note
      const ks = st.S.exams.filter(e => e.note != null || e.prozent != null || e.datum < today).sort((a, c) => (a.datum > c.datum ? -1 : 1));
      const by = new Map();
      for (const e of ks) { const n = e.note != null ? e.note : st.noteAusProzent(e.prozent); if (n == null) continue; const k = e.fachId || e.fach; const x = by.get(k) || { fach: (st.fach(e.fachId) || {}).kurz || e.fach, n: [] }; x.n.push(n); by.set(k, x); }
      let h = `<div class="btn-row"><button class="btn filled" data-a="neu">${icon('plus')} Note eintragen</button></div>`;
      if (by.size) h += `<p class="schnitt">Schnitt: ${[...by.values()].map(x => esc(x.fach) + ' ' + fmtNote(x.n.reduce((s, v) => s + v, 0) / x.n.length)).join(' · ')}</p>`;
      h += ks.length ? list(ks.map(e => {
        const f = st.fach(e.fachId);
        const hat = e.note != null || e.prozent != null;
        return row({ a: 'kl', d: e.id, dot: f ? f.farbe : '#888', title: e.fach, sub: dayLong(e.datum), detail: hat ? [e.note != null ? fmtNote(e.note) : '', e.prozent != null ? fmtNum(e.prozent, 1) + ' %' : ''].filter(Boolean).join(' · ') : 'Note fehlt' });
      })) : empty('Noch keine Klausur eingetragen.', 'Tippe auf Note eintragen.');
      const k = st.notenSchluessel();
      h += `<button class="schl-link" data-a="schl">Notenschlüssel: ${k.map((g, i) => (i + 1) + ' ab ' + g).join(', ')}</button>`;
      b.innerHTML = h;
      on(b, { neu: () => notenEditor({}), schl: () => schluesselEditor(), kl: id => push(klausurPage(id)) });
    }
  };
}
// Eine Klausur: Note, Prozent und erst hier die Themen
export function klausurPage(id) {
  return {
    title: 'Klausur',
    actions: [{ label: 'Bearbeiten', icon: 'edit', onClick: () => { const e = st.S.exams.find(x => x.id === id); if (e) notenEditor(e); } }],
    render(b) {
      const e = st.S.exams.find(x => x.id === id);
      if (!e) { b.innerHTML = empty('Diese Klausur gibt es nicht mehr.'); return; }
      const f = st.fach(e.fachId);
      const hat = e.note != null || e.prozent != null;
      const b2 = e.prozent != null ? st.bisZurBesserenNote(e.prozent) : null;
      let h = `<div class="card count" style="--fc:${f ? f.farbe : 'var(--accent)'}"><div class="count-t">${esc(e.fach)}</div><div class="muted">${esc(dayLong(e.datum))}</div>
        <div class="kl-note ${hat ? '' : 'leer'}">${hat ? (e.note != null ? 'Note ' + fmtNote(e.note) : '') + (e.prozent != null ? '<small>' + fmtNum(e.prozent, 1) + ' %</small>' : '') : 'Note fehlt noch'}</div>
        ${b2 ? `<div class="muted small">Bis zur ${b2.note} haben ${esc(fmtNum(b2.fehlt, 1))} Prozent gefehlt.</div>` : ''}${e.notiz ? `<div class="muted">${esc(e.notiz)}</div>` : ''}</div>`;
      if (!hat) h += `<div class="btn-row"><button class="btn filled" data-a="ed">${icon('exam')} Note eintragen</button></div>`;
      const tops = (e.themaIds || []).map(t => st.thema(t)).filter(Boolean);
      const lab = { gut: 'Lief gut', mittel: 'Lief mittel', schlecht: 'Lief schlecht' };
      h += `<div class="sec-h">Themen der Klausur</div>` + (tops.length ? list(tops.map(t => { const r = hat ? st.themaErgebnis(e, t.thema.id) : null; return row({ a: 'topic', d: t.thema.id, title: t.thema.name, sub: r ? lab[r] : '', detail: r === 'schlecht' ? '●' : '' }); })) : `<div class="sec-f">Noch keine Themen ausgewählt. Tippe oben auf Bearbeiten.</div>`);
      b.innerHTML = h;
      on(b, { ed: () => notenEditor(e), topic: tid => push(topicPage(tid)) });
    }
  };
}
function schluesselEditor() {
  const k = st.notenSchluessel().slice();
  openSheet({
    title: 'Notenschlüssel',
    render(b, api) {
      b.innerHTML = `<div class="form"><p class="muted">Trag ein, ab wie viel Prozent es welche Note gibt. Darunter gibt es die 6.</p>
        ${k.map((g, i) => `<label class="fld"><span>Note ${i + 1} ab Prozent</span><input type="text" inputmode="decimal" data-g="${i}" value="${esc(fmtNum(g, 1))}"></label>`).join('')}
        <button class="btn filled" data-a="save">Speichern</button><button class="btn" data-a="ihk">IHK-Schlüssel nehmen</button></div>`;
      on(b, {
        save: async () => {
          const v = [...b.querySelectorAll('[data-g]')].map(x => parseFloat(x.value.replace(',', '.')));
          if (v.some(x => !isFinite(x) || x < 0 || x > 100)) { toast('Bitte überall eine Zahl zwischen 0 und 100.'); return; }
          if (v.some((x, i) => i && x >= v[i - 1])) { toast('Jede Note braucht weniger Prozent als die bessere Note davor.'); return; }
          await st.setNotenSchluessel(v); api.close(); toast('Notenschlüssel gespeichert.'); refreshTop();
        },
        ihk: async () => { await st.setNotenSchluessel(st.IHK_SCHLUESSEL.slice()); api.close(); toast('IHK-Schlüssel eingestellt.'); refreshTop(); }
      });
    }
  });
}
export function notenEditor(e0) {
  const e = Object.assign({ fachId: '', datum: dayStr(), themaIds: [], ergebnis: {}, note: null, prozent: null, notiz: '' }, JSON.parse(JSON.stringify(e0)));
  e.ergebnis = e.ergebnis || {};
  const num = v => { const x = parseFloat(String(v).replace(',', '.')); return isFinite(x) ? x : null; };
  const hint = p => {
    const n = st.noteAusProzent(p);
    if (!n) return '';
    const b2 = st.bisZurBesserenNote(p);
    return 'Nach deinem Notenschlüssel sind ' + fmtNum(p, 1) + ' Prozent die Note ' + n + '.' + (b2 ? ' Bis zur ' + b2.note + ' haben ' + fmtNum(b2.fehlt, 1) + ' Prozent gefehlt.' : '') + ' Lässt du die Note leer, trage ich sie so ein.';
  };
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
          if (e.note == null) e.note = st.noteAusProzent(e.prozent);
          if (e.note != null && (e.note < 1 || e.note > 6)) { toast('Die Note muss zwischen 1 und 6 liegen.'); return; }
          if (e.prozent != null && (e.prozent < 0 || e.prozent > 100)) { toast('Prozent müssen zwischen 0 und 100 liegen.'); return; }
          const f = st.fach(e.fachId);
          const erg = {};
          for (const t of e.themaIds) if (e.ergebnis[t]) erg[t] = e.ergebnis[t];
          await st.addExam({ id: e0.id, fachId: e.fachId, fach: f.name, datum: e.datum, themen: e0.themen || '', themaIds: e.themaIds, note: e.note, prozent: e.prozent, ergebnis: erg, notiz: e.notiz });
          api.close();
          const offen = e.themaIds.filter(t => st.zustand(t) !== 'fertig');
          if (offen.length && await confirmBox('Note gespeichert. Sind die ' + plural(offen.length, 'Thema', 'Themen') + ' dieser Klausur jetzt abgeschlossen? Dann kommen sie bei Alles wiederholen dran.', 'Ja, abschließen')) { for (const t of offen) await st.setZustand(t, 'fertig'); toast('Themen abgeschlossen.'); }
          else toast('Note gespeichert.');
          refreshTop();
        },
        del: async () => { if (await confirmBox('Diese Klausur löschen?', 'Löschen', true)) { await st.deleteExam(e0.id); api.close(); pop(); } }
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
