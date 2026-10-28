// Fetches for the built-in scope library, the same way rifles.js does for
// rifles: the catalog is a plain id list (scopes/scope-catalog.js), and
// each scope's record is fetched and cached in-memory per id, once per
// browser tab. A built-in scope is linked to by its id, never copied into
// the Arsenal; built-in ids are told apart from Arsenal ones by being in
// the catalog.
import { SCOPE_IDS } from './scopes/scope-catalog.js';
import { logDiagnostic } from './debug-log.js';
import { decodeScope } from './scope-record.js';

const scopePromises = new Map();
const BUILT_IN_IDS = new Set(SCOPE_IDS);

export function loadScopeCatalog() {
  return SCOPE_IDS;
}

export function isBuiltInScopeId(id) {
  return BUILT_IN_IDS.has(id);
}

export function loadScope(id) {
  if (!scopePromises.has(id)) {
    const url = new URL(`./scopes/${id}.json`, import.meta.url);
    scopePromises.set(id, fetch(url).then((res) => {
      if (!res.ok) throw new Error(`failed to load scope "${id}": ${res.status}`);
      return res.json();
    }).then(decodeScope).catch((err) => {
      // See rifles.js: a transient failure mustn't poison every later try.
      scopePromises.delete(id);
      logDiagnostic('warn', `[scopes] failed to load "${id}":`, err);
      throw err;
    }));
  }
  return scopePromises.get(id);
}

// Every built-in scope that loads, in catalog order; one that fails is
// left out (and logged by loadScope()).
export async function loadBuiltInScopes() {
  const results = await Promise.allSettled(SCOPE_IDS.map(loadScope));
  return results.filter((r) => r.status === 'fulfilled').map((r) => r.value);
}
