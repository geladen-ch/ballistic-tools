// "Numbers" table for the analysis view (src/views/rifle-precision-analysis-view.js)
// — every precision statistic in one place, each optional row's own "show
// on image" checkbox doubling as the toggle for that same element on the
// diagram and in the legend (see analysis-diagram.js/diagram-legend.js).
import { el, clear } from '../../dom.js';

function checkboxCell({ checked, disabled = false, onChange }) {
  const checkbox = el('input', { type: 'checkbox' });
  checkbox.checked = checked;
  checkbox.disabled = disabled;
  if (onChange) checkbox.addEventListener('change', () => onChange(checkbox.checked));
  return el('td', {}, [checkbox]);
}

export function numbersTable() {
  const node = el('table', { class: 'rp-numbers-table' });

  // `rows`: [{ descriptionKey?, description?, designation?, value, show }],
  // where `show` is either undefined (no checkbox), `{ checked: true, disabled: true }`
  // (locked on), or `{ checked, onChange }` (a live toggle).
  function update(rows) {
    clear(node);
    node.appendChild(el('thead', {}, [el('tr', {}, [
      el('th', { i18n: 'riflePrecision.numbersDescriptionHeader' }),
      el('th', { i18n: 'riflePrecision.numbersDesignationHeader' }),
      el('th', { i18n: 'riflePrecision.numbersValueHeader' }),
      el('th', { i18n: 'riflePrecision.numbersShowHeader' })
    ])]));
    const tbody = el('tbody');
    for (const row of rows) {
      const descriptionCell = row.descriptionKey
        ? el('td', { i18n: row.descriptionKey })
        : el('td', { text: row.description || '' });
      tbody.appendChild(el('tr', {}, [
        descriptionCell,
        el('td', { text: row.designation || '' }),
        el('td', { text: row.value }),
        row.show ? checkboxCell(row.show) : el('td')
      ]));
    }
    node.appendChild(tbody);
  }

  return { node, update };
}
