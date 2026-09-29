// "Zeroed with a different cartridge": a cartridge can point at a sibling
// on the same rifle (cartridge.zeroedWithCartridgeId) whose ballistics
// should govern
// the *vertical* zero-angle solve instead of its own — see trajectory.js's
// resolveLaunchAngle(). This module resolves that sibling's id into the
// actual ballistic-profile fields a caller's engine state needs to override
// with, given the full rifle record.
import { loadUserBullets } from './user-library.js';
import { loadBullet } from './bullets.js';

// Same two-step lookup arsenal-view.js's own resolveComparisonBullet() and
// bullet-section.js's own findKnownBullet() each already do independently
// (user library first, since it's free; the built-in catalog fetch only as
// a fallback) — a third copy here rather than forcing a refactor of either
// of those two working, differently-shaped call sites.
async function resolveBullet(bulletId) {
  const userBullet = loadUserBullets().find((b) => b.id === bulletId);
  if (userBullet) return userBullet;
  try {
    return await loadBullet(bulletId);
  } catch {
    return null;
  }
}

// Mirrors arsenal-view.js's own bulletProfileValues() — the engine only
// ever needs one of these two shapes, never both at once.
function bulletProfileValues(bullet) {
  if (bullet.profile.type === 'cdTable') {
    return { cdTable: bullet.profile.table, massKg: bullet.massKg, caliberM: bullet.caliberM };
  }
  // cdTable: null so a Cd-table recipient's own table can't survive the
  // { ...state, ...donor } merge in resolveLaunchAngle() and silently win
  // over this BC donor's profile (makeStepper() prefers any cdTable).
  return { cdTable: null, bc: bullet.profile.bc, dragModel: bullet.profile.model, massKg: bullet.massKg, caliberM: bullet.caliberM };
}

// `null` whenever there's nothing to resolve (no donor set, the referenced
// sibling no longer exists — e.g. stale data — or its bullet can't be
// found), never throws: a missing donor should silently fall back to "no
// override" rather than break the recipient's own trajectory.
export async function resolveZeroDonorBallistics(rifle, cartridge) {
  if (!cartridge || !cartridge.zeroedWithCartridgeId) return null;
  const donor = rifle.cartridges.find((c) => c.id === cartridge.zeroedWithCartridgeId);
  if (!donor) return null;
  const bullet = await resolveBullet(donor.bulletId);
  if (!bullet) return null;
  return {
    muzzleVelocity: donor.muzzleVelocity,
    referenceTempC: donor.referenceTempC,
    velocityTempSensitivity: donor.velocityTempSensitivity,
    // The donor's own trued drag, not the recipient's -- otherwise the
    // recipient's bcGainFactor (and every dragPct perturbation the Truing
    // Session applies to it) would leak into the borrowed zero solve.
    bcGainFactor: donor.bcGainFactor ?? 1,
    // The air the donor's zero was set in (null when it names none): the
    // borrowed zero is solved there too, not in the recipient's own air.
    // Always present, so a stale value can't survive the { ...state, ...donor }
    // merge in resolveLaunchAngle().
    zeroAtmosphere: donor.zeroAtmosphere ?? null,
    ...bulletProfileValues(bullet)
  };
}
