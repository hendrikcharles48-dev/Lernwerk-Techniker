"""Bausteine für die Lernwerk-Skizzen. Die Farben kommen aus der App (css/app.css, Klassen .sk ...),
so passen die Bilder zu Hell und Dunkel.

Klassen: l Linie, d Hilfslinie gestrichelt, r rot (Kräfte), b blau, g grün, o orange, p lila,
fl Fläche grau, fb Fläche blau, fr Fläche rot, fg Fläche grün, fo Fläche orange.
Text: t normal, t2 klein grau, rt rot, bt blau, gt grün, ot orange.
"""
import math, os, json, re
from xml.sax.saxutils import escape

ZIEL = os.path.join(os.path.dirname(__file__), '..', '..', 'inhalte', 'bilder')
INDEX = {}

class Sk:
    def __init__(self, w=360, h=220):
        self.w, self.h, self.e = w, h, []
    def add(self, s): self.e.append(s); return self
    def line(self, x1, y1, x2, y2, c='l', w=None):
        return self.add(f'<line class="{c}" x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}"' + (f' style="stroke-width:{w}"' if w else '') + '/>')
    def path(self, d, c='l'): return self.add(f'<path class="{c}" d="{d}"/>')
    def poly(self, pts, c='l', closed=True):
        tag = 'polygon' if closed else 'polyline'
        return self.add(f'<{tag} class="{c}" points="' + ' '.join(f'{x:.1f},{y:.1f}' for x, y in pts) + '"/>')
    def rect(self, x, y, w, h, c='l', rx=0): return self.add(f'<rect class="{c}" x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}"/>')
    def circle(self, x, y, r, c='l'): return self.add(f'<circle class="{c}" cx="{x}" cy="{y}" r="{r}"/>')
    def text(self, x, y, s, c='t', a='middle', size=None, bold=None):
        st = (f'font-size:{size}px;' if size else '') + ('font-weight:700;' if bold else '')
        # F_x wird zu F mit tiefgestelltem x
        inhalt = re.sub(r'([A-Za-zσταμΔ])_([A-Za-z0-9]+)', lambda m: m.group(1) + f'<tspan dy="4" style="font-size:0.75em">{m.group(2)}</tspan><tspan dy="-4">\u200b</tspan>', escape(s))
        return self.add(f'<text class="{c}" x="{x}" y="{y}" text-anchor="{a}"' + (f' style="{st}"' if st else '') + f'>{inhalt}</text>')
    def head(self, x1, y1, x2, y2, c='r', size=9):
        a = math.atan2(y2 - y1, x2 - x1)
        p = [(x2, y2), (x2 - size * math.cos(a - 0.4), y2 - size * math.sin(a - 0.4)), (x2 - size * math.cos(a + 0.4), y2 - size * math.sin(a + 0.4))]
        return self.poly(p, c + 'f')
    def arrow(self, x1, y1, x2, y2, c='r', size=9, w=None):
        a = math.atan2(y2 - y1, x2 - x1)
        self.line(x1, y1, x2 - size * 0.8 * math.cos(a), y2 - size * 0.8 * math.sin(a), c, w)
        return self.head(x1, y1, x2, y2, c, size)
    def darrow(self, x1, y1, x2, y2, c='l', size=7):
        self.arrow(x1, y1, x2, y2, c, size)
        return self.head(x2, y2, x1, y1, c, size)
    def mass(self, x1, y1, x2, y2, s, off=0, c='t2'):
        """Maßpfeil mit Beschriftung in der Mitte."""
        self.darrow(x1, y1, x2, y2, 'd2', 6)
        return self.text((x1 + x2) / 2 + (off if y1 == y2 else 8), (y1 + y2) / 2 - (6 if y1 == y2 else -4), s, c, 'middle' if y1 == y2 else 'start')
    def ground(self, x1, x2, y, down=True):
        self.line(x1, y, x2, y)
        n = int((x2 - x1) / 8)
        for i in range(n + 1):
            x = x1 + i * 8
            self.line(x, y, x - 6, y + (7 if down else -7), 'l', 1.2)
        return self
    def festlager(self, x, y):
        self.poly([(x, y), (x - 11, y + 16), (x + 11, y + 16)], 'l')
        self.circle(x, y, 3, 'fl')
        return self.ground(x - 16, x + 16, y + 16)
    def loslager(self, x, y):
        self.poly([(x, y), (x - 11, y + 14), (x + 11, y + 14)], 'l')
        self.circle(x - 6, y + 18, 3.2); self.circle(x + 6, y + 18, 3.2)
        return self.ground(x - 16, x + 16, y + 22)
    def einspannung(self, x, y1, y2):
        self.line(x, y1, x, y2, 'l', 3)
        for i in range(int((y2 - y1) / 8) + 1):
            self.line(x, y1 + i * 8, x - 7, y1 + i * 8 + 6, 'l', 1.2)
        return self
    def widerstand(self, x, y, horizontal=True, name='', l=40, t=14):
        if horizontal: self.rect(x - l / 2, y - t / 2, l, t, 'l bgf'); n = (x, y - t / 2 - 6)
        else: self.rect(x - t / 2, y - l / 2, t, l, 'l bgf'); n = (x + t / 2 + 6, y + 4)
        if name: self.text(n[0], n[1], name, 't', 'middle' if horizontal else 'start')
        return self
    def quelle(self, x, y, name='U'):
        self.circle(x, y, 13, 'l bgf'); self.line(x, y - 13, x, y + 13)
        return self.text(x - 20, y + 4, name, 't', 'end')
    def punkt(self, x, y, c='l'): return self.circle(x, y, 3.2, 'lf' if c == 'l' else c + 'f')
    def achsen(self, x0, y0, x1, y1, xl='', yl=''):
        self.arrow(x0, y0, x1, y0, 'l', 8); self.arrow(x0, y0, x0, y1, 'l', 8)
        if xl: self.text(x1, y0 + 16, xl, 't2', 'end')
        if yl: self.text(x0 + 6, y1 + 4, yl, 't2', 'start')
        return self
    def kurve(self, f, xa, xb, sx, sy, ox, oy, c='b', n=60):
        pts = [(ox + (xa + (xb - xa) * i / n) * sx, oy - f(xa + (xb - xa) * i / n) * sy) for i in range(n + 1)]
        return self.poly(pts, c, closed=False)
    def svg(self, label):
        return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {self.w} {self.h}" role="img" aria-label="{escape(label)}">'
                + ''.join(self.e) + '</svg>')

def speichern(tid, name, sk, unterschrift):
    os.makedirs(ZIEL, exist_ok=True)
    with open(os.path.join(ZIEL, name + '.svg'), 'w') as f: f.write(sk.svg(unterschrift))
    INDEX.setdefault(tid, []).append({'datei': name + '.svg', 'text': unterschrift})

def index_schreiben():
    with open(os.path.join(ZIEL, 'index.json'), 'w') as f: json.dump(INDEX, f, ensure_ascii=False, indent=1)
