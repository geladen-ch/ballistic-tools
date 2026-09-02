// Fetches for the built-in target library. Mirrors bullets.js/rifles.js
// exactly: the catalog is a plain id list (a real ES module, not a fetch —
// see targets/target-catalog.js), and each target's JSON data (dimensions,
// zones, point-of-aim/scale) and JS scoring function are fetched/imported
// and cached in-memory per id, once per browser tab. The three SVGs
// (thumbnail, detail, result) are left as plain URLs rather than fetched
// here — callers decide how to use them (an <img src>, or fetched and
// inlined as DOM when overlay elements need to share its coordinate
// space, as the results illustration does).
import { TARGET_IDS } from './targets/target-catalog.js';

const targetPromises = new Map();
const targetFunctionPromises = new Map();

export function loadTargetCatalog() {
  return TARGET_IDS;
}

export function loadTarget(id) {
  if (!targetPromises.has(id)) {
    const url = new URL(`./targets/${id}.json`, import.meta.url);
    targetPromises.set(id, fetch(url).then((res) => {
      if (!res.ok) throw new Error(`failed to load target "${id}": ${res.status}`);
      return res.json();
    }).catch((err) => {
      // Same reasoning as bullets.js's own loadBullet(): don't let a
      // transient failure poison every future attempt at this target for
      // the rest of the tab's session.
      targetPromises.delete(id);
      console.warn(`[targets] failed to load "${id}" data:`, err);
      throw err;
    }));
  }
  return targetPromises.get(id);
}

export function loadTargetFunction(id) {
  if (!targetFunctionPromises.has(id)) {
    const url = new URL(`./targets/${id}.js`, import.meta.url);
    targetFunctionPromises.set(id, import(url.href).then((mod) => mod.hitProbability).catch((err) => {
      targetFunctionPromises.delete(id);
      console.warn(`[targets] failed to load "${id}" scoring function:`, err);
      throw err;
    }));
  }
  return targetFunctionPromises.get(id);
}

export function targetThumbUrl(id) {
  return new URL(`./targets/${id}-thumb.svg`, import.meta.url);
}

export function targetDetailUrl(id) {
  return new URL(`./targets/${id}-detail.svg`, import.meta.url);
}

export function targetResultUrl(id) {
  return new URL(`./targets/${id}-result.svg`, import.meta.url);
}
