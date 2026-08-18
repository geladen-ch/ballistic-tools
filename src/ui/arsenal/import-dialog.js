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
// parsed (see arsenal-view.js). Lists every bullet/rifle the file
// contains, flags a name conflict with the current library (and whether
// the file's copy is newer/older/the same age, via modifiedAt — see
// arsenal-export.js's classifyImportItem), lets the user choose which
// items to bring in (all checked by default — "import everything" unless
// something's excluded) and how to handle conflicts. A rifle can't be
// usefully imported without the bullet(s) its cartridges reference — a
// cartridge whose bullet was left out of the import ends up pointing at
// nothing resolvable locally (see arsenal-export.js's planImportBatch) —
// so, same as export-dialog.js, the two checkbox groups enforce that
// dependency both ways: checking a rifle (re-)checks whichever of its own
// bullets are present in the file, and unchecking a bullet takes every
// rifle that needs it back down with it. Purely a selection+mode UI:
// onImport(...) receives the choices and does nothing else — arsenal-
// view.js runs planImportBatch and actually writes to the library.
export function importDialog({ bullets, rifles, existingBullets, existingRifles, onImport, onCancel }) {
  const fileBulletIds = new Set(bullets.map((b) => b.id));
  const bulletCheckboxes = new Map();
  const rifleCheckboxes = new Map();

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

  const bulletRows = bullets.map((item) => {
    const checkbox = el('input', { type: 'checkbox', id: `import-bullet-${item.id}` });
    checkbox.checked = true;
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) return;
      for (const rifle of riflesNeeding.get(item.id) || []) {
        const rifleCheckbox = rifleCheckboxes.get(rifle.id);
        if (rifleCheckbox) rifleCheckbox.checked = false;
      }
    });
    bulletCheckboxes.set(item.id, checkbox);
    const classification = classifyImportItem(item, existingBullets);
    return el('label', { class: 'checkbox-field' }, [checkbox, item.name, conflictBadge(classification)]);
  });

  const rifleRows = rifles.map((item) => {
    const checkbox = el('input', { type: 'checkbox', id: `import-rifle-${item.id}` });
    checkbox.checked = true;
    checkbox.addEventListener('change', () => {
      if (!checkbox.checked) return; // only cascades forward on check — see export-dialog.js's matching comment
      for (const bulletId of fileBulletIdsFor(item)) {
        const bulletCheckbox = bulletCheckboxes.get(bulletId);
        if (bulletCheckbox) bulletCheckbox.checked = true;
      }
    });
    rifleCheckboxes.set(item.id, checkbox);
    const classification = classifyImportItem(item, existingRifles);
    return el('label', { class: 'checkbox-field' }, [checkbox, item.name, conflictBadge(classification)]);
  });

  const modeSelect = el('select', { id: 'import-conflict-mode' },
    IMPORT_MODES.map((mode) => el('option', { value: mode, i18n: MODE_LABEL_KEYS[mode] })));

  const importButton = el('button', { i18n: 'arsenal.importButton' });
  const cancelButton = el('button', { class: 'secondary', i18n: 'arsenal.cancelButton' });

  importButton.addEventListener('click', () => {
    const bulletIds = [...bulletCheckboxes].filter(([, cb]) => cb.checked).map(([id]) => id);
    const rifleIds = [...rifleCheckboxes].filter(([, cb]) => cb.checked).map(([id]) => id);
    if (onImport) onImport({ bulletIds, rifleIds, mode: modeSelect.value });
  });
  cancelButton.addEventListener('click', () => { if (onCancel) onCancel(); });

  const node = el('div', { class: 'input-section nested' }, [
    el('p', { class: 'hint', i18n: 'arsenal.importConflictModeHint' }),
    el('div', { class: 'field' }, [el('label', { i18n: 'arsenal.importConflictModeLabel' }), modeSelect]),
    el('h4', { i18n: 'arsenal.importBulletsHeading' }),
    bullets.length ? el('div', {}, bulletRows) : el('p', { class: 'hint', i18n: 'arsenal.importNoBullets' }),
    el('h4', { i18n: 'arsenal.importRiflesHeading' }),
    rifles.length ? el('div', {}, rifleRows) : el('p', { class: 'hint', i18n: 'arsenal.importNoRifles' }),
    el('div', { class: 'arsenal-form-actions' }, [importButton, cancelButton])
  ]);

  return { node };
}
