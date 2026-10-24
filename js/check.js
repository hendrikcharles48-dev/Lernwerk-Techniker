// Zahl mit Einheit prüfen: Toleranz 1 Prozent und gezielte Hinweise auf typische Fehler.
import { fmtNum } from './util.js';
import { calc } from './formula.js';

const PREFIX = { G: 1e9, M: 1e6, k: 1e3, h: 1e2, d: 1e-1, c: 1e-2, m: 1e-3, µ: 1e-6, μ: 1e-6, u: 1e-6, n: 1e-9, p: 1e-12 };

// "12,5 mA" → {value: 12.5, unit: "mA"}; "1.234,5" → 1234.5
export function readNumber(input) {
  let s = String(input == null ? '' : input).trim().replace(/−|–/g, '-').replace(/ /g, ' ');
  if (!s) return { empty: true };
  // Rechnung aus dem Taschenrechner-Feld, zum Beispiel (3)/(4), √(2) oder sin(30)
  if (/[·*/^√()π+]|\d\s*-|sin|cos|tan|ln|lg/.test(s)) {
    const v = calc(s.replace(/·/g, '*'));
    if (v != null) return { value: v, unit: '' };
  }
  const m = /^([+-]?\s*[0-9][0-9.,' ]*(?:\s*(?:[eE]|·\s*10\s*\^|\*\s*10\s*\^|x\s*10\s*\^)\s*[+-]?\d+)?)\s*(.*)$/.exec(s)
    || /^([+-]?\s*[.,][0-9]+)\s*(.*)$/.exec(s);
  if (!m) return { error: true };
  let num = m[1].replace(/\s|'/g, '');
  let exp = 0;
  const em = /(?:[eE]|·10\^|\*10\^|x10\^)([+-]?\d+)$/.exec(num);
  if (em) { exp = +em[1]; num = num.slice(0, em.index); }
  if (num.includes(',') && num.includes('.')) num = num.replace(/\./g, '').replace(',', '.');
  else if ((num.match(/,/g) || []).length === 1) num = num.replace(',', '.');
  else if ((num.match(/\./g) || []).length > 1) num = num.replace(/\./g, '');
  const v = parseFloat(num);
  if (!isFinite(v) || /[.,]$/.test(num) && num.length === 1) return { error: true };
  return { value: v * 10 ** exp, unit: m[2].trim() };
}

const SAME = { MPa: 'N/mm²', 'N/mm^2': 'N/mm²', 'min⁻¹': '1/min', 'U/min': '1/min', 'min^-1': '1/min', 'm/s^2': 'm/s²', 'mm^2': 'mm²', 'm^2': 'm²', 'Grad': '°', grad: '°', Ohm: 'Ω', ohm: 'Ω' };
const cleanUnit = u => { const c = String(u || '').replace(/\s/g, ''); return SAME[c] || c.replace('Ohm', 'Ω'); };

// Faktor, um Einheit a in Einheit b umzurechnen (mA → A: 0.001). null, wenn nicht vergleichbar.
export function unitFactor(a, b) {
  a = cleanUnit(a); b = cleanUnit(b);
  if (a === b) return 1;
  const strip = u => (u.length > 1 && PREFIX[u[0]] && !/^(mol|min|cd|Pa|Hz)$/.test(u) && !(u === 'h') ? [PREFIX[u[0]], u.slice(1)] : [1, u]);
  const [fa, ba] = strip(a), [fb, bb] = strip(b);
  if (ba === bb) return fa / fb;
  // Grundformen ohne Präfix vergleichen, z. B. kN mit N
  if (ba === b) return fa;
  if (a === bb) return 1 / fb;
  return null;
}

/*
 * input: Text des Nutzers. expected: Zahl. unit: erwartete Einheit.
 * Rückgabe: {status: 'ok'|'wrong'|'empty'|'unreadable', msg, fehlerart, value}
 */
export function checkNumber(input, expected, unit = '', opts = {}) {
  const tol = opts.tol != null ? opts.tol : 0.01;
  const r = readNumber(input);
  if (r.empty) return { status: 'empty', msg: 'Gib zuerst eine Zahl ein.' };
  if (r.error) return { status: 'unreadable', msg: 'Das kann ich nicht als Zahl lesen. Schreib nur die Zahl, zum Beispiel 12,5.' };
  let v = r.value;
  let note = '';
  if (r.unit && unit) {
    const f = unitFactor(r.unit, unit);
    if (f == null) {
      if (!/^[a-zA-ZäöüÄÖÜ°Ωµμ²³/·*\-1 ]+$/.test(r.unit)) return { status: 'unreadable', msg: 'Hinter der Zahl steht etwas, das ich nicht lesen kann.' };
      return { status: 'wrong', value: v, msg: 'Gefragt ist ' + unit + ', du hast ' + r.unit + ' geschrieben. Das passt nicht zusammen. Prüf, welche Größe hier gesucht ist.', fehlerart: 'Falsche Größe oder Einheit' };
    }
    if (f !== 1) { v = v * f; note = ' Umgerechnet von ' + r.unit + ' in ' + unit + '.'; }
  }
  const ok = x => Math.abs(v - x) <= Math.max(tol * Math.abs(x), 1e-9);
  if (ok(expected)) return { status: 'ok', value: v, msg: note.trim() };
  const e = expected;
  const res = (msg, fehlerart) => ({ status: 'wrong', value: v, msg, fehlerart });
  if (e !== 0 && (ok(e * 1000) || ok(e / 1000) || ok(e * 1e6) || ok(e / 1e6)))
    return res('Die Ziffern stimmen, aber du liegst um den Faktor ' + (ok(e * 1000) || ok(e / 1000) ? '1000' : 'eine Million') + ' daneben. Das ist ein Einheitenfehler: Hast du zum Beispiel A und mA, m und mm oder N und kN verwechselt? Gefragt ist ' + (unit || 'die Grundeinheit') + '.', 'Einheit (Faktor 1000)');
  if (e !== 0 && ok(-e)) return res('Der Betrag stimmt, aber das Vorzeichen nicht. Schau, in welche Richtung die Größe zeigt.', 'Vorzeichen');
  if (cleanUnit(unit) === '°') {
    if (ok(e * Math.PI / 180)) return res('Dein Taschenrechner steht auf RAD. Stell ihn auf DEG, dann passt es.', 'Taschenrechner auf RAD');
    if (ok(e - 180) || ok(e + 180) || ok(180 - e) || ok(360 - e) || ok(e - 360))
      return res('Der Winkel ist um 180 Grad oder gespiegelt daneben. Hast du die Quadrantenkorrektur beim Arcustangens vergessen? Schau, ob x und y positiv oder negativ sind.', 'Quadrant beim Arcustangens');
  }
  if (e !== 0 && (ok(e * 10) || ok(e / 10) || ok(e * 100) || ok(e / 100))) return res('Die Ziffern stimmen, aber das Komma ist verrutscht. Prüf die Umrechnung, zum Beispiel cm in mm.', 'Komma verrutscht');
  if (e !== 0 && v !== 0 && Math.abs(v * e - 1) < 0.01 * Math.max(1, Math.abs(v * e))) return res('Du hast den Kehrwert erwischt. Prüf, was über und was unter den Bruchstrich gehört.', 'Kehrwert');
  if (e > 0 && v > 0 && (ok(e * e) || Math.abs(v * v - e) <= tol * e)) return res('Prüf Wurzel und Quadrat: Hast du die Wurzel vergessen oder zu oft gezogen?', 'Wurzel oder Quadrat');
  if (e !== 0 && Math.abs(v - e) <= 0.05 * Math.abs(e)) return res('Ganz knapp daneben. Hast du zu früh gerundet? Rechne mit allen Stellen weiter und runde erst am Ende.', 'Zu früh gerundet');
  if (e !== 0 && (ok(e * 2) || ok(e / 2))) return res('Du liegst genau um den Faktor 2 daneben. Prüf, ob du etwas halbiert oder verdoppelt hast, zum Beispiel Radius und Durchmesser.', 'Faktor 2');
  return res(opts.wrongMsg || 'Stimmt noch nicht. Prüf, welche Werte wirklich in diesen Schritt gehören und ob die Einheiten zusammenpassen.', 'Rechenweg');
}

export const showValue = (v, unit) => fmtNum(v) + (unit ? ' ' + unit : '');
