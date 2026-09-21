// Generic, hand-rolled IndexedDB Promise wrapper — no npm dependency (this
// project has none and keeps it that way). Request-based rather than
// transaction-oncomplete-based, and deliberately narrow: keyPath-based
// stores, no indexes, no cursors, no key ranges. Whole-store reads
// (getAll), keys-only reads (getAllKeys), one record by key (getRecord),
// put and delete — anything needing more than that is outside what this
// file is meant to cover.

export function openDatabase({ name, version, stores }) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, version);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const store of stores) {
        if (!db.objectStoreNames.contains(store.name)) {
          db.createObjectStore(store.name, { keyPath: store.keyPath });
        }
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('failed to open database'));
  });
}

export function getAll(db, storeName) {
  return new Promise((resolve, reject) => {
    const request = db.transaction(storeName, 'readonly').objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('getAll failed'));
  });
}

// Keys only: IndexedDB does not read the values to answer this, so it is
// cheap even for a store whose records are large.
export function getAllKeys(db, storeName) {
  return new Promise((resolve, reject) => {
    const request = db.transaction(storeName, 'readonly').objectStore(storeName).getAllKeys();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('getAllKeys failed'));
  });
}

// One record by key, or undefined if there is none.
export function getRecord(db, storeName, key) {
  return new Promise((resolve, reject) => {
    const request = db.transaction(storeName, 'readonly').objectStore(storeName).get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('get failed'));
  });
}

export function put(db, storeName, record) {
  return new Promise((resolve, reject) => {
    const request = db.transaction(storeName, 'readwrite').objectStore(storeName).put(record);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error || new Error('put failed'));
  });
}

export function deleteRecord(db, storeName, key) {
  return new Promise((resolve, reject) => {
    const request = db.transaction(storeName, 'readwrite').objectStore(storeName).delete(key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error || new Error('delete failed'));
  });
}
