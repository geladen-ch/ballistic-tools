// The "Get weather" block of the Trajectory and Range Solver atmosphere sections: the position the weather is for
// (latitude, longitude, altitude, with a GPS button), the Get weather / Refresh button with its status and hint lines,
// and — Range Solver only — the "use this location's coordinates" choice and the offer to save the measured ones.
//
// Shown only while the online weather feature is on and at least one Auto service is not known to be unreachable
// (isOnlineWeatherUsable()). The button itself appears only for a complete, valid position. Nothing is ever fetched
// by itself: every request is a press of the button. Reachability is never checked here; a failed fetch points to
// Settings, where the check lives. SI inside; the fields convert at their edge.
import { el } from '../../dom.js';
import { t } from '../../i18n.js';
import { unitField } from '../unit-field.js';
import { FIELD_BOUNDS, formatFieldValue, UNIT_GROUPS } from '../../units.js';
import { getUnit } from '../../prefs.js';
import { degToRad, sToMin } from '../../quantity.js';
import { isOnlineWeatherUsable } from '../../weather/runtime.js';
import { createWeatherService, ALTITUDE_CHANGE_M } from '../../weather/service.js';
import { locateGps, geoErrorCode, parseLatLon, isValidPosition } from '../../weather/location.js';
import { haversineM } from '../../weather/geo.js';
import { getDevicePosition, setDevicePosition, isValidAltitude, DEFAULT_DEVICE_POSITION } from '../../device-position-state.js';
import { formatCoordinates, hasCoordinates } from '../locations/coordinates-text.js';
import { showStationDetails } from './station-details.js';
import { hintsFor as countryHintsFor, renderBlockHints } from './weather-hints.js';

/** Range Solver's save offer: strictly more than this horizontally or vertically differs from the location's own. */
export const SAVE_OFFER_HORIZONTAL_M = 100;
export const SAVE_OFFER_VERTICAL_M = 50;

const timeText = (ms) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const lengthText = (fieldId, m) => {
  const group = UNIT_GROUPS.altitude;
  const unit = getUnit('altitude');
  return formatFieldValue(fieldId, m, group.choices.some((c) => c.unit === unit) ? unit : group.defaultUnit);
};

/** Does a location hold a full position (latitude, longitude and altitude)? */
export function locationHasFullPosition(loc) {
  return hasCoordinates(loc) && Number.isFinite(loc.altitudeM);
}

/**
 * Should the save offer show? The measured position `p` against location `loc`: the location lacks a part, or the
 * horizontal distance exceeds 100 m, or the altitudes differ by more than 50 m.
 */
export function wantsSaveOffer(loc, p) {
  if (!loc || !p) return false;
  if (!locationHasFullPosition(loc)) return true;
  return haversineM(loc.latitudeRad, loc.longitudeRad, p.latRad, p.lonRad) > SAVE_OFFER_HORIZONTAL_M
    || Math.abs(loc.altitudeM - p.altitudeM) > SAVE_OFFER_VERTICAL_M;
}

const PROGRESS_KEY = {
  loadingNetworkIndex: 'stations', loadingStationList: 'stations', loadingUsStationList: 'stations',
  loadingStationListOf: 'stations', loadingSynopList: 'synopList', loadingCurrents: 'reports', loadingCurrentsOf: 'reports',
  loadingStation: 'reports', loadingSynopCurrents: 'reports', loadingUsCurrents: 'reports', loadingSchedule: 'schedule',
};

/**
 * @param {{
 *   applyValues: (v:{tempC?:number, pressurePa?:number, humidity?:number}) => void,
 *   locationSource?: {getLocation: () => object|null, saveCoordinates: (loc:object, p:{latRad:number, lonRad:number, altitudeM:number}) => void}|null,
 *   service?: object,
 *   defaultPosition?: {latRad:number, lonRad:number, altitudeM:number}|null
 * }} o
 *   locationSource: Range Solver only — the active location (re-read on every call) and how to store coordinates in it
 * @returns {{node: HTMLElement, noteValuesEdited: () => void, usable: boolean}}
 */
export function weatherBlock({ applyValues, locationSource = null, service = null, defaultPosition = DEFAULT_DEVICE_POSITION }) {
  const node = el('div', { class: 'weather-block' });
  if (!isOnlineWeatherUsable()) {
    node.hidden = true;
    return { node, noteValuesEdited() {}, usable: false };
  }
  const svc = service ?? createWeatherService();

  // ---- position inputs ----
  const saved = getDevicePosition();
  const startLoc = locationSource?.getLocation() ?? null;
  // A remembered value first, then the active location's own, then the built-in default (none where `defaultPosition` is null).
  const prefill = (own, fromLocation, fallback) => own ?? (Number.isFinite(fromLocation) ? fromLocation : (fallback ?? null));
  const latField = unitField({
    id: 'latitudeRad', ...FIELD_BOUNDS.latitudeRad, step: degToRad(0.0001), optional: true,
    value: prefill(saved.latRad, startLoc?.latitudeRad, defaultPosition?.latRad), onInput: () => positionEdited(),
  });
  const lonField = unitField({
    id: 'longitudeRad', ...FIELD_BOUNDS.longitudeRad, step: degToRad(0.0001), optional: true,
    value: prefill(saved.lonRad, startLoc?.longitudeRad, defaultPosition?.lonRad), onInput: () => positionEdited(),
  });
  const altField = unitField({
    id: 'deviceAltitudeM', ...FIELD_BOUNDS.deviceAltitudeM, step: 10, optional: true,
    value: prefill(saved.altitudeM, startLoc?.altitudeM, defaultPosition?.altitudeM), onInput: () => { positionEdited({ altitudeSource: 'manual' }); },
  });
  // Pasting "47.37, 8.54" into either coordinate box fills both.
  for (const field of [latField, lonField]) {
    field.input.addEventListener('paste', (event) => {
      const text = event.clipboardData?.getData('text') ?? '';
      const position = text && Number.isNaN(Number(text.trim())) ? parseLatLon(text) : null;
      if (!position) return;
      event.preventDefault();
      latField.setEngineValue(position.latRad);
      lonField.setEngineValue(position.lonRad);
      positionEdited();
    });
  }
  const gpsButton = el('button', { type: 'button', class: 'secondary', i18n: 'onlineWeather.tool.useGps' });
  const gpsStatus = el('p', { class: 'hint weather-gps-status' });
  const positionBox = el('div', { class: 'weather-position' }, [
    el('div', { class: 'weather-position-coords' }, [latField.node, lonField.node]),
    altField.node,
    el('div', { class: 'field-action-row' }, [gpsButton]),
    gpsStatus,
  ]);

  // ---- Range Solver: use the location's own coordinates ----
  const useLocationBox = el('input', { type: 'checkbox', id: 'weather-use-location' });
  useLocationBox.checked = true;
  const useLocationLabel = el('span');
  const useLocationRow = el('div', { class: 'field weather-use-location' }, [
    el('label', { class: 'checkbox-field' }, [useLocationBox, useLocationLabel]),
  ]);
  useLocationBox.addEventListener('change', () => update());

  const offerButton = el('button', { type: 'button', class: 'secondary' });
  const offerHint = el('p', { class: 'hint' });
  const offerRow = el('div', { class: 'weather-save-offer' }, [offerButton, offerHint]);

  // ---- button, status, hints ----
  const getButton = el('button', { type: 'button', class: 'weather-get', i18n: 'onlineWeather.tool.getButton' });
  const needHint = el('p', { class: 'hint', i18n: 'onlineWeather.tool.needPosition' });
  const statusLine = el('p', { class: 'hint weather-status', role: 'status' });
  const nextHint = el('p', { class: 'hint weather-next' });
  const altitudeHint = el('p', { class: 'hint caution weather-altitude' });
  // Small link to the details of the shown values; present while a stored result exists and nothing was edited by hand.
  const hintsBox = el('div', { class: 'weather-hints' });
  const detailsLink = el('button', { type: 'button', class: 'link-button weather-details-link', i18n: 'onlineWeather.details.link' });
  detailsLink.hidden = true;
  for (const child of [useLocationRow, positionBox, offerRow, needHint, getButton, statusLine, nextHint, altitudeHint, hintsBox, detailsLink]) node.appendChild(child);

  let refreshedOnce = false;
  let busy = false;
  let gpsRun = null;

  const locationNow = () => locationSource?.getLocation() ?? null;
  // The checkbox exists only for a location with a full position.
  const usingLocation = () => {
    const loc = locationNow();
    return !!loc && locationHasFullPosition(loc) && useLocationBox.checked;
  };

  /** The position the weather is for, or null while it is incomplete or implausible. */
  function resolvePosition() {
    const loc = locationNow();
    let p;
    if (usingLocation()) p = { latRad: loc.latitudeRad, lonRad: loc.longitudeRad, altitudeM: loc.altitudeM };
    else p = { latRad: latField.getEngineValue(), lonRad: lonField.getEngineValue(), altitudeM: altField.getEngineValue() };
    return isValidPosition(p.latRad, p.lonRad) && isValidAltitude(p.altitudeM) ? p : null;
  }

  function positionEdited(extra = {}) {
    const lat = latField.getEngineValue(), lon = lonField.getEngineValue(), alt = altField.getEngineValue();
    setDevicePosition({ latRad: lat, lonRad: lon, altitudeM: alt, ...extra });
    update();
  }

  function update() {
    const loc = locationNow();
    const fullLocation = !!loc && locationHasFullPosition(loc);
    // checkbox
    useLocationRow.hidden = !fullLocation;
    if (fullLocation) {
      useLocationLabel.textContent = t('onlineWeather.tool.useLocation', {
        name: loc.name, coordinates: formatCoordinates(loc.latitudeRad, loc.longitudeRad), altitude: lengthText('altitudeM', loc.altitudeM),
      });
    }
    // inputs
    positionBox.hidden = usingLocation();
    // button
    const p = resolvePosition();
    getButton.hidden = !p;
    needHint.hidden = !!p || usingLocation();
    getButton.disabled = busy;
    getButton.textContent = t(refreshedOnce ? 'onlineWeather.tool.refreshButton' : 'onlineWeather.tool.getButton');
    // save offer
    const offer = !!loc && !usingLocation() && !!p && wantsSaveOffer(loc, p);
    offerRow.hidden = !offer;
    if (offer) {
      offerButton.textContent = t('onlineWeather.tool.saveOffer', { name: loc.name });
      const overwrites = hasCoordinates(loc) || Number.isFinite(loc.altitudeM);
      offerHint.textContent = overwrites ? t('onlineWeather.tool.saveOfferReplaces') : '';
      offerHint.hidden = !overwrites;
    }
    hintsFor(p);
  }

  async function refreshDetailsLink() {
    const st = await svc.status({ point: null, altitudeM: null }).catch(() => null);
    const show = !!(st && st.hasLast && !st.edited);
    detailsLink.hidden = !show;
    // The country hints belong to the same stored result as the details: present while the link is, gone with it.
    const stored = show ? await svc.lastEstimate?.().catch(() => null) : null;
    renderBlockHints(hintsBox, countryHintsFor(stored));
  }
  detailsLink.addEventListener('click', async () => {
    const stored = await svc.lastEstimate?.();
    if (stored) showStationDetails(stored, { currentAltitudeM: resolvePosition()?.altitudeM ?? null });
  });

  let hintToken = 0;
  async function hintsFor(p) {
    refreshDetailsLink();
    const token = ++hintToken;
    if (!p || busy) { if (!p) { nextHint.textContent = ''; altitudeHint.textContent = ''; } return; }
    const st = await svc.status({ point: { latRad: p.latRad, lonRad: p.lonRad }, altitudeM: p.altitudeM }).catch(() => null);
    if (token !== hintToken || !st) return;
    if (st.hasLast && st.nextExpectedAt) {
      nextHint.textContent = t('onlineWeather.tool.nextReport', { time: timeText(st.nextExpectedAt), minutes: Math.round(sToMin(st.intervalS)) });
    } else nextHint.textContent = '';
    altitudeHint.textContent = st.altitudeChanged ? t('onlineWeather.tool.altitudeChanged', { distance: lengthText('altitudeM', ALTITUDE_CHANGE_M) }) : '';
  }

  function setStatus(text, { settingsLink = false } = {}) {
    statusLine.textContent = '';
    statusLine.appendChild(document.createTextNode(text));
    if (settingsLink) {
      statusLine.appendChild(document.createTextNode(' '));
      statusLine.appendChild(el('a', { href: '#/settings/weather', text: t('onlineWeather.tool.settingsLink') }));
    }
  }

  // ---- GPS ----
  gpsButton.addEventListener('click', () => {
    if (gpsRun) { gpsRun.cancel(); return; }
    gpsButton.textContent = t('onlineWeather.tool.stopGps');
    setGpsStatus(t('onlineWeather.tool.gps.waiting'));
    gpsRun = locateGps({
      onFix: ({ position, count, estimate }) => setGpsStatus(t('onlineWeather.tool.gps.progress', {
        accuracy: lengthText('altitudeM', position.accuracyM), count,
        altitude: estimate ? lengthText('altitudeM', estimate.heightM) : '–',
      })),
    });
    gpsRun.promise.then(({ position, altitude }) => {
      latField.setEngineValue(position.latRad);
      lonField.setEngineValue(position.lonRad);
      const patch = {
        latRad: position.latRad, lonRad: position.lonRad,
        gps: { accuracyM: position.accuracyM, sigmaM: altitude?.sigmaM ?? null, fixes: altitude?.count ?? 0, at: Date.now() },
      };
      if (altitude && isValidAltitude(altitude.heightM)) {
        altField.setEngineValue(altitude.heightM);
        patch.altitudeM = altitude.heightM;
        patch.altitudeSource = 'gps';
        setGpsStatus(t('onlineWeather.tool.gps.done', {
          accuracy: lengthText('altitudeM', position.accuracyM), altitude: lengthText('altitudeM', altitude.heightM),
          sigma: lengthText('altitudeM', altitude.sigmaM), time: timeText(Date.now()),
        }));
      } else setGpsStatus(t('onlineWeather.tool.gps.noAltitude'));
      setDevicePosition(patch);
    }).catch((e) => setGpsStatus(t(`onlineWeather.tool.gps.error.${geoErrorCode(e)}`), true))
      .finally(() => { gpsRun = null; gpsButton.textContent = t('onlineWeather.tool.useGps'); update(); });
  });
  function setGpsStatus(text, warning = false) {
    gpsStatus.textContent = text;
    gpsStatus.classList.toggle('warning', warning);
  }

  // ---- save offer ----
  offerButton.addEventListener('click', () => {
    const loc = locationNow();
    const p = resolvePosition();
    if (!loc || !p) return;
    locationSource.saveCoordinates(loc, p);
    useLocationBox.checked = true;
    update();
    setStatus(t('onlineWeather.tool.saved', { name: loc.name }));
  });

  // ---- Get weather / Refresh ----
  const progressText = (msg) => t(`onlineWeather.tool.progress.${PROGRESS_KEY[msg?.code] ?? 'searching'}`, { id: msg?.id ?? '' });
  getButton.addEventListener('click', async () => {
    const p = resolvePosition();
    if (!p || busy) return;
    busy = true;
    update();
    setStatus(t('onlineWeather.tool.progress.searching'));
    let r;
    try {
      r = await svc.get({
        point: { latRad: p.latRad, lonRad: p.lonRad }, altitudeM: p.altitudeM,
        onProgress: (_source, msg) => setStatus(progressText(msg)),
      });
    } catch (e) {
      r = { ok: false, code: 'unreachable', errors: [{ message: e?.message }] };
    }
    busy = false;
    if (!r.ok) {
      setStatus(t(`onlineWeather.tool.error.${r.code}`), { settingsLink: r.code === 'unreachable' });
    } else {
      const values = {};
      for (const k of ['tempC', 'pressurePa', 'humidity']) if (Number.isFinite(r.values[k])) values[k] = r.values[k];
      applyValues(values);
      refreshedOnce = true;
      const key = r.fetched ? 'updated' : 'recalculated';
      let text = t(`onlineWeather.tool.status.${key}`, { time: timeText(r.at), count: r.stationCount });
      if (r.missing.length) text += ` ${t('onlineWeather.tool.status.partial', { what: r.missing.map((m) => t(`onlineWeather.tool.quantity.${m}`)).join(', ') })}`;
      if (r.listLoading) text += ` ${t('onlineWeather.tool.status.listLoading')}`;
      setStatus(text);
      if (r.plan?.nextExpectedAt) {
        nextHint.textContent = t('onlineWeather.tool.nextReport', { time: timeText(r.plan.nextExpectedAt), minutes: Math.round(sToMin(r.plan.intervalS)) });
      } else nextHint.textContent = '';
      altitudeHint.textContent = '';
    }
    update();
  });

  update();
  return {
    node,
    usable: true,
    // The user typed into temperature, pressure or humidity: the "Updated" line no longer describes them.
    noteValuesEdited() {
      setStatus('');
      detailsLink.hidden = true;
      hintsBox.textContent = '';
      Promise.resolve(svc.noteEdited?.()).catch(() => {});
    },
  };
}
