// Automatischer iPhone-Check einer statischen Web-App. Aufruf: node check.mjs <ordner> [ausgabe-ordner]
// Braucht Playwright (global installiert) und python3. Ändert nichts an der App.
import { createRequire } from 'node:module';
import { spawn, execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

const dir = path.resolve(process.argv[2] || '.');
const out = path.resolve(process.argv[3] || '/tmp/webapp-quality');
fs.mkdirSync(out, { recursive: true });
const PORT = 8790;

function playwright() {
  try { return createRequire(import.meta.url)('playwright'); } catch (e) { /* global suchen */ }
  return createRequire(execSync('npm root -g').toString().trim() + '/')('playwright');
}
const { chromium } = playwright();
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: dir, stdio: 'ignore' });
await new Promise(r => setTimeout(r, 800));

const findings = [];
const add = (area, text) => findings.push({ area, text });

const browser = await chromium.launch();
for (const [name, w, h] of [['iphone-15', 393, 852], ['iphone-se', 375, 667]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error') add('Fehler', `${name}: Konsole: ${m.text().slice(0, 160)}`); });
  page.on('pageerror', e => add('Fehler', `${name}: Seitenfehler: ${e.message.slice(0, 160)}`));
  page.on('dialog', d => d.accept());
  await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'networkidle' }).catch(e => add('Fehler', `${name}: Seite lädt nicht: ${e.message.slice(0, 120)}`));
  await page.waitForTimeout(500);
  const r = await page.evaluate(() => {
    const vis = el => { const b = el.getBoundingClientRect(); const s = getComputedStyle(el); return b.width > 0 && b.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
    const label = el => (el.getAttribute('aria-label') || el.textContent || el.id || el.className || el.tagName).toString().trim().slice(0, 40);
    const small = [...document.querySelectorAll('button, a[href], [role=button], input, select, textarea, summary')].filter(vis)
      .filter(el => { const b = el.getBoundingClientRect(); return b.width < 44 || b.height < 44; }).map(label);
    const smallFont = [...document.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=range]), select, textarea')].filter(vis)
      .filter(el => parseFloat(getComputedStyle(el).fontSize) < 16).map(label);
    const noLabel = [...document.querySelectorAll('input, select, textarea')].filter(vis)
      .filter(el => !el.labels?.length && !el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby') && el.type !== 'hidden').map(label);
    const iconBtn = [...document.querySelectorAll('button, [role=button]')].filter(vis)
      .filter(el => !el.textContent.trim() && !el.getAttribute('aria-label') && !el.getAttribute('title')).map(label);
    const noAlt = [...document.querySelectorAll('img:not([alt])')].map(el => el.getAttribute('src'));
    const hscroll = document.documentElement.scrollWidth > window.innerWidth + 1;
    const clipped = [...document.querySelectorAll('body *')].filter(vis).filter(el => { const b = el.getBoundingClientRect(); return b.right > window.innerWidth + 2 && getComputedStyle(el).position !== 'fixed'; }).slice(0, 5).map(label);
    const meta = document.querySelector('meta[name=viewport]')?.content || '';
    return {
      small: small.length, smallEx: small.slice(0, 5), smallFont: smallFont.length, smallFontEx: smallFont.slice(0, 3),
      noLabel: noLabel.length, noLabelEx: noLabel.slice(0, 3), iconBtn: iconBtn.length, iconBtnEx: iconBtn.slice(0, 3), noAlt: noAlt.length,
      hscroll, clipped, meta,
      cover: /viewport-fit=cover/.test(meta), noZoom: /user-scalable\s*=\s*no|maximum-scale\s*=\s*1(\.0)?(,|$)/.test(meta),
      manifest: !!document.querySelector('link[rel=manifest]'), touchIcon: !!document.querySelector('link[rel=apple-touch-icon]'),
      themeColor: !!document.querySelector('meta[name=theme-color]'), standalone: !!document.querySelector('meta[name=apple-mobile-web-app-capable], meta[name=mobile-web-app-capable]'),
      safeArea: [...document.styleSheets].some(s => { try { return [...s.cssRules].some(r => /safe-area-inset/.test(r.cssText)); } catch (e) { return false; } }),
      reducedMotion: [...document.styleSheets].some(s => { try { return [...s.cssRules].some(r => /prefers-reduced-motion/.test(r.cssText)); } catch (e) { return false; } }),
    };
  });
  if (r.small) add('Bedienung', `${name}: ${r.small} Tippflächen unter 44×44 px, z. B. ${r.smallEx.join(' | ')}`);
  if (r.smallFont) add('Bedienung', `${name}: ${r.smallFont} Eingabefelder unter 16 px Schrift (iPhone zoomt), z. B. ${r.smallFontEx.join(' | ')}`);
  if (r.noLabel) add('Bedienung', `${name}: ${r.noLabel} Eingabefelder ohne Label, z. B. ${r.noLabelEx.join(' | ')}`);
  if (r.iconBtn) add('Bedienung', `${name}: ${r.iconBtn} Buttons nur mit Symbol und ohne aria-label/title`);
  if (r.noAlt) add('Bedienung', `${name}: ${r.noAlt} Bilder ohne alt`);
  if (r.hscroll) add('Darstellung', `${name}: Seite scrollt waagrecht`);
  if (r.clipped.length) add('Darstellung', `${name}: Elemente ragen rechts heraus: ${r.clipped.join(' | ')}`);
  if (r.noZoom) add('Bedienung', `${name}: Zoomen per viewport gesperrt`);
  if (name === 'iphone-15') {
    if (!r.manifest) add('PWA', 'kein Manifest');
    if (!r.touchIcon) add('PWA', 'kein apple-touch-icon');
    if (!r.standalone) add('PWA', 'kein apple-mobile-web-app-capable');
    if (!r.themeColor) add('PWA', 'kein theme-color');
    if (!r.cover) add('Darstellung', 'viewport-fit=cover fehlt');
    if (r.cover && !r.safeArea) add('Darstellung', 'viewport-fit=cover, aber kein env(safe-area-inset-*) in den Styles');
    if (!r.reducedMotion) add('Design', 'kein prefers-reduced-motion in den Styles');
  }
  await page.screenshot({ path: path.join(out, `${name}.png`) });
  await ctx.close();
}
await browser.close();
srv.kill();

// Statische Sicherheits-Greps
const files = [];
(function walk(d) { for (const f of fs.readdirSync(d, { withFileTypes: true })) {
  if (['node_modules', '.git', 'vendor', 'ocr'].includes(f.name)) continue;
  const p = path.join(d, f.name); if (f.isDirectory()) walk(p); else if (/\.(js|mjs|html)$/.test(f.name) && fs.statSync(p).size < 600000) files.push(p);
} })(dir);
let inner = 0, evalN = 0; const secrets = [];
for (const f of files) {
  const t = fs.readFileSync(f, 'utf8');
  inner += (t.match(/\.innerHTML\s*[+]?=|insertAdjacentHTML/g) || []).length;
  evalN += (t.match(/\beval\(|new Function\(/g) || []).length;
  if (/ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{20,}/.test(t)) secrets.push(path.relative(dir, f));
}
if (secrets.length) add('Sicherheit', `Mögliche Schlüssel in: ${secrets.join(', ')}`);
if (evalN) add('Sicherheit', `${evalN}× eval/new Function`);
if (inner) add('Sicherheit', `${inner} Stellen mit innerHTML/insertAdjacentHTML – prüfen, ob Daten aus Importen/Blöcken/Eingaben ungeprüft hineinkommen`);

const order = ['Fehler', 'Darstellung', 'Bedienung', 'PWA', 'Sicherheit', 'Design'];
console.log(`Webapp-Check: ${dir}\nScreenshots: ${out}`);
for (const a of order) {
  const f = findings.filter(x => x.area === a);
  console.log(`\n[${f.length ? 'GELB/ROT' : 'GRÜN'}] ${a}`); f.forEach(x => console.log('  - ' + x.text));
}
