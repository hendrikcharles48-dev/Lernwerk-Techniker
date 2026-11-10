// Rückfall-Kopien: Vor jedem riskanten Schritt legt die App eine Kopie aller Lerndaten auf diesem Gerät ab.
// Eigene kleine Datenbank („lernwerk-rueckfall“), getrennt von den Lerndaten, damit sie nichts daran ändert
// und nicht mit abgeglichen wird. Ohne Fotos. Es bleiben die neuesten fünf Kopien.
//
// Wann: vor dem Einspielen vom anderen Gerät (höchstens alle zwölf Stunden), vor dem Laden einer Sicherung,
// vor dem Zusammenlegen von Fächern und beim ersten Start nach einem Update.
const NAME = 'lernwerk-rueckfall', STORE = 'kopien', MAX = 5;

function open() {
  return new Promise(resolve => {
    try {
      if (!('indexedDB' in self)) return resolve(null);
      const req = indexedDB.open(NAME, 1);
      req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'id' }); };
      req.onsuccess = () => resolve(req.result);
      req.onerror = req.onblocked = () => resolve(null);
    } catch (e) { resolve(null); }
  });
}
function tx(mode, fn) {
  return open().then(db => new Promise(resolve => {
    if (!db) return resolve(undefined);
    try {
      const t = db.transaction(STORE, mode);
      const r = fn(t.objectStore(STORE));
      let result;
      if (r && 'onsuccess' in r) r.onsuccess = () => { result = r.result; };
      t.oncomplete = () => { db.close(); resolve(result); };
      t.onerror = t.onabort = () => { db.close(); resolve(undefined); };
    } catch (e) { resolve(undefined); }
  }));
}

// Alle Kopien ohne die Daten selbst, neueste zuerst
export async function liste() {
  const alle = (await tx('readonly', s => s.getAll())) || [];
  return alle.map(k => ({ id: k.id, zeit: k.zeit, grund: k.grund, version: k.version, groesse: (k.daten || '').length })).sort((a, b) => b.zeit - a.zeit);
}
// daten: Stand im Format von exportBackup (ohne Fotos). Gibt true zurück, wenn die Kopie liegt.
export async function sichern(grund, daten, version = '') {
  try {
    const text = JSON.stringify(daten);
    const id = 'k' + Date.now();
    await tx('readwrite', s => s.put({ id, zeit: Date.now(), grund, version, daten: text }));
    const alle = await liste();
    for (const k of alle.slice(MAX)) await tx('readwrite', s => s.delete(k.id));
    return alle.some(k => k.id === id);
  } catch (e) { return false; }
}
// Nur, wenn die letzte Kopie mit diesem Grund älter ist als die angegebenen Stunden
export async function sichernWennAlt(grund, holeDaten, stunden = 12, version = '') {
  const letzte = (await liste()).find(k => k.grund === grund);
  if (letzte && Date.now() - letzte.zeit < stunden * 3600000) return false;
  return sichern(grund, await holeDaten(), version);
}
export async function holen(id) {
  const k = await tx('readonly', s => s.get(id));
  if (!k || !k.daten) return null;
  try { return JSON.parse(k.daten); } catch (e) { return null; }
}
