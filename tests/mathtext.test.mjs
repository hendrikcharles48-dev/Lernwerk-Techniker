// Formeln im Fließtext: Was wird als Formel mit echtem Bruchstrich gezeigt, was bleibt Text?
// Ausführen mit: node tests/mathtext.test.mjs
import { mathText } from '../js/formula.js';
import { markdown } from '../js/util.js';

let pass = 0, fail = 0;
const ok = (cond, name, extra) => { if (cond) pass++; else { fail++; console.log('FEHLER:', name, extra !== undefined ? JSON.stringify(extra) : ''); } };
const bruch = s => (mathText(s).match(/class="frac"/g) || []).length;
const formel = s => (mathText(s).match(/class="fml inl"/g) || []).length;

// Wird zur Formel
ok(bruch('Dann gilt: R = ρ · l / A.') === 1, 'Bruch mit Gleichung');
ok(mathText('Dann gilt: R = ρ · l / A.').endsWith('</span>.'), 'Satzpunkt bleibt hinter der Formel', mathText('Dann gilt: R = ρ · l / A.'));
ok(bruch('Kommen 72000 Positionen, braucht man 72000 / 6000 = 12 Leute.') === 1, 'Zahlenbruch im Satz');
ok(mathText('braucht man 72000 / 6000 = 12 Leute.').includes(' Leute.'), 'Text nach der Formel bleibt');
ok(bruch('Mitarbeiterbedarf = Jahresstunden / (Arbeitswochen · Wochenstunden).') === 1 && mathText('Mitarbeiterbedarf = Jahresstunden / (Arbeitswochen · Wochenstunden).').includes('class="wort">Jahresstunden<'), 'Wortformel mit Gleichheitszeichen');
ok(bruch('Für I wird U / R eingesetzt, also P = U · U / R = U² / R.') === 3, 'mehrere Formeln und zwei Gleichheitszeichen', mathText('Für I wird U / R eingesetzt, also P = U · U / R = U² / R.'));
ok(bruch('F_B = F · a / (l1 + l2)') === 1 && mathText('F_B = F · a / (l1 + l2)').includes('<sub>B</sub>'), 'Index und Klammer im Nenner');
ok(formel('d = √(4 · A / π)') === 1 && mathText('d = √(4 · A / π)').includes('class="root"'), 'Wurzel');
ok(formel('Das sind 10^3 Millimeter.') === 1 && mathText('Das sind 10^3 Millimeter.').includes('<sup>'), 'Hochzahl');
ok(bruch('F_x = F / cos(α)') === 1, 'Funktion im Nenner');
ok(bruch('R1 = R_ges · R2 / (R2 − R_ges)') === 1, 'Minuszeichen im Nenner');

// Bleibt Text
ok(formel('Die Spannung ist 120 N/mm² bei 20 km/h.') === 0, 'Einheiten ohne Leerzeichen');
ok(formel('Kupfer hat etwa 0,0178 Ω · mm² / m, Aluminium etwa 0,0278.') === 0, 'Einheit hinter einer Zahl');
ok(formel('Am Motor liegen 24 V / 0,5 A an.') === 0, 'Zahl mit Einheit geteilt durch Zahl mit Einheit');
ok(formel('Oben / unten, oder unten · unten.') === 0, 'nur Wörter ohne Gleichheitszeichen');
ok(formel('Ja / Nein') === 0, 'Ja oder Nein');
ok(formel('Faustregel: 70 / den Prozentsatz.') === 0, 'kleines Wort gehört zum Satz');
ok(formel('Soll − Ist ergibt die Unterdeckung.') === 0, 'ohne Bruch bleibt es Text');
ok(formel('U = R · I') === 0, 'einfache Formel ohne Bruch bleibt Text');
ok(formel('Das Thema Mensch-Maschine und und/oder x-Anteil.') === 0, 'Bindestriche und enge Schrägstriche');
ok(mathText('Die Kraft F_G wirkt.') === 'Die Kraft F<sub>G</sub> wirkt.', 'Index ohne Formel', mathText('Die Kraft F_G wirkt.'));

// Sicherheit: HTML im Text wird immer entschärft
ok(!mathText('<img src=x onerror=alert(1)> a / b = 2').includes('<img'), 'HTML wird entschärft');
ok(!mathText('x = <b>1</b> / 2').includes('<b>'), 'HTML in der Formel wird entschärft', mathText('x = <b>1</b> / 2'));

// Markdown mit Formeln
const md = markdown('**Merke:** I = U / R\n\n- Punkt mit P = U² / R', mathText);
ok(md.includes('<strong>Merke:</strong>') && (md.match(/class="frac"/g) || []).length === 2 && md.includes('<li>'), 'Markdown und Formeln zusammen', md);
ok(markdown('a < b') === '<p>a &lt; b</p>', 'Markdown ohne Formeln wie bisher');

console.log('\n' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
