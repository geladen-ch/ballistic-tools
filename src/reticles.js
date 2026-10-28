// Fetches for the built-in reticle library — see scopes.js. Each reticle's
// record is fetched, decoded (reticle/reticle-record.js) and cached
// in-memory per id, once per browser tab. A built-in reticle is linked to
// by its id, never copied into the Arsenal.
import { RETICLE_IDS } from './reticles/reticle-catalog.js';
import { logDiagnostic } from './debug-log.js';
import { decodeReticleRecord } from './reticle/reticle-record.js';

const reticlePromises = new Map();
const BUILT_IN_IDS = new Set(RETICLE_IDS);

export function loadReticleCatalog() {
  return RETICLE_IDS;
}

export function isBuiltInReticleId(id) {
  return BUILT_IN_IDS.has(id);
}

export function loadReticle(id) {
  if (!reticlePromises.has(id)) {
    const url = new URL(`./reticles/${id}.json`, import.meta.url);
    reticlePromises.set(id, fetch(url).then((res) => {
      if (!res.ok) throw new Error(`failed to load reticle "${id}": ${res.status}`);
      return res.json();
    }).then(decodeReticleRecord).catch((err) => {
      reticlePromises.delete(id);
      logDiagnostic('warn', `[reticles] failed to load "${id}":`, err);
      throw err;
    }));
  }
  return reticlePromises.get(id);
}

// Every built-in reticle that loads, in catalog order.
export async function loadBuiltInReticles() {
  const results = await Promise.allSettled(RETICLE_IDS.map(loadReticle));
  return results.filter((r) => r.status === 'fulfilled').map((r) => r.value);
}
