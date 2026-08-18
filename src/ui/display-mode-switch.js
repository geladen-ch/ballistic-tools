// An unobtrusive header control (next to the language switcher) to force
// desktop or mobile chrome regardless of viewport size/orientation —
// mainly an escape hatch for the rare device layout.css's own detection
// gets wrong. "Auto" (the default) defers back to that detection
// entirely. Same shape as language-switcher.js: a plain <select>, kept in
// sync with the shared display-mode-prefs.js state everywhere it's
// mounted, and with the current UI language for its own aria-label
// (its option labels are marked i18n, so those retranslate on their own).
import { el } from '../dom.js';
import { t, onLanguageChange } from '../i18n.js';
import { DISPLAY_MODE_CHOICES, getDisplayMode, setDisplayMode, onDisplayModeChange } from '../display-mode-prefs.js';

export function mountDisplayModeSwitch(container) {
  const select = el(
    'select',
    { id: 'header-display-mode-switch', 'aria-label': t('nav.displayModeLabel') },
    DISPLAY_MODE_CHOICES.map((c) => el('option', { value: c.value, i18n: c.labelKey }))
  );
  select.value = getDisplayMode();

  select.addEventListener('change', () => {
    setDisplayMode(select.value);
  });

  onDisplayModeChange((mode) => {
    select.value = mode;
  });

  onLanguageChange(() => {
    select.setAttribute('aria-label', t('nav.displayModeLabel'));
  });

  container.appendChild(select);
}
