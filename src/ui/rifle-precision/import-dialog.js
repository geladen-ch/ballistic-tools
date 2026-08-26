import { el } from '../../dom.js';
import { t } from '../../i18n.js';
import { classifyImportItem, IMPORT_MODES } from '../../rifle-precision-export.js';

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
// parsed (see rifle-precision-view.js) — simpler than Arsenal's own
// import-dialog.js since there's only one list here, no cross-list
// dependency cascade to enforce. Reuses the existing `arsenal.*` mode/
// comparison translation keys (same concepts: overwrite/overwriteIfNewer/
// rename, newer/older/same/unknown) rather than duplicating them under a
// new namespace — same choice location-import-dialog.js already made.
export function riflePrecisionImportDialog({ projects, existingProjects, onImport, onCancel }) {
  const checkboxes = new Map();

  const rows = projects.map((item) => {
    const checkbox = el('input', { type: 'checkbox', id: `import-rp-project-${item.id}` });
    checkbox.checked = true;
    checkboxes.set(item.id, checkbox);
    const classification = classifyImportItem(item, existingProjects);
    return el('label', { class: 'checkbox-field' }, [checkbox, item.name, conflictBadge(classification)]);
  });

  const modeSelect = el('select', { id: 'import-rp-project-conflict-mode' },
    IMPORT_MODES.map((mode) => el('option', { value: mode, i18n: MODE_LABEL_KEYS[mode] })));

  const importButton = el('button', { i18n: 'riflePrecision.importButton' });
  const cancelButton = el('button', { class: 'secondary', i18n: 'riflePrecision.cancelButton' });

  importButton.addEventListener('click', () => {
    const projectIds = [...checkboxes].filter(([, cb]) => cb.checked).map(([id]) => id);
    if (onImport) onImport({ projectIds, mode: modeSelect.value });
  });
  cancelButton.addEventListener('click', () => { if (onCancel) onCancel(); });

  const node = el('div', { class: 'input-section nested' }, [
    el('p', { class: 'hint', i18n: 'arsenal.importConflictModeHint' }),
    el('div', { class: 'field' }, [el('label', { i18n: 'arsenal.importConflictModeLabel' }), modeSelect]),
    projects.length ? el('div', {}, rows) : el('p', { class: 'hint', i18n: 'riflePrecision.noProjects' }),
    el('div', { class: 'arsenal-form-actions' }, [importButton, cancelButton])
  ]);

  return { node };
}
