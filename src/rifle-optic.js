// A rifle's scope and reticle, resolved from its `scopeId`/`reticleId`
// across the Arsenal and the built-in libraries — what the Range
// Solver's scope view draws. The reticle is the rifle's own when its
// scope lists it, otherwise the first of the scope's reticles that loads.
// Anything missing, damaged or invalid resolves to null, never an error.
import { loadUserScopes } from './user-library.js';
import { getUserReticle } from './reticle-library.js';
import { isBuiltInScopeId, loadScope } from './scopes.js';
import { isBuiltInReticleId, loadReticle } from './reticles.js';
import { validateScopeRecord, isUsableScope } from './scope-record.js';

async function findScope(id) {
  const user = loadUserScopes().find((scope) => scope.id === id);
  if (user) return user;
  if (!isBuiltInScopeId(id)) return null;
  try {
    return await loadScope(id);
  } catch {
    return null;
  }
}

async function findReticle(id) {
  const user = getUserReticle(id);
  if (user) return user.damaged ? null : user;
  if (!isBuiltInReticleId(id)) return null;
  try {
    return await loadReticle(id);
  } catch {
    return null;
  }
}

export async function resolveRifleOptic(rifle) {
  if (!rifle || typeof rifle.scopeId !== 'string' || !rifle.scopeId) return null;
  const scope = await findScope(rifle.scopeId);
  if (!scope || !isUsableScope(scope) || Object.keys(validateScopeRecord(scope)).length > 0) return null;
  const ids = scope.reticleIds.includes(rifle.reticleId)
    ? [rifle.reticleId, ...scope.reticleIds.filter((id) => id !== rifle.reticleId)]
    : scope.reticleIds;
  for (const id of ids) {
    const reticle = await findReticle(id);
    if (reticle) return { scope, reticle };
  }
  return null;
}

// What a resolution depends on, to tell whether a new rifle needs one.
export function rifleOpticKey(rifle) {
  return rifle && rifle.scopeId ? `${rifle.id}|${rifle.scopeId}|${rifle.reticleId || ''}` : '';
}
