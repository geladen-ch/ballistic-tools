import { el, clear } from '../../dom.js';
import { FIELD_BOUNDS } from '../../units.js';
import { unitField } from '../unit-field.js';
import { scopeClicksField } from '../scope-clicks-field.js';
import { sectionGroup } from '../section.js';
import { isRifleLibraryEnabled, setRifleLibraryEnabled } from '../../library-prefs.js';
import { loadRifleCatalog, loadRifle } from '../../rifles.js';
import { loadUserRifles } from '../../user-library.js';
import { loadRifleState, saveRifleState } from '../../shot-state.js';
import { i18nSpan } from '../../i18n.js';

const OTHER_VALUE = '__other__';
// Sight height/twist match the built-in K31 entry's own specs — the same
// rifle a fresh install's rifle/cartridge/bullet defaults are drawn from
// throughout this section, cartridge-section.js and bullet-section.js
// (zeroRange/clicks/twistDirection already matched K31 before this).
const DEFAULT_STATE = {
  zeroRange: 100, sightHeight: 70, riflingTwist: 250, twistDirection: 'right',
  clicks: { unit: 'mrad', horizontal: 0.1, vertical: 0.1 }, library: null
};

function currentUserRifles() {
  return loadUserRifles().map((r) => ({ ...r, isUser: true }));
}

// The rifle itself, as far as the point-mass model cares: where the sight
// sits above the bore, and the range it's zeroed at — plus the scope's
// click values, which aren't used by the engine at all but are needed to
// turn a computed drop/windage into "how many clicks do I dial."
// getValues() returns only the engine-relevant pair; scope click settings
// are exposed separately via getClickSettings() since callers that don't
// render a per-range output table (e.g. Hit Probability) have no use for
// them.
//
// A "Show built-in rifles library" checkbox is always shown (duplicated
// in every place a rifle input is expected — this section, wherever it's
// nested — the same as the matching bullet one; see bullet-section.js).
// The picker itself only appears below it when there's actually something
// to pick from — the built-in library switched on, and/or the user's own
// Arsenal rifles (always available regardless of that setting, which only
// ever governs the *built-in* library's visibility). Picking a rifle
// pre-fills zeroRange/sightHeight/click settings (still freely editable
// afterward — only the *name* is rifle-specific, everything else here is
// a session starting point) and reveals a second picker for that rifle's
// own cartridges. A cartridge choice is reported upward via
// `onLibraryCartridgeChange` — the muzzle velocity and bullet it implies
// live in the Cartridge section, a sibling this one has no direct access
// to, so the caller (the view) is the one that wires the two together;
// see cartridge-section.js's setLibraryCartridge().
export function rifleSection({ slider = false, onInput, onLibraryCartridgeChange } = {}) {
  const saved = loadRifleState();
  const initial = {
    ...DEFAULT_STATE,
    ...saved,
    clicks: { ...DEFAULT_STATE.clicks, ...(saved && saved.clicks) }
  };

  // Every field below is still freely editable regardless of whether a
  // library rifle governs the session's starting point, so this always
  // reflects the fields' current values — the same shape a fresh
  // rifleSection in the other view reads back as its own `initial`.
  function saveManualRifle() {
    saveRifleState({
      zeroRange: zeroRangeField.getEngineValue(),
      sightHeight: sightHeightField.getEngineValue(),
      riflingTwist: twistField.getEngineValue(),
      twistDirection: twistDirectionSelect.value,
      clicks: clicks.getSettings()
    });
  }

  // 0 is a valid, meaningful value here — see resolveMuzzleVelocity's
  // sibling solveZeroAngle() in trajectory.js: a zero range of 0 means
  // "no elevation correction," not an error, so the field must actually
  // allow it rather than hinting a 25m floor.
  const zeroRangeField = unitField({
    id: 'zeroRange', ...FIELD_BOUNDS.zeroRange, step: 5, value: initial.zeroRange, slider,
    onInput: () => { saveManualRifle(); if (onInput) onInput(); }
  });
  const sightHeightField = unitField({
    id: 'sightHeight', ...FIELD_BOUNDS.sightHeight, step: 1, value: initial.sightHeight, slider,
    onInput: () => { saveManualRifle(); if (onInput) onInput(); }
  });
  // Not currently read by getValues() — no ballistic factor this app
  // models yet uses twist (see rifling-twist hint text) — but still a
  // real, persisted rifle parameter carried through the same way
  // zeroRange/sightHeight are, and included in getArsenalPrefill() below.
  const twistField = unitField({
    id: 'riflingTwist', ...FIELD_BOUNDS.riflingTwist, step: 1, optional: true, value: initial.riflingTwist,
    onInput: () => { saveManualRifle(); if (onInput) onInput(); }
  });
  // A plain enum, not a unit-bearing quantity — always has a real value
  // (defaulting to "right"), no blank state the way twist rate has.
  const twistDirectionSelect = el('select', { id: 'twistDirection' }, [
    el('option', { value: 'right', i18n: 'fields.twistDirectionRight' }),
    el('option', { value: 'left', i18n: 'fields.twistDirectionLeft' })
  ]);
  twistDirectionSelect.value = initial.twistDirection;
  twistDirectionSelect.addEventListener('change', () => { saveManualRifle(); if (onInput) onInput(); });
  const clicks = scopeClicksField({ onInput: () => { saveManualRifle(); if (onInput) onInput(); } });
  clicks.setSettings(initial.clicks);

  let selectedRifle = null; // full record (built-in or user), or null when "Other"

  const rifleSelect = el('select', { id: 'rifleSelect' });
  const riflePickerField = el('div', { class: 'field' }, [el('label', { i18n: 'fields.riflePicker' }), rifleSelect]);
  const cartridgeSelect = el('select', { id: 'rifleCartridgeSelect' });
  const cartridgeField = el('div', { class: 'field' }, [
    el('label', { i18n: 'fields.rifleCartridgePicker' }),
    cartridgeSelect
  ]);
  cartridgeField.style.display = 'none';

  // Always visible — even when there's currently nothing to pick from —
  // so the user can turn the built-in library back on without a trip to
  // Settings. Cookie-backed (library-prefs.js) and read fresh at every
  // mount; toggling it also rebuilds this section's own picker live.
  const rifleLibraryCheckbox = el('input', { type: 'checkbox', id: 'rifleLibraryEnabled' });
  rifleLibraryCheckbox.checked = isRifleLibraryEnabled();
  rifleLibraryCheckbox.addEventListener('change', () => {
    setRifleLibraryEnabled(rifleLibraryCheckbox.checked);
    rebuildRifleOptions();
    if (onInput) onInput();
  });
  const rifleLibraryRow = el('label', { class: 'checkbox-field' }, [rifleLibraryCheckbox, i18nSpan('settings.rifleLibraryLabel')]);

  function updatePickerVisibility() {
    const hasAnythingToOffer = isRifleLibraryEnabled() || currentUserRifles().length > 0;
    riflePickerField.style.display = hasAnythingToOffer ? '' : 'none';
  }

  function saveLibrarySelection() {
    saveRifleState({
      library: selectedRifle ? { rifleId: selectedRifle.id, cartridgeId: cartridgeSelect.value } : null
    });
  }

  function applySelectedCartridge() {
    const cartridge = selectedRifle && selectedRifle.cartridges.find((c) => c.id === cartridgeSelect.value);
    if (onLibraryCartridgeChange) {
      onLibraryCartridgeChange(cartridge ? {
        muzzleVelocity: cartridge.muzzleVelocity,
        referenceTempC: cartridge.referenceTempC,
        velocityTempSensitivity: cartridge.velocityTempSensitivity,
        bulletId: cartridge.bulletId
      } : null);
    }
  }

  // A rifleSelect value can name either a built-in rifle (needs a fetch,
  // already cached — see builtInRifles below) or a user Arsenal one
  // (already in memory, from localStorage) — check the user list first
  // since it's free, only falling back to the built-in cache for
  // anything left.
  function resolveRifle(id) {
    const userMatch = currentUserRifles().find((r) => r.id === id);
    if (userMatch) return userMatch;
    return builtInRifles.find((r) => r.id === id) || null;
  }

  // `preferredCartridgeId` is only used when restoring a previous
  // session's choice (see the catalog-load restoration below) — a plain
  // user selection always falls back to the rifle's first cartridge,
  // same as before.
  function applySelectedRifle(preferredCartridgeId) {
    const id = rifleSelect.value;
    if (id === OTHER_VALUE) {
      selectedRifle = null;
      cartridgeField.style.display = 'none';
      if (onLibraryCartridgeChange) onLibraryCartridgeChange(null);
      saveLibrarySelection();
      if (onInput) onInput();
      return;
    }
    const rifle = resolveRifle(id);
    if (!rifle) return; // not resolvable yet (shouldn't happen once catalogReady has settled) — nothing to apply
    selectedRifle = rifle;
    zeroRangeField.setEngineValue(rifle.defaultZeroRangeM);
    sightHeightField.setEngineValue(rifle.defaultSightHeightM * 1000); // stored in m; sightHeight's engine unit is mm
    twistField.setEngineValue(rifle.defaultRiflingTwistM != null ? rifle.defaultRiflingTwistM * 1000 : null);
    twistDirectionSelect.value = rifle.defaultTwistDirection || 'right'; // older/built-in records predating this field default to "right"
    clicks.setSettings({
      unit: rifle.defaultClickUnit,
      horizontal: rifle.defaultClickHorizontal,
      vertical: rifle.defaultClickVertical
    });
    saveManualRifle(); // the rifle's defaults become the new shared session baseline too

    clear(cartridgeSelect);
    for (const c of rifle.cartridges) cartridgeSelect.appendChild(el('option', { value: c.id, text: c.name }));
    const preferred = preferredCartridgeId && rifle.cartridges.some((c) => c.id === preferredCartridgeId)
      ? preferredCartridgeId
      : (rifle.cartridges[0] ? rifle.cartridges[0].id : '');
    cartridgeSelect.value = preferred;
    cartridgeField.style.display = '';

    applySelectedCartridge();
    saveLibrarySelection();
    if (onInput) onInput();
  }

  // Cached once (a network fetch, always kicked off regardless of the
  // toggle — see catalogReady below) so toggling "Show built-in rifles
  // library" back on doesn't need a second fetch, and so a session
  // restoration (see catalogReady's .then()) can still resolve a
  // previously-selected built-in rifle even if the toggle is currently off.
  let builtInRifles = [];

  function rebuildRifleOptions() {
    const includeBuiltIn = isRifleLibraryEnabled();
    const rifles = [...(includeBuiltIn ? builtInRifles : []), ...currentUserRifles()];
    const previousValue = rifleSelect.value || OTHER_VALUE;

    clear(rifleSelect);
    rifleSelect.appendChild(el('option', { value: OTHER_VALUE, i18n: 'fields.rifleOther' }));
    for (const r of rifles) {
      rifleSelect.appendChild(el('option', { value: r.id, text: (r.isUser ? '* ' : '') + r.name }));
    }

    const stillOffered = previousValue === OTHER_VALUE || rifles.some((r) => r.id === previousValue);
    rifleSelect.value = stillOffered ? previousValue : OTHER_VALUE;
    if (!stillOffered) applySelectedRifle(); // the previously selected rifle just got hidden (built-in library switched off) — fall back to Other
    updatePickerVisibility();
  }
  rebuildRifleOptions(); // user rifles (synchronous — localStorage) show immediately; built-ins join once the fetch below resolves

  rifleSelect.addEventListener('change', () => applySelectedRifle());
  cartridgeSelect.addEventListener('change', () => { applySelectedCartridge(); saveLibrarySelection(); });

  // allSettled, not all: one rifle id failing to load must not blank out
  // the other 7 that loaded fine — same reasoning as bulletSection's own
  // catalog load.
  Promise.allSettled(loadRifleCatalog().map((id) => loadRifle(id)))
    .then((results) => {
      const total = results.length;
      const failedCount = results.filter((r) => r.status === 'rejected').length;
      console[failedCount ? 'warn' : 'log'](
        `[catalog:rifles] ${total - failedCount}/${total} built-in rifles loaded${failedCount ? ` (${failedCount} failed)` : ''}`
      );
      builtInRifles = results.filter((r) => r.status === 'fulfilled').map((r) => r.value);
      rebuildRifleOptions();
      // Restore a rifle+cartridge a previous view's session left
      // selected (built-in or user). Left fully interactive — this is a
      // session starting point, same spirit as bulletSection's own
      // library restoration.
      const restorable = initial.library && [...builtInRifles, ...currentUserRifles()].some((r) => r.id === initial.library.rifleId);
      if (restorable) {
        rifleSelect.value = initial.library.rifleId;
        applySelectedRifle(initial.library.cartridgeId);
      }
    });

  const node = sectionGroup('sections.rifleHeading', [
    rifleLibraryRow,
    riflePickerField,
    cartridgeField,
    zeroRangeField.node,
    sightHeightField.node,
    twistField.node,
    el('p', { class: 'hint', i18n: 'arsenal.riflingTwistHint' }),
    el('div', { class: 'field' }, [el('label', { i18n: 'fields.twistDirection' }), twistDirectionSelect]),
    clicks.node
  ]);

  function getValues() {
    return {
      zeroRange: zeroRangeField.getEngineValue(),
      sightHeight: sightHeightField.getEngineValue()
    };
  }

  // For "Add to arsenal" (see trajectory-view.js), shaped for
  // rifle-form.js's initialValues — a selected library rifle contributes
  // its name (letting the user save an edited copy under a new one);
  // sight height/zero/clicks are always available since they're plain
  // editable fields regardless of selection.
  function getArsenalPrefill() {
    const clickSettings = clicks.getSettings();
    const twistMm = twistField.getEngineValue();
    return {
      name: selectedRifle ? selectedRifle.name : '',
      defaultSightHeightM: sightHeightField.getEngineValue() / 1000,
      defaultZeroRangeM: zeroRangeField.getEngineValue(),
      defaultRiflingTwistM: twistMm != null ? twistMm / 1000 : null,
      defaultTwistDirection: twistDirectionSelect.value,
      defaultClickUnit: clickSettings.unit,
      defaultClickHorizontal: clickSettings.horizontal,
      defaultClickVertical: clickSettings.vertical
    };
  }

  // For stability.js's Miller's-formula indicator and spin-drift.js's own
  // resolveSpinDrift() — the two consumers of rifling twist so far (see
  // the hint text just above). riflingTwistMm is null when the optional
  // field is left blank, same as twistField.getEngineValue() itself
  // already reports; twistDirection always has a real value ('right' by
  // default), so unlike the twist rate it's never the reason stability/
  // spin drift can't be computed.
  function getStabilityValues() {
    return { riflingTwistMm: twistField.getEngineValue(), twistDirection: twistDirectionSelect.value };
  }

  return { node, getValues, getClickSettings: clicks.getSettings, getArsenalPrefill, getStabilityValues };
}
