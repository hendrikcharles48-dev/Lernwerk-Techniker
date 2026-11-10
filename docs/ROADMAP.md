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
- [x] **Bauplan.** `CLAUDE.md`, diese Roadmap, `docs/BLOCKFORMAT.md`, Skill `lernwerk-etappe`, Browser-Prüfung `tools/pruefen/browser.mjs`.

## Offen

### Etappe 9: Fach-Trainer auf den neuen Stand bringen (Lerngewinn)

**Lage.** Die fünf Fach-Trainer (`trainer/festigkeit-trainer.html`, `maschinenelemente-`, `elektro-`, `steuerung-`, `leiterwiderstand-trainer.html`) laufen über `js/fachtrainer.js`. Dort steht die Aufgaben-Logik ein zweites Mal (`instantiate`, `runAufgabe`, `runMC`). Sie kennt die Neuerungen aus Etappe 2 nicht.

**Bauen.**
1. In `js/fachtrainer.js` bei Aufgaben Gegeben und Gesucht einklappen, wie `ggHTML` in `js/engine.js`.
2. „Erst der Weg“ einbauen: gleiche Regeln wie in `runAufgabe` in `js/engine.js` (ab drei Schritten mit Text, Abhängigkeit über die enthaltene Rechnung, Überspringen erlaubt).
3. Lösung zeilenweise zeigen (Formel, eingesetzte Werte, Ergebnis), Klassen `rweg`, `rw-z`, `rw-g`. Die Stile aus `css/app.css` nach `trainer/fachtrainer.css` übernehmen.
4. Gemeinsame reine Funktionen in eine neue Datei `js/aufgabe.js` ziehen und von beiden Stellen nutzen: `instantiate` und die Abhängigkeitsprüfung der Schritte. `js/aufgabe.js` in `FILES` in `sw.js` eintragen. Keine Funktion in `fachtrainer.js` entfernen, die die Seite braucht (Kann-Liste, Lernblatt, Prüfung).

**Daten.** Kein Risiko. Der Stand der Fach-Trainer liegt in localStorage unter `lernwerk:lw-ft:<id>` und bleibt unberührt.

**Prüfkriterien.**
- Alle fünf Trainer-Seiten laden ohne Fehler in der Konsole, in allen Modi (Zufall, Thema, Kann-Liste, Lernblatt, Prüfung).
- Eine Aufgabe mit drei Schritten fragt zuerst nach der Reihenfolge. Eine falsche Reihenfolge wird rot markiert, „Überspringen“ geht.
- Ergebnisse kommen weiter in der App an: nach einer gelösten Aufgabe und Rückkehr hat die Karte `t:<Themen-ID>` einen neuen Stand.
- `instantiate` liefert in App und Trainer dieselben Werte für dieselbe Aufgabe (kleiner Test in `tests/parser.test.mjs`).

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

### Etappe 11: Probeklausur wirkt auf den Lernplan (Lerngewinn)

**Lage.** Das Ergebnis einer Probeklausur wird gespeichert (`kv proben`), ändert aber nichts.

**Bauen.**
1. In `runExam` in `js/extra.js` beim Schließen je Thema die Quote der Rechenaufgaben und der abgehakten Kernpunkte bilden. Themen unter 60 Prozent mit `st.planNachholenSetzen(ex, …)` zum Nachholen eintragen, wenn die Probeklausur zu einer Arbeit gehört (`exId`). Vorhandene Einträge behalten.
2. Im Ergebnis-Eintrag `themen: { [tid]: quote }` mitspeichern (neues Feld, darf fehlen).
3. In der Auswertung einen Knopf „Schwächen jetzt üben“ zeigen, der `planTagLernen(ex, 'schwach')` startet. Dafür `planTagLernen` aus `js/app.js` exportieren.
4. `proben` beim Abgleich zusammenführen statt „der neuere Stand gewinnt“: in `js/abgleich.js` den Schlüssel in `SONDER` aufnehmen und die Listen beider Seiten über `id` vereinigen, nach `zeit` sortieren, die neuesten 40 behalten. Test in `tests/abgleich.test.mjs`.

**Daten.** Geringes Risiko. Nur neue Felder. Alte Einträge ohne `themen` müssen weiter angezeigt werden.

**Prüfkriterien.**
- Probeklausur mit einem schwachen Thema: Danach steht das Thema in der Karte der Arbeit unter „nochmal“.
- Zwei Geräte-Stände mit je einer anderen Probeklausur ergeben nach `zusammenfuehren` beide Einträge.
- Ein alter Eintrag ohne `themen` wird in der Liste „Letzte Probeklausuren“ gezeigt.

### Etappe 12: Sicherung schlank halten (Stabilität)

**Lage.** Jeder Abgleich lädt die ganze Datei hoch und erzeugt einen Commit im privaten Repository. Die Datei enthält bis zu 5000 Ereignisse. Das Repository wächst über die Monate.

**Bauen.**
1. Messen: in `abgleichen()` die Größe des hochgeladenen Texts in `prefs` (`ghGroesse`) merken und unter Datensicherung anzeigen.
2. Ereignisse verdichten: Ereignisse, die älter als 60 Tage sind, zu Tageswerten zusammenfassen und in `kv tage` ablegen: `{ 'JJJJ-MM-TT': { n, ok } }`. Erst danach die alten Ereignisse entfernen. Keine Löschmarke je Ereignis, die Liste würde zu groß. Stattdessen einen Zeitstempel `kv ereignisseAb` setzen: `zusammenfuehren` verwirft alle Ereignisse, die älter sind, außer den geschützten aus den Prüfkriterien. Beim Abgleich gilt der höhere Wert beider Seiten.
3. `lernSerie()` in `js/store.js` muss die Tage aus `kv tage` mitzählen. Die Wochenstatistik braucht nur die letzten sieben Tage und bleibt.
4. `tage` beim Abgleich je Tag zusammenführen: der höhere Wert von `n` gewinnt.
5. Vor dem ersten Verdichten `rueckfall.sichern('Vor dem Verdichten', …)`.

**Daten.** Mittleres Risiko. Deshalb zuerst Tests: alter Stand mit 3000 Ereignissen über 120 Tage laden, verdichten, prüfen, dass Serie, Stärke je Thema (`staerke`) und Kartenstände gleich bleiben.

**Prüfkriterien.**
- `staerke(tid)` ist vor und nach dem Verdichten für jedes Thema gleich (sie nutzt nur die letzten zwölf Ereignisse je Thema: diese dürfen nie verdichtet werden, auch wenn sie älter als 60 Tage sind).
- Die Serie ist vor und nach dem Verdichten gleich.
- Zwei Geräte, eines verdichtet, eines nicht: Nach dem Abgleich kommen die alten Ereignisse nicht zurück.
- Die Datei ist nach dem Verdichten kleiner. Die Anzeige unter Datensicherung zeigt die Größe.

### Etappe 13: Große Dateien ordnen (Stabilität, für spätere Arbeit)

**Lage.** `js/engine.js`, `js/app.js` und `js/extra.js` haben über 900 Zeilen mit sehr langen Zeilen. Das macht Änderungen fehleranfällig.

**Bauen.** Nur verschieben, kein Verhalten ändern:
- aus `js/engine.js`: `js/uebung-aufgabe.js` (`runAufgabe`, `runExamAufgabe`, `ggHTML`), `js/uebung-umstellen.js` (`runUmstellen`, `probe`), `js/uebung-karten.js` (Karten, Begriffe, Verwechslung, Zuordnen, Erklären, Fehlerkarte), `js/schmierzettel.js`.
- aus `js/extra.js`: `js/probeklausur.js`, `js/hoerseite.js`, `js/noten.js`.
- Jede neue Datei in `FILES` in `sw.js`. Importe anpassen. Keine zyklischen Importe über `app.js`.

**Daten.** Kein Risiko.

**Prüfkriterien.**
- Alle Tests und `node tools/pruefen/browser.mjs` laufen durch.
- Jede Übungsart einmal im Browser durchgespielt: Karte, Begriff, Aufgabe (mit Weg und Beispiel), Umstellen (geführt und frei), Auswahl, Reihenfolge, Verwechslung, Zuordnen, Erklären, Skizze, Fehlerkarte, Probeklausur.
- Der Inhalte-Test findet alle Dateien aus `FILES`.

### Etappe 14: Tote Reste und README (Komfort)

**Bauen.** `README.md` auf den Stand der App bringen (Tabelle „Themen und Status“ aus `lehrplan.json` und `inhalte/index.json` neu erzeugen). In `js/store.js` die doppelte Mischfunktion `shuffleArr` durch `shuffle` aus `util.js` ersetzen. Den Alias `hochladen` in `js/sicherung.js` entfernen, wenn ihn nichts mehr nutzt (vorher suchen).

**Prüfkriterien.** Alle Tests laufen. `grep` findet keine Nutzung der entfernten Namen.

### Wartet auf den Besitzer

Diese Punkte nicht von selbst beginnen.

- **Inhalte zu Kapitalbindung und Lagerkennzahlen, volle Blöcke zu Führungsstilen, Motivation, Konflikten.** Dafür fehlen die Unterlagen aus dem Unterricht. Regel: nichts erfinden. Sobald Material da ist, als Block unter `inhalte/` bauen, mit Erklären-, Verwechslung- und Zuordnen-Zeilen, und die Audio-Folgen neu erzeugen.
- **Formelzeichen der Leitfähigkeit.** Die App schreibt κ, im Unterricht wird mit dem Wert 56 gerechnet. Welches Zeichen der Lehrer benutzt (κ oder γ), ist offen. Nach Klärung in `inhalte/leiterwiderstand.txt` einheitlich schreiben und die Folge neu erzeugen.
- **Eigene Blöcke als Audiodatei.** Die iPhone-Stimme stoppt bei gesperrtem Bildschirm. Möglich wäre: Audiodateien für eigene Blöcke in einer Claude-Code-Sitzung mit `tools/hoer` erzeugen und im privaten Sicherungs-Repository ablegen, die App lädt sie mit dem Zugangsschlüssel. Großer Aufwand, nur auf ausdrücklichen Wunsch. Nie ins öffentliche Repository.

## Geht nicht

- Unterlagen automatisch aus Teams oder GoodNotes holen. Eine Web-App ohne Server kann das nicht.
- Mitteilungen ohne Server. Ersatz: Kurzbefehle-Automation, Anleitung unter Mehr, Erinnerung.
- KI-Bewertung in der App. Bewusst nicht gewollt. Ersatz: „Frag Claude“ und „An Claude zur Korrektur“.
