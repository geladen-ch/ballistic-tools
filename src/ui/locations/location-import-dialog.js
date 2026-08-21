import { el } from '../../dom.js';
import { t } from '../../i18n.js';
import { classifyImportItem, IMPORT_MODES } from '../../location-export.js';

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
// parsed (see locations-view.js) — simpler than Arsenal's own
// import-dialog.js since there's only one list here, no cross-list
// dependency cascade to enforce. Reuses the existing `arsenal.*` mode/
// comparison translation keys (same concepts: overwrite/overwriteIfNewer/
// rename, newer/older/same/unknown) rather than duplicating them under a
// new namespace.
export function locationImportDialog({ locations, existingLocations, onImport, onCancel }) {
  const checkboxes = new Map();

  const rows = locations.map((item) => {
    const checkbox = el('input', { type: 'checkbox', id: `import-location-${item.id}` });
    checkbox.checked = true;
    checkboxes.set(item.id, checkbox);
    const classification = classifyImportItem(item, existingLocations);
    return el('label', { class: 'checkbox-field' }, [checkbox, item.name, conflictBadge(classification)]);
  });

  const modeSelect = el('select', { id: 'import-location-conflict-mode' },
    IMPORT_MODES.map((mode) => el('option', { value: mode, i18n: MODE_LABEL_KEYS[mode] })));

  const importButton = el('button', { i18n: 'rangeSolverLocations.importButton' });
  const cancelButton = el('button', { class: 'secondary', i18n: 'rangeSolverLocations.cancelButton' });

  importButton.addEventListener('click', () => {
    const locationIds = [...checkboxes].filter(([, cb]) => cb.checked).map(([id]) => id);
    if (onImport) onImport({ locationIds, mode: modeSelect.value });
  });
  cancelButton.addEventListener('click', () => { if (onCancel) onCancel(); });

  const node = el('div', { class: 'input-section nested' }, [
    el('p', { class: 'hint', i18n: 'arsenal.importConflictModeHint' }),
    el('div', { class: 'field' }, [el('label', { i18n: 'arsenal.importConflictModeLabel' }), modeSelect]),
    locations.length ? el('div', {}, rows) : el('p', { class: 'hint', i18n: 'rangeSolverLocations.noLocations' }),
    el('div', { class: 'arsenal-form-actions' }, [importButton, cancelButton])
  ]);

  return { node };
}
