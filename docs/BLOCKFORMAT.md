# Das Lernwerk-Block-Format

Ein Block ist reiner Text. Er kommt aus dem Chat über „Einfügen“ in die App oder liegt als Datei unter `inhalte/`.
Gelesen wird er von `parseBlocks()` in `js/parser.js`, zurückgeschrieben von `exportBlock()`. Beide müssen zusammenpassen
(Rundreise-Test in `tests/parser.test.mjs`).

## Grundregeln

- Ein Block beginnt mit `=== LERNWERK ===` und endet mit `=== ENDE ===`. Mehrere Blöcke in einem Text sind erlaubt.
- Jede Zeile beginnt mit einem Schlüssel und einem Doppelpunkt. Schlüssel dürfen mehrfach vorkommen.
- Groß- und Kleinschreibung der Schlüssel ist egal. Markdown-Reste vor dem Schlüssel (`**`, `-`, `1.`, `>`, `#`) werden ignoriert.
- Zeilen ohne Schlüssel gehören zum Feld davor. So sind mehrzeilige Texte möglich.
- Teile einer Zeile trennt ein senkrechter Strich `|`, Listen innerhalb eines Teils trennt ein Semikolon `;`.
- Unbekannte Schlüssel bleiben als Notiz erhalten. Die Vorschau zeigt einen Hinweis.
- Ohne Markierungen beginnt ein Block bei der ersten Zeile `Fach:` oder `Thema:`.
- Eine neue Zeile `Thema:` im selben Block beginnt ein neues Thema im selben Fach.

## Kopf

| Schlüssel | Aufbau | Bedeutung |
|---|---|---|
| `Fach` | Name | Muss zum Fachnamen der App passen. Ähnliche Namen werden erkannt (Werkstoffkunde, Mechanik, BWL). |
| `Thema` | Name | Vorhandenes Thema wird ergänzt, sonst entsteht ein neues. |
| `Modul` | `M2` | optional |
| `Termin` | `Fach \| JJJJ-MM-TT \| Themen` | Klassenarbeit. Auch `TT.MM.JJJJ`. Ergänzt die Themen einer vorhandenen Arbeit. |
| `Stufe` | `1`, `2` oder `3` | Gilt für alle folgenden Zeilen bis zur nächsten Stufe-Zeile. 1 Grundlagen, 2 Zusammenhänge, 3 Anwenden. |
| `Inhalt` | `6 Karten; 2 Aufgaben` | Prüfzeile. Die Vorschau meldet, wenn weniger angekommen ist. |
| `Quelle` | Text | Herkunft |

## Verstehen

| Schlüssel | Aufbau |
|---|---|
| `Anker` (auch `Bild`) | Bild aus der Welt des Nutzers |
| `Begriff` | `Fachbegriff \| Erklärung in einem Satz` |
| `Merksatz` | Text |
| `Prinzip` | Erklärung, mehrere Zeilen und Absätze erlaubt, einfaches Markdown |
| `Baustein` | ein Lösungsbaustein pro Zeile |
| `Schnellweg` | kürzerer Prüfungsweg mit Begründung |
| `Fehler` | `typischer Fehler \| worauf achten` |
| `Formel` | `Name \| Formel \| Umstellung; Umstellung` |
| `Aufbau` | direkt unter einer Formel: warum sie so aussieht |
| `Zeichnung` | `Titel \| <svg viewBox="0 0 300 200">…</svg>` |
| `Podcast` | `Lena \| Text` oder `Tom \| Text`, eigenes Skript für den Hörmodus |

Aus jeder Umstellung einer Formel macht die App von selbst eine Umstell-Übung.

## Abfragen

| Schlüssel | Aufbau | In der App |
|---|---|---|
| `Karte` | `Frage \| Antwort` | Aufdecken und selbst bewerten, auf Wunsch als Auswahl |
| `Auswahl` | `Frage \| richtig \| falsch; falsch; falsch \| Erklärung` | Auswahlfrage. Erklärung optional |
| `Verwechslung` | `Begriff A \| Begriff B \| Unterschied` | abwechselnd Unterschied nennen oder Aussage zuordnen |
| `Zuordnen` | `Titel \| Begriff = Bedeutung; Begriff = Bedeutung` | mindestens zwei Paare |
| `Reihenfolge` | `Titel \| Schritt 1; Schritt 2; Schritt 3` | in die richtige Reihenfolge bringen |
| `Erklären` | `Aufgabe \| Kernpunkt; Kernpunkt` | aus dem Kopf erklären, Kernpunkte abhaken. In Runden und in der Probeklausur |
| `Skizze` | `Aufgabe \| Kernpunkt; Kernpunkt` | auf Papier zeichnen, Kernpunkte abhaken |

Wird eine Karte als Auswahl gezeigt, kommen die falschen Antworten aus anderen Karten desselben Themas.
Deshalb sollen die Antworten eines Themas von derselben Art und ähnlich lang sein, mindestens vier verschiedene.

## Rechnen

Eine Aufgabe beginnt mit `Aufgabe:`. Die folgenden Zeilen gehören dazu, bis die nächste Aufgabe oder ein anderer Abschnitt beginnt.

| Schlüssel | Aufbau | Bedeutung |
|---|---|---|
| `Aufgabe` | Text mit Platzhaltern wie `{F}` | reiner Aufgabentext |
| `Gegeben`, `Gesucht` | Text | in der App eingeklappt |
| `Ansatz` | `richtig \| falsch; falsch; falsch` | Frage „Welcher Ansatz passt?“ vor dem Rechnen |
| `Signal` | Text | woran man den Ansatz in der Aufgabe erkennt |
| `Warum` | `richtig \| falsch; falsch` | kurze Begründung, optional |
| `Schritt` | `was \| Ergebnis \| Einheit \| Tipp` | Ergebnis ist eine Zahl, eine Rechnung mit den Variablen (`F * a / l`) oder eine Gleichung (`Q = C · U`) |
| `Ergebnis` | `Zahl \| Einheit` | Endergebnis, wenn es nicht der letzte Schritt ist |
| `Variable` | `Name \| von \| bis \| Schrittweite` | Zufallswerte |
| `Rechnung` | Formel mit den Variablennamen | Die App rechnet die Lösung selbst aus |
| `Kontrolle` | `Frage \| richtig \| falsch; falsch` | Plausibilität am Ende |
| `Tipp` | Text | bleibt zu, bis er geöffnet wird |
| `Umstellen` | `Formel \| nach \| Lösung` | Umstell-Aufgabe |
| `Umformung` | `Operation \| Gleichung danach \| falsche Operation; falsche Operation` | geführte Schritte zu `Umstellen`, optional. Ohne Umformung wird frei umgestellt |

Was die App aus einer Aufgabe macht:
- Ab drei Schritten mit Text fragt sie zuerst nach der Reihenfolge („Erst der Weg“). Schritte, deren Rechnung die Rechnung eines anderen Schritts enthält, hängen voneinander ab. Die anderen dürfen tauschen.
- Mit `Variable` und `Rechnung` gibt es bei jedem Üben neue Zahlen, eine Zwillingsaufgabe und bei neuen Themen ein durchgerechnetes Beispiel.
- Der `was`-Text eines Schritts sagt, was der Schritt bewirkt und welche Formel er nutzt, zum Beispiel „Momentengleichung nach F_B umstellen: F_B = F · a / l“.

## Schreibweise von Formeln

- Der Formel-Parser kann `+ − · / ^ ² ³`, Klammern, `√` und `sqrt`, `sin cos tan` in Grad, `asin acos atan`, `ln`, `lg`, `π`, `e` und implizites Mal (`2πd`).
- Indizes mit Unterstrich: `F_G`, `R_ges`. `R1` wird als R mit Index 1 gezeigt.
- Dezimalkomma oder Punkt. In `Schritt`, `Rechnung` und `Variable` den Punkt oder das Komma, aber `*` oder `·` für Mal.
- Im Fließtext (Prinzip, Karten, Tipps, Aufgabentext) zeigt die App ein Formelstück mit echtem Bruchstrich, wenn es einen Schrägstrich **mit Leerzeichen**, eine Wurzel oder ein `^` enthält: `R = ρ · l / A`. Zähler und Nenner mit Klammern zusammenhalten: `F · a / (l1 + l2)`.
- Einheiten ohne Leerzeichen schreiben, dann bleiben sie Text: `N/mm²`, `m/s`, `1/min`.
- Der Buchstabe `e` allein ist die Eulersche Zahl. Nicht als Variablenname nehmen.
- In Aufgaben mit Platzhalter Hochzahlen als `10^{m}` schreiben.

## Zusammenführen und Ersetzen

- Beim Einfügen in ein vorhandenes Thema werden doppelte Einträge weggelassen. Doppelt heißt: gleiche Frage, gleicher Begriff, gleiche Formel, gleicher Aufgabentext, gleicher Titel.
- Eine gleichnamige Zeichnung ersetzt die alte.
- Der Schalter „Bisherige Inhalte ersetzen“ in der Vorschau löst die früher eingefügten Inhalte des Themas ab, auch auf anderen Geräten. Zeichnungen bleiben, wenn der neue Block keine eigenen hat.
- Der Lernstand hängt an der Kennung einer Übung, die aus dem Fragetext entsteht. Wer den Text einer Frage ändert, beginnt diese Frage neu.

## Änderungen am Format

Neue Schlüssel in `KEYS`, `emptyTopic`, `LISTS`, `KEYFN`, `summary`, `exportBlock` und `TEMPLATE` in `js/parser.js` eintragen, in `itemsOf` in `js/store.js`, wenn daraus Übungen werden, und hier beschreiben. Alte Blöcke müssen weiter gelesen werden: Neue Listen dürfen in gespeicherten Themen fehlen. Dazu einen Fall in `tests/parser.test.mjs` und in `tests/speicher.test.mjs`.
