// Fetches for the built-in rifle library. Mirrors bullets.js exactly: the
// catalog is a plain id list (a real ES module, not a fetch — see
// rifles/rifle-catalog.js), and each rifle's full record (including its
// cartridges, each referencing a bullet id from the bullet library) is
// fetched and cached in-memory per id, once per browser tab.
import { RIFLE_IDS } from './rifles/rifle-catalog.js';
import { logDiagnostic } from './debug-log.js';

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
    }).catch((err) => {
      // Same reasoning as bullets.js's own loadBullet(): don't let a
      // transient failure poison every future attempt at this rifle for
      // the rest of the tab's session.
      riflePromises.delete(id);
      logDiagnostic('warn', `[rifles] failed to load "${id}":`, err);
      throw err;
    }));
  }
  return riflePromises.get(id);
}
