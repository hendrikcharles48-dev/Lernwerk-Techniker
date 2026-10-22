// Vorlesen mit der Web Speech API und Bildschirm wach halten.
let voice = null;
export const canSpeak = () => 'speechSynthesis' in self && 'SpeechSynthesisUtterance' in self;

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

// Spricht einen Text. Promise wird erfüllt, wenn fertig oder abgebrochen.
export function speak(text, rate = 1) {
  return new Promise(resolve => {
    if (!canSpeak() || !text) return resolve(false);
    const u = new SpeechSynthesisUtterance(String(text));
    u.lang = 'de-DE';
    if (voice) u.voice = voice;
    u.rate = rate;
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
document.addEventListener('visibilitychange', () => { if (lock && document.visibilityState === 'visible') keepAwake(true); });

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
