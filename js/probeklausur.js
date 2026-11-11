// Probeklausur wie im Ernstfall: Zeit, keine Tipps, Auswertung mit Kernpunkten, Ergebnis je Thema.
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
      const alt = st.proben().slice().sort((a, c) => c.zeit - a.zeit).slice(0, 6);
      if (alt.length) h += `<div class="sec-h">Letzte Probeklausuren</div>` + list(alt.map(x => { const e = x.exId ? st.S.exams.find(y => y.id === x.exId) : null; const n = st.noteAusProzent(x.proz); return row({ title: dayLong(x.datum) + (e ? ' · ' + e.fach : ''), sub: x.punkte + ' von ' + x.max + ' Punkten' + (x.n ? ' · ' + plural(x.n, 'Aufgabe', 'Aufgaben') : ''), detail: x.proz + ' %' + (n ? ' · Note ' + n : '') }); }));
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
          runExam(shuffle(mix), minuten, mode === 'arbeit' && next ? next.id : '');
        }
      });
    }
  };
}
function runExam(items, minuten, exId = '') {
  // Ergebnis der Auswertung, wird beim Schließen gespeichert
  let ergebnis = null, gespeichert = false;
  const res = [];
  let i = 0, fertig = false;
  const t0 = Date.now(), limit = minuten * 60000;
  let tm = null, sheet = null, zettel = null;
  openSheet({
    title: 'Probeklausur', full: true,
    confirmClose: () => fertig || confirm('Probeklausur abbrechen?'),
    onClose: async () => {
      clearInterval(tm);
      if (ergebnis && !gespeichert) {
        gespeichert = true;
        await st.probeSpeichern(Object.assign({ exId, minuten, n: items.length }, ergebnis));
        const ex = exId ? st.S.exams.find(e => e.id === exId) : null;
        const schwach = Object.entries(ergebnis.themen || {}).filter(([t, q]) => q < 60 && st.thema(t)).map(([t]) => t);
        if (ex && schwach.length) { await st.planNachholenSetzen(ex, [...st.planNachholen(ex), ...schwach]); toast(schwach.map(t => st.thema(t).thema.name).join(', ') + ' kommt im Lernplan nochmal dran.', 4000); }
        refreshTop();
      }
      if (res.length) gh.anstossen();
    },
    render(body, api) { sheet = api; body.innerHTML = `<div class="sess-top">${progress(0)}<div class="sess-info"></div></div><div class="sess-item"></div><div class="sess-sk"></div><div class="schmier-zone">${schmierKnopf()}</div>`; zettel = schmierzettel(body); show(); }
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
    zettel.neu(items[i]);
    frageSkizze($('.sess-sk', sheet.body), fertig ? null : items[i], { blind: true });
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
      // Je Thema: erreichte und mögliche Punkte. Schwache Themen kommen beim Schließen in den Lernplan zum Nachholen.
      const proT = {};
      const zaehl = (tid, a, m) => { if (!tid) return; const x = proT[tid] || (proT[tid] = [0, 0]); x[0] += a; x[1] += m; };
      rech.forEach(r => zaehl(r.it.tid, r.erg === 'richtig' ? PUNKTE_RECHNEN : 0, PUNKTE_RECHNEN));
      kern.forEach((r, k) => zaehl(r.it.tid, haken[k].size, r.it.kern.length));
      ergebnis = { punkte: p, max, proz, themen: Object.fromEntries(Object.entries(proT).map(([t, x]) => [t, Math.round(x[0] / x[1] * 100)])) };
      let h = `<div class="sum"><div class="sum-big">${p} von ${max} Punkten</div><div class="muted">${proz} %${note ? ', Note ' + note : ''}${minuten ? ' · ' + fmtT(Math.min(Date.now() - t0, limit)) + ' von ' + minuten + ':00 Minuten' : ' · ' + fmtT(Date.now() - t0) + ' Minuten'}</div>${offen.length ? `<p class="muted small">${plural(offen.length, 'Aufgabe', 'Aufgaben')} nicht mehr geschafft, zählt mit 0 Punkten.</p>` : ''}</div>`;
      if (kern.length) {
        h += `<div class="sec-h">Selbst korrigieren</div><p class="src">Hak jeden Kernpunkt ab, den deine Antwort oder Skizze wirklich enthält. Daraus rechne ich die Punkte.</p>`;
        h += kern.map((r, k) => `<div class="card korr"><div class="card-k">${ART_NAME[r.it.art]} · ${r.it.kern.length} ${r.it.kern.length === 1 ? 'Punkt' : 'Punkte'}</div><div class="ex-task">${rich(r.it.frage)}</div>
          ${r.it.art !== 'skizze' ? `<div class="korr-a"><span class="muted small">Deine Antwort</span><p>${r.inf.antwort ? esc(r.inf.antwort) : '<i class="muted">nichts geschrieben</i>'}</p></div>` : ''}
          <div class="muted small">Musterlösung, Kernpunkte zum Abhaken</div>
          ${r.it.kern.map((x, j) => `<label class="korr-k"><input type="checkbox" data-k="${k}" data-j="${j}" ${haken[k].has(j) ? 'checked' : ''}><span>${rich(x)}</span></label>`).join('')}
          ${r.it.art !== 'skizze' && r.inf.antwort ? `<button class="btn small" data-a="claude" data-d="${k}">${icon('claude')} An Claude zur Korrektur</button>` : ''}</div>`).join('');
      }
      const nachArt = [['Rechnen', pRech, maxRech]].concat(['erklaeren', 'skizze', 'text'].map(a => { const rs = kern.map((r, k) => ({ r, k })).filter(x => x.r.it.art === a); return [ART_NAME[a], rs.reduce((s, x) => s + haken[x.k].size, 0), rs.reduce((s, x) => s + x.r.it.kern.length, 0)]; })).filter(x => x[2]);
      if (nachArt.length > 1) h += `<div class="sec-h">Punkte nach Aufgabenart</div><div class="card">${balken(nachArt.map(([name, n, m]) => ({ name, n, max: m, text: n + ' von ' + m })))}</div>`;
      const by = new Map();
      for (const r of rech) { const key = r.it.tid; if (!by.has(key)) by.set(key, []); by.get(key).push(r); }
      if (by.size) h += `<div class="sec-h">Rechnen pro Thema</div>` + list([...by].map(([tid, rs]) => { const th = st.thema(tid); const n = rs.filter(r => r.erg === 'richtig').length; return row({ title: th ? th.thema.name : 'Thema', sub: th ? th.fach.name : '', detail: n + ' von ' + rs.length, html: progress(n / rs.length, n / rs.length >= 0.8 ? 'var(--green)' : n / rs.length >= 0.5 ? 'var(--orange)' : 'var(--red)') }); }));
      const wrong = rech.filter(r => r.erg !== 'richtig');
      const arten = new Map();
      for (const r of wrong) { const k = r.inf.fehlerart || (r.inf.eingabe ? 'Rechenweg' : 'Nicht bearbeitet'); arten.set(k, (arten.get(k) || 0) + 1); }
      if (arten.size) h += `<div class="sec-h">Nach Fehlerart</div>` + list([...arten].sort((a, c) => c[1] - a[1]).map(([k, n]) => row({ title: k, detail: String(n) })));
      if (wrong.length) h += `<div class="sec-h">Das schaust du dir nochmal an</div>` + list(wrong.map(r => row({ titleHTML: rich(r.inf.aufgabe || itemTitle(r.it)), sub: r.inf.offen ? 'Nicht mehr geschafft' : 'Deine Eingabe: ' + (r.inf.eingabe || '–') + (r.inf.richtig ? ' · richtig: ' + r.inf.richtig : '') })));
      if (exId && Object.values((ergebnis && ergebnis.themen) || {}).some(q => q < 60)) h += `<div class="btn-col"><button class="btn filled" data-a="schwach">${icon('bolt')} Schwächen jetzt üben</button></div>`;
      h += `<div class="btn-col">${kern.some(r => r.inf.antwort) ? `<button class="btn" data-a="claudeAlle">${icon('claude')} Alle Antworten an Claude zur Korrektur</button>` : ''}<button class="btn filled" data-a="close">Fertig</button></div>`;
      box.innerHTML = h;
      $$('[data-j]', box).forEach(c => c.onchange = () => { const s = haken[+c.dataset.k]; c.checked ? s.add(+c.dataset.j) : s.delete(+c.dataset.j); const sc = $('.sheet-body', sheet.el).scrollTop; draw(); $('.sheet-body', sheet.el).scrollTop = sc; });
    };
    const frage = r => { const th = st.thema(r.it.tid); return `Aufgabe${th ? ' (' + th.fach.name + ', ' + th.thema.name + ')' : ''}: ${r.it.frage}\nMeine Antwort: ${r.inf.antwort}\nMusterlösung laut Lernwerk, Kernpunkte: ${r.it.kern.join('; ')}`; };
    on(box, {
      close: () => sheet.close(),
      schwach: async () => { sheet.close(); const ex = st.S.exams.find(e => e.id === exId); const app = await import('./app.js'); setTimeout(() => app.planTagLernen(ex, 'schwach'), 400); },
      claude: k => askClaude('Korrigier bitte meine Antwort aus einer Probeklausur wie ein Lehrer an der Fachschule Technik. Sag, welche Kernpunkte fehlen oder falsch sind, wie viele Punkte du geben würdest und wie eine gute Antwort klingt.\n\n' + frage(kern[+k])),
      claudeAlle: () => askClaude('Korrigier bitte meine Antworten aus einer Probeklausur wie ein Lehrer an der Fachschule Technik. Sag je Aufgabe, welche Kernpunkte fehlen oder falsch sind und wie viele Punkte du geben würdest.\n\n' + kern.filter(r => r.inf.antwort).map((r, k) => (k + 1) + '. ' + frage(r)).join('\n\n'))
    });
    draw();
    $('.bar i', sheet.body).style.width = '100%';
  }
}
