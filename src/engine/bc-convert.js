// Converts a ballistic coefficient from one standard drag model to another
// at a single reference velocity. The projectile experiences the same
// physical drag regardless of which reference curve its BC happens to be
// quoted against, so at a given Mach number:
//
//   BC_target = BC_source * Cd_target(Mach) / Cd_source(Mach)
//
// This is only exact at the Mach number it's computed for — G1 and G7 (and
// every other pair) have differently-shaped curves across Mach, so a
// converted value drifts the further the bullet's actual velocity band is
// from the reference velocity used here. Mach is computed against a fixed
// standard sea-level atmosphere (15°C): this is a single-point conversion
// between two idealized reference curves, not a real trajectory, so it
// doesn't need — and shouldn't ask for — a real local atmosphere.
import { DRAG_TABLES, makeCdLookup } from './drag-tables.js';
import { speedOfSound, standardAtmosphereAt } from './atmosphere.js';

const STANDARD_SEA_LEVEL_SOUND_MS = speedOfSound(standardAtmosphereAt(0).tempC);

export function convertBallisticCoefficient({ bc, sourceModel, targetModel, velocityMs }) {
  if (sourceModel === targetModel) return bc;
  const mach = velocityMs / STANDARD_SEA_LEVEL_SOUND_MS;
  const cdSource = makeCdLookup(DRAG_TABLES[sourceModel])(mach);
  const cdTarget = makeCdLookup(DRAG_TABLES[targetModel])(mach);
  return (bc * cdTarget) / cdSource;
}
