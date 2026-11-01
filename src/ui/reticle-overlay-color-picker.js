// Settings' reticle overlay colour selector (range-solver-prefs.js's
// RETICLE_OVERLAY_COLOR_CHOICES) — each option a swatch of the scope
// view's light glass with a hold mark on it in that colour, named
// underneath. Auto shows both of its colours, the mark split between
// them.
import { el } from '../dom.js';
import {
  RETICLE_OVERLAY_COLOR_CHOICES, RETICLE_OVERLAY_COLORS, getReticleOverlayColor, setReticleOverlayColor
} from '../range-solver-prefs.js';

function markFill(value) {
  if (value !== 'auto') return RETICLE_OVERLAY_COLORS[value];
  const { vermillion, blue } = RETICLE_OVERLAY_COLORS;
  return `linear-gradient(135deg, ${vermillion} 50%, ${blue} 50%)`;
}

export function reticleOverlayColorPicker() {
  const buttons = RETICLE_OVERLAY_COLOR_CHOICES.map((choice) => {
    const btn = el('button', { type: 'button', class: 'reticle-overlay-color-option', 'data-value': choice.value }, [
      el('span', { class: 'reticle-overlay-color-swatch' }, [
        el('span', { class: 'reticle-overlay-color-mark', style: `background:${markFill(choice.value)}` })
      ]),
      el('span', { class: 'reticle-overlay-color-label', i18n: choice.labelKey })
    ]);
    btn.addEventListener('click', () => {
      setReticleOverlayColor(choice.value);
      applyActive(choice.value);
    });
    return { value: choice.value, btn };
  });

  function applyActive(current) {
    for (const { value, btn } of buttons) {
      const active = value === current;
      btn.className = 'reticle-overlay-color-option' + (active ? ' active' : '');
      btn.setAttribute('aria-pressed', String(active));
    }
  }
  applyActive(getReticleOverlayColor());

  return el('div', { class: 'reticle-overlay-color-picker', role: 'group' }, buttons.map((b) => b.btn));
}
