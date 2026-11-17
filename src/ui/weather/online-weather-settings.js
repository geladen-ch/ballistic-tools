// Settings → "Online weather services": the on/off checkbox and, while it is on, the search radius, the maximum report
// age, the two estimation switches, one Auto/Off mode per service with its availability hint, a "Check availability"
// button, the "unusable" hint, and a button that clears the downloaded station lists. Reachability is checked here and
// nowhere else: when the block is shown with the feature on, when the feature is switched on, when a service is switched
// to Auto, and when the button is pressed.
import { el } from '../../dom.js';
import { t, i18nSpan } from '../../i18n.js';
import { sectionGroup } from '../section.js';
import { unitField } from '../unit-field.js';
import { FIELD_BOUNDS } from '../../units.js';
import { kmToM } from '../../quantity.js';
import {
  getOnlineWeatherSettings, updateOnlineWeatherSettings, setServiceMode
} from '../../online-weather-prefs.js';
import { getWeatherRuntime } from '../../weather/runtime.js';
import { sourceMode } from '../../weather/activation.js';
import { anyAutoAvailable } from '../../weather/availability.js';

const timeText = (ms) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const within = (v, { min, max }) => Number.isFinite(v) && v >= min && v <= max;

function checkboxRow(id, labelKey, checked, onChange, hintKey) {
  const box = el('input', { type: 'checkbox', id });
  box.checked = checked;
  box.addEventListener('change', () => onChange(box.checked));
  return el('div', { class: 'field weather-check-field' }, [
    el('label', { class: 'checkbox-field' }, [box, i18nSpan(labelKey)]),
    hintKey ? el('p', { class: 'hint', i18n: hintKey }) : null
  ]);
}

/** One credit line of a service: the provider's own wording, with its links. */
export function creditNode(source) {
  const credits = source.credits ?? { text: source.attribution };
  const p = el('p', { class: 'hint' });
  if (credits.url) p.appendChild(el('a', { href: credits.url, target: '_blank', rel: 'noopener', text: credits.text }));
  else p.appendChild(document.createTextNode(credits.text));
  for (const link of credits.links ?? []) {
    p.appendChild(document.createTextNode(' · '));
    p.appendChild(el('a', { href: link.url, target: '_blank', rel: 'noopener', text: link.text }));
  }
  return p;
}

/**
 * @returns {{node: HTMLElement}}
 */
export function onlineWeatherSection() {
  const { availability, cache, sources } = getWeatherRuntime();
  const settings = getOnlineWeatherSettings();

  // ---- fields ----
  const radiusField = unitField({
    id: 'weatherSearchRadius', ...FIELD_BOUNDS.weatherSearchRadius, step: kmToM(10), value: settings.searchRadiusM,
    onInput: () => {
      const v = radiusField.getEngineValue();
      if (within(v, FIELD_BOUNDS.weatherSearchRadius)) updateOnlineWeatherSettings({ searchRadiusM: v });
    }
  });
  const ageField = unitField({
    id: 'weatherMaxAge', ...FIELD_BOUNDS.weatherMaxAge, step: 300, value: settings.maxAgeS,
    onInput: () => {
      const v = ageField.getEngineValue();
      if (within(v, FIELD_BOUNDS.weatherMaxAge)) updateOnlineWeatherSettings({ maxAgeS: v });
    }
  });

  // ---- services ----
  const autoSources = () => sources.filter((s) => sourceMode(s, getOnlineWeatherSettings().sources) === 'auto');
  const hintNodes = new Map();
  const serviceRows = sources.map((source) => {
    const select = el('select', { id: `settings-online-weather-mode-${source.id}`, class: 'weather-mode-select' }, [
      el('option', { value: 'auto', i18n: 'onlineWeather.modeAuto' }),
      el('option', { value: 'off', i18n: 'onlineWeather.modeOff' })
    ]);
    select.value = sourceMode(source, settings.sources);
    select.addEventListener('change', () => {
      setServiceMode(source.id, select.value, sourceMode(source, {}));
      refreshAvailabilityHints();
      if (select.value === 'auto') availability.check([source], { force: true });
    });
    const hint = el('p', { class: 'hint', id: `settings-online-weather-availability-${source.id}` });
    hintNodes.set(source.id, hint);
    return el('div', { class: 'field weather-service-row' }, [
      el('label', {}, [i18nSpan(`onlineWeather.sources.${source.id}`), select]),
      creditNode(source),
      source.autoDefault === false ? el('p', { class: 'hint', i18n: 'onlineWeather.notValidated' }) : null,
      hint
    ]);
  });

  const unusableHint = el('p', { class: 'hint warning', id: 'settings-online-weather-unusable' });
  const checkButton = el('button', { class: 'secondary section-button', id: 'settings-online-weather-check', i18n: 'onlineWeather.checkButton' });
  const checkStatus = el('span', { class: 'hint', id: 'settings-online-weather-check-status' });

  function availabilityText(source) {
    if (sourceMode(source, getOnlineWeatherSettings().sources) !== 'auto') return '';
    const a = availability.get(source);
    if (a.state === 'checking') return t('onlineWeather.availability.checking');
    if (a.state === 'unknown') return '';
    return t(`onlineWeather.availability.${a.state}`, { time: timeText(a.checkedAt) });
  }

  function refreshAvailabilityHints() {
    const chosen = getOnlineWeatherSettings().sources;
    for (const s of sources) hintNodes.get(s.id).textContent = availabilityText(s);
    const anyChecking = sources.some((s) => sourceMode(s, chosen) === 'auto' && availability.get(s).state === 'checking');
    checkButton.disabled = anyChecking;
    checkStatus.textContent = anyChecking ? t('onlineWeather.availability.checking') : '';
    // Unusable once every Auto service has answered and none is reachable (or none is set to Auto).
    const usable = anyAutoAvailable(sources, (s) => sourceMode(s, chosen), availability);
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    unusableHint.textContent = !anyChecking && !usable ? t(offline ? 'onlineWeather.unusableOffline' : 'onlineWeather.unusable') : '';
    unusableHint.style.display = unusableHint.textContent ? '' : 'none';
  }

  checkButton.addEventListener('click', () => availability.check(autoSources(), { force: true }));

  const clearButton = el('button', { class: 'secondary section-button', id: 'settings-online-weather-clear-cache', i18n: 'onlineWeather.clearCacheButton' });
  const clearStatus = el('span', { class: 'hint' });
  clearButton.addEventListener('click', async () => {
    await cache.clear();
    clearStatus.textContent = t('onlineWeather.cacheCleared');
  });

  // ---- body (only while the feature is on) ----
  const body = el('div', { id: 'settings-online-weather-body' }, [
    radiusField.node,
    ageField.node,
    checkboxRow('settings-online-weather-combine', 'onlineWeather.combineLabel', settings.combine,
      (v) => updateOnlineWeatherSettings({ combine: v }), 'onlineWeather.combineHint'),
    checkboxRow('settings-online-weather-time-correct', 'onlineWeather.timeCorrectLabel', settings.timeCorrect,
      (v) => updateOnlineWeatherSettings({ timeCorrect: v }), 'onlineWeather.timeCorrectHint'),
    el('h4', { i18n: 'onlineWeather.servicesHeading' }),
    el('p', { class: 'hint', i18n: 'onlineWeather.servicesHint' }),
    ...serviceRows,
    el('div', { class: 'field' }, [checkButton, checkStatus]),
    unusableHint,
    el('div', { class: 'field' }, [
      el('p', { class: 'hint', i18n: 'onlineWeather.clearCacheHint' }),
      clearButton, clearStatus
    ])
  ]);

  function showBody(on) {
    body.style.display = on ? '' : 'none';
    if (!on) return;
    availability.check(autoSources());            // services without a valid result (30 minutes) are asked now
    refreshAvailabilityHints();
  }

  const enabled = checkboxRow('settings-online-weather-enabled', 'onlineWeather.enabledLabel', settings.enabled, (on) => {
    updateOnlineWeatherSettings({ enabled: on });
    showBody(on);
  }, 'onlineWeather.privacyHint');

  // A re-rendered page (language change) leaves this block detached: it stops listening once it has been attached and
  // is no longer. (A block not yet attached, or in a DOM without isConnected, keeps listening.)
  let wasAttached = false;
  const unsubscribe = availability.onChange(() => {
    if (body.isConnected) wasAttached = true;
    else if (wasAttached) { unsubscribe(); return; }
    refreshAvailabilityHints();
  });

  const node = sectionGroup('onlineWeather.heading', [enabled, body]);
  showBody(settings.enabled);
  return { node };
}
