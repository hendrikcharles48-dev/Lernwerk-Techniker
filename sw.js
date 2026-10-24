// Service Worker: Offline-Nutzung und automatische Updates.
// Bei jeder Änderung VERSION erhöhen (gleicher Wert wie in js/app.js).
// Die neue Version installiert sich beim nächsten Öffnen von selbst.
const VERSION = '1.5.1';
const CACHE = 'lernwerk-' + VERSION;
const FILES = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css', 'lehrplan.json', 'lernwerk-bridge.js',
  'js/app.js', 'js/extra.js', 'js/engine.js', 'js/store.js', 'js/db.js', 'js/ui.js', 'js/parser.js',
  'js/formula.js', 'js/check.js', 'js/srs.js', 'js/speech.js', 'js/util.js', 'js/mathedit.js',
  'inhalte/index.json', 'inhalte/faecher.json', 'inhalte/formeln-umstellen.txt', 'inhalte/terme.txt',
  'inhalte/mathe-grundlagen.txt', 'inhalte/elektro-grundlagen.txt', 'inhalte/mechanik-grundlagen.txt',
  'inhalte/einfuehrung/mathematik.txt', 'inhalte/einfuehrung/elektrotechnik.txt', 'inhalte/einfuehrung/mechanik.txt',
  'inhalte/einfuehrung/toleranzen-cad-werkstoffe.txt', 'inhalte/einfuehrung/steuerung-automatisierung.txt',
  'inhalte/einfuehrung/projekte-module.txt', 'inhalte/einfuehrung/sprachen.txt',
  'icons/apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png',
  'trainer/mathe-trainieren.html', 'trainer/statik-trainer.html', 'trainer/statik-kraefte-momente.html',
  'trainer/statik-formelsammlung.html', 'trainer/statik-wandschwenkkran.html', 'trainer/et-rueckrechen-trainer.html',
  'trainer/et-rueckrechnen-lernblatt.html', 'trainer/toleranzen.html', 'trainer/toleranzen-it-ablesen.html',
  'trainer/toleranzen-passungen-lernblatt.html', 'trainer/solidworks-kuerzel.html', 'trainer/werkstoffe-eisen-kohlenstoff.html'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('lernwerk-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('message', e => { if (e.data === 'skipWaiting') self.skipWaiting(); });

// Erst Cache, dann Netz. Seiten ohne Treffer fallen auf index.html zurück.
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(async c => {
    const hit = await c.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res.ok && res.type === 'basic') c.put(req, res.clone());
      return res;
    } catch (err) {
      if (req.mode === 'navigate') return (await c.match('index.html')) || Response.error();
      return Response.error();
    }
  }));
});
