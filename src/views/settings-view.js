import { el, clear } from '../dom.js';
import { UNIT_GROUPS } from '../units.js';
import { getUnit, setUnit, resetUnits } from '../prefs.js';
import { SUPPORTED_LANGUAGES, getLanguage, changeLanguage, i18nSpan } from '../i18n.js';
import { isRifleLibraryEnabled, setRifleLibraryEnabled, isBulletLibraryEnabled, setBulletLibraryEnabled } from '../library-prefs.js';
import { isSpinDriftEnabled, setSpinDriftEnabled } from '../spin-drift-prefs.js';
import { isZeroForSpinDriftEnabled, setZeroForSpinDriftEnabled } from '../zero-spin-drift-prefs.js';
import { isUpdateNotificationsEnabled, setUpdateNotificationsEnabled } from '../update-notification-prefs.js';
import {
  FIELD_SEPARATOR_CHOICES, DECIMAL_SEPARATOR_CHOICES,
  getFieldSeparator, setFieldSeparator, getDecimalSeparator, setDecimalSeparator
} from '../csv-prefs.js';
import { WIND_DIAL_APPEARANCE_CHOICES, getWindDialAppearance, setWindDialAppearance } from '../wind-dial-prefs.js';
import { INDICATOR_STYLE_CHOICES, getIndicatorStyle, setIndicatorStyle } from '../range-solver-prefs.js';
import { DRAG_MODELS } from '../engine/drag-tables.js';
import { isDragModelVisible, setDragModelVisible } from '../drag-model-prefs.js';
import { sectionGroup } from '../ui/section.js';
import { themePicker } from '../ui/theme-picker.js';

export function mount(container) {
  clear(container);

  const languageSelect = el(
    'select',
    { id: 'settings-language' },
    // Each language's own name is written in that language (an endonym),
    // not translated into the current UI language — that's how every
    // language picker on the web works, so "Français" reads correctly no
    // matter what language is currently active.
    SUPPORTED_LANGUAGES.map((lang) => el('option', { value: lang.code, text: lang.label }))
  );
  languageSelect.value = getLanguage();
  languageSelect.addEventListener('change', () => {
    // No manual re-mount here: app.js re-renders whatever view is showing
    // on every language change (see onLanguageChange in app.js), which
    // covers this page too since it's the one currently mounted.
    changeLanguage(languageSelect.value);
  });

  const unitRows = Object.entries(UNIT_GROUPS).map(([groupKey, group]) => {
    const select = el(
      'select',
      { id: 'unit-' + groupKey },
      group.choices.map((c) => el('option', { value: c.unit, text: c.label }))
    );
    select.value = getUnit(groupKey);
    select.addEventListener('change', () => setUnit(groupKey, select.value));
    return el('div', { class: 'field' }, [
      el('label', { i18n: 'settings.groups.' + groupKey }),
      select
    ]);
  });

  const resetButton = el('button', { class: 'secondary section-button', i18n: 'settings.resetButton' });
  resetButton.addEventListener('click', () => {
    resetUnits();
    mount(container); // re-render so the selects reflect the reset values
  });

  // This checkbox is also duplicated inline in rifle-section.js/
  // bullet-section.js themselves (wherever a rifle/bullet input is
  // expected), all reading and writing the same cookie — whichever one
  // the user touches, the others pick it up at their own next mount.
  const rifleLibraryCheckbox = el('input', { type: 'checkbox', id: 'settings-rifle-library-enabled' });
  rifleLibraryCheckbox.checked = isRifleLibraryEnabled();
  rifleLibraryCheckbox.addEventListener('change', () => {
    setRifleLibraryEnabled(rifleLibraryCheckbox.checked);
  });
  const rifleLibraryRow = el('label', { class: 'checkbox-field' }, [
    rifleLibraryCheckbox,
    i18nSpan('settings.rifleLibraryLabel')
  ]);

  const bulletLibraryCheckbox = el('input', { type: 'checkbox', id: 'settings-bullet-library-enabled' });
  bulletLibraryCheckbox.checked = isBulletLibraryEnabled();
  bulletLibraryCheckbox.addEventListener('change', () => {
    setBulletLibraryEnabled(bulletLibraryCheckbox.checked);
  });
  const bulletLibraryRow = el('label', { class: 'checkbox-field' }, [
    bulletLibraryCheckbox,
    i18nSpan('settings.bulletLibraryLabel')
  ]);

  // Off by default (see spin-drift-prefs.js) — unlike the library toggles
  // above, this changes the actual windage numbers every windage-computing
  // tool shows, so it's opt-in rather than opt-out.
  const spinDriftCheckbox = el('input', { type: 'checkbox', id: 'settings-spin-drift-enabled' });
  spinDriftCheckbox.checked = isSpinDriftEnabled();
  const spinDriftRow = el('label', { class: 'checkbox-field' }, [
    spinDriftCheckbox,
    i18nSpan('settings.spinDriftLabel')
  ]);

  // Nested under spin drift's own checkbox — off by default (see
  // zero-spin-drift-prefs.js), and only ever shown while spin drift itself
  // is on: with spin drift off there's nothing here to zero out. Same
  // "wrap the dependent row, toggle its container's display" convention
  // muzzle-velocity-temp-field.js's own checkbox-reveals-fields pattern
  // already uses, rather than a new one invented just for this row.
  const zeroForSpinDriftCheckbox = el('input', { type: 'checkbox', id: 'settings-zero-for-spin-drift-enabled' });
  zeroForSpinDriftCheckbox.checked = isZeroForSpinDriftEnabled();
  zeroForSpinDriftCheckbox.addEventListener('change', () => {
    setZeroForSpinDriftEnabled(zeroForSpinDriftCheckbox.checked);
  });
  const zeroForSpinDriftRow = el('label', { class: 'checkbox-field' }, [
    zeroForSpinDriftCheckbox,
    i18nSpan('settings.zeroForSpinDriftLabel')
  ]);
  const zeroForSpinDriftField = el('div', { class: 'field' }, [zeroForSpinDriftRow]);
  zeroForSpinDriftField.style.display = spinDriftCheckbox.checked ? '' : 'none';

  spinDriftCheckbox.addEventListener('change', () => {
    setSpinDriftEnabled(spinDriftCheckbox.checked);
    zeroForSpinDriftField.style.display = spinDriftCheckbox.checked ? '' : 'none';
  });

  // On by default (see update-notification-prefs.js) — this is the
  // checkbox update-notifications.js's own "Never show again" buttons
  // uncheck for the user; re-checking it here re-enables both dialogs.
  const updateNotificationsCheckbox = el('input', { type: 'checkbox', id: 'settings-update-notifications-enabled' });
  updateNotificationsCheckbox.checked = isUpdateNotificationsEnabled();
  updateNotificationsCheckbox.addEventListener('change', () => {
    setUpdateNotificationsEnabled(updateNotificationsCheckbox.checked);
  });
  const updateNotificationsRow = el('label', { class: 'checkbox-field' }, [
    updateNotificationsCheckbox,
    i18nSpan('settings.updateNotificationsLabel')
  ]);

  const windDialAppearanceSelect = el(
    'select',
    { id: 'settings-wind-dial-appearance' },
    WIND_DIAL_APPEARANCE_CHOICES.map((c) => el('option', { value: c.value, i18n: c.labelKey }))
  );
  windDialAppearanceSelect.value = getWindDialAppearance();
  windDialAppearanceSelect.addEventListener('change', () => setWindDialAppearance(windDialAppearanceSelect.value));

  const indicatorStyleSelect = el(
    'select',
    { id: 'settings-range-solver-indicator-style' },
    INDICATOR_STYLE_CHOICES.map((c) => el('option', { value: c.value, i18n: c.labelKey }))
  );
  indicatorStyleSelect.value = getIndicatorStyle();
  indicatorStyleSelect.addEventListener('change', () => setIndicatorStyle(indicatorStyleSelect.value));

  // One checkbox per known standard drag model (see engine/drag-tables.js's
  // DRAG_MODELS) — data-driven so a future model added there gets a
  // checkbox here for free. At least one must always stay checked (every
  // ballistic-model <select> in the app would otherwise have nothing to
  // offer), enforced by disabling the sole remaining checked checkbox
  // rather than letting it be unchecked.
  const dragModelRows = DRAG_MODELS.map((m) => {
    const checkbox = el('input', { type: 'checkbox', id: 'settings-drag-model-' + m.id });
    checkbox.checked = isDragModelVisible(m.id);
    checkbox.addEventListener('change', () => {
      setDragModelVisible(m.id, checkbox.checked);
      refreshDragModelCheckboxes();
    });
    return {
      id: m.id,
      checkbox,
      row: el('label', { class: 'checkbox-field' }, [checkbox, i18nSpan(m.labelKey)])
    };
  });
  function refreshDragModelCheckboxes() {
    const checkedCount = dragModelRows.filter((r) => r.checkbox.checked).length;
    for (const r of dragModelRows) r.checkbox.disabled = r.checkbox.checked && checkedCount <= 1;
  }
  refreshDragModelCheckboxes();

  const generalSection = sectionGroup('settings.generalHeading', [
    el('div', { class: 'field' }, [
      el('label', { i18n: 'settings.languageLabel' }),
      languageSelect
    ]),
    el('div', { class: 'field' }, [rifleLibraryRow]),
    el('div', { class: 'field' }, [bulletLibraryRow]),
    el('div', { class: 'field' }, [spinDriftRow]),
    zeroForSpinDriftField,
    el('div', { class: 'field' }, [updateNotificationsRow]),
    el('div', { class: 'field' }, [
      el('label', { i18n: 'settings.windDialAppearanceLabel' }),
      windDialAppearanceSelect
    ]),
    el('div', { class: 'field' }, [
      el('label', { i18n: 'settings.themeLabel' }),
      themePicker()
    ]),
    el('div', { class: 'field' }, [
      el('label', { i18n: 'settings.rangeSolverIndicatorLabel' }),
      indicatorStyleSelect
    ])
  ]);

  const unitsSection = sectionGroup('settings.unitsHeading', [
    ...unitRows,
    resetButton
  ]);

  const dragModelsSection = sectionGroup('settings.dragModelsHeading', [
    el('p', { class: 'hint', i18n: 'settings.dragModelsHint' }),
    ...dragModelRows.map((r) => el('div', { class: 'field' }, [r.row]))
  ]);

  // Only affects the Trajectory table's "export to CSV" button (see
  // trajectory-view.js) — nothing else in the app reads these.
  const fieldSeparatorSelect = el(
    'select',
    { id: 'settings-csv-field-separator' },
    FIELD_SEPARATOR_CHOICES.map((c) => el('option', { value: c.value, i18n: c.labelKey }))
  );
  fieldSeparatorSelect.value = getFieldSeparator();
  fieldSeparatorSelect.addEventListener('change', () => setFieldSeparator(fieldSeparatorSelect.value));

  const decimalSeparatorSelect = el(
    'select',
    { id: 'settings-csv-decimal-separator' },
    DECIMAL_SEPARATOR_CHOICES.map((c) => el('option', { value: c.value, i18n: c.labelKey }))
  );
  decimalSeparatorSelect.value = getDecimalSeparator();
  decimalSeparatorSelect.addEventListener('change', () => setDecimalSeparator(decimalSeparatorSelect.value));

  const csvSection = sectionGroup('settings.csvExportHeading', [
    el('div', { class: 'field' }, [
      el('label', { i18n: 'settings.csvFieldSeparatorLabel' }),
      fieldSeparatorSelect
    ]),
    el('div', { class: 'field' }, [
      el('label', { i18n: 'settings.csvDecimalSeparatorLabel' }),
      decimalSeparatorSelect
    ]),
    el('p', { class: 'hint', i18n: 'settings.csvSeparatorHint' })
  ]);

  container.appendChild(el('div', {}, [
    el('h1', { i18n: 'settings.title' }),
    el('p', { i18n: 'settings.intro' }),
    el('div', { class: 'card', style: 'max-width:420px;' }, [
      generalSection,
      unitsSection,
      dragModelsSection,
      csvSection
    ])
  ]));
}
