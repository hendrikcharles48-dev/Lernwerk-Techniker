// Trainer-Engine: Themenseite und alle Übungsarten. Eingebaute und eingefügte Inhalte laufen hier gleich.
import { esc, fmtNum, markdown, plainText, shuffle, dayStr, dayShort } from './util.js';
import { fml, fmlWith, nameHTML, parseEq, keyOf, calc, checkSolved, checkStep, varNames, speakFml } from './formula.js';
import { checkNumber, showValue } from './check.js';
import * as st from './store.js';
import { $, $$, icon, row, list, seg, sw, empty, on, push, openSheet, toast, copyText, confirmBox, progress, hinweisTabellenbuch } from './ui.js';
import { speak, stopSpeaking, canSpeak } from './speech.js';
import { INTERVALS } from './srs.js';
import { prefs } from './db.js';

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
      const akt = st.status(tid) === 'aktuell';
      const tc = st.card('t:' + tid);
      let h = `<div class="topic-head" style="--fc:${f.farbe}">
        <div class="chips"><span class="chip" style="background:${f.farbe}">${esc(f.kurz || f.name)}</span>${(f.module || []).map(m => `<span class="chip ghost">${esc(m)}</span>`).join('')}${T.modul && !(f.module || []).includes(T.modul) ? `<span class="chip ghost">${esc(T.modul)}</span>` : ''}</div>
        ${list([row({ title: 'Aktuell im Unterricht', right: sw('akt', akt) })])}`;
      if (t.trainer && t.trainer.length) {
        h += `<div class="trainer-btns">${t.trainer.map(x => `<button class="btn-big" data-a="trainer" data-d="${esc(x.datei)}" style="--fc:${f.farbe}">${icon('open')}<span><b>${esc(x.titel)}</b><small>Alter Trainer${tc ? ' · ' + stufeText(tc) : ''}</small></span></button>`).join('')}</div>`;
      }
      h += `</div><div class="seg-scroll">${seg('tab', TABS.map(([v, l]) => [v, l + countFor(v, T, items, tid)]), cur)}</div><div class="tab-body"></div>`;
      body.innerHTML = h;
      const tb = $('.tab-body', body);
      const draw = () => { st.setPlace({ art: 'thema', tid, titel: t.name, tab: cur }); renderTab(tb, cur, tid, T, items, f); };
      on(body, {
        'sw:akt': v => { st.setAktuell(tid, v); toast(v ? 'Als aktuell markiert. Kommt in Heute zuerst.' : 'Nicht mehr aktuell.'); },
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
  if (tab === 'prinzip') {
    const nichts = !T.anker.length && !T.begriffe.length && !T.merksaetze.length && !T.prinzip.length && !T.notizen.length;
    if (nichts) h += emptyContent(tid);
    T.anker.forEach(a => { h += `<div class="card anchor"><div class="card-k">Bild aus deiner Welt</div><p>${esc(a)}</p></div>`; });
    if (T.begriffe.length) h += `<div class="sec-h">Fachbegriffe</div>` + list(T.begriffe.map(b => row({ titleHTML: `<b>${esc(b.begriff)}</b>`, sub: b.erklaerung })));
    T.merksaetze.forEach(m => { h += `<div class="card merk" style="--fc:${color}"><div class="card-k">Merksatz</div><p>${esc(m)}</p></div>`; });
    if (T.prinzip.length) h += `<div class="sec-h">So funktioniert es</div><div class="card prose">${T.prinzip.map(p => markdown(p)).join('')}</div>`;
    if (T.notizen.length) h += `<div class="sec-h">Notizen</div>` + list(T.notizen.map(n => row({ title: n.schluessel, sub: n.text })));
    if (!nichts && canSpeak()) h += `<div class="btn-row"><button class="btn" data-a="vorlesen">${icon('ear')} Prinzip vorlesen</button></div>`;
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
      vorlesen: () => { const txt = [...T.anker, ...T.merksaetze.map(m => 'Merksatz: ' + m), ...T.prinzip.map(plainText)].join('. '); speak(txt); toast('Ich lese vor.'); }
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
  return empty(tr ? 'Der Stoff steckt im alten Trainer.' : 'Noch kein Inhalt.', tr ? 'Öffne ihn oben. Über Einfügen kannst du Prinzip, Karten und Aufgaben ergänzen.' : 'Lass dir das Thema im Claude-Chat erklären und füge den Lernwerk-Block über Einfügen ein.');
}
export function formelCard(fo) {
  return `<div class="card formel">${fo.name ? `<div class="card-k">${esc(fo.name)}</div>` : ''}<div class="fml-main">${fml(fo.formel)}</div>${fo.umgestellt.length ? `<div class="fml-alt">${fo.umgestellt.map(u => `<div>${fml(u)}</div>`).join('')}</div>` : ''}</div>`;
}
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
        read: () => { speak(plainText(n.text)); toast('Ich lese vor.'); },
        edit: () => { api.close(); noteEditor(n); },
        del: async () => { if (await confirmBox('Lernzettel wirklich löschen?', 'Löschen', true)) { await st.deleteNote(id); api.close(); } }
      });
    },
    onClose: () => stopSpeaking()
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
  const fill = s => String(s || '').replace(/\{([^}]+)\}/g, (m, n) => (keyOf(n.trim()) in vals ? fmtNum(vals[keyOf(n.trim())]) : m));
  const steps = a.schritte.map(s => {
    const e = s.ergebnis;
    const o = { was: fill(s.was), einheit: s.einheit, typ: 'plan' };
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
  return { text: fill(a.text), gegeben: a.gegeben.map(fill), gesucht: a.gesucht.map(fill), tipps: a.tipps.map(fill), steps, final, vals, random };
}

/* ===== Eingabefeld für Formeln mit Tasten ===== */
function fmlInput(vars, placeholder) {
  const keys = [...vars, '=', '·', '/', '(', ')', '²', '√', '+', '−', 'π'];
  return `<div class="fml-in"><input type="text" class="inp" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="${esc(placeholder || '')}" inputmode="text">
    <div class="keys no-swipe">${keys.map(k => `<button type="button" class="key" data-key="${esc(k)}">${vars.includes(k) ? nameHTML(k) : esc(k)}</button>`).join('')}<button type="button" class="key wide" data-key="⌫" aria-label="Löschen">⌫</button></div>
    <div class="fml-prev"></div></div>`;
}
function bindFmlInput(root) {
  const inp = $('.fml-in .inp', root);
  if (!inp) return;
  const prev = $('.fml-prev', root);
  const upd = () => { prev.innerHTML = inp.value.trim() ? 'So lese ich das: ' + fml(inp.value) : ''; };
  inp.addEventListener('input', upd);
  $$('.key', root).forEach(k => k.addEventListener('click', e => {
    e.preventDefault();
    const v = k.dataset.key;
    const s = inp.selectionStart != null ? inp.selectionStart : inp.value.length, en = inp.selectionEnd != null ? inp.selectionEnd : s;
    if (v === '⌫') { if (s === en && s > 0) { inp.value = inp.value.slice(0, s - 1) + inp.value.slice(en); inp.setSelectionRange(s - 1, s - 1); } else { inp.value = inp.value.slice(0, s) + inp.value.slice(en); inp.setSelectionRange(s, s); } }
    else {
      const ins = v === '√' ? '√(' : v === '=' ? ' = ' : v === '·' ? ' · ' : v === '+' ? ' + ' : v === '−' ? ' − ' : v;
      inp.value = inp.value.slice(0, s) + ins + inp.value.slice(en);
      const p = s + ins.length; inp.setSelectionRange(p, p);
    }
    upd();
  }));
}
function numInput(unit) {
  return `<div class="num-in"><input type="text" class="inp" inputmode="decimal" autocomplete="off" placeholder="Zahl"><span class="unit">${esc(unit || '')}</span></div>`;
}

/* ===== Einzelne Übung ausführen =====
 * ctx: {exam, onDone(ergebnis, info)}
 * ergebnis: 'richtig' | 'hilfe' | 'falsch'
 */
export function runItem(el, item, ctx) {
  const th = st.thema(item.tid);
  const meta = { fach: th ? th.fach.name : '', thema: th ? th.thema.name : '', farbe: th ? th.fach.farbe : 'var(--accent)' };
  el.style.setProperty('--fc', meta.farbe);
  const runner = { aufgabe: runAufgabe, umstellen: runUmstellen, auswahl: runAuswahl, reihenfolge: runReihenfolge, karte: runKarte, begriff: runKarte, fehler: runFehler }[item.art];
  if (!runner) { el.innerHTML = empty('Diese Übung kenne ich nicht.'); ctx.onDone('hilfe'); return; }
  runner(el, item, ctx, meta);
}
// Text mit Indizes: F_G wird zu F mit tiefgestelltem G
export const rich = s => esc(s).replace(/(^|[^A-Za-z0-9])([A-Za-zΑ-Ωα-ωΔ])_([A-Za-z0-9]+)/g, '$1$2<sub>$3</sub>');
const ctxLine = meta => `<div class="ex-ctx"><span class="dot" style="background:${meta.farbe}"></span>${esc(meta.fach)} · ${esc(meta.thema)}</div>`;

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
  const allVars = Object.keys(A.vals);

  function draw() {
    const s = steps[i];
    let h = ctxLine(meta) + `<div class="ex-task">${rich(A.text)}</div>`;
    if (A.gegeben.length || A.gesucht.length) h += `<div class="gg">${A.gegeben.length ? `<div><div class="gg-k">Gegeben</div>${A.gegeben.map(g => `<div>${rich(g)}</div>`).join('')}</div>` : ''}${A.gesucht.length ? `<div><div class="gg-k">Gesucht</div>${A.gesucht.map(g => `<div>${rich(g)}</div>`).join('')}</div>` : ''}</div>`;
    if (done.length) h += `<div class="done-steps">${done.map(d => `<div class="ds"><span class="ds-n">${d.n}</span><span class="ds-t">${rich(d.was)}</span><span class="ds-v">${d.html}</span></div>`).join('')}</div>`;
    if (!s) {
      h += `<div class="fb good"><b>Geschafft.</b> ${first} von ${steps.length} Schritten beim ersten Versuch richtig.</div>`;
      if (topicT.schnellwege.length) h += `<details class="disc"><summary>${icon('bolt')} Schnellweg für die Prüfung</summary><div class="prose">${topicT.schnellwege.map(markdown).join('')}</div></details>`;
      h += `<div class="btn-col">${A.random ? `<button class="btn" data-a="again">Neue Zahlen</button>` : ''}<button class="btn filled" data-a="fertig">${ctx.nextLabel || 'Fertig'}</button></div>`;
      el.innerHTML = h;
      return;
    }
    h += `<div class="step-box"><div class="step-n">Schritt ${i + 1} von ${steps.length}</div><div class="step-q">${rich(s.was || 'Nächster Schritt')}</div>`;
    if (s.typ === 'gleichung') {
      const names = [...varNames(parseEqSafe(s.text)).values()];
      h += fmlInput(names, 'Gleichung, zum Beispiel ' + (names[0] || 'x') + ' = …');
    } else if (s.typ === 'zahl') h += numInput(s.einheit);
    else h += `<p class="muted">Diesen Schritt prüft die App nicht. Mach ihn auf deinem Blatt und tippe dann auf Erledigt.</p>`;
    h += `<div class="act">${s.typ === 'plan' ? `<button class="btn filled" data-a="plan">Erledigt</button>` : `<button class="btn filled" data-a="check">Prüfen</button>`}
      <button class="btn" data-a="tip">${tipOpen ? 'Tipp zu' : 'Tipp'}</button><button class="btn" data-a="sol">${solOpen ? 'Lösung zu' : 'Lösung'}</button></div>`;
    if (fb) h += fb;
    if (tipOpen) h += `<div class="fb info"><b>Tipp.</b> ${tipText()}</div>`;
    if (solOpen) h += `<div class="fb info"><b>Lösung.</b> ${solText(s)}<div class="btn-row"><button class="btn" data-a="take">Übernehmen und weiter</button></div></div>`;
    h += '</div>';
    el.innerHTML = h;
    bindFmlInput(el);
    const inp = $('.inp', el);
    if (inp) { inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); check(); } }); if (!fb && !tipOpen && !solOpen) setTimeout(() => { try { inp.focus({ preventScroll: true }); } catch (e) { /* alt */ } }, 50); }
  }
  function tipText() {
    if (A.tipps.length) return A.tipps.map(esc).join(' ');
    const f = topicT.formeln.slice(0, 3).map(x => fml(x.formel)).join(', ');
    return topicT.bausteine.length ? 'Arbeitsplan: ' + esc(topicT.bausteine[Math.min(i, topicT.bausteine.length - 1)]) + (f ? ' Passende Formeln: ' + f : '') : (f ? 'Passende Formeln: ' + f : 'Was ist gegeben, was ist gesucht, und welche Regel verbindet beides?');
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
      r = { msg: c.msg, fehlerart: c.fehlerart, empty: c.status !== 'wrong' };
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
    check, plan: () => accept('erledigt', true),
    tip: () => { tipOpen = !tipOpen; if (tipOpen) used = true; draw(); },
    sol: () => { solOpen = !solOpen; draw(); },
    take: () => { shown = true; const s = steps[i]; accept(solText(s) + ' <span class="muted">(Lösung angesehen)</span>', false); },
    claude: d => askClaude(d),
    again: () => { const f = el.cloneNode(false); el.replaceWith(f); runAufgabe(f, item, ctx, meta); },
    fertig: () => ctx.onDone(shown ? 'falsch' : used ? 'hilfe' : 'richtig', { first, total: steps.length })
  });
  draw();
}
const parseEqSafe = s => { try { return parseEq(s); } catch (e) { return { l: null, r: null }; } };

function runExamAufgabe(el, item, ctx, meta, A, steps) {
  const target = [...steps].reverse().find(s => s.typ === 'zahl' || s.typ === 'gleichung');
  let h = ctxLine(meta) + `<div class="ex-task">${rich(A.text)}</div>`;
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
      ctx.onDone(ok ? 'richtig' : 'falsch', { eingabe: v, richtig, msg, aufgabe: A.text });
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
function runKarte(el, item, ctx, meta) {
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
    const n = info(); if (n) n.textContent = items.length > 1 ? (i + 1) + ' von ' + items.length : '';
    if (i >= items.length || (limit && Date.now() - start > limit && i > 0)) return summary(box);
    const it = items[i];
    const fresh = box.cloneNode(false);
    box.replaceWith(fresh);
    runItem(fresh, it, {
      nextLabel: i < items.length - 1 ? 'Weiter' : 'Fertig',
      onDone: async (erg, info2) => {
        if (!(info2 && info2.skip)) { await st.recordCard(it, erg); res.push({ it, erg }); }
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
    box.innerHTML = `<div class="sum"><div class="sum-big">${c('richtig')} von ${res.length}</div><div class="muted">beim ersten Versuch gewusst</div>
      <div class="sum-row"><span class="pill ok">${c('richtig')} gewusst</span><span class="pill mid">${c('hilfe')} mit Hilfe</span><span class="pill no">${c('falsch')} noch nicht</span></div>
      <p>${res.length && c('richtig') / res.length >= 0.8 ? 'Sitzt gut. Die Karten kommen in größeren Abständen wieder.' : 'Gut, dass du drangeblieben bist. Was noch wackelt, kommt morgen wieder.'}</p>
      <button class="btn filled" data-a="close">Fertig</button></div>`;
    on(box, { close: () => sheet.close() });
    const bar = $('.bar i', sheet.body); if (bar) bar.style.width = '100%';
  }
  return sheet;
}
