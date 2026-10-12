/**
 * Úložiště offline studia v telefonu (IndexedDB).
 *
 * Časuje se v letadle: písně (text + zvuk) se stáhnou předem, hotové časování
 * se ukládá sem a po připojení se hromadně nahraje na server. Načasované
 * písně jde stáhnout i se zpěvem (časování + instrumentál) a zpívat offline.
 * Zvuk se drží
 * jako Blob – všech nečasovaných písní je kolem 800 MB, na to localStorage
 * (pár MB) ani zdaleka nestačí.
 */

export type OfflinePisen = {
  id: string;
  title: string;
  artist: string | null;
  lyrics: string | null;
  chords: string | null;
  startTime: number;
  audioUrl: string;
  audioSize: number | null;
  stazeno: number;
  /** Časování ze serveru – jen u písní stažených ke zpěvu. */
  timingData?: any;
  instrumentalUrl?: string | null;
};

export type OfflineVysledek = {
  id: string;
  /** Tělo pro PUT /api/songs/:id – stejné, jaké posílá studio online. */
  telo: string;
  /** Uživatel dal „Publikovat" → po nahrání se píseň rovnou zveřejní. */
  publikovat: boolean;
  kdy: number;
};

const DB = 'karacho-offline';
const VERZE = 2;

function otevri(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, VERZE);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains('pisne')) db.createObjectStore('pisne', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('zvuky')) db.createObjectStore('zvuky');
      if (!db.objectStoreNames.contains('vysledky')) db.createObjectStore('vysledky', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('instrumentaly')) db.createObjectStore('instrumentaly');
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

async function akce<T>(store: string, rezim: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await otevri();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(store, rezim);
    const req = fn(tx.objectStore(store));
    tx.oncomplete = () => { resolve(req.result as T); db.close(); };
    tx.onerror = () => { reject(tx.error); db.close(); };
    tx.onabort = () => { reject(tx.error); db.close(); };
  });
}

export const offlineDb = {
  pisne: () => akce<OfflinePisen[]>('pisne', 'readonly', (s) => s.getAll()),
  ulozPisen: (p: OfflinePisen) => akce('pisne', 'readwrite', (s) => s.put(p)),
  smazPisen: (id: string) => akce('pisne', 'readwrite', (s) => s.delete(id)),

  zvuk: (id: string) => akce<Blob | undefined>('zvuky', 'readonly', (s) => s.get(id)),
  ulozZvuk: (id: string, b: Blob) => akce('zvuky', 'readwrite', (s) => s.put(b, id)),
  smazZvuk: (id: string) => akce('zvuky', 'readwrite', (s) => s.delete(id)),
  zvukyKlice: () => akce<IDBValidKey[]>('zvuky', 'readonly', (s) => s.getAllKeys()),

  instrumental: (id: string) => akce<Blob | undefined>('instrumentaly', 'readonly', (s) => s.get(id)),
  ulozInstrumental: (id: string, b: Blob) => akce('instrumentaly', 'readwrite', (s) => s.put(b, id)),
  smazInstrumental: (id: string) => akce('instrumentaly', 'readwrite', (s) => s.delete(id)),
  instrumentalyKlice: () => akce<IDBValidKey[]>('instrumentaly', 'readonly', (s) => s.getAllKeys()),

  vysledky: () => akce<OfflineVysledek[]>('vysledky', 'readonly', (s) => s.getAll()),
  vysledek: (id: string) => akce<OfflineVysledek | undefined>('vysledky', 'readonly', (s) => s.get(id)),
  ulozVysledek: (v: OfflineVysledek) => akce('vysledky', 'readwrite', (s) => s.put(v)),
  smazVysledek: (id: string) => akce('vysledky', 'readwrite', (s) => s.delete(id)),
};
