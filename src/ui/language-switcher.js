import { el } from '../dom.js';
import { SUPPORTED_LANGUAGES, getLanguage, changeLanguage, onLanguageChange, t } from '../i18n.js';

// A persistent, always-visible language control for the app header — in
// addition to the same choice on the Settings page. Both write through
// the same changeLanguage()/onLanguageChange() pair in i18n.js, so
// picking a language in either place keeps the other in sync and updates
// whatever view is currently on screen.
export function mountLanguageSwitcher(container) {
  const select = el(
    'select',
    { id: 'header-language-switcher', 'aria-label': t('settings.languageLabel') },
    // Endonyms — each language names itself, not translated by the
    // current UI language (same rule as the Settings page picker).
    SUPPORTED_LANGUAGES.map((lang) => el('option', { value: lang.code, text: lang.label }))
  );
  select.value = getLanguage();

  select.addEventListener('change', () => {
    changeLanguage(select.value);
  });

  onLanguageChange((lang) => {
    select.value = lang;
    select.setAttribute('aria-label', t('settings.languageLabel'));
  });

  container.appendChild(select);
}
