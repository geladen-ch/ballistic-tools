import { el, clear } from '../../dom.js';
import { t } from '../../i18n.js';
import { sectionGroup } from '../section.js';
import { loadCartridgeState } from '../../shot-state.js';
import { resolveGunNames } from '../../gun-names.js';
import { siToDisplay, unitChoice } from '../../units.js';
import { getUnit } from '../../prefs.js';
import { goToGuns } from '../../guns-nav.js';

// Replaces the full rifle+cartridge picker everywhere it used to be
// embedded inline (Trajectory, Hit Probability): a one-line summary of
// whatever's currently active (see shot-state.js), plus a Change button
// that opens Guns at whichever tab matches this configuration's own
// source (see guns-nav.js's goToGuns/resolveGunsDestination) — Arsenal
// if the active rifle is one of the user's own saved rifles, Custom
// otherwise (built-in library or fully manual entry). The bullet's own
// source doesn't affect this, only the rifle's.
//
// `bare: true` (Range Solver and Trajectory — see those views) skips the
// "Guns" heading and its own outer .input-section card, returning just
// the .guns-summary box itself: Range Solver's other readouts (conditions
// bar, elevation/windage, footer) are already label-free, so the boxed
// heading read as one card too many stacked above them; Trajectory drops
// it the same way once the gun pane moved to the top of Inputs.
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
    const cartridgeState = loadCartridgeState();
    const { rifleName, isArsenalRifle, loadName, libraryCartridge } = await resolveGunNames();

    clear(rifleLine);
    rifleLine.appendChild(document.createTextNode(rifleName));
    if (isArsenalRifle) rifleLine.appendChild(el('span', { class: 'src-badge', i18n: 'guns.arsenalBadge' }));

    const muzzleVelocity = libraryCartridge
      ? libraryCartridge.muzzleVelocity
      : cartridgeState && cartridgeState.muzzleVelocity != null ? cartridgeState.muzzleVelocity : null;
    if (muzzleVelocity != null) {
      const velocityUnit = getUnit('velocity');
      const velocityChoice = unitChoice('muzzleVelocity', velocityUnit);
      const displayVelocity = siToDisplay('muzzleVelocity', muzzleVelocity, velocityUnit);
      bulletLine.textContent = `${loadName} · ${displayVelocity.toFixed(velocityChoice.decimals)} ${velocityChoice.label}`;
    } else {
      bulletLine.textContent = loadName;
    }
  }

  refresh();

  return { node, refresh };
}
