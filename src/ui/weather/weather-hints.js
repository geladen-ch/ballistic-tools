// Country hints as DOM: under the weather block (at most two, each dismissible) and as a full list in the
// station-details dialog (every applicable hint, dismissed or not). Hints explain a result; they never change it.
import { el } from '../../dom.js';
import { t } from '../../i18n.js';
import { evaluateHints, pickHints } from '../../weather/hints-eval.js';
import { getDismissedHints, dismissHint } from '../../weather-hints-prefs.js';

export const hintText = (id) => t(`onlineWeather.hint.${id}`);

/** Applicable hints for a stored result `{last, result}` (service.lastEstimate()). */
export function hintsFor(stored) {
  return stored ? evaluateHints({ result: stored.result, observations: stored.last.observations }) : [];
}

/**
 * The hints under the weather block: up to two, warnings first, dismissed ones left out. Dismissing one removes it and
 * lets the next applicable one take its place.
 */
export function renderBlockHints(container, applicable) {
  const draw = () => {
    container.textContent = '';
    for (const h of pickHints(applicable, { dismissed: getDismissedHints() })) {
      const close = el('button', { type: 'button', class: 'link-button weather-hint-dismiss', 'aria-label': t('onlineWeather.hints.dismiss'), text: '×' });
      close.addEventListener('click', () => { dismissHint(h.id); draw(); });
      container.appendChild(el('p', { class: `hint weather-hint${h.severity === 'warn' ? ' caution' : ''}`, 'data-hint': h.id }, [hintText(h.id), ' ', close]));
    }
  };
  draw();
}

/** The dialog's section: every applicable hint, whatever was dismissed. Null when none applies. */
export function hintsSection(applicable) {
  if (!applicable.length) return null;
  return el('div', { class: 'weather-details-section' }, [
    el('h3', { text: t('onlineWeather.hints.heading') }),
    ...applicable.map((h) => el('p', { class: `hint${h.severity === 'warn' ? ' caution' : ''}`, text: hintText(h.id) })),
  ]);
}
