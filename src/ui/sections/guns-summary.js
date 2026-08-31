import { el, clear } from '../../dom.js';
import { t } from '../../i18n.js';
import { sectionGroup } from '../section.js';
import { loadRifleState, loadCartridgeState } from '../../shot-state.js';
import { loadUserRifles, loadUserBullets } from '../../user-library.js';
import { loadRifle } from '../../rifles.js';
import { loadBullet } from '../../bullets.js';
import { engineToDisplay, unitChoice } from '../../units.js';
import { getUnit } from '../../prefs.js';
import { goToGuns } from '../../guns-nav.js';

// Matches bullet-section.js's own private "no library bullet picked"
// sentinel (its local OTHER_VALUE) — not exported there since it's only
// ever compared against its own <select>'s value, but the string it
// writes into shot-state.js's cartridgeState.bullet.selectedId is a
// stable, de-facto part of that state's shape.
const BULLET_OTHER = '__other__';

// Replaces the full rifle+cartridge picker everywhere it used to be
// embedded inline (Trajectory, Hit Probability): a one-line summary of
// whatever's currently active (see shot-state.js), plus a Change button
// that opens Guns at whichever tab matches this configuration's own
// source (see guns-nav.js's goToGuns/resolveGunsDestination) — Arsenal
// if the active rifle is one of the user's own saved rifles, Custom
// otherwise (built-in library or fully manual entry). The bullet's own
// source doesn't affect this, only the rifle's.
//
// `bare: true` (Range Solver only — see that view) skips the "Guns"
// heading and its own outer .input-section card, returning just the
// .guns-summary box itself: that pane's other readouts (conditions bar,
// elevation/windage, footer) are already label-free, so the boxed
// heading read as one card too many stacked above them.
export function gunsSummary({ bare = false } = {}) {
  const rifleLine = el('div', { class: 'rifle-line' });
  const bulletLine = el('div', { class: 'bullet-line' });
  const changeButton = el('button', { class: 'secondary', i18n: 'guns.changeButton' });

  changeButton.addEventListener('click', goToGuns);

  const summary = el('div', { class: 'guns-summary' }, [
    el('div', { class: 'lines' }, [rifleLine, bulletLine]),
    changeButton
  ]);
  const node = bare ? summary : sectionGroup('sections.gunsHeading', [summary]);

  async function refresh() {
    const rifleState = loadRifleState();
    const cartridgeState = loadCartridgeState();

    let rifleName = t('guns.customRifleLabel');
    let isArsenalRifle = false;
    // The rifle's own cartridge record, when a library rifle+cartridge is
    // active — the authoritative source for that cartridge's bullet/
    // velocity, not cartridgeState below. cartridge-section.js's
    // setLibraryCartridge() only ever pre-fills and disables its *fields*
    // to match this same record (see its own comment); it deliberately
    // never persists them into shot-state.js's cartridgeState, since a
    // freshly mounted rifleSection()+cartridgeSection() pair always
    // re-derives them straight from rifleState.library + this record
    // instead. This summary has no such pair of its own, so it must
    // re-derive the same way, rather than trusting cartridgeState — which
    // is otherwise still whatever a *previous* custom/manual selection
    // last wrote there.
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
          // built-in catalog unavailable (offline, etc.) — keep the generic label
        }
      }
      if (rifle) libraryCartridge = rifle.cartridges.find((c) => c.id === cartridgeId) || null;
    }

    let bulletName = t('guns.customBulletLabel');
    const bulletId = libraryCartridge
      ? libraryCartridge.bulletId
      : cartridgeState && cartridgeState.bullet && cartridgeState.bullet.selectedId;
    if (bulletId && bulletId !== BULLET_OTHER) {
      const userBullet = loadUserBullets().find((b) => b.id === bulletId);
      if (userBullet) {
        bulletName = userBullet.name;
      } else {
        try {
          const bullet = await loadBullet(bulletId);
          bulletName = bullet.name;
        } catch {
          // built-in catalog unavailable — keep the generic label
        }
      }
    }

    clear(rifleLine);
    rifleLine.appendChild(document.createTextNode(rifleName));
    if (isArsenalRifle) rifleLine.appendChild(el('span', { class: 'src-badge', i18n: 'guns.arsenalBadge' }));

    const muzzleVelocity = libraryCartridge
      ? libraryCartridge.muzzleVelocity
      : cartridgeState && cartridgeState.muzzleVelocity != null ? cartridgeState.muzzleVelocity : null;
    if (muzzleVelocity != null) {
      const velocityUnit = getUnit('velocity');
      const velocityChoice = unitChoice('muzzleVelocity', velocityUnit);
      const displayVelocity = engineToDisplay('muzzleVelocity', muzzleVelocity, velocityUnit);
      bulletLine.textContent = `${bulletName} · ${displayVelocity.toFixed(velocityChoice.decimals)} ${velocityChoice.label}`;
    } else {
      bulletLine.textContent = bulletName;
    }
  }

  refresh();

  return { node, refresh };
}
