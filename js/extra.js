// Mehr: Termine, Lexikon, Formelsammlung, Probeklausur, Erklär-Training, Hörmodus, Suche,
// Lehrplan bearbeiten, Datensicherung, Darstellung, Erinnerung.
import { esc, dayStr, dayLong, dayShort, daysBetween, plural, plainText, norm, shuffle, fmtNum, markdown } from './util.js';
import { fml, speakFml, varsOf, parseEq, keyOf } from './formula.js';
import { lernplan } from './srs.js';
import * as st from './store.js';
import { $, $$, icon, row, list, seg, sw, empty, on, push, pop, openSheet, toast, copyText, progress, confirmBox, saveFile, refreshTop, hinweisTabellenbuch, fachIcon } from './ui.js';
import { topicPage, runSession, runItem, ZUSTAENDE, staerkeHTML, sortForPractice, topicProgress, formelCard, askClaude, noteReader, openTrainer, itemTitle, rich, schmierKnopf, schmierzettel, frageSkizze } from './engine.js';
import { speak, stopSpeaking, canSpeak, keepAwake, pause, readAloud, stopReading, deVoices } from './speech.js';
import * as hoer from './hoer.js';
import * as sk from './skizzen.js';
import { folge, dauerSchaetzung, DENKPAUSE } from './podcast.js';
import { prefs } from './db.js';
import * as gh from './sicherung.js';
import { linie, balken } from './diagramm.js';
import * as rueckfall from './rueckfall.js';

import { probePage } from './probeklausur.js';
import { hoerPage } from './hoerseite.js';
import { fmtNote, klausurPage, notenPage } from './noten.js';
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
        row({ a: 'unterricht', icon: 'check', color: '#0A84FF', title: 'Im Unterricht', sub: nAkt ? plural(nAkt, 'Thema', 'Themen') + ' angewählt' : 'Noch keine Themen angewählt' }),
        row({ a: 'sogehts', icon: 'target', color: '#FF9F0A', title: 'So lernst du mit Lernwerk', sub: 'Erst verstehen, dann üben, dann wiederholen' })
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
        row({ a: 'backup', icon: 'save', color: '#34C759', title: 'Datensicherung', sub: gh.aktiv() ? (gh.fehler() ? 'Sicherung hat ein Problem' : 'Abgleich über GitHub' + (gh.zuletzt() ? ', zuletzt ' + zeitKurz(gh.zuletzt()) : '')) : st.kvGet('letzteSicherung') ? 'Letzte Sicherung: ' + dayShort(st.kvGet('letzteSicherung')) : 'Noch keine Sicherung' }),
        row({ a: 'theme', icon: 'theme', color: '#636366', title: 'Darstellung', detail: { auto: 'Automatisch', hell: 'Hell', dunkel: 'Dunkel' }[prefs.get('theme', 'auto')] }),
        row({ a: 'remind', icon: 'bell', color: '#FF375F', title: 'Erinnerung einrichten' }),
        row({ a: 'info', icon: 'info', color: '#8E8E93', title: 'Über Lernwerk' })
      ]) + hinweisTabellenbuch();
      on(b, {
        unterricht: () => push(unterrichtPage()), sogehts: () => push(soGehtsPage()), noten: () => push(notenPage()), termine: () => push(terminePage()), probe: () => push(probePage()), hoer: () => push(hoerPage()), erklaer: () => push(erklaerPage()),
        lexikon: () => push(lexikonPage()), formeln: () => push(formelPage()), suche: () => push(suchePage()),
        lehrplan: () => push(lehrplanPage()), backup: () => push(datensicherung()), theme: () => push(themePage()),
        remind: () => push(erinnerungPage()), info: () => push(infoPage())
      });
    }
  };
}

/* ===== So lernst du mit Lernwerk ===== */
export function soGehtsPage() {
  const k = (n, t, txt) => `<div class="sg"><span class="sg-n">${n}</span><div><b>${t}</b><p>${txt}</p></div></div>`;
  return {
    title: 'So lernst du',
    render(b) {
      b.innerHTML = `<p class="sec-f">Lernen hat zwei Teile. Erst verstehst du etwas, dann holst du es immer wieder aus dem Kopf. Die Trainer bringen dir etwas bei, die Runden sorgen dafür, dass es bleibt. Du brauchst beides, in dieser Reihenfolge.</p>
        <div class="sec-h">Neues Thema aus dem Unterricht</div><div class="card">
        ${k(1, 'Thema auf Im Unterricht stellen', 'Dann erscheint oben im Thema dein Lernweg, und auf der Startseite ein Knopf dazu.')}
        ${k(2, 'Verstehen', 'Bild aus deiner Welt, Skizze und Prinzip lesen oder vorlesen lassen.')}
        ${k(3, 'Im Trainer selbst machen', 'Hier rechnest du Schritt für Schritt und bekommst bei jedem Fehler eine Erklärung. Das ist der wichtigste Schritt.')}
        ${k(4, 'Erste Fragen', 'Ein paar leichte Fragen. Danach kommt das Thema von selbst in deinen Runden.')}</div>
        <div class="sec-h">Jeden Tag, 10 bis 20 Minuten</div><div class="card">
        ${k('✓', 'Heute lernen oder Lernzeit', 'Vor einer Arbeit in der Karte der Arbeit, sonst über die Lernzeit auf der Startseite.')}
        ${k('✓', 'Erst antworten, dann aufdecken', 'Sag die Antwort ganz im Kopf oder laut, bevor du aufdeckst. Nur ungefähr wissen zählt nicht.')}
        ${k('✓', 'Ehrlich bewerten', 'Warst du unsicher, tipp auf Mit Hilfe. Nur so plant die App richtig.')}
        ${k('✓', 'Wirklich rechnen', 'Rechenaufgaben auf dem Zettel oder auf Papier ausrechnen, nicht nur ansehen.')}
        ${k('✓', 'Fehler sind gut', 'Was nicht saß, kommt am Ende der Runde nochmal. Am Schluss bringt dich ein Knopf in den passenden Trainer.')}</div>
        <div class="sec-h">Einmal pro Woche</div><div class="card">
        ${k('✓', 'Fehlerbuch', 'Deine offenen Fehler durchgehen.')}
        ${k('✓', 'Laut erklären', 'Im Erklär-Training ein Thema erklären, als würdest du es einem Kollegen in der Werkstatt zeigen.')}
        ${k('✓', 'Vor der Arbeit', 'Eine Probeklausur mit echter Zeit, ohne Tipps.')}</div>`;
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
          const raus = (e0.themaIds || []).filter(t => !ids.includes(t));
          await st.addExam({ id: e0.id, fachId: e.fachId, fach: f.name, datum: e.datum, themen: e.themen, themaIds: ids, ausgeschlossen: [...new Set([...(e0.ausgeschlossen || []).filter(t => !ids.includes(t)), ...raus])] });
          api.close(); toast('Termin gespeichert.'); refreshTop();
        },
        del: async () => { if (await confirmBox('Termin löschen?', 'Löschen', true)) { await st.deleteExam(e0.id); api.close(); pop(); } }
      });
    }
  });
}
export function termineDetail(id) {
  let abwahl = false;
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
      // Themen im Fach, die fehlen: im Unterricht oder selbst eingefügt, aber nicht in der Arbeit
      const fehlen = d >= 0 ? st.fehlendeThemen(e) : [];
      if (fehlen.length) h += `<div class="fb info fehlt-box"><b>Gehören diese Themen dazu?</b><div>Sie sind im Unterricht oder neu eingefügt, aber noch nicht in der Arbeit. Dazugenommen kommen sie in den Lernplan.</div>${fehlen.map(t => `<div class="fehlt-z"><span>${esc(t.name)}</span><span class="fehlt-k"><button class="btn small" data-a="nichtDazu" data-d="${t.id}">Nein</button><button class="btn small" data-a="dazu" data-d="${t.id}">Dazunehmen</button></span></div>`).join('')}${fehlen.length > 1 ? `<button class="btn small filled" data-a="alleDazu">Alle dazunehmen</button>` : ''}</div>`;
      // Themen der Arbeit: antippen öffnet das Thema. „Themen abwählen“ zeigt bei jedem Thema einen Knopf zum Rausnehmen.
      if (tops.length) h += `<div class="sec-h sec-h-btn"><span>Dein Stand</span>${d >= 0 ? `<button class="link" data-a="abwahl">${abwahl ? 'Fertig' : 'Themen abwählen'}</button>` : ''}</div>` + list(tops.map(t => { const p = topicProgress(t.thema.id); return abwahl ? row({ title: t.thema.name, right: `<button class="btn small danger" data-a="raus" data-d="${t.thema.id}">Rausnehmen</button>` }) : row({ a: 'topic', d: t.thema.id, title: t.thema.name, html: progress(p || 0, f ? f.farbe : null), detail: Math.round((p || 0) * 100) + ' %' }); }));
      else h += `<div class="fb info">Wähl die Themen der Arbeit aus (oben rechts bearbeiten). Dann zieht Lernwerk sie in Heute vor und plant rückwärts.</div>`;
      h += `<div class="btn-row"><button class="btn filled" data-a="ueben">${icon('bolt')} Themen der Arbeit üben</button><button class="btn" data-a="probe">${icon('exam')} Probeklausur</button><button class="btn" data-a="hoer">${icon('ear')} Hörmodus</button></div>`;
      if (d > 0) {
        const plan = lernplan(e.datum, tops.map(t => t.thema), st.planStart(e, today)).filter(p => p.datum >= today);
        const erl = st.planErledigt(e);
        const haken = d => !erl[d] ? '' : erl[d] < d ? ' ✓ vorgezogen' : ' ✓ geschafft';
        const nach = st.planNachholen(e).map(t => st.thema(t).thema.name);
        if (nach.length) h += `<div class="fb info">Kommt beim nächsten Plantag nochmal dran: ${esc(nach.join(', '))}. Ab 80 % richtig ist es wieder raus.</div>`;
        h += `<div class="sec-h">Lernplan bis zur Arbeit</div>` + list(plan.map(p => row({
          title: (p.datum === today ? 'Heute, ' : '') + dayLong(p.datum) + haken(p.datum),
          sub: p.art === 'wiederholen' ? 'Nur Wiederholung und Fehlerbuch' : p.themen.length ? p.themen.map(x => x.thema.name + (x.neu ? '' : ' wiederholen')).join(', ') + (p.leicht ? ' · voller Tag, nur kurz' : '') : 'Fällige Karten',
          cls: p.datum === today ? 'today-row' : ''
        })));
        h += `<div class="sec-f">Dienstag und Donnerstag sind bei dir volle Tage. Dort plane ich weniger ein. Nach dem Tagesziel kannst du auf der Startseite den nächsten Tag vorziehen. Dann läuft der Plan schneller, und die frei gewordenen Tage nutzt du für deine Schwächen.</div>`;
      }
      b.innerHTML = h;
      on(b, {
        topic: tid => push(topicPage(tid)),
        abwahl: () => { abwahl = !abwahl; this.render(b); },
        raus: async tid => { await st.themenAusArbeit(e.id, [tid]); toast('Rausgenommen. Der Lernplan rechnet neu.'); this.render(b); refreshTop(); },
        nichtDazu: async tid => { await st.themenAusArbeit(e.id, [tid]); toast('Gehört nicht dazu. Ich frage nicht mehr.'); this.render(b); refreshTop(); },
        dazu: async tid => { await st.themenZurArbeit(e.id, [tid]); toast('Dazugenommen. Der Lernplan rechnet neu.'); this.render(b); refreshTop(); },
        alleDazu: async () => { await st.themenZurArbeit(e.id, fehlen.map(t => t.id)); toast('Alle dazugenommen. Der Lernplan rechnet neu.'); this.render(b); refreshTop(); },
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
        ${f.eigen ? `<div class="sec-h">Falsch angelegt?</div><p class="src">Ist das eigentlich dasselbe Fach wie ein anderes, zum Beispiel Werkstoffkunde und Werkstofftechnik? Dann leg es zusammen. Alle Themen, Karten, Fortschritte, Lernzettel, Fotos und Fehler wandern mit. Gleichnamige Themen werden zu einem.</p>
        <label class="fld"><span>Zusammenlegen mit</span><select data-k="ziel"><option value="">Fach wählen</option>${st.faecher().filter(x => x !== f).map(x => `<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('')}</select></label>
        <button class="btn" data-a="zusammen">Mit diesem Fach zusammenlegen</button>
        <button class="btn danger" data-a="delfach">${icon('trash')} Fach löschen</button>` : ''}</div>`;
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
        zusammen: async () => {
          const ziel = st.fach($('[data-k="ziel"]', b).value);
          if (!ziel) { toast('Wähl zuerst das richtige Fach.'); return; }
          if (!(await confirmBox('„' + f.name + '“ mit „' + ziel.name + '“ zusammenlegen? Danach gibt es „' + f.name + '“ nicht mehr, auch nicht auf deinen anderen Geräten. Alles Gelernte bleibt erhalten.', 'Zusammenlegen'))) return;
          await rueckfall.sichern('Vor dem Zusammenlegen von Fächern', await st.exportBackup(false), window.__lw ? window.__lw.VERSION : '');
          const n = await st.fachZusammenlegen(f.id, ziel.id);
          api.close(); toast(plural(n, 'Thema', 'Themen') + ' nach ' + ziel.name + ' übernommen.');
          gh.anstossen();
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
  if (gh.pausiert()) return `<div class="sec-h">Abgleich über GitHub</div><div class="card"><div class="fb info"><b>Der Abgleich ist pausiert.</b> Du hast eine Rückfall-Kopie geladen. Prüf erst, ob der Stand stimmt. Dann entscheide:</div>
    <div class="btn-col"><button class="btn filled" data-a="ghueber">Diesen Stand behalten und nach GitHub übernehmen</button><button class="btn" data-a="ghweiter">Abgleich wieder einschalten und zusammenführen</button></div>
    <p class="muted small">„Behalten“ ersetzt den Stand auf GitHub durch den Stand dieses Geräts. Auf deinem anderen Gerät wählst du danach unter Notfall „Stand von GitHub komplett übernehmen“. „Zusammenführen“ mischt den Stand von GitHub wieder dazu, das Neuere gewinnt.</p></div>`;
  if (!gh.aktiv()) {
    const k = gh.konfig();
    return `<div class="sec-h">Automatisch über GitHub</div><div class="card"><p>Lernwerk gleicht deinen Stand über dein privates Repository ab: beim Öffnen, nach jeder Lerneinheit und nach dem Einfügen. Mit demselben Schlüssel auf iPhone und iPad haben beide Geräte denselben Stand. Fotos und die Darstellung bleiben pro Gerät. Der Schlüssel bleibt nur auf diesem Gerät.</p>
      <details class="disc"><summary>So richtest du es ein</summary>${GH_SCHRITTE}</details>
      <label class="fld"><span>Repository</span><input type="text" data-k="repo" value="${esc(k.repo || gh.repoVorschlag())}" autocapitalize="off" autocomplete="off" spellcheck="false"></label>
      <label class="fld"><span>Schlüssel</span><input type="password" data-k="token" value="" placeholder="github_pat_…" autocapitalize="off" autocomplete="off" spellcheck="false"></label>
      <button class="btn filled wide" data-a="ghcon">${icon('cloud')} Verbinden</button></div>`;
  }
  const z = gh.zuletzt(), f = gh.fehler();
  return `<div class="sec-h">Abgleich über GitHub</div><div class="card"><p>${icon('cloud')} <b>Zuletzt abgeglichen:</b> ${z ? esc(zeitKurz(z)) : 'noch nicht'}</p><p class="muted small">In ${esc(gh.konfig().repo)}${prefs.get('ghGroesse', 0) ? ', Größe etwa ' + Math.max(1, Math.round(prefs.get('ghGroesse', 0) / 1024)) + ' kB' : ''}. Andere Geräte mit demselben Schlüssel bekommen denselben Stand. Ohne Netz holt Lernwerk den Abgleich später nach.</p>
    ${f ? `<div class="fb bad">${esc(f)}</div>` : ''}
    <div class="btn-col"><button class="btn filled" data-a="ghnow">${icon('cloud')} Jetzt abgleichen</button><button class="btn" data-a="ghoff">Schlüssel entfernen</button></div>
    <details class="disc notfall"><summary>Notfall</summary><p class="small">Nur wenn etwas schiefgelaufen ist: Der Stand auf GitHub ersetzt alles auf diesem Gerät. Was nur hier gespeichert ist, geht verloren. Fotos bleiben. Vorher lege ich eine Rückfall-Kopie an.</p><button class="btn danger" data-a="ghload">Stand von GitHub komplett übernehmen</button>
      <p class="small">Oder umgekehrt: Der Stand dieses Geräts ersetzt den Stand auf GitHub.</p><button class="btn danger" data-a="ghueber">Stand dieses Geräts nach GitHub übernehmen</button></details></div>`;
}
export function datensicherung() {
  let fotos = false;
  return {
    title: 'Datensicherung',
    render(b) {
      const last = st.kvGet('letzteSicherung');
      if (!this._gh) this._gh = gh.beobachten(() => { if (b.isConnected) this.render(b); else this._gh(); });
      b.innerHTML = ghBereich() + `<div class="sec-h">Zusätzlich als Datei</div><div class="card how"><p>Brauchst du normalerweise nicht. Mit dem Abgleich über GitHub sind deine Daten schon gesichert und auf allen verbundenen Geräten. Hier speicherst du zusätzlich eine Datei, zum Beispiel für den Laptop. Die Datei enthält auch deine eingefügten Inhalte im Lernwerk-Format.</p><p class="muted">${last ? 'Letzte Sicherung: ' + esc(dayLong(last)) : 'Noch keine Sicherung gemacht.'}</p></div>
        ${list([row({ title: 'Fotos mitsichern', sub: 'Nur für diese Datei. Fotos bleiben sonst auf dem Gerät.', right: sw('fotos', fotos) })])}
        <div class="btn-col"><button class="btn filled" data-a="export">${icon('save')} Sicherung erstellen</button>
        <label class="btn">${icon('open')} Sicherung laden<input type="file" accept=".json,application/json" data-k="file" hidden></label>
        <button class="btn" data-a="blocks">${icon('block')} Eigene Inhalte als Blöcke kopieren</button></div>
        <div class="sec-f">Auf dem iPhone öffnet sich das Teilen-Menü. Wähl „In Dateien sichern“. Zum Laden die Datei wieder auswählen. Laden ersetzt den Stand auf diesem Gerät.</div>
        <div class="sec-h">Rückfall-Kopien auf diesem Gerät</div><div class="rf-liste"><p class="src">Wird geladen …</p></div>
        <div class="sec-f">Lernwerk legt von selbst eine Kopie an: vor dem Einspielen vom anderen Gerät, vor dem Laden einer Sicherung, vor dem Zusammenlegen von Fächern und nach jedem Update. Es bleiben die neuesten fünf, ohne Fotos.</div>`;
      rueckfall.liste().then(ks => {
        const el = $('.rf-liste', b); if (!el) return;
        el.innerHTML = ks.length ? list(ks.map(k => row({ a: 'rfLaden', d: k.id, icon: 'repeat', color: '#8E8E93', title: zeitKurz(new Date(k.zeit).toISOString()), sub: k.grund + (k.version ? ' · Version ' + k.version : '') + ' · ' + Math.max(1, Math.round(k.groesse / 1024)) + ' kB' }))) + `<button class="btn small" data-a="rfJetzt">Jetzt eine Kopie anlegen</button>` : `<p class="src">Noch keine Kopie.</p><button class="btn small" data-a="rfJetzt">Jetzt eine Kopie anlegen</button>`;
      });
      $('[data-k="file"]', b).addEventListener('change', async e => {
        const file = e.target.files[0];
        if (!file) return;
        let data;
        try { data = JSON.parse(await file.text()); } catch (err) { toast('Die Datei kann ich nicht lesen.'); return; }
        if (!(await confirmBox('Sicherung vom ' + (data.erstellt ? new Date(data.erstellt).toLocaleDateString('de-DE') : '?') + ' laden? Der jetzige Stand auf diesem Gerät wird ersetzt.', 'Laden', true))) return;
        try { await rueckfall.sichern('Vor dem Laden einer Datei', await st.exportBackup(false)); await st.importBackup(data); toast('Sicherung geladen. Lernwerk startet neu.'); setTimeout(() => location.reload(), 900); }
        catch (err) { toast(err.message); }
      });
      on(b, {
        ghcon: async () => {
          const token = $('[data-k="token"]', b).value.trim(), repo = $('[data-k="repo"]', b).value.trim();
          if (!token || !/^[\w.-]+\/[\w.-]+$/.test(repo)) { toast('Bitte Repository als name/Lernwerk-Sicherung und den Schlüssel eintragen.'); return; }
          toast('Ich prüfe die Verbindung …');
          const r = await gh.pruefen(token, repo);
          if (!r.ok) { toast(r.meldung, 6000); return; }
          // Liegt schon ein Stand auf GitHub (anderes Gerät), werden beide zusammengeführt. Nichts geht verloren.
          gh.verbinden();
          toast((await gh.abgleichen()) ? (r.vorhanden ? 'Verbunden. Beide Stände sind zusammengeführt.' : 'Verbunden und gesichert.') : 'Verbunden. Der erste Abgleich kommt, sobald Netz da ist.');
          this.render(b);
        },
        ghnow: async () => { toast('Ich gleiche ab …', 1500); const ok = await gh.abgleichen(); if (ok) toast('Abgeglichen.'); else toast(gh.fehler() || 'Gerade keine Verbindung oder ein Fenster ist offen. Ich hole es später nach.'); this.render(b); },
        ghload: async () => {
          if (!(await confirmBox('Notfall: Stand von GitHub komplett übernehmen? Alles auf diesem Gerät wird ersetzt. Was nur hier gespeichert ist, geht verloren. Fotos bleiben.', 'Komplett übernehmen', true))) return;
          try { await gh.laden(); toast('Stand geladen. Lernwerk startet neu.'); setTimeout(() => location.reload(), 900); } catch (e) { toast(e.message, 5000); }
        },
        ghueber: async () => {
          if (!(await confirmBox('Stand dieses Geräts nach GitHub übernehmen? Der Stand auf GitHub wird ersetzt. Was nur auf dem anderen Gerät gelernt wurde und hier fehlt, geht dort verloren.', 'Übernehmen', true))) return;
          try { await gh.ueberschreiben(); toast('Übernommen. Der Abgleich läuft wieder.'); } catch (e) { toast(e.message, 5000); }
          this.render(b);
        },
        ghweiter: () => { gh.fortsetzen(); gh.nachholen(true); toast('Abgleich läuft wieder.'); this.render(b); },
        rfJetzt: async () => { const ok = await rueckfall.sichern('Von Hand angelegt', await st.exportBackup(false), window.__lw ? window.__lw.VERSION : ''); toast(ok ? 'Kopie angelegt.' : 'Das hat nicht geklappt.'); this.render(b); },
        rfLaden: async id => {
          const k = (await rueckfall.liste()).find(x => x.id === id);
          if (!k) return;
          if (!(await confirmBox('Kopie vom ' + zeitKurz(new Date(k.zeit).toISOString()) + ' laden? Der jetzige Stand auf diesem Gerät wird ersetzt. Vorher lege ich vom jetzigen Stand auch eine Kopie an. Fotos bleiben.', 'Laden', true))) return;
          const daten = await rueckfall.holen(id);
          if (!daten) { toast('Diese Kopie kann ich nicht lesen.'); return; }
          await rueckfall.sichern('Vor dem Laden einer Kopie', await st.exportBackup(false), window.__lw ? window.__lw.VERSION : '');
          try { await st.importBackup(daten); gh.pausieren(); toast('Kopie geladen. Lernwerk startet neu.'); setTimeout(() => location.reload(), 900); } catch (e) { toast(e.message, 5000); }
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
        <div class="card"><div class="card-k">Adresse der App</div><p class="url">${esc(url)}</p><button class="btn" data-a="copy">${icon('copy')} Adresse kopieren</button></div>
        <div class="card"><div class="card-k">Schneller einfügen</div><p>Mit <b>#einfuegen</b> am Ende öffnet die Adresse gleich die Seite Einfügen. Das passt für einen eigenen Kurzbefehl nach dem Kopieren eines Blocks im Chat.</p><p class="url">${esc(url)}#einfuegen</p><button class="btn" data-a="copy2">${icon('copy')} Adresse kopieren</button></div>`;
      on(b, { copy: async () => { const ok = await copyText(url); toast(ok ? 'Adresse kopiert.' : 'Kopieren hat nicht geklappt.'); }, copy2: async () => { const ok = await copyText(url + '#einfuegen'); toast(ok ? 'Adresse kopiert.' : 'Kopieren hat nicht geklappt.'); } });
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
/* ===== Im Unterricht: Fächer, darin alle Themen mit Status-Schalter =====
 * Die Liste sortiert beim Umschalten nicht neu. Das Thema bleibt an seinem Platz.
 */
const zstText = { kommt: 'Kommt noch.', aktuell: 'Im Unterricht.', fertig: 'Abgeschlossen.' };
export function unterrichtPage() {
  return {
    title: 'Im Unterricht',
    render(b) {
      const vorschlag = st.abschliessenVorschlag();
      let h = `<p class="src">Im Unterricht kommt bei Unterricht dran. Abgeschlossen kommt bei Alles wiederholen dran, schwache Themen öfter.</p>`;
      if (vorschlag.length) h += `<div class="fb info"><b>Schon lange im Unterricht und zwei Wochen nicht geübt:</b> ${vorschlag.map(t => esc(st.thema(t).thema.name)).join(', ')}. Sind diese Themen abgeschlossen?<div class="btn-row"><button class="btn small" data-a="vorschlag">Ja, abschließen</button></div></div>`;
      h += list(st.faecher().filter(f => f.themen.length).map(f => {
        const n = f.themen.filter(t => st.zustand(t.id) === 'aktuell').length, d = f.themen.filter(t => st.zustand(t.id) === 'fertig').length;
        return row({ a: 'fach', d: f.id, icon: fachIcon(f), color: f.farbe, title: f.name, sub: [n ? n + ' im Unterricht' : '', d ? d + ' fertig' : ''].filter(Boolean).join(', ') || plural(f.themen.length, 'Thema', 'Themen') });
      }));
      b.innerHTML = h;
      on(b, {
        fach: fid => push(unterrichtFach(fid)),
        vorschlag: async () => { for (const t of vorschlag) await st.setZustand(t, 'fertig'); toast('Abgeschlossen.'); }
      });
    }
  };
}
function unterrichtFach(fid) {
  return {
    title: (st.fach(fid) || { name: 'Fach' }).name,
    render(b) {
      const f = st.fach(fid);
      if (!f) { b.innerHTML = empty('Dieses Fach gibt es nicht mehr.'); return; }
      const art = tid => st.isIntroOnly(tid) ? 'Einführung' : st.hasTopicContent(tid) ? 'Mit Übungen' : st.status(tid) === 'geplant' ? 'Noch leer' : 'Eigene Inhalte';
      const sc = b.closest('.page-scroll'), y = sc ? sc.scrollTop : 0;
      b.innerHTML = `<div class="list ut-list">${f.themen.map(t => `<div class="ut-row"><button class="ut-name" data-a="topic" data-d="${esc(t.id)}"><b>${esc(t.name)}</b><small>${esc(art(t.id))}</small></button>
        <div class="zst ut-z" data-t="${esc(t.id)}">${seg('z', ZUSTAENDE, st.zustand(t.id))}</div></div>`).join('')}</div>`
        + (f.themen.some(t => st.zustand(t.id) === 'aktuell') ? `<button class="btn small" data-a="alleab">Alle im Unterricht abschließen</button>` : '');
      if (sc) sc.scrollTop = y;
      if (!b._zst) {
        b._zst = true;
        b.addEventListener('click', e => {
          const btn = e.target.closest('.zst [data-seg] button');
          if (!btn) return;
          const z = btn.closest('.zst'), tid = z.dataset.t, v = btn.dataset.v;
          if (st.zustand(tid) === v) return;
          st.setZustand(tid, v);
          toast(zstText[v]);
        });
      }
      on(b, {
        topic: tid => push(topicPage(tid)),
        alleab: async () => {
          const akt = f.themen.filter(t => st.zustand(t.id) === 'aktuell');
          if (!(await confirmBox('Alle ' + akt.length + ' Themen in ' + f.name + ' als abgeschlossen markieren? Sie kommen dann bei Alles wiederholen dran.', 'Abschließen'))) return;
          for (const t of akt) await st.setZustand(t.id, 'fertig');
          toast('Abgeschlossen.');
        }
      });
    }
  };
}

export { notenEditor } from './noten.js';
export { fmtNote, notenPage, klausurPage };
export { probePage, hoerPage };
