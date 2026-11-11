# Lernwerk Techniker: Roadmap

Arbeitsweise: siehe `CLAUDE.md` und `.claude/skills/lernwerk-etappe/SKILL.md`.
Reihenfolge unter „Offen“: zuerst größter Lerngewinn, dann Stabilität, dann Komfort.
Jede Etappe ist einzeln fertig und testbar. Oberste Regel: bestehende Daten nie verlieren.

## Erledigt

Großer Optimierungsdurchgang im November 2026. Stand davor: Version 1.25.2, Zweig `sicherung-vor-optimierung`.

- [x] **Etappe 1, Version 1.26.0: Echtes Abrufen.** Karten werden aufgedeckt und selbst bewertet, Auswahl bleibt als Schalter an der Karte (`kv kartenArt`). Erklär- und Skizzen-Aufgaben kommen in die täglichen Runden, mit Kernpunkten zum Abhaken (`runErklaeren` in `js/engine.js`).
- [x] **Etappe 2, Version 1.27.0: Erst der Weg.** Aufgaben als reiner Text, Gegeben und Gesucht eingeklappt. Ab drei Schritten erst die Reihenfolge wählen. Bei neuen Themen ein durchgerechnetes Beispiel, danach neue Zahlen. Lösungen zeilenweise (`runAufgabe`).
- [x] **Etappe 3, Version 1.28.0: Umstellen schwer.** Frei umstellen Zeile für Zeile, Hinweise zu den typischen Fehlern, 13 schwere Aufgaben, Kachel „Umstellen, schwer“ unter Trainer, Leiterwiderstand mit Leitfähigkeit 56 (`runUmstellen`, `inhalte/formeln-umstellen.txt`).
- [x] **Etappe 4, Version 1.29.0: Formeln wie im Buch.** Echter Bruchstrich auch im Fließtext (`mathText` in `js/formula.js`, Test `tests/mathtext.test.mjs`).
- [x] **Etappe 5, Version 1.31.0: Probeklausur im Lernplan.** Ein bis drei Tage vor einer Arbeit steht sie in der Karte der Arbeit, Ergebnisse werden gespeichert (`kv proben`).
- [x] **Etappe 6, Version 1.30.0: Sicherheitsnetz.** Rückfall-Kopien (`js/rueckfall.js`), Warnung bei Schreibfehlern, Abgleich pausieren und Stand nach GitHub übernehmen, Test `tests/speicher.test.mjs`.
- [x] **Etappe 7, Version 1.31.0: Korrekturen.** Fachrichtung Automatisierungstechnik, Werkstofftechnik bei Modul 8 (Lehrplan Version 6).
- [x] **Etappe 8, Version 1.31.0: Komfort.** „Weiter, wo du warst“ auf der Startseite, Adresse mit `#einfuegen`.
- [x] **Formel-Eingabe, Version 1.31.1:** Löschen entfernt je Druck genau ein Zeichen, unfertige Brüche bleiben nach dem Prüfen erhalten (`js/mathedit.js`).
- [x] **Etappe 9, Version 1.32.0: Fach-Trainer mit „Erst der Weg“.** Gegeben und Gesucht eingeklappt, Reihenfolge der Schritte wählen. Gemeinsame Helfer in `js/aufgabe.js`. `instantiate` steht noch doppelt (App mit Hochzahlen, Trainer ohne), siehe Etappe 13.
- [x] **Etappe 10 (erster Teil), Version 1.33.0: Zuordnen aus Fachbegriffen.** Themen ohne eigene Zuordnen-Zeile bekommen von selbst Zuordnen-Übungen aus ihren Begriffen (`itemsOf` in `js/store.js`, Stufe 2). Version 1.36.0: Themen der Lernfächer ohne eigene Erklären-Zeile bekommen eine Erklär-Aufgabe, Kernpunkte sind die Merksätze (`LERNFAECHER` in `js/store.js`). Offen bleibt: eigene Verwechslung- und Skizze-Zeilen in den Inhaltsdateien, siehe Etappe 10.
- [x] **Etappe 11 (Kern), Version 1.34.0: Probeklausur wirkt auf den Lernplan.** Themen unter 60 Prozent kommen zum Nachholen, das Ergebnis je Thema wird mitgespeichert (`themen`). Version 1.35.0: Knopf „Schwächen jetzt üben“ in der Auswertung, `proben` werden beim Abgleich vereinigt.
- [x] **Etappe 14 (Code), Version 1.35.0:** doppelte Mischfunktion in `js/store.js` entfernt, alter Alias `hochladen` entfernt. Die README ist seit dem Bauplan aktuell.
- [x] **Etappe 12, Version 1.37.0: Sicherung schlank.** Ereignisse älter als 60 Tage werden zu Tageswerten verdichtet, geschützt bleiben je Thema und Art die neuesten zwölf. Abgleich übernimmt Stichtag und Tageswerte. Größe der Sicherung unter Datensicherung. Tests in `tests/speicher.test.mjs`.
- [x] **Etappe 13, Version 1.38.0: Große Dateien geordnet.** `js/engine.js` aufgeteilt in `uebungen.js` und `schmierzettel.js`, `js/extra.js` in `probeklausur.js`, `hoerseite.js` und `noten.js`. Verhalten unverändert. Dabei behoben: Beim geführten Umstellen bleiben alle falsch gewählten Umformungen rot markiert.
- [x] **Bauplan.** `CLAUDE.md`, diese Roadmap, `docs/BLOCKFORMAT.md`, Skill `lernwerk-etappe`, Browser-Prüfung `tools/pruefen/browser.mjs`.

## Offen

### Etappe 10: Abruffragen in den eingebauten Lernfächern (Lerngewinn)

**Lage.** Die eingebauten Inhalte haben keine einzige Zeile `Verwechslung`, `Zuordnen`, `Erklären` oder `Skizze`. Diese Arten kommen nur aus eigenen Blöcken.

**Bauen.** In den Dateien unter `inhalte/` (nicht unter `inhalte/einfuehrung/`) für die Fächer Werkstofftechnik, Führung und Personal, Qualitätsmanagement, Ökonomie und Nachhaltigkeit, Instandhaltung, Steuerungstechnik je Thema ergänzen:
- zwei bis drei `Erklären`-Zeilen (Stufe 3). Aufgabe und Kernpunkte nur aus dem, was im selben Thema schon unter Prinzip, Begriff oder Merksatz steht.
- ein bis zwei `Verwechslung`-Zeilen (Stufe 2) für Begriffspaare, die im Thema beide als `Begriff` vorkommen.
- eine `Zuordnen`-Zeile (Stufe 2) aus vier bis fünf vorhandenen Begriffen.
- eine `Skizze`-Zeile, wo das Thema eine eingebaute Skizze hat (`inhalte/bilder/index.json`). Kernpunkte sind die beschrifteten Teile der Skizze.
Nichts Neues erfinden. Keine neuen Fakten, nur Umformungen des Vorhandenen. Vor jede Gruppe die passende `Stufe:`-Zeile setzen und ans Ende des Themas stellen, damit die Stufen der vorhandenen Zeilen gleich bleiben.

**Daten.** Kein Risiko. Neue Übungen bekommen neue Kennungen. Diese Schlüssel ändern die Podcast-Folgen nicht, Audio muss nicht neu erzeugt werden (der Inhalte-Test darf keinen Hinweis „Hörmodus“ melden).

**Prüfkriterien.**
- `node tests/inhalte.test.mjs` meldet 0 Probleme und keinen Hörmodus-Hinweis.
- Jedes ergänzte Thema hat in `st.topicItems(tid)` mindestens eine Übung der Art `erklaeren`.
- Stichprobe von zehn neuen Zeilen: Jeder Kernpunkt lässt sich im selben Thema wörtlich oder sinngleich wiederfinden.
- In der App läuft eine Runde aus einem ergänzten Thema durch (Stufe 3 freischalten oder Fragen „Alles gemischt“).

### Wartet auf den Besitzer

Diese Punkte nicht von selbst beginnen.

- **Inhalte zu Kapitalbindung und Lagerkennzahlen, volle Blöcke zu Führungsstilen, Motivation, Konflikten.** Dafür fehlen die Unterlagen aus dem Unterricht. Regel: nichts erfinden. Sobald Material da ist, als Block unter `inhalte/` bauen, mit Erklären-, Verwechslung- und Zuordnen-Zeilen, und die Audio-Folgen neu erzeugen.
- **Formelzeichen der Leitfähigkeit.** Die App schreibt κ, im Unterricht wird mit dem Wert 56 gerechnet. Welches Zeichen der Lehrer benutzt (κ oder γ), ist offen. Nach Klärung in `inhalte/leiterwiderstand.txt` einheitlich schreiben und die Folge neu erzeugen.
- **Eigene Blöcke als Audiodatei.** Die iPhone-Stimme stoppt bei gesperrtem Bildschirm. Möglich wäre: Audiodateien für eigene Blöcke in einer Claude-Code-Sitzung mit `tools/hoer` erzeugen und im privaten Sicherungs-Repository ablegen, die App lädt sie mit dem Zugangsschlüssel. Großer Aufwand, nur auf ausdrücklichen Wunsch. Nie ins öffentliche Repository.

## Geht nicht

- Unterlagen automatisch aus Teams oder GoodNotes holen. Eine Web-App ohne Server kann das nicht.
- Mitteilungen ohne Server. Ersatz: Kurzbefehle-Automation, Anleitung unter Mehr, Erinnerung.
- KI-Bewertung in der App. Bewusst nicht gewollt. Ersatz: „Frag Claude“ und „An Claude zur Korrektur“.
