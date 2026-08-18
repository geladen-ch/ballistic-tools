import { el } from '../../dom.js';
import { unitField } from '../unit-field.js';
import { muzzleVelocityTempField } from '../muzzle-velocity-temp-field.js';
import { bulletSection } from './bullet-section.js';
import { sectionGroup } from '../section.js';
import { loadCartridgeState, saveCartridgeState } from '../../shot-state.js';

// The loaded cartridge: muzzle velocity (with its optional
// temperature-dependence refinement) plus the bullet it's built around.
export function cartridgeSection({ slider = false, onInput } = {}) {
  const saved = loadCartridgeState();
  // 786.4 m/s is GP11's own catalog muzzle velocity (780 m/s, referenced
  // at 7°C) restated at this section's own 15°C default reference temp:
  // 780 + 0.8 * (15 - 7) = 786.4 — consistent with the temperature
  // correction seeded just below, not an arbitrary round number.
  const initialVelocity = saved && saved.muzzleVelocity != null ? saved.muzzleVelocity : 786.4;

  // Only reflects manual muzzle-velocity/temperature entry — while a
  // rifle-library cartridge governs these fields (see setLibraryCartridge
  // below) they're disabled, so this never fires from that path; the
  // rifle section's own shared state is what restores a locked cartridge.
  function saveManualCartridge() {
    saveCartridgeState({
      muzzleVelocity: muzzleVelocityField.getEngineValue(),
      // Explicit undefined (not omitted) clears a stale temperature
      // dependency from a previous save when the checkbox is unchecked —
      // saveCartridgeState() merges shallowly, so an *absent* key would
      // otherwise leave yesterday's referenceTempC/velocityTempSensitivity
      // in place even after the user turns the correction off.
      referenceTempC: undefined,
      velocityTempSensitivity: undefined,
      ...muzzleVelocityTemp.getValues()
    });
  }

  const muzzleVelocityField = unitField({
    id: 'muzzleVelocity', min: 200, max: 1200, step: 1, value: initialVelocity, slider,
    onInput: () => { saveManualCartridge(); if (onInput) onInput(); }
  });
  const muzzleVelocityTemp = muzzleVelocityTempField({
    onInput: () => { saveManualCartridge(); if (onInput) onInput(); }
  });
  if (saved && saved.referenceTempC != null) {
    muzzleVelocityTemp.setInitialValues({
      referenceTempC: saved.referenceTempC,
      velocityTempSensitivity: saved.velocityTempSensitivity
    });
  } else if (!saved) {
    // Fresh install (nothing saved at all yet, as opposed to a previous
    // save that had this correction turned off) — seed with GP11's own
    // temperature sensitivity so the checkbox starts checked/expanded,
    // matching the muzzle velocity default above. A `saved` object that
    // simply lacks referenceTempC (the user unchecked it before) must
    // NOT hit this branch, or unchecking it would never stick.
    muzzleVelocityTemp.setInitialValues({ referenceTempC: 15, velocityTempSensitivity: 0.8 });
  }
  const bullet = bulletSection({ slider, onInput });

  // Shown only while a rifle library cartridge selection governs this
  // whole section — see setLibraryCartridge() below.
  const lockedHint = el('p', { class: 'hint', i18n: 'fields.cartridgeLockedHint' });
  lockedHint.style.display = 'none';

  const node = sectionGroup('sections.cartridgeHeading', [
    lockedHint,
    muzzleVelocityField.node,
    muzzleVelocityTemp.node,
    bullet.node
  ]);

  function getValues() {
    return {
      muzzleVelocity: muzzleVelocityField.getEngineValue(),
      ...muzzleVelocityTemp.getValues(),
      ...bullet.getValues()
    };
  }

  // Driven by a rifle library's cartridge picker (see rifle-section.js):
  // `cartridge` is { muzzleVelocity, referenceTempC?, velocityTempSensitivity?,
  // bulletId } to lock onto, or null to release back to manual entry.
  // Every value here still flows through the same fields getValues()
  // already reads — locking just pre-fills them and disables editing —
  // so getValues() itself needs no special case for the locked state.
  async function setLibraryCartridge(cartridge) {
    if (cartridge) {
      muzzleVelocityField.setEngineValue(cartridge.muzzleVelocity);
      muzzleVelocityField.setDisabled(true);
      muzzleVelocityTemp.lock(
        cartridge.referenceTempC != null
          ? { referenceTempC: cartridge.referenceTempC, velocityTempSensitivity: cartridge.velocityTempSensitivity }
          : null
      );
      lockedHint.style.display = '';
      await bullet.lockToBullet(cartridge.bulletId);
    } else {
      muzzleVelocityField.setDisabled(false);
      muzzleVelocityTemp.unlock();
      lockedHint.style.display = 'none';
      bullet.unlock();
    }
    if (onInput) onInput();
  }

  // For stability.js's Miller's-formula indicator — this cartridge's own
  // velocity plus whatever the nested bullet section can report about its
  // physical dimensions (see bullet-section.js's getStabilityValues()).
  function getStabilityValues() {
    return { muzzleVelocity: muzzleVelocityField.getEngineValue(), ...bullet.getStabilityValues() };
  }

  return { node, getValues, setLibraryCartridge, getBulletArsenalPrefill: bullet.getArsenalPrefill, getStabilityValues };
}
