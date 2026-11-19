---
name: ai-delegation
description: Entscheidet beim Zerlegen einer Etappe oder Aufgabe, welche Teile an günstigere externe KI-Modelle ausgelagert werden, und schreibt dafür abgeschlossene Auftragspakete. Nutzen bei „auslagern“, „delegieren“, „Kontingent sparen“ oder beim Planen einer Etappe mit mehreren Teilaufgaben.
---

# KI-Delegation

Claude bleibt Projektleiter: plant, entscheidet, prüft. Ausgelagert wird nur, was sich ohne Claude-Wissen sauber erledigen und automatisch prüfen lässt.

## 1. Entscheiden – pro Teilaufgabe
**Auslagern**, wenn ALLES zutrifft:
- klar abgegrenzt, höchstens 3 Dateien, Zeilenbereiche bekannt
- Ergebnis per Test oder Browser-Check prüfbar
- keine offene Design- oder Architekturentscheidung
- Beispiele: Inhalte/Texte ergänzen, Tests schreiben, Doku, kleine UI-Anpassung nach genauer Vorgabe, Übungen/Daten nach festem Format

**Bei Claude lassen**, wenn EINES zutrifft:
- Datenmodell, Speicher-Schlüssel, Migration, Sicherung, Geräte-Abgleich
- Sicherheit (Tokens, Eingaben aus Blöcken/Importen, innerHTML mit Fremddaten)
- unklare Anforderung, Architektur, mehrere Apps betroffen
- Fehler, an dem ein externes Modell schon einmal gescheitert ist

Faustregel: Wenn das Auftragspaket länger würde als die Änderung selbst, nicht auslagern.

## 2. Auftragspaket schreiben
Datei `docs/auftraege/JJJJ-MM-TT-<kurzname>.md` (oder GitHub-Issue mit Label `ki-auftrag`, sobald eingerichtet):

```
# Auftrag: <Titel>
Ziel: <1–2 Sätze>
Dateien (nur diese ändern): <pfad:zeilen>
Vorgaben: <genaue Regeln aus CLAUDE.md, die hier gelten – abgeschrieben, nicht verlinkt>
Fertig, wenn: <prüfbare Kriterien>
Prüfbefehl: <z. B. node tests/parser.test.mjs>
Verboten: andere Dateien, Speicher-Schlüssel, Versionsnummern, main-Branch
Branch: ki/<kurzname>
```

## 3. Ergebnis prüfen (wenn der Pull Request da ist)
1. Nur den Diff lesen (`gh pr diff <nr>`), nicht die ganzen Dateien.
2. Prüfbefehl laufen lassen bzw. GitHub-Actions-Ergebnis ansehen.
3. Urteil: übernehmen / eine Nachbesserungsrunde extern / selbst fertigmachen.
4. Pull Requests externer KIs nie automatisch mergen – der Nutzer gibt frei.

Das ausführende System (Modell, GitHub Action, Kosten) wird im Multi-KI-Plan festgelegt; bis dahin nur Pakete schreiben.
