// Fetches for the built-in bullet library. The catalog is just a list of
// ids — no name/manufacturer/caliber/mass duplicated there — so building
// anything that needs those (a picker, a filter) means resolving each id's
// full record too; see loadBullet(). Everything here is cached in-memory
// (per browser tab) so re-opening the picker or re-selecting a bullet
// never re-fetches.
import { BULLET_IDS } from './bullets/bullet-catalog.js';

const CALIBER_DESIGNATIONS_URL = new URL('./bullets/caliber-designations.json', import.meta.url);

let designationsPromise = null;
const bulletPromises = new Map();

// The catalog itself is a real ES module (see bullet-catalog.js), not a
// fetch — it's code-shaped metadata, imported once as part of the module
// graph, not data loaded over the network. Still exposed as a loadXxx()
// function so callers don't need to care that this particular "load" is
// actually free — and so a `Promise.all([loadBulletCatalog(), ...])`
// alongside the genuinely async loaders below keeps working unchanged.
export function loadBulletCatalog() {
  return BULLET_IDS;
}

export function loadBullet(id) {
  if (!bulletPromises.has(id)) {
    const url = new URL(`./bullets/${id}.json`, import.meta.url);
    bulletPromises.set(id, fetch(url).then((res) => {
      if (!res.ok) throw new Error(`failed to load bullet "${id}": ${res.status}`);
      return res.json();
    }));
  }
  return bulletPromises.get(id);
}

export function loadCaliberDesignations() {
  if (!designationsPromise) {
    designationsPromise = fetch(CALIBER_DESIGNATIONS_URL).then((res) => {
      if (!res.ok) throw new Error(`failed to load caliber designations: ${res.status}`);
      return res.json();
    });
  }
  return designationsPromise;
}

const DESIGNATION_TOLERANCE_M = 0.00003; // 0.03mm — accommodates float round-off, not a real caliber gap

// The closest known designation entry (see caliber-designations.json)
// within tolerance, or null if nothing in the table is close enough —
// the building block both designationFor() below (display, always wants
// *some* label) and ui/arsenal/caliber-field.js (a caliber picker with
// its own explicit "Other" option, which needs to tell "matched a real
// designation" apart from "nothing close enough") are built on.
export function matchCaliberDesignation(caliberM, designations) {
  let closest = null;
  let closestDiff = Infinity;
  for (const entry of designations) {
    const diff = Math.abs(entry.caliberM - caliberM);
    if (diff < closestDiff) {
      closest = entry;
      closestDiff = diff;
    }
  }
  return closest && closestDiff <= DESIGNATION_TOLERANCE_M ? closest : null;
}

// The colloquial name for a bore diameter (e.g. 0.0067056 m -> "6.5mm")
// is looked up rather than stored per-bullet — several real bullets share
// a diameter but not its marketing name (a nominal "6.5mm" bullet is
// actually .264in/6.7056mm), so the mapping has to be the single source
// of truth, not something copy-pasted into every bullet file. Falls back
// to a raw-mm label for a caliber the table doesn't know yet.
export function designationFor(caliberM, designations) {
  const match = matchCaliberDesignation(caliberM, designations);
  return match ? match.designation : `${(caliberM * 1000).toFixed(2)}mm`;
}
