// Settings' theme selector (src/range-solver-prefs.js's THEME_CHOICES) — a
// row of illustrative thumbnails rather than a plain <select>, since the
// whole point is to preview what each theme actually looks like before
// picking it. Each thumbnail is a tiny mock "screenshot" (a top bar, an
// accent badge, two text lines) built from the exact same custom
// properties the real UI uses, just scoped to that one small preview
// element via the matching .theme-* class from base.css (see that file's
// own comment on why) — so a thumbnail can never drift out of sync with
// what the theme actually looks like, and adding a fourth theme later
// needs no new swatch colors here, only a new base.css class.
import { el } from '../dom.js';
import { THEME_CHOICES, getTheme, setTheme, onThemeChange } from '../range-solver-prefs.js';

function buildSwatch(themeValue) {
  return el('span', { class: 'theme-option-swatch theme-' + themeValue }, [
    el('span', { class: 'theme-swatch-topbar' }),
    el('span', { class: 'theme-swatch-accent' }),
    el('span', { class: 'theme-swatch-line' }),
    el('span', { class: 'theme-swatch-line theme-swatch-line-short' })
  ]);
}

export function themePicker() {
  const buttons = THEME_CHOICES.map((choice) => {
    const btn = el('button', { type: 'button', class: 'theme-option' }, [
      buildSwatch(choice.value),
      el('span', { class: 'theme-option-label', i18n: choice.labelKey })
    ]);
    btn.addEventListener('click', () => setTheme(choice.value));
    return { value: choice.value, btn };
  });

  function applyActive(current) {
    for (const { value, btn } of buttons) {
      const active = value === current;
      btn.className = 'theme-option' + (active ? ' active' : '');
      btn.setAttribute('aria-pressed', String(active));
    }
  }
  applyActive(getTheme());
  onThemeChange(applyActive);

  return el('div', { class: 'theme-picker' }, buttons.map((b) => b.btn));
}
