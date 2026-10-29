"""Skizzen Elektrotechnik, Messtechnik und Regelungstechnik."""
import math
from sk import Sk, speichern

def kreis(s, x1, y1, x2, y2):
    s.rect(x1, y1, x2 - x1, y2 - y1, 'l')

def ohm():
    s = Sk(360, 210)
    kreis(s, 70, 40, 290, 170)
    s.quelle(70, 105, 'U')
    s.widerstand(290, 105, False, 'R', 56, 18)
    s.arrow(150, 40, 210, 40, 'r'); s.text(180, 30, 'I', 'rt', size=15)
    s.arrow(320, 70, 320, 140, 'b'); s.text(328, 110, 'U', 'bt', 'start')
    s.text(180, 112, 'U = R · I', 't', size=18)
    s.text(180, 196, 'Mehr Spannung, mehr Strom. Mehr Widerstand, weniger Strom.', 't2')
    speichern('et-ohmsches-gesetz', 'et-ohm', s, 'Einfacher Stromkreis: Die Quelle treibt den Strom I durch den Widerstand R. An R fällt die Spannung U ab. Das ohmsche Gesetz: U = R · I, also I = U / R.')

def leiter():
    s = Sk(360, 190)
    s.rect(70, 70, 230, 40, 'fo'); s.line(70, 70, 300, 70); s.line(70, 110, 300, 110)
    s.path('M 70 70 A 12 20 0 0 0 70 110 A 12 20 0 0 0 70 70', 'l fo')
    s.path('M 300 70 A 12 20 0 0 1 300 110', 'l')
    s.text(52, 96, 'A', 'ot', 'end', 16)
    s.mass(70, 140, 300, 140, 'Länge l')
    s.text(185, 175, 'R = ρ · l / A', 'bt', size=16)
    s.text(185, 50, 'Werkstoff mit ρ, Kupfer 0,0178 Ω · mm² / m', 't2')
    speichern('et-leiterwiderstand', 'et-leiter', s, 'Ein Draht mit Länge l und Querschnitt A: Je länger, desto größer der Widerstand. Je dicker, desto kleiner. R = ρ · l / A, mit ρ vom Werkstoff.')

def reihe_parallel():
    s = Sk(360, 220)
    # Reihe links
    s.rect(40, 50, 120, 120, 'l'); s.quelle(40, 110, 'U')
    s.widerstand(80, 50, True, 'R₁', 32, 14); s.widerstand(128, 50, True, 'R₂', 32, 14)
    s.arrow(160, 90, 160, 140, 'r'); s.text(150, 120, 'I', 'rt', 'end')
    s.text(100, 196, 'Reihe: R = R₁ + R₂', 't'); s.text(100, 212, 'gleicher Strom überall', 't2')
    # Parallel rechts
    s.rect(210, 50, 120, 120, 'l'); s.quelle(210, 110, 'U')
    s.line(270, 50, 270, 170); s.widerstand(270, 110, False, 'R₁', 36, 14); s.widerstand(330, 110, False, 'R₂', 36, 14)
    s.punkt(270, 50); s.punkt(270, 170)
    s.text(270, 196, 'Parallel: 1/R = 1/R₁ + 1/R₂', 't'); s.text(270, 212, 'gleiche Spannung an jedem', 't2')
    speichern('et-reihen-und-parallelschaltung', 'et-reihe-parallel', s, 'Links in Reihe: Der Strom geht nacheinander durch beide Widerstände, R = R₁ + R₂. Rechts parallel: Jeder Widerstand liegt an derselben Spannung, 1 / R = 1 / R₁ + 1 / R₂.')

def gemischt():
    s = Sk(360, 210)
    s.rect(40, 50, 280, 120, 'l'); s.quelle(40, 110, 'U')
    s.widerstand(120, 50, True, 'R₁', 44, 16)
    s.line(230, 50, 230, 170); s.punkt(230, 50); s.punkt(230, 170)
    s.widerstand(230, 110, False, 'R₂', 40, 16); s.widerstand(320, 110, False, 'R₃', 40, 16)
    s.rect(212, 38, 126, 144, 'd')
    s.text(275, 30, 'erst die Gruppe', 't2')
    s.text(180, 200, 'R_ges = R₁ + R₂ · R₃ / (R₂ + R₃)', 'bt')
    speichern('et-gemischte-schaltungen', 'et-gemischt', s, 'Gemischte Schaltung: R₂ und R₃ sind parallel, das ist die Gruppe. Erst die Gruppe ausrechnen, R₂₃ = R₂ · R₃ / (R₂ + R₃). Dann kommt R₁ in Reihe dazu.')

def kirchhoff():
    s = Sk(360, 210)
    # Knoten links
    s.punkt(90, 105)
    s.arrow(20, 105, 84, 105, 'r'); s.text(36, 96, 'I₁', 'rt')
    s.arrow(92, 103, 150, 55, 'b'); s.text(150, 48, 'I₂', 'bt')
    s.arrow(92, 107, 150, 155, 'b'); s.text(150, 172, 'I₃', 'bt')
    s.text(90, 200, 'Knoten: I₁ = I₂ + I₃', 't')
    # Masche rechts
    s.rect(200, 50, 130, 110, 'l'); s.quelle(200, 105, 'U')
    s.widerstand(265, 50, True, 'R₁', 36, 14); s.widerstand(330, 105, False, 'R₂', 36, 14)
    s.path('M 245 125 A 24 24 0 1 1 285 125', 'g'); s.head(277, 133, 285, 125, 'g')
    s.text(265, 200, 'Masche: U = U₁ + U₂', 't')
    speichern('et-kirchhoffsche-regeln', 'et-kirchhoff', s, 'Links ein Knoten: Was hineinfließt, fließt auch heraus, I₁ = I₂ + I₃. Rechts eine Masche: Einmal im Kreis herum ist die Summe der Spannungen null, also U = U₁ + U₂.')

def spannungsteiler():
    s = Sk(360, 220)
    s.line(60, 30, 200, 30); s.line(60, 190, 200, 190)
    s.line(200, 30, 200, 190)
    s.widerstand(200, 70, False, 'R₁', 44, 16); s.widerstand(200, 145, False, 'R₂', 44, 16)
    s.punkt(200, 110); s.line(200, 110, 280, 110); s.line(280, 110, 280, 190); s.line(200, 190, 280, 190)
    s.widerstand(280, 150, False, 'R_L', 44, 16)
    s.punkt(200, 190); s.circle(60, 30, 4, 'l bgf'); s.circle(60, 190, 4, 'l bgf')
    s.arrow(40, 40, 40, 180, 'b'); s.text(32, 112, 'U', 'bt', 'end')
    s.arrow(320, 116, 320, 184, 'r'); s.text(328, 154, 'U₂', 'rt', 'start')
    s.text(110, 120, 'R₂ ∥ R_L', 't2')
    speichern('et-belasteter-spannungsteiler', 'et-spannungsteiler', s, 'Belasteter Spannungsteiler: Die Last R_L hängt parallel an R₂. Dadurch wird der untere Teil kleiner und U₂ sinkt. Rechne erst R₂ parallel R_L, dann U₂ = U · R₂L / (R₁ + R₂L).')

def laden(tid, name, yl, titel, unterschrift, steigend=True):
    s = Sk(360, 210)
    ox, oy, sx, sy = 50, 170, 50, 130
    s.achsen(ox, oy, 340, 25, 't', yl)
    f = (lambda t: 1 - math.exp(-t)) if steigend else (lambda t: math.exp(-t))
    s.kurve(f, 0, 5.6, sx, sy, ox, oy, 'b')
    for k in range(1, 6): s.line(ox + k * sx, oy, ox + k * sx, oy + 5); s.text(ox + k * sx, oy + 18, f'{k} τ', 't2')
    y63 = oy - f(1) * sy
    s.line(ox, y63, ox + sx, y63, 'd'); s.line(ox + sx, y63, ox + sx, oy, 'd')
    s.text(ox - 6, y63 + 4, '63 %' if steigend else '37 %', 't2', 'end')
    s.line(ox, oy - sy, 340, oy - sy, 'd')
    s.text(ox + 5 * sx, oy - sy - 8, 'nach 5 τ fast fertig', 't2')
    s.text(240, 120 if steigend else 70, titel, 'bt')
    speichern(tid, name, s, unterschrift)

def kondensator():
    laden('et-kondensator', 'et-kondensator-laden', 'u_C', 'τ = R · C', 'Kondensator laden: Die Spannung u_C steigt erst schnell, dann immer langsamer. Nach einer Zeitkonstante τ = R · C sind 63 % erreicht, nach 5 τ gilt er als voll.')

def spule():
    laden('et-spule-und-induktion', 'et-spule-einschalten', 'i_L', 'τ = L / R', 'Spule einschalten: Der Strom i_L steigt nicht sofort, die Spule bremst die Änderung. Nach τ = L / R sind 63 % des Endstroms erreicht, nach 5 τ ist er fast ganz da.')

def wechsel():
    s = Sk(360, 210)
    ox, oy, sx, sy = 40, 105, 240 / (2 * math.pi), 70
    s.line(ox, oy, 340, oy, 'l'); s.arrow(ox, 190, ox, 20, 'l', 8)
    s.kurve(math.sin, 0, 2 * math.pi * 1.2, sx, sy, ox, oy, 'b', 120)
    s.line(ox, oy - sy, 120, oy - sy, 'd'); s.text(ox - 4, oy - sy + 4, 'û', 'bt', 'end', 15)
    ue = sy / math.sqrt(2)
    s.line(ox, oy - ue, 340, oy - ue, 'o'); s.text(215, oy - ue - 8, 'U_eff = û / √2', 'ot')
    s.mass(ox, 196, ox + 2 * math.pi * sx, 196, 'Periode T, f = 1 / T')
    speichern('et-wechselstrom', 'et-wechselstrom', s, 'Wechselspannung: Sie schwingt zwischen +û und −û. Eine Schwingung dauert die Periode T, die Frequenz ist f = 1 / T, bei uns 50 Hz. Der Effektivwert U_eff = û / √2 wirkt wie eine gleich große Gleichspannung.')

def dreh():
    s = Sk(360, 210)
    ox, oy, sx, sy = 30, 100, 300 / (2 * math.pi), 65
    s.line(ox, oy, 340, oy, 'l')
    for k, c in enumerate(['b', 'o', 'g']):
        ph = k * 2 * math.pi / 3
        s.kurve(lambda t, ph=ph: math.sin(t - ph), 0, 2 * math.pi, sx, sy, ox, oy, c, 120)
    s.text(70, 28, 'L1', 'bt'); s.text(170, 28, 'L2', 'ot'); s.text(270, 28, 'L3', 'gt')
    s.mass(ox + sx * math.pi / 2, 190, ox + sx * (math.pi / 2 + 2 * math.pi / 3), 190, '120°')
    speichern('et-drehstrom', 'et-drehstrom', s, 'Drehstrom: Drei Wechselspannungen L1, L2 und L3, jeweils um 120° versetzt. Zwischen zwei Außenleitern liegen 400 V, gegen den Neutralleiter 230 V, das ist 400 V / √3.')

def leistung():
    s = Sk(360, 200)
    s.poly([(20, 60), (140, 60), (140, 50), (170, 90), (140, 130), (140, 120), (20, 120)], 'fb')
    s.rect(160, 55, 70, 70, 'l bgf'); s.text(195, 95, 'Motor', 't')
    s.poly([(230, 68), (310, 68), (310, 58), (340, 90), (310, 122), (310, 112), (230, 112)], 'fg')
    s.poly([(185, 125), (205, 125), (205, 160), (215, 160), (195, 185), (175, 160), (185, 160)], 'fr')
    s.text(70, 95, 'P_zu', 'bt', size=15); s.text(280, 95, 'P_ab', 'gt', size=15); s.text(225, 170, 'Verluste P_V, Wärme', 'rt', 'start')
    s.text(180, 30, 'η = P_ab / P_zu, immer kleiner als 1', 't')
    speichern('et-leistung-arbeit-wirkungsgrad', 'et-wirkungsgrad', s, 'Energiefluss: Vorne geht die Leistung P_zu hinein, hinten kommt die nutzbare P_ab heraus. Der Rest wird zu Wärme. Wirkungsgrad η = P_ab / P_zu.')

def messtechnik():
    s = Sk(360, 235)
    ox, oy = 60, 190
    s.achsen(ox, oy, 340, 34, '', 'I in mA')
    def y(i): return oy - i * 7
    s.line(ox, y(4), 300, y(20), 'b')
    for i in (4, 12, 20): s.line(ox - 4, y(i), ox, y(i)); s.text(ox - 8, y(i) + 4, str(i), 't2', 'end'); s.line(ox, y(i), 340, y(i), 'd')
    s.text(ox, oy + 16, 'Anfang', 't2'); s.text(300, oy + 16, 'Ende', 't2'); s.text(180, oy + 16, 'Messbereich', 't2')
    s.line(300, y(20), 300, oy, 'd')
    s.text(180, 18, 'Messwert = (I − 4) / 16 · Spanne', 'bt')
    s.text(200, 228, 'unter 4 mA heißt Leitungsbruch', 'rt')
    speichern('auto-messtechnik', 'auto-4-20ma', s, 'Das 4 bis 20 mA Signal: 4 mA heißt Anfang des Messbereichs, 20 mA heißt Ende. Dazwischen ist es eine Gerade. Messwert = (I − 4) / 16 · Spanne + Anfangswert. Unter 4 mA ist etwas kaputt.')

def regelkreis():
    s = Sk(360, 200)
    s.circle(60, 70, 14, 'l bgf'); s.text(52, 66, '+', 't'); s.text(66, 82, '−', 't')
    s.arrow(4, 70, 44, 70, 'l'); s.text(12, 60, 'w', 't')
    s.arrow(74, 70, 120, 70, 'l'); s.text(97, 60, 'e', 't')
    s.rect(120, 50, 70, 40, 'l fb'); s.text(155, 75, 'Regler', 't')
    s.arrow(190, 70, 236, 70, 'l'); s.text(213, 60, 'y', 't')
    s.rect(236, 50, 70, 40, 'l fo'); s.text(271, 75, 'Strecke', 't')
    s.arrow(306, 70, 352, 70, 'l'); s.text(340, 60, 'x', 't')
    s.line(330, 70, 330, 140); s.line(330, 140, 60, 140); s.arrow(60, 140, 60, 86, 'l')
    s.text(195, 132, 'Rückführung: Istwert x wird gemessen', 't2')
    s.text(180, 180, 'e = w − x: Sollwert minus Istwert', 'bt')
    speichern('auto-regelungstechnik', 'auto-regelkreis', s, 'Regelkreis: Der Regler vergleicht den Sollwert w mit dem Istwert x. Aus der Regeldifferenz e = w − x macht er die Stellgröße y. Die Strecke reagiert, x wird wieder gemessen, und der Kreis schließt sich.')

ALLE = [ohm, leiter, reihe_parallel, gemischt, kirchhoff, spannungsteiler, kondensator, spule, wechsel, dreh, leistung, messtechnik, regelkreis]
