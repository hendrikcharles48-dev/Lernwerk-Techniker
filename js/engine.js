// Trainer-Engine: Themenseite und alle Übungsarten. Eingebaute und eingefügte Inhalte laufen hier gleich.
import { esc, fmtNum, markdown, plainText, shuffle, dayStr, dayShort, norm } from './util.js';
import { fml, fmlWith, nameHTML, parseEq, keyOf, calc, checkSolved, checkStep, varNames, speakFml } from './formula.js';
import { checkNumber, showValue } from './check.js';
import * as st from './store.js';
import { $, $$, icon, row, list, seg, sw, empty, on, push, openSheet, toast, copyText, confirmBox, progress, fachIcon, hinweisTabellenbuch } from './ui.js';
import { speak, stopSpeaking, canSpeak, readAloud, stopReading } from './speech.js';
import { INTERVALS } from './srs.js';
import { prefs } from './db.js';
import { editorHTML, attachEditor } from './mathedit.js';

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
      if (!cur) cur = st.hasTopicContent(tid) ? 'prinzip' : (st.notesFor(tid).length ? 'zettel' : 'prinzip');
      st.setPlace({ art: 'thema', tid, titel: t.name, tab: cur });
      const sk = st.staerke(tid);
      const tc = st.card('t:' + tid);
      let h = `<div class="topic-head" style="--fc:${f.farbe}">
        <div class="chips"><span class="chip chip-ic" style="background:${f.farbe}">${icon(fachIcon(f))}${esc(f.kurz || f.name)}</span>${(f.module || []).map(m => `<span class="chip ghost">${esc(m === 'Ü' ? 'übergreifend' : m)}</span>`).join('')}${T.modul && !(f.module || []).includes(T.modul) ? `<span class="chip ghost">${esc(T.modul)}</span>` : ''}</div>
        <div class="zst">${seg('zst', ZUSTAENDE, st.zustand(tid))}</div>${staerkeHTML(sk)}`;
      if (t.trainer && t.trainer.length) {
        h += `<div class="trainer-btns">${t.trainer.map(x => `<button class="btn-big" data-a="trainer" data-d="${esc(x.datei)}" style="--fc:${f.farbe}">${icon('open')}<span><b>${esc(x.titel)}</b><small>Trainer${tc ? ' · ' + stufeText(tc) : ''}</small></span></button>`).join('')}</div>`;
      }
      h += `</div><div class="seg-scroll">${seg('tab', TABS.map(([v, l]) => [v, l + countFor(v, T, items, tid)]), cur)}</div><div class="tab-body"></div>`;
      body.innerHTML = h;
      const tb = $('.tab-body', body);
      const draw = () => { st.setPlace({ art: 'thema', tid, titel: t.name, tab: cur }); renderTab(tb, cur, tid, T, items, f); };
      on(body, {
        'seg:zst': v => { st.setZustand(tid, v); toast({ kommt: 'Kommt noch.', aktuell: 'Im Unterricht. Kommt bei Unterricht dran.', fertig: 'Abgeschlossen. Kommt bei Alles wiederholen dran.' }[v]); },
        trainer: d => openTrainer(tid, d),
        'seg:tab': v => { cur = v; draw(); }
      });
      draw();
    }
  };
}
function countFor(v, T, items, tid) {
  const n = { prinzip: 0, bausteine: 0, ueben: items.filter(i => ['aufgabe', 'umstellen', 'auswahl', 'reihenfolge'].includes(i.art)).length, karten: items.filter(i => i.art === 'karte' || i.art === 'begriff').length, schnellweg: T.schnellwege.length, zettel: st.notesFor(tid).length, fotos: st.photosFor(tid).length }[v];
  return n ? ' ' + n : '';
}

function renderTab(el, tab, tid, T, items, f) {
  const color = f.farbe;
  let h = '';
  if (tab === 'prinzip' && st.isIntroOnly(tid) && st.status(tid) === 'geplant') h += `<div class="fb info intro-hint"><b>Einführung.</b> Das Thema ist noch nicht dran. Hier stehen schon die Grundlagen. Wenn es im Unterricht kommt, ergänzt du es über Einfügen.</div>`;
  if (tab === 'prinzip') {
    const nichts = !T.anker.length && !T.begriffe.length && !T.merksaetze.length && !T.prinzip.length && !T.notizen.length;
    if (nichts) h += emptyContent(tid);
    T.anker.forEach(a => { h += `<div class="card anchor"><div class="card-k">Bild aus deiner Welt</div><p>${esc(a)}</p></div>`; });
    if (T.begriffe.length) h += `<div class="sec-h">Fachbegriffe</div>` + list(T.begriffe.map(b => row({ titleHTML: `<b>${esc(b.begriff)}</b>`, sub: b.erklaerung })));
    T.merksaetze.forEach(m => { h += `<div class="card merk" style="--fc:${color}"><div class="card-k">Merksatz</div><p>${esc(m)}</p></div>`; });
    if (T.prinzip.length) h += `<div class="sec-h">So funktioniert es</div><div class="card prose">${T.prinzip.map(p => markdown(p)).join('')}</div>`;
    if (T.notizen.length) h += `<div class="sec-h">Notizen</div>` + list(T.notizen.map(n => row({ title: n.schluessel, sub: n.text })));
    if (!nichts) h += `<div class="btn-row"><button class="btn" data-a="folge">${icon('ear')} Als Folge hören</button></div>`;
    if (T.quellen.length) h += `<p class="src">Quelle: ${T.quellen.map(esc).join(' ')}</p>`;
  }
  if (tab === 'bausteine') {
    if (T.bausteine.length) h += `<div class="sec-h">So gehst du vor</div><ol class="steps-list">${T.bausteine.map(b => `<li>${esc(b)}</li>`).join('')}</ol>`;
    if (T.fehler.length) h += `<div class="sec-h">Typische Fehler</div>` + list(T.fehler.map(x => row({ title: x.fehler, sub: x.achtung })));
    if (T.formeln.length) h += `<div class="sec-h">Formeln</div>` + T.formeln.map(formelCard).join('');
    if (!h) h = empty('Noch keine Bausteine.', 'Bausteine zerlegen eine Aufgabe in gegeben, gesucht, Regel und nächsten Schritt. Hol sie dir über Einfügen aus dem Chat.');
  }
  if (tab === 'ueben') {
    const ex = items.filter(i => ['aufgabe', 'umstellen', 'auswahl', 'reihenfolge'].includes(i.art));
    if (!ex.length) h = empty('Noch keine Übungen.', 'Aufgaben kommen über einen Lernwerk-Block mit Aufgabe-Zeilen. Der alte Trainer oben funktioniert wie gewohnt.');
    else {
      h += `<div class="btn-row"><button class="btn filled" data-a="mix">${icon('bolt')} Gemischt üben</button></div>`;
      const grp = (art, title) => { const g = ex.filter(i => i.art === art); if (!g.length) return ''; return `<div class="sec-h">${title}</div>` + list(g.map(i => row({ a: 'item', d: i.id, titleHTML: itemHTML(i), subHTML: esc(stufeText(st.card(i.id))) }))); };
      h += grp('aufgabe', 'Aufgaben') + grp('umstellen', 'Formeln umstellen') + grp('auswahl', 'Auswahlfragen') + grp('reihenfolge', 'Reihenfolge');
    }
  }
  if (tab === 'karten') {
    const ks = items.filter(i => i.art === 'karte' || i.art === 'begriff');
    if (!ks.length) h = empty('Noch keine Karten.', 'Karten kommen über Karte-Zeilen und Begriff-Zeilen im Lernwerk-Block.');
    else {
      h += `<div class="btn-row"><button class="btn filled" data-a="karten">${icon('cards')} Karten üben</button></div>`;
      h += list(ks.map(k => row({ a: 'flip', d: k.id, title: k.frage, subHTML: `<span class="hidden-ans" data-ans="${esc(k.id)}">Antippen zum Aufdecken</span>`, detail: stufeText(st.card(k.id)), chev: false })));
    }
  }
  if (tab === 'schnellweg') {
    if (!T.schnellwege.length) h = empty('Noch kein Schnellweg.', 'Ein Schnellweg ist ein kürzerer Prüfungsweg mit Erklärung, warum er funktioniert.');
    T.schnellwege.forEach(s => { h += `<div class="card fast" style="--fc:${color}"><div class="card-k">${icon('bolt')} Schnellweg</div><div class="prose">${markdown(s)}</div></div>`; });
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
  if (tab === 'fotos') loadThumbs(el);
  on(el, {
      item: id => { const it = st.topicItems(tid).find(i => i.id === id); if (it) runSession([it], itemTitle(it), { single: true }); },
      mix: () => { const its = st.topicItems(tid).filter(i => ['aufgabe', 'umstellen', 'auswahl', 'reihenfolge'].includes(i.art)); runSession(sortForPractice(its).slice(0, 8), 'Gemischt üben'); },
      karten: () => { const its = st.topicItems(tid).filter(i => i.art === 'karte' || i.art === 'begriff'); runSession(sortForPractice(its), 'Karten'); },
      flip: (id, b) => { const it = st.topicItems(tid).find(i => i.id === id); const s = $('.hidden-ans', b); if (it && s) { s.textContent = it.antwort; s.classList.add('shown'); } },
      newnote: () => noteEditor({ tid }),
      note: id => noteReader(id),
      photo: id => photoViewer(id),
      trainer: d => openTrainer(tid, d),
      // Podcast-Folge zum Thema: Lena fragt, Tom erklärt. Der Hörmodus zeigt den Player.
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
  if (i.art === 'fehler') return i.err.aufgabe || i.err.fehlerart;
  return i.frage || '';
}
export function sortForPractice(items) {
  const today = dayStr();
  const k = i => { const c = st.card(i.id); return !c ? 1 : c.faellig <= today ? 0 : 2; };
  return shuffle(items).sort((a, b) => k(a) - k(b));
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

/* ===== Aufgabe mit Zahlen füllen ===== */
const roundStep = (v, s) => Number((Math.round(v / s) * s).toFixed(6));
export function instantiate(a) {
  const vals = {};
  // Feste Werte aus Gegeben-Zeilen, zum Beispiel "R = 220 Ω"
  for (const g of a.gegeben) {
    const re = /([A-Za-zΑ-Ωα-ω][A-Za-z0-9_Α-Ωα-ω]*)\s*=\s*([-−]?\d+(?:[.,]\d+)?)/g;
    let m;
    while ((m = re.exec(g))) vals[keyOf(m[1])] = parseFloat(m[2].replace(',', '.').replace('−', '-'));
  }
  const random = a.variablen.length > 0 && !!a.rechnung;
  if (random) {
    for (let tries = 0; tries < 40; tries++) {
      for (const v of a.variablen) {
        const n = Math.floor((v.bis - v.von) / v.schritt + 1e-9);
        vals[keyOf(v.name)] = roundStep(v.von + Math.floor(Math.random() * (n + 1)) * v.schritt, v.schritt);
      }
      const r = calc(a.rechnung, vals);
      if (r != null && isFinite(r) && r !== 0) break;
    }
  }
  // Nach dem Einsetzen wird aus 10^3 eine echte Hochzahl 10³
  const SUP = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', '-': '⁻', '−': '⁻' };
  const fill = s => String(s || '').replace(/\{([^}]+)\}/g, (m, n) => (keyOf(n.trim()) in vals ? fmtNum(vals[keyOf(n.trim())]) : m))
    .replace(/\^([−-]?\d+)(?![\d,])/g, (m, e) => [...e].map(c => SUP[c]).join(''));
  const steps = a.schritte.map(s => {
    const e = s.ergebnis;
    const o = { was: fill(s.was), einheit: s.einheit, tipp: fill(s.tipp), typ: 'plan' };
    if (!e) return o;
    if (e.typ === 'gleichung') { o.typ = 'gleichung'; o.text = e.text; }
    else if (e.typ === 'ausdruck') { const v = calc(e.text, vals); if (v != null) { o.typ = 'zahl'; o.wert = v; o.rechnung = e.text; } }
    else if (e.typ === 'zahl' && !random) { o.typ = 'zahl'; o.wert = e.zahl; }
    return o;
  });
  let final = null;
  if (random) final = { wert: calc(a.rechnung, vals), einheit: (a.ergebnis && a.ergebnis.einheit) || '', rechnung: a.rechnung };
  else if (a.ergebnis) {
    const w = a.ergebnis.wert;
    const v = w.typ === 'zahl' ? w.zahl : w.typ === 'ausdruck' ? calc(w.text, vals) : null;
    if (v != null) final = { wert: v, einheit: a.ergebnis.einheit || '', rechnung: w.typ === 'ausdruck' ? w.text : null };
  }
  const lastNum = [...steps].reverse().find(s => s.typ === 'zahl');
  if (final && lastNum && Math.abs(lastNum.wert - final.wert) <= 1e-9 * Math.max(1, Math.abs(final.wert))) { if (!final.einheit) final.einheit = lastNum.einheit; final = null; if (!lastNum.einheit && a.ergebnis) lastNum.einheit = a.ergebnis.einheit; }
  if (final && !final.einheit && lastNum) final.einheit = lastNum.einheit;
  const mc = q => q && Object.assign({}, q, { frage: q.frage ? fill(q.frage) : q.frage, richtig: fill(q.richtig), falsch: q.falsch.map(fill) });
  return { text: fill(a.text), gegeben: a.gegeben.map(fill), gesucht: a.gesucht.map(fill), tipps: a.tipps.map(fill), steps, final, vals, random,
    ansatz: mc(a.ansatz), warum: mc(a.warum), kontrolle: mc(a.kontrolle), signal: fill(a.signal || '') };
}

/* ===== Eingabefeld für Formeln mit Tasten ===== */
// Formel-Eingabe mit eigener Tastatur: echter Bruch, Wurzel, Hochzahl, Funktionen
function fmlInput(vars, placeholder) {
  return `<div class="fml-in">${editorHTML(vars, placeholder)}</div>`;
}
function bindFmlInput(root) {
  const host = $('.fml-in .me', root);
  if (!host || host._me) return;
  host._me = true;
  attachEditor(host, $('.fml-in .me-pad', root));
}
// Zahlenfeld mit Taschenrechner-Tasten: Minus, Bruch, Wurzel, Hochzahl, sin, cos, tan
function numInput(unit) {
  return `<div class="fml-in calc-in">${editorHTML([], 'Zahl oder Rechnung', { calc: true, unit })}</div>`;
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
  const runner = { auffrischen: runAuffrischen, aufgabe: runAufgabe, umstellen: runUmstellen, auswahl: runAuswahl, reihenfolge: runReihenfolge, karte: runKarte, begriff: runKarte, fehler: runFehler }[item.art];
  if (!runner) { el.innerHTML = empty('Diese Übung kenne ich nicht.'); ctx.onDone('hilfe'); return; }
  runner(el, item, ctx, meta);
}
// Text mit Indizes: F_G wird zu F mit tiefgestelltem G
export const rich = s => esc(s).replace(/(^|[^A-Za-z0-9])([A-Za-zΑ-Ωα-ωΔ])_([A-Za-z0-9]+)/g, '$1$2<sub>$3</sub>');
const blindLine = `<div class="ex-ctx"><span class="dot"></span>Gemischt · Das Thema erfährst du nach deiner Wahl</div>`;
const ctxLine = meta => `<div class="ex-ctx"><span class="dot" style="background:${meta.farbe}"></span>${esc(meta.fach)} · ${esc(meta.thema)}</div>`;

function runAuffrischen(el, item, ctx, meta) {
  const T = st.topic(item.tid);
  const th = st.thema(item.tid);
  const m = T.merksaetze.slice(0, 3), sw2 = T.schnellwege.slice(0, 2);
  el.innerHTML = `<div class="ex-ctx"><span class="dot" style="background:${th ? th.fach.farbe : 'var(--accent)'}"></span>Kurz auffrischen · ${esc(th ? th.thema.name : '')}</div>
    <div class="card"><div class="card-k">Dieses Thema sitzt noch nicht sicher. Lies es einmal laut.</div>${m.map(x => `<div class="merk-line">${rich(x)}</div>`).join('')}${sw2.map(x => `<div class="fb info"><b>Schnellweg.</b> ${rich(x)}</div>`).join('')}${!m.length && !sw2.length && T.bausteine.length ? `<ol>${T.bausteine.map(x => `<li>${rich(x)}</li>`).join('')}</ol>` : ''}</div>
    <div class="btn-col"><button class="btn filled" data-a="ok">${ctx.nextLabel || 'Weiter'}</button></div>`;
  on(el, { ok: () => ctx.onDone('hilfe', { skip: true }) });
}

async function logError(meta, item, x) {
  if (x.fehlerart === 'Schreibweise' || !x.fehlerart) return;
  await st.addError({ fach: meta.fach, thema: meta.thema, tid: item.tid, aufgabe: x.aufgabe, eingabe: x.eingabe, richtig: x.richtig, fehlerart: x.fehlerart, quelle: 'app', notiz: x.meldung || '' });
}

function runAufgabe(el, item, ctx, meta) {
  const A = instantiate(item.aufgabe);
  const topicT = st.topic(item.tid);
  const steps = A.steps.slice();
  if (A.final) steps.push({ was: 'Ergebnis' + (A.gesucht.length ? ': ' + A.gesucht.join(', ') : ''), typ: 'zahl', wert: A.final.wert, einheit: A.final.einheit, rechnung: A.final.rechnung, final: true });
  if (ctx.exam) { runExamAufgabe(el, item, ctx, meta, A, steps); return; }
  let i = 0, tries = 0, used = false, shown = false, first = 0;
  const done = [];
  let tipOpen = false, solOpen = false, fb = null;
  // Ansatz zuerst: erkennen, begründen, am Ende das Ergebnis prüfen
  const T0 = { ansatz: A.ansatz, warum: A.warum, kontrolle: A.kontrolle, signal: A.signal };
  const aufbau = aufbauHTML(passendeFormeln(topicT, item.aufgabe));
  let phase = T0.ansatz && !ctx.twinOf ? 'ansatz' : 'steps';
  let opts = null, picked = null, ansatzFirst = null, note = '', kontrolleFirst = null;
  const result = () => (shown ? 'falsch' : used ? 'hilfe' : 'richtig');
  // Hilfe wird weniger: geführt mit Schritten und Rechenweg im Tipp, dann nur Schritte, frei nur mit Endergebnis.
  // Der Tipp bleibt immer zu, bis man auf Tipp drückt.
  const target = [...steps].reverse().find(s => s.typ === 'zahl' || s.typ === 'gleichung');
  const level = ctx.twinOf ? 3 : (ctx.level || st.aufgabenStufe(item.tid));
  let mode = level === 3 && target ? 'frei' : 'schritte', freiOk = false;

  function draw() {
    const s = steps[i];
    if (!s && phase === 'steps') phase = T0.kontrolle && !ctx.twinOf ? 'kontrolle' : 'done';
    const hide = ctx.blind && (phase === 'ansatz' || (!T0.ansatz && phase === 'steps'));
    let h = (hide ? blindLine : ctxLine(meta)) + `<div class="ex-task">${rich(A.text)}</div>`;
    if (A.gegeben.length || A.gesucht.length) h += `<div class="gg">${A.gegeben.length ? `<div><div class="gg-k">Gegeben</div>${A.gegeben.map(g => `<div>${rich(g)}</div>`).join('')}</div>` : ''}${A.gesucht.length ? `<div><div class="gg-k">Gesucht</div>${A.gesucht.map(g => `<div>${rich(g)}</div>`).join('')}</div>` : ''}</div>`;
    if (done.length) h += `<div class="done-steps">${done.map(d => `<div class="ds"><span class="ds-n">${d.n}</span><span class="ds-t">${rich(d.was)}</span><span class="ds-v">${d.html}</span></div>`).join('')}</div>`;
    if (phase === 'ansatz' || phase === 'warum' || phase === 'kontrolle') {
      const q = mcOf();
      if (!opts) opts = shuffle([q.richtig, ...q.falsch]);
      const head = { ansatz: ['Erst erkennen', 'Welcher Ansatz passt?'], warum: ['Kurz begründen', 'Warum passt dieser Ansatz?'], kontrolle: ['Zum Schluss prüfen', q.frage] }[phase];
      h += note + `<div class="step-box"><div class="step-n">${head[0]}</div><div class="step-q">${rich(head[1])}</div><div class="mc">${opts.map((o, k) => `<button class="mc-o ${picked && picked.has(k) ? (o === q.richtig ? 'ok' : 'no') : ''}" data-a="pick" data-d="${k}">${rich(o)}</button>`).join('')}</div>${fb || ''}</div>`;
      el.innerHTML = h;
      return;
    }
    if (!s) {
      const twin = (used || shown) && A.random;
      h += note + `<div class="fb good"><b>Geschafft.</b> ${freiOk ? (tries ? 'Frei gelöst, im zweiten Anlauf.' : 'Frei gelöst, ohne Zwischenschritte. Stark.') : first + ' von ' + steps.length + ' Schritten beim ersten Versuch richtig.'}${T0.ansatz && !ctx.twinOf ? (ansatzFirst ? ' Den Ansatz hast du sofort erkannt.' : ' Den Ansatz hast du im zweiten Anlauf gefunden.') : ''}</div>`;
      if (topicT.schnellwege.length) h += `<details class="disc"><summary>${icon('bolt')} Schnellweg für die Prüfung</summary><div class="prose">${topicT.schnellwege.map(markdown).join('')}</div></details>`;
      if (twin) h += `<p class="muted">Jetzt dieselbe Aufgabe mit neuen Zahlen, einmal ganz allein. So setzt sich der Weg fest.</p>`;
      h += `<div class="btn-col">${A.random ? `<button class="btn${twin ? ' filled' : ''}" data-a="again">${twin ? 'Zwillingsaufgabe: neue Zahlen' : 'Neue Zahlen'}</button>` : ''}<button class="btn${twin ? '' : ' filled'}" data-a="fertig">${ctx.nextLabel || 'Fertig'}</button></div>`;
      el.innerHTML = h;
      return;
    }
    if (mode === 'frei') {
      h += note + `<div class="step-box"><div class="step-n">Frei rechnen · nur das Ergebnis</div><div class="step-q">${rich(A.gesucht.length ? 'Gesucht: ' + A.gesucht.join(', ') : target.was)}</div>`;
      h += (target.typ === 'zahl' ? numInput(target.einheit) : fmlInput([...varNames(parseEqSafe(target.text)).values()], ''));
      h += `<div class="act"><button class="btn filled" data-a="checkFrei">Prüfen</button><button class="btn" data-a="schritte">Schritte zeigen</button></div>${fb || ''}</div>`;
      el.innerHTML = h;
      bindFmlInput(el);
      const fi = $('.inp', el);
      if (fi) fi.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); checkFrei(); } });
      return;
    }
    if (level === 1 && i === 0 && !done.length) h += `<p class="muted small lvl-hint">Geführt: Kommst du nicht weiter, drück auf Tipp. Dort steht, wie du an den Schritt herangehst.</p>`;
    h += note + (level < 3 || used ? aufbau : '') + `<div class="step-box"><div class="step-n">${level === 1 ? 'Geführt · ' : ''}Schritt ${i + 1} von ${steps.length}</div><div class="step-q">${rich(s.was || 'Nächster Schritt')}</div>`;
    if (s.typ === 'gleichung') {
      const names = [...varNames(parseEqSafe(s.text)).values()];
      h += fmlInput(names, 'Gleichung, zum Beispiel ' + (names[0] || 'x') + ' = …');
    } else if (s.typ === 'zahl') h += numInput(s.einheit);
    else h += `<p class="muted">Diesen Schritt prüft die App nicht. Mach ihn auf deinem Blatt und tippe dann auf Erledigt.</p>`;
    h += `<div class="act">${s.typ === 'plan' ? `<button class="btn filled" data-a="plan">Erledigt</button>` : `<button class="btn filled" data-a="check">Prüfen</button>`}
      <button class="btn" data-a="tip">${tipOpen ? 'Tipp zu' : 'Tipp'}</button><button class="btn" data-a="sol">${solOpen ? 'Lösung zu' : 'Lösung'}</button></div>`;
    if (fb) h += fb;
    if (tipOpen) h += `<div class="fb info tipbox"><b>Tipp.</b> ${tipText()}</div>`;
    if (solOpen) h += `<div class="fb info"><b>Lösung.</b> ${solText(s)}<div class="btn-row"><button class="btn" data-a="take">Übernehmen und weiter</button></div></div>`;
    h += '</div>';
    el.innerHTML = h;
    bindFmlInput(el);
    const inp = $('.inp', el);
    if (inp) { inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); check(); } }); if (!fb && !tipOpen && !solOpen) setTimeout(() => { try { inp.focus({ preventScroll: true }); } catch (e) { /* alt */ } }, 50); }
  }
  function checkFrei() {
    const inp = $('.inp', el);
    const v = inp ? inp.value : '';
    if (!v.trim()) { fb = `<div class="fb bad">Gib zuerst dein Ergebnis ein.</div>`; draw(); return; }
    let ok, msg = '', fehlerart = '', val = null;
    if (target.typ === 'zahl') { const c = checkNumber(v, target.wert, target.einheit); ok = c.status === 'ok'; msg = c.msg; fehlerart = c.fehlerart; val = c.value; if (c.status !== 'ok' && c.status !== 'wrong') { fb = `<div class="fb bad">${esc(c.msg)}</div>`; draw(); return; } }
    else { const r = checkSolved(target.text, (parseEqSafe(target.text).l || {}).n, target.text, v); ok = r.ok; msg = r.msg; fehlerart = r.fehlerart || 'Umstellen'; }
    if (ok) {
      freiOk = true;
      done.push({ n: '✓', was: 'Ergebnis', html: target.typ === 'zahl' ? esc(showValue(val, target.einheit)) : fml(v) });
      i = steps.length; fb = null; note = '';
      draw();
      return;
    }
    tries++; used = true;
    if (tries === 1) logError(meta, item, { aufgabe: A.text, eingabe: v + (target.typ === 'zahl' && target.einheit ? ' ' + target.einheit : ''), richtig: target.typ === 'zahl' ? showValue(target.wert, target.einheit) : target.text, fehlerart, meldung: msg });
    fb = `<div class="fb bad"><b>Noch nicht.</b> ${esc(msg || 'Das Ergebnis stimmt noch nicht.')} Versuch es noch einmal oder lass dir die Schritte zeigen.</div>`;
    draw();
    const inp2 = $('.inp', el); if (inp2) inp2.value = v;
  }
  function mcOf() { return phase === 'ansatz' ? T0.ansatz : phase === 'warum' ? T0.warum : T0.kontrolle; }
  function pick(k) {
    const q = mcOf(), o = opts[+k];
    picked = picked || new Set();
    picked.add(+k);
    if (o === q.richtig) {
      if (phase === 'ansatz' && ansatzFirst == null) ansatzFirst = true;
      if (phase === 'kontrolle' && kontrolleFirst == null) kontrolleFirst = true;
      note = phase === 'kontrolle' ? `<div class="fb good"><b>Passt.</b> Das Ergebnis ist plausibel.</div>`
        : phase === 'ansatz' ? `<div class="fb good"><b>Richtig erkannt: ${rich(q.richtig)}.</b> ${T0.signal ? rich(T0.signal) : ''}</div>` : `<div class="fb good"><b>Genau.</b> ${rich(q.richtig)}</div>`;
      phase = phase === 'ansatz' && T0.warum ? 'warum' : phase === 'kontrolle' ? 'done' : 'steps';
      opts = null; picked = null; fb = null;
      draw();
      return;
    }
    used = true;
    if (phase === 'ansatz' && ansatzFirst == null) { ansatzFirst = false; logError(meta, item, { aufgabe: A.text, eingabe: 'Ansatz: ' + o, richtig: q.richtig, fehlerart: 'Falscher Ansatz', meldung: T0.signal || '' }); }
    if (phase === 'kontrolle' && kontrolleFirst == null) { kontrolleFirst = false; logError(meta, item, { aufgabe: A.text, eingabe: 'Kontrolle: ' + o, richtig: q.richtig, fehlerart: 'Ergebnis nicht geprüft', meldung: q.frage }); }
    fb = phase === 'ansatz' ? `<div class="fb bad"><b>Passt hier nicht.</b> ${T0.signal ? 'Achte auf das Signal in der Aufgabe: ' + rich(T0.signal) : 'Lies noch einmal, was gegeben ist und was gesucht wird.'}</div>`
      : phase === 'warum' ? `<div class="fb bad"><b>Nicht ganz.</b> Schau, welche Größen gegeben sind und wie sie mit der gesuchten zusammenhängen.</div>`
      : `<div class="fb bad"><b>Noch nicht.</b> Vergleich mit deinem Ergebnis: Stimmen Größenordnung, Einheit und Vorzeichen?</div>`;
    draw();
  }
  function tipText() {
    const cur = steps[i];
    const parts = [];
    // So gehst du heran: erst der Tipp zum Schritt, sonst der Arbeitsplan des Themas
    if (cur && cur.tipp) parts.push('<b>So gehst du heran:</b> ' + rich(cur.tipp));
    else if (topicT.bausteine.length && !A.tipps.length) parts.push('<b>So gehst du heran:</b> ' + esc(topicT.bausteine[Math.min(i, topicT.bausteine.length - 1)]));
    if (A.tipps.length) parts.push(A.tipps.map(esc).join(' '));
    // Die Rechnung mit eingesetzten Zahlen, ausrechnen musst du selbst
    if (cur && cur.rechnung && level < 3) parts.push('<b>Setz ein:</b> ' + fmlWith(cur.rechnung, A.vals));
    if (!parts.length) {
      const f = topicT.formeln.slice(0, 3).map(x => fml(x.formel)).join(', ');
      parts.push(f ? 'Passende Formeln: ' + f : 'Was ist gegeben, was ist gesucht, und welche Regel verbindet beides?');
    }
    return parts.join('<br>');
  }
  // Welcher eingesetzte Wert mit falschem Vorzeichen ergibt genau die Eingabe?
  function signFlip(expr, got) {
    if (got == null || !isFinite(got)) return null;
    for (const [k, x] of Object.entries(A.vals || {})) {
      if (!x) continue;
      const alt = calc(expr, Object.assign({}, A.vals, { [k]: -x }));
      if (alt != null && Math.abs(alt - got) <= 1e-6 * Math.max(1, Math.abs(got)) && Math.abs(calc(expr, A.vals) - alt) > 1e-9) return x;
    }
    return null;
  }
  function solText(s) {
    if (s.typ === 'gleichung') return fml(s.text);
    if (s.typ === 'zahl') return (s.rechnung ? fml(s.rechnung) + ' = ' + fmlWith(s.rechnung, A.vals) + ' = ' : '') + '<b>' + esc(showValue(s.wert, s.einheit)) + '</b>';
    return esc(s.was);
  }
  function accept(html, ok) {
    const s = steps[i];
    done.push({ n: i + 1, was: s.was, html });
    if (ok && tries === 0) first++;
    i++; tries = 0; tipOpen = false; solOpen = false; fb = null;
    if (!/du warst schon weiter/.test(note)) note = '';
    draw();
  }
  function check() {
    const s = steps[i];
    const inp = $('.inp', el);
    const v = inp ? inp.value : '';
    if (!v.trim()) { fb = `<div class="fb bad">Gib zuerst etwas ein.</div>`; draw(); return; }
    let r;
    if (s.typ === 'gleichung') {
      const target = (parseEqSafe(s.text).l || {}).n;
      r = checkSolved(s.text, target, s.text, v);
      if (r.ok) return accept(fml(v), true);
      r = { msg: r.msg, fehlerart: r.fehlerart };
    } else {
      const c = checkNumber(v, s.wert, s.einheit);
      if (c.status === 'ok') return accept(esc(showValue(c.value, s.einheit)) + (c.msg ? ' <span class="muted">' + esc(c.msg) + '</span>' : ''), true);
      // Schon weiter gerechnet? Ein richtiger Wert eines späteren Schritts zählt, die Schritte dazwischen werden ergänzt.
      if (c.status === 'wrong') for (let j = i + 1; j < steps.length; j++) {
        const sj = steps[j];
        if (sj.typ !== 'zahl' || checkNumber(v, sj.wert, sj.einheit).status !== 'ok') continue;
        while (i < j) { done.push({ n: i + 1, was: steps[i].was, html: solText(steps[i]) + ' <span class="muted">(von dir übersprungen)</span>' }); if (tries === 0) first++; i++; }
        note = `<div class="fb good"><b>Richtig, du warst schon weiter.</b> Das ist schon das Ergebnis von „${rich(sj.was)}“. Die Schritte dazwischen habe ich ergänzt.</div>`;
        return accept(esc(showValue(sj.wert, sj.einheit)), true);
      }
      r = { msg: c.msg + (c.status === 'wrong' && steps.length > 1 && i < steps.length - 1 ? ' Gefragt ist hier nur der Zwischenschritt: ' + s.was + '.' : ''), fehlerart: c.fehlerart, empty: c.status !== 'wrong' };
      // Nur ein Vorzeichen vertauscht? Dann genau das sagen. Die Form der Rechnung ist egal, es zählt der Wert.
      const flip = c.status === 'wrong' && s.rechnung ? signFlip(s.rechnung, c.value) : null;
      if (flip != null) r = { msg: `Fast. Deine Rechnung ist richtig aufgebaut, nur ein Vorzeichen stimmt nicht. Überleg bei der ${fmtNum(flip)}, ob sie dazukommt oder abgeht.`, fehlerart: 'Vorzeichen' };
    }
    if (!r.empty) {
      tries++; used = true;
      if (tries === 1) logError(meta, item, { aufgabe: A.text + ' Schritt ' + (i + 1) + ': ' + s.was, eingabe: v + (s.einheit && s.typ === 'zahl' ? ' ' + s.einheit : ''), richtig: s.typ === 'zahl' ? showValue(s.wert, s.einheit) : s.text, fehlerart: r.fehlerart, meldung: r.msg });
    }
    const q = claudeFrage({ fach: meta.fach, thema: meta.thema, aufgabe: A.text, eingabe: v, schritt: i + 1, was: s.was, meldung: r.msg });
    fb = `<div class="fb bad"><b>${r.empty ? 'Hm.' : 'Noch nicht.'}</b> ${esc(r.msg)}${r.empty ? '' : `<div class="btn-row"><button class="btn small" data-a="claude" data-d="${esc(q)}">${icon('claude')} Frag Claude</button></div>`}</div>`;
    draw();
    const inp2 = $('.inp', el); if (inp2) inp2.value = v;
  }
  on(el, {
    check, pick, checkFrei, plan: () => accept('erledigt', true),
    schritte: () => { mode = 'schritte'; used = true; fb = null; draw(); },
    tip: () => { tipOpen = !tipOpen; if (tipOpen) used = true; draw(); if (tipOpen) { const tb = $('.tipbox', el); if (tb) tb.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } },
    sol: () => { solOpen = !solOpen; draw(); },
    take: () => { shown = true; const s = steps[i]; accept(solText(s) + ' <span class="muted">(Lösung angesehen)</span>', false); },
    claude: d => askClaude(d),
    // Zwillingsaufgabe: Für die Wiederholung zählt der erste Durchgang
    again: () => { const f = el.cloneNode(false); el.replaceWith(f); runAufgabe(f, item, Object.assign({}, ctx, { twinOf: ctx.twinOf || result(), ansatzOf: ctx.twinOf ? ctx.ansatzOf : ansatzFirst }), meta); },
    fertig: () => ctx.onDone(ctx.twinOf || result(), { first, total: steps.length, ansatz: ctx.twinOf ? ctx.ansatzOf : T0.ansatz ? ansatzFirst : null })
  });
  draw();
}
const parseEqSafe = s => { try { return parseEq(s); } catch (e) { return { l: null, r: null }; } };

function runExamAufgabe(el, item, ctx, meta, A, steps) {
  const target = [...steps].reverse().find(s => s.typ === 'zahl' || s.typ === 'gleichung');
  let h = (ctx.blind ? blindLine.replace('Das Thema erfährst du nach deiner Wahl', 'Probeklausur ohne Themenhinweis') : ctxLine(meta)) + `<div class="ex-task">${rich(A.text)}</div>`;
  if (A.gegeben.length || A.gesucht.length) h += `<div class="gg">${A.gegeben.length ? `<div><div class="gg-k">Gegeben</div>${A.gegeben.map(g => `<div>${rich(g)}</div>`).join('')}</div>` : ''}${A.gesucht.length ? `<div><div class="gg-k">Gesucht</div>${A.gesucht.map(g => `<div>${rich(g)}</div>`).join('')}</div>` : ''}</div>`;
  if (!target) { el.innerHTML = h + `<div class="btn-col"><button class="btn filled" data-a="next">Weiter</button></div>`; on(el, { next: () => ctx.onDone('hilfe', { skip: true }) }); return; }
  h += `<div class="step-box"><div class="step-q">Dein Endergebnis</div>${target.typ === 'zahl' ? numInput(target.einheit) : fmlInput([...varNames(parseEqSafe(target.text)).values()], '')}<div class="act"><button class="btn filled" data-a="next">Abgeben und weiter</button></div></div>`;
  el.innerHTML = h;
  bindFmlInput(el);
  on(el, {
    next: () => {
      const v = $('.inp', el).value;
      let ok, msg = '', fehlerart = '';
      if (target.typ === 'zahl') { const c = checkNumber(v, target.wert, target.einheit); ok = c.status === 'ok'; msg = c.msg; fehlerart = c.fehlerart || (v.trim() ? 'Rechenweg' : 'Nicht bearbeitet'); }
      else { const r = checkSolved(target.text, (parseEqSafe(target.text).l || {}).n, target.text, v); ok = r.ok; msg = r.msg; fehlerart = r.fehlerart || 'Umstellen'; }
      const richtig = target.typ === 'zahl' ? showValue(target.wert, target.einheit) : target.text;
      if (!ok) logError(meta, item, { aufgabe: A.text, eingabe: v || '(leer)', richtig, fehlerart, meldung: msg });
      ctx.onDone(ok ? 'richtig' : 'falsch', { eingabe: v, richtig, msg, aufgabe: A.text, fehlerart: ok ? '' : fehlerart });
    }
  });
}

function runUmstellen(el, item, ctx, meta) {
  const U = item.u;
  const names = [...varNames(parseEq(U.formel)).values()];
  const pool = shuffle(['Beide Seiten durch ' + names[1] + ' teilen', 'Beide Seiten mal ' + names[0] + ' nehmen', 'Auf beiden Seiten ' + names[names.length - 1] + ' abziehen', 'Die Wurzel ziehen', 'Beide Seiten quadrieren']);
  const steps = ctx.exam ? [] : U.umformungen.map(f => ({ op: f.operation, gl: f.gleichung, opts: shuffle([f.operation, ...(f.falsch.length ? f.falsch : pool.filter(p => p !== f.operation).slice(0, 3))]) }));
  let i = 0, phase = steps.length ? 'op' : 'final', tries = 0, used = false, shown = false, fb = null, tipOpen = false, solOpen = false, picked = null;
  const done = [];
  const prompt = `Stell ${fml(U.formel)} nach ${nameHTML(U.nach)} um.`;
  function draw() {
    let h = ctxLine(meta) + `<div class="ex-task">${prompt}</div>`;
    if (U.name) h += `<div class="muted small">${esc(U.name)}</div>`;
    h += `<div class="done-steps"><div class="ds"><span class="ds-n">0</span><span class="ds-t">Ausgangsformel</span><span class="ds-v">${fml(U.formel)}</span></div>${done.map((d, k) => `<div class="ds"><span class="ds-n">${k + 1}</span><span class="ds-t">${esc(d.op)}</span><span class="ds-v">${d.html}</span></div>`).join('')}</div>`;
    if (phase === 'end') {
      h += `<div class="fb good"><b>Richtig umgestellt.</b> ${fml(U.loesung)}</div>`;
      h += `<div class="btn-col"><button class="btn" data-a="probe">${icon('formula')} Mit Zahlen üben</button><button class="btn filled" data-a="fertig">${ctx.nextLabel || 'Fertig'}</button></div>`;
      el.innerHTML = h; return;
    }
    if (phase === 'probe') { el.innerHTML = h; probe(el, U, meta, item, () => ctx.onDone(shown ? 'falsch' : used ? 'hilfe' : 'richtig'), ctx.nextLabel); return; }
    h += '<div class="step-box">';
    if (phase === 'op') {
      const s = steps[i];
      h += `<div class="step-n">Schritt ${i + 1} von ${steps.length}</div><div class="step-q">Was machst du als Nächstes?</div><div class="mc">${s.opts.map(o => `<button class="mc-o ${picked && picked.o === o ? (picked.ok ? 'ok' : 'no') : ''}" data-a="op" data-d="${esc(o)}">${esc(o)}</button>`).join('')}</div>`;
    } else if (phase === 'eq') {
      h += `<div class="step-n">Schritt ${i + 1} von ${steps.length}</div><div class="step-q">${esc(steps[i].op)}. Schreib die neue Zeile auf.</div>` + fmlInput(names, 'Ganze Gleichung mit =') + `<div class="act"><button class="btn filled" data-a="check">Prüfen</button><button class="btn" data-a="tip">Tipp</button><button class="btn" data-a="sol">Lösung</button></div>`;
    } else {
      h += `<div class="step-q">${ctx.exam ? 'Deine Umstellung' : 'Jetzt freistellen: ' + nameHTML(U.nach) + ' = …'}</div>` + fmlInput(names, U.nach + ' = …') + `<div class="act"><button class="btn filled" data-a="check">${ctx.exam ? 'Abgeben und weiter' : 'Prüfen'}</button>${ctx.exam ? '' : '<button class="btn" data-a="tip">Tipp</button><button class="btn" data-a="sol">Lösung</button>'}</div>`;
    }
    if (fb) h += fb;
    if (tipOpen) h += `<div class="fb info"><b>Tipp.</b> ${U.tipps.length ? U.tipps.map(esc).join(' ') : 'Schau, was an ' + esc(U.nach) + ' dranhängt. Was am weitesten außen steht, kommt zuerst weg. Jede Rechenart wird durch ihr Gegenstück aufgehoben.'}</div>`;
    if (solOpen) h += `<div class="fb info"><b>Lösung.</b> ${phase === 'eq' ? fml(steps[i].gl) : fml(U.loesung)}<div class="btn-row"><button class="btn" data-a="take">Übernehmen und weiter</button></div></div>`;
    h += '</div>';
    el.innerHTML = h;
    bindFmlInput(el);
    const inp = $('.inp', el);
    if (inp) inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); check(); } });
  }
  function next() {
    tries = 0; fb = null; tipOpen = false; solOpen = false; picked = null;
    if (phase === 'op') phase = 'eq';
    else if (phase === 'eq') { i++; phase = i < steps.length ? 'op' : 'final'; }
    else phase = 'end';
    draw();
  }
  function fail(r, v) {
    tries++; used = true;
    if (tries === 1) logError(meta, item, { aufgabe: 'Stell ' + U.formel + ' nach ' + U.nach + ' um.' + (phase === 'eq' ? ' Schritt: ' + steps[i].op : ''), eingabe: v, richtig: phase === 'eq' ? steps[i].gl : U.loesung, fehlerart: r.fehlerart || 'Umstellen', meldung: r.msg });
    const q = claudeFrage({ fach: meta.fach, thema: meta.thema, aufgabe: 'Stell ' + U.formel + ' nach ' + U.nach + ' um', eingabe: v, schritt: phase === 'final' ? steps.length + 1 : i + 1, was: phase === 'eq' ? steps[i].op : 'freistellen', meldung: r.msg });
    fb = `<div class="fb bad"><b>Noch nicht.</b> ${esc(r.msg)}<div class="btn-row"><button class="btn small" data-a="claude" data-d="${esc(q)}">${icon('claude')} Frag Claude</button></div></div>`;
    draw();
    const inp = $('.inp', el); if (inp) inp.value = v;
  }
  function check() {
    const inp = $('.inp', el);
    const v = inp ? inp.value : '';
    if (!v.trim()) { fb = `<div class="fb bad">Gib zuerst etwas ein.</div>`; draw(); return; }
    if (ctx.exam) {
      const r = checkSolved(U.formel, U.nach, U.loesung, v);
      if (!r.ok) logError(meta, item, { aufgabe: 'Stell ' + U.formel + ' nach ' + U.nach + ' um.', eingabe: v, richtig: U.loesung, fehlerart: r.fehlerart || 'Umstellen', meldung: r.msg });
      ctx.onDone(r.ok ? 'richtig' : 'falsch', { eingabe: v, richtig: U.loesung, msg: r.msg, aufgabe: 'Stell ' + U.formel + ' nach ' + U.nach + ' um.' });
      return;
    }
    if (phase === 'eq') {
      const r = checkStep(U.formel, U.nach, U.loesung, v);
      if (!r.ok) return fail(r, v);
      done.push({ op: steps[i].op, html: fml(v) });
      // Steht die gesuchte Größe schon allein? Dann ist die Umstellung fertig.
      if (i === steps.length - 1 && checkSolved(U.formel, U.nach, U.loesung, v).ok) { i++; phase = 'final'; return next(); }
      return next();
    }
    const r = checkSolved(U.formel, U.nach, U.loesung, v);
    if (!r.ok) return fail(r, v);
    done.push({ op: 'Freigestellt', html: fml(v) });
    next();
  }
  on(el, {
    op: o => {
      const s = steps[i];
      if (o === s.op) { if (tries === 0 && !picked) { /* erster Versuch */ } picked = { o, ok: true }; draw(); setTimeout(next, 350); }
      else { tries++; used = true; picked = { o, ok: false }; fb = `<div class="fb bad"><b>Das bringt dich nicht weiter.</b> Schau, was an ${esc(U.nach)} dranhängt und was davon am weitesten außen steht.</div>`; if (tries === 1) logError(meta, item, { aufgabe: 'Stell ' + U.formel + ' nach ' + U.nach + ' um. Welche Umformung?', eingabe: o, richtig: s.op, fehlerart: 'Falsche Umformung gewählt' }); draw(); }
    },
    check, tip: () => { tipOpen = !tipOpen; used = true; draw(); }, sol: () => { solOpen = !solOpen; draw(); },
    take: () => { shown = true; if (phase === 'eq') { done.push({ op: steps[i].op, html: fml(steps[i].gl) + ' <span class="muted">(angesehen)</span>' }); } else done.push({ op: 'Freigestellt', html: fml(U.loesung) + ' <span class="muted">(angesehen)</span>' }); next(); },
    claude: d => askClaude(d),
    probe: () => { phase = 'probe'; draw(); },
    fertig: () => ctx.onDone(shown ? 'falsch' : used ? 'hilfe' : 'richtig')
  });
  draw();
}
// Probe mit Zahlen: Ich rechne, die App prüft
function probe(el, U, meta, item, finish, nextLabel) {
  const f = parseEq(U.formel);
  const names = [...varNames(f).values()].filter(n => keyOf(n) !== keyOf(U.nach));
  let vals, t;
  for (let k = 0; k < 50; k++) {
    vals = {};
    for (const n of names) vals[keyOf(n)] = 2 + Math.floor(Math.random() * 19);
    t = calc(U.loesung, vals);
    if (t != null && isFinite(t) && t > 0) break;
  }
  const box = document.createElement('div');
  box.className = 'step-box';
  let fb = '';
  const draw = () => {
    box.innerHTML = `<div class="step-q">Rechne mit Zahlen: ${names.map(n => nameHTML(n) + ' = ' + fmtNum(vals[keyOf(n)])).join(', ')}. Wie groß ist ${nameHTML(U.nach)}?</div>${numInput('')}<div class="act"><button class="btn filled" data-a="pcheck">Prüfen</button><button class="btn" data-a="pskip">${nextLabel || 'Fertig'}</button></div>${fb}`;
    bindFmlInput(box);
  };
  draw();
  el.appendChild(box);
  on(box, {
    pcheck: () => {
      const v = $('.inp', box).value;
      const c = checkNumber(v, t, '');
      if (c.status === 'ok') { fb = `<div class="fb good"><b>Stimmt.</b> ${nameHTML(U.nach)} = ${esc(fmtNum(t))}</div>`; draw(); $('[data-a="pskip"]', box).classList.add('filled'); return; }
      if (c.status === 'wrong') logError(meta, item, { aufgabe: 'Probe zu ' + U.formel + ' mit ' + names.map(n => n + ' = ' + fmtNum(vals[keyOf(n)])).join(', '), eingabe: v, richtig: fmtNum(t), fehlerart: c.fehlerart, meldung: c.msg });
      fb = `<div class="fb bad">${esc(c.msg)}</div>`; draw(); $('.inp', box).value = v;
    },
    pskip: finish
  });
}

function runAuswahl(el, item, ctx, meta) {
  const A = item.a;
  const opts = shuffle([A.richtig, ...A.falsch]);
  let tries = 0, solved = false, shown = false, picked = new Set();
  function draw() {
    el.innerHTML = ctxLine(meta) + `<div class="ex-task">${esc(A.frage)}</div><div class="mc">${opts.map(o => `<button class="mc-o ${picked.has(o) ? (o === A.richtig ? 'ok' : 'no') : solved && o === A.richtig ? 'ok' : ''}" data-a="pick" data-d="${esc(o)}">${esc(o)}</button>`).join('')}</div>
      ${solved && A.erklaerung ? `<div class="fb info"><b>Darum.</b> ${esc(A.erklaerung)}</div>` : ''}
      ${solved ? `<div class="btn-col"><button class="btn filled" data-a="fertig">${ctx.nextLabel || 'Weiter'}</button></div>` : ctx.exam ? '' : `<div class="act"><button class="btn" data-a="sol">Lösung zeigen</button></div>`}`;
  }
  on(el, {
    pick: o => {
      if (solved) return;
      picked.add(o);
      if (ctx.exam) { if (o !== A.richtig) logError(meta, item, { aufgabe: A.frage, eingabe: o, richtig: A.richtig, fehlerart: 'Falsche Auswahl' }); ctx.onDone(o === A.richtig ? 'richtig' : 'falsch', { eingabe: o, richtig: A.richtig, aufgabe: A.frage }); return; }
      if (o === A.richtig) solved = true;
      else { tries++; if (tries === 1) logError(meta, item, { aufgabe: A.frage, eingabe: o, richtig: A.richtig, fehlerart: 'Falsche Auswahl' }); }
      draw();
    },
    sol: () => { shown = true; solved = true; draw(); },
    fertig: () => ctx.onDone(shown ? 'falsch' : tries ? 'hilfe' : 'richtig')
  });
  draw();
}

function runReihenfolge(el, item, ctx, meta) {
  const R = item.r;
  let pool = shuffle(R.schritte.map((s, k) => ({ s, k })));
  while (pool.length > 1 && pool.every((p, k) => p.k === k)) pool = shuffle(pool);
  let seq = [], tries = 0, checked = null, solved = false, shown = false;
  function draw() {
    let h = ctxLine(meta) + `<div class="ex-task">Bring in die richtige Reihenfolge: ${esc(R.titel)}</div>`;
    h += `<div class="seq">${seq.map((p, k) => `<button class="seq-i ${checked ? (checked[k] ? 'ok' : 'no') : ''}" data-a="unpick" data-d="${k}"><span class="seq-n">${k + 1}</span>${esc(p.s)}</button>`).join('') || '<div class="muted">Tippe die Schritte unten in der richtigen Reihenfolge an.</div>'}</div>`;
    if (!solved) h += `<div class="pool">${pool.map((p, k) => `<button class="pool-i" data-a="pick" data-d="${k}">${esc(p.s)}</button>`).join('')}</div>`;
    if (solved) h += `<div class="fb good"><b>Richtige Reihenfolge.</b></div><div class="btn-col"><button class="btn filled" data-a="fertig">${ctx.nextLabel || 'Weiter'}</button></div>`;
    else if (!pool.length) h += `<div class="act"><button class="btn filled" data-a="check">${ctx.exam ? 'Abgeben und weiter' : 'Prüfen'}</button>${ctx.exam ? '' : '<button class="btn" data-a="sol">Lösung</button>'}</div>`;
    else if (!ctx.exam) h += `<div class="act"><button class="btn" data-a="sol">Lösung</button></div>`;
    el.innerHTML = h;
  }
  on(el, {
    pick: k => { checked = null; seq.push(pool.splice(+k, 1)[0]); draw(); },
    unpick: k => { if (solved) return; checked = null; pool.push(seq.splice(+k, 1)[0]); draw(); },
    check: () => {
      checked = seq.map((p, k) => p.k === k);
      const ok = checked.every(Boolean);
      if (ctx.exam) { if (!ok) logError(meta, item, { aufgabe: 'Reihenfolge: ' + R.titel, eingabe: seq.map(p => p.s).join(', '), richtig: R.schritte.join(', '), fehlerart: 'Reihenfolge' }); ctx.onDone(ok ? 'richtig' : 'falsch', { aufgabe: R.titel, eingabe: seq.map(p => p.s).join(', '), richtig: R.schritte.join(', ') }); return; }
      if (ok) solved = true;
      else { tries++; if (tries === 1) logError(meta, item, { aufgabe: 'Reihenfolge: ' + R.titel, eingabe: seq.map(p => p.s).join(', '), richtig: R.schritte.join(', '), fehlerart: 'Reihenfolge' }); }
      draw();
    },
    sol: () => { shown = true; solved = true; seq = R.schritte.map((s, k) => ({ s, k })); pool = []; checked = seq.map(() => true); draw(); },
    fertig: () => ctx.onDone(shown ? 'falsch' : tries ? 'hilfe' : 'richtig')
  });
  draw();
}

function rateButtons() {
  return `<div class="rate"><button class="btn rate-no" data-a="rate" data-d="falsch">Nicht gewusst</button><button class="btn rate-mid" data-a="rate" data-d="hilfe">Mit Mühe</button><button class="btn rate-ok" data-a="rate" data-d="richtig">Gewusst</button></div>`;
}
// Karte als Auswahl: die richtige Antwort unter Antworten anderer Karten desselben Themas finden.
// Gibt es zu wenige andere Antworten, oder willst du lieber aufdecken, wird es eine Klappkarte.
function runKarte(el, item, ctx, meta) {
  const andere = [...new Set(st.topicItems(item.tid).filter(i => (i.art === 'karte' || i.art === 'begriff') && i.antwort && i.frage !== item.frage && norm(i.antwort) !== norm(item.antwort)).map(i => i.antwort))];
  if (andere.length < 3 || ctx.exam) return runKarteFlip(el, item, ctx, meta);
  const L = item.antwort.length;
  const falsch = shuffle(andere.sort((a, b) => Math.abs(a.length - L) - Math.abs(b.length - L)).slice(0, 6)).slice(0, 3);
  const opts = shuffle([item.antwort, ...falsch]);
  const show = o => (looksLikeFormula(o) ? fml(o) : esc(o));
  let tries = 0, solved = false;
  const picked = new Set();
  function draw() {
    el.innerHTML = ctxLine(meta) + `<div class="ex-task">${esc(item.frage)}</div><div class="mc">${opts.map((o, k) => `<button class="mc-o ${picked.has(k) ? (o === item.antwort ? 'ok' : 'no') : solved && o === item.antwort ? 'ok' : ''}" data-a="pick" data-d="${k}">${show(o)}</button>`).join('')}</div>
      ${solved ? `<div class="btn-col"><button class="btn filled" data-a="fertig">${ctx.nextLabel || 'Weiter'}</button></div>` : `<div class="act"><button class="btn" data-a="flip">Lieber aufdecken</button></div>`}`;
  }
  on(el, {
    pick: k => {
      if (solved) return;
      picked.add(+k);
      if (opts[+k] === item.antwort) solved = true;
      else { tries++; if (tries === 1 && item.art !== 'begriff') logError(meta, item, { aufgabe: item.frage, eingabe: opts[+k], richtig: item.antwort, fehlerart: 'Fachbegriff verwechselt' }); }
      draw();
    },
    flip: () => runKarteFlip(el, item, ctx, meta),
    fertig: () => ctx.onDone(tries === 0 ? 'richtig' : tries === 1 ? 'hilfe' : 'falsch')
  });
  draw();
}
function runKarteFlip(el, item, ctx, meta) {
  let open = false;
  function draw() {
    el.innerHTML = ctxLine(meta) + `<button class="flash ${open ? 'open' : ''}" data-a="flip"><div class="flash-q">${esc(item.frage)}</div>${open ? `<div class="flash-a">${looksLikeFormula(item.antwort) ? fml(item.antwort) : esc(item.antwort)}</div>` : '<div class="flash-hint">Antippen zum Aufdecken</div>'}</button>${open ? rateButtons() : ''}`;
  }
  on(el, { flip: () => { open = true; draw(); }, rate: d => ctx.onDone(d) });
  draw();
}
const looksLikeFormula = s => /^[^.!?]{1,60}=[^.!?]{1,80}$/.test(String(s)) && !/\s(ist|sind|und|der|die|das)\s/.test(s);
function runFehler(el, item, ctx, meta) {
  const e = item.err;
  let open = false;
  function draw() {
    el.innerHTML = ctxLine(meta) + `<div class="card-k">Fehlerkarte</div><button class="flash ${open ? 'open' : ''}" data-a="flip"><div class="flash-q">Worauf musst du hier achten?</div><div class="flash-sub">${esc(e.aufgabe)}${e.eingabe ? '<br>Deine Eingabe damals: <b>' + esc(e.eingabe) + '</b>' : ''}</div>${open ? `<div class="flash-a">${e.richtig ? 'Richtig wäre: <b>' + esc(e.richtig) + '</b><br>' : ''}Fehlerart: ${esc(e.fehlerart)}${e.notiz ? '<br>' + esc(e.notiz) : ''}</div>` : '<div class="flash-hint">Erst selbst überlegen, dann antippen</div>'}</button>${open ? rateButtons() : ''}`;
  }
  on(el, { flip: () => { open = true; draw(); }, rate: d => ctx.onDone(d) });
  draw();
}

/* ===== Sitzung: mehrere Übungen nacheinander ===== */
export function runSession(items, title, opt = {}) {
  if (!items.length) { toast('Gerade ist nichts dran.'); return; }
  const res = [];
  let i = 0;
  const start = Date.now();
  const limit = opt.minutes ? opt.minutes * 60000 : 0;
  let timer = null;
  let sheet = null;
  openSheet({
    title, full: true,
    confirmClose: () => i >= items.length || res.length === 0 || confirm('Sitzung beenden? Was du schon gemacht hast, ist gespeichert.'),
    onClose: () => { clearInterval(timer); stopSpeaking(); if (opt.onClose) opt.onClose(res); },
    render(body, api) {
      sheet = api;
      body.innerHTML = `<div class="sess-top">${items.length > 1 ? progress(0) : ''}<div class="sess-info"></div></div><div class="sess-item"></div>`;
      show();
    }
  });
  function info() { return $('.sess-info', sheet.body); }
  if (limit) timer = setInterval(() => { const left = Math.max(0, limit - (Date.now() - start)); const n = info(); if (n) n.textContent = (left ? Math.ceil(left / 60000) + ' Min. übrig' : 'Zeit um, die letzte Karte noch') + ' · ' + (i + 1) + ' von ' + items.length; }, 1000);
  function show() {
    const box = $('.sess-item', sheet.body);
    const bar = $('.bar i', sheet.body);
    if (bar) bar.style.width = Math.round(i / items.length * 100) + '%';
    const n = info(); if (n) n.textContent = items.length > 1 && i < items.length ? (i + 1) + ' von ' + items.length : '';
    if (i >= items.length || (limit && Date.now() - start > limit && i > 0)) return summary(box);
    const it = items[i];
    const fresh = box.cloneNode(false);
    box.replaceWith(fresh);
    runItem(fresh, it, {
      blind: opt.blind,
      nextLabel: i < items.length - 1 ? 'Weiter' : 'Fertig',
      onDone: async (erg, info2) => {
        if (!(info2 && info2.skip)) { await st.recordCard(it, erg); res.push({ it, erg, info: info2 }); }
        if (info2 && info2.ansatz != null) await st.addEvent({ art: 'ansatz', tid: it.tid, ok: !!info2.ansatz });
        i++;
        show();
        $('.sheet-body', sheet.el).scrollTop = 0;
      }
    });
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
      <button class="btn filled" data-a="close">Fertig</button></div>`;
    on(box, { close: () => sheet.close() });
    const bar = $('.bar i', sheet.body); if (bar) bar.style.width = '100%';
  }
  return sheet;
}
