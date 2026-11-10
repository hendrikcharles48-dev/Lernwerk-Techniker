// Gemeinsame reine Helfer für Rechenaufgaben, genutzt von der App (js/engine.js) und den Fach-Trainern (js/fachtrainer.js).

/* „Erst der Weg“: Die Schritte einer Aufgabe in die richtige Reihenfolge bringen.
 * Ein Schritt hängt von einem früheren ab, wenn seine Rechnung die Rechnung des früheren enthält.
 * Schritte ohne Rechnung hängen von allen anderen ab. Unabhängige Schritte dürfen tauschen.
 * steps: [{ was, rechnung? }]. Rückgabe: [{ k, was, expr }] für alle Schritte mit Text. */
export const wegSchritte = steps => steps.map((s, k) => ({ k, was: s.was, expr: s.rechnung ? String(s.rechnung).replace(/\s+/g, '') : '' })).filter(s => s.was);
export const wegMoeglich = steps => wegSchritte(steps).length >= 3;
const abhaengig = (a, b) => !a.expr || !b.expr || b.expr.includes(a.expr);
// seq: gewählte Reihenfolge (Einträge aus wegSchritte). Rückgabe: je Platz true, wenn der Schritt dort stehen darf.
export const wegPruefen = seq => seq.map((x, a) => seq.every((y, b) => !((x.k < y.k && a > b && abhaengig(x, y)) || (y.k < x.k && b > a && abhaengig(y, x)))));
