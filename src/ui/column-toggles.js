import { el } from '../dom.js';
import { i18nSpan } from '../i18n.js';

// One checkbox per toggleable column. Persistence is the caller's job
// (see table-columns.js) — this only tracks in-memory visibility state
// and notifies on change; `columns` is [{id, headerKey}], and each
// checkbox's label reuses the column's own header translation so the
// toggle and the header always read identically.
export function columnToggles(columns, initialVisibility, { onChange } = {}) {
  const visibility = { ...initialVisibility };

  const node = el(
    'div',
    { class: 'column-toggles' },
    columns.map((col) => {
      const checkbox = el('input', { type: 'checkbox', id: 'col-toggle-' + col.id });
      checkbox.checked = !!visibility[col.id];
      checkbox.addEventListener('change', () => {
        visibility[col.id] = checkbox.checked;
        if (onChange) onChange({ ...visibility });
      });
      return el('label', { class: 'checkbox-field' }, [checkbox, i18nSpan(col.headerKey)]);
    })
  );

  return {
    node,
    isVisible: (id) => !!visibility[id],
    getVisibility: () => ({ ...visibility })
  };
}
