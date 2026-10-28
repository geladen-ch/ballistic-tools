// Manufacturer suggestions for optics — scopes and reticles — kept apart
// from manufacturer-field.js's bullet makers: every manufacturer of a
// built-in scope or reticle, plus every one already used for the user's
// own scopes and reticles. Built-ins first, so their spelling wins on a
// case-insensitive collision, as for bullets; sorted alphabetically.
import { loadBuiltInScopes } from '../../scopes.js';
import { loadBuiltInReticles } from '../../reticles.js';
import { loadUserScopes } from '../../user-library.js';
import { loadUserReticles } from '../../reticle-library.js';
import { suggestInput } from './manufacturer-field.js';

export async function knownOpticsManufacturers() {
  const [scopes, reticles] = await Promise.all([
    loadBuiltInScopes().catch(() => []),
    loadBuiltInReticles().catch(() => [])
  ]);
  const seen = new Map(); // lowercased -> display casing
  for (const record of [...scopes, ...reticles, ...loadUserScopes(), ...loadUserReticles()]) {
    const name = (record.manufacturer || '').trim();
    if (name && !seen.has(name.toLowerCase())) seen.set(name.toLowerCase(), name);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

// A manufacturer input suggesting optics makers — see suggestInput().
export function opticsManufacturerInput({ id, value = '', onPick } = {}) {
  return suggestInput({ id, value, loadSuggestions: knownOpticsManufacturers, onPick });
}
