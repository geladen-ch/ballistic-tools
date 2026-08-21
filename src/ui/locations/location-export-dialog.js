import { el } from '../../dom.js';

// Inline "Save Library" panel — simpler than Arsenal's own export-
// dialog.js since there's only one list here (a location's targets
// travel with it automatically, no separate bullet/rifle dependency
// cascade to enforce). All checked by default, same "export everything
// unless something's excluded" convention. Purely a selection UI —
// onExport(...) receives the chosen ids, locations-view.js does the
// actual file build/download.
export function locationExportDialog({ locations, onExport, onCancel }) {
  const checkboxes = new Map();

  const rows = locations.map((location) => {
    const checkbox = el('input', { type: 'checkbox', id: `export-location-${location.id}` });
    checkbox.checked = true;
    checkboxes.set(location.id, checkbox);
    return el('label', { class: 'checkbox-field' }, [checkbox, location.name]);
  });

  const exportButton = el('button', { i18n: 'rangeSolverLocations.exportButton' });
  const cancelButton = el('button', { class: 'secondary', i18n: 'rangeSolverLocations.cancelButton' });

  exportButton.addEventListener('click', () => {
    const locationIds = [...checkboxes].filter(([, cb]) => cb.checked).map(([id]) => id);
    if (onExport) onExport({ locationIds });
  });
  cancelButton.addEventListener('click', () => { if (onCancel) onCancel(); });

  const node = el('div', { class: 'input-section nested' }, [
    locations.length ? el('div', {}, rows) : el('p', { class: 'hint', i18n: 'rangeSolverLocations.noLocations' }),
    el('div', { class: 'arsenal-form-actions' }, [exportButton, cancelButton])
  ]);

  return { node };
}
