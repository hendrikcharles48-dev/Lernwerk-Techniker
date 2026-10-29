"""Erzeugt die Podcast-Folgen als Audiodateien unter audio/.

Ablauf:
  node tools/hoer/skript.mjs        # Skripte aus den Inhalten bauen
  python3 tools/hoer/erzeugen.py    # Audio erzeugen, nur geänderte Folgen

Braucht: pip install piper-tts, ffmpeg. Die Stimmen (Piper, frei nutzbar) werden
beim ersten Lauf von GitHub geladen und außerhalb des Repositorys gespeichert.
"""
import glob, hashlib, json, os, subprocess, sys, tarfile, urllib.request, wave
from multiprocessing import Pool

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CACHE = os.path.expanduser('~/.cache/lernwerk-hoer')
STIMMEN = {'A': 'kerstin-low', 'B': 'thorsten-high'}
QUELLE = 'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-de_DE-{}.tar.bz2'
RATE = 22050
LUECKE = 0.25        # Sekunden zwischen zwei Sätzen
WECHSEL = 0.40       # Sekunden, wenn die Sprecherin wechselt
BITRATE = '32k'

def stimme(name):
    d = os.path.join(CACHE, 'vits-piper-de_DE-' + name)
    if not os.path.isdir(d):
        os.makedirs(CACHE, exist_ok=True)
        tar = d + '.tar.bz2'
        print('Lade Stimme', name)
        urllib.request.urlretrieve(QUELLE.format(name), tar)
        with tarfile.open(tar) as t: t.extractall(CACHE)
        os.remove(tar)
    from piper import PiperVoice
    return PiperVoice.load(glob.glob(d + '/*.onnx')[0])

def satz_wav(voice, vname, text):
    """Ein Satz als WAV mit 22050 Hz mono, zwischengespeichert."""
    key = hashlib.sha1((vname + '|' + text).encode()).hexdigest()
    out = os.path.join(CACHE, 'saetze', key + '.wav')
    if os.path.exists(out): return out
    os.makedirs(os.path.dirname(out), exist_ok=True)
    roh = out + '.roh.wav'
    with wave.open(roh, 'wb') as w: voice.synthesize_wav(text, w)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', roh, '-ac', '1', '-ar', str(RATE), out], check=True)
    os.remove(roh)
    return out

def dauer(path):
    with wave.open(path) as w: return w.getnframes() / w.getframerate()

def stille(sek):
    out = os.path.join(CACHE, 'stille', f'{int(sek * 1000)}.wav')
    if not os.path.exists(out):
        os.makedirs(os.path.dirname(out), exist_ok=True)
        with wave.open(out, 'wb') as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(RATE)
            w.writeframes(b'\0\0' * int(RATE * sek))
    return out

_voices = None
def folge_bauen(args):
    """Eine Folge erzeugen. Läuft in einem eigenen Prozess."""
    global _voices
    f, zielordner = args
    if _voices is None: _voices = {k: stimme(v) for k, v in STIMMEN.items()}
    teile, segs, t, vorher = [stille(0.3)], [], 0.3, None
    for s in f['segs']:
        if vorher is not None:
            gap = round(max(WECHSEL if s['wer'] != vorher['wer'] else LUECKE, vorher.get('pause', 0) / 1000), 2)
            teile.append(stille(gap)); t += gap
        w = satz_wav(_voices[s['wer']], STIMMEN[s['wer']], s['say'])
        d = dauer(w)
        segs.append([round(t, 2), round(t + d, 2), s['wer'], s['art'], s['text']])
        teile.append(w); t += d; vorher = s
    teile.append(stille(0.8)); t += 0.8
    datei = f['tid'] + '.m4a'
    liste = os.path.join(CACHE, 'liste-' + f['tid'] + '.txt')
    with open(liste, 'w') as fh: fh.writelines(f"file '{p}'\n" for p in teile)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', liste,
                    '-af', 'loudnorm=I=-18:TP=-2:LRA=11', '-ar', str(RATE), '-ac', '1', '-c:a', 'aac', '-b:a', BITRATE,
                    '-movflags', '+faststart', os.path.join(zielordner, datei)], check=True)
    os.remove(liste)
    print(f"{f['tid']}: {round(t / 60, 1)} min", flush=True)
    return f['tid'], {'hash': f['hash'], 'datei': datei, 'dauer': round(t, 1), 'thema': f['thema'], 'fach': f['fach'], 'segs': segs}

def main():
    skripte = json.load(open(os.path.join(ROOT, 'tools/hoer/skripte.json')))
    zielordner = os.path.join(ROOT, 'audio')
    os.makedirs(zielordner, exist_ok=True)
    idx_pfad = os.path.join(zielordner, 'folgen.json')
    alt = json.load(open(idx_pfad)) if os.path.exists(idx_pfad) else {'folgen': {}}
    for v in STIMMEN.values(): stimme(v)
    neu, offen = {}, []
    nur = set(sys.argv[1:])
    for f in skripte['folgen']:
        a = alt['folgen'].get(f['tid'])
        fertig = a and a['hash'] == f['hash'] and os.path.exists(os.path.join(zielordner, a['datei']))
        if fertig or (nur and f['tid'] not in nur):
            if a: neu[f['tid']] = a
            continue
        offen.append((f, zielordner))
    with Pool(2) as pool:
        for tid, info in pool.imap_unordered(folge_bauen, offen): neu[tid] = info
    # Alte Dateien zu Themen, die es nicht mehr gibt, entfernen
    for p in glob.glob(os.path.join(zielordner, '*.m4a')):
        if os.path.basename(p)[:-4] not in neu: os.remove(p)
    reihen = [f['tid'] for f in skripte['folgen']]
    neu = {k: neu[k] for k in sorted(neu, key=lambda k: reihen.index(k) if k in reihen else 999)}
    json.dump({'sprecher': skripte['sprecher'], 'stimmen': STIMMEN, 'folgen': neu}, open(idx_pfad, 'w'), ensure_ascii=False, separators=(',', ':'))
    print(len(neu), 'Folgen,', round(sum(x['dauer'] for x in neu.values()) / 3600, 1), 'Stunden')

if __name__ == '__main__':
    main()
