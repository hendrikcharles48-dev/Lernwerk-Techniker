// Eingefügte Zeichnungen (SVG) bereinigen, bevor sie gespeichert oder angezeigt werden.
// Im Browser per DOMParser (image/svg+xml). Ohne DOMParser, zum Beispiel in den Tests unter Node,
// greift eine einfachere Bereinigung mit regulären Ausdrücken.
//
// Entfernt: script, foreignObject, iframe, alle anderen unbekannten Elemente, image mit Quelle von außen,
// alle on…-Attribute, href und xlink:href, die nicht mit # beginnen, style-Attribute mit url(.
// Erlaubt bleiben normale Formen, Text, Gruppen, defs, marker und die class-Attribute (Farben der App, .sk).

const ERLAUBT = new Set(['svg', 'g', 'defs', 'marker', 'path', 'polygon', 'polyline', 'line', 'rect', 'circle', 'ellipse',
  'text', 'tspan', 'title', 'desc', 'symbol', 'use', 'clippath', 'mask', 'lineargradient', 'radialgradient', 'stop', 'pattern', 'image', 'a']);
// a bleibt nur als Gruppe: sein Verweis nach außen fällt weg wie jedes andere fremde href
const SVG_NS = 'http://www.w3.org/2000/svg';

// Steht nach dem Trennstrich ein vollständiges SVG?
export const istSvg = s => /^\s*<svg[\s>][\s\S]*<\/svg>\s*$/i.test(String(s || ''));

const hrefOk = v => String(v || '').trim().startsWith('#');
const attrWeg = (name, wert) => {
  const n = name.toLowerCase();
  if (/^on/.test(n)) return true;
  if (n === 'href' || n === 'xlink:href' || n.endsWith(':href')) return !hrefOk(wert);
  if (n === 'style' && /url\s*\(/i.test(wert)) return true;
  if (/^\s*(javascript|data|vbscript):/i.test(wert)) return true;
  return false;
};

function mitDom(text) {
  // Viele SVGs aus dem Chat lassen die Namensräume weg. Ohne sie wäre im XML nichts ein SVG-Element.
  if (!/^<svg[^>]*\sxmlns\s*=/i.test(text)) text = text.replace(/^<svg/i, '<svg xmlns="' + SVG_NS + '"');
  if (/xlink:/i.test(text) && !/^<svg[^>]*\sxmlns:xlink\s*=/i.test(text)) text = text.replace(/^<svg/i, '<svg xmlns:xlink="http://www.w3.org/1999/xlink"');
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  const root = doc.documentElement;
  if (!root || root.nodeName.toLowerCase() !== 'svg' || doc.getElementsByTagName('parsererror').length) return '';
  const gehen = el => {
    for (const kind of [...el.children]) {
      const n = kind.localName.toLowerCase();
      // image nur mit Verweis innerhalb der Zeichnung, sonst weg
      const bildVonAussen = n === 'image' && !hrefOk(kind.getAttribute('href') || kind.getAttributeNS('http://www.w3.org/1999/xlink', 'href'));
      if (!ERLAUBT.has(n) || kind.namespaceURI !== SVG_NS || bildVonAussen) { kind.remove(); continue; }
      gehen(kind);
    }
    for (const a of [...el.attributes]) if (attrWeg(a.name, a.value)) el.removeAttributeNode(a);
  };
  gehen(root);
  return new XMLSerializer().serializeToString(root);
}

function ohneDom(text) {
  let s = String(text);
  // Ganze Elemente mit Inhalt entfernen
  for (const tag of ['script', 'foreignObject', 'iframe', 'style']) s = s.replace(new RegExp('<' + tag + '\\b[\\s\\S]*?(?:<\\/' + tag + '\\s*>|\\/>)', 'gi'), '');
  s = s.replace(/<\/?(?:script|foreignObject|iframe)\b[^>]*>/gi, '');
  // image mit Quelle von außen
  s = s.replace(/<image\b[^>]*>(?:[\s\S]*?<\/image>)?/gi, m => (/\bhref\s*=\s*["']\s*#/i.test(m) ? m : ''));
  // Attribute: on…, fremde href, style mit url(, javascript:
  s = s.replace(/\s([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/g, (m, name, wert) => (attrWeg(name, wert.replace(/^["']|["']$/g, '')) ? '' : m));
  return istSvg(s) ? s.trim() : '';
}

export function bereinigen(text) {
  if (!istSvg(text)) return '';
  try {
    if (typeof DOMParser !== 'undefined' && typeof XMLSerializer !== 'undefined') return mitDom(String(text).trim());
  } catch (e) { return ''; }
  return ohneDom(text);
}
