import { el, clear } from '../dom.js';
import { UNIT_GROUPS } from '../units.js';
import { getUnit, setUnit, resetUnits } from '../prefs.js';
import { SUPPORTED_LANGUAGES, getLanguage, changeLanguage, i18nSpan } from '../i18n.js';
import { isRifleLibraryEnabled, setRifleLibraryEnabled } from '../library-prefs.js';
import { bulletLibraryCheckboxRows } from '../ui/bullet-library-checkboxes.js';
import { SPIN_DRIFT_MODE_CHOICES, getSpinDriftMode, setSpinDriftMode } from '../spin-drift-prefs.js';
import { isZeroForSpinDriftEnabled, setZeroForSpinDriftEnabled } from '../zero-spin-drift-prefs.js';
import { isUpdateNotificationsEnabled, setUpdateNotificationsEnabled } from '../update-notification-prefs.js';
import { isTroubleshootingPaneEnabled, setTroubleshootingPaneEnabled } from '../troubleshooting-prefs.js';
import { isBackupReminderEnabled, setBackupReminderEnabled } from '../backup-reminder-state.js';
import { isIOS } from '../platform.js';
import {
  FIELD_SEPARATOR_CHOICES, DECIMAL_SEPARATOR_CHOICES,
  getFieldSeparator, setFieldSeparator, getDecimalSeparator, setDecimalSeparator
} from '../csv-prefs.js';
import { WIND_DIAL_APPEARANCE_CHOICES, getWindDialAppearance, setWindDialAppearance } from '../wind-dial-prefs.js';
import {
  INDICATOR_STYLE_CHOICES, getIndicatorStyle, setIndicatorStyle, OUTPUT_UNIT_CHOICES, getOutputUnit, setOutputUnit,
  TARGET_LABEL_VISIBILITY_CHOICES, getTargetLabelVisibility, setTargetLabelVisibility,
  SCOPE_RING_POSITION_CHOICES, getScopeRingPosition, setScopeRingPosition,
  RETICLE_OVERLAY_SHAPE_CHOICES, getReticleOverlayShape, setReticleOverlayShape,
  BDC_RANGE_DISPLAY_CHOICES, getBdcRangeDisplay, setBdcRangeDisplay
} from '../range-solver-prefs.js';
import { UI_SCALE_CHOICES, getUiScale, setUiScale } from '../ui-scale-prefs.js';
import { DRAG_MODELS } from '../engine/drag-tables.js';
import { isDragModelVisible, setDragModelVisible } from '../drag-model-prefs.js';
import { sectionGroup } from '../ui/section.js';
import { themePicker } from '../ui/theme-picker.js';
import { impactColorPicker } from '../ui/impact-color-picker.js';
import { reticleOverlayColorPicker } from '../ui/reticle-overlay-color-picker.js';
import { backupSyncSection } from '../ui/backup-sync-settings.js';
import { changeHistorySection } from '../ui/change-history-settings.js';
import { onlineWeatherSection } from '../ui/weather/online-weather-settings.js';
import { tabSwitcher } from '../ui/section-tabs.js';
import { getLastSettingsTab, setLastSettingsTab } from '../settings-tab-prefs.js';

// One tab per logical group of settings. `key` is the last segment of the tab's
// route (`/settings/<key>`), so it is part of the app's URLs and stays stable.
export const SETTINGS_TABS = [
  { key: 'interface', labelKey: 'settings.tabs.interface', introKey: 'settings.tabIntro.interface' },
  { key: 'units', labelKey: 'settings.tabs.units', introKey: 'settings.tabIntro.units' },
  { key: 'ballistics', labelKey: 'settings.tabs.ballistics', introKey: 'settings.tabIntro.ballistics' },
  { key: 'libraries', labelKey: 'settings.tabs.libraries', introKey: 'settings.tabIntro.libraries' },
  { key: 'range-solver', labelKey: 'settings.tabs.rangeSolver', introKey: 'settings.tabIntro.rangeSolver' },
  { key: 'weather', labelKey: 'settings.tabs.weather', introKey: 'settings.tabIntro.weather' },
  { key: 'data', labelKey: 'settings.tabs.data', introKey: 'settings.tabIntro.data' }
];

function isTabKey(key) {
  return SETTINGS_TABS.some((tab) => tab.key === key);
}

export function settingsTabPath(key) {
  return '/settings/' + key;
}

// A tab named by the route wins; a plain `/settings` visit opens the tab the
// user left last, and a stale or unknown remembered key falls back to the first.
function resolveInitialTab(tabKey) {
  if (isTabKey(tabKey)) return tabKey;
  const remembered = getLastSettingsTab();
  return isTabKey(remembered) ? remembered : SETTINGS_TABS[0].key;
}

// Keeps the address bar on the visible tab so the URL is always linkable,
// without a hashchange (which would re-mount the page under the user's finger).
function showTabInUrl(key) {
  try {
    history.replaceState(null, '', '#' + settingsTabPath(key));
  } catch {
    // no history API (or a locked-down frame) — the tab still works, just unlinkable
  }
}

export function mount(container, tabKey = null) {
  clear(container);
  let activeTab = resolveInitialTab(tabKey);
  setLastSettingsTab(activeTab);
  showTabInUrl(activeTab);

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

  const unitRows = Object.entries(UNIT_GROUPS).filter(([, group]) => !group.fixed).map(([groupKey, group]) => {
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
    mount(container, activeTab); // re-render so the selects reflect the reset values
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

  const bulletLibraryRows = bulletLibraryCheckboxRows();

  // Off by default (see spin-drift-prefs.js) — unlike the library toggles
  // above, this changes the actual windage numbers every windage-computing
  // tool shows, so it's opt-in rather than opt-out. A 3-way method choice
  // (not a checkbox) since Litz's classical closed-form formula and the
  // full McCoy 4-DOF (4-degree-of-freedom) physics model are both genuine
  // options a user might deliberately want, not just an on/off switch —
  // resolveSpinDriftMode() (spin-drift.js) only ever falls back off the
  // user's own choice when it isn't actually computable from the current
  // bullet/rifle data, never to silently prefer one method.
  const spinDriftModeSelect = el(
    'select',
    { id: 'settings-spin-drift-mode' },
    SPIN_DRIFT_MODE_CHOICES.map((c) => el('option', { value: c.value, i18n: c.labelKey }))
  );
  spinDriftModeSelect.value = getSpinDriftMode();

  // Nested under spin drift's own choice — off by default (see
  // zero-spin-drift-prefs.js), and only ever shown while a spin-drift
  // method is actually selected: with spin drift off there's nothing here
  // to zero out. Same "wrap the dependent row, toggle its container's
  // display" convention muzzle-velocity-temp-field.js's own
  // checkbox-reveals-fields pattern already uses, rather than a new one
  // invented just for this row.
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
  zeroForSpinDriftField.style.display = spinDriftModeSelect.value !== 'off' ? '' : 'none';

  spinDriftModeSelect.addEventListener('change', () => {
    setSpinDriftMode(spinDriftModeSelect.value);
    zeroForSpinDriftField.style.display = spinDriftModeSelect.value !== 'off' ? '' : 'none';
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

  // On by default (see backup-reminder-state.js); the reminder's own "Never
  // show again" unchecks it. Only on iOS, the one platform that shows the
  // reminder — elsewhere the row would switch nothing.
  const backupRemindersCheckbox = el('input', { type: 'checkbox', id: 'settings-backup-reminders-enabled' });
  backupRemindersCheckbox.checked = isBackupReminderEnabled();
  backupRemindersCheckbox.addEventListener('change', () => {
    setBackupReminderEnabled(backupRemindersCheckbox.checked);
  });
  const backupRemindersField = isIOS()
    ? el('div', { class: 'field' }, [
      el('label', { class: 'checkbox-field' }, [backupRemindersCheckbox, i18nSpan('settings.backupRemindersLabel')]),
      el('p', { class: 'hint', i18n: 'settings.backupRemindersHint' })
    ])
    : null;

  // Off by default (see troubleshooting-prefs.js) — gates whether Home's
  // About section shows the Troubleshooting card at all (see
  // home-view.js), not something this row itself needs to react to live.
  const troubleshootingPaneCheckbox = el('input', { type: 'checkbox', id: 'settings-show-troubleshooting-enabled' });
  troubleshootingPaneCheckbox.checked = isTroubleshootingPaneEnabled();
  troubleshootingPaneCheckbox.addEventListener('change', () => {
    setTroubleshootingPaneEnabled(troubleshootingPaneCheckbox.checked);
  });
  const troubleshootingPaneRow = el('label', { class: 'checkbox-field' }, [
    troubleshootingPaneCheckbox,
    i18nSpan('settings.showTroubleshootingLabel')
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

  // A row of plain radio buttons rather than a <input type="range">: a
  // slider re-applies `zoom` (see app.js) on every 'input' event fired
  // mid-drag, and since `zoom` reflows the whole page (see ui-scale-
  // prefs.js's own comment on why it's `zoom` and not `transform`), each
  // of those intermediate values repaints the entire interface — a slider
  // dragged from 100 to 200 visibly flickers through 125/150/175 along
  // the way. Radios only ever commit on a discrete selection, so the
  // interface repaints exactly once, to the value actually chosen.
  const uiScaleOptions = UI_SCALE_CHOICES.map((value) => {
    const id = `settings-ui-scale-${value}`;
    const radio = el('input', { type: 'radio', name: 'settings-ui-scale', id, value });
    radio.checked = value === getUiScale();
    radio.addEventListener('change', () => setUiScale(value));
    return el('label', { for: id, class: 'ui-scale-option' }, [radio, el('span', { text: `${value}%` })]);
  });
  const uiScalePicker = el('div', { class: 'ui-scale-picker' }, uiScaleOptions);

  const outputUnitSelect = el(
    'select',
    { id: 'settings-range-solver-output-unit' },
    OUTPUT_UNIT_CHOICES.map((c) => el('option', { value: c.value, i18n: c.labelKey }))
  );
  outputUnitSelect.value = getOutputUnit();
  outputUnitSelect.addEventListener('change', () => setOutputUnit(outputUnitSelect.value));

  const labelVisibilitySelect = el(
    'select',
    { id: 'settings-range-solver-label-visibility' },
    TARGET_LABEL_VISIBILITY_CHOICES.map((c) => el('option', { value: c.value, i18n: c.labelKey }))
  );
  labelVisibilitySelect.value = getTargetLabelVisibility();
  labelVisibilitySelect.addEventListener('change', () => setTargetLabelVisibility(labelVisibilitySelect.value));

  const scopeRingSelect = el(
    'select',
    { id: 'settings-range-solver-scope-ring' },
    SCOPE_RING_POSITION_CHOICES.map((c) => el('option', { value: c.value, i18n: c.labelKey }))
  );
  scopeRingSelect.value = getScopeRingPosition();
  scopeRingSelect.addEventListener('change', () => setScopeRingPosition(scopeRingSelect.value));

  const overlayShapeSelect = el(
    'select',
    { id: 'settings-reticle-overlay-shape' },
    RETICLE_OVERLAY_SHAPE_CHOICES.map((c) => el('option', { value: c.value, i18n: c.labelKey }))
  );
  overlayShapeSelect.value = getReticleOverlayShape();
  overlayShapeSelect.addEventListener('change', () => setReticleOverlayShape(overlayShapeSelect.value));

  const bdcRangeDisplaySelect = el(
    'select',
    { id: 'settings-bdc-range-display' },
    BDC_RANGE_DISPLAY_CHOICES.map((c) => el('option', { value: c.value, i18n: c.labelKey }))
  );
  bdcRangeDisplaySelect.value = getBdcRangeDisplay();
  bdcRangeDisplaySelect.addEventListener('change', () => setBdcRangeDisplay(bdcRangeDisplaySelect.value));

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

  const interfaceAppearanceSection = sectionGroup('settings.appearanceHeading', [
    el('div', { class: 'field' }, [
      el('label', { i18n: 'settings.themeLabel' }),
      themePicker()
    ]),
    el('div', { class: 'field' }, [
      el('label', { i18n: 'settings.uiScaleLabel' }),
      uiScalePicker
    ]),
    el('div', { class: 'field' }, [
      el('label', { i18n: 'settings.impactColorLabel' }),
      impactColorPicker()
    ]),
    el('div', { class: 'field' }, [
      el('label', { i18n: 'settings.windDialAppearanceLabel' }),
      windDialAppearanceSelect
    ])
  ]);

  const interfaceApplicationSection = sectionGroup('settings.applicationHeading', [
    el('div', { class: 'field' }, [
      el('label', { i18n: 'settings.languageLabel' }),
      languageSelect
    ]),
    el('div', { class: 'field' }, [updateNotificationsRow]),
    el('div', { class: 'field' }, [troubleshootingPaneRow])
  ]);

  const spinDriftSection = sectionGroup('settings.spinDriftHeading', [
    el('div', { class: 'field' }, [
      el('label', { i18n: 'settings.spinDriftLabel' }),
      spinDriftModeSelect
    ]),
    zeroForSpinDriftField
  ]);

  const rangeSolverOutputSection = sectionGroup('settings.rangeSolverOutputHeading', [
    el('div', { class: 'field' }, [
      el('label', { i18n: 'settings.rangeSolverOutputLabel' }),
      outputUnitSelect
    ]),
    el('div', { class: 'field' }, [
      el('label', { i18n: 'settings.rangeSolverIndicatorLabel' }),
      indicatorStyleSelect
    ]),
    el('div', { class: 'field' }, [
      el('label', { i18n: 'settings.rangeSolverLabelVisibilityLabel' }),
      labelVisibilitySelect,
      el('p', { class: 'hint', i18n: 'settings.rangeSolverLabelVisibilityHint' })
    ])
  ]);

  const rangeSolverScopeSection = sectionGroup('settings.rangeSolverScopeHeading', [
    el('div', { class: 'field' }, [
      el('label', { i18n: 'settings.rangeSolverScopeRingLabel' }),
      scopeRingSelect
    ]),
    el('div', { class: 'field' }, [
      el('label', { i18n: 'settings.reticleOverlayColorLabel' }),
      reticleOverlayColorPicker(),
      el('p', { class: 'hint', i18n: 'settings.reticleOverlayColorHint' })
    ]),
    el('div', { class: 'field' }, [
      el('label', { i18n: 'settings.reticleOverlayShapeLabel' }),
      overlayShapeSelect
    ]),
    el('div', { class: 'field' }, [
      el('label', { i18n: 'settings.bdcRangeDisplayLabel' }),
      bdcRangeDisplaySelect,
      el('p', { class: 'hint', i18n: 'settings.bdcRangeDisplayHint' })
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

  const rifleLibrarySection = sectionGroup('settings.rifleLibraryHeading', [
    el('p', { class: 'hint', i18n: 'settings.rifleLibraryHint' }),
    el('div', { class: 'field' }, [rifleLibraryRow])
  ]);

  const bulletLibrariesSection = sectionGroup('settings.bulletLibrariesHeading', [
    ...bulletLibraryRows.map((r) => r.field)
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

  // A sync cycle, a manual import, or a resolved conflict — all handled
  // inside backupSyncSection() — can add change-history entries just like
  // any local edit; wiring its refresh() in as backupSyncSection()'s
  // onSyncApplied is what makes those show up immediately in this same
  // page, rather than only after Settings is next reopened.
  const { node: changeHistoryNode, refresh: refreshChangeHistory } = changeHistorySection();

  // The backup reminder is iOS-only, so on other platforms its block is absent.
  const backupReminderSection = backupRemindersField
    ? sectionGroup('settings.backupRemindersHeading', [backupRemindersField])
    : null;

  // Each tab is a set of blocks laid out side by side where there is room.
  const tabBlocks = {
    'interface': [interfaceAppearanceSection, interfaceApplicationSection],
    'units': [unitsSection, csvSection],
    'ballistics': [spinDriftSection],
    'libraries': [rifleLibrarySection, bulletLibrariesSection, dragModelsSection],
    'range-solver': [rangeSolverOutputSection, rangeSolverScopeSection],
    'weather': [onlineWeatherSection().node],
    'data': [backupSyncSection(refreshChangeHistory), changeHistoryNode, backupReminderSection]
  };

  const panels = {};
  for (const tab of SETTINGS_TABS) {
    panels[tab.key] = el('div', { class: 'settings-panel', id: 'settings-panel-' + tab.key }, [
      el('p', { class: 'settings-tab-intro', i18n: tab.introKey }),
      el('div', { class: 'settings-blocks' }, tabBlocks[tab.key].filter(Boolean))
    ]);
  }

  const tabBar = tabSwitcher(SETTINGS_TABS, panels, (key) => {
    activeTab = key;
    setLastSettingsTab(key);
    showTabInUrl(key);
  }, activeTab);

  container.appendChild(el('div', {}, [
    el('h1', { i18n: 'settings.title' }),
    tabBar.node,
    ...SETTINGS_TABS.map((tab) => panels[tab.key])
  ]));
}
