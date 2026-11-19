---
name: webapp-quality
description: Qualitätscheck einer Web-App vor dem Veröffentlichen – iPhone-Darstellung, Bedienbarkeit, Fehler, Sicherheit, Offline/PWA. Aufruf mit /webapp-quality <app-ordner>.
disable-model-invocation: true
context: fork
agent: general-purpose
background: false
argument-hint: <app-ordner, z. B. kochwerk oder .>
---

# Web-App-Qualitätscheck

App-Ordner: $ARGUMENTS (leer = Repo-Wurzel). Erst automatisch messen, dann gezielt lesen. Nichts ändern – nur berichten.

## 1. Automatisch (Skript)
`node .claude/skills/webapp-quality/check.mjs <ordner>` ausführen (Ausgabe kurz halten). Gibt es `tools/pruefen/browser.mjs`, zusätzlich dieses laufen lassen. Fehlt Playwright: `npm i -g playwright` und `npx playwright install chromium`; geht das nicht (Netzwerk gesperrt), sagen und nur Abschnitte 2–4 per grep prüfen.
Prüft mit Playwright bei 393×852 und 375×667, Touch an, Service Worker aus:
- Konsolen- und Seitenfehler
- Elemente, die sich überschneiden oder abgeschnitten sind
- Tippflächen kleiner als 44×44 px
- waagrechtes Scrollen
- Eingabefelder unter 16 px Schrift (iPhone zoomt sonst)
- Screenshots je Hauptbereich (nur ansehen, wenn ein Befund es nötig macht)

## 2. PWA und Daten (grep, kein Volltext)
- Manifest: Name, `display: standalone`, Icons 180/192/512, `apple-touch-icon`, `viewport-fit=cover` und `env(safe-area-inset-*)`
- Service-Worker-Cache-Version erhöht, wenn Dateien geändert wurden
- Offline neu laden funktioniert
- Speicher-Schlüssel mit App-Präfix, kein `localStorage.clear()`, Export/Import vorhanden

## 3. Sicherheit (grep, dann gezielt lesen)
- `innerHTML`, `insertAdjacentHTML`, `eval`, `new Function` mit Daten aus Importen, Blöcken oder Eingaben
- Schlüssel/Tokens im Code (`ghp_`, `github_pat_`, `sk-`), externe Skripte ohne Not
- Öffentliches Repo: keine persönlichen Gesundheitsdaten in Dateien
- Für den Diff des Branches zusätzlich `/security-review` empfehlen

## 4. Design
Gegen die Designregeln aus CLAUDE.md und `references/web-interface-guidelines.md` (nur die Abschnitte zu Bedienung, Formularen, Barrierefreiheit): iOS-Look, nicht zu bunt, Kontrast im dunklen Modus, Bedienung mit einer Hand, `prefers-reduced-motion`.

## 5. Bericht
Ampel je Bereich (Darstellung, Bedienung, Fehler, PWA/Daten, Sicherheit, Design). Darunter höchstens 10 Befunde, wichtigste zuerst: Ort, Problem, Fix-Vorschlag in einem Satz. Kein Code. Am Ende fragen, welche Befunde behoben werden sollen.
