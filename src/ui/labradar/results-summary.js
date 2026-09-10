// The aggregate result card — valid/total track count, BC standard
// deviation, and the averaged BC itself, with the 95% confidence
// interval of that average appended to it as a percentage. Structured
// fields, not a single string-concatenated dump like the legacy tool's
// own report.
import { el, clear } from '../../dom.js';
import { t } from '../../i18n.js';

export function resultsSummary() {
  const countEl = el('span', { class: 'labradar-summary-value', text: '—' });
  const stdevEl = el('span', { class: 'labradar-summary-value', text: '—' });
  const bcEl = el('div', { id: 'labradar-bc-result', class: 'card', style: 'font-size:28px;font-weight:700;color:var(--accent);' }, ['—']);
  const ciEl = el('span', { class: 'labradar-bc-ci' });

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
    // A single valid track has no interval to report (and no spread to
    // compute one from), so the suffix is simply left off rather than
    // shown as a misleading ±0%.
    if (agg.meanBc !== null && agg.ci95PctBc !== null && agg.ci95PctBc !== undefined) {
      ciEl.textContent = t('bcToolsLabradar.ci95Value', { pct: agg.ci95PctBc.toFixed(1) });
      ciEl.title = t('bcToolsLabradar.ci95Title');
      bcEl.appendChild(ciEl);
    }
  }

  render(null);
  return { node, render };
}
