import { el, clear } from '../../dom.js';
import { unitField } from '../unit-field.js';
import { muzzleVelocityTempField } from '../muzzle-velocity-temp-field.js';
import { stabilityIndicator } from '../stability-indicator.js';
import { loadBulletCatalog, loadBullet } from '../../bullets.js';
import { loadUserBullets, saveUserBullet, findUserBulletByName, generateUserId } from '../../user-library.js';
import { isBulletLibraryEnabled } from '../../library-prefs.js';
import { t } from '../../i18n.js';

const DEFAULT_VALUES = { name: '', muzzleVelocity: 800, referenceTempC: null, velocityTempSensitivity: null, bulletId: '' };

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
// picked.
export function cartridgeForm({ initialValues = {}, riflingTwistMm = null, onSave, onCancel } = {}) {
  const values = { ...DEFAULT_VALUES, ...initialValues };

  const nameInput = el('input', { type: 'text', id: 'arsenalCartridgeName', value: values.name });
  const muzzleVelocityField = unitField({
    id: 'muzzleVelocity', min: 200, max: 1200, step: 1, value: values.muzzleVelocity,
    onInput: refreshStability
  });
  const muzzleVelocityTemp = muzzleVelocityTempField({});
  if (values.referenceTempC != null) {
    muzzleVelocityTemp.setInitialValues({ referenceTempC: values.referenceTempC, velocityTempSensitivity: values.velocityTempSensitivity });
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

  function populateBulletOptions() {
    let offered = isBulletLibraryEnabled() ? [...builtIns, ...userBullets] : [...userBullets];
    if (values.bulletId && !offered.some((b) => b.id === values.bulletId)) {
      const stillReferenced = builtIns.find((b) => b.id === values.bulletId);
      if (stillReferenced) offered = [...offered, stillReferenced];
    }

    clear(bulletSelect);
    for (const b of offered) {
      bulletSelect.appendChild(el('option', { value: b.id, text: (b.isUser ? '* ' : '') + `${b.manufacturer} ${b.name}` }));
    }
    if (offered.some((b) => b.id === values.bulletId)) bulletSelect.value = values.bulletId;
  }

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

  bulletSelect.addEventListener('change', () => { refreshBulletCopyNotice(); refreshStability(); });

  Promise.all(loadBulletCatalog().map((id) => loadBullet(id)))
    .then((loaded) => { builtIns = loaded; })
    .catch(() => { builtIns = []; })
    .then(() => {
      populateBulletOptions();
      refreshBulletCopyNotice();
      refreshStability();
    });

  const errorMessage = el('p', { class: 'hint warning' });
  errorMessage.style.display = 'none';

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

  saveButton.addEventListener('click', () => {
    const data = readValues();
    if (!data.name) {
      errorMessage.textContent = t('arsenal.errorNameRequired');
      errorMessage.style.display = '';
      return;
    }
    if (!data.bulletId) {
      errorMessage.textContent = t('arsenal.errorBulletRequired');
      errorMessage.style.display = '';
      return;
    }

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

    errorMessage.style.display = 'none';
    if (onSave) onSave(data);
  });
  cancelButton.addEventListener('click', () => { if (onCancel) onCancel(); });

  const node = el('div', { class: 'input-section nested' }, [
    el('div', { class: 'field' }, [el('label', { i18n: 'arsenal.cartridgeName' }), nameInput]),
    muzzleVelocityField.node,
    muzzleVelocityTemp.node,
    el('div', { class: 'field' }, [el('label', { i18n: 'arsenal.cartridgeBullet' }), bulletSelect]),
    bulletCopyNotice,
    bulletOverwriteWarning,
    stability.node,
    errorMessage,
    el('div', { class: 'arsenal-form-actions' }, [saveButton, cancelButton])
  ]);

  refreshStability();

  return { node };
}
