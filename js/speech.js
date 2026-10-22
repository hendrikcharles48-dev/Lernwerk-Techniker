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
