# Web Interface Guidelines (Auszug für Vanilla-JS-PWAs)

Quelle: vercel-labs/web-interface-guidelines (command.md, Stand 05.10.2026), MIT-Lizenz, Copyright (c) 2025 Vercel Labs.
Gekürzt auf das, was für iPhone-Web-Apps ohne Framework gilt. React-/Next.js-Regeln bewusst weggelassen.

## Barrierefreiheit
- Nur-Symbol-Buttons brauchen `aria-label`; Zierbilder `alt=""`, Zier-Icons `aria-hidden="true"`
- Formularfelder brauchen `<label>` oder `aria-label`
- `<button>` für Aktionen, `<a>` für Navigation – kein `<div onclick>`
- Dynamische Meldungen (Toasts, Fehler): `aria-live="polite"`
- Überschriften hierarchisch (`h1`–`h6`)

## Fokus
- Sichtbarer Fokus mit `:focus-visible`; nie `outline: none` ohne Ersatz

## Formulare
- Richtiger `type` und `inputmode` (`number`, `tel`, `email`); `autocomplete` passend
- Einfügen nie blockieren
- Fehler direkt am Feld; Absenden-Button bleibt aktiv bis zum Start der Anfrage
- Vor Verlassen mit ungespeicherten Änderungen warnen
- Eingabefelder mindestens 16 px Schrift (sonst zoomt iOS)

## Animation
- `prefers-reduced-motion` beachten
- Nur `transform` und `opacity` animieren; nie `transition: all`
- Animationen unterbrechbar

## Text und Inhalte
- `…` statt `...`; Ladezustände enden mit `…`
- `font-variant-numeric: tabular-nums` bei Zahlenspalten
- Lange Texte brechen/kürzen (`min-width: 0` bei Flex-Kindern); Leerzustände sinnvoll anzeigen
- Zahlen/Datum mit `Intl.NumberFormat` / `Intl.DateTimeFormat`
- Fehlermeldungen nennen den nächsten Schritt; konkrete Button-Beschriftungen („Plan speichern“, nicht „Weiter“)

## Bilder und Leistung
- `<img>` mit `width`/`height`; unterhalb des Sichtbereichs `loading="lazy"`
- Listen über 50 Einträge: `content-visibility: auto` oder virtualisieren
- Layout-Messungen (`getBoundingClientRect`, `offsetHeight`) nicht in Schleifen mit Schreibzugriffen mischen

## Touch und Navigation
- `touch-action: manipulation`; `-webkit-tap-highlight-color` bewusst setzen
- `overscroll-behavior: contain` in Overlays/Sheets
- Gesten (Wischen, Ziehen) brauchen Tipp-Alternative
- Zerstörende Aktionen mit Rückfrage oder Rückgängig
- `autofocus` auf dem Handy vermeiden

## Safe Areas und Layout
- Vollflächige Layouts: `env(safe-area-inset-*)` und `viewport-fit=cover`
- Kein ungewolltes waagrechtes Scrollen

## Dunkelmodus
- `color-scheme: dark` im dunklen Thema; `<meta name="theme-color">` passend zum Hintergrund

## Zu markieren (Anti-Muster)
- `user-scalable=no` / `maximum-scale=1`
- `transition: all`, `outline: none` ohne Ersatz
- `<div>`/`<span>` mit Klick-Handler
- Bilder ohne Maße, Felder ohne Label, Icon-Buttons ohne `aria-label`
- Fest einprogrammierte Datums-/Zahlenformate
- Reine Gesten-Aktion ohne Alternative
