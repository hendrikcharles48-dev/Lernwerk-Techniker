# Lernwerk Techniker: Bauplan und Regeln für Claude

Lern-App für die Fachschule Technik. Statische Web-App auf GitHub Pages, läuft auf dem iPhone vom Home-Bildschirm.
Kein Server, keine Anmeldung, keine laufenden Kosten, keine KI in der App. Keine externen Bibliotheken.

Weitere Unterlagen:
- `docs/ROADMAP.md`: offene Etappen, so beschrieben, dass sie ohne Rückfragen umsetzbar sind.
- `docs/BLOCKFORMAT.md`: genaues Format des Lernwerk-Blocks.
- `.claude/skills/lernwerk-etappe/SKILL.md`: Ablauf für „nächste Etappe“.
- `README.md`: was die App für den Nutzer kann.

## Arbeitsregeln

1. **Erst Plan zeigen, dann auf das OK warten.** Ausnahme: Der Besitzer sagt ausdrücklich, dass du allein entscheiden sollst.
2. **Bestehende Daten nie verlieren.** Lernstände, Karten, eingefügte Inhalte, Lernzettel, Fehlerbuch, Termine und Sicherungen sind unantastbar. Siehe „Datenmodell ändern“.
3. **Änderungen bündeln.** Eine Etappe ist ein fertiges, testbares Stück. Nach jeder Etappe committen.
4. **Nichts Persönliches ins Repository.** Es ist öffentlich. Keine Namen, Termine, Noten, eigenen Lerninhalte.
5. **Der universelle Klon „Lernwerk“ ist ein anderes Repository und wird von hier aus nie angefasst.**
6. Antworten an den Besitzer: Deutsch, einfache Sätze, klare Ansagen, was er selbst tun muss. Er schreibt meist vom iPhone.
7. Nur Vorschläge, die mit iPhone und ohne Server gehen. Sonst direkt sagen, dass es nicht geht.

## Material des Besitzers sofort speichern (vom Besitzer ausdrücklich gewünscht)

- Schickt er Unterrichtsmaterial (Fotos, Arbeitsblätter, PDFs, Übungsklausuren), wird es ohne Rückfrage zu einer Lernseite und einem Lernwerk-Block und landet in `eingang/` im privaten Repository `Lernwerk-Sicherung`. Ablauf im Skill `.claude/skills/lernwerk-eingang/SKILL.md`.
- Ist das private Repository nicht in der Sitzung: die Dateien trotzdem bauen, ihm als Datei schicken und einmal sagen, dass er neue Sitzungen mit beiden Repositorys starten soll.
- Unterrichtsmaterial nie ins öffentliche Repository.
- Schickt er Termine (Klausuren, Arbeiten, Fotos von Terminlisten), trägt Claude sie ohne Rückfrage ein: Block mit `Termin: Fach | JJJJ-MM-TT | Themen` als `eingang/JJJJ-MM-TT-termine.txt` im privaten Repository. Fachname wie in `lehrplan.json`, nur bei echtem Zweifel nach dem Fach fragen. Zuordnung: M8 ist Werkstofftechnik oder „Ökologisch und nachhaltig handeln“ (in der App Ökonomie und Nachhaltigkeit), M6 ist Führung und Personal. Ohne privates Repository: Block fertig in die Antwort zum Einfügen. Termine nie ins öffentliche Repository.

## Veröffentlichen (vom Besitzer dauerhaft erlaubt)

- Direkt auf `main` pushen, kein Pull Request, nicht nachfragen.
- GitHub Pages baut aus `main`, Ordner `/`. Adresse: https://hendrikcharles48-dev.github.io/Lernwerk-Techniker/
- Ablauf: Tests, committen, auf den Arbeitszweig und auf `main` pushen (`git push origin HEAD:main`).
- Bei jeder Änderung an der App `VERSION` in `sw.js` und `js/app.js` erhöhen, beide gleich. Nur dann kommt das Update auf dem iPhone an. Reine Änderungen an Doku und Tests brauchen keine neue Version.
- Neue Dateien, die die App lädt, in die Liste `FILES` in `sw.js` aufnehmen.
- Hängt bei GitHub der Schritt „deploy“, liegt das an GitHub. Ein neuer Push oder „Re-run all jobs“ hilft.

## Rückgängig machen

- Jede Etappe ist ein eigener Commit. Eine einzelne Etappe nimmt `git revert <commit>` zurück, danach neue `VERSION` und pushen.
- Der Stand vor dem großen Optimierungsdurchgang (Version 1.25.2, Commit `24a96de`) liegt im Zweig `sicherung-vor-optimierung`. Diesen Zweig nicht löschen und nicht verändern.
- Alles zurück auf diesen Stand: `git revert --no-commit 24a96de..HEAD`, `VERSION` höher setzen als die letzte veröffentlichte, committen, pushen. Nie `main` hart zurücksetzen: Die App auf dem iPhone holt nur höhere Versionen.
- Die Lerndaten liegen nicht im Repository. Ein Zurücknehmen von Code ändert sie nicht. Neue Einträge im Speicher (siehe unten) stören alte Versionen nicht.
- Auf dem Gerät: unter Mehr, Datensicherung liegen Rückfall-Kopien.

## Tests vor jedem Push

Alle müssen durchlaufen:
- `node tests/parser.test.mjs` (Blockformat, Formel-Parser, Zahlenprüfung, Wiederholsystem)
- `node tests/abgleich.test.mjs` (Zusammenführen zwischen Geräten)
- `node tests/zeichnung.test.mjs` (eingefügte Zeichnungen, SVG-Bereinigung)
- `node tests/mathtext.test.mjs` (Formeln im Fließtext)
- `node tests/speicher.test.mjs` (Start, Einfügen, Karten, Runden, Sicherung laden, alte Sicherungen)
- `node tests/inhalte.test.mjs` (alle Inhaltsdateien, Formeln mathematisch, gleiche `VERSION`, alle Offline-Dateien vorhanden)

Die Oberfläche hat keinen eigenen Test im Repository. Vor dem Push im Browser prüfen: Seite lokal ausliefern (`python3 -m http.server`), mit Playwright öffnen, die geänderte Stelle durchklicken, auf Fehler in der Konsole achten. Schmal testen (393 mal 852), hell und dunkel.

## Aufbau der App

| Datei | Aufgabe |
|---|---|
| `index.html` | Hülle: fünf Bereiche (Heute, Fächer, Einfügen, Fehlerbuch, Mehr), Tab-Leiste |
| `js/app.js` | Start, Heute, Fächer, Einfügen, Fehlerbuch, Lernrunden zusammenstellen, Service Worker, `VERSION` |
| `js/extra.js` | Mehr: Termine, Erklär-Training, Lexikon, Formelsammlung, Suche, Lehrplan, Datensicherung, Im Unterricht |
| `js/probeklausur.js`, `js/hoerseite.js`, `js/noten.js` | Probeklausur, Seite Hörmodus, Noten (über `extra.js` weiter erreichbar) |
| `js/engine.js` | Themenseite, Lernweg, `runItem`, `runSession`, Sortierung, Lernzettel, Fotos |
| `js/uebungen.js` | alle Übungsarten (`runAufgabe`, `runUmstellen`, Karten, Erklären …) und `instantiate` |
| `js/schmierzettel.js` | Schmierzettel mit Taschenrechner |
| `js/aufgabe.js` | reine Helfer für „Erst der Weg“, genutzt von App und Fach-Trainern |
| `js/store.js` | Zentraler Zustand `S`, Lehrplan, Inhalte, Karten, Runden (`buildQueue`), Termine, Fehler, Sicherung als Datei |
| `js/db.js` | IndexedDB mit Rückfall auf Arbeitsspeicher, `prefs` für localStorage |
| `js/parser.js` | Lernwerk-Block lesen und schreiben, Themen zusammenführen, Vorlage für Claude |
| `js/formula.js` | Formel-Parser ohne eval, Darstellung mit Bruchstrich (`fml`, `mathText`), Umstellen prüfen mit Zahlenproben |
| `js/check.js` | Zahl mit Einheit prüfen, gezielte Hinweise |
| `js/srs.js` | Wiederholsystem, Lernplan, Serie. Reine Funktionen |
| `js/sicherung.js`, `js/abgleich.js` | Abgleich über das private GitHub-Repository. `abgleich.js` ist rein und getestet |
| `js/rueckfall.js` | Rückfall-Kopien in eigener Datenbank |
| `js/lernseiten.js` | Lernseiten: HTML-Artefakte aus dem Chat, abgeschottet im iframe (sandbox ohne allow-same-origin), localStorage nachgebildet und im Lernzettel gespeichert. Antworten der Seite (über `window.lernwerk.antwort` oder erkannt an den Klassen ok und bad der Antwortknöpfe) werden als Ereignis `art: 'seite'` verbucht, falsche kommen ins Fehlerbuch (`quelle: 'seite'`). Wiederholung der Seiten 1, 3, 7, 14, 30 Tage |
| `js/arbeitszettel.js` | Lernzettel zur Klassenarbeit aus den Inhalten der Themen, mit Häkchen „gelernt“ |
| `js/eingang.js` | Eingang (`eingang/` im privaten Repository) und `lernstand.md` für Claude |
| `js/mathedit.js` | Formel-Eingabe mit eigener Tastatur |
| `js/hoer.js`, `js/podcast.js`, `js/speech.js` | Hörmodus: Audiodateien, Folgen bauen, Systemstimme |
| `js/skizzen.js`, `js/svg.js`, `js/diagramm.js` | Skizzen, SVG-Bereinigung, Diagramme |
| `js/ui.js` | Seitenstapel, Sheets, Listen, Symbole, Wischen |
| `js/fachtrainer.js`, `trainer/` | Fünf Fach-Trainer aus den Inhalten und zwölf alte Trainer mit eigenem Code |
| `lernwerk-bridge.js`, `lernwerk-speicher.js` | Verbindung der Trainer zur App, Umzug alter Speichernamen |
| `lehrplan.json`, `inhalte/`, `audio/` | Fächer und Themen, eingebaute Inhalte, Podcast-Folgen |
| `tools/` | Audio und Skizzen erzeugen |

Eingebaute Inhalte und eingefügte Blöcke laufen durch denselben Parser und dieselbe Engine. Ein neues Thema kostet Inhalt, keinen Code.

## Datenmodell

**IndexedDB `lernwerk`, Version 1.** Die Version nicht erhöhen: Ein blockiertes Upgrade lässt die App im Arbeitsspeicher starten. Neue Daten in `kv` oder in einer eigenen Datenbank ablegen.

| Speicher | Inhalt |
|---|---|
| `kv` | Schlüssel und Wert, siehe unten |
| `content` | eingefügte Inhalte je Thema: `{ id: Themen-ID, topic, zeit, ersetzt? }` |
| `notes` | Lernzettel `{ id, tid, titel, text, zeit, geaendert }`. Lernseiten zusätzlich `{ html, fid, exId, zustand, quelle, runden, letzteRunde, quote }`, `text` ist dann eine Kurzfassung |
| `photos` | Fotos mit Blob, nur auf dem Gerät |
| `cards` | Lernstand je Übung `{ id, tid, art, stufe 0–6, richtig, hilfe, falsch, zuletzt, faellig, zeit }` |
| `errors` | Fehlerbuch `{ id, zeit, tid, fach, thema, aufgabe, eingabe, richtig, fehlerart, quelle, notiz, erledigt? }` |
| `events` | Ereignisse für Statistik und Stärke, höchstens 5000. Ältere als 60 Tage werden beim Start zu `kv tage` verdichtet (`verdichten` in `js/abgleich.js`), je Thema und Art bleiben die neuesten zwölf |
| `exams` | Klassenarbeiten und Noten `{ id, fachId, fach, datum, themen, themaIds, ausgeschlossen?, note?, prozent?, ergebnis?, notiz? }` |

**Kennung einer Übung** (`cards.id`): Buchstabe, Themen-ID, Hash des Inhalts. `k:` Karte, `b:` Begriff, `a:` Aufgabe, `u:` Umstellen, `w:` Auswahl, `r:` Reihenfolge, `v:` Verwechslung, `z:` Zuordnen, `c:` Fall (Schrittfragen), `e:` Erklären, `s:` Skizze, `t:Themen-ID` Trainer, `f:Fehler-ID` Fehlerkarte. Der Hash kommt aus dem Fragetext. Ändert sich der Text, beginnt die Übung neu. Diese Regel nicht ändern.

**`kv`-Schlüssel.** Abgeglichen: `lehrplan`, `aktuell`, `abgeschlossen`, `aktuellSeit`, `zustandZeit`, `freigabe`, `lernweg`, `planStart`, `planErledigt`, `planNachholen`, `notenschluessel`, `uebModus`, `kartenArt`, `umstellFrei`, `proben` (vereinigt), `zettelGelernt` (Häkchen im Lernzettel zur Arbeit), `eingang` (geholte Dateien mit Stand), `eingangOffen` (Blöcke aus dem Eingang, die auf die Vorschau warten), `auswertungAus` (Arbeiten ohne Note, nach denen nicht mehr gefragt wird), `tage` (Tageswerte verdichteter Ereignisse, je Tag der größere) und `ereignisseAb` (Stichtag, der spätere gilt), dazu `kvZeit` (Zeitstempel je Schlüssel) und `geloescht` (Löschmarken). Nur auf dem Gerät (`NUR_GERAET` in `abgleich.js`): `zuletzt`, `letzteSicherung`, `ersterStart`, `unterrichtVorgabe`, `freigabeStart`.

**localStorage**, immer mit Präfix `lernwerk:` (über `prefs`), weil Satzwerk unter derselben Adresse liegt. Alte Einträge ohne Präfix nie löschen. Wichtige Namen: `theme`, `lernzeit`, `startLayout`, `inbox` (Eingang der Trainer), `ghToken`, `ghRepo`, `ghVerbunden`, `ghSha`, `ghZuletzt`, `ghFehler`, `ghOffen`, `ghPause`, `speicherFehler`, `rueckfallVersion`, `hoer…`, `stimme…`. Der Zugangsschlüssel steht nur hier, nie in einer Sicherung.

**Datenbank `lernwerk-rueckfall`**: Rückfall-Kopien `{ id, zeit, grund, version, daten }`, die neuesten fünf.

### Datenmodell ändern

- Nur hinzufügen. Neue Felder und Schlüssel müssen fehlen dürfen: immer mit Vorgabe lesen (`kvGet('x', vorgabe)`, `t.liste || []`).
- Vorhandene Felder, Kennungen und Bedeutungen nicht umbenennen. Ist ein Umbau nötig, alte Daten beim Start automatisch übernehmen, mit Merker in `kv` (Muster: `freigabeStart`), und die alten Daten stehen lassen.
- Soll ein neuer Schlüssel nicht abgeglichen werden, in `NUR_GERAET` eintragen.
- Vor jedem Umbau einen Fall in `tests/speicher.test.mjs` ergänzen, der eine alte Sicherung lädt.
- Vor riskanten Schritten in der App `rueckfall.sichern(...)` aufrufen.

## Sicherung und Abgleich

- Privates Repository des Besitzers, Datei `lernwerk-sicherung.json`, direkt über die GitHub-Schnittstelle. Bleibt so (entschieden).
- `abgleichen()` in `js/sicherung.js`: holen, mit `zusammenfuehren()` mischen, hochladen. Nie blind überschreiben. Bei 409 oder 422 von vorn, höchstens dreimal.
- Zusammenführen: Einträge mit Kennung vereinigen, der neuere gewinnt. `kv` je Schlüssel nach `kvZeit`. Lehrplan Fach für Fach. Löschmarken verhindern, dass Gelöschtes zurückkommt. Inhalte desselben Themas werden zusammengelegt, außer eine Seite trägt `ersetzt`.
- Während einer Lerneinheit (offenes Sheet) wird nichts eingespielt.
- Fotos, Schlüssel, Darstellung und Startseite bleiben pro Gerät.
- Notfall: Stand von GitHub übernehmen (`laden`) oder Stand des Geräts nach GitHub (`ueberschreiben`). Nach dem Laden einer Rückfall-Kopie ruht der Abgleich (`ghPause`), bis der Besitzer entscheidet.
- Eine unlesbare Datei auf GitHub wird nie von selbst überschrieben.
- Nach jedem Abgleich: Ordner `eingang/` lesen (Lernseiten `.html` gleich speichern, Blöcke `.txt` und `.md` warten auf der Startseite), nichts im Repository löschen. `lernstand.md` höchstens alle sechs Stunden und nur bei Änderung schreiben.

## Lernprinzip (gilt für Inhalte und für jede neue Funktion)

1. Erst das Grundprinzip, dann die Aufgabe. Erst ein Bild aus der Welt des Nutzers (Fräse, Werkstatt, Krafttraining, Baseball), dann Fachbegriff, Merksatz, Bausteine, Schnellweg.
2. **Der Weg zählt, nicht das Rechnen.** Wie beim Arbeitsplan an der Fräse: erst die Reihenfolge der Schritte, dann rechnen. Der Nutzer wählt den nächsten Schritt selbst, die App zeigt nur, wo er abbiegt.
3. **Er rechnet, die App prüft.** Nicht vorrechnen, keine Ansagen wie „rechne jetzt X aus“. Tipp und Lösung bleiben zu, bis er sie öffnet. Hinweise nennen die Fehlerstelle, nicht das Ergebnis.
4. Aufgaben als reiner Aufgabentext. Gegeben und Gesucht sind eingeklappt.
5. **Freies Abrufen vor Wiedererkennen.** Karten werden aufgedeckt und selbst bewertet. Auswahlfragen nur mit glaubwürdigen falschen Antworten, und zu jeder falschen Antwort steht, warum sie falsch ist (wie in den Trainern aus dem Chat).
6. Rechenfächer (Mathematik, Elektrotechnik, Mechanik): Ansatz erkennen, Weg planen, durchgerechnetes Beispiel bei neuen Themen, dann frei rechnen, Zwillingsaufgabe. Lernfächer (Werkstofftechnik, Führung, Qualität, Ökonomie): aufdecken, erklären mit Kernpunkten, Skizze aus dem Kopf.
7. Verteilt wiederholen (1, 2, 4, 7, 14, 30 Tage), gemischt üben, vor Arbeiten vorziehen. Was nicht saß, kommt in derselben Runde noch einmal.
   **Am Tag der Arbeit muss alles sitzen, nicht nur ein Teil.** Vor einer Arbeit baut `arbeitsRunde` in `js/store.js` jede Runde aus allen Themen der Arbeit (alle Stufen), Rechnen nur im Anteil der offenen Rechenaufgaben, und sorgt dafür, dass jede Frage einmal drankommt. Nicht wieder auf feste Rechenquoten umstellen.
8. So nah am Unterricht wie möglich, nicht tiefer. Nichts erfinden, vor allem keine Rechenaufgaben. Werte des Lehrers und des Tabellenbuchs haben Vorrang, Abweichungen mit „Achtung“ markieren.
9. Kurz und einfach. Ein Konzept nach dem anderen. Wenig Lernzeit unterwegs: Alles muss in zwei bis zehn Minuten am Handy gehen.
10. **Erst lernen, dann prüfen.** Wie im Lernzettel zur Klausur: Thema lesen und abhaken, dann Fragen dazu, am Ende Mini-Prüfungen je Thema und gemischt, dazu Fehler-Training.

## Designregeln

- Modernes iOS: Systemschrift, gruppierte Listen, große Titel, Sheets von unten, Tab-Leiste. Farben und Abstände nur über die Variablen in `css/app.css` (`--bg`, `--bg2`, `--label`, `--accent`, `--r` und so weiter).
- Hell und dunkel müssen beide stimmen. Skizzen nutzen die Farbklassen der App.
- Bedienung mit dem Daumen: Wichtiges unten, Tippziele mindestens 44 Punkte, keine Bedienung nur über Wischen.
- Nichts verschieben, was der Nutzer gewohnt ist. Neue Bausteine der Startseite kommen über `START_TEILE` dazu und lassen sich abschalten.
- Keine Funktionen entfernen. Texte in der App: kurze ganze Sätze, „du“, keine Fachsprache der Programmierung.
- Formeln wie im Buch: echter Bruchstrich, Wurzel, Hochzahl (`fml` für Formeln, `rich` oder `mathText` für Text mit Formeln). Rechenwege zeilenweise: Formel, eingesetzte Werte, Ergebnis.
- Nutzertext nie ungeprüft als HTML einsetzen: `esc`, `rich`, `markdown` oder `bereinigen` (SVG) benutzen.

## Inhalte

- Neue Themen als Lernwerk-Block unter `inhalte/`, in `inhalte/index.json` und in `FILES` in `sw.js` eintragen. Format: `docs/BLOCKFORMAT.md`.
- Fach und Thema müssen zu `lehrplan.json` passen. Neue Themen dort eintragen und `version` erhöhen.
- Formeln im Text in einer Zeile schreiben, mit Leerzeichen um die Rechenzeichen und mit Klammern: `R = ρ · l / A`, `F_B = F · a / (l1 + l2)`. Die App zeigt daraus echte Brüche. Einheiten ohne Leerzeichen: `N/mm²`.
- Rechenzeichen, Prozent, Grad und Hochzahlen als Zeichen (·, /, +, −, =, %, °, ²), nicht als Wort. Der Test meldet Rechenwörter mit „ZEICHEN STATT WORT“. In Aufgaben mit Platzhalter `10^{m}` schreiben.
- Eingebaute Texte bleiben vorlesbar, weil daraus die Podcast-Folgen entstehen: ganze Sätze, keine Pfeile, keine Abkürzungen wie „z. B.“. Für eingefügte Blöcke des Nutzers ist das keine Pflicht mehr.
- Jede Formel bekommt eine Zeile „Aufbau:“. Jeder Rechenschritt wendet eine Formel an oder rechnet eine Einheit um.
- Jede Aufgabe in eingebauten Inhalten braucht Ansatz, Signal und Kontrolle. Die richtige Antwort darf nicht durch ihre Länge auffallen.
- Fakten sorgfältig prüfen. Bei Widersprüchen beide Angaben nennen und mit „Achtung“ markieren.
- **Keine Bezüge auf Material** (Wunsch des Besitzers): nicht „auf dem Arbeitsblatt“, „Blatt 20“, „AB20“, „aus der Übungsklausur“, „laut Mitschrift“ schreiben. Aufgaben, Werte und Beispiele vollständig übernehmen, aber für sich stehend formulieren. Abweichende Werte des Lehrers als „Achtung, im Unterricht …“ nennen.

## Hörmodus-Audio

- Ändern sich Anker, Prinzip, Begriffe, Formeln, Merksätze, Karten, Fehler oder Schnellwege eines eingebauten Themas, die Folgen neu erzeugen: `node tools/hoer/skript.mjs` und `python3 tools/hoer/erzeugen.py` (braucht `pip install piper-tts` und ffmpeg, baut nur geänderte Folgen). Der Inhalte-Test meldet veraltete Folgen als Hinweis. Aufgaben- und Umstellen-Zeilen ändern die Folgen nicht.
- Audio nur für eingebaute, öffentliche Inhalte. Lernzettel und eigene Inhalte nie als Audio ins Repository.
- Die Systemstimme des iPhones stoppt bei gesperrtem Bildschirm. Nur Audiodateien laufen weiter.

## Sparregeln (gelten immer)
- Große Dateien nie komplett lesen: erst `grep -n`, dann gezielt Zeilenbereiche. Dieselbe Datei nicht mehrfach lesen.
- Suche über viele Dateien an den Explore-Subagenten geben (läuft auf Haiku), nur das Ergebnis übernehmen.
- Test- und Build-Ausgaben gekürzt holen (`| tail -30`, nur Fehlerzeilen), nie komplette Logs.
- Plan höchstens 15 Zeilen, ohne fertigen Code; dann auf OK warten.
- Nach Abschluss nur das Wichtigste melden, keinen Diff wiederholen.
- Wenn eine Aufgabe Routine ist (Texte, Inhalte, kleine UI-Änderung), vorschlagen, sie mit Sonnet statt Opus zu machen.
- Neues Thema = neue Sitzung empfehlen statt im vollen Kontext weiterzuarbeiten.
