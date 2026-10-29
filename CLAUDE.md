# Lernwerk Techniker: Regeln für Claude

## Veröffentlichen (vom Besitzer ausdrücklich erlaubt)
- Der Besitzer hat dauerhaft erlaubt, direkt auf `main` zu pushen. Kein Pull Request nötig, nicht nachfragen.
- GitHub Pages baut automatisch aus `main`, Ordner `/` (root). Adresse: https://hendrikcharles48-dev.github.io/Lernwerk-Techniker/
- Ablauf bei jeder Änderung: Tests laufen lassen, committen, auf den Arbeitszweig und auf `main` pushen (`git push origin HEAD:main`).
- Bei jeder Änderung `VERSION` in `sw.js` und `js/app.js` erhöhen, beide gleich. Nur dann kommt das Update auf dem iPhone an. Die App lädt die neue Version beim nächsten Öffnen von selbst.

## Hörmodus-Audio
- Nach Änderungen an Inhalten die Podcast-Folgen neu erzeugen: `node tools/hoer/skript.mjs` und `python3 tools/hoer/erzeugen.py` (braucht `pip install piper-tts` und ffmpeg, baut nur geänderte Folgen). Der Inhalte-Test meldet veraltete Folgen als Hinweis.
- Audio nur für eingebaute, öffentliche Inhalte. Lernzettel und eigene Inhalte nie als Audio ins Repository.

## Tests vor jedem Push
- `node tests/parser.test.mjs`
- `node tests/inhalte.test.mjs` (prüft auch, dass beide VERSION-Werte gleich sind und alle Offline-Dateien existieren)
- Neue Dateien in die Liste `FILES` in `sw.js` aufnehmen.

## Nutzer
- Schreibt meist vom iPhone. Antworten auf Deutsch, einfache Sätze, klare Ansagen, was er selbst tun muss.
- Nichts Persönliches ins Repository, das Repository ist öffentlich.

## Inhalte
- Neue Themen als Lernwerk-Block unter `inhalte/` (Format in README.md), in `inhalte/index.json` eintragen.
- Erst das Prinzip mit einem Bild aus seiner Welt (Fräse, Werkstatt, Krafttraining, Baseball), dann Fachbegriff, Merksatz, Bausteine, Schnellweg.
- Texte vorlesbar: ganze Sätze, keine Pfeile, keine Abkürzungen wie „z. B.“.
- Rechenzeichen, Prozent, Grad und Hochzahlen als Zeichen schreiben (·, /, +, −, =, %, °, ²), nicht als Wort. Die Vorlesefunktion spricht sie aus. Bei Punkt vor Strich Klammern setzen.
- Das gilt überall, auch für Hochzahlen (10³, 2ˣ, xⁿ⁻¹), Vorzeichen (−5, +24 V), Wurzeln (√(a + b)) und Gleichheit (=). In Aufgaben mit Platzhalter als 10^{m} schreiben, die App macht daraus eine Hochzahl. Der Test meldet Rechenwörter mit „ZEICHEN STATT WORT“.
- Jede Formel bekommt darunter eine Zeile „Aufbau:“, die kurz erklärt, warum sie so zusammengesetzt ist.
- Jeder Rechenschritt wendet eine Formel an oder rechnet eine Einheit um, keine bloßen Rechen-Zwischenstücke.
- Fakten sorgfältig prüfen. Bei Widersprüchen beide Angaben nennen und mit „Achtung“ markieren.
