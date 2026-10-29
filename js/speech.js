// Vorlesen mit der Web Speech API und Bildschirm wach halten.
let voice = null;
export const canSpeak = () => typeof self !== 'undefined' && 'speechSynthesis' in self && 'SpeechSynthesisUtterance' in self;

function pickVoice() {
  if (!canSpeak()) return null;
  const vs = speechSynthesis.getVoices().filter(v => /^de(-|_|$)/i.test(v.lang));
  if (!vs.length) return null;
  const score = v => (/premium|enhanced|erweitert|natural/i.test(v.name) ? 3 : 0) + (/de-DE/i.test(v.lang) ? 2 : 0) + (/anna|petra|helena|markus|yannick/i.test(v.name) ? 1 : 0) + (v.localService ? 1 : 0);
  return vs.sort((a, b) => score(b) - score(a))[0];
}
if (canSpeak()) {
  voice = pickVoice();
  try { speechSynthesis.addEventListener('voiceschanged', () => { voice = pickVoice(); }); } catch (e) { /* alt */ }
}

// Rechenzeichen stehen im Text als Zeichen. Zum Vorlesen werden sie zu Wörtern.
const HOCH = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', 'ⁿ': 'n', 'ˣ': 'x', 'ᵖ': 'p', 'ᵗ': 't', 'ᵐ': 'm' };
// Einheiten hinter einer Zahl ausschreiben, die längeren zuerst. Ein einzelnes m bleibt, das ist oft der Modul.
const EINHEIT = [
  ['N/mm²', 'Newton pro Quadratmillimeter'], ['m/s²', 'Meter pro Sekundenquadrat'], ['g/tkm', 'Gramm pro Tonnenkilometer'],
  ['mm²', 'Quadratmillimeter'], ['cm²', 'Quadratzentimeter'], ['m²', 'Quadratmeter'], ['mm³', 'Kubikmillimeter'], ['cm³', 'Kubikzentimeter'], ['m³', 'Kubikmeter'],
  ['kNm', 'Kilonewtonmeter'], ['Nmm', 'Newtonmillimeter'], ['Nm', 'Newtonmeter'], ['kN', 'Kilonewton'], ['MPa', 'Megapascal'],
  ['m/min', 'Meter pro Minute'], ['m/s', 'Meter pro Sekunde'], ['1/min', 'pro Minute'], ['km/h', 'Kilometer pro Stunde'],
  ['µm', 'Mikrometer'], ['mm', 'Millimeter'], ['cm', 'Zentimeter'], ['km', 'Kilometer'],
  ['kWh', 'Kilowattstunden'], ['kW', 'Kilowatt'], ['mA', 'Milliampere'], ['kΩ', 'Kiloohm'], ['MΩ', 'Megaohm'], ['mH', 'Millihenry'], ['µF', 'Mikrofarad'], ['nF', 'Nanofarad'],
  ['Hz', 'Hertz'], ['kg', 'Kilogramm'], ['tkm', 'Tonnenkilometer'], ['min', 'Minuten'], ['bar', 'bar'], ['°C', 'Grad Celsius'],
  ['N', 'Newton'], ['W', 'Watt'], ['V', 'Volt'], ['A', 'Ampere'], ['h', 'Stunden'], ['s', 'Sekunden'], ['g', 'Gramm'], ['K', 'Kelvin'], ['€', 'Euro']
];
const EINHEIT_RE = new RegExp('(\\d)\\s?(' + EINHEIT.map(e => e[0].replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&')).join('|') + ')(?![A-Za-zÄÖÜäöüßµΩ²³/])', 'g');
const EINHEIT_MAP = Object.fromEntries(EINHEIT);
const GRIECH = { σ: 'Sigma', ς: 'Sigma', τ: 'Tau', ε: 'Epsilon', η: 'Eta', α: 'Alpha', β: 'Beta', γ: 'Gamma', ρ: 'Rho', κ: 'Kappa', φ: 'Phi', ω: 'Omega', λ: 'Lambda', ϑ: 'Theta', Δ: 'Delta', Σ: 'Summe', μ: 'My' };
export function sprechbar(text) {
  return String(text)
    .replace(EINHEIT_RE, (m, d, u) => d + ' ' + EINHEIT_MAP[u])
    // Einheiten ohne Zahl davor, zum Beispiel in Ω · mm² / m
    .replace(/(^|[\s(·/])(mm²|cm²|mm³|cm³|N\/mm²|µm|mm)(?![A-Za-zÄÖÜäöüß²³])/g, (m, v, u) => v + EINHEIT_MAP[u])
    .replace(/(Ohm|Ω|Quadratmillimeter)\s*\/\s*m\b/g, '$1 pro Meter')
    .replace(/(\d) m (?=[A-ZÄÖÜ][a-zäöü])/g, '$1 Meter ')
    .replace(/([0-9A-Za-zΩ)])⁻([⁰¹²³⁴⁵⁶⁷⁸⁹ⁿˣᵖᵗᵐ]+)/g, (m, a, h) => a + ' hoch minus ' + [...h].map(c => HOCH[c]).join(''))
    .replace(/([⁰¹²³⁴⁵⁶⁷⁸⁹ⁿˣᵖᵗᵐ]+)/g, h => h === '²' ? ' Quadrat ' : ' hoch ' + [...h].map(c => HOCH[c]).join('') + ' ')
    .replace(/\s*±\s*/g, ' plus minus ')
    .replace(/\s*≠\s*/g, ' ungleich ')
    .replace(/√\s?/g, ' Wurzel aus ')
    .replace(/\s*·\s*/g, ' mal ')
    .replace(/\s*\^\s*/g, ' hoch ')
    .replace(/(\S)\/(\d)/g, '$1 durch $2')
    .replace(/(\S)\/(\S)/g, '$1 pro $2')
    .replace(/\s+\/\s+/g, ' durch ')
    .replace(/\s+=\s+/g, ' gleich ')
    .replace(/\s+≈\s+/g, ' ungefähr ')
    .replace(/\s+\+\s+/g, ' plus ')
    .replace(/(^|\s)[−-](?=\s?[0-9A-Za-zα-ωΑ-Ω(])/g, '$1minus ')
    .replace(/\s+−\s+/g, ' minus ')
    .replace(/\s?%/g, ' Prozent')
    .replace(/\s?°C/g, ' Grad Celsius')
    .replace(/°/g, ' Grad')
    .replace(/π/g, ' Pi ')
    .replace(/Ω/g, ' Ohm')
    .replace(/[σςτεηαβγρκφωλϑΔΣμ]/g, c => ' ' + GRIECH[c] + ' ')
    .replace(/_/g, ' ')
    .replace(/[()]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([.,:;!?])/g, '$1')
    .trim();
}
// Deutsche Systemstimmen und die eigene Wahl. Die Wahl liegt im Browser, wie die anderen Einstellungen.
export const deVoices = () => (canSpeak() ? speechSynthesis.getVoices().filter(v => /^de(-|_|$)/i.test(v.lang)) : []);
const wahl = k => { try { const v = localStorage.getItem('lernwerk:' + k); return v ? JSON.parse(v) : ''; } catch (e) { return ''; } };
const byName = n => (n ? deVoices().find(v => v.name === n) : null);
// Systemstimme für Lena (A) oder Tom (B). Ohne Wahl die beste gefundene Stimme.
export const voiceFor = wer => byName(wahl(wer === 'A' ? 'stimmeA' : 'stimmeB')) || voice;
// Spricht einen Text. Promise wird erfüllt, wenn fertig oder abgebrochen.
export function speak(text, rate = 1, wer = 'B') {
  return new Promise(resolve => {
    if (!canSpeak() || !text) return resolve(false);
    const u = new SpeechSynthesisUtterance(sprechbar(text));
    u.lang = 'de-DE';
    const v = voiceFor(wer);
    if (v) u.voice = v;
    u.rate = rate * (+wahl('sysTempo') || 1);
    let done = false;
    const fin = ok => { if (!done) { done = true; resolve(ok); } };
    u.onend = () => fin(true);
    u.onerror = () => fin(false);
    speechSynthesis.speak(u);
    // Sicherheitsnetz, falls onend nie kommt
    setTimeout(() => fin(true), Math.max(4000, String(text).length * 140 / rate));
  });
}
export function stopSpeaking() { if (canSpeak()) speechSynthesis.cancel(); }
export const pause = ms => new Promise(r => setTimeout(r, ms));

let lock = null;
export async function keepAwake(on) {
  try {
    if (on && 'wakeLock' in navigator) { lock = await navigator.wakeLock.request('screen'); return true; }
    if (!on && lock) { await lock.release(); lock = null; }
  } catch (e) { /* nicht erlaubt */ }
  return false;
}
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => { if (lock && document.visibilityState === 'visible') keepAwake(true); });

/* ===== Vorlesen mit Leiste: Pause, Zurück, Stopp ===== */
let rd = null;
function chunks(text) {
  const parts = String(text || '').replace(/\s+/g, ' ').split(/(?<=[.!?:])\s+/);
  const out = [];
  for (const p of parts) {
    if (!p.trim()) continue;
    if (out.length && out[out.length - 1].length + p.length < 220) out[out.length - 1] += ' ' + p;
    else out.push(p);
  }
  return out;
}
function bar() {
  let b = document.getElementById('readbar');
  if (!b) {
    b = document.createElement('div');
    b.id = 'readbar';
    b.setAttribute('role', 'region');
    b.setAttribute('aria-label', 'Vorlesen');
    b.innerHTML = `<span class="rb-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg></span>
      <span class="rb-t"><b></b><small></small></span>
      <button type="button" data-rb="back" aria-label="Satz zurück"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 5.5v13l-9-6.5zM6 5.5h2.5v13H6z"/></svg></button>
      <button type="button" data-rb="play" class="rb-main" aria-label="Pause oder weiter"></button>
      <button type="button" data-rb="stop" aria-label="Vorlesen beenden"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg></button>`;
    b.addEventListener('click', e => {
      const a = e.target.closest('[data-rb]');
      if (!a || !rd) return;
      if (a.dataset.rb === 'stop') stopReading();
      else if (a.dataset.rb === 'play') rd.paused ? resume() : pauseReading();
      else if (a.dataset.rb === 'back') { rd.token++; stopSpeaking(); rd.i = Math.max(0, rd.i - (rd.paused ? 1 : 1)); if (!rd.paused) play(); else upd(); }
    });
    document.body.appendChild(b);
  }
  return b;
}
const PLAY = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l13-7.5z"/></svg>';
const PAUSE = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5h3.5v15H7zM13.5 4.5H17v15h-3.5z"/></svg>';
function upd() {
  const b = bar();
  if (!rd) { b.classList.remove('on'); return; }
  b.classList.add('on');
  b.querySelector('.rb-t b').textContent = rd.paused ? 'Pausiert' : 'Liest vor';
  b.querySelector('.rb-t small').textContent = (rd.title ? rd.title + ' · ' : '') + Math.min(rd.i + 1, rd.chunks.length) + ' von ' + rd.chunks.length;
  b.querySelector('[data-rb="play"]').innerHTML = rd.paused ? PLAY : PAUSE;
}
async function play() {
  if (!rd) return;
  const tok = ++rd.token;
  rd.paused = false;
  keepAwake(true);
  while (rd && tok === rd.token && rd.i < rd.chunks.length) {
    upd();
    await speak(rd.chunks[rd.i], 0.97);
    if (!rd || tok !== rd.token) return;
    rd.i++;
  }
  if (rd && tok === rd.token) stopReading();
}
export function readAloud(text, title = '') {
  if (!canSpeak()) return false;
  stopReading();
  const c = chunks(text);
  if (!c.length) return false;
  rd = { chunks: c, i: 0, paused: false, token: 0, title };
  play();
  return true;
}
export function pauseReading() { if (!rd) return; rd.paused = true; rd.token++; stopSpeaking(); keepAwake(false); upd(); }
function resume() { if (rd) play(); }
export function stopReading() { if (rd) rd.token++; rd = null; stopSpeaking(); keepAwake(false); upd(); }
export const isReading = () => !!rd;
