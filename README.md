# Lernwerk Techniker

Lern-App für die Fachschule Technik (Maschinentechnik, Schwerpunkt Automatisierungstechnik).
Statische Web-App für GitHub Pages: kein Server, keine Anmeldung, keine laufenden Kosten.
Auf dem iPhone in Safari öffnen und zum Home-Bildschirm hinzufügen, dann läuft sie wie eine App, auch offline.

Alle Lerndaten, Fotos und eingefügten Inhalte bleiben auf dem Gerät (IndexedDB). Im Repository liegt nichts Persönliches.

## Was die App kann

**Heute:** Oben eine schmale Zeile mit dem Tagesfortschritt (geschafft und offen). Die Lernknöpfe zeigen direkt, wie viel dort offen ist und wie lange es etwa dauert. Darunter eine schmale Zeile „Im Unterricht“. Countdown zur nächsten Klassenarbeit mit deren Themen, deinem Stand und der Prüfungsbereitschaft in Prozent. Knöpfe „Unterricht“ und „Alles wiederholen“ mit kleinen Schildern, aus welchen Themen die offenen Übungen kommen. Darunter zwei Wahlknöpfe nebeneinander, die beim Antippen ihre Optionen aufklappen: Lernzeit (2, 5, 10 oder 20 Minuten, 10 oder 20 Fragen, die letzte Wahl bleibt) und welche Fragen kommen (freigeschaltet, alles gemischt, nur schwere). Kleiner Knopf „Mini“ für 2 Minuten. Ist die Zeit um, endet die Runde sauber, übrige fällige Karten verteilen sich auf die nächsten drei Tage. „Weiter, wo du warst“. Wochenstatistik mit Serie (ein freier Tag pro Woche bricht sie nicht). Hinweis, wenn die letzte Sicherung älter als 14 Tage ist oder die automatische Sicherung ein Problem hat.

**Wischen:** Auf den fünf Hauptseiten wechselt waagerechtes Wischen zum Nachbarbereich der unteren Leiste. Nicht in Unterseiten, nicht in Lerneinheiten und nicht auf Elementen, die selbst wischen oder waagerecht scrollen.

**Im Unterricht** (unter Mehr): Liste der Fächer. Im Fach stehen alle Themen in Lehrplan-Reihenfolge, jedes mit dem Schalter Kommt noch, Im Unterricht, Abgeschlossen. Umschalten sortiert nicht neu.

**Diagramme:** Woche (Übungen pro Tag), Stand im Fach und je Thema (neu, wackelt, sitzt), Anteil, der in jeder Stufe sitzt, Notenverlauf pro Fach, Fehler nach Art und pro Woche, Punkte nach Aufgabenart in der Probeklausur. Antippen zeigt den Wert. Eigene SVG-Diagramme in `js/diagramm.js`, ohne Bibliothek.

**Stufen:** Jedes Thema hat drei Stufen: 1 Grundlagen (Begriffe, einfache Karten), 2 Zusammenhänge (Karten mit Warum und Wie, Formeln umstellen, Reihenfolge, Verwechslung, Zuordnen), 3 Anwenden (Aufgaben, Auswahlfälle). Eingebaute Inhalte ordnet die App selbst zu, im Block geht es mit `Stufe: 1`, `2` oder `3`. Abgefragt wird nur, was freigeschaltet ist. Neue Themen starten mit Stufe 1. „Hatten wir“ im Thema schaltet die nächste Stufe frei. Sitzt eine Stufe (70 Prozent ihrer Fragen mindestens auf Wiederhol-Stufe 3), schlägt die App die nächste vor, schaltet aber nie selbst frei. Eigene eingefügte Inhalte sind immer ganz frei. Themen, in denen vor dem Update schon gelernt wurde, behalten alle Stufen, in denen es Fortschritt gibt.

**Schmierzettel:** Bei jeder Frage oben „Zettel“: tippen oder mit dem Finger zeichnen. Wird nicht geprüft, nicht gespeichert und bei der nächsten Frage geleert.

**Fächer:** Fächer aus dem Lehrplan mit Modul, Akzentfarbe und Fortschritt. Themen in drei Gruppen: aktuell im Unterricht (Schalter im Thema), vorhanden, kommt noch. Zweite Ansicht „Nach Modulen“. Ein Thema hat die Reiter Prinzip, Bausteine, Üben, Karten, Schnellweg, Lernzettel, Fotos. Bei alten Trainern gibt es einen großen Knopf, der den Trainer öffnet. Oben rechts: „Als Block kopieren“.

**Einfügen** (Plus in der Mitte):
- Großer Knopf „Aus Zwischenablage einfügen“, danach sofort die Vorschau. Mit der Prüfzeile `Inhalt: 6 Karten; 2 Aufgaben` zählt die App nach und meldet deutlich, wenn etwas fehlt oder „=== ENDE ===“ fehlt.
- Lernwerk-Block aus dem Claude-Chat einfügen, mit Vorschau („Elektrotechnik, Kondensator: 1 Merksatz, 6 Karten …“), Zuordnung zu Fach und Thema und Speichern ohne Duplikate. Neue Fächer werden angelegt. Lesefehler werden mit Zeilennummer gezeigt.
- Knopf „Vorlage für Claude kopieren“.
- Freier Text als Lernzettel (Markdown wird sauber dargestellt).
- Foto einem Thema zuordnen (nur auf dem Gerät).

**Fehlerbuch:** Fehler aus den Übungen und aus den alten Trainern landen automatisch hier. Eigene Einträge, zum Beispiel aus einer zurückgegebenen Klassenarbeit. Gruppiert nach Fehlerart, häufigste oben. Jeder Eintrag wird zur Fehlerkarte. „Frag Claude“ kopiert eine fertige Frage und öffnet claude.ai.

**Mehr:** Termine mit Lernplan rückwärts (Dienstag und Donnerstag leichter, letzter Tag nur Wiederholung), Probeklausur, Hörmodus, Erklär-Training, Lexikon, Formelsammlung, Suche, Lehrplan bearbeiten, Datensicherung, Darstellung (automatisch, hell, dunkel), Anleitung für eine Erinnerung per Kurzbefehle.

**Wiederholsystem:** Abstände 1, 2, 4, 7, 14, 30 Tage. Richtig beim ersten Versuch: eine Stufe hoch. Mit Hilfe: gleiche Stufe. Falsch: zwei Stufen zurück, also von 30 auf 7 Tage. Karten auf Stufe 1 oder 2 fangen bei Falsch wieder bei 1 an. Vor einer Klassenarbeit werden deren Themen vorgezogen. Begriffe kommen abwechselnd auch umgedreht (Erklärung lesen, Begriff finden). Verwechslungen und Zuordnungen laufen in der normalen Wiederholung mit.

**Probeklausur:** Wie im Ernstfall mit echter Zeitvorgabe (30, 45, 60 oder 90 Minuten), ohne Tipps, Rechnen auf Papier, nur Ergebnisse eintippen. Vier Aufgabenarten: Rechnen (die App prüft), Begriffe erklären, Skizzen (auf Papier) und Text. Die Auswertung kommt am Ende: Kernpunkte abhaken, daraus rechnet die App Punkte und Note. „An Claude zur Korrektur“ kopiert Aufgabe und Antwort und öffnet claude.ai.

**Automatische Sicherung:** Nach jeder Lerneinheit und nach dem Einfügen sichert die App den Stand als `lernwerk-sicherung.json` in ein eigenes privates GitHub-Repository, direkt über die GitHub-Schnittstelle, ohne Server. Fotos sind ausgenommen. Der Zugangsschlüssel (fein eingeschränkt, nur dieses Repository, Contents lesen und schreiben) liegt nur auf dem Gerät und steht in keiner Sicherungsdatei. Ohne Netz wird es später nachgeholt. Auf einem neuen Gerät Schlüssel eintragen und „Stand von GitHub laden“. Die manuelle Sicherung bleibt.

**Speichernamen:** Alle Einträge im Browser-Speicher beginnen mit `lernwerk:`, weil Satzwerk unter derselben Adresse liegt. `lernwerk-speicher.js` übernimmt alte Werte der Trainer einmalig und lässt die alten Einträge stehen.

**Prüfen:** Du rechnest, die App prüft jeden Schritt. Toleranz 1 Prozent, gezielte Hinweise bei Faktor 1000 (Einheit), Vorzeichen, RAD statt DEG, Quadrant beim Arcustangens, Kehrwert, Wurzel vergessen, zu früh gerundet. Umstellungen werden mit Zahlenproben geprüft, nicht mit eval. Tipp und Lösung bleiben zu, bis du sie öffnest.

## Einführungen für alle Fächer und Themen

Jedes Fach hat eine kurze Einleitung (`inhalte/faecher.json`), die oben auf der Fachseite steht und vorgelesen werden kann. Jedes Thema hat eine Einführung (`inhalte/einfuehrung/`) mit Bild aus deiner Welt, Fachbegriffen, Merksatz, Grundlagen, Herangehensweise in Bausteinen, typischen Fehlern, Karten und, wo es passt, Formeln mit allen Umstellungen.

Themen, die nur die Einführung haben, bleiben in der Gruppe „Kommt noch“ und zeigen „Einführung lesen“. Sobald du über Einfügen etwas ergänzt, ein Lernzettel oder Foto dazukommt oder du das Thema als aktuell markierst, rückt es nach oben. Karten aus Einführungen kommen erst in „Heute dran“, wenn das Thema aktuell ist oder zu einer eingetragenen Klassenarbeit gehört.

Wo Bücher oder Normen sich widersprechen, nennt die Einführung beide Angaben und markiert das mit „Achtung“. Beispiele: Eisen-Kohlenstoff-Diagramm (723 oder 727 °C, 2,06 oder 2,11 Prozent), Allgemeintoleranzen (ISO 2768-2 ersetzt durch ISO 22081 und DIN 2769), Oberflächenangaben (ISO 1302 ersetzt durch ISO 21920-1), Kennbuchstaben (DIN 40719 alt, DIN EN IEC 81346-2 neu), SR- und RS-Speicher in TIA Portal, FMEA (Risikoprioritätszahl oder Aufgabenpriorität), ISO 9001 (Fassung 2015 und 2026), Maschinenverordnung (EU) 2023/1230 ab 20. Januar 2027.

## Themen und Status

| Fach | Vorhanden | Geplant |
|---|---|---|
| Mathematik | Mengenlehre, Terme, binomische Formeln, Faktorisieren, Bruchterme (alter Trainer); **Gleichungen und Formeln umstellen (neuer Trainer)** | lineare Gleichungssysteme, Potenzen, Wurzeln und Einheiten, quadratische Gleichungen, Trigonometrie, Funktionen, Logarithmen, Differentialrechnung |
| Elektrotechnik (M2) | Ohm, Reihe und Parallel, gemischte Schaltungen, Kirchhoff, Rückrechnen (alte Trainer) | Leistung, Arbeit, Wirkungsgrad, Sensoren, belasteter Spannungsteiler, Kondensator, Spule und Induktion, Wechselstrom, Drehstrom |
| Technische Mechanik (M2) | zentrales Kräftesystem, Momente, Lagerkräfte, Formelsammlung, Wandschwenkkran (alte Trainer) | Festigkeitslehre, allgemeines Kräftesystem und Streckenlast, Reibung, Biegung, Torsion |
| Toleranzen und technische Zeichnung (M1) | Toleranzen-App, IT ablesen, Lernblatt Passungen (alte Trainer) | Form- und Lagetoleranzen lesen, Oberflächenangaben |
| CAD und E-CAD (M1) | SolidWorks-Kürzel (alter Trainer) | Skizzenbeziehungen, EPLAN Stromlaufplan |
| Werkstofftechnik (M2) | Eisen-Kohlenstoff-Diagramm (alter Trainer) | Stahlbezeichnungen, Wärmebehandlung, Werkstoffprüfung |
| Steuerungstechnik, Pneumatik und SPS (M2) | – | Wegeventile, Ansteuerung, Elektropneumatik, Logik, SPS, GRAFCET |
| Automatisierung vertieft (M3, M4) | – | Regelungstechnik, Messtechnik, Robotik, Maschinensicherheit, Netzwerktechnik |
| Projektmanagement und Datenverarbeitung (M1) | – | Lasten- und Pflichtenheft, Projektstrukturplan, Gantt, Risikoanalyse, Zahlensysteme, Tabellenkalkulation |
| M5 bis M8, Deutsch, Englisch, Politik | – | siehe `lehrplan.json` |

Reihenfolge der nächsten neuen Trainer: Elektrische Leistung, Wegeventile und Schaltzeichen, Logik und Wahrheitstabelle, Pneumatik Ansteuerung, Festigkeitslehre, SPS-Grundlagen, Sensoren, Gleichungssysteme, Potenzen und Einheiten, Lasten- und Pflichtenheft, Stahlbezeichnungen.

## Das Lernwerk-Block-Format

Jede Zeile beginnt mit einem Schlüssel. Schlüssel dürfen mehrfach vorkommen. Groß- und Kleinschreibung ist egal, Markdown-Reste werden ignoriert, Zeilen ohne Schlüssel gehören zum vorherigen Feld. Mehrere Blöcke in einem Text sind erlaubt.

```
=== LERNWERK ===
Fach: Elektrotechnik
Thema: Kondensator
Modul: M2
Anker: Bild aus meiner Welt
Begriff: Fachbegriff | Erklärung in einem Satz
Merksatz: …
Prinzip: Erklärung in ganzen Sätzen, darf mehrere Zeilen haben
Baustein: ein Lösungsbaustein pro Zeile
Schnellweg: …
Fehler: typischer Fehler | worauf ich achten muss
Formel: Name | Formel | Umstellung; weitere Umstellung
Karte: kurze Frage | kurze Antwort
Aufgabe: Aufgabentext, Platzhalter wie {C} werden mit Zufallswerten gefüllt
Gegeben: C = {C} µF
Gesucht: Q
Tipp: optionaler Tipp
Schritt: was berechnet wird | Ergebnis | Einheit | So gehst du heran (optional, steht nur im Tipp)
Ergebnis: Zahl | Einheit
Variable: Name | von | bis | Schrittweite
Rechnung: Formel mit den Variablennamen
Termin: Fach | JJJJ-MM-TT | Themen
=== ENDE ===
```

- **Schritt-Ergebnis** kann eine Zahl sein, eine Rechnung mit den Variablen (`C * U`) oder eine Gleichung (`Q = C · U`). Gleichungen werden als Umstellschritt geprüft.
- **Variable und Rechnung** sind optional. Mit ihnen erzeugt die App bei jedem Üben neue Zahlen und rechnet die Lösung selbst aus.
- Der Formel-Parser kann `+ − · / ^ ² ³`, Klammern, `√` und `sqrt`, `sin cos tan` in Grad, `asin acos atan`, `ln`, `lg`, `π` und implizites Mal (`2πd`).
- Unbekannte Schlüssel werden als Notiz behalten.

Stufen, Prüfzeile und weitere Fragearten:

```
Stufe: 2                     gilt für alle folgenden Zeilen bis zur nächsten Stufe-Zeile, ohne Stufe-Zeile Stufe 1
Verwechslung: Begriff A | Begriff B | Unterschied in einem Satz
Zuordnen: Titel | Begriff = Bedeutung; Begriff = Bedeutung; Begriff = Bedeutung
Erklären: Prüfungsaufgabe | Kernpunkt; Kernpunkt; Kernpunkt
Skizze: Prüfungsaufgabe zum Zeichnen auf Papier | Kernpunkt; Kernpunkt
Inhalt: 6 Karten; 2 Aufgaben; 3 Begriffe
```

- **Stufe 1** Grundlagen: Anker, Begriffe, Merksatz, einfache Karten. **Stufe 2** Zusammenhänge: Prinzip, Formeln, Bausteine, Karten zu Zusammenhängen, Verwechslung, Zuordnen. **Stufe 3** Anwenden: Aufgaben, Fehler, Schnellweg, schwere Karten, Erklären, Skizze.
- **Erklären und Skizze** kommen in der Probeklausur dran. Die Kernpunkte hakst du bei der Auswertung ab.
- **Inhalt** zählt, was im Block steht. Fehlt beim Einfügen etwas, zeigt die Vorschau es rot an.

Erweiterungen für eingebaute Trainer (gehen auch im Chat-Block):

```
Umstellen: Formel | nach welcher Größe | Lösung
Umformung: Operation | Gleichung danach | falsche Operation; falsche Operation
Auswahl: Frage | richtige Antwort | falsch; falsch; falsch
Reihenfolge: Titel | Schritt 1; Schritt 2; Schritt 3
Quelle: …
```

## Hörmodus und Podcast-Folgen

Im Hörmodus gibt es zu jedem Thema eine Folge: Lena fragt, Tom erklärt. Vor jeder Antwort ist eine Denkpause zum laut Antworten.

- Die Folge wird aus dem Thema gebaut (`js/podcast.js`): Anker, Prinzip, Begriffe, Formeln mit Aufbau, Merksätze, fünf Fragen, Fehler, Schnellweg.
- Eigenes Skript im Block, dann gilt es statt der automatischen Folge:
  ```
  Podcast: Lena | Tom, was ist eigentlich ein Moment?
  Podcast: Tom | Stell dir einen Schraubenschlüssel vor …
  ```
- **Im Auto:** „Auto-Playlist starten“ spielt mehrere eingebaute Folgen hintereinander (15, 30, 45 oder 60 Minuten), Themen der nächsten Arbeit zuerst. Nur Folgen mit Audiodatei, weil nur die bei gesperrtem Bildschirm weiterlaufen. Weiter, Zurück und Pause gehen über Sperrbildschirm, Lenkrad und die „Läuft gerade“-Anzeige in CarPlay. Achtung: Das iPhone zeigt dabei Weiter und Zurück statt ±15 Sekunden, beides zugleich geht nicht. CarPlay zeigt keine eigene Liste.
- Eigene Blöcke sind nicht in der Playlist, lassen sich aber einzeln abspielen: Lena und Tom bekommen zwei verschiedene deutsche Stimmen des iPhones.
- Für eingebaute Themen gibt es Audiodateien mit natürlichen Stimmen (Piper, frei nutzbar) unter `audio/`. Eigene Inhalte und Lernzettel liest die Systemstimme, sie bleiben auf dem Gerät.
- Nach Änderungen an Inhalten die Audios neu erzeugen. Es werden nur geänderte Folgen gebaut:
  ```
  pip install piper-tts      # einmalig, dazu ffmpeg
  node tools/hoer/skript.mjs
  python3 tools/hoer/erzeugen.py
  ```

## Ein Thema als Inhaltsdatei anlegen

1. Datei unter `inhalte/` anlegen, zum Beispiel `inhalte/elektrische-leistung.txt`, im Lernwerk-Block-Format.
2. Dateinamen in `inhalte/index.json` eintragen. Einführungen bekommen dort `"art": "einfuehrung"`, damit das Thema in „Kommt noch“ bleibt.
3. Fach und Thema müssen zu einem Eintrag in `lehrplan.json` passen, oder dort beim Thema `"inhalt": "inhalte/elektrische-leistung.txt"` setzen.
4. Datei in `sw.js` in die Liste `FILES` aufnehmen und `VERSION` erhöhen.
5. Tests laufen lassen: `node tests/parser.test.mjs`.

Eingebaute Inhalte und eingefügte Blöcke nutzen dieselbe Engine. Ein neues Thema kostet nur Inhalt, keinen Code.

## Alte Trainer

Die zwölf alten Trainer liegen unverändert unter `trainer/`. Sie binden `lernwerk-bridge.js` ein:
- schmaler Zurück-Knopf „Lernwerk“ und „Sitzung abschließen“ (sitzt, wackelt, sitzt nicht)
- Ergebnisse gehen in den gemeinsamen Speicher. Statik-Trainer, Rückrechen-Trainer, IT ablesen, SolidWorks-Kürzel und Mathe trainieren melden Richtig und Falsch automatisch, Fehler landen im Fehlerbuch.
- alte Klausurdaten von Ende September und Anfang Oktober 2026 sind ausgeblendet
- in Mathe ist die Handschrift-Prüfung außerhalb von Claude ausgeblendet; Speicher fällt auf das Gerät zurück

Die Bridge schreibt in einen Eingang im Browser-Speicher derselben Adresse. Lernwerk übernimmt ihn beim Zurückkehren in die eigene Datenbank.

## GitHub Pages einschalten

Auf dem iPhone in Safari auf github.com im Repository: **Settings**, **Pages**, bei Source **Deploy from a branch**, Branch **main** und Ordner **/ (root)**, **Save**. Nach ein bis zwei Minuten ist die App erreichbar unter

`https://hendrikcharles48-dev.github.io/Lernwerk-Techniker/`

Dann in Safari: Teilen-Knopf, **Zum Home-Bildschirm**.

Updates laufen automatisch: Änderungen werden direkt auf `main` veröffentlicht. Beim nächsten Öffnen holt sich die App die neue Version selbst und zeigt kurz „Lernwerk wurde aktualisiert“. Ist gerade eine Übung offen, wartet sie damit, bis du fertig bist. Dafür bei jeder Änderung `VERSION` in `sw.js` und `js/app.js` gleich erhöhen.

## Technik

- `index.html`, `css/app.css`, `js/` (ES-Module, keine externen Bibliotheken), `lehrplan.json`, `inhalte/`, `trainer/`
- `manifest.webmanifest` und `sw.js` für Home-Bildschirm und Offline
- IndexedDB für Inhalte, Lernzettel, Fotos und Fortschritt, localStorage nur für kleine Einstellungen; `navigator.storage.persist()` wird angefragt
- Tests: `node tests/parser.test.mjs` (Parser mit den Beispielblöcken in `tests/beispiel-bloecke.txt`, Formel-Parser, Zahlenprüfung, Wiederholsystem) und `node tests/inhalte.test.mjs` (alle Inhaltsdateien lesbar, jedes Lehrplan-Thema hat eine Einführung, alle Formel-Umstellungen mathematisch geprüft, keine Pfeile und Abkürzungen)

Im Zweifel gilt dein Tabellenbuch und der Unterricht.
