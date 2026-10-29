"""Skizzen Mathematik."""
import math
from sk import Sk, speichern

def mengen():
    s = Sk(360, 200)
    s.rect(20, 15, 320, 165, 'd')
    s.circle(140, 98, 70, 'fb'); s.circle(220, 98, 70, 'fo')
    s.circle(140, 98, 70, 'l'); s.circle(220, 98, 70, 'l')
    s.text(105, 102, 'A', 't', size=18); s.text(255, 102, 'B', 't', size=18)
    s.text(180, 104, 'A ∩ B', 't'); s.text(36, 34, 'G', 't2', 'start')
    s.text(180, 196, 'Schnitt ∩: in beiden. Vereinigung ∪: in mindestens einer.', 't2')
    speichern('ma-mengenlehre', 'ma-mengen', s, 'Zwei Mengen A und B: Die Mitte, wo sich beide Kreise überlappen, ist die Schnittmenge A ∩ B. Beide Kreise zusammen sind die Vereinigung A ∪ B. A ohne die Mitte ist A \\ B.')

def binom():
    s = Sk(360, 205)
    x, y, a, b = 50, 15, 110, 55
    s.rect(x, y, a, a, 'fb'); s.rect(x + a, y + a, b, b, 'fo')
    s.rect(x + a, y, b, a, 'fg'); s.rect(x, y + a, a, b, 'fg')
    s.rect(x, y, a + b, a + b, 'l'); s.line(x + a, y, x + a, y + a + b); s.line(x, y + a, x + a + b, y + a)
    s.text(x + a / 2, y + a / 2 + 6, 'a²', 'bt', size=20); s.text(x + a + b / 2, y + a + b / 2 + 6, 'b²', 'ot', size=18)
    s.text(x + a + b / 2, y + a / 2 + 5, 'a · b', 'gt'); s.text(x + a / 2, y + a + b / 2 + 5, 'a · b', 'gt')
    s.text(x - 8, y + a / 2, 'a', 't', 'end'); s.text(x - 8, y + a + b / 2, 'b', 't', 'end')
    s.text(x + a / 2, y + a + b + 18, 'a', 't'); s.text(x + a + b / 2, y + a + b + 18, 'b', 't')
    s.text(290, 90, '(a + b)²', 't', 'middle', 15); s.text(290, 112, '= a² + 2ab + b²', 't')
    speichern('ma-binomische-formeln', 'ma-binom', s, 'Ein Quadrat mit der Seite a + b: Darin stecken ein großes Quadrat a², ein kleines b² und zwei gleiche Streifen a · b. Deshalb ist (a + b)² = a² + 2ab + b² und nicht nur a² + b².')

def lgs():
    s = Sk(360, 220)
    ox, oy, k = 60, 190, 26
    s.achsen(ox, oy, 340, 15, 'x', 'y')
    s.line(ox, oy - 1 * k, ox + 10 * k, oy - 6 * k, 'b')       # y = 0,5 x + 1
    s.line(ox, oy - 6 * k, ox + 6 * k, oy - 0 * k, 'o')        # y = −x + 6
    xs, ys = 10 / 3, 10 / 3 * 0.5 + 1
    s.circle(ox + xs * k, oy - ys * k, 5, 'rf')
    s.line(ox + xs * k, oy - ys * k, ox + xs * k, oy, 'd'); s.line(ox + xs * k, oy - ys * k, ox, oy - ys * k, 'd')
    s.text(ox + xs * k + 10, oy - ys * k - 10, 'Lösung (x | y)', 'rt', 'start')
    s.text(300, 40, 'Gerade 1', 'bt'); s.text(110, 40, 'Gerade 2', 'ot')
    speichern('ma-lineare-gleichungssysteme', 'ma-lgs', s, 'Zwei Gleichungen sind zwei Geraden. Die Lösung des Gleichungssystems ist der Schnittpunkt, dort passen x und y in beide Gleichungen. Parallele Geraden haben keine Lösung.')

def parabel():
    s = Sk(360, 220)
    ox, oy, k = 180, 130, 28
    s.line(20, oy, 340, oy, 'l'); s.arrow(ox, 215, ox, 12, 'l', 8)
    f = lambda x: (x - 0.5) ** 2 - 4                      # Nullstellen −1,5 und 2,5
    s.kurve(f, -2.6, 3.6, k, k / 2, ox, oy, 'b', 80)
    for x in (-1.5, 2.5): s.circle(ox + x * k, oy, 5, 'rf')
    s.text(ox - 1.5 * k, oy + 20, 'x₁', 'rt'); s.text(ox + 2.5 * k, oy + 20, 'x₂', 'rt')
    s.circle(ox + 0.5 * k, oy + 4 * k / 2, 4, 'gf'); s.text(ox + 0.5 * k + 10, oy + 4 * k / 2 + 4, 'Scheitel, tiefster Punkt', 'gt', 'start')
    s.text(90, 30, 'x = −p/2 ± √((p/2)² − q)', 'bt')
    speichern('ma-quadratische-gleichungen', 'ma-parabel', s, 'Die Lösungen einer quadratischen Gleichung sind die Nullstellen der Parabel, hier x₁ und x₂. Die pq-Formel x = −p/2 ± √((p/2)² − q) findet beide. Ist der Wert unter der Wurzel negativ, berührt die Parabel die x-Achse nicht.')

def dreieck():
    s = Sk(360, 210)
    A, B, C = (50, 180), (300, 180), (300, 50)
    s.poly([A, B, C], 'fl'); s.poly([A, B, C], 'l')
    s.rect(284, 164, 16, 16, 'l')
    s.path('M 100 180 A 50 50 0 0 0 94.4 157', 'l'); s.text(112, 172, 'α', 't')
    s.text(175, 200, 'Ankathete', 'bt'); s.text(292, 124, 'Gegenkathete', 'ot', 'end')
    s.text(160, 104, 'Hypotenuse', 'gt', 'end')
    s.text(90, 40, 'sin α = G / H', 't', 'start'); s.text(90, 58, 'cos α = A / H', 't', 'start'); s.text(90, 76, 'tan α = G / A', 't', 'start')
    speichern('ma-trigonometrie', 'ma-dreieck', s, 'Rechtwinkliges Dreieck vom Winkel α aus gesehen: Die Hypotenuse liegt gegenüber dem rechten Winkel. Die Gegenkathete liegt gegenüber von α, die Ankathete liegt an α. sin α = G / H, cos α = A / H, tan α = G / A.')

def gerade():
    s = Sk(360, 220)
    ox, oy, k = 60, 190, 28
    s.achsen(ox, oy, 340, 15, 'x', 'y')
    s.line(ox, oy - 2 * k, ox + 9 * k, oy - 6.5 * k, 'b')
    s.circle(ox, oy - 2 * k, 4, 'rf'); s.text(ox + 8, oy - 2 * k + 18, 'b: Schnitt mit der y-Achse', 'rt', 'start')
    x1, x2 = 3, 7
    s.line(ox + x1 * k, oy - (2 + 0.5 * x1) * k, ox + x2 * k, oy - (2 + 0.5 * x1) * k, 'o')
    s.line(ox + x2 * k, oy - (2 + 0.5 * x1) * k, ox + x2 * k, oy - (2 + 0.5 * x2) * k, 'g')
    s.text(ox + 5 * k, oy - (2 + 0.5 * x1) * k + 18, 'Δx', 'ot'); s.text(ox + x2 * k + 8, oy - (2 + 0.5 * 5) * k + 8, 'Δy', 'gt', 'start')
    s.text(120, 30, 'y = m · x + b', 'bt', 'start'); s.text(120, 48, 'm = Δy / Δx', 't', 'start')
    speichern('ma-funktionen', 'ma-gerade', s, 'Eine Gerade y = m · x + b: b ist der Punkt, an dem sie die y-Achse schneidet. Die Steigung m sagt, wie viel y wächst, wenn x um 1 wächst. Am Steigungsdreieck: m = Δy / Δx.')

def ableitung():
    s = Sk(360, 220)
    ox, oy, k = 50, 190, 30
    s.achsen(ox, oy, 340, 15, 'x', 'y')
    f = lambda x: 0.12 * x ** 2 + 0.5
    s.kurve(f, 0, 8.5, k, k, ox, oy, 'b')
    x0 = 5; m = 0.24 * x0
    s.line(ox + 2.8 * k, oy - (f(x0) + m * (2.8 - x0)) * k, ox + 7.2 * k, oy - (f(x0) + m * (7.2 - x0)) * k, 'r')
    s.circle(ox + x0 * k, oy - f(x0) * k, 5, 'rf')
    s.text(ox + x0 * k - 10, oy - f(x0) * k - 12, 'x₀', 'rt', 'end')
    s.text(70, 30, 'Tangente: Steigung = f\'(x₀)', 'rt', 'start')
    s.text(110, 120, 'f(x)', 'bt')
    speichern('ma-differentialrechnung', 'ma-ableitung', s, 'Die Ableitung f\'(x₀) ist die Steigung der Kurve an der Stelle x₀. Man sieht sie als Tangente, die die Kurve dort nur berührt. Wo f\'(x) = 0 ist, liegt ein Hoch- oder Tiefpunkt.')

def wachstum():
    s = Sk(360, 220)
    ox, oy = 50, 190
    s.achsen(ox, oy, 340, 15, 't in Jahren', 'Betrag')
    s.kurve(lambda t: 2 ** (t / 14), 0, 40, 7, 22, ox, oy, 'b')
    for n, t in enumerate((14, 28)):
        y = 22 * 2 ** (t / 14)
        s.line(ox + t * 7, oy, ox + t * 7, oy - y, 'd'); s.text(ox + t * 7, oy + 16, f'{t}', 't2')
        s.text(ox + t * 7 - 6, oy - y - 8, ['doppelt', 'vierfach'][n], 'ot', 'end')
    s.text(200, 40, 'K = K₀ · qᵗ', 'bt'); s.text(200, 58, 't = lg(K / K₀) / lg q', 't')
    speichern('ma-logarithmen', 'ma-wachstum', s, 'Wachstum mit 5 % pro Jahr: Der Betrag verdoppelt sich etwa alle 14 Jahre, nach 28 Jahren ist er vierfach. Die Zeit steht im Exponenten, deshalb brauchst du den Logarithmus: t = lg(K / K₀) / lg q.')

ALLE = [mengen, binom, lgs, parabel, dreieck, gerade, ableitung, wachstum]
