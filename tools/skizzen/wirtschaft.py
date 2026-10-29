"""Skizzen Ökonomie, Nachhaltigkeit und Personal."""
import math
from sk import Sk, speichern

def abc():
    s = Sk(360, 230)
    ox, oy, k = 50, 200, 2.7
    s.achsen(ox, oy, 340, 15, '', 'Wertanteil in %'); s.text(200, oy + 28, 'Mengenanteil in %', 't2')
    P = lambda m, w: (ox + m * k, oy - w * 1.7)
    pts = [P(0, 0), P(20, 80), P(50, 95), P(100, 100)]
    s.poly([P(0, 0), P(20, 80), P(20, 0)], 'fr'); s.poly([P(20, 0), P(20, 80), P(50, 95), P(50, 0)], 'fo'); s.poly([P(50, 0), P(50, 95), P(100, 100), P(100, 0)], 'fg')
    s.poly(pts, 'b', closed=False)
    for m, w in ((20, 80), (50, 95)):
        s.line(*P(0, w), *P(m, w), 'd'); s.text(P(0, w)[0] - 4, P(0, w)[1] + 4, f'{w}', 't2', 'end')
        s.text(P(m, 0)[0], oy + 14, f'{m}', 't2')
    s.text(*P(10, 30), 'A', 'rt', size=18); s.text(*P(35, 40), 'B', 'ot', size=18); s.text(*P(75, 50), 'C', 'gt', size=18)
    speichern('m8-abc-xyz-analyse', 'm8-abc', s, 'ABC-Kurve: Wenige A-Teile, rund 20 % der Menge, machen rund 80 % des Werts aus. B-Teile bringen bis 95 %, die vielen C-Teile nur den Rest. Achtung: Die Grenzen sind Richtwerte, manche Aufgaben nehmen 70, 20 und 10 %.')

def andler():
    s = Sk(360, 230)
    ox, oy = 50, 200
    s.achsen(ox, oy, 340, 15, '', 'Kosten im Jahr'); s.text(338, oy + 18, 'Bestellmenge x', 't2', 'end')
    X = lambda x: ox + x * 27; Y = lambda k: oy - k * 15
    s.kurve(lambda x: 12 / x, 1.1, 10.5, 27, 15, ox, oy, 'b')
    s.kurve(lambda x: 0.75 * x, 0, 10.5, 27, 15, ox, oy, 'o')
    s.kurve(lambda x: 12 / x + 0.75 * x, 1.4, 10.5, 27, 15, ox, oy, 'r')
    xo = 4.0
    s.line(X(xo), Y(12 / xo + 0.75 * xo), X(xo), oy, 'd'); s.circle(X(xo), Y(6), 5, 'rf')
    s.text(X(xo), oy + 14, 'x_opt', 'rt')
    s.text(X(10.4), Y(12 / 10.4) - 6, 'Bestellkosten', 'bt', 'end'); s.text(X(6.6), Y(0.75 * 6.6) + 22, 'Lagerkosten', 'ot', 'start')
    s.text(X(9.8), Y(9.5), 'Gesamtkosten', 'rt', 'end')
    s.text(X(xo), Y(6) - 12, 'Minimum', 'rt')
    speichern('m8-optimale-bestellmenge', 'm8-andler', s, 'Kosten über der Bestellmenge: Die Bestellkosten fallen, weil man seltener bestellt. Die Lagerkosten steigen, weil mehr im Lager liegt. Die Summe hat ein Minimum bei x_opt, genau dort, wo sich beide Kurven schneiden.')

def breakeven():
    s = Sk(360, 230)
    ox, oy = 50, 200
    s.achsen(ox, oy, 340, 15, '', 'Euro'); s.text(338, oy - 8, 'Menge x', 't2', 'end')
    X = lambda x: ox + x * 28; Y = lambda e: oy - e * 1.6
    kf, kv, p = 40, 4, 10
    xb = kf / (p - kv)
    s.poly([(X(xb), Y(p * xb)), (X(10), Y(p * 10)), (X(10), Y(kf + kv * 10))], 'fg')
    s.poly([(X(0), Y(kf)), (X(xb), Y(p * xb)), (X(0), Y(0))], 'fr')
    s.line(ox, Y(kf), X(10), Y(kf), 'd'); s.text(X(10), Y(kf) + 14, 'Fixkosten', 't2', 'end')
    s.line(ox, Y(kf), X(10), Y(kf + kv * 10), 'o'); s.text(X(10), Y(kf + kv * 10) + 16, 'Kosten', 'ot', 'end')
    s.line(ox, oy, X(10), Y(p * 10), 'g'); s.text(X(10), Y(p * 10) - 8, 'Erlös', 'gt', 'end')
    s.circle(X(xb), Y(p * xb), 5, 'rf'); s.line(X(xb), Y(p * xb), X(xb), oy, 'd')
    s.text(X(xb), oy + 14, 'Gewinnschwelle', 'rt')
    s.text(X(1.6), Y(25), 'Verlust', 'rt'); s.text(X(8.4), Y(79) + 4, 'Gewinn', 'gt')
    speichern('m8-kostenrechnung-und-kalkulation', 'm8-gewinnschwelle', s, 'Gewinnschwelle: Die Kosten beginnen mit den Fixkosten und steigen mit jedem Stück. Der Erlös beginnt bei null. Wo sich beide schneiden, ist die Gewinnschwelle x = K_f / (p − k_v). Rechts davon macht man Gewinn.')

def organigramme():
    s = Sk(360, 200)
    def box(x, y, w=40, h=20, c='l bgf'): s.rect(x - w / 2, y - h / 2, w, h, c)
    # Einlinie
    box(60, 40); s.line(60, 50, 60, 70); s.line(30, 70, 90, 70)
    for x in (30, 90): s.line(x, 70, x, 85); box(x, 95, 34)
    s.text(60, 140, 'Einlinie', 'bt'); s.text(60, 156, 'ein Chef', 't2')
    # Stablinie
    box(180, 40); s.line(180, 50, 180, 70); s.line(150, 70, 210, 70)
    for x in (150, 210): s.line(x, 70, x, 85); box(x, 95, 34)
    s.line(200, 40, 222, 40, 'd'); box(240, 40, 34, 18, 'l fo'); s.text(240, 26, 'Stab', 'ot')
    s.text(180, 140, 'Stablinie', 'bt'); s.text(180, 156, 'Stab berät nur', 't2')
    # Matrix
    for i, y in enumerate((50, 80, 110)):
        s.line(285, y, 345, y, 'b')
    for x in (300, 330): s.line(x, 30, x, 120, 'o')
    for x in (300, 330):
        for y in (50, 80, 110): s.circle(x, y, 5, 'l bgf')
    s.text(300, 24, 'F1', 'ot'); s.text(330, 24, 'F2', 'ot'); s.text(280, 54, 'S1', 'bt', 'end'); s.text(280, 84, 'S2', 'bt', 'end'); s.text(280, 114, 'S3', 'bt', 'end')
    s.text(315, 140, 'Matrix', 'bt'); s.text(315, 156, 'zwei Chefs', 't2')
    s.text(180, 190, 'F: Funktion wie Einkauf, S: Sparte wie Produkt', 't2')
    speichern('m8-aufbauorganisation', 'm8-organigramme', s, 'Drei Formen der Aufbauorganisation: Im Einliniensystem hat jede Stelle genau einen Chef. Im Stabliniensystem hängt ein Stab seitlich an der Linie und berät nur. In der Matrix kreuzen sich Funktionen und Sparten, jede Stelle hat zwei Chefs.')

def strukturbaum():
    s = Sk(360, 210)
    def box(x, y, t, c='l bgf', w=86): s.rect(x - w / 2, y - 13, w, 26, c); s.text(x, y + 5, t, 't')
    box(180, 26, 'Zylinder', 'l fb', 90)
    s.line(180, 39, 180, 60); s.line(70, 60, 290, 60)
    for x, t in ((70, '1 Gehäuse'), (180, '2 Deckel'), (290, '1 Kolben')):
        s.line(x, 60, x, 82); box(x, 95, t)
    s.line(180, 108, 180, 130); s.line(120, 130, 240, 130)
    for x, t in ((120, '4 Schrauben'), (240, '2 Kunststoff')):
        s.line(x, 130, x, 150); box(x, 163, t, 'l fo', 100)
    s.text(180, 200, '2 Deckel · 4 Schrauben = 8 Schrauben je Zylinder', 't2')
    speichern('m8-materialbedarfsermittlung', 'm8-strukturbaum', s, 'Erzeugnisstrukturbaum des Zylinders: Ganz oben das fertige Produkt. Darunter die Teile mit ihrer Menge. Die Zahl gilt je Teil darüber: 2 Deckel mit je 4 Schrauben sind 8 Schrauben pro Zylinder.')

def saeulen():
    s = Sk(360, 210)
    s.poly([(40, 60), (180, 15), (320, 60)], 'l fl'); s.text(180, 50, 'Nachhaltigkeit', 't')
    for x, t, c in ((80, 'Ökologie', 'g'), (180, 'Ökonomie', 'b'), (280, 'Soziales', 'o')):
        s.rect(x - 28, 66, 56, 110, 'l f' + c); s.text(x, 128, t, c + 't')
    s.rect(30, 176, 300, 16, 'l fl')
    s.text(180, 206, 'Fehlt eine Säule, trägt das Dach nicht', 't2')
    speichern('m8-nachhaltigkeit-drei-saeulen-modell-effiz', 'm8-drei-saeulen', s, 'Drei-Säulen-Modell: Nachhaltigkeit ruht auf Ökologie, Ökonomie und Sozialem. Eine Maßnahme ist erst nachhaltig, wenn sie alle drei Säulen beachtet, also Umwelt, Geld und Menschen.')

def personalbedarf():
    s = Sk(360, 220)
    rows = [('Soll', '', 'l bgf'), ('− Ist', 'die Lücke heute', 'l fb'), ('+ Neubedarf − Minderbedarf', '', 'l bgf'), ('− Zugänge', 'Rückkehr, Übernahme', 'l fg'), ('+ Abgänge', 'Rente, Kündigung', 'l fr'), ('= Nettobedarf', '', 'l fo')]
    for i, (t, sub, c) in enumerate(rows):
        y = 16 + i * 33
        s.rect(14, y, 200, 26, c); s.text(24, y + 18, t, 't', 'start')
        if sub: s.text(222, y + 18, sub, 't2', 'start')
    speichern('m6-personalplanung', 'm6-bedarfsschema', s, 'Schema für den Nettopersonalbedarf von oben nach unten: Soll minus Ist, dann Neubedarf dazu und Minderbedarf weg. Zugänge schließen die Lücke, Abgänge vergrößern sie. Positiv heißt, es fehlen Leute.')

ALLE = [abc, andler, breakeven, organigramme, strukturbaum, saeulen, personalbedarf]
