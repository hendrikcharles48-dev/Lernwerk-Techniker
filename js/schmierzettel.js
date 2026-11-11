// Schmierzettel unter jeder Frage: tippen, zeichnen, Taschenrechner. Wird nicht gespeichert.
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

/* ===== Schmierzettel =====
 * Kleiner Knopf oben in der Sitzung. Tippen oder mit dem Finger zeichnen.
 * Wird nicht geprüft, nicht gespeichert und bei jeder neuen Frage geleert.
 */
export const schmierKnopf = () => `<button class="schmier-btn" data-schmier aria-label="Schmierzettel">${icon('edit')}<span>Zettel</span></button>`;
export function schmierzettel(root) {
  const btn = $('[data-schmier]', root);
  const box = document.createElement('div');
  box.className = 'schmier no-swipe';
  box.hidden = true;
  btn.after(box);
  // Pro Frage einmal aufbauen. Zu- und Aufklappen behält Text und Zeichnung, erst die nächste Frage leert.
  let art = 'tippen', gebaut = false, mitRechner = false, gemalt = false;
  function bauen() {
    box.innerHTML = `<div class="schmier-head">${seg('sart', [['tippen', 'Tippen'], ['zeichnen', 'Zeichnen']], art)}<button class="btn small" data-x="leer">Leeren</button></div>
      <textarea class="schmier-ta" rows="4" placeholder="Nebenrechnung, Stichworte … wird nicht gespeichert" autocapitalize="off" autocomplete="off" spellcheck="false"></textarea>
      <canvas class="schmier-cv"></canvas>
      ${mitRechner ? `<div class="rechner"><div class="rechner-k">${icon('formula')} Taschenrechner</div>
        <div class="fml-in calc-in rechner-feld">${editorHTML([], 'Rechnung eintippen', { calc: true })}</div>
        <div class="rechner-zeile"><button class="btn small" data-x="ac">AC</button><button class="btn small" data-x="ans" disabled>Ans</button><div class="rechner-out muted">=</div></div></div>` : ''}`;
    $$('[data-seg] button', box).forEach(b => b.onclick = () => { art = b.dataset.v; zeigen(); });
    $('[data-x="leer"]', box).onclick = () => { $('.schmier-ta', box).value = ''; const c = $('.schmier-cv', box); if (gemalt) { gemalt = false; malen(c); } };
    // Taschenrechner mit eigener Tastatur: Bruch, Wurzel, Hochzahl, sin, cos, tan in Grad, π, mal zehn hoch.
    // Das Ergebnis steht sofort darunter. Ans setzt das letzte Ergebnis ein.
    const host = $('.rechner .me', box);
    if (host) {
      attachEditor(host, $('.rechner .me-pad', box), { onChange: v => rechnen(v) });
      // Ergebnis direkt unter der Anzeige, wie auf einem echten Taschenrechner
      (host.closest('.me-numrow') || host).after($('.rechner-zeile', box));
      $('[data-x="ac"]', box).onclick = () => { host.value = ''; rechnen(''); };
      $('[data-x="ans"]', box).onclick = () => { if (ans != null) host.value = host.value + (host.value && !/[+\-*·(]$/.test(host.value.trim()) ? ' · ' : '') + fmtNum(ans, 8); };
    }
    gebaut = true;
    zeigen();
  }
  function zeigen() {
    $$('[data-seg] button', box).forEach(b => b.classList.toggle('on', b.dataset.v === art));
    const ta = $('.schmier-ta', box), c = $('.schmier-cv', box);
    ta.hidden = art !== 'tippen'; c.hidden = art !== 'zeichnen';
    // Die Zeichenfläche braucht ihre Breite, deshalb erst einrichten, wenn sie sichtbar ist
    if (art === 'zeichnen' && !c.width_ok) { malen(c); c.width_ok = true; }
  }
  let ans = null;
  function rechnen(src) {
    const out = $('.rechner-out', box);
    if (!out) return;
    const t = String(src).trim();
    if (!t) { out.textContent = '='; out.classList.add('muted'); return; }
    const v = calc(t.replace(/(\d),(\d)/g, '$1.$2'));
    out.classList.toggle('muted', v == null);
    out.innerHTML = v == null ? '= …' : '= <b>' + esc(fmtNum(v, 8)) + '</b>';
    if (v != null) { ans = v; const a = $('[data-x="ans"]', box); if (a) a.disabled = false; }
  }
  function malen(c) {
    const r = window.devicePixelRatio || 1;
    const w = c.clientWidth || 320, h = 220;
    c.width = w * r; c.height = h * r; c.style.height = h + 'px';
    const g = c.getContext('2d');
    g.scale(r, r); g.lineWidth = 2.2; g.lineCap = 'round'; g.lineJoin = 'round';
    g.strokeStyle = getComputedStyle(c).color;
    let zieht = false;
    const pos = e => { const b = c.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
    c.onpointerdown = e => { zieht = true; gemalt = true; c.setPointerCapture(e.pointerId); const [x, y] = pos(e); g.beginPath(); g.moveTo(x, y); g.lineTo(x + 0.1, y + 0.1); g.stroke(); };
    c.onpointermove = e => { if (!zieht) return; const [x, y] = pos(e); g.lineTo(x, y); g.stroke(); };
    c.onpointerup = c.onpointercancel = () => { zieht = false; };
    if (!c.touch_ok) {
      c.touch_ok = true;
      // Beim Zeichnen darf sich die Seite nicht mitbewegen
      c.addEventListener('touchstart', e => e.preventDefault(), { passive: false });
      c.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
    }
  }
  btn.addEventListener('click', () => {
    if (!gebaut) bauen();
    box.hidden = !box.hidden;
    btn.classList.toggle('on', !box.hidden);
    if (!box.hidden) zeigen();
  });
  // Neue Frage: Zettel leeren und zuklappen. Der Taschenrechner ist bei jeder Frage dabei.
  return { neu(item) { box.hidden = true; box.innerHTML = ''; gebaut = false; gemalt = false; ans = null; btn.classList.remove('on'); mitRechner = true; } };
}
