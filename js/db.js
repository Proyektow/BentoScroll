const DB_NAME = 'BentoScrollMacroDB';
const DB_VERSION = 1;

export function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('state')) {
        db.createObjectStore('state', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('captures')) {
        db.createObjectStore('captures', { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/* --- Estado de Píldoras --- */
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

/* --- Capturas Privadas del Escáner --- */
export async function saveCapture(captureObj) {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction('captures', 'readwrite');
    tx.objectStore('captures').put(captureObj);
    tx.oncomplete = () => resolve(captureObj);
  });
}

export async function getAllCaptures() {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction('captures', 'readonly');
    const req = tx.objectStore('captures').getAll();
    req.onsuccess = () => {
      const list = req.result || [];
      list.sort((a, b) => b.createdAt - a.createdAt);
      resolve(list);
    };
  });
}

export async function deleteCapture(id) {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction('captures', 'readwrite');
    tx.objectStore('captures').delete(id);
    tx.oncomplete = () => resolve();
  });
}
