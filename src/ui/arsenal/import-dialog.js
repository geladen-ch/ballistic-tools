import { el } from '../../dom.js';
import { t } from '../../i18n.js';
import { classifyImportItem, IMPORT_MODES } from '../../arsenal-export.js';

const COMPARISON_LABEL_KEYS = {
  newer: 'arsenal.importComparisonNewer',
  older: 'arsenal.importComparisonOlder',
  same: 'arsenal.importComparisonSame',
  unknown: 'arsenal.importComparisonUnknown'
};

const MODE_LABEL_KEYS = {
  overwrite: 'arsenal.importModeOverwrite',
  overwriteIfNewer: 'arsenal.importModeOverwriteIfNewer',
  rename: 'arsenal.importModeRename'
};

function conflictBadge(classification) {
  if (!classification.conflict) return null;
  const comparison = t(COMPARISON_LABEL_KEYS[classification.comparison]);
  return el('span', { class: 'hint warning', text: ` — ${t('arsenal.importConflictBadge', { comparison })}` });
}

// Inline "Load Library" panel, shown once a picked file has been read and
// parsed (see arsenal-view.js). Lists every bullet, rifle, scope and
// reticle the file contains (scopes and reticles only when it has any),
// flags a name conflict with the current library (and whether the file's
// copy is newer/older/the same age, via modifiedAt — see
// arsenal-export.js's classifyImportItem), lets the user choose which
// items to bring in (all checked by default — "import everything" unless
// something's excluded) and how to handle conflicts. Reticles that failed
// their check (`invalidReticleNames`) are named as skipped.
//
// A rifle can't be usefully imported without the bullet(s) its cartridges
// reference — a cartridge whose bullet was left out of the import ends up
// pointing at nothing resolvable locally (see arsenal-export.js's
// planImportBatch) — so, same as export-dialog.js, the two checkbox
// groups enforce that dependency both ways: checking a rifle (re-)checks
// whichever of its own bullets are present in the file, and unchecking a
// bullet takes every rifle that needs it back down with it. A rifle's
// scope, and a scope's reticles, are only ticked along with it, as in
// export-dialog.js. Purely a selection+mode UI: onImport(...) receives the
// choices and does nothing else — arsenal-view.js runs planImportBatch and
// actually writes to the library.
export function importDialog({
  bullets, rifles, scopes = [], reticles = [], invalidReticleNames = [],
  existingBullets, existingRifles, existingScopes = [], existingReticles = [], onImport, onCancel
}) {
  const fileBulletIds = new Set(bullets.map((b) => b.id));
  const checkboxes = { bullets: new Map(), rifles: new Map(), scopes: new Map(), reticles: new Map() };
  const check = (group, id) => {
    const checkbox = checkboxes[group].get(id);
    if (checkbox) checkbox.checked = true;
  };

  function fileBulletIdsFor(rifle) {
    return rifle.cartridges.map((c) => c.bulletId).filter((id) => fileBulletIds.has(id));
  }

  // Reverse index: bulletId -> the rifles that need it — see
  // export-dialog.js's identical index for why.
  const riflesNeeding = new Map();
  for (const rifle of rifles) {
    for (const bulletId of fileBulletIdsFor(rifle)) {
      if (!riflesNeeding.has(bulletId)) riflesNeeding.set(bulletId, []);
      riflesNeeding.get(bulletId).push(rifle);
    }
  }

  function rows(group, items, existing, onChange) {
    return items.map((item) => {
      const checkbox = el('input', { type: 'checkbox', id: `import-${group.slice(0, -1)}-${item.id}` });
      checkbox.checked = true;
      checkbox.addEventListener('change', () => onChange(item, checkbox.checked));
      checkboxes[group].set(item.id, checkbox);
      return el('label', { class: 'checkbox-field' }, [checkbox, item.name, conflictBadge(classifyImportItem(item, existing))]);
    });
  }

  const bulletRows = rows('bullets', bullets, existingBullets, (bullet, checked) => {
    if (checked) return;
    for (const rifle of riflesNeeding.get(bullet.id) || []) {
      const rifleCheckbox = checkboxes.rifles.get(rifle.id);
      if (rifleCheckbox) rifleCheckbox.checked = false;
    }
  });
  // Only cascades forward on check — see export-dialog.js's matching comment.
  const rifleRows = rows('rifles', rifles, existingRifles, (rifle, checked) => {
    if (!checked) return;
    for (const bulletId of fileBulletIdsFor(rifle)) check('bullets', bulletId);
    if (rifle.scopeId) checkScope(rifle.scopeId);
  });
  function checkScope(scopeId) {
    check('scopes', scopeId);
    const scope = scopes.find((s) => s.id === scopeId);
    for (const reticleId of scope && Array.isArray(scope.reticleIds) ? scope.reticleIds : []) check('reticles', reticleId);
  }
  const scopeRows = rows('scopes', scopes, existingScopes, (scope, checked) => {
    if (checked) checkScope(scope.id);
  });
  const reticleRows = rows('reticles', reticles, existingReticles, () => {});

  const modeSelect = el('select', { id: 'import-conflict-mode' },
    IMPORT_MODES.map((mode) => el('option', { value: mode, i18n: MODE_LABEL_KEYS[mode] })));

  const importButton = el('button', { i18n: 'arsenal.importButton' });
  const cancelButton = el('button', { class: 'secondary', i18n: 'arsenal.cancelButton' });

  const checkedIds = (group) => [...checkboxes[group]].filter(([, cb]) => cb.checked).map(([id]) => id);
  importButton.addEventListener('click', () => {
    if (onImport) {
      onImport({
        bulletIds: checkedIds('bullets'), rifleIds: checkedIds('rifles'),
        scopeIds: checkedIds('scopes'), reticleIds: checkedIds('reticles'), mode: modeSelect.value
      });
    }
  });
  cancelButton.addEventListener('click', () => { if (onCancel) onCancel(); });

  const children = [
    el('p', { class: 'hint', i18n: 'arsenal.importConflictModeHint' }),
    el('div', { class: 'field' }, [el('label', { i18n: 'arsenal.importConflictModeLabel' }), modeSelect]),
    el('h4', { i18n: 'arsenal.importBulletsHeading' }),
    bullets.length ? el('div', {}, bulletRows) : el('p', { class: 'hint', i18n: 'arsenal.importNoBullets' }),
    el('h4', { i18n: 'arsenal.importRiflesHeading' }),
    rifles.length ? el('div', {}, rifleRows) : el('p', { class: 'hint', i18n: 'arsenal.importNoRifles' })
  ];
  if (scopes.length) children.push(el('h4', { i18n: 'arsenal.importScopesHeading' }), el('div', {}, scopeRows));
  if (reticles.length || invalidReticleNames.length) {
    children.push(el('h4', { i18n: 'arsenal.importReticlesHeading' }), el('div', {}, reticleRows));
  }
  if (invalidReticleNames.length) {
    children.push(el('p', { class: 'hint warning', text: t('arsenal.importInvalidReticles', { names: invalidReticleNames.join(', ') }) }));
  }
  children.push(el('div', { class: 'arsenal-form-actions' }, [importButton, cancelButton]));

  return { node: el('div', { class: 'input-section nested' }, children) };
}
