---
name: lernwerk-eingang
description: Material des Besitzers (Fotos von Mitschriften, Arbeitsblätter, PDFs, Übungsklausuren, Texte) sofort zu einer Lernseite und einem Lernwerk-Block machen und in den Eingang der App legen. Nutzen, sobald er in einer Sitzung Unterrichtsmaterial schickt, „Lernwerk“ schreibt, „speichern“, „in die App“ oder „einfügen“ sagt, und sobald er Termine oder Klausurdaten schickt.
---

# Lernwerk: Material automatisch in die App

Der Besitzer will, dass alles, was er schickt, ohne Nachfragen gespeichert und in die App eingefügt wird.
Er lernt am liebsten mit Trainern und Lernzetteln, wie sie im Chat als Artefakte entstehen. Die App zeigt solche Seiten unverändert als Lernseite.

## Voraussetzung

Das private Repository `Lernwerk-Sicherung` muss in der Sitzung sein (beim Start ausgewählt). Nie Unterrichtsmaterial ins öffentliche Repository `Lernwerk-Techniker` legen.
Fehlt es: einmal kurz sagen, dass er eine neue Sitzung mit beiden Repositorys starten muss, die fertigen Dateien trotzdem bauen und ihm als Datei schicken (Einfügen, Lernseite, Datei wählen).

## Ablauf, ohne Rückfragen

1. Material ganz lesen. Fach und Thema einordnen, Fachname wie in der App (`lehrplan.json`). Nächste Klassenarbeit im Fach aus dem Material oder aus `lernstand.md` im privaten Repository.
2. **Lernseite** bauen: eine einzige HTML-Datei, wie ein gutes Artefakt.
   - Erste Zeile: `<!-- lernwerk fach="…" thema="…" arbeit="JJJJ-MM-TT" -->` (thema und arbeit nur, wenn bekannt).
   - Aufbau wie beim Lernzettel zur Klausur: Themen nummeriert, je Thema Anker aus seiner Welt, Fachbegriff, Merksatz, Vergleichstabellen, Skizzen als SVG, Prüfungsfallen, „So schreibst du es in der Klausur“ (Aussage und Begründung getrennt). Je Thema ein Häkchen „gelernt“.
   - Danach Mini-Prüfungen, erst nach dem Abhaken offen: Auswahlfragen mit drei plausiblen falschen Antworten und einer Erklärung zu jeder falschen Antwort, Reihenfolge-Fragen, offene Klausurfragen mit Punkten und Musterlösung zum Selbstbewerten, ein Fehler-Training aus falsch beantworteten Fragen.
   - Bei Rechenthemen ein Trainer „Weg planen“: Schrittfragen (welche Gleichung, welches Zwischenziel, wohin der Drehpunkt), zu jeder falschen Antwort warum. Er rechnet selbst, die Seite prüft nur.
   - Jede beantwortete Frage an die App melden, damit sie ins Fehlerbuch und in die Wiederholung kommt: `window.lernwerk && window.lernwerk.antwort({ frage, gewaehlt, richtig, ok, thema, erklaerung })`, nur beim ersten Versuch. `thema` ist der Themenname wie in der App. Ohne diesen Aufruf erkennt die App richtig und falsch nur an den Klassen `ok` und `bad` der Antwortknöpfe.
   - Fortschritt in `localStorage` speichern (die App sichert und gleicht ihn ab). Kein `window.claude`, keine Bibliotheken von außen. Schriften von außen nur mit Rückfall auf Systemschrift.
   - Hell und dunkel, Bedienung mit dem Daumen, Brüche mit echtem Bruchstrich.
3. **Lernwerk-Block** bauen (Format in `docs/BLOCKFORMAT.md`), damit die Fragen auch in die Wiederholung kommen: Karten, Begriffe, Erklären mit Kernpunkten, Auswahl mit `Falsch:`-Zeilen, bei Rechenthemen `Fall:` mit `Schrittfrage:`. Mit `node -e` und `js/parser.js` prüfen: keine Fehler.
4. Beide Dateien in `Lernwerk-Sicherung/eingang/` legen: `JJJJ-MM-TT-thema.html` und `JJJJ-MM-TT-thema.txt`. Committen und pushen. Nichts anderes in diesem Repository ändern, nie `lernwerk-sicherung.json` anfassen.
5. Kurz melden: was gespeichert ist, und dass es beim nächsten Öffnen von Lernwerk da ist. Den Block wartet auf der Startseite auf seine Vorschau, die Lernseite ist sofort da.

## Termine

Klausurtermine sofort eintragen, ohne zu fragen: ein Block nur aus `Termin: Fach | JJJJ-MM-TT | Themen`-Zeilen zwischen `=== LERNWERK ===` und `=== ENDE ===`, als `eingang/JJJJ-MM-TT-termine.txt`. Er wartet auf der Startseite und wird mit einem Tipp gespeichert. Fehlt das private Repository, den Block zum Einfügen in die Antwort schreiben (Einfügen, Block). Nur fragen, wenn das Fach wirklich unklar ist. Lehrernamen nicht in den Block.

## Regeln

- Nichts erfinden, vor allem keine Rechenaufgaben, die nicht im Material stehen. Werte des Lehrers und des Tabellenbuchs haben Vorrang, Abweichungen mit „Achtung“.
- Fragen bewusst anders als im Material formulieren, damit er versteht und nicht nur wiedererkennt.
- Keine Bezüge auf das Material: nicht „auf Blatt 20“, „AB20“, „aus der Übungsklausur“, „laut Mitschrift“, keine Markierungen wie „neu aus der Übungsklausur“. Alles vollständig übernehmen, aber für sich stehend.
- Fotos und Namen nie in ein Repository. Nur der fertige Lernstoff.
