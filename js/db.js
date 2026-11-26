const DB_NAME = 'BentoScrollDB';
const DB_VERSION = 1;

export function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('state')) {
        db.createObjectStore('state', { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getCardState(id) {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction('state', 'readonly');
    const req = tx.objectStore('state').get(id);
    req.onsuccess = () => resolve(req.result || { id, seen: false, saved: false });
  });
}

export async function updateCardState(id, patch) {
  const current = await getCardState(id);
  const updated = { ...current, ...patch, updatedAt: Date.now() };
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction('state', 'readwrite');
    tx.objectStore('state').put(updated);
    tx.oncomplete = () => resolve(updated);
  });
}

export async function getAllStates() {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction('state', 'readonly');
    const req = tx.objectStore('state').getAll();
    req.onsuccess = () => resolve(req.result || []);
  });
}
