---
name: app-interview
description: Fragenrunde für eine neue App oder große Funktion. Nur auf Aufruf mit /app-interview <Idee>.
disable-model-invocation: true
---

# App-Interview

Ziel: mit EINER Runde Fragen alles klären, was für eine richtig gute App nötig ist. Danach nicht mehr nachfragen.

1. **Kurz vorarbeiten (höchstens 3 Suchbefehle):** `grep -n` in CLAUDE.md und den betroffenen Dateien. Fragen streichen, die Code oder CLAUDE.md schon beantworten.
2. **Alle Fragen in EINER Nachricht**, nummeriert, in Gruppen:
   - Zweck und Nutzer (wofür, wer, wie oft, welches Problem heute)
   - Bildschirme und Ablauf (Startseite, wichtigste 3 Handgriffe, was soll nie nötig sein)
   - Daten (was speichern, wohin, Sicherung, Abgleich mit anderen Geräten, Datenschutz im öffentlichen Repo)
   - Bedienung auf dem iPhone (Einhand, Offline, Benachrichtigungen, Widgets)
   - Aussehen (Stil, Farben, hell/dunkel, Vorbild-Apps)
   - Sonderfälle (leere Zustände, Fehler, sehr viele Daten)
   - Grenzen (was ausdrücklich NICHT rein soll, Reihenfolge nach Wichtigkeit)
3. **Zu jeder Frage ein Vorschlag als Standardantwort** („Vorschlag: …“). Er kann mit „passt“ oder „alle Vorschläge, außer 4 und 9“ antworten, auch per Sprache.
4. Zwischen 10 und 25 Fragen, keine Doppelungen, keine Fragen, deren Antwort nichts ändert.
5. **Nach seiner Antwort:** Plan in höchstens 15 Zeilen (Bildschirme, Daten, Reihenfolge der Etappen), dann auf OK warten. Keine weitere Fragerunde; offene Punkte selbst mit dem Vorschlag entscheiden und im Plan markieren.
