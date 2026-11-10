// Prüft die App im Browser: Start, alle fünf Bereiche, ein Thema, eine kurze Lernrunde.
// Meldet Fehler aus der Konsole. Braucht Playwright mit Chromium und python3.
// Aufruf: node tools/pruefen/browser.mjs            (Grundprüfung)
//         node tools/pruefen/browser.mjs datei.mjs  (eigenes Szenario: export default async (page, { shot }) => { … })
import { createRequire } from 'node:module';
import { spawn, execSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PORT = 8765;
function playwright() {
  try { return createRequire(import.meta.url)('playwright'); } catch (e) { /* nicht im Projekt: global suchen */ }
  return createRequire(execSync('npm root -g').toString().trim() + '/')('playwright');
}
const { chromium } = playwright();
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
await new Promise(r => setTimeout(r, 800));
const browser = await chromium.launch();
// Schmal wie ein iPhone, ohne Service Worker, damit immer der aktuelle Code läuft
const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, hasTouch: true, serviceWorkers: 'block' });
const page = await ctx.newPage();
const fehler = [];
page.on('console', m => { if (m.type() === 'error') fehler.push('Konsole: ' + m.text()); });
page.on('pageerror', e => fehler.push('Seitenfehler: ' + e.message));
page.on('dialog', d => d.accept());
const shot = name => page.screenshot({ path: name + '.png' });

async function grundpruefung() {
  for (const tab of ['faecher', 'plus', 'fehler', 'mehr', 'heute']) {
    await page.click(`.tabbar [data-tab="${tab}"]`);
    await page.waitForSelector(`.tabscreen.on[data-tab="${tab}"] .page-body`);
  }
  console.log('Bereiche: alle fünf öffnen');
  // Ein eingebautes Thema öffnen und alle Reiter durchgehen
  await page.evaluate(async () => { const eng = await import('./js/engine.js'); const ui = await import('./js/ui.js'); ui.showTab('faecher'); ui.push(eng.topicPage('et-ohmsches-gesetz')); });
  await page.waitForSelector('[data-seg="tab"]');
  for (const t of ['bausteine', 'ueben', 'karten', 'schnellweg', 'zettel', 'fotos', 'prinzip']) { await page.locator(`[data-seg="tab"] button[data-v="${t}"]`).click(); await page.waitForTimeout(120); }
  console.log('Thema: alle Reiter öffnen');
  // Kurze Runde: zwei Karten aufdecken und bewerten
  await page.evaluate(async () => { const st = await import('./js/store.js'); const eng = await import('./js/engine.js'); eng.runSession(st.topicItems('et-ohmsches-gesetz').filter(i => i.art === 'karte').slice(0, 2), 'Prüfung'); });
  for (let k = 0; k < 2; k++) { await page.waitForSelector('.flash:not(.open)'); await page.click('.flash'); await page.click('.rate [data-d="richtig"]'); }
  await page.waitForSelector('.sum-big');
  console.log('Runde:', (await page.locator('.sum-big').innerText()), 'gewusst');
  const karten = await page.evaluate(async () => (await import('./js/store.js')).S.cards.size);
  if (karten < 2) throw new Error('Kartenstand wurde nicht gespeichert');
  console.log('Lernstand gespeichert:', karten, 'Karten');
}

let code = 0;
try {
  await page.goto(`http://127.0.0.1:${PORT}/index.html`);
  await page.waitForSelector('#boot', { state: 'detached', timeout: 15000 });
  if (process.argv[2]) await (await import(pathToFileURL(path.resolve(process.argv[2])).href)).default(page, { shot });
  else await grundpruefung();
} catch (e) { console.log('FEHLER IM ABLAUF:', e.message.split('\n')[0]); code = 1; try { await shot('fehler'); } catch (x) { /* egal */ } }
const echte = fehler.filter(e => !/favicon|net::ERR/.test(e));
console.log(echte.length ? 'FEHLER IM BROWSER:\n' + echte.join('\n') : 'Browser: keine Fehler');
await browser.close();
srv.kill();
process.exit(code || (echte.length ? 1 : 0));
