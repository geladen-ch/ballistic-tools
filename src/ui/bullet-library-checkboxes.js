import { el } from '../dom.js';
import { t, i18nSpan } from '../i18n.js';
import { loadBulletLibraries } from '../bullets.js';
import { isBulletLibraryVisible, setBulletLibraryVisible } from '../bullet-library-prefs.js';

// One checkbox+description row per known built-in bullet library — shared
// by settings-view.js (the canonical place to manage this) and
// bullet-section.js (duplicated inline wherever a bullet input is
// expected, same convention the old single boolean toggle used), so both
// places render and behave identically instead of maintaining two
// implementations. `onChange` is called after a library's cookie is
// updated, letting each caller recompute whatever it derives from
// visibility (a picker's option list, its own visibility, etc.).
export function bulletLibraryCheckboxRows(onChange) {
  return loadBulletLibraries().map((lib) => {
    const checkbox = el('input', { type: 'checkbox', id: 'bullet-library-' + lib.id });
    checkbox.checked = isBulletLibraryVisible(lib.id);
    checkbox.addEventListener('change', () => {
      setBulletLibraryVisible(lib.id, checkbox.checked);
      if (onChange) onChange();
    });
    const row = el('label', { class: 'checkbox-field' }, [checkbox, i18nSpan(lib.nameKey)]);
    const field = el('div', { class: 'field' }, [row, el('p', { class: 'hint', text: t(lib.descriptionKey) })]);
    return { id: lib.id, checkbox, row, field };
  });
}
