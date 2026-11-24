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
| `Unterricht` | `Fach \| Thema; Thema` | Themen im Unterricht anwählen. Themen mit Semikolon trennen. Neue Themen aus demselben Block gehen auch. Die Vorschau zeigt jedes Thema mit Schalter. |
| `Abgeschlossen` | `Fach \| Thema; Thema` | Themen als abgeschlossen abhaken. Gleiche Schreibweise. |
| `Stufe` | `1`, `2` oder `3` | Gilt für alle folgenden Zeilen bis zur nächsten Stufe-Zeile. 1 Verstehen, 2 Abläufe, 3 Rechnen. Siehe „Aufgabenarten nach Lernart“. |
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
| `Falsch` | `falsche Antwort \| warum sie falsch ist` | direkt unter `Auswahl`, `Schrittfrage`, `Ansatz`, `Warum` oder `Kontrolle`. Wer diese Antwort wählt, liest genau diese Erklärung |
| `Fall` | `Titel \| Ausgangslage` | Weg planen wie im Statik-Trainer. Darunter `Gleichung: Name \| Gleichung` (nur Anzeige) und `Schrittfrage: Frage \| richtig \| falsch; falsch \| Erklärung`, jede mit `Falsch`-Zeilen. Kennung `c:` |

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

## Aufgabenarten nach Lernart (neues Format)

Jede Aufgabe gehört zu einer Stufe. Der Block legt Art und Stufe fest, die App entscheidet nichts selbst.
Der Besitzer schaltet die Stufen eines Themas selbst frei (Knopf „Hatten wir“ am Thema). Ein Block mit `Stufe:`-Zeilen oder mit den neuen Arten beginnt bei Stufe 1.

| Stufe | Name | Arten |
|---|---|---|
| 1 | Verstehen | `Karte`, `Begriff`, `Auswahl`, `Luecke`, `Anker: Bild \| Fachbegriff` |
| 2 | Abläufe | `Reihenfolge`, `Warumfrage`, `Fallbeispiel` |
| 3 | Rechnen | `Rechnen` mit `Schritt`, `Variable`, `Ergebnis`, `Bereich` |

Ohne `Stufe:`-Zeile gilt für die neuen Arten die Stufe aus der Tabelle. Alte Blöcke ohne `Stufe:`-Zeile bleiben wie bisher ganz frei.

| Schlüssel | Aufbau | In der App |
|---|---|---|
| `Anker` | `Bild aus deiner Welt \| Fachbegriff` | Karte, abwechselnd Bild zu Begriff und Begriff zu Bild. Ohne Strich bleibt es ein reines Bild. Kennung `n:` |
| `Luecke` | `Satz mit [Wort] und [Wort] \| falsch; falsch \| Erklärung` | Wörter in eckigen Klammern sind die Lücken, höchstens drei. Mit falschen Wörtern: abwechselnd Wörter antippen und selbst ergänzen. Die falsche Lücke wird rot markiert. Kennung `l:` |
| `Warumfrage` | `Frage \| Antwort \| falsch; falsch \| Erklärung` | Abwechselnd erst selbst überlegen und aufdecken, dann als Auswahl. Ohne falsche Antworten immer aufdecken. Kennung `y:` |
| `Fallbeispiel` | `Lage \| Frage \| Antwort \| falsch; falsch \| Erklärung` | Wie Warumfrage, mit kurzer Lage aus Werkstatt, Training oder Alltag. Kennung `x:` |
| `Falsch` | `falsche Antwort \| warum sie falsch ist` | Direkt unter `Luecke`, `Warumfrage`, `Fallbeispiel` (wie unter `Auswahl`) |
| `Rechnen` | Aufgabentext mit Platzhaltern `{F}` | Rechenweg. Erst die Bausteine ordnen, dann im Kopf oder auf Papier rechnen, dann aufdecken. Keine Eingabe des Ergebnisses. Kennung `g:` |
| `Variable` | `Name \| von \| bis \| Schrittweite \| Einheit` | Unter `Rechnen`. Die App würfelt jedes Mal neue Werte. Die Einheit steht hinter dem Wert im Text |
| `Schritt` | `was \| Gleichung \| Einheit \| Sinn` | Unter `Rechnen`, ein Baustein. Gleichung mit Namen links (`F_B = F * a / l`), rechts nur Variablen und Namen aus früheren Schritten. Ohne Gleichung (`Schritt: Freikörperbild zeichnen \| \| \| Sinn`) ist es ein Planungsschritt, der an seinem Platz bleibt. Zwei bis sieben Schritte |
| `Ergebnis` | `Name \| Einheit` | Unter `Rechnen`, optional. Ohne Ergebnis zählt der letzte Schritt |
| `Rechnung` | Formel aus Variablen | Unter `Rechnen`, optional. Rechnet das Endergebnis direkt aus |
| `Bereich` | `kleinstes \| größtes Ergebnis` | Unter `Rechnen`, optional. Die App würfelt neu, bis das Ergebnis darin liegt |
| `Tabelle` | `Titel \| Spalte; Spalte; Spalte` | Kompakte Tabelle. Darunter je Zeile `Zeile: Zelle; Zelle; Zelle`. `[Text]` in einer Zelle wird ein kleines graues Label |
| `Zeichnung` | `Titel \| <svg …>…</svg>` | Wie bisher. Steht sie direkt unter einer neuen Aufgabe, zeigt die Aufgabe sie oben an |
| `Grundprinzip` | `Anker \| Fachbegriff \| Merksatz` | Unter einer neuen Aufgabe gilt es für diese, sonst für das Thema. Nach einem Fehler zum Aufklappen. Ohne Grundprinzip nimmt die App den ersten Anker und Merksatz des Themas |

Zur Aufgabe gehören die Zeilen direkt darunter: `Falsch`, `Tabelle` mit `Zeile`, `Zeichnung`, `Grundprinzip`, bei `Rechnen` dazu `Variable`, `Schritt`, `Ergebnis`, `Rechnung`, `Bereich`, `Gegeben`, `Gesucht`, `Tipp`. Jede andere Zeile beendet die Aufgabe.

Wie die App rechnet:
- Jede Runde würfelt sie die Variablen neu, rechnet jeden Schritt der Reihe nach selbst aus und zeigt den Weg als Schritt-Grafik: Formel mit Bruchstrich, eingesetzte Werte, Ergebnis mit Einheit, dazu der Sinn des Schritts in einem Satz.
- Beim Ordnen gilt jede Reihenfolge, in der ein Schritt erst nach den Schritten kommt, deren Ergebnis er braucht. Gibt es keine solchen Abhängigkeiten, gilt die Reihenfolge des Blocks.
- Die Vorschau meldet einen Fehler, wenn sich der Weg mit den gewürfelten Zahlen nicht ausrechnen lässt.

Nach einem Fehler markiert die App die Fehlerstelle (Lücke, Antwort, Baustein), zeigt das Grundprinzip zum Aufklappen und schreibt den Fehler ins Fehlerbuch. Beim nächsten Mal kommt die Aufgabe in der anderen Form (Auswahl oder selbst überlegen) oder mit neuen Zahlen.

### Beispiel mit je einer Aufgabe pro Art

```
=== LERNWERK ===
Fach: Technische Mechanik
Thema: Lagerkräfte
Stufe: 1
Anker: Ein Rollwagen in der Werkstatt lässt sich längs schieben, aber nicht in den Boden drücken. | Loslager
Begriff: Festlager | Lager, das Kräfte in zwei Richtungen aufnimmt, aber kein Moment.
Merksatz: Der Drehpunkt kommt in ein Lager, dann fällt dort jede Unbekannte heraus.
Grundprinzip: Wippe auf dem Spielplatz: Wer weiter außen sitzt, drückt stärker. | Momentengleichgewicht | Die Summe aller Momente um einen Punkt ist null.
Karte: Wie viele Kräfte nimmt ein Loslager auf? | Eine Kraft, senkrecht zur Rollbahn.
Luecke: Ein Festlager nimmt [zwei] Kräfte auf, ein Loslager nur [eine]. | drei; keine | Zwei plus eins ergibt drei Gleichungen für drei Unbekannte.
Falsch: drei | Drei Lagerreaktionen hat die feste Einspannung: zwei Kräfte und ein Moment.
Falsch: keine | Ein Lager ohne Kraft wäre kein Lager.
Auswahl: Welches Lager hat die Wertigkeit 1? | Loslager | Festlager; Feste Einspannung; Gelenk mit zwei Kräften | Das Loslager kann nur senkrecht zur Bahn abstützen.
Falsch: Festlager | Das Festlager hat die Wertigkeit 2.
Tabelle: Lagerarten | Lager; Wertigkeit; Lagerreaktionen
Zeile: [Loslager] B; 1; F_B senkrecht zur Bahn
Zeile: [Festlager] A; 2; F_Ax und F_Ay
Zeile: [Einspannung] E; 3; F_x, F_y und M
Stufe: 2
Reihenfolge: Lagerkräfte bestimmen | Freikörperbild zeichnen; Drehpunkt in ein Lager legen; Momentengleichung aufstellen; Kräftesumme aufstellen
Warumfrage: Warum legst du den Drehpunkt für die Momentengleichung in ein Lager? | Dort haben die unbekannten Lagerkräfte keinen Hebelarm und fallen heraus. | Dort wirkt das größte Moment.; Dort wird die äußere Kraft null. | Mit nur einer Unbekannten löst du die Gleichung sofort.
Falsch: Dort wirkt das größte Moment. | Wo das Moment am größten ist, spielt für die Wahl keine Rolle.
Falsch: Dort wird die äußere Kraft null. | Die äußere Kraft bleibt gleich, nur ihr Hebelarm ändert sich.
Fallbeispiel: Du spannst ein langes Werkstück an der Fräse nur an einem Ende im Schraubstock ein. Am freien Ende drückt der Fräser von oben. | Welche Lagerung liegt vor? | Feste Einspannung | Festlager und Loslager; Nur ein Loslager | Der Schraubstock hält Kräfte in beide Richtungen und dazu ein Moment.
Falsch: Festlager und Loslager | Dafür bräuchte das Werkstück an beiden Enden eine Auflage.
Stufe: 3
Rechnen: Ein Balken der Länge {l} liegt links auf einem Festlager A und rechts auf einem Loslager B. Im Abstand {a} von A drückt die Kraft {F} senkrecht nach unten. Wie groß ist die Lagerkraft in A?
Variable: F | 2000 | 8000 | 500 | N
Variable: a | 0,5 | 2,5 | 0,5 | m
Variable: l | 3 | 4 | 0,5 | m
Schritt: Freikörperbild zeichnen und Lagerkräfte eintragen | | | Ohne Bild weißt du nicht, welche Kräfte unbekannt sind.
Schritt: Momente um A: nach F_B umstellen | F_B = F * a / l | N | Im Drehpunkt A fällt F_A heraus, es bleibt nur F_B.
Schritt: Kräfte senkrecht: nach F_A umstellen | F_A = F - F_B | N | Mit F_B bekannt bleibt in der Kräftesumme nur F_A.
Ergebnis: F_A | N
Bereich: 100 | 8000
Zeichnung: Balken auf zwei Lagern | <svg viewBox="0 0 300 120">…</svg>
Grundprinzip: Wippe auf dem Spielplatz | Momentengleichgewicht um A | Summe der Momente um A ist null: F_B · l = F · a.
Inhalt: 1 Karte; 1 Lücke; 1 Auswahl; 1 Reihenfolge; 1 Warum; 1 Fallbeispiel; 1 Rechenweg; 1 Tabelle
=== ENDE ===
```

Der vollständige Block mit fertigem SVG liegt als Test in `tests/aufgabenarten-block.txt`.

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

## Lernseiten (kein Block)

Eine ganze HTML-Seite, wie ein Artefakt aus dem Chat, ist kein Lernwerk-Block. Die App speichert sie als Lernseite und zeigt sie unverändert an.
Am Anfang darf ein Kommentar die Zuordnung angeben: `<!-- lernwerk fach="Werkstofftechnik" thema="Gusseisen" arbeit="JJJJ-MM-TT" titel="…" -->`.
Die Seite läuft abgeschottet: kein Zugriff auf die App, `localStorage` wird nachgebildet und gespeichert, `window.claude` gibt es nicht. Externe Schriften und Links brauchen Netz.

Antworten an die App melden: `window.lernwerk.antwort({ frage, gewaehlt, richtig, ok, thema, erklaerung })`. Dann zählt die Antwort für Stärke und Serie, und eine falsche kommt ins Fehlerbuch. Ohne diesen Aufruf erkennt die App richtig und falsch an den Klassen `ok` (oder `good`, `right`, `correct`, `richtig`) und `bad` (oder `no`, `wrong`, `falsch`) an Antwortknöpfen, die Frage am nächsten Element mit `.qq`, `.q`, `.frage`, `.step-q` oder `.question`.

## Beispiel: Fall mit Schrittfragen

```
Fall: Balken mit Fest- und Loslager | Gegeben: F, α, l, a. Gesucht: F_Ay
Gleichung: I | 0 = F_Ax − F · cos(α)
Gleichung: II | 0 = F_Ay + F_B − F · sin(α)
Gleichung: III, Moment um A | 0 = F_B · l − F · sin(α) · a
Schrittfrage: In welcher Gleichung steht F_Ay? | Gleichung II | Gleichung I; Gleichung III | Nur in II kommt F_Ay vor.
Falsch: Gleichung I | In I steht nur F_Ax, nicht F_Ay.
Falsch: Gleichung III | Der Drehpunkt liegt in A, deshalb ist F_Ay dort rausgefallen.
```
