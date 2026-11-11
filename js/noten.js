// Noten der Klassenarbeiten, Verlauf, Notenschlüssel.
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

export /* ===== Noten: Ergebnisse der Klassenarbeiten ===== */
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
      // Verlauf der Noten pro Fach, 1 oben. Erst ab zwei Noten sinnvoll.
      const serien = new Map();
      for (const e of ks) {
        const n = e.note != null ? e.note : st.noteAusProzent(e.prozent);
        if (n == null) continue;
        const k = e.fachId || e.fach, f = st.fach(e.fachId);
        if (!serien.has(k)) serien.set(k, { name: f ? f.kurz || f.name : e.fach, farbe: f ? f.farbe : 'var(--label2)', punkte: [] });
        serien.get(k).punkte.push({ x: e.datum, y: Math.max(1, Math.min(6, n)), tip: 'Note ' + fmtNote(n) });
      }
      const verlauf = linie([...serien.values()], { titel: 'Noten über die Zeit' });
      if (verlauf) h += `<div class="sec-h">Verlauf</div><div class="card">${verlauf}<p class="muted small">Oben ist besser. Antippen zeigt die Note.</p></div>`;
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
