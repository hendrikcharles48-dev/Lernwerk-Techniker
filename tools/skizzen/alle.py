"""Alle Skizzen neu zeichnen: python3 tools/skizzen/alle.py"""
import glob, os, sys
sys.path.insert(0, os.path.dirname(__file__))
import sk
mods = [m for m in ['mechanik', 'elektro', 'mathe', 'technik', 'wirtschaft'] if os.path.exists(os.path.join(os.path.dirname(__file__), m + '.py'))]
for p in glob.glob(os.path.join(sk.ZIEL, '*.svg')): os.remove(p)
n = 0
for m in mods:
    for f in __import__(m).ALLE: f(); n += 1
sk.index_schreiben()
print(n, 'Skizzen')
