"""Skizzen Technische Mechanik und Maschinenelemente."""
import math
from sk import Sk, speichern

def kraefte_zerlegen():
    s = Sk(360, 220)
    ox, oy, a, F = 130, 180, math.radians(35), 175
    fx, fy = ox + F * math.cos(a), oy - F * math.sin(a)
    s.line(ox - 20, oy, 330, oy, 'd'); s.line(ox, oy + 15, ox, 20, 'd')
    s.line(fx, fy, fx, oy, 'd'); s.line(fx, fy, ox, fy, 'd')
    s.arrow(ox, oy, fx, oy, 'b'); s.text((ox + fx) / 2, oy + 20, 'F_x = F · cos α', 'bt')
    s.arrow(ox, oy, ox, fy, 'g'); s.text(ox - 8, (oy + fy) / 2, 'F_y = F · sin α', 'gt', 'end')
    s.arrow(ox, oy, fx, fy, 'r', 11); s.text(fx - 40, fy - 14, 'F', 'rt', size=16)
    s.path(f'M {ox + 45} {oy} A 45 45 0 0 0 {ox + 45 * math.cos(a):.1f} {oy - 45 * math.sin(a):.1f}', 'l')
    s.text(ox + 58, oy - 12, 'α')
    s.punkt(ox, oy)
    speichern('tm-zentrales-kraeftesystem', 'tm-kraft-zerlegen', s, 'Eine schräge Kraft F wird in zwei Teile zerlegt: F_x = F · cos α waagerecht und F_y = F · sin α senkrecht. Zusammen ergeben sie wieder F, nach Pythagoras F = √(F_x² + F_y²).')

def hebel():
    s = Sk(360, 200)
    s.line(60, 110, 310, 110, 'l', 6)
    s.poly([(80, 116), (66, 142), (94, 142)], 'l'); s.ground(60, 100, 142)
    s.punkt(80, 110)
    s.arrow(280, 40, 280, 104, 'r', 11); s.text(292, 58, 'F', 'rt', 'start', 16)
    s.mass(80, 165, 280, 165, 'Hebelarm l')
    s.path('M 52 82 A 40 40 0 0 1 108 82', 'b'); s.head(100, 76, 110, 84, 'b')
    s.text(80, 66, 'M = F · l', 'bt')
    s.text(80, 190, 'Drehpunkt', 't2')
    speichern('tm-momente', 'tm-hebel', s, 'Moment am Hebel: Die Kraft F wirkt im Abstand l vom Drehpunkt. M = F · l. Es zählt nur der senkrechte Abstand zwischen Wirklinie und Drehpunkt.')

def lager():
    s = Sk(360, 220)
    s.line(50, 100, 310, 100, 'l', 6)
    s.festlager(60, 104); s.loslager(300, 104)
    s.text(60, 168, 'Festlager A', 't2'); s.text(300, 168, 'Loslager B', 't2')
    s.arrow(200, 30, 200, 94, 'r', 11); s.text(212, 44, 'F', 'rt', 'start', 15)
    s.arrow(60, 158, 60, 112, 'b'); s.text(44, 140, 'F_Ay', 'bt', 'end')
    s.arrow(14, 100, 46, 100, 'b'); s.text(18, 92, 'F_Ax', 'bt', 'start')
    s.arrow(300, 158, 300, 112, 'b'); s.text(316, 140, 'F_B', 'bt', 'start')
    s.mass(60, 198, 200, 198, 'a'); s.mass(200, 198, 300, 198, 'b')
    speichern('tm-lagerkraefte', 'tm-lager', s, 'Balken auf zwei Lagern: Das Festlager A nimmt eine waagerechte und eine senkrechte Kraft auf, das Loslager B nur eine senkrechte. Mit ΣM um A = 0 bekommst du F_B = F · a / (a + b).')

def streckenlast():
    s = Sk(360, 220)
    s.line(50, 130, 310, 130, 'l', 6)
    s.festlager(60, 134); s.loslager(300, 134)
    s.rect(80, 70, 180, 22, 'fo')
    for i in range(10):
        x = 86 + i * 18.5
        s.arrow(x, 72, x, 124, 'o', 6)
    s.line(80, 70, 260, 70, 'o'); s.text(118, 62, 'q in N/m', 'ot')
    s.arrow(170, 20, 170, 54, 'r', 10); s.text(182, 32, 'F_q = q · l', 'rt', 'start')
    s.line(170, 54, 170, 124, 'd')
    s.mass(80, 200, 260, 200, 'l')
    s.text(170, 216, 'F_q greift in der Mitte der Last an', 't2')
    speichern('tm-allgemeines-kraeftesystem-und-streckenla', 'tm-streckenlast', s, 'Streckenlast: Die Last q ist auf die Länge l verteilt. Für die Rechnung ersetzt du sie durch eine Kraft F_q = q · l in der Mitte der belasteten Länge.')

def reibung():
    s = Sk(360, 230)
    a = math.radians(25)
    x0, y0, L = 30, 200, 320
    s.poly([(x0, y0), (x0 + L, y0), (x0 + L, y0 - L * math.tan(a))], 'fl')
    s.line(x0, y0, x0 + L, y0 - L * math.tan(a)); s.line(x0, y0, x0 + L, y0)
    s.path(f'M {x0 + 50} {y0} A 50 50 0 0 0 {x0 + 50 * math.cos(a):.1f} {y0 - 50 * math.sin(a):.1f}', 'l'); s.text(x0 + 62, y0 - 8, 'α')
    # Klotz auf der Schräge
    cx, cy = x0 + 170 * math.cos(a), y0 - 170 * math.sin(a)
    ux, uy = math.cos(a), -math.sin(a)          # die Schräge hinauf
    nx, ny = -math.sin(a), -math.cos(a)         # senkrecht von der Schräge weg
    b, h = 60, 36
    pts = [(cx - ux * b / 2, cy - uy * b / 2), (cx + ux * b / 2, cy + uy * b / 2)]
    pts += [(pts[1][0] + nx * h, pts[1][1] + ny * h), (pts[0][0] + nx * h, pts[0][1] + ny * h)]
    s.poly(pts, 'l bgf')
    mx, my = cx + nx * h / 2, cy + ny * h / 2
    s.arrow(mx, my, mx, my + 70, 'r'); s.text(mx + 6, my + 74, 'F_G', 'rt', 'start')
    s.arrow(cx, cy, cx + nx * 64, cy + ny * 64, 'b'); s.text(cx + nx * 64 - 4, cy + ny * 64 - 6, 'F_N', 'bt', 'end')
    s.arrow(mx, my, mx - ux * 70, my - uy * 70, 'o'); s.text(mx - ux * 70 - 4, my - uy * 70 + 16, 'F_H', 'ot', 'end')
    s.arrow(cx + ux * b / 2, cy + uy * b / 2, cx + ux * (b / 2 + 60), cy + uy * (b / 2 + 60), 'g'); s.text(cx + ux * (b / 2 + 60) + 4, cy + uy * (b / 2 + 60) + 16, 'F_R = μ · F_N', 'gt', 'start')
    speichern('tm-reibung', 'tm-schiefe-ebene', s, 'Klotz auf der schiefen Ebene: Die Gewichtskraft F_G teilt sich in die Normalkraft F_N = F_G · cos α und den Hangabtrieb F_H = F_G · sin α. Die Reibung F_R = μ · F_N wirkt gegen die Bewegung.')

def zug():
    s = Sk(360, 170)
    s.rect(90, 60, 180, 40, 'fb'); s.rect(90, 60, 180, 40, 'l')
    s.arrow(90, 80, 24, 80, 'r', 11); s.text(30, 70, 'F', 'rt', size=15)
    s.arrow(270, 80, 336, 80, 'r', 11); s.text(330, 70, 'F', 'rt', size=15)
    s.line(180, 50, 180, 110, 'd')
    s.text(180, 135, 'Querschnitt A', 't2')
    s.text(180, 158, 'σ = F / A', 'bt', size=16)
    s.text(180, 40, 'gedachter Schnitt', 't2')
    speichern('tm-festigkeitslehre-zug-druck-flaechenpress', 'tm-zug', s, 'Zugstab: Die Kraft F zieht an beiden Enden. Im Schnitt verteilt sie sich auf die Fläche A. Die Zugspannung ist σ = F / A, in N/mm².')

def abscherung():
    s = Sk(360, 200)
    s.rect(40, 50, 140, 30, 'fl'); s.rect(40, 50, 140, 30, 'l')
    s.rect(180, 80, 140, 30, 'fl'); s.rect(180, 80, 140, 30, 'l')
    s.rect(165, 35, 30, 90, 'l bgf')
    s.line(150, 80, 210, 80, 'r'); s.text(222, 72, 'Scherfläche', 'rt', 'start')
    s.arrow(40, 65, 4, 65, 'b'); s.text(10, 55, 'F', 'bt', size=15)
    s.arrow(320, 95, 356, 95, 'b'); s.text(350, 85, 'F', 'bt', size=15)
    s.text(180, 160, 'Einschnittig: τ_a = F / A', 'bt')
    s.text(180, 182, 'mit A = π · d² / 4', 't2')
    speichern('tm-festigkeitslehre-zug-druck-flaechenpress', 'tm-abscherung', s, 'Abscherung: Zwei Bleche ziehen in entgegengesetzte Richtungen. Der Bolzen wird in der Fuge abgeschert. Die Scherspannung ist τ_a = F / A, bei einer Scherfläche ist A = π · d² / 4.')

def biegung():
    s = Sk(360, 220)
    s.einspannung(40, 60, 140)
    s.rect(40, 85, 200, 30, 'fl'); s.rect(40, 85, 200, 30, 'l')
    s.arrow(240, 20, 240, 80, 'r', 11); s.text(252, 34, 'F', 'rt', 'start', 15)
    s.line(30, 100, 250, 100, 'd'); s.text(140, 135, 'neutrale Faser', 't2')
    # Spannungsverteilung im Schnitt bei x = 40
    x0 = 285
    s.line(x0, 70, x0, 130, 'l')
    s.poly([(x0, 100), (x0 + 36, 70), (x0, 70)], 'fr'); s.line(x0, 70, x0 + 36, 70, 'r'); s.line(x0, 100, x0 + 36, 70, 'r')
    s.poly([(x0, 100), (x0 - 36, 130), (x0, 130)], 'fb'); s.line(x0, 130, x0 - 36, 130, 'b'); s.line(x0, 100, x0 - 36, 130, 'b')
    s.text(x0 + 18, 62, 'Zug', 'rt'); s.text(x0 - 18, 146, 'Druck', 'bt')
    s.text(x0, 180, 'σ_b = M_b / W', 'bt', size=15)
    s.text(140, 200, 'Am größten an der Einspannung: M_b = F · l', 't2')
    speichern('tm-biegung', 'tm-biegung', s, 'Biegung: Der Träger biegt sich unter F durch. Oben wird er gedehnt, das ist Zug, unten gestaucht, das ist Druck. In der Mitte liegt die neutrale Faser ohne Spannung. Am Rand ist die Spannung am größten, σ_b = M_b / W.')

def torsion():
    s = Sk(360, 190)
    s.path('M 80 60 L 280 60 M 80 130 L 280 130', 'l')
    s.path('M 80 60 A 14 35 0 0 0 80 130 A 14 35 0 0 0 80 60', 'l fl')
    s.path('M 280 60 A 14 35 0 0 1 280 130', 'l'); s.path('M 280 60 A 14 35 0 0 0 280 130', 'd')
    s.path('M 60 40 A 30 55 0 0 0 60 150', 'r'); s.head(66, 140, 60, 150, 'r')
    s.path('M 300 40 A 30 55 0 0 1 300 150', 'r'); s.head(306, 50, 300, 40, 'r')
    s.text(40, 100, 'M_t', 'rt', 'end'); s.text(320, 100, 'M_t', 'rt', 'start')
    s.line(80, 60, 280, 72, 'b'); s.text(180, 52, 'Faser wird verdreht', 'bt')
    s.text(180, 168, 'τ_t = M_t / W_p, außen am größten', 'bt')
    speichern('tm-torsion', 'tm-torsion', s, 'Torsion: Zwei gleich große, entgegengesetzte Momente M_t verdrehen die Welle. Eine gerade Linie auf der Oberfläche wird schräg. Die Spannung τ_t = M_t / W_p ist außen am größten, in der Mitte null.')

def schraube():
    s = Sk(360, 220)
    s.rect(110, 70, 140, 34, 'fl'); s.rect(110, 70, 140, 34, 'l')
    s.rect(110, 104, 140, 34, 'fl'); s.rect(110, 104, 140, 34, 'l')
    s.rect(166, 46, 28, 116, 'l bgf')
    s.rect(146, 34, 68, 18, 'l bgf'); s.rect(150, 156, 60, 18, 'l bgf')
    s.text(180, 28, 'Kopf', 't2'); s.text(180, 192, 'Mutter', 't2')
    s.arrow(230, 30, 230, 64, 'r'); s.arrow(230, 186, 230, 144, 'r')
    s.text(240, 46, 'F_V', 'rt', 'start')
    s.mass(290, 70, 290, 138, 'l_K')
    s.text(180, 212, 'F_V presst die Bleche zusammen', 't2')
    s.arrow(60, 87, 104, 87, 'b'); s.arrow(300, 121, 256, 121, 'b')
    s.text(52, 80, 'F_Q', 'bt', 'end')
    speichern('tm-me-schrauben', 'me-schraube', s, 'Schraubenverbindung: Die Vorspannkraft F_V presst die Bauteile zusammen. Querkräfte F_Q überträgt die Reibung zwischen den Blechen, nicht der Schaft. Deshalb braucht es genug Vorspannung.')

def bolzen():
    s = Sk(360, 220)
    s.rect(60, 50, 120, 26, 'fl'); s.rect(60, 50, 120, 26, 'l')
    s.rect(60, 124, 120, 26, 'fl'); s.rect(60, 124, 120, 26, 'l')
    s.rect(180, 87, 130, 26, 'fl'); s.rect(180, 87, 130, 26, 'l')
    s.rect(150, 36, 28, 128, 'l bgf'); s.rect(150, 36, 28, 128, 'l')
    s.line(134, 87, 194, 87, 'r'); s.line(134, 113, 194, 113, 'r')
    s.text(96, 104, 'Gabel', 't2'); s.text(260, 132, 'Lasche', 't2')
    s.text(204, 80, 'zwei Scherflächen', 'rt', 'start')
    s.arrow(310, 100, 350, 100, 'b'); s.text(344, 90, 'F', 'bt', size=15)
    s.text(180, 194, 'Zweischnittig: τ_a = F / (2 · A)', 'bt')
    speichern('tm-me-bolzen-stifte', 'me-bolzen', s, 'Bolzen in einer Gabel: Die Lasche zieht in der Mitte, die Gabel hält außen. Der Bolzen wird an zwei Flächen abgeschert, das ist zweischnittig. Jede Fläche trägt die Hälfte: τ_a = F / (2 · A).')

def passfeder():
    s = Sk(360, 220)
    s.circle(180, 115, 90, 'fl'); s.circle(180, 115, 90, 'l')
    s.circle(180, 115, 55, 'l bgf')
    s.rect(166, 45, 28, 30, 'fo'); s.rect(166, 45, 28, 30, 'l')
    s.line(166, 60, 194, 60, 'd')
    s.text(180, 125, 'Welle', 't2'); s.text(180, 196, 'Nabe', 't2')
    s.text(20, 34, 'Passfeder', 'ot', 'start'); s.line(86, 38, 164, 56, 'd')
    s.path('M 120 150 A 70 70 0 0 0 240 150', 'r'); s.head(228, 162, 240, 150, 'r'); s.text(252, 182, 'M_t', 'rt', 'start')
    speichern('tm-me-passfeder', 'me-passfeder', s, 'Passfeder im Querschnitt: Sie sitzt zur Hälfte in der Nut der Welle und zur Hälfte in der Nut der Nabe. So überträgt sie das Drehmoment formschlüssig. Gerechnet wird mit der Flächenpressung an der Seitenfläche.')

def waelzlager():
    s = Sk(360, 220)
    s.circle(180, 110, 90, 'fl'); s.circle(180, 110, 90, 'l'); s.circle(180, 110, 70, 'l bgf')
    s.circle(180, 110, 46, 'fl'); s.circle(180, 110, 46, 'l'); s.circle(180, 110, 30, 'l bgf')
    for i in range(10):
        w = 2 * math.pi * i / 10
        s.circle(180 + 58 * math.cos(w), 110 + 58 * math.sin(w), 11, 'l fb')
    s.arrow(180, 10, 180, 70, 'r', 10); s.text(192, 24, 'F_r radial', 'rt', 'start')
    s.text(300, 60, 'Außenring', 't2', 'start'); s.text(300, 110, 'Kugeln', 't2', 'start'); s.text(300, 160, 'Innenring', 't2', 'start')
    speichern('tm-me-waelzlager', 'me-waelzlager', s, 'Rillenkugellager: Zwischen Innenring und Außenring rollen Kugeln. Es trägt vor allem radiale Kräfte F_r. Die Lebensdauer ist L_10 = (C / P)ᵖ mit p = 3 bei Kugellagern.')

def zahnraeder():
    s = Sk(360, 220)
    s.circle(120, 110, 60, 'fb'); s.circle(120, 110, 60, 'l')
    s.circle(250, 110, 70, 'fo'); s.circle(250, 110, 70, 'l')
    s.punkt(120, 110); s.punkt(250, 110)
    s.line(120, 110, 120, 50, 'd'); s.text(110, 84, 'd₁ / 2', 't2', 'end')
    s.line(250, 110, 250, 40, 'd'); s.text(260, 76, 'd₂ / 2', 't2', 'start')
    s.mass(120, 200, 250, 200, 'Achsabstand a = (d₁ + d₂) / 2')
    s.path('M 90 160 A 55 55 0 0 1 70 120', 'b'); s.head(76, 132, 70, 120, 'b'); s.text(66, 160, 'n₁', 'bt', 'end')
    s.path('M 290 165 A 62 62 0 0 0 315 125', 'o'); s.head(308, 136, 315, 125, 'o'); s.text(320, 165, 'n₂', 'ot', 'start')
    speichern('tm-me-zahnraeder', 'me-zahnraeder', s, 'Zwei Zahnräder greifen ineinander: Die Teilkreise berühren sich. Die Drehrichtung kehrt sich um. Übersetzung i = d₂ / d₁ = n₁ / n₂, Achsabstand a = (d₁ + d₂) / 2.')

def riemen():
    s = Sk(360, 225)
    r1, r2, x1, x2, y = 40, 65, 90, 270, 100
    s.circle(x1, y, r1, 'fl'); s.circle(x1, y, r1, 'l'); s.circle(x2, y, r2, 'fl'); s.circle(x2, y, r2, 'l')
    s.punkt(x1, y); s.punkt(x2, y)
    s.line(x1, y - r1, x2, y - r2, 'r'); s.line(x1, y + r1, x2, y + r2, 'b')
    s.text(180, 30, 'Lasttrum F₁, gespannt', 'rt'); s.text(180, 186, 'Leertrum F₂, lockerer', 'bt')
    # Links gegen den Uhrzeigersinn: oben läuft der Riemen auf die treibende Scheibe zu, also ist oben gespannt
    s.path(f'M {x1 - 30} {y - 46} A 55 55 0 0 0 {x1 - 20} {y + 52}', 'l'); s.head(x1 - 34, y + 44, x1 - 20, y + 52, 'l')
    s.text(x1, y + 24, 'treibend', 't2'); s.text(x2, y + 28, 'getrieben', 't2')
    s.text(180, 214, 'Umfangskraft F_u = F₁ − F₂', 't')
    speichern('tm-me-riementrieb', 'me-riementrieb', s, 'Riementrieb: Die kleine Scheibe treibt. Der Riemen ist auf der ziehenden Seite stärker gespannt, das ist das Lasttrum mit F₁. Die andere Seite ist das Leertrum mit F₂. Die Umfangskraft ist F_u = F₁ − F₂.')

ALLE = [kraefte_zerlegen, hebel, lager, streckenlast, reibung, zug, abscherung, biegung, torsion, schraube, bolzen, passfeder, waelzlager, zahnraeder, riemen]
