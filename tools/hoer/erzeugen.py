"""Erzeugt die Podcast-Folgen als Audiodateien unter audio/.

Ablauf:
  node tools/hoer/skript.mjs        # Skripte aus den Inhalten bauen
  python3 tools/hoer/erzeugen.py    # Audio erzeugen, nur geänderte Folgen

Braucht: pip install piper-tts, ffmpeg. Die Stimmen (Piper, frei nutzbar) werden
beim ersten Lauf von GitHub geladen und außerhalb des Repositorys gespeichert.
"""
import glob, hashlib, json, os, re, subprocess, sys, tarfile, urllib.request, wave
from multiprocessing import Pool

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CACHE = os.path.expanduser('~/.cache/lernwerk-hoer')
# Lena: Coqui CSS10 (Frauenstimme, 22 kHz), Tom: Piper Thorsten in hoher Qualität. Beide frei nutzbar.
STIMMEN = {'A': 'coqui-de-css10', 'B': 'piper-de_DE-thorsten-high'}
QUELLE = 'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-{}.tar.bz2'
RATE = 22050
LUECKE = 0.25        # Sekunden zwischen zwei Sätzen
WECHSEL = 0.40       # Sekunden, wenn die Sprecherin wechselt
BITRATE = '32k'

EINS = ['null', 'eins', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun', 'zehn', 'elf', 'zwölf',
        'dreizehn', 'vierzehn', 'fünfzehn', 'sechzehn', 'siebzehn', 'achtzehn', 'neunzehn']
ZEHN = ['', '', 'zwanzig', 'dreißig', 'vierzig', 'fünfzig', 'sechzig', 'siebzig', 'achtzig', 'neunzig']
ORD = ['', 'erste', 'zweite', 'dritte', 'vierte', 'fünfte', 'sechste', 'siebte', 'achte', 'neunte', 'zehnte']
def _u100(n):
    if n < 20: return EINS[n]
    z, e = divmod(n, 10)
    return (('ein' if e == 1 else EINS[e]) + 'und' if e else '') + ZEHN[z]
def _u1000(n, vorne=False):
    h, r = divmod(n, 100)
    s = (('ein' if h == 1 else EINS[h]) + 'hundert') if h else ''
    if r: s += ('ein' if (r == 1 and vorne) else _u100(r))
    return s
def zahlwort(n):
    """Ganze Zahl als deutsches Wort, für Stimmen ohne eigene Zahlenaussprache."""
    if n == 0: return 'null'
    s = ''
    m, n = divmod(n, 10 ** 6)
    if m: s += ('eine Million ' if m == 1 else zahlwort(m) + ' Millionen ')
    t, n = divmod(n, 1000)
    if t: s += _u1000(t, True) + 'tausend'
    if n: s += _u1000(n)
    return s.strip()
def zahlen_aus(text):
    text = re.sub(r'\b(\d{1,2})\.(?= [A-ZÄÖÜ][a-zäöü])', lambda m: ORD[int(m.group(1))] if int(m.group(1)) <= 10 else m.group(0), text)
    text = re.sub(r'(\d) (\d{3})\b', r'\1\2', text)
    text = re.sub(r'\b1 (Million|Milliarde)\b', r'eine \1', text)
    def dez(m):
        ganz, nach = m.group(1), m.group(2)
        w = zahlwort(int(ganz))
        return w + (' Komma ' + ' '.join(EINS[int(c)] for c in nach) if nach else '')
    return re.sub(r'(\d+)(?:,(\d+))?', dez, text)

class Stimme:
    def __init__(self, name):
        d = os.path.join(CACHE, 'vits-' + name)
        if not os.path.isdir(d):
            os.makedirs(CACHE, exist_ok=True)
            tar = d + '.tar.bz2'
            print('Lade Stimme', name, flush=True)
            urllib.request.urlretrieve(QUELLE.format(name), tar)
            with tarfile.open(tar) as t: t.extractall(CACHE)
            os.remove(tar)
        self.name = name
        if name.startswith('piper-'):
            from piper import PiperVoice
            self.v = PiperVoice.load(glob.glob(d + '/*.onnx')[0]); self.art = 'piper'
        else:
            import sherpa_onnx
            cfg = sherpa_onnx.OfflineTtsConfig(model=sherpa_onnx.OfflineTtsModelConfig(
                vits=sherpa_onnx.OfflineTtsVitsModelConfig(model=d + '/model.onnx', tokens=d + '/tokens.txt'), num_threads=2))
            self.v = sherpa_onnx.OfflineTts(cfg); self.art = 'sherpa'
    def schreibe(self, text, pfad):
        if self.art == 'piper':
            with wave.open(pfad, 'wb') as w: self.v.synthesize_wav(text, w)
            return
        import numpy as np
        # Diese Stimme kennt kein großes I und keine Ziffern
        a = self.v.generate(zahlen_aus(text).replace('I', 'i').replace('„', '').replace('“', ''), sid=0, speed=1.0)
        x = (np.clip(np.array(a.samples), -1, 1) * 32767).astype('<i2')
        with wave.open(pfad, 'wb') as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(a.sample_rate); w.writeframes(x.tobytes())

def stimme(name): return Stimme(name)

def satz_wav(voice, vname, text):
    """Ein Satz als WAV mit 22050 Hz mono, zwischengespeichert."""
    # Bei Coqui gehört die Textvorbereitung zum Schlüssel, damit Korrekturen neu erzeugt werden
    key = hashlib.sha1((vname.replace('piper-de_DE-', '') + ('#2' if 'coqui' in vname else '') + '|' + text).encode()).hexdigest()
    out = os.path.join(CACHE, 'saetze', key + '.wav')
    if os.path.exists(out): return out
    os.makedirs(os.path.dirname(out), exist_ok=True)
    # Eigene Zwischendateien je Prozess, fertige Datei erst am Ende an ihren Platz
    roh = f'{out}.{os.getpid()}.roh.wav'
    tmp = f'{out}.{os.getpid()}.tmp.wav'
    voice.schreibe(text or '.', roh)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', roh, '-ac', '1', '-ar', str(RATE), tmp], check=True)
    os.remove(roh)
    os.replace(tmp, out)
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
def _stimmen():
    global _voices
    if _voices is None: _voices = {k: stimme(v) for k, v in STIMMEN.items()}
    return _voices

def _kodieren(teile, ziel, name):
    liste = os.path.join(CACHE, 'liste-' + name + '.txt')
    with open(liste, 'w') as fh: fh.writelines(f"file '{p}'\n" for p in teile)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', liste,
                    '-af', 'loudnorm=I=-18:TP=-2:LRA=11', '-ar', str(RATE), '-ac', '1', '-c:a', 'aac', '-b:a', BITRATE,
                    '-movflags', '+faststart', ziel], check=True)
    os.remove(liste)

def bauen(job):
    try: return _bauen(job)
    except Exception as e:
        print('FEHLER', job[1]['tid'], job[0], e, flush=True)
        return job[1]['tid'], 'fehler', None

def _bauen(job):
    """Eine Folge oder die Karten eines Themas erzeugen. Läuft in einem eigenen Prozess."""
    art, f, zielordner = job
    v = _stimmen()
    teile, segs, t = [stille(0.3)], [], 0.3
    if art == 'folge':
        vorher = None
        for s in f['segs']:
            if vorher is not None:
                gap = round(max(WECHSEL if s['wer'] != vorher['wer'] else LUECKE, vorher.get('pause', 0) / 1000), 2)
                teile.append(stille(gap)); t += gap
            w = satz_wav(v[s['wer']], STIMMEN[s['wer']], s['say'])
            d = dauer(w)
            segs.append([round(t, 2), round(t + d, 2), s['wer'], s['art'], s['text']])
            teile.append(w); t += d; vorher = s
        datei = f['tid'] + '.m4a'
    else:
        for k in f['karten']:
            for wer, say, text, kind in (('A', k['sq'], k['q'], 'frage'), ('B', k['sa'], k['a'], 'antwort')):
                w = satz_wav(v[wer], STIMMEN[wer], say)
                d = dauer(w)
                segs.append([round(t, 2), round(t + d, 2), wer, kind, text])
                teile.append(w); t += d
                gap = 0.5 if kind == 'frage' else 0.9
                teile.append(stille(gap)); t += gap
        datei = f['tid'] + '-karten.m4a'
    teile.append(stille(0.8)); t += 0.8
    _kodieren(teile, os.path.join(zielordner, datei), f['tid'] + art)
    print(f"{f['tid']} {art}: {round(t / 60, 1)} min", flush=True)
    return f['tid'], art, {'datei': datei, 'dauer': round(t, 1), 'segs': segs}

def main():
    skripte = json.load(open(os.path.join(ROOT, 'tools/hoer/skripte.json')))
    zielordner = os.path.join(ROOT, 'audio')
    os.makedirs(zielordner, exist_ok=True)
    idx_pfad = os.path.join(zielordner, 'folgen.json')
    alt = json.load(open(idx_pfad)) if os.path.exists(idx_pfad) else {'folgen': {}}
    if alt.get('stimmen') != STIMMEN: alt = {'folgen': {}}   # andere Stimmen: alles neu
    for name in STIMMEN.values(): stimme(name)
    neu, jobs = {}, []
    nur = set(sys.argv[1:])
    for f in skripte['folgen']:
        a = alt['folgen'].get(f['tid']) or {}
        e = {'hash': f['hash'], 'khash': f['khash'], 'thema': f['thema'], 'fach': f['fach']}
        if a.get('hash') == f['hash'] and os.path.exists(os.path.join(zielordner, a.get('datei', '-'))):
            e.update({k: a[k] for k in ('datei', 'dauer', 'segs')})
        elif not nur or f['tid'] in nur: jobs.append(('folge', f, zielordner))
        if a.get('khash') == f['khash'] and a.get('karten') and os.path.exists(os.path.join(zielordner, a['karten']['datei'])):
            e['karten'] = a['karten']
        elif f['karten'] and (not nur or f['tid'] in nur): jobs.append(('karten', f, zielordner))
        neu[f['tid']] = e
    with Pool(2) as pool:
        for tid, art, info in pool.imap_unordered(bauen, jobs):
            if art == 'fehler': continue
            if art == 'folge': neu[tid].update(info)
            else: neu[tid]['karten'] = info
            # Zwischenstand speichern, damit ein Abbruch nichts verliert
            fertig = {k: x for k, x in neu.items() if 'datei' in x}
            json.dump({'sprecher': skripte['sprecher'], 'stimmen': STIMMEN, 'folgen': fertig}, open(idx_pfad, 'w'), ensure_ascii=False, separators=(',', ':'))
    neu = {k: x for k, x in neu.items() if 'datei' in x}
    behalten = {x['datei'] for x in neu.values()} | {x['karten']['datei'] for x in neu.values() if x.get('karten')}
    for p in glob.glob(os.path.join(zielordner, '*.m4a')):
        if os.path.basename(p) not in behalten: os.remove(p)
    json.dump({'sprecher': skripte['sprecher'], 'stimmen': STIMMEN, 'folgen': neu}, open(idx_pfad, 'w'), ensure_ascii=False, separators=(',', ':'))
    print(len(neu), 'Folgen,', round(sum(x['dauer'] + x.get('karten', {}).get('dauer', 0) for x in neu.values()) / 3600, 1), 'Stunden')

if __name__ == '__main__':
    main()
