// Trainer-Engine: Themenseite und alle Übungsarten. Eingebaute und eingefügte Inhalte laufen hier gleich.
import { esc, fmtNum, markdown, plainText, shuffle, dayStr, dayShort, norm } from './util.js';
import { fml, fmlWith, nameHTML, parseEq, keyOf, calc, checkSolved, checkStep, varNames, speakFml, mathText } from './formula.js';
import { checkNumber, showValue } from './check.js';
import * as st from './store.js';
import { $, $$, icon, row, list, seg, sw, empty, on, push, openSheet, toast, copyText, confirmBox, progress, fachIcon, hinweisTabellenbuch } from './ui.js';
import { speak, stopSpeaking, canSpeak, readAloud, stopReading } from './speech.js';
import { INTERVALS } from './srs.js';
import { prefs } from './db.js';
import * as sk from './skizzen.js';
import { editorHTML, attachEditor } from './mathedit.js';
import { wegSchritte, wegPruefen } from './aufgabe.js';

import { runAuffrischen, runAufgabe, runAuswahl, runBegriff, runErklaeren, runFehler, runKarte, runReihenfolge, runUmstellen, runVerwechslung, runZuordnen } from './uebungen.js';
import { schmierKnopf, schmierzettel } from './schmierzettel.js';
/* ===== Frag Claude ===== */
export async function askClaude(text) {
  const ok = await copyText(text);
  toast(ok ? 'Frage kopiert. Füge sie im Chat ein.' : 'Kopieren hat nicht geklappt.');
  setTimeout(() => { try { window.open('https://claude.ai/new', '_blank'); } catch (e) { location.href = 'https://claude.ai/new'; } }, 350);
}
export function claudeFrage(ctx) {
  return `Ich übe in Lernwerk: ${ctx.fach}, ${ctx.thema}. Aufgabe: ${ctx.aufgabe}. Meine Eingabe: ${ctx.eingabe || 'keine'}. Die App meldet einen Fehler bei Schritt ${ctx.schritt || 1}${ctx.was ? ' (' + ctx.was + ')' : ''}: ${ctx.meldung || ''}${ctx.richtig ? ' Richtig wäre laut App: ' + ctx.richtig + '.' : ''} Erklär mir nach meinem Schulskill, wo mein Denkfehler liegt, ohne vorzurechnen.`;
}

/* ===== Fortschritt ===== */
export function topicProgress(tid) {
  const items = st.topicItems(tid);
  const th = st.thema(tid);
  if (th && th.thema.trainer && th.thema.trainer.length) items.push({ id: 't:' + tid });
  if (!items.length) return null;
  let s = 0;
  for (const it of items) { const c = st.card(it.id); if (c) s += Math.min(c.stufe, 4) / 4; }
  return s / items.length;
}
export function fachProgress(f) {
  const vals = f.themen.map(t => topicProgress(t.id)).filter(v => v != null);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
}
const stufeText = c => (!c ? 'neu' : c.faellig <= dayStr() ? 'fällig' : 'Stufe ' + c.stufe + ', wieder am ' + dayShort(c.faellig));

/* ===== Alte Trainer öffnen ===== */
export async function openTrainer(tid, datei) {
  const th = st.thema(tid);
  await st.setPlace({ art: 'trainer', tid, datei: datei.replace(/^trainer\//, ''), titel: th ? th.thema.name : '' });
  prefs.set('return', { tid, zeit: Date.now() });
  location.href = datei;
}

/* ===== Lernweg für ein neues Thema =====
 * Erst verstehen, dann im Trainer selbst machen, dann die ersten leichten Fragen.
 * Danach übernimmt die Wiederholung. Gespeichert pro Thema in kv „lernweg“: { lesen, trainer, fragen, aus } als Zeitpunkte.
 */
const lernweg = tid => (st.kvGet('lernweg', {})[tid] || {});
async function lernwegSetzen(tid, schritt, wert = Date.now()) {
  const alle = Object.assign({}, st.kvGet('lernweg', {}));
  alle[tid] = Object.assign({}, alle[tid] || {}, { [schritt]: wert });
  await st.kvSet('lernweg', alle);
}
function lernwegSchritte(tid) {
  const th = st.thema(tid), T = st.topic(tid);
  // Lernblätter erklären, Trainer lassen dich selbst rechnen
  const alle = (th && th.thema.trainer) || [];
  const blatt = alle.find(x => /lernblatt/i.test(x.titel + x.datei));
  const tr = alle.find(x => !/lernblatt/i.test(x.titel + x.datei));
  return [
    blatt ? { k: 'lesen', titel: 'Verstehen', text: blatt.titel + ' durchgehen, dann Bild, Skizze und Prinzip im Thema.', datei: blatt.datei }
      : { k: 'lesen', titel: 'Verstehen', text: 'Bild aus deiner Welt, Skizze und Prinzip lesen. Gern vorlesen lassen.' },
    tr ? { k: 'trainer', titel: 'Im Trainer selbst machen', text: tr.titel + ': Schritt für Schritt, mit Erklärung bei jedem Fehler.', datei: tr.datei }
      : { k: 'trainer', titel: 'Bausteine durchgehen', text: T.bausteine.length ? 'Die Lösungsbausteine und den Schnellweg einmal in Ruhe ansehen.' : 'Die Fachbegriffe und Merksätze einmal laut erklären.' },
    { k: 'fragen', titel: 'Erste Fragen', text: 'Ein paar leichte Fragen aus Stufe 1. Was nicht sitzt, kommt gleich nochmal.' }
  ];
}
// Offen, solange nicht alle Schritte erledigt sind und er nicht ausgeblendet wurde.
// Gezeigt wird er bei Themen im Unterricht und bei Themen, die noch nie geübt wurden.
export function lernwegOffen(tid) {
  const w = lernweg(tid);
  if (w.aus || (w.lesen && w.trainer && w.fragen) || !st.hasTopicContent(tid)) return false;
  return st.zustand(tid) === 'aktuell' || !st.topicItems(tid).some(i => st.card(i.id));
}
export const lernwegStand = tid => { const w = lernweg(tid); return ['lesen', 'trainer', 'fragen'].filter(k => w[k]).length; };
function lernwegHTML(tid, f) {
  const w = lernweg(tid);
  // Ausgeblendet, aber noch nicht fertig: kleiner Knopf zum Zurückholen
  if (w.aus && !(w.lesen && w.trainer && w.fragen) && st.hasTopicContent(tid)) return `<button class="lweg-ein" data-a="lwegEin">${icon('target')} Lernweg wieder einblenden</button>`;
  if (!lernwegOffen(tid)) return '';
  const schritte = lernwegSchritte(tid);
  const naechster = schritte.find(x => !w[x.k]);
  return `<div class="lweg" style="--fc:${f.farbe}"><div class="lweg-h"><span><b>Dein Lernweg</b><small>So sitzt das Thema am schnellsten</small></span><button class="lweg-x" data-a="lwegAus" aria-label="Lernweg ausblenden">${icon('close')}</button></div>
    ${schritte.map((x, k) => `<button class="lweg-s ${w[x.k] ? 'done' : ''} ${x === naechster ? 'jetzt' : ''}" data-a="lweg" data-d="${x.k}"><i>${w[x.k] ? icon('check') : k + 1}</i><span><b>${esc(x.titel)}</b><small>${esc(x.text)}</small></span>${x === naechster ? icon('chev', 'chev') : ''}</button>`).join('')}
    <div class="lweg-f">Danach übernimmt die Wiederholung: Das Thema kommt von selbst in deinen Runden wieder.</div></div>`;
}

/* ===== Themenseite ===== */
const TABS = [['prinzip', 'Prinzip'], ['bausteine', 'Bausteine'], ['ueben', 'Üben'], ['karten', 'Karten'], ['schnellweg', 'Schnellweg'], ['zettel', 'Lernzettel'], ['fotos', 'Fotos']];

export const ZUSTAENDE = [['kommt', 'Kommt noch'], ['aktuell', 'Im Unterricht'], ['fertig', 'Abgeschlossen']];
// Kleiner Balken: Wie sicher sitzt das Thema?
export function staerkeHTML(sk, kurz) {
  if (sk.wert == null) return kurz ? '' : `<div class="stk-row muted small">Stärke: noch zu wenig geübt</div>`;
  const farbe = { schwach: 'var(--red)', mittel: 'var(--orange)', sicher: 'var(--green)' }[sk.stufe];
  return `<div class="stk-row"><span class="stk-l">${kurz ? '' : 'Stärke: '}${{ schwach: 'Schwach', mittel: 'Mittel', sicher: 'Sicher' }[sk.stufe]}</span>${progress(sk.wert, farbe)}</div>`;
}
export function topicPage(tid, startTab) {
  const th = st.thema(tid);
  let cur = startTab || null;
  return {
    title: th ? th.thema.name : 'Thema',
    actions: [{ label: 'Als Block kopieren', icon: 'copy', onClick: async () => { const ok = await copyText(st.exportTopic(tid)); toast(ok ? 'Thema als Lernwerk-Block kopiert.' : 'Kopieren hat nicht geklappt.'); } }],
    render(body) {
      const th2 = st.thema(tid);
      if (!th2) { body.innerHTML = empty('Dieses Thema gibt es nicht mehr.'); return; }
      const { fach: f, thema: t } = th2;
      const T = st.topic(tid);
      const items = st.topicItems(tid);
      const sicht = items.filter(i => st.sichtbar(i));
      if (!cur) cur = st.hasTopicContent(tid) ? 'prinzip' : (st.notesFor(tid).length ? 'zettel' : 'prinzip');
      st.setPlace({ art: 'thema', tid, titel: t.name, tab: cur });
      const sk = st.staerke(tid);
      const tc = st.card('t:' + tid);
      const alle = items;
      let h = `<div class="topic-head" style="--fc:${f.farbe}">
        <div class="chips"><span class="chip chip-ic" style="background:${f.farbe}">${icon(fachIcon(f))}${esc(f.kurz || f.name)}</span>${(f.module || []).map(m => `<span class="chip ghost">${esc(m === 'Ü' ? 'übergreifend' : m)}</span>`).join('')}${T.modul && !(f.module || []).includes(T.modul) ? `<span class="chip ghost">${esc(T.modul)}</span>` : ''}</div>
        <div class="zst">${seg('zst', ZUSTAENDE, st.zustand(tid))}</div>${lernwegHTML(tid, f)}${staerkeHTML(sk)}${stufenHTML(tid, alle)}`;
      if (t.trainer && t.trainer.length) {
        h += `<div class="trainer-btns">${t.trainer.map(x => `<button class="btn-big" data-a="trainer" data-d="${esc(x.datei)}" style="--fc:${f.farbe}">${icon('open')}<span><b>${esc(x.titel)}</b><small>Trainer${tc ? ' · ' + stufeText(tc) : ''}</small></span></button>`).join('')}</div>`;
      }
      h += `</div><div class="seg-scroll">${seg('tab', TABS.map(([v, l]) => [v, l + countFor(v, T, sicht, tid)]), cur)}</div><div class="tab-body"></div>`;
      body.innerHTML = h;
      const tb = $('.tab-body', body);
      const draw = () => { st.setPlace({ art: 'thema', tid, titel: t.name, tab: cur }); renderTab(tb, cur, tid, T, items, f); };
      const neu = () => this.render(body);
      on(body, {
        'seg:zst': async v => { await st.setZustand(tid, v); toast({ kommt: 'Kommt noch.', aktuell: lernwegOffen(tid) ? 'Im Unterricht. Fang oben mit deinem Lernweg an.' : 'Im Unterricht. Kommt bei Unterricht dran.', fertig: 'Abgeschlossen. Kommt bei Alles wiederholen dran.' }[v]); if (v === 'aktuell') neu(); },
        lwegAus: async () => { await lernwegSetzen(tid, 'aus'); toast('Lernweg ausgeblendet. Oben im Thema holst du ihn zurück.'); neu(); },
        lwegEin: async () => { await lernwegSetzen(tid, 'aus', 0); neu(); },
        lweg: async k => {
          const x = lernwegSchritte(tid).find(y => y.k === k);
          if (k === 'lesen' && x.datei) { await lernwegSetzen(tid, 'lesen'); openTrainer(tid, x.datei); return; }
          if (k === 'lesen') { await lernwegSetzen(tid, 'lesen'); cur = 'prinzip'; neu(); setTimeout(() => { const el = $('.tab-body', body); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 50); return; }
          if (k === 'trainer') {
            await lernwegSetzen(tid, 'trainer');
            if (x.datei) { openTrainer(tid, x.datei); return; }
            cur = T.bausteine.length ? 'bausteine' : 'prinzip'; neu(); return;
          }
          // Erste Fragen: Stufe 1, sonst die leichtesten, höchstens 8
          const alleIt = st.topicItems(tid).filter(i => i.art !== 'fehler');
          let its = alleIt.filter(i => i.stufe === 1);
          if (its.length < 4) its = alleIt.filter(i => i.stufe <= 2);
          if (!its.length) its = alleIt;
          its = sortForPractice(its).slice(0, 8);
          if (!its.length) { toast('Zu diesem Thema gibt es noch keine Fragen.'); return; }
          runSession(its, 'Erste Fragen: ' + t.name, { onClose: async res => {
            if (res.length >= Math.ceil(its.length / 2)) { await lernwegSetzen(tid, 'fragen'); toast(lernwegStand(tid) === 3 ? 'Lernweg geschafft. Ab jetzt kommt das Thema in deinen Runden.' : 'Erste Fragen geschafft.'); }
            neu();
          } });
        },
        trainer: d => openTrainer(tid, d),
        'seg:tab': v => { cur = v; draw(); },
        hatten: async () => { const n = st.freigabe(tid) + 1; await st.setFreigabe(tid, n); toast('Stufe ' + n + ' ist frei: ' + st.STUFEN_NAMEN[n] + '. Kommt ab jetzt in der Wiederholung dran.'); },
        stufe: async d => {
          const k = +d, n = st.freigabe(tid);
          if (k === n) return;
          if (k < n && !(await confirmBox('Zurück auf Stufe ' + k + '? Fragen aus höheren Stufen kommen dann nicht mehr dran. Dein Stand bleibt gespeichert.', 'Zurück'))) return;
          await st.setFreigabe(tid, k);
          toast('Freigeschaltet bis Stufe ' + k + '.');
        }
      });
      draw();
    }
  };
}
// Stufen des Themas: 1 Grundlagen, 2 Zusammenhänge, 3 Anwenden. Nur eingebaute Inhalte, eigene sind immer frei.
function stufenHTML(tid, items) {
  const its = items.filter(i => !i.eigen);
  if (!its.length) return '';
  const n = st.freigabe(tid);
  const anz = k => its.filter(i => i.stufe === k).length;
  // Kleiner Balken je Stufe: Anteil der Fragen, die schon sitzen
  const sitzt = k => { const g = its.filter(i => i.stufe === k); return g.length ? g.filter(i => (st.card(i.id) || {}).stufe >= 3).length / g.length : 0; };
  let h = `<div class="stufen">${[1, 2, 3].map(k => `<button class="stf ${k <= n ? 'on' : ''}" data-a="stufe" data-d="${k}" aria-label="Stufe ${k}, ${st.STUFEN_NAMEN[k]}, ${anz(k)} Fragen, ${Math.round(sitzt(k) * 100)} Prozent sitzen"><b>${k <= n ? k : icon('lock')}</b><span>${st.STUFEN_NAMEN[k]}</span><small>${anz(k) ? anz(k) + ' · ' + Math.round(sitzt(k) * 100) + ' % sitzen' : 'keine Fragen'}</small>${anz(k) ? `<i class="stf-bar"><i style="width:${Math.round(sitzt(k) * 100)}%"></i></i>` : ''}</button>`).join('')}</div>`;
  const hoechste = Math.max(...its.map(i => i.stufe));
  if (n < hoechste) h += (st.stufeSitzt(tid) ? `<div class="fb good stf-tipp"><b>Stufe ${n} sitzt.</b> Wenn ihr Stufe ${n + 1} im Unterricht hattet, schalte sie frei.</div>` : '') + `<button class="btn small stf-btn" data-a="hatten">${icon('check')} Hatten wir: Stufe ${n + 1} freischalten</button>`;
  return h;
}
const modusHTML = () => `<div class="modus">${seg('modus', st.MODI, st.modus())}</div>`;
const gesperrtHinweis = (alle, sicht) => { const n = alle.length - sicht.length; return n > 0 ? `<p class="src">${n} weitere ${n === 1 ? 'Frage ist' : 'Fragen sind'} noch gesperrt. „Hatten wir“ oben schaltet die nächste Stufe frei.</p>` : ''; };
function countFor(v, T, items, tid) {
  const n = { prinzip: 0, bausteine: 0, ueben: items.filter(i => ['aufgabe', 'umstellen', 'auswahl', 'reihenfolge', 'verwechslung', 'zuordnen', 'erklaeren', 'skizze'].includes(i.art)).length, karten: items.filter(i => i.art === 'karte' || i.art === 'begriff').length, schnellweg: T.schnellwege.length, zettel: st.notesFor(tid).length, fotos: st.photosFor(tid).length }[v];
  return n ? ' ' + n : '';
}

function renderTab(el, tab, tid, T, items, f) {
  const color = f.farbe;
  let h = '';
  if (tab === 'prinzip' && st.isIntroOnly(tid) && st.status(tid) === 'geplant') h += `<div class="fb info intro-hint"><b>Einführung.</b> Das Thema ist noch nicht dran. Hier stehen schon die Grundlagen. Wenn es im Unterricht kommt, ergänzt du es über Einfügen.</div>`;
  if (tab === 'prinzip') {
    const nichts = !T.anker.length && !T.begriffe.length && !T.merksaetze.length && !T.prinzip.length && !T.notizen.length;
    if (nichts) h += emptyContent(tid);
    T.anker.forEach(a => { h += `<div class="card anchor"><div class="card-k">Bild aus deiner Welt</div><p>${rich(a)}</p></div>`; });
    if (sk.fuer(tid).length) h += `<div class="sec-h">${sk.fuer(tid).length > 1 ? 'Skizzen' : 'Skizze'}</div>` + sk.html(tid, false, false, true);
    if (T.begriffe.length) h += `<div class="sec-h">Fachbegriffe</div>` + list(T.begriffe.map(b => row({ titleHTML: `<b>${esc(b.begriff)}</b>`, subHTML: rich(b.erklaerung) })));
    T.merksaetze.forEach(m => { h += `<div class="card merk" style="--fc:${color}"><div class="card-k">Merksatz</div><p>${rich(m)}</p></div>`; });
    if (T.prinzip.length) h += `<div class="sec-h">So funktioniert es</div><div class="card prose">${T.prinzip.map(p => markdown(p, mathText)).join('')}</div>`;
    if (T.notizen.length) h += `<div class="sec-h">Notizen</div>` + list(T.notizen.map(n => row({ title: n.schluessel, sub: n.text })));
    if (!nichts) h += `<div class="btn-row"><button class="btn" data-a="folge">${icon('ear')} Als Folge hören</button><button class="btn" data-a="bild">${icon('claude')} Mit Bild erklären lassen</button></div>`;
    if (T.quellen.length) h += `<p class="src">Quelle: ${T.quellen.map(esc).join(' ')}</p>`;
  }
  if (tab === 'bausteine') {
    if (T.bausteine.length) h += `<div class="sec-h">So gehst du vor</div><ol class="steps-list">${T.bausteine.map(b => `<li>${rich(b)}</li>`).join('')}</ol>`;
    if (T.fehler.length) h += `<div class="sec-h">Typische Fehler</div>` + list(T.fehler.map(x => row({ titleHTML: rich(x.fehler), subHTML: rich(x.achtung) })));
    if (T.formeln.length) h += `<div class="sec-h">Formeln</div>` + T.formeln.map(formelCard).join('');
    if (!h) h = empty('Noch keine Bausteine.', 'Bausteine zerlegen eine Aufgabe in gegeben, gesucht, Regel und nächsten Schritt. Hol sie dir über Einfügen aus dem Chat.');
  }
  const UEB = ['aufgabe', 'umstellen', 'auswahl', 'reihenfolge', 'verwechslung', 'zuordnen', 'erklaeren', 'skizze'];
  if (tab === 'ueben') {
    const alle = items.filter(i => UEB.includes(i.art));
    const ex = alle.filter(i => st.sichtbar(i));
    if (alle.length) h += modusHTML();
    if (!alle.length) h = empty('Noch keine Übungen.', 'Aufgaben kommen über einen Lernwerk-Block mit Aufgabe-Zeilen. Der alte Trainer oben funktioniert wie gewohnt.');
    else if (!ex.length) h += empty('In dieser Stufe gibt es noch keine Übungen.', 'Schalte oben mit „Hatten wir“ die nächste Stufe frei oder wähl „Alles gemischt“.');
    else {
      h += `<div class="btn-row"><button class="btn filled" data-a="mix">${icon('bolt')} Gemischt üben</button></div>`;
      const grp = (art, title) => { const g = ex.filter(i => i.art === art); if (!g.length) return ''; return `<div class="sec-h">${title}</div>` + list(g.map(i => row({ a: 'item', d: i.id, titleHTML: itemHTML(i), subHTML: esc(stufeText(st.card(i.id))) }))); };
      h += grp('aufgabe', 'Aufgaben') + grp('umstellen', 'Formeln umstellen') + grp('auswahl', 'Auswahlfragen') + grp('reihenfolge', 'Reihenfolge') + grp('verwechslung', 'Nicht verwechseln') + grp('zuordnen', 'Zuordnen') + grp('erklaeren', 'Erklären') + grp('skizze', 'Skizzen');
    }
    h += gesperrtHinweis(alle, ex);
  }
  if (tab === 'karten') {
    const kAlle = items.filter(i => i.art === 'karte' || i.art === 'begriff');
    const ks = kAlle.filter(i => st.sichtbar(i));
    if (kAlle.length) h += modusHTML();
    if (!ks.length) h += empty(kAlle.length ? 'In dieser Stufe gibt es keine Karten.' : 'Noch keine Karten.', 'Karten kommen über Karte-Zeilen und Begriff-Zeilen im Lernwerk-Block.') + gesperrtHinweis(kAlle, ks);
    else {
      h += `<div class="btn-row"><button class="btn filled" data-a="karten">${icon('cards')} Karten üben</button></div>`;
      h += list(ks.map(k => row({ a: 'flip', d: k.id, titleHTML: rich(k.frage), subHTML: `<span class="hidden-ans" data-ans="${esc(k.id)}">Antippen zum Aufdecken</span>`, detail: stufeText(st.card(k.id)), chev: false })));
      h += gesperrtHinweis(kAlle, ks);
    }
  }
  if (tab === 'schnellweg') {
    if (!T.schnellwege.length) h = empty('Noch kein Schnellweg.', 'Ein Schnellweg ist ein kürzerer Prüfungsweg mit Erklärung, warum er funktioniert.');
    T.schnellwege.forEach(s => { h += `<div class="card fast" style="--fc:${color}"><div class="card-k">${icon('bolt')} Schnellweg</div><div class="prose">${markdown(s, mathText)}</div></div>`; });
  }
  if (tab === 'zettel') {
    const ns = st.notesFor(tid);
    h += `<div class="btn-row"><button class="btn filled" data-a="newnote">${icon('note')} Neuer Lernzettel</button></div>`;
    h += ns.length ? list(ns.map(n => row({ a: 'note', d: n.id, title: n.titel || 'Lernzettel', sub: plainText(n.text).slice(0, 90) }))) : empty('Noch keine Lernzettel.', 'Füge eine Erklärung aus dem Chat über Einfügen ein oder schreib hier selbst.');
  }
  if (tab === 'fotos') {
    const ps = st.photosFor(tid);
    h += `<div class="btn-row"><label class="btn filled">${icon('photo')} Foto hinzufügen<input type="file" accept="image/*" data-file="photo" hidden></label></div>`;
    h += ps.length ? `<div class="photo-grid">${ps.map(p => `<button class="ph" data-a="photo" data-d="${p.id}"><img data-pid="${p.id}" alt="${esc(p.titel || 'Foto')}"></button>`).join('')}</div>` : empty('Noch keine Fotos.', 'Fotos von Mitschriften und Arbeitsblättern bleiben nur auf diesem Gerät.');
    h += `<p class="src">Fotos werden nur auf diesem Gerät gespeichert.</p>`;
  }
  if (tab === 'prinzip' || tab === 'bausteine' || tab === 'schnellweg') h += hinweisTabellenbuch();
  el.innerHTML = h;
  sk.fuellen(el);
  if (tab === 'fotos') loadThumbs(el);
  on(el, {
      item: id => { const it = st.topicItems(tid).find(i => i.id === id); if (it) runSession([it], itemTitle(it), { single: true }); },
      mix: () => { const its = st.uebItems(tid).filter(i => UEB.includes(i.art)); runSession(sortForPractice(its).slice(0, 8), 'Gemischt üben'); },
      karten: () => { const its = st.uebItems(tid).filter(i => i.art === 'karte' || i.art === 'begriff'); runSession(sortForPractice(its), 'Karten'); },
      'seg:modus': v => { st.setModus(v); toast({ frei: 'Nur freigeschaltete Stufen.', alles: 'Alle Stufen gemischt.', schwer: 'Nur schwere Fragen.' }[v]); },
      flip: (id, b) => { const it = st.topicItems(tid).find(i => i.id === id); const s = $('.hidden-ans', b); if (it && s) { s.innerHTML = rich(it.antwort); s.classList.add('shown'); } },
      newnote: () => noteEditor({ tid }),
      note: id => noteReader(id),
      photo: id => photoViewer(id),
      trainer: d => openTrainer(tid, d),
      // Podcast-Folge zum Thema: Lena fragt, Tom erklärt. Der Hörmodus zeigt den Player.
      bild: () => askClaude(`Ich lerne in Lernwerk ${T.fach}, Thema ${T.thema}. Erklär mir das Prinzip mit einer genauen Skizze oder einem interaktiven Bild: beschrifte alle Größen mit Einheit, zeig Kraft- oder Stromrichtungen und erkläre in einfachen Sätzen, was man im Bild sieht. Nimm ein Beispiel aus der Werkstatt.`),
      folge: async () => { const [h, x] = await Promise.all([import('./hoer.js'), import('./extra.js')]); await h.spielen([tid]); push(x.hoerPage()); },
      vorlesen: () => { const txt = [...T.anker, ...T.merksaetze.map(m => 'Merksatz: ' + m), ...T.prinzip.map(plainText)].join('. '); readAloud(txt, T.thema); }
  });
  if (!el._fileBound) {
    el._fileBound = true;
    el.addEventListener('change', async e => {
      const inp = e.target.closest('[data-file="photo"]');
      if (!inp || !inp.files.length) return;
      for (const file of inp.files) { const blob = await shrinkImage(file); await st.savePhoto(tid, blob, file.name || ''); }
      toast('Foto gespeichert.');
      renderTab(el, 'fotos', tid, st.topic(tid), st.topicItems(tid), f);
    });
  }
}
function emptyContent(tid) {
  const th = st.thema(tid);
  const tr = th && th.thema.trainer && th.thema.trainer.length;
  return empty(tr ? 'Der Stoff steckt im Trainer.' : 'Noch kein Inhalt.', tr ? 'Öffne ihn oben. Über Einfügen kannst du Prinzip, Karten und Aufgaben ergänzen.' : 'Lass dir das Thema im Claude-Chat erklären und füge den Lernwerk-Block über Einfügen ein.');
}
export function formelCard(fo) {
  return `<div class="card formel">${fo.name ? `<div class="card-k">${esc(fo.name)}</div>` : ''}<div class="fml-main">${fml(fo.formel)}</div>${fo.aufbau ? `<div class="fml-aufbau"><b>Aufbau.</b> ${rich(fo.aufbau)}</div>` : ''}${fo.umgestellt.length ? `<div class="fml-alt">${fo.umgestellt.map(u => `<div>${fml(u)}</div>`).join('')}</div>` : ''}</div>`;
}
// Welche Formeln des Themas gehören zu dieser Aufgabe? Ihre Größen müssen im Ansatz oder in den Rechnungen vorkommen.
export function passendeFormeln(T, a) {
  const text = [a.ansatz ? a.ansatz.richtig : '', a.rechnung || '', ...a.schritte.map(x => (x.ergebnis && x.ergebnis.text) || '')].join(' ');
  const ids = new Set((text.match(/[A-Za-zΑ-Ωα-ωµûϑΔ][A-Za-z0-9_Α-Ωα-ωµûϑ]*/g) || []).map(keyOf));
  return T.formeln.filter(f => f.aufbau).map(f => {
    let v;
    try { v = [...varNames(parseEq(f.formel)).keys()]; } catch (e) { return null; }
    return v.length ? { f, s: v.filter(x => ids.has(x)).length / v.length } : null;
  }).filter(x => x && x.s >= 0.6).sort((x, y) => y.s - x.s).slice(0, 2).map(x => x.f);
}
export const aufbauHTML = fs => (fs.length ? `<div class="fb info aufbau-box"><b>So ist die Formel aufgebaut.</b>${fs.map(f => `<div class="ab-z">${fml(f.formel)}<span>${rich(f.aufbau)}</span></div>`).join('')}</div>` : '');
export function itemHTML(i) {
  if (i.art === 'umstellen') return fml(i.u.formel) + ' nach ' + nameHTML(i.u.nach);
  return rich(itemTitle(i));
}
export function itemTitle(i) {
  if (i.art === 'aufgabe') { const t = i.aufgabe.text.replace(/\{[^}]+\}/g, '…'); return (t.length > 90 ? t.slice(0, 88).replace(/\s\S*$/, '') + ' …' : t) || 'Aufgabe'; }
  if (i.art === 'umstellen') return i.u.formel + ' nach ' + i.u.nach;
  if (i.art === 'auswahl') return i.a.frage;
  if (i.art === 'reihenfolge') return i.r.titel;
  if (i.art === 'verwechslung') return i.v.a + ' oder ' + i.v.b;
  if (i.art === 'zuordnen') return 'Zuordnen: ' + i.z.titel;
  if (i.art === 'fehler') return i.err.aufgabe || i.err.fehlerart;
  return i.frage || '';
}
// Damit alle Fragen drankommen und nicht immer dieselben: Was noch nie dran war, kommt zuerst,
// danach was am längsten her ist. Gleich alte Fragen in zufälliger Reihenfolge.
const zuletztAm = id => { const c = st.card(id); return c ? (c.zeit || Date.parse((c.zuletzt || '2000-01-01') + 'T12:00')) : 0; };
export function nachAlter(items) {
  const t = new Map(items.map(i => [i.id, zuletztAm(i.id)]));
  // Auf den Tag genau vergleichen, sonst gäbe es keine Zufallsreihenfolge mehr
  const tag = i => Math.floor(t.get(i.id) / 86400000);
  return shuffle(items).sort((a, b) => tag(a) - tag(b));
}
export function sortForPractice(items) {
  const today = dayStr();
  const k = i => { const c = st.card(i.id); return !c ? 1 : c.faellig <= today ? 0 : 2; };
  return nachAlter(items).sort((a, b) => k(a) - k(b));
}

/* ===== Bilder verkleinern, damit der Speicher reicht ===== */
export function shrinkImage(file, max = 1800) {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob(b => resolve(b || file), 'image/jpeg', 0.85);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}
async function loadThumbs(el) {
  for (const img of $$('img[data-pid]', el)) {
    const p = await st.photo(img.dataset.pid);
    if (p && p.blob) img.src = URL.createObjectURL(p.blob);
  }
}
function photoViewer(id) {
  openSheet({
    title: 'Foto', full: true,
    async render(b, api) {
      b.innerHTML = `<div class="ph-view"><img alt="Foto"></div><div class="btn-col"><button class="btn danger" data-a="del">${icon('trash')} Foto löschen</button></div>`;
      const p = await st.photo(id);
      if (p && p.blob) $('img', b).src = URL.createObjectURL(p.blob);
      on(b, { del: async () => { if (await confirmBox('Foto wirklich löschen?', 'Löschen', true)) { await st.deletePhoto(id); api.close(); toast('Foto gelöscht.'); } } });
    }
  });
}

/* ===== Lernzettel ===== */
export function noteEditor(n) {
  const isNew = !n.id;
  openSheet({
    title: isNew ? 'Neuer Lernzettel' : 'Lernzettel bearbeiten', full: true,
    render(b, api) {
      b.innerHTML = `<div class="form">
        <label class="fld"><span>Titel</span><input type="text" data-k="titel" value="${esc(n.titel || '')}" placeholder="Zum Beispiel: Kondensator laden"></label>
        <label class="fld"><span>Text</span><textarea data-k="text" rows="14" placeholder="Erklärung hier einfügen. Fettschrift mit zwei Sternchen, Listen mit Bindestrich.">${esc(n.text || '')}</textarea></label>
        <button class="btn filled" data-a="save">Speichern</button></div>`;
      on(b, {
        save: async () => {
          const titel = $('[data-k="titel"]', b).value.trim(), text = $('[data-k="text"]', b).value;
          if (!text.trim()) { toast('Der Lernzettel ist noch leer.'); return; }
          await st.saveNote(Object.assign({}, n, { titel: titel || firstLine(text), text, zeit: Date.now() }));
          api.close(); toast('Lernzettel gespeichert.');
        }
      });
    }
  });
}
export const firstLine = t => plainText(String(t).split('\n').find(l => l.trim()) || 'Lernzettel').slice(0, 60);
export function noteReader(id) {
  openSheet({
    title: 'Lernzettel', full: true,
    render(b, api) {
      const n = st.S.notes.find(x => x.id === id);
      if (!n) { api.close(); return; }
      const th = st.thema(n.tid);
      b.innerHTML = `<div class="note-meta">${th ? esc(th.fach.name + ' · ' + th.thema.name) : ''}</div><h2 class="note-t">${esc(n.titel || '')}</h2><div class="prose card">${markdown(n.text)}</div>
        <div class="btn-col">${canSpeak() ? `<button class="btn" data-a="read">${icon('ear')} Vorlesen</button>` : ''}<button class="btn" data-a="edit">${icon('edit')} Bearbeiten</button><button class="btn danger" data-a="del">${icon('trash')} Löschen</button></div>`;
      on(b, {
        read: () => readAloud(plainText(n.text), n.titel || 'Lernzettel'),
        edit: () => { api.close(); noteEditor(n); },
        del: async () => { if (await confirmBox('Lernzettel wirklich löschen?', 'Löschen', true)) { await st.deleteNote(id); api.close(); } }
      });
    },
    onClose: () => stopReading()
  });
}

/* ===== Einzelne Übung ausführen =====
 * ctx: {exam, onDone(ergebnis, info)}
 * ergebnis: 'richtig' | 'hilfe' | 'falsch'
 */
export function runItem(el, item, ctx) {
  const th = st.thema(item.tid);
  const meta = { fach: th ? th.fach.name : '', thema: th ? th.thema.name : '', farbe: th ? th.fach.farbe : 'var(--accent)' };
  el.style.setProperty('--fc', meta.farbe);
  // Gemischtes Üben: Das Thema wird nicht verraten, sonst ist der Ansatz schon klar
  if (ctx.blind && item.art !== 'aufgabe') Object.assign(meta, { fach: 'Gemischt', thema: 'ohne Themenhinweis' });
  const runner = { erklaeren: runErklaeren, skizze: runErklaeren, auffrischen: runAuffrischen, aufgabe: runAufgabe, umstellen: runUmstellen, auswahl: runAuswahl, reihenfolge: runReihenfolge, karte: runKarte, begriff: runBegriff, fehler: runFehler, verwechslung: runVerwechslung, zuordnen: runZuordnen }[item.art];
  if (!runner) { el.innerHTML = empty('Diese Übung kenne ich nicht.'); ctx.onDone('hilfe'); return; }
  runner(el, item, ctx, meta);
}
// Text mit Indizes: F_G wird zu F mit tiefgestelltem G
// Text mit Indizes (F_G) und Formeln wie im Buch: Brüche mit echtem Bruchstrich, Wurzeln, Hochzahlen
export const rich = s => mathText(s);
/* ===== Skizze zur Frage =====
 * Bei Rechenaufgaben steht die Skizze des Themas offen unter der Aufgabe, bei anderen Fragen
 * als „Bild dazu“ zum Aufklappen, damit sie nichts verrät. Ohne Bildunterschrift.
 */
export function frageSkizze(box, item, ctx = {}) {
  if (!box) return;
  const h = item && item.tid ? sk.html(item.tid, true, true) : '';
  if (!h) { box.innerHTML = ''; return; }
  const offen = item.art === 'aufgabe' || (item.art === 'umstellen' && !ctx.blind);
  box.innerHTML = offen ? h : `<details class="disc frage-sk"><summary>${icon('photo')} Bild dazu</summary>${h}</details>`;
  // Bei Rechenaufgaben steht die Skizze wie im Fachbuch über der Aufgabe, sonst darunter
  const item0 = box.parentElement && box.parentElement.querySelector('.sess-item');
  if (item0) { if (offen) item0.before(box); else item0.after(box); }
  sk.fuellen(box);
}

/* ===== Sitzung: mehrere Übungen nacheinander ===== */
export function runSession(items, title, opt = {}) {
  if (!items.length) { toast('Gerade ist nichts dran.'); return; }
  // Eigene Liste: Fehler werden hinten angehängt, die Liste des Aufrufers bleibt, wie sie ist
  items = items.slice();
  // Was nicht saß, kommt am Ende der Runde noch einmal dran, höchstens zweimal. Gewertet wird nur der erste Versuch.
  const nochmal = !opt.single && !opt.blind && !opt.ohneNochmal;
  let nachgeholt = 0;
  const res = [];
  let i = 0;
  const start = Date.now();
  const limit = opt.minutes ? opt.minutes * 60000 : 0;
  let timer = null, zettel = null, zeitUm = false;
  let sheet = null;
  openSheet({
    title, full: true,
    confirmClose: () => i >= items.length || res.length === 0 || confirm('Sitzung beenden? Was du schon gemacht hast, ist gespeichert.'),
    onClose: () => {
      clearInterval(timer); stopSpeaking();
      if (zeitUm) st.verteileRest();
      if (res.length) import('./sicherung.js').then(m => m.anstossen()).catch(() => {});
      if (opt.onClose) opt.onClose(res);
    },
    render(body, api) {
      sheet = api;
      body.innerHTML = `<div class="sess-top">${items.length > 1 ? progress(0) : ''}<div class="sess-info"></div></div><div class="sess-item"></div><div class="sess-sk"></div><div class="schmier-zone">${schmierKnopf()}</div>`;
      zettel = schmierzettel(body);
      show();
    }
  });
  function info() { return $('.sess-info', sheet.body); }
  if (limit) timer = setInterval(() => { const left = Math.max(0, limit - (Date.now() - start)); const n = info(); if (n) n.textContent = (left ? Math.ceil(left / 60000) + ' Min. übrig' : 'Zeit um, die letzte Karte noch') + ' · ' + (i + 1) + ' von ' + items.length; }, 1000);
  function show() {
    const box = $('.sess-item', sheet.body);
    const bar = $('.bar i', sheet.body);
    if (bar) bar.style.width = Math.round(i / items.length * 100) + '%';
    const n = info(); if (n) n.textContent = items.length > 1 && i < items.length ? (items[i]._nochmal ? 'Nochmal, eben saß es noch nicht · ' : '') + (i + 1) + ' von ' + items.length : '';
    zettel.neu(items[i]);
    if (limit && Date.now() - start > limit && i > 0 && i < items.length) zeitUm = true;
    frageSkizze($('.sess-sk', sheet.body), i >= items.length || zeitUm ? null : items[i], opt);
    if (i >= items.length || zeitUm) return summary(box);
    const it = items[i];
    const fresh = box.cloneNode(false);
    box.replaceWith(fresh);
    runItem(fresh, it, {
      blind: opt.blind,
      nextLabel: i < items.length - 1 ? 'Weiter' : 'Fertig',
      onDone: async (erg, info2) => {
        const skip = info2 && info2.skip;
        if (it._nochmal) { if (erg === 'richtig') nachgeholt++; }
        else if (!skip) { await st.recordCard(it, erg); res.push({ it, erg, info: info2 }); }
        if (nochmal && !skip && erg !== 'richtig' && (it._nochmal || 0) < 2 && !zeitUm) items.push(Object.assign({}, it, { _nochmal: (it._nochmal || 0) + 1 }));
        if (!it._nochmal && info2 && info2.ansatz != null) await st.addEvent({ art: 'ansatz', tid: it.tid, ok: !!info2.ansatz });
        i++;
        show();
        $('.sheet-body', sheet.el).scrollTop = 0;
      }
    });
  }
  // Was wackelte: direkt in den passenden Trainer oder zurück zum Prinzip des Themas
  function weiterHTML() {
    const tids = [...new Set(res.filter(r => r.erg !== 'richtig' && r.it.tid).map(r => r.it.tid))].map(t => st.thema(t)).filter(Boolean).slice(0, 3);
    if (!tids.length) return '';
    return `<div class="sum-weiter"><div class="sum-wt">So holst du auf, was gewackelt hat:</div>${tids.map(({ fach: f, thema: t }) => {
      const tr = (t.trainer || []).find(x => !/lernblatt/i.test(x.titel + x.datei)) || (t.trainer || [])[0];
      return tr ? `<button class="btn-big" style="--fc:${f.farbe}" data-a="sumTrainer" data-d="${esc(t.id + '|' + tr.datei)}">${icon('open')}<span><b>Im Trainer üben</b><small>${esc(t.name)}: Schritt für Schritt mit Erklärung</small></span></button>`
        : `<button class="btn-big" style="--fc:${f.farbe}" data-a="sumThema" data-d="${esc(t.id)}">${icon('book')}<span><b>Prinzip nochmal ansehen</b><small>${esc(t.name)}: Bild, Merksatz und Erklärung</small></span></button>`;
    }).join('')}</div>`;
  }
  function summary(box) {
    clearInterval(timer);
    if (opt.single && res.length) { sheet.close(); toast(res[0].erg === 'richtig' ? 'Sitzt. Kommt in ' + INTERVALS[Math.min(5, (st.card(res[0].it.id) || { stufe: 1 }).stufe - 1)] + ' Tagen wieder.' : 'Gespeichert. Kommt bald wieder dran.'); return; }
    const c = k => res.filter(r => r.erg === k).length;
    const q = res.length ? c('richtig') / res.length : 0;
    const an = res.filter(r => r.info && r.info.ansatz != null);
    const lob = q >= 0.8 ? ['Stark gemacht!', 'Sitzt richtig gut!', 'Sauber, wie frisch geschlichtet!'] : q >= 0.5 ? ['Gut dabei!', 'Läuft!', 'Weiter so!'] : ['Dranbleiben lohnt sich!', 'Jeder Versuch zählt!', 'Gut, dass du geübt hast!'];
    box.innerHTML = `<div class="sum"><div class="celebrate ${q >= 0.5 ? 'ok' : 'mid'}">${icon(q >= 0.5 ? 'check' : 'sparkle')}</div><div class="sum-lob">${lob[Math.floor(Math.random() * lob.length)]}</div>
      <div class="sum-big">${c('richtig')} von ${res.length}</div><div class="muted">beim ersten Versuch gewusst</div>
      ${an.length ? `<p class="sum-ansatz">${icon('target')} Ansatz sofort erkannt: <b>${an.filter(r => r.info.ansatz).length} von ${an.length}</b></p>` : ''}
      <div class="sum-row"><span class="pill ok">${c('richtig')} gewusst</span><span class="pill mid">${c('hilfe')} mit Hilfe</span><span class="pill no">${c('falsch')} noch nicht</span></div>
      <p>${q >= 0.8 ? 'Die Karten kommen jetzt in größeren Abständen wieder.' : 'Was noch wackelt, kommt morgen wieder. So setzt es sich fest.'}</p>
      ${nachgeholt ? `<p class="sum-nach">${icon('check')} ${nachgeholt === 1 ? 'Einen Fehler' : nachgeholt + ' Fehler'} direkt in der Runde nachgeholt.</p>` : ''}
      ${weiterHTML()}
      ${zeitUm ? '<p class="muted">Zeit um. Was heute nicht mehr drankam, verteile ich auf die nächsten Tage.</p>' : ''}
      <button class="btn filled" data-a="close">Fertig</button></div>`;
    on(box, {
      close: () => sheet.close(),
      sumTrainer: d => { const [tid, datei] = d.split('|'); sheet.close(); openTrainer(tid, datei); },
      sumThema: tid => { sheet.close(); push(topicPage(tid, 'prinzip')); }
    });
    const bar = $('.bar i', sheet.body); if (bar) bar.style.width = '100%';
  }
  return sheet;
}

export { instantiate } from './uebungen.js';

export { schmierKnopf, schmierzettel };
