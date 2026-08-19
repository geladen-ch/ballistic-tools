// The aggregate result card — valid/total track count, BC standard
// deviation, and the averaged BC itself. Structured fields, not a single
// string-concatenated dump like the legacy tool's own report.
import { el, clear } from '../../dom.js';
import { t } from '../../i18n.js';

export function resultsSummary() {
  const countEl = el('span', { class: 'labradar-summary-value', text: '—' });
  const stdevEl = el('span', { class: 'labradar-summary-value', text: '—' });
  const bcEl = el('div', { id: 'labradar-bc-result', class: 'card', style: 'font-size:28px;font-weight:700;color:var(--accent);' }, ['—']);

  const node = el('div', { class: 'card' }, [
    el('h2', { i18n: 'bcToolsLabradar.resultHeading' }),
    el('div', { class: 'labradar-summary-row' }, [
      el('span', { i18n: 'bcToolsLabradar.validCountLabel' }),
      countEl
    ]),
    el('div', { class: 'labradar-summary-row' }, [
      el('span', { i18n: 'bcToolsLabradar.stdevLabel' }),
      stdevEl
    ]),
    bcEl
  ]);

  function render(agg) {
    if (!agg || agg.totalCount === 0) {
      countEl.textContent = '—';
      stdevEl.textContent = '—';
      clear(bcEl);
      bcEl.appendChild(document.createTextNode('—'));
      return;
    }
    countEl.textContent = t('bcToolsLabradar.validCountValue', { valid: agg.validCount, total: agg.totalCount });
    stdevEl.textContent = agg.stdevBc !== null ? agg.stdevBc.toFixed(5) : '—';
    clear(bcEl);
    bcEl.appendChild(document.createTextNode(agg.meanBc !== null ? agg.meanBc.toFixed(4) : '—'));
  }

  render(null);
  return { node, render };
}
