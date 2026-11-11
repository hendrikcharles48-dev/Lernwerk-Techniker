// Seite Hörmodus: Folgen, Auto-Playlist, Abfragen mit Denkpause, Lernzettel vorlesen, Stimmen.
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
