// Service Worker: Offline-Nutzung und automatische Updates.
// Bei jeder Änderung VERSION erhöhen (gleicher Wert wie in js/app.js).
// Die neue Version installiert sich beim nächsten Öffnen von selbst.
const VERSION = '1.17.3';
const CACHE = 'lernwerk-' + VERSION;
const FILES = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css', 'lehrplan.json', 'lernwerk-bridge.js', 'lernwerk-speicher.js', 'js/sicherung.js', 'js/diagramm.js',
  'js/app.js', 'js/extra.js', 'js/engine.js', 'js/store.js', 'js/db.js', 'js/ui.js', 'js/parser.js',
  'js/formula.js', 'js/check.js', 'js/srs.js', 'js/speech.js', 'js/podcast.js', 'js/hoer.js', 'js/skizzen.js', 'js/util.js', 'js/mathedit.js',
  'inhalte/index.json', 'inhalte/faecher.json', 'inhalte/formeln-umstellen.txt', 'inhalte/terme.txt',
  'inhalte/mathe-grundlagen.txt', 'inhalte/mathe-aufbau.txt', 'inhalte/elektro-grundlagen.txt', 'inhalte/elektro-aufbau.txt', 'inhalte/mechanik-grundlagen.txt', 'inhalte/mechanik-aufbau.txt', 'inhalte/fertigung-wirtschaft.txt', 'inhalte/steuerung-aufbau.txt', 'inhalte/module-aufbau.txt', 'inhalte/maschinenelemente.txt', 'inhalte/vertiefung.txt', 'inhalte/leiterwiderstand.txt', 'inhalte/personal-beschaffung.txt', 'inhalte/trainer-aufgaben.txt',
  'inhalte/einfuehrung/mathematik.txt', 'inhalte/einfuehrung/elektrotechnik.txt', 'inhalte/einfuehrung/mechanik.txt',
  'inhalte/einfuehrung/toleranzen-cad-werkstoffe.txt', 'inhalte/einfuehrung/steuerung-automatisierung.txt',
  'inhalte/einfuehrung/projekte-module.txt', 'inhalte/einfuehrung/sprachen.txt',
  'icons/apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png',
  'trainer/mathe-trainieren.html', 'trainer/statik-trainer.html', 'trainer/statik-kraefte-momente.html',
  'trainer/statik-formelsammlung.html', 'trainer/statik-wandschwenkkran.html', 'trainer/et-rueckrechen-trainer.html',
  'trainer/et-rueckrechnen-lernblatt.html', 'trainer/toleranzen.html', 'trainer/toleranzen-it-ablesen.html',
  'trainer/toleranzen-passungen-lernblatt.html', 'trainer/solidworks-kuerzel.html', 'trainer/werkstoffe-eisen-kohlenstoff.html',
  'trainer/fachtrainer.css', 'js/fachtrainer.js', 'trainer/festigkeit-trainer.html', 'trainer/maschinenelemente-trainer.html',
  'trainer/elektro-trainer.html', 'trainer/steuerung-trainer.html', 'trainer/leiterwiderstand-trainer.html',
  // Skizzen
  'inhalte/bilder/index.json', 'inhalte/bilder/auto-4-20ma.svg', 'inhalte/bilder/auto-regelkreis.svg', 'inhalte/bilder/et-drehstrom.svg', 'inhalte/bilder/et-gemischt.svg', 'inhalte/bilder/et-kirchhoff.svg', 'inhalte/bilder/et-kondensator-laden.svg', 'inhalte/bilder/et-leiter.svg', 'inhalte/bilder/et-ohm.svg', 'inhalte/bilder/et-reihe-parallel.svg', 'inhalte/bilder/et-spannungsteiler.svg', 'inhalte/bilder/et-spule-einschalten.svg', 'inhalte/bilder/et-wechselstrom.svg', 'inhalte/bilder/et-wirkungsgrad.svg', 'inhalte/bilder/m6-bedarfsschema.svg', 'inhalte/bilder/m7-ishikawa.svg', 'inhalte/bilder/m7-pdca.svg', 'inhalte/bilder/m7-prozessfaehigkeit.svg', 'inhalte/bilder/m8-abc.svg', 'inhalte/bilder/m8-andler.svg', 'inhalte/bilder/m8-drei-saeulen.svg', 'inhalte/bilder/m8-gewinnschwelle.svg', 'inhalte/bilder/m8-organigramme.svg', 'inhalte/bilder/m8-strukturbaum.svg', 'inhalte/bilder/ma-ableitung.svg', 'inhalte/bilder/ma-binom.svg', 'inhalte/bilder/ma-dreieck.svg', 'inhalte/bilder/ma-gerade.svg', 'inhalte/bilder/ma-lgs.svg', 'inhalte/bilder/ma-mengen.svg', 'inhalte/bilder/ma-parabel.svg', 'inhalte/bilder/ma-wachstum.svg', 'inhalte/bilder/me-bolzen.svg', 'inhalte/bilder/me-passfeder.svg', 'inhalte/bilder/me-riementrieb.svg', 'inhalte/bilder/me-schraube.svg', 'inhalte/bilder/me-waelzlager.svg', 'inhalte/bilder/me-zahnraeder.svg', 'inhalte/bilder/pm-dual.svg', 'inhalte/bilder/pm-gantt.svg', 'inhalte/bilder/st-grafcet.svg', 'inhalte/bilder/st-logik.svg', 'inhalte/bilder/st-selbsthaltung.svg', 'inhalte/bilder/st-wegeventil.svg', 'inhalte/bilder/st-zylinder.svg', 'inhalte/bilder/tm-abscherung.svg', 'inhalte/bilder/tm-biegung.svg', 'inhalte/bilder/tm-hebel.svg', 'inhalte/bilder/tm-kraft-zerlegen.svg', 'inhalte/bilder/tm-lager.svg', 'inhalte/bilder/tm-schiefe-ebene.svg', 'inhalte/bilder/tm-streckenlast.svg', 'inhalte/bilder/tm-torsion.svg', 'inhalte/bilder/tm-zug.svg', 'inhalte/bilder/tol-passungen.svg', 'inhalte/bilder/tol-rahmen.svg', 'inhalte/bilder/ws-eisen-kohlenstoff.svg', 'inhalte/bilder/ws-haerten.svg', 'inhalte/bilder/ws-zugversuch.svg'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('lernwerk-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('message', e => { if (e.data === 'skipWaiting') self.skipWaiting(); });

// Podcast-Folgen: eigener Cache, der Updates überlebt. Offline gespeichert wird nur, was man im Hörmodus lädt.
// Safari spielt Audio nur mit Teilantworten (206), deshalb wird die Range aus dem Cache geschnitten.
const AUDIO = 'hoer-audio';
async function audioAntwort(req) {
  const c = await caches.open(AUDIO);
  const hit = await c.match(req.url);
  if (!hit) return fetch(req);
  const range = req.headers.get('range');
  if (!range) return hit;
  const buf = await hit.arrayBuffer();
  const m = /bytes=(\d*)-(\d*)/.exec(range) || [];
  const start = m[1] ? +m[1] : 0, end = m[2] ? Math.min(+m[2], buf.byteLength - 1) : buf.byteLength - 1;
  return new Response(buf.slice(start, end + 1), { status: 206, headers: {
    'Content-Type': hit.headers.get('Content-Type') || 'audio/mp4', 'Content-Range': `bytes ${start}-${end}/${buf.byteLength}`,
    'Content-Length': String(end - start + 1), 'Accept-Ranges': 'bytes' } });
}

// Erst Cache, dann Netz. Seiten ohne Treffer fallen auf index.html zurück.
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const path = new URL(req.url).pathname;
  if (/\/audio\/[^/]+\.m4a$/.test(path)) { e.respondWith(audioAntwort(req)); return; }
  // Liste der Folgen: erst Netz, damit neue Folgen ankommen, sonst Cache
  if (/\/audio\/folgen\.json$/.test(path)) {
    e.respondWith(caches.open(AUDIO).then(async c => { try { const r = await fetch(req, { cache: 'no-cache' }); if (r.ok) c.put(req.url, r.clone()); return r; } catch (err) { return (await c.match(req.url)) || Response.error(); } }));
    return;
  }
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
