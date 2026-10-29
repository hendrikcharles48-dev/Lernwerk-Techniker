"""Kontrollbogen: alle Skizzen auf einer Seite, mit den Farben der App."""
import json, os, sys
z = os.path.join(os.path.dirname(__file__), '..', '..', 'inhalte', 'bilder')
idx = json.load(open(os.path.join(z, 'index.json')))
nur = sys.argv[1:] 
css = open(os.path.join(os.path.dirname(__file__), '..', '..', 'css', 'app.css')).read()
h = ['<!doctype html><meta charset="utf-8"><style>' + css + 'html,body{height:auto!important;overflow:visible!important;position:static!important}body{background:var(--bg);padding:10px;display:grid;grid-template-columns:1fr 1fr;gap:10px}body::before,body::after{display:none!important}</style>']
for tid, l in idx.items():
    for x in l:
        if nur and not any(n in x['datei'] for n in nur): continue
        h.append(f'<figure class="sk-fig sk"><div class="sk-box">{open(os.path.join(z, x["datei"])).read()}</div><figcaption>{x["datei"]}</figcaption></figure>')
open('/tmp/claude-0/-home-user/5652a0ed-b350-5c17-b5ae-390e73d4ab92/scratchpad/bogen.html', 'w').write(''.join(h))
