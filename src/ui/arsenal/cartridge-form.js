import { el, clear } from '../../dom.js';
import { unitField } from '../unit-field.js';
import { muzzleVelocityTempField } from '../muzzle-velocity-temp-field.js';
import { stabilityIndicator } from '../stability-indicator.js';
import { bulletForm } from './bullet-form.js';
import { loadBulletCatalog, loadBullet, loadCaliberDesignations, designationFor } from '../../bullets.js';
import { loadUserBullets, saveUserBullet, findUserBulletByName, generateUserId } from '../../user-library.js';
import { isBulletLibraryEnabled } from '../../library-prefs.js';
import { t } from '../../i18n.js';
import { FIELD_BOUNDS } from '../../units.js';
import { fieldValidity } from '../field-validity.js';

const DEFAULT_VALUES = { name: '', muzzleVelocity: 800, referenceTempC: null, velocityTempSensitivity: null, bulletId: '' };
const ALL_CALIBERS_VALUE = '__all__';
const NEW_BULLET_VALUE = '__new__';

// Add/Edit form for one cartridge within a user rifle. The bullet picker
// draws from both the built-in catalog (unless hidden — see
// library-prefs.js's isBulletLibraryEnabled(), the same toggle that gates
// the tool views' own bullet pickers, applied here too for a consistent
// "hide built-ins" experience everywhere) and the user's own bullets, the
// latter prefixed "* " — same convention used everywhere else an arsenal
// entry shows up alongside built-in ones. Built-ins are still fetched
// even while hidden, so editing a cartridge that already references a
// (now-hidden) built-in bullet doesn't silently lose that reference —
// see populateBulletOptions() below.
//
// A cartridge is never allowed to point directly at a built-in bullet —
// the Arsenal is meant to be self-contained, so saving one instead copies
// the built-in bullet's full record (its own Cd-Mach table too, for a
// bullet that has one) into the user's own bullet library and points the
// cartridge at that copy — see the save handler below. This is a one-way,
// one-time snapshot: later changes to the built-in library (there are
// none today, but the built-in JSON files could in principle be corrected/
// updated) won't retroactively change a cartridge that already copied one.
// `riflingTwistMm` is the parent rifle's own twist rate (null if left
// blank there) — fixed for the lifetime of this form, since twist isn't
// itself editable here; it's only read for the live stability indicator
// below, resolved together with whichever bullet/velocity are currently
// picked. `lockedCaliberM`, when given (see arsenal-view.js's own
// lockedCaliberMForRifle()), is the caliber already established by one of
// this cartridge's sibling cartridges on the same rifle — a rifle
// chambers one caliber, so the caliber filter below locks to it instead
// of offering "All"; null (a rifle's first cartridge, or one whose
// existing cartridges' bullets have all since been deleted) leaves it
// open. `siblingNames` (see arsenal-view.js's own renderCartridgesSection())
// is every *other* cartridge name already on this rifle — purely for the
// live duplicate-name warning below, same non-blocking tier as bullet-
// form.js's/rifle-form.js's own (unlike the built-in-bullet copy-
// overwrite warning further down, which really does describe a save-time
// overwrite).
export function cartridgeForm({ initialValues = {}, riflingTwistMm = null, lockedCaliberM = null, siblingNames = [], onSave, onCancel } = {}) {
  const values = { ...DEFAULT_VALUES, ...initialValues };

  const nameInput = el('input', { type: 'text', id: 'arsenalCartridgeName', value: values.name });
  const duplicateWarning = el('p', { class: 'hint warning', i18n: 'arsenal.duplicateCartridgeNameWarning' });
  duplicateWarning.style.display = 'none';
  function refreshDuplicateWarning() {
    const match = siblingNames.some((n) => n.trim().toLowerCase() === nameInput.value.trim().toLowerCase());
    duplicateWarning.style.display = match ? '' : 'none';
  }
  nameInput.addEventListener('input', refreshDuplicateWarning);
  const nameValidity = fieldValidity(nameInput, () => (nameInput.value.trim() ? null : t('arsenal.errorNameRequired')));

  const muzzleVelocityField = unitField({
    id: 'muzzleVelocity', ...FIELD_BOUNDS.muzzleVelocity, step: 1, value: values.muzzleVelocity,
    onInput: refreshStability
  });
  const muzzleVelocityTemp = muzzleVelocityTempField({});
  if (values.referenceTempC != null) {
    muzzleVelocityTemp.setInitialValues({ referenceTempC: values.referenceTempC, velocityTempSensitivity: values.velocityTempSensitivity });
  }

  // Narrows the bullet picker below to one caliber at a time — the same
  // "known designation, or a raw-mm label for anything else" idea
  // arsenal-view.js's own caliber filter uses (bulletCaliberLabel()),
  // built from whatever calibers are actually offered here rather than
  // the full caliber-designations.json list, so a bullet with a genuinely
  // custom caliber still gets its own filterable entry.
  const caliberSelect = el('select', { id: 'arsenalCartridgeCaliberFilter' });
  const caliberLockedHint = el('p', { class: 'hint', i18n: 'arsenal.cartridgeCaliberLockedHint' });
  caliberLockedHint.style.display = 'none';
  let designations = [];
  function caliberLabelFor(bullet) {
    return designations.length ? designationFor(bullet.caliberM, designations) : `${(bullet.caliberM * 1000).toFixed(2)}mm`;
  }

  const bulletSelect = el('select', { id: 'arsenalCartridgeBullet' });

  // Populated once the built-in catalog resolves (or fails to — see
  // below), and never reassigned afterward; findOfferedBullet() and the
  // save handler both search it alongside the user's own bullets to
  // resolve whatever bulletSelect.value currently is to its full record.
  let builtIns = [];
  const userBullets = loadUserBullets().map((b) => ({ ...b, isUser: true }));

  function findOfferedBullet(id) {
    return userBullets.find((b) => b.id === id) || builtIns.find((b) => b.id === id) || null;
  }

  // Every bullet the picker could possibly offer, before narrowing to the
  // currently-chosen caliber — shared by rebuildCaliberOptions() (to
  // enumerate which calibers actually have something to offer) and
  // populateBulletOptions() (to then filter by the chosen one).
  function computeOfferedBullets() {
    let offered = isBulletLibraryEnabled() ? [...builtIns, ...userBullets] : [...userBullets];
    if (values.bulletId && !offered.some((b) => b.id === values.bulletId)) {
      const stillReferenced = builtIns.find((b) => b.id === values.bulletId);
      if (stillReferenced) offered = [...offered, stillReferenced];
    }
    return offered;
  }

  // Also read by currentCaliberFilterM() below, to resolve the caliber
  // filter's currently-selected *label* back to an actual caliberM — the
  // "Add new bullet" flow needs the number, not the label, to pre-fill/
  // sync the embedded bullet form's own caliber field.
  let caliberMByLabel = new Map();

  function rebuildCaliberOptions() {
    const offered = computeOfferedBullets();
    caliberMByLabel = new Map();
    for (const b of offered) {
      const label = caliberLabelFor(b);
      if (!caliberMByLabel.has(label)) caliberMByLabel.set(label, b.caliberM);
    }
    // Ordered by actual bore diameter, same convention as every other
    // caliber list in this app.
    const labels = [...caliberMByLabel.keys()].sort((a, b) => caliberMByLabel.get(a) - caliberMByLabel.get(b));

    const previousValue = caliberSelect.value || ALL_CALIBERS_VALUE;
    clear(caliberSelect);
    caliberSelect.appendChild(el('option', { value: ALL_CALIBERS_VALUE, i18n: 'fields.bulletFilterAllCalibers' }));
    for (const label of labels) caliberSelect.appendChild(el('option', { value: label, text: label }));

    if (lockedCaliberM != null) {
      const lockedLabel = caliberLabelFor({ caliberM: lockedCaliberM });
      if (!labels.includes(lockedLabel)) caliberSelect.appendChild(el('option', { value: lockedLabel, text: lockedLabel }));
      caliberSelect.value = lockedLabel;
      caliberSelect.disabled = true;
      caliberLockedHint.style.display = '';
    } else {
      caliberSelect.value = labels.includes(previousValue) ? previousValue : ALL_CALIBERS_VALUE;
    }
  }

  // "Add new bullet" always sits last — every filtered-out re-population
  // (a caliber-filter change, mainly) preserves that selection rather than
  // silently falling back to whatever real bullet happens to land first,
  // same idea as the `values.bulletId` preservation just below it.
  function populateBulletOptions() {
    const offered = computeOfferedBullets();
    const caliber = caliberSelect.value || ALL_CALIBERS_VALUE;
    const filtered = caliber === ALL_CALIBERS_VALUE ? offered : offered.filter((b) => caliberLabelFor(b) === caliber);
    const wasAddingNew = bulletSelect.value === NEW_BULLET_VALUE;

    clear(bulletSelect);
    for (const b of filtered) {
      bulletSelect.appendChild(el('option', { value: b.id, text: (b.isUser ? '* ' : '') + `${b.manufacturer} ${b.name}` }));
    }
    bulletSelect.appendChild(el('option', { value: NEW_BULLET_VALUE, i18n: 'arsenal.cartridgeAddNewBulletOption' }));

    if (filtered.some((b) => b.id === values.bulletId)) bulletSelect.value = values.bulletId;
    else if (wasAddingNew) bulletSelect.value = NEW_BULLET_VALUE;
  }

  // The caliber filter's own currently-selected caliber, as a real
  // caliberM number rather than its display label — null while it's on
  // "All" (nothing specific to sync to). Used to pre-fill/live-sync the
  // embedded "Add new bullet" form's own caliber field; see
  // refreshBulletFormVisibility() below.
  function currentCaliberFilterM() {
    if (!caliberSelect.value || caliberSelect.value === ALL_CALIBERS_VALUE) return null;
    return caliberMByLabel.has(caliberSelect.value) ? caliberMByLabel.get(caliberSelect.value) : null;
  }

  caliberSelect.addEventListener('change', () => {
    populateBulletOptions();
    refreshBulletCopyNotice();
    refreshStability();
    // Narrowing the caliber filter can drop the previously-picked bullet
    // out of the list entirely (bulletSelect then falls back to blank/
    // its first option) — re-check now rather than waiting for Save,
    // same "cross-field change, re-validate the other side" idea as
    // trajectory-view.js's own rangeStep/maxRange pair.
    bulletValidity.validate();
    // Keep the embedded "Add new bullet" form's own caliber in step with
    // this filter — only reachable while unlocked (a locked filter can't
    // itself change), but harmless either way.
    if (bulletFormInstance) bulletFormInstance.setCaliberM(currentCaliberFilterM());
    refreshBulletFormVisibility();
  });

  // Shown only while the currently-picked bullet is a built-in one — see
  // the class comment above. bulletCopyNotice is purely informational;
  // bulletOverwriteWarning only appears on top of it when a same-named
  // user bullet already exists (the copy would overwrite it, same as
  // bullet-form.js's own duplicate-name warning).
  const bulletCopyNotice = el('p', { class: 'hint', i18n: 'arsenal.cartridgeBulletCopyNotice' });
  bulletCopyNotice.style.display = 'none';
  const bulletOverwriteWarning = el('p', { class: 'hint warning' });
  bulletOverwriteWarning.style.display = 'none';

  function refreshBulletCopyNotice() {
    const selected = findOfferedBullet(bulletSelect.value);
    const needsCopy = !!(selected && !selected.isUser);
    bulletCopyNotice.style.display = needsCopy ? '' : 'none';

    const collision = needsCopy ? findUserBulletByName(selected.name) : null;
    bulletOverwriteWarning.style.display = collision ? '' : 'none';
    if (collision) bulletOverwriteWarning.textContent = t('arsenal.cartridgeBulletCopyOverwriteWarning', { name: selected.name });
  }

  // Miller's-formula stability for this cartridge's bullet + velocity
  // combined with the parent rifle's own twist — see the class comment
  // above for why riflingTwistMm is fixed rather than read live.
  const stability = stabilityIndicator();
  function refreshStability() {
    const bullet = findOfferedBullet(bulletSelect.value);
    stability.update({
      massKg: bullet ? bullet.massKg : null,
      caliberM: bullet ? bullet.caliberM : null,
      lengthM: bullet ? bullet.lengthM : null,
      muzzleVelocity: muzzleVelocityField.getEngineValue(),
      riflingTwistMm
    });
  }

  // A literal "__new__" bulletId is never a valid one to save — guards
  // both the moment right after picking "Add new bullet" (before its own
  // form has produced a real bullet yet) and the defensive case where
  // there's somehow no bulletFormInstance to resolve it through.
  const bulletValidity = fieldValidity(bulletSelect, () => (
    !bulletSelect.value || bulletSelect.value === NEW_BULLET_VALUE ? t('arsenal.errorBulletRequired') : null
  ));
  bulletSelect.addEventListener('change', () => {
    // Tracks whatever real bullet was picked most recently — not just the
    // one this cartridge started with — so Cancelling a later "Add new
    // bullet" detour reverts to the right place (see
    // createBulletFormInstance()'s own onCancel below).
    if (bulletSelect.value !== NEW_BULLET_VALUE) lastRealBulletId = bulletSelect.value;
    refreshBulletCopyNotice();
    refreshStability();
    refreshBulletFormVisibility();
  });

  // ---- "Add new bullet" — an embedded, full bullet-form.js instance ----
  // Picking the bullet select's own "Add new bullet" option (see
  // populateBulletOptions() above) opens the very same Add Bullet form
  // Arsenal's own top-level "+ Add Bullet" button does, right here inline
  // — its own Save button commits the new bullet immediately and selects
  // it; this cartridge form's own Save button (see the save handler below)
  // also commits it first if it's still open and filled in, so filling in
  // a new bullet and clicking *this* form's Save works in one step too.
  // Cancelling it (or picking any real bullet instead) discards it and
  // reverts the selector to whatever real bullet was picked before.
  let bulletFormInstance = null;
  const bulletFormContainer = el('div', {});
  let lastRealBulletId = values.bulletId || null;

  function createBulletFormInstance() {
    return bulletForm({
      initialValues: { caliberM: currentCaliberFilterM() },
      caliberLocked: lockedCaliberM != null,
      onSave: (data) => {
        const collision = findUserBulletByName(data.name);
        const saved = collision
          ? saveUserBullet({ ...collision, ...data, id: collision.id })
          : saveUserBullet({ ...data, id: generateUserId('user-bullet') });
        const existingIndex = userBullets.findIndex((b) => b.id === saved.id);
        if (existingIndex >= 0) userBullets[existingIndex] = { ...saved, isUser: true };
        else userBullets.push({ ...saved, isUser: true });

        bulletFormInstance = null;
        clear(bulletFormContainer);
        populateBulletOptions();
        bulletSelect.value = saved.id;
        lastRealBulletId = saved.id;
        refreshBulletCopyNotice();
        refreshStability();
        bulletValidity.validate();
        refreshBulletFormVisibility();
      },
      onCancel: () => {
        bulletFormInstance = null;
        clear(bulletFormContainer);
        const options = [...bulletSelect.childNodes];
        const fallback = options.some((o) => o.value === lastRealBulletId)
          ? lastRealBulletId
          : (options.find((o) => o.value !== NEW_BULLET_VALUE)?.value ?? NEW_BULLET_VALUE);
        bulletSelect.value = fallback;
        refreshBulletCopyNotice();
        refreshStability();
        bulletValidity.validate();
        refreshBulletFormVisibility();
      }
    });
  }

  function refreshBulletFormVisibility() {
    const shouldShow = bulletSelect.value === NEW_BULLET_VALUE;
    if (shouldShow && !bulletFormInstance) {
      bulletFormInstance = createBulletFormInstance();
      clear(bulletFormContainer);
      bulletFormContainer.appendChild(bulletFormInstance.node);
    } else if (!shouldShow && bulletFormInstance) {
      bulletFormInstance = null;
      clear(bulletFormContainer);
    }
    bulletFormContainer.style.display = shouldShow ? '' : 'none';
  }

  const builtInsLoaded = Promise.all(loadBulletCatalog().map((id) => loadBullet(id)))
    .then((loaded) => { builtIns = loaded; })
    .catch(() => { builtIns = []; });
  const designationsLoaded = loadCaliberDesignations()
    .then((list) => { designations = list; })
    .catch(() => { designations = []; });

  Promise.all([builtInsLoaded, designationsLoaded]).then(() => {
    rebuildCaliberOptions();
    populateBulletOptions();
    // A brand-new cartridge (no bulletId of its own yet) starts on "Add
    // new bullet" rather than whatever real bullet happened to sort
    // first — editing an existing cartridge is unaffected (values.bulletId
    // is already truthy there, and populateBulletOptions() just selected
    // it above).
    if (!values.bulletId) bulletSelect.value = NEW_BULLET_VALUE;
    refreshBulletCopyNotice();
    refreshStability();
    refreshBulletFormVisibility();
  });

  const saveButton = el('button', { i18n: 'arsenal.saveCartridgeButton' });
  const cancelButton = el('button', { class: 'secondary', i18n: 'arsenal.cancelButton' });

  function readValues() {
    return {
      name: nameInput.value.trim(),
      muzzleVelocity: muzzleVelocityField.getEngineValue(),
      ...muzzleVelocityTemp.getValues(),
      bulletId: bulletSelect.value
    };
  }

  // Every field's own live validation (red border + inline hint) is also
  // the Save gate — see bullet-form.js's own Save handler for the same
  // pattern. If "Add new bullet" is still the active selection, save that
  // embedded form first — its own trySave() both validates it (scrolling
  // to its first bad field and stopping here on failure, same as any
  // other invalid field below) and, on success, already reassigns
  // bulletSelect.value to the freshly-created bullet's id (see
  // createBulletFormInstance()'s onSave above) — so by the time the
  // checks below run, bulletValidity sees a real bullet, not "__new__".
  saveButton.addEventListener('click', () => {
    if (bulletSelect.value === NEW_BULLET_VALUE) {
      if (!bulletFormInstance || !bulletFormInstance.trySave()) return;
    }
    const checks = [
      { ok: nameValidity.validate(), node: nameInput },
      { ok: muzzleVelocityField.validate(), node: muzzleVelocityField.node },
      { ok: muzzleVelocityTemp.validate(), node: muzzleVelocityTemp.node },
      { ok: bulletValidity.validate(), node: bulletSelect }
    ];
    const firstInvalid = checks.find((c) => !c.ok);
    if (firstInvalid) {
      firstInvalid.node.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    const data = readValues();
    // Copy a built-in bullet into the user library before the cartridge
    // ever points at it (see the class comment above) — reusing an
    // existing same-named user bullet's id (an intentional overwrite,
    // already warned about live via bulletOverwriteWarning) rather than
    // minting a second entry.
    const selected = findOfferedBullet(data.bulletId);
    if (selected && !selected.isUser) {
      const { isUser, ...bulletRecord } = selected;
      const collision = findUserBulletByName(selected.name);
      const id = collision ? collision.id : generateUserId('user-bullet');
      const saved = saveUserBullet({ ...bulletRecord, id });
      data.bulletId = saved.id;
    }

    if (onSave) onSave(data);
  });
  cancelButton.addEventListener('click', () => { if (onCancel) onCancel(); });

  const node = el('div', { class: 'input-section nested' }, [
    el('div', { class: 'field' }, [el('label', { i18n: 'arsenal.cartridgeName' }), nameInput]),
    nameValidity.hintNode,
    duplicateWarning,
    muzzleVelocityField.node,
    muzzleVelocityTemp.node,
    el('div', { class: 'field' }, [el('label', { i18n: 'fields.bulletCaliberFilter' }), caliberSelect]),
    caliberLockedHint,
    el('p', { class: 'hint prominent', i18n: 'arsenal.cartridgeBulletHint' }),
    el('div', { class: 'field' }, [el('label', { i18n: 'arsenal.cartridgeBullet' }), bulletSelect, bulletValidity.hintNode]),
    bulletFormContainer,
    bulletCopyNotice,
    bulletOverwriteWarning,
    stability.node,
    el('div', { class: 'arsenal-form-actions' }, [saveButton, cancelButton])
  ]);

  refreshDuplicateWarning();
  refreshStability();

  return { node };
}
