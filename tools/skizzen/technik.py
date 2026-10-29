"""Skizzen Toleranzen, Werkstoffe, Steuerung, Projektmanagement und Qualität."""
import math
from sk import Sk, speichern

def passungen():
    s = Sk(360, 220)
    y0 = 125
    s.line(20, y0, 340, y0, 'l'); s.text(338, y0 + 16, 'Nulllinie', 't2', 'end')
    s.rect(40, y0 - 50, 50, 50, 'fb'); s.rect(40, y0 - 50, 50, 50, 'b'); s.text(65, y0 - 58, 'Bohrung H', 'bt')
    for x, top, h, txt, c in ((130, y0 + 20, 40, 'Spiel', 'g'), (210, y0 - 25, 45, 'Übergang', 'o'), (290, y0 - 95, 40, 'Übermaß', 'r')):
        s.rect(x, top, 40, h, 'f' + c); s.rect(x, top, 40, h, c)
        s.text(x + 20, top + h + 16 if txt != 'Übermaß' else top - 8, 'Welle: ' + txt, c + 't')
    s.line(40, y0 - 50, 340, y0 - 50, 'd')
    speichern('tol-passungen-grenzmasse-spiel-uebermass', 'tol-passungen', s, 'Toleranzfelder zur Nulllinie: Die Bohrung H beginnt genau auf der Nulllinie. Liegt die Welle ganz darunter, gibt es immer Spiel. Überlappen sich die Felder, ist es eine Übergangspassung. Liegt die Welle ganz über der Bohrung, gibt es immer Übermaß.')

def formlage():
    s = Sk(360, 180)
    s.rect(60, 40, 240, 40, 'l bgf'); s.line(120, 40, 120, 80); s.line(230, 40, 230, 80)
    s.line(90, 50, 90, 72); s.line(76, 72, 104, 72)   # Symbol Rechtwinkligkeit
    s.text(175, 67, '0,05', 't', size=18); s.text(265, 67, 'A', 't', size=18)
    s.text(90, 110, 'Symbol', 'bt'); s.text(175, 110, 'Toleranz', 'ot'); s.text(265, 110, 'Bezug', 'gt')
    s.line(90, 84, 90, 96, 'b'); s.line(175, 84, 175, 96, 'o'); s.line(265, 84, 265, 96, 'g')
    s.text(180, 150, 'Rechtwinklig zu A, höchstens 0,05 mm daneben', 't')
    speichern('tol-form-und-lagetoleranzen-lesen', 'tol-rahmen', s, 'Toleranzrahmen von links nach rechts lesen: Erst das Symbol für die Eigenschaft, hier Rechtwinkligkeit. Dann der Toleranzwert in mm. Dann der Bezug, hier die Fläche A.')

def eisen_kohlenstoff():
    s = Sk(360, 240)
    ox, oy = 50, 215
    sx, sy = 120, 0.18      # 1 % Kohlenstoff = 125 px, 1 °C = 0,18 px ab 400 °C
    X = lambda c: ox + c * sx
    Y = lambda t: oy - (t - 400) * sy
    s.achsen(ox, oy, 340, 20, '', 'T in °C'); s.text(340, oy - 8, '% C', 't2', 'end')
    G, S, E, P, K = (0, 911), (0.8, 723), (2.06, 1147), (0.02, 723), (2.06, 723)
    s.line(X(G[0]), Y(G[1]), X(S[0]), Y(S[1]), 'b'); s.line(X(S[0]), Y(S[1]), X(E[0]), Y(E[1]), 'b')
    s.line(X(P[0]), Y(P[1]), X(K[0]), Y(K[1]), 'r')
    s.line(X(2.06), Y(1147), X(2.06), oy, 'd')
    for (c, t), n in ((G, 'G'), (S, 'S'), (E, 'E'), (K, 'K')): s.circle(X(c), Y(t), 3.5, 'lf'); s.text(X(c) + 6, Y(t) - 6, n, 't', 'start')
    s.text(X(0.0) - 4, Y(723) + 4, '723', 't2', 'end'); s.text(X(0.0) - 4, Y(911) + 4, '911', 't2', 'end')
    s.text(X(0.8), oy + 16, '0,8', 't2'); s.text(X(2.06), oy + 16, '2,06', 't2')
    s.text(X(1.2), Y(950), 'Austenit', 'bt')
    s.text(X(0.33), Y(560), 'Ferrit + Perlit', 't2'); s.text(X(1.45), Y(560), 'Perlit + Zementit', 't2')
    speichern('ws-eisen-kohlenstoff-diagramm', 'ws-eisen-kohlenstoff', s, 'Stahlteil des Eisen-Kohlenstoff-Diagramms: Oberhalb der Linie G S E ist der Stahl Austenit. Die Linie P S K bei 723 °C ist die Perlitlinie. S liegt bei 0,8 % Kohlenstoff. Achtung: Neuere Bücher nennen 727 °C und 2,11 % statt 723 °C und 2,06 %.')

def waerme():
    s = Sk(360, 220)
    ox, oy = 50, 195
    s.achsen(ox, oy, 340, 15, 'Zeit', 'T')
    pts = [(ox, oy), (110, 50), (160, 50), (172, oy - 4), (200, oy - 4), (225, 120), (285, 120), (330, oy - 10)]
    s.poly(pts, 'r', closed=False)
    s.line(ox, 70, 340, 70, 'd'); s.text(338, 64, 'Linie G S', 't2', 'end')
    s.text(135, 42, 'Härten: 30 bis 50 K über G S', 'rt')
    s.text(185, oy - 14, 'abschrecken', 'bt'); s.text(255, 112, 'Anlassen', 'ot')
    speichern('ws-waermebehandlung', 'ws-haerten', s, 'Härten und Anlassen: Erwärmen bis etwa 30 bis 50 K über die Linie G S, halten, dann schnell abschrecken. Danach wieder erwärmen und anlassen, das nimmt Sprödigkeit. Beides zusammen heißt Vergüten.')

def zugversuch():
    s = Sk(360, 220)
    ox, oy = 50, 190
    s.achsen(ox, oy, 340, 15, '', 'Spannung σ'); s.text(200, oy + 16, 'Dehnung ε', 't2')
    pts = [(ox, oy), (110, 70), (118, 76), (130, 72), (150, 70)]
    pts += [(150 + i * 1.4, 70 - 32 * math.sin(math.pi * i / 120)) for i in range(0, 121, 5)]
    pts += [(320, 80)]
    s.poly(pts, 'b', closed=False)
    s.line(ox, 70, 110, 70, 'd'); s.text(ox - 4, 74, 'R_e', 'bt', 'end')
    top = 70 - 32
    s.line(ox, top, 234, top, 'd'); s.text(ox - 4, top + 4, 'R_m', 'rt', 'end')
    s.circle(320, 80, 4, 'rf'); s.text(320, 100, 'Bruch', 'rt')
    s.text(90, 150, 'Hooke: σ = E · ε', 'gt', 'start')
    s.line(320, 80, 300, oy, 'd'); s.text(300, oy + 16, 'A', 't2')
    speichern('ws-werkstoffpruefung', 'ws-zugversuch', s, 'Spannungs-Dehnungs-Diagramm aus dem Zugversuch: Zuerst eine Gerade, dort gilt σ = E · ε und die Probe federt zurück. Bei R_e beginnt das Fließen. R_m ist die höchste Spannung, danach schnürt die Probe ein und bricht.')

def wegeventil():
    s = Sk(360, 210)
    x, y, w = 120, 60, 60
    s.rect(x, y, w, w, 'l bgf'); s.rect(x + w, y, w, w, 'l bgf')
    s.arrow(x + 20, y + w, x + 20, y + 8, 'b', 8)          # links: 1 nach 2
    s.line(x + w + 20, y + w, x + w + 20, y + 30); s.line(x + w + 12, y + 30, x + w + 28, y + 30)   # rechts: 1 gesperrt
    s.arrow(x + w + 40, y + 8, x + w + 40, y + w, 'l', 8)  # rechts: 2 nach 3
    s.line(x + w + 20, y + w, x + w + 20, y + w + 20); s.line(x + w + 40, y + w, x + w + 40, y + w + 20)
    s.line(x + w + 40, y, x + w + 40, y - 20)
    s.text(x + w + 20, y + w + 34, '1', 't'); s.text(x + w + 40, y + w + 34, '3', 't'); s.text(x + w + 40, y - 26, '2', 't')
    s.path(f'M {x + 2 * w} {y + 30} l 8 -8 l 8 16 l 8 -16 l 8 16 l 8 -8', 'l'); s.text(x + 2 * w + 22, y - 6, 'Feder', 't2')
    s.rect(x - 30, y + 20, 20, 20, 'l'); s.line(x - 10, y + 30, x, y + 30); s.text(x - 20, y + 10, 'Taster', 't2')
    s.text(x + 30, y + w + 54, 'betätigt', 'bt'); s.text(x + w + 34, y + w + 54, 'Ruhe', 't2')
    s.text(180, 22, '3/2-Wegeventil: 3 Anschlüsse, 2 Stellungen', 't')
    speichern('st-wegeventile-und-schaltzeichen', 'st-wegeventil', s, '3/2-Wegeventil: Drei Anschlüsse und zwei Stellungen. Angeschlossen wird an das Feld der Ruhestellung, hier rechts: 2 geht zur Entlüftung 3, die Druckluft 1 ist gesperrt. Drückt man den Taster, gilt das linke Feld: 1 geht nach 2.')

def zylinder():
    s = Sk(360, 190)
    s.rect(60, 60, 200, 60, 'l bgf')
    s.rect(140, 64, 14, 52, 'l fb'); s.line(154, 90, 320, 90, 'l', 6)
    s.line(80, 120, 80, 150); s.line(240, 120, 240, 150)
    s.arrow(80, 160, 80, 124, 'r', 8); s.text(80, 176, 'Luft rein', 'rt')
    s.text(240, 176, 'Luft raus', 't2')
    s.arrow(200, 40, 280, 40, 'b'); s.text(240, 30, 'fährt aus', 'bt')
    s.text(147, 140, 'Kolben', 't2'); s.text(290, 112, 'Kolbenstange', 't2')
    s.text(180, 14, 'Doppeltwirkender Zylinder', 't')
    speichern('st-pneumatik-direkte-und-indirekte-ansteuer', 'st-zylinder', s, 'Doppeltwirkender Zylinder: Kommt Druckluft auf die Kolbenseite, fährt die Kolbenstange aus. Kommt sie auf die andere Seite, fährt sie wieder ein. Die Gegenseite muss dabei entlüftet werden.')

def selbsthaltung():
    s = Sk(360, 230)
    s.line(40, 20, 320, 20); s.line(40, 210, 320, 210)
    s.text(40, 13, '+24 V', 't2', 'start'); s.text(40, 226, '0 V', 't2', 'start')
    x = 140
    s.line(x, 20, x, 40)
    s.line(x, 40, x - 10, 62); s.line(x - 14, 50, x - 4, 50, 'l'); s.line(x, 62, x, 76)   # S0 Öffner
    s.text(x + 12, 56, 'S0 Stopp, Öffner', 't', 'start')
    s.line(x, 76, x, 90); s.line(x - 40, 90, x + 40, 90); s.line(x - 40, 90, x - 40, 104); s.line(x + 40, 90, x + 40, 104)
    s.line(x - 40, 104, x - 50, 124); s.line(x - 40, 128, x - 40, 140); s.text(x - 56, 120, 'S1', 't', 'end'); s.text(x - 56, 136, 'Start', 't2', 'end')
    s.line(x + 40, 104, x + 30, 124, 'r'); s.line(x + 40, 128, x + 40, 140, 'r'); s.text(x + 52, 120, 'K1', 'rt', 'start'); s.text(x + 52, 136, 'hält sich selbst', 'rt', 'start')
    s.line(x - 40, 140, x + 40, 140); s.line(x, 140, x, 160)
    s.rect(x - 16, 160, 32, 22, 'l bgf'); s.text(x + 26, 176, 'Spule K1', 't', 'start')
    s.line(x, 182, x, 210)
    speichern('st-elektropneumatik-mit-relais-und-selbstha', 'st-selbsthaltung', s, 'Selbsthaltung: Ein kurzer Druck auf S1 schaltet die Spule K1 ein. Der Kontakt K1 parallel zu S1 schließt und hält den Strom, auch wenn S1 losgelassen wird. Erst der Öffner S0 unterbricht und schaltet aus.')

def logik():
    s = Sk(360, 200)
    for x, sym, name, tab in ((40, '&', 'UND', ['0 0 | 0', '0 1 | 0', '1 0 | 0', '1 1 | 1']), (200, '≥1', 'ODER', ['0 0 | 0', '0 1 | 1', '1 0 | 1', '1 1 | 1'])):
        s.rect(x + 30, 30, 50, 60, 'l bgf'); s.text(x + 55, 66, sym, 't', size=18)
        s.line(x, 45, x + 30, 45); s.line(x, 75, x + 30, 75); s.line(x + 80, 60, x + 110, 60)
        s.text(x - 4, 49, 'a', 't', 'end'); s.text(x - 4, 79, 'b', 't', 'end'); s.text(x + 114, 64, 'y', 't', 'start')
        s.text(x + 55, 20, name, 'bt')
        s.text(x + 55, 112, 'a b | y', 't2')
        for i, r in enumerate(tab): s.text(x + 55, 130 + i * 16, r, 'gt' if r.endswith('1') else 't2')
    speichern('st-logik-und-wahrheitstabelle', 'st-logik', s, 'Links UND: Der Ausgang y ist nur 1, wenn a und b beide 1 sind. Rechts ODER: y ist 1, sobald mindestens ein Eingang 1 ist. Die Wahrheitstabelle zeigt alle Fälle.')

def grafcet():
    s = Sk(360, 240)
    x = 195
    for i, (y, n, akt) in enumerate(((20, '0', ''), (95, '1', 'Zylinder 1A aus'), (170, '2', 'Zylinder 1A ein'))):
        s.rect(x - 18, y, 36, 36, 'l bgf')
        if i == 0: s.rect(x - 14, y + 4, 28, 28, 'l')
        s.text(x, y + 23, n, 't')
        if akt: s.line(x + 18, y + 18, x + 32, y + 18); s.rect(x + 32, y + 6, 126, 24, 'l fb'); s.text(x + 95, y + 22, akt, 't')
    for y, t in ((56, 'Start gedrückt'), (131, 'Endlage 1B2 erreicht'), (206, 'Endlage 1B1 erreicht')):
        s.line(x, y, x, y + 39 if y < 200 else y + 14); s.line(x - 12, y + 18, x + 12, y + 18, 'l', 3); s.text(x - 18, y + 22, t, 'ot', 'end')
    speichern('st-grafcet-nach-din-en-60848-und-schrittket', 'st-grafcet', s, 'GRAFCET als Schrittkette: Der doppelte Kasten ist der Anfangsschritt. Ein Querstrich ist eine Weiterschaltbedingung. Rechts neben einem Schritt steht seine Aktion. Es geht erst weiter, wenn der Schritt aktiv ist und die Bedingung erfüllt.')

def gantt():
    s = Sk(360, 210)
    s.line(110, 20, 110, 180, 'd')
    for i in range(6): s.line(110 + i * 45, 180, 110 + i * 45, 186); s.text(110 + i * 45, 200, f'W{i + 1}', 't2')
    rows = [('Planung', 0, 1.5, 'r'), ('Konstruktion', 1.5, 2, 'r'), ('Einkauf', 1.5, 1, 'b'), ('Montage', 3.5, 1.5, 'r'), ('Doku', 3, 1.5, 'b')]
    for i, (n, a, d, c) in enumerate(rows):
        y = 30 + i * 28
        s.text(100, y + 14, n, 't2', 'end'); s.rect(110 + a * 45, y, d * 45, 18, 'f' + c); s.rect(110 + a * 45, y, d * 45, 18, c)
    s.poly([(345, 115), (353, 123), (345, 131), (337, 123)], 'gf')
    s.text(110, 14, 'rot: kritischer Pfad', 'rt', 'start'); s.text(352, 14, 'Raute: Meilenstein', 'gt', 'end')
    speichern('pm-gantt-meilensteine-kritischer-pfad', 'pm-gantt', s, 'Gantt-Diagramm: Jeder Balken ist ein Vorgang über die Zeit. Rot ist der kritische Pfad: Verzögert sich einer davon, verschiebt sich das ganze Projekt. Blaue Vorgänge haben Puffer. Die Raute ist ein Meilenstein.')

def zahlensysteme():
    s = Sk(360, 150)
    bits = '10110110'
    for i, b in enumerate(bits):
        x = 30 + i * 38
        s.rect(x, 50, 34, 34, 'l ' + ('fb' if b == '1' else 'fl')); s.text(x + 17, 73, b, 't', size=16)
        s.text(x + 17, 40, f'2^{7 - i}'.replace('2^', '2') if False else '2' + '⁰¹²³⁴⁵⁶⁷'[7 - i], 't2')
        s.text(x + 17, 104, str(2 ** (7 - i)), 'bt' if b == '1' else 't2')
    s.text(180, 135, '128 + 32 + 16 + 4 + 2 = 182', 'bt')
    speichern('pm-zahlensysteme', 'pm-dual', s, 'Dualzahl 10110110: Jede Stelle hat einen Wert, von rechts 2⁰ = 1, 2¹ = 2, 2² = 4 und so weiter. Zähl die Werte zusammen, wo eine 1 steht: 128 + 32 + 16 + 4 + 2 = 182.')

def pdca():
    s = Sk(360, 220)
    cx, cy, r = 180, 110, 85
    for i, (n, c) in enumerate((('Plan', 'b'), ('Do', 'o'), ('Check', 'g'), ('Act', 'p'))):
        a0, a1 = math.radians(-90 + i * 90 + 6), math.radians(-90 + (i + 1) * 90 - 6)
        s.path(f'M {cx + r * math.cos(a0):.1f} {cy + r * math.sin(a0):.1f} A {r} {r} 0 0 1 {cx + r * math.cos(a1):.1f} {cy + r * math.sin(a1):.1f}', c)
        s.head(cx + r * math.cos(a1 - 0.15), cy + r * math.sin(a1 - 0.15), cx + r * math.cos(a1), cy + r * math.sin(a1), c, 11)
        am = math.radians(-90 + i * 90 + 45)
        s.text(cx + 50 * math.cos(am), cy + 50 * math.sin(am) + 5, n, c + 't', size=15)
    s.text(cx, cy + 5, 'immer wieder', 't2')
    speichern('m7-iso-9001-und-pdca', 'm7-pdca', s, 'PDCA-Kreis: Plan heißt planen, Do heißt ausprobieren, Check heißt prüfen, ob es geklappt hat, Act heißt das Gute zum Standard machen. Dann beginnt der Kreis von vorn.')

def ishikawa():
    s = Sk(360, 200)
    s.arrow(30, 100, 290, 100, 'l', 10); s.rect(292, 80, 60, 40, 'l fr'); s.text(322, 104, 'Fehler', 't')
    for i, n in enumerate(['Mensch', 'Maschine', 'Material']):
        x = 70 + i * 80; s.line(x, 30, x + 40, 100); s.text(x, 22, n, 'bt')
    for i, n in enumerate(['Methode', 'Milieu', 'Messung']):
        x = 70 + i * 80; s.line(x, 170, x + 40, 100); s.text(x, 186, n, 'bt')
    speichern('m7-q-werkzeuge', 'm7-ishikawa', s, 'Ishikawa-Diagramm wie eine Fischgräte: Rechts steht der Fehler. Auf den Gräten sammelst du mögliche Ursachen, sortiert nach Mensch, Maschine, Material, Methode, Milieu und Messung.')

def prozess():
    s = Sk(360, 210)
    ox, oy, mu, sg = 30, 170, 190, 28
    f = lambda x: math.exp(-((x - mu) / sg) ** 2 / 2)
    s.poly([(x, oy - 120 * f(x)) for x in range(40, 341, 4)], 'b', closed=False)
    s.line(20, oy, 345, oy, 'l')
    for x, n in ((60, 'UGW'), (330, 'OGW')): s.line(x, 30, x, oy, 'r'); s.text(x, 22, n, 'rt')
    s.line(mu, 40, mu, oy, 'd'); s.text(mu, 186, 'μ', 't')
    s.mass(mu, 120, mu + 3 * sg, 120, '3 σ'); s.mass(60, 140, mu, 140, 'Abstand zu UGW')
    s.text(180, 204, 'C_pk = kleinerer Abstand / (3 σ), ab 1,33 fähig', 't2')
    speichern('m7-maschinen-und-prozessfaehigkeit', 'm7-prozessfaehigkeit', s, 'Prozessfähigkeit: Die Glockenkurve zeigt, wie die Maße streuen. Sie muss gut zwischen die Grenzen UGW und OGW passen. C_pk teilt den kürzeren Abstand vom Mittelwert μ zur Grenze durch 3 σ. Ab 1,33 gilt der Prozess meist als fähig.')

ALLE = [passungen, formlage, eisen_kohlenstoff, waerme, zugversuch, wegeventil, zylinder, selbsthaltung, logik, grafcet, gantt, zahlensysteme, pdca, ishikawa, prozess]
