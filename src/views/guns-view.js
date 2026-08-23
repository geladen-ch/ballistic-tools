import { el, clear } from '../dom.js';
import { rifleSection } from '../ui/sections/rifle-section.js';
import { cartridgeSection } from '../ui/sections/cartridge-section.js';
import { stabilityIndicator } from '../ui/stability-indicator.js';
import { setPendingBulletPrefill, setPendingRiflePrefill } from '../arsenal-prefill.js';
import { setGunsMode } from '../guns-nav.js';
import * as arsenalView from './arsenal-view.js';

// One shared view for both Guns tabs (#/guns/custom, #/guns/arsenal) —
// the same "one view module, two flat routes" pattern category-view.js
// already uses for Measurement/Analysis. Registered in app.js as
// `mount(container, 'custom')` / `mount(container, 'arsenal')`.
//
// Custom reproduces the rifle+cartridge picker that used to be embedded
// directly on Trajectory (built-in library, the user's own Arsenal
// rifles/bullets, and fully manual entry — all three already live in this
// one form). Arsenal is today's full Arsenal page, unchanged, just
// reached from here now instead of its own standalone nav entry.
//
// setGunsMode(true) here (and false on cleanup) is what tells nav-rail.js
// /nav-tabbar.js to swap their own chrome for Done + Custom/Arsenal —
// see guns-nav.js.
export function mount(container, tab) {
  clear(container);
  setGunsMode(true);

  if (tab === 'arsenal') {
    const cleanupArsenal = arsenalView.mount(container);
    return () => {
      if (typeof cleanupArsenal === 'function') cleanupArsenal();
      setGunsMode(false);
    };
  }

  // Live Miller's-formula stability readout for whatever rifle+cartridge
  // combination is currently entered — recomputed on every field change
  // from either section (including the async bullet-catalog resolution,
  // which already calls cartridgeSection's own onInput once it settles).
  const stability = stabilityIndicator();
  function refreshStability() {
    stability.update({ ...rifle.getStabilityValues(), ...cartridge.getStabilityValues() });
  }

  const cartridge = cartridgeSection({ onInput: refreshStability });
  const rifle = rifleSection({ onLibraryCartridgeChange: cartridge.setLibraryCartridge, onInput: refreshStability });
  refreshStability();

  // Stashes whatever's currently in the rifle/cartridge inputs for the
  // Arsenal "Add" form to pick up, then jumps to Guns's own Arsenal tab —
  // not #/arsenal directly, so the rail/tab bar stay in Guns mode instead
  // of dropping back to normal chrome mid-flow. Deliberately never touches
  // the Guns return path (see guns-nav.js) — this is a move *within*
  // Guns, not a fresh entry into it, so Done still has to send the user
  // back to wherever Guns was originally opened from, not back here.
  const addRifleToArsenalButton = el('button', { class: 'secondary section-button', id: 'add-rifle-to-arsenal', i18n: 'trajectory.addRifleToArsenal' });
  addRifleToArsenalButton.addEventListener('click', () => {
    setPendingRiflePrefill(rifle.getArsenalPrefill());
    location.hash = '#/guns/arsenal';
  });
  rifle.node.appendChild(addRifleToArsenalButton);

  const addBulletToArsenalButton = el('button', { class: 'secondary section-button', id: 'add-bullet-to-arsenal', i18n: 'trajectory.addBulletToArsenal' });
  addBulletToArsenalButton.addEventListener('click', () => {
    setPendingBulletPrefill(cartridge.getBulletArsenalPrefill());
    location.hash = '#/guns/arsenal';
  });
  cartridge.node.appendChild(addBulletToArsenalButton);

  container.appendChild(el('div', {}, [
    el('h1', { i18n: 'guns.customTitle' }),
    el('p', { i18n: 'guns.customIntro' }),
    el('div', { class: 'card' }, [rifle.node, cartridge.node, stability.node])
  ]));

  return () => setGunsMode(false);
}
