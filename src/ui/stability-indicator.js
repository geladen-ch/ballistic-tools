import { el, clear } from '../dom.js';
import { t } from '../i18n.js';
import { collapsibleHint } from './collapsible-hint.js';
import { computeMillerSg, canComputeStability, stabilityStatus } from '../engine/stability.js';

const LABEL_KEYS = { stable: 'stability.stable', marginal: 'stability.marginal', unstable: 'stability.unstable' };

// One shared traffic-light indicator for Miller's-formula bullet
// stability, reused everywhere a rifle+cartridge+bullet combination is in
// view (Guns > Custom, Arsenal's cartridge form, "Your rifles"). Several
// instances can be on one page at once (e.g. one per cartridge row in
// "Your rifles") — like status-chip.js's own chips, this deliberately
// uses plain `text: t(...)` rather than the `i18n` prop, whose
// applyI18nText() would stamp the same derived id onto every instance.
export function stabilityIndicator() {
  const node = el('div', { class: 'stability-indicator' });
  // Built once, not per-update() — update() tears down and rebuilds
  // `node`'s contents on every call, but re-appending these same two
  // nodes (rather than building fresh ones) keeps whatever expand/collapse
  // state the user left the hint in, even across further recomputes.
  const helpToggle = collapsibleHint({
    toggleLabel: t('stability.unknownHintToggle'),
    hintText: t('stability.unknownHint')
  });

  function update(inputs) {
    clear(node);
    if (!canComputeStability(inputs)) {
      node.appendChild(el('div', { class: 'hint-row' }, [
        el('span', { class: 'status-chip status-chip-unknown', text: t('stability.unknown') }),
        helpToggle.button
      ]));
      node.appendChild(helpToggle.hint);
      return;
    }
    const sg = computeMillerSg(inputs);
    const status = stabilityStatus(sg);
    node.appendChild(el('span', {
      class: `status-chip status-chip-${status}`,
      text: `Sg ${sg.toFixed(2)} · ${t(LABEL_KEYS[status])}`
    }));
  }

  return { node, update };
}
