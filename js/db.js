// IndexedDB mit Absicherung. Fällt bei Problemen auf einen Speicher im Arbeitsspeicher zurück,
// damit die App nicht abstürzt (zum Beispiel im privaten Modus).
const DB_NAME = 'lernwerk';
const DB_VERSION = 1;
export const STORES = ['kv', 'content', 'notes', 'photos', 'cards', 'errors', 'events', 'exams'];

let dbp = null;
const memory = Object.fromEntries(STORES.map(s => [s, new Map()]));
export let persistent = true;

function open() {
  if (dbp) return dbp;
  dbp = new Promise(resolve => {
    try {
      if (!('indexedDB' in self)) { persistent = false; return resolve(null); }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const s of STORES) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, s === 'kv' ? undefined : { keyPath: 'id' });
      };
      req.onsuccess = () => {
        const db = req.result;
        db.onversionchange = () => db.close();
        resolve(db);
      };
      req.onerror = () => { persistent = false; resolve(null); };
      req.onblocked = () => { persistent = false; resolve(null); };
    } catch (e) { persistent = false; resolve(null); }
  });
  return dbp;
}

function tx(store, mode, fn) {
  return open().then(db => new Promise(resolve => {
    if (!db) return resolve(fn(null));
    try {
      const t = db.transaction(store, mode);
      const s = t.objectStore(store);
      let result;
      const r = fn(s);
      if (r && 'onsuccess' in r) r.onsuccess = () => { result = r.result; };
      t.oncomplete = () => resolve(result);
      t.onerror = t.onabort = () => { console.warn('Speicherfehler', store, t.error); resolve(undefined); };
    } catch (e) { console.warn('Speicherfehler', store, e); resolve(fn(null)); }
  }));
}

export async function get(store, key) {
  const db = await open();
  if (!db) return memory[store].get(key);
  return tx(store, 'readonly', s => (s ? s.get(key) : memory[store].get(key)));
}
export async function put(store, value, key) {
  const db = await open();
  if (!db) { memory[store].set(key != null ? key : value.id, value); return; }
  return tx(store, 'readwrite', s => (s ? (key != null ? s.put(value, key) : s.put(value)) : memory[store].set(key != null ? key : value.id, value)));
}
export async function del(store, key) {
  const db = await open();
  if (!db) { memory[store].delete(key); return; }
  return tx(store, 'readwrite', s => (s ? s.delete(key) : memory[store].delete(key)));
}
export async function all(store) {
  const db = await open();
  if (!db) return [...memory[store].values()];
  return tx(store, 'readonly', s => (s ? s.getAll() : [...memory[store].values()])).then(r => r || []);
}
export async function allKV() {
  const db = await open();
  if (!db) return [...memory.kv.entries()];
  const keys = await tx('kv', 'readonly', s => s.getAllKeys());
  const vals = await tx('kv', 'readonly', s => s.getAll());
  return (keys || []).map((k, i) => [k, vals[i]]);
}
export async function clear(store) {
  const db = await open();
  if (!db) { memory[store].clear(); return; }
  return tx(store, 'readwrite', s => s.clear());
}

export async function requestPersist() {
  try {
    if (navigator.storage && navigator.storage.persist) {
      if (await navigator.storage.persisted()) return true;
      return await navigator.storage.persist();
    }
  } catch (e) { /* nicht unterstützt */ }
  return false;
}

// Kleine Einstellungen: localStorage, abgesichert
export const prefs = {
  get(k, d) { try { const v = localStorage.getItem('lernwerk:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('lernwerk:' + k, JSON.stringify(v)); } catch (e) { /* voll oder gesperrt */ } }
};
