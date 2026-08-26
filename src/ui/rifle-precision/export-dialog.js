import { el } from '../../dom.js';

// Inline "Save Library" panel — simpler than Arsenal's own export-
// dialog.js since there's only one list here (a project's targets/groups/
// shots travel with it automatically, no separate cross-list dependency
// cascade to enforce). All checked by default, same "export everything
// unless something's excluded" convention as location-export-dialog.js.
// Purely a selection UI — onExport(...) receives the chosen ids,
// rifle-precision-view.js does the actual file build/download.
export function riflePrecisionExportDialog({ projects, onExport, onCancel }) {
  const checkboxes = new Map();

  const rows = projects.map((project) => {
    const checkbox = el('input', { type: 'checkbox', id: `export-rp-project-${project.id}` });
    checkbox.checked = true;
    checkboxes.set(project.id, checkbox);
    return el('label', { class: 'checkbox-field' }, [checkbox, project.name]);
  });

  const exportButton = el('button', { i18n: 'riflePrecision.exportButton' });
  const cancelButton = el('button', { class: 'secondary', i18n: 'riflePrecision.cancelButton' });

  exportButton.addEventListener('click', () => {
    const projectIds = [...checkboxes].filter(([, cb]) => cb.checked).map(([id]) => id);
    if (onExport) onExport({ projectIds });
  });
  cancelButton.addEventListener('click', () => { if (onCancel) onCancel(); });

  const node = el('div', { class: 'input-section nested' }, [
    projects.length ? el('div', {}, rows) : el('p', { class: 'hint', i18n: 'riflePrecision.noProjects' }),
    el('div', { class: 'arsenal-form-actions' }, [exportButton, cancelButton])
  ]);

  return { node };
}
