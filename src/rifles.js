// Fetches for the built-in rifle library. Mirrors bullets.js exactly: the
// catalog is a plain id list (a real ES module, not a fetch — see
// rifles/rifle-catalog.js), and each rifle's full record (including its
// cartridges, each referencing a bullet id from the bullet library) is
// fetched and cached in-memory per id, once per browser tab.
import { RIFLE_IDS } from './rifles/rifle-catalog.js';

const riflePromises = new Map();

export function loadRifleCatalog() {
  return RIFLE_IDS;
}

export function loadRifle(id) {
  if (!riflePromises.has(id)) {
    const url = new URL(`./rifles/${id}.json`, import.meta.url);
    riflePromises.set(id, fetch(url).then((res) => {
      if (!res.ok) throw new Error(`failed to load rifle "${id}": ${res.status}`);
      return res.json();
    }));
  }
  return riflePromises.get(id);
}
