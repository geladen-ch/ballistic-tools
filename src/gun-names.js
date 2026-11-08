// The names of the active gun configuration (shot-state.js), as people
// know them: the rifle's, the cartridge's (a library rifle's cartridge
// record, else the bullet standing in for it), and the bullet's own.
// Shared by the guns summary and the Printable card.
//
// A library rifle's own cartridge record is the authoritative source for
// that cartridge's bullet and velocity, not cartridgeState:
// cartridge-section.js's setLibraryCartridge() only pre-fills and disables
// its fields to match the record and never persists them, so
// cartridgeState may still hold a previous custom selection. The names are
// re-derived from rifleState.library + the record instead.
import { t } from './i18n.js';
import { loadRifleState, loadCartridgeState } from './shot-state.js';
import { loadUserRifles, loadUserBullets } from './user-library.js';
import { loadRifle } from './rifles.js';
import { loadBullet } from './bullets.js';

// Matches bullet-section.js's own private "no library bullet picked"
// sentinel (its local OTHER_VALUE): the string it writes into
// shot-state.js's cartridgeState.bullet.selectedId.
const BULLET_OTHER = '__other__';

async function findBullet(bulletId) {
  if (!bulletId || bulletId === BULLET_OTHER) return null;
  const userBullet = loadUserBullets().find((b) => b.id === bulletId);
  if (userBullet) return userBullet;
  try {
    return await loadBullet(bulletId);
  } catch {
    return null; // built-in catalog unavailable (offline, etc.)
  }
}

// { rifleName, isArsenalRifle, loadName, bulletName, libraryCartridge }.
// Generic labels stand in for what has no name (manual entry, a catalog
// that can't be read); bulletName is null for a manual bullet.
export async function resolveGunNames() {
  const rifleState = loadRifleState();
  const cartridgeState = loadCartridgeState();

  let rifleName = t('guns.customRifleLabel');
  let isArsenalRifle = false;
  let libraryCartridge = null;
  if (rifleState && rifleState.library) {
    const { rifleId, cartridgeId } = rifleState.library;
    const userRifle = loadUserRifles().find((r) => r.id === rifleId);
    let rifle = userRifle;
    if (userRifle) {
      rifleName = userRifle.name;
      isArsenalRifle = true;
    } else {
      try {
        rifle = await loadRifle(rifleId);
        rifleName = rifle.name;
      } catch {
        // built-in catalog unavailable — keep the generic label
      }
    }
    if (rifle) libraryCartridge = rifle.cartridges.find((c) => c.id === cartridgeId) || null;
  }

  const bulletId = libraryCartridge
    ? libraryCartridge.bulletId
    : cartridgeState && cartridgeState.bullet && cartridgeState.bullet.selectedId;
  const bullet = await findBullet(bulletId);
  const bulletName = bullet ? bullet.name : null;
  // The cartridge's name (e.g. "174gr GP11"); a custom/manual load has no
  // cartridge record, so the bullet's own name (or the generic label)
  // stands in for it.
  const loadName = libraryCartridge && libraryCartridge.name
    ? libraryCartridge.name
    : bulletName ?? t('guns.customBulletLabel');

  return { rifleName, isArsenalRifle, loadName, bulletName, libraryCartridge };
}
