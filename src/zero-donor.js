// "Zeroed with a different cartridge" (see docs/plans/arsenal-zero-with-
// different-cartridge.md): a cartridge can point at a sibling on the same
// rifle (cartridge.zeroedWithCartridgeId) whose ballistics should govern
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
  return { bc: bullet.profile.bc, dragModel: bullet.profile.model, massKg: bullet.massKg, caliberM: bullet.caliberM };
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
    ...bulletProfileValues(bullet)
  };
}
