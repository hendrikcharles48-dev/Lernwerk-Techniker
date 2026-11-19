---
name: token-optimizer
description: Prüft das Projekt auf unnötigen Kontextverbrauch (zu große CLAUDE.md, ungenutzte Skills, große Dateien, teure Subagents) und schlägt konkrete Kürzungen vor. Nur auf Aufruf mit /token-optimizer.
disable-model-invocation: true
---

# Token-Optimizer – Kontext-Check

Ziel: weniger Claude-Verbrauch bei gleicher Qualität. Nichts ändern, bevor der Nutzer OK sagt.

## 1. Messen (nur Befehle, keine Dateien komplett lesen)
- `wc -l -c CLAUDE.md */CLAUDE.md .claude/rules/*.md 2>/dev/null`
- Größe jeder Skill-Beschreibung: Frontmatter von `.claude/skills/*/SKILL.md`
- Größte Quelldateien: `find . -name '*.js' -o -name '*.html' | xargs wc -c | sort -n | tail -8`
- `.claude/agents/` vorhanden? Welches Modell nutzt Explore?
- Bilder/Screenshots im Repo-Wurzelordner: `ls *.png 2>/dev/null | wc -l`

## 2. Bewerten
| Befund | Grenze | Maßnahme |
|---|---|---|
| Wurzel-CLAUDE.md | über 200 Zeilen oder 12 KB | Abschnitte, die nur einen Ordner betreffen, nach `<ordner>/CLAUDE.md` verschieben (lädt erst, wenn dort gearbeitet wird); Regeln für bestimmte Dateien nach `.claude/rules/<thema>.md` mit `paths:` |
| Doppelte oder widersprüchliche Regeln | jede | zusammenführen, Nutzer fragen, welche gilt |
| Skill seit Wochen ungenutzt | – | in `.claude/settings.json` unter `skillOverrides` auf `"user-invocable-only"` |
| Skill, der „vor jeder Aufgabe“ laden will | – | prüfen, ob er zum Arbeitsablauf passt, sonst abschalten |
| Explore-Subagent ohne eigenes Modell | – | `.claude/agents/explore.md` mit `model: haiku` |
| Datei über 50 KB | – | in CLAUDE.md vermerken: nur per `grep -n` und Zeilenbereich lesen |

## 3. Bericht (kurz)
Höchstens 8 Punkte, sortiert nach Ersparnis, je Punkt: Befund, geschätzte Ersparnis, Vorschlag. Danach auf OK warten.

Feste Nutzerregeln (als „Nutzerwunsch“ oder „fest“ markiert) nie streichen oder abschwächen – nur verschieben oder kürzer formulieren, Inhalt gleich.
