---
name: lernwerk-etappe
description: Nächste offene Etappe aus docs/ROADMAP.md der Lern-App Lernwerk Techniker umsetzen. Nutzen bei „nächste Etappe“, „weiter mit Lernwerk“, „Roadmap“ oder wenn der Besitzer eine Etappe mit Nummer nennt.
---

# Lernwerk: nächste Etappe

Oberste Regel: **Bestehende Daten nie verlieren.** Lernstände, Karten, eingefügte Inhalte, Lernzettel, Fehlerbuch, Termine und Sicherungen bleiben erhalten. Im Zweifel die Etappe kleiner schneiden.

## Ablauf

1. `CLAUDE.md` und `docs/ROADMAP.md` ganz lesen. Bei Fragen zum Blockformat `docs/BLOCKFORMAT.md`.
2. Die nächste offene Etappe wählen: die erste ohne Haken unter „Offen“, außer der Besitzer nennt eine andere. Etappen mit dem Vermerk „wartet auf den Besitzer“ überspringen und das sagen.
3. Den Code lesen, den die Etappe berührt. Nicht aus der Beschreibung raten.
4. Einen kurzen Plan zeigen: was sich für den Nutzer ändert, welche Dateien, Risiko für vorhandene Daten, wie getestet wird. Deutsch, einfache Sätze.
5. **Auf das OK warten.** Ohne OK nichts ändern. Ausnahme: Der Besitzer hat in dieser Sitzung ausdrücklich gesagt, dass du allein entscheiden sollst.
6. Umsetzen. Dabei gilt:
   - Datenmodell nur erweitern, nie umbenennen. Neue Felder müssen fehlen dürfen. Alte Daten beim Start automatisch übernehmen.
   - Wird das Datenmodell berührt: zuerst einen Fall in `tests/speicher.test.mjs`, der einen alten Stand lädt.
   - Lernprinzip und Designregeln aus `CLAUDE.md` einhalten.
   - Neue Dateien der App in `FILES` in `sw.js` eintragen.
7. Prüfen: alle Tests aus `CLAUDE.md`, dann `node tools/pruefen/browser.mjs` und die Prüfkriterien der Etappe einzeln durchgehen. Ergebnisse ehrlich nennen, auch was nicht geprüft werden konnte.
8. `VERSION` in `sw.js` und `js/app.js` gleich erhöhen. Committen mit dem Namen der Etappe. Auf den Arbeitszweig und auf `main` pushen.
9. In `docs/ROADMAP.md` die Etappe abhaken: nach „Erledigt“ verschieben, mit Version und einer Zeile, was gebaut wurde. Neue Ideen oder Reste als neue Etappe unter „Offen“ eintragen, mit Prüfkriterien.
10. `CLAUDE.md` aktualisieren, wenn sich Aufbau, Datenmodell, Speicherschlüssel, Tests oder Regeln geändert haben. `docs/BLOCKFORMAT.md` aktualisieren, wenn sich das Format geändert hat. Diese Änderungen mit committen.
11. Dem Besitzer kurz berichten: was neu ist, was er auf dem iPhone prüfen soll, welche Etappe als Nächstes käme.

## Wenn etwas schiefgeht

- Schlägt ein Test fehl: Ursache suchen und beheben. Nie einen Test abschalten, um grün zu werden.
- Lässt sich eine Etappe nicht ohne Risiko für Daten bauen: anhalten, dem Besitzer die Lage erklären, eine kleinere Lösung vorschlagen.
- Eine veröffentlichte Etappe zurücknehmen: `git revert <commit>`, `VERSION` erhöhen, pushen. Nie `main` hart zurücksetzen.

## Vorrang

Schreibt der Besitzer „Stell jetzt CLAUDE.md, ROADMAP.md und den Skill fertig“, hat das sofort Vorrang vor allem anderen: laufende Arbeit sauber abschließen oder zurückstellen, dann diese drei Dateien auf den aktuellen Stand bringen und committen.
