// The "Station details" dialog: what the shown weather values were made from. A summary of the estimate, the stations
// that contributed to each quantity (stations the buddy check left out stay in the table, struck out, with the reason),
// the raw station reports with their notes, one row per service with what it did (off / used / unused and why), the
// credits the providers ask for, and a plain-language note on the method. Built from the stored last result: the
// estimate is recomputed from the saved reports with the inputs it was made with, so it works after a reload and
// offline. Values are shown in the user's units (weather-text.js).
import { el } from '../../dom.js';
import { t } from '../../i18n.js';
import { showDialog } from '../app-dialog.js';
import { sources } from '../../weather/sources/index.js';
import { COMBINE_DEFAULTS } from '../../weather/combine.js';
import { contributors } from '../../weather/refresh-gate.js';
import { sToMin } from '../../quantity.js';
import { creditNode } from './online-weather-settings.js';
import { hintsFor, hintsSection } from './weather-hints.js';
import {
  temperatureText, temperatureSpanText, pressureText, humidityText, cloudText, heightText, distanceText, unitLabel,
  timeText, dateTimeText, noteText, flagText, reasonText,
} from './weather-text.js';

/** Re-select hint: the same limit as the block's altitude hint. */
const ALTITUDE_CHANGE_M = 200;

const isType = (o, type) => o.reportType === type;
const typeMark = (o) => (isType(o, 'SYNOP') ? 'SYN' : isType(o, 'DWD') ? 'DWD' : null);
/** The code for short codes (METAR ICAO, MeteoSwiss abbreviations); otherwise the (shortened) name. */
const stationLabel = (o) => (/^[A-Z0-9]{3,4}$/.test(o.station.id) && !typeMark(o) ? o.station.id
  : (o.station.name.length > 18 ? `${o.station.name.slice(0, 17)}…` : o.station.name));
const sentence = (key, params) => el('p', { class: 'hint' }, [t(key, params)]);
const percent = (w) => `${Math.round(w * 100)} %`;
const keyOf = (o) => `${o.sourceId}:${o.station.id}`;

function table(headers, rows, { rejected = [] } = {}) {
  const head = el('tr', {}, headers.map((h) => el('th', { text: h })));
  const body = rows.map((cells, i) => el('tr', { class: rejected[i] ? 'weather-rejected' : undefined }, cells.map((c) => el('td', { text: c }))));
  return el('div', { class: 'weather-table-wrap' }, [el('table', { class: 'weather-table' }, [el('thead', {}, [head]), el('tbody', {}, body)])]);
}

function stationCell(c) {
  const o = c.row.obs;
  const mark = typeMark(o);
  const cell = el('td', { title: `${o.station.name} (${o.station.id})${mark ? `, ${o.reportType}` : ''}` });
  cell.appendChild(document.createTextNode(stationLabel(o)));
  if (mark) cell.appendChild(el('span', { class: 'weather-type-mark', text: ` ${mark}` }));
  return cell;
}

/** One per-quantity table of contributors; the station column carries its own cell (type mark, tooltip). */
function contributorTable(est, spec) {
  const H = est.deviceHeightM;
  const dh = (row) => (H != null && Number.isFinite(row.obs.station.elevM) ? heightText(row.obs.station.elevM - H, { sign: true, label: false }) : '–');
  const common = [
    [t('onlineWeather.details.col.station'), null],
    [t('onlineWeather.details.col.distance', { unit: unitLabel('weatherSearchRadius') }), (c) => distanceText(c.row.distanceM, { label: false })],
    [t('onlineWeather.details.col.dh', { unit: unitLabel('altitudeM') }), (c) => dh(c.row)],
    [t('onlineWeather.details.col.effective', { unit: unitLabel('weatherSearchRadius') }), (c) => (c.deffM == null ? '–' : distanceText(c.deffM, { label: false }))],
  ];
  const cols = [...common, ...spec.columns];
  const all = [...spec.res.used.map((c) => ({ c, rejected: false })), ...spec.res.rejected.map((c) => ({ c, rejected: true }))];
  const wrap = el('div', { class: 'weather-table-wrap' });
  const tbl = el('table', { class: 'weather-table' });
  tbl.appendChild(el('thead', {}, [el('tr', {}, [...cols.map(([h]) => el('th', { text: h })), el('th', { text: t('onlineWeather.details.col.weight') })])]));
  const tbody = el('tbody');
  for (const { c, rejected } of all) {
    const tr = el('tr', { class: rejected ? 'weather-rejected' : undefined });
    cols.forEach(([, f], i) => tr.appendChild(i === 0 ? stationCell(c) : el('td', { text: f(c) })));
    tr.appendChild(el('td', { text: rejected ? t('onlineWeather.details.leftOut') : percent(c.weight) }));
    tbody.appendChild(tr);
  }
  tbl.appendChild(tbody);
  wrap.appendChild(tbl);
  return wrap;
}

/** The cloud cover a station's time correction used: "≈" in front when it is the area's; "–" when none was used. */
function cloudCell(row) {
  const cloud = row.cloud;
  if (row.dT == null || !cloud || !Number.isFinite(cloud.fraction)) return '–';
  return `${cloud.from === 'area' ? '≈ ' : ''}${cloudText(cloud.fraction)}`;
}

const QUANTITY_KEYS = { t: 'temperature', p: 'pressure', rh: 'humidity' };

/** The quantities (temperature, pressure, humidity) a report is a contributor of, as the keys of QUANTITY_KEYS. */
function contributesTo(est, obs) {
  const key = keyOf(obs);
  return Object.entries({ t: est.temperature, p: est.pressure, rh: est.humidity })
    .filter(([, q]) => [...q.used, ...q.rejected].some((c) => keyOf(c.row.obs) === key)).map(([q]) => q);
}

/** Reports whose only job is the cloud cover: they contribute no temperature, pressure or humidity. */
function cloudOnlyReports(est) {
  return (est.cloudReports ?? []).filter((c) => !contributesTo(est, c.obs).length);
}

/** The stations the regional cloud cover was made from, nearest first, and what else each one is used for. */
function cloudTable(est) {
  const rows = est.cloudReports.map((c) => {
    const also = contributesTo(est, c.obs).map((q) => t(`onlineWeather.tool.quantity.${QUANTITY_KEYS[q]}`));
    return [stationLabel(c.obs), distanceText(c.distanceM, { label: false }), cloudText(c.fraction, { label: false }), percent(c.weight),
      also.length ? also.join(', ') : t('onlineWeather.details.cloudOnly')];
  });
  return table([
    t('onlineWeather.details.col.station'), t('onlineWeather.details.col.distance', { unit: unitLabel('weatherSearchRadius') }),
    t('onlineWeather.details.col.cloud'), t('onlineWeather.details.col.weight'), t('onlineWeather.details.col.usedFor'),
  ], rows);
}

function quantitySection(est) {
  const kindShort = (o) => t(`onlineWeather.details.kind.${o.pressure.kind}`);
  const reportedPressure = (c) => {
    const p = c.row.obs.pressure;
    if (!p) return '–';
    const adj = p.adjustPa ? ` ${pressureText(p.adjustPa, { sign: true, label: false })}` : '';
    return `${pressureText(p.reportedPa ?? p.pa, { label: false })}${adj} ${kindShort(c.row.obs)}`;
  };
  const specs = [
    {
      title: t('onlineWeather.details.quantity.temperature', { unit: unitLabel('tempC') }), res: est.temperature, unit: 'tempC',
      columns: [
        [t('onlineWeather.details.col.age'), (c) => `${Math.round(sToMin(c.row.ageS))} min`],
        [t('onlineWeather.details.col.reported'), (c) => temperatureText(c.row.obs.temperatureC, { label: false })],
        [t('onlineWeather.details.col.cloud'), (c) => cloudCell(c.row)],
        [t('onlineWeather.details.col.timeDelta'), (c) => (c.row.dT == null ? '–' : temperatureSpanText(c.row.dT, { decimals: 2, sign: true, label: false }))],
        [t('onlineWeather.details.col.atYou'), (c) => temperatureText(c.value, { label: false })],
      ],
      spread: (x, o) => temperatureSpanText(x, o),
    },
    {
      title: t('onlineWeather.details.quantity.pressure', { unit: unitLabel('pressure') }), res: est.pressure, unit: 'pressure',
      columns: [
        [t('onlineWeather.details.col.reported'), reportedPressure],
        [t('onlineWeather.details.col.atYou'), (c) => pressureText(c.value, { label: false })],
      ],
      spread: (x, o) => pressureText(x, o),
    },
    {
      title: t('onlineWeather.details.quantity.humidity', { unit: unitLabel('humidity') }), res: est.humidity, unit: 'humidity',
      columns: [
        [t('onlineWeather.details.col.reported'), (c) => humidityText(c.row.obs.humidity, { label: false })],
        [t('onlineWeather.details.col.now'), (c) => humidityText(c.value, { label: false })],
      ],
      spread: (x, o) => humidityText(x, o),
    },
  ];
  const box = el('div', { class: 'weather-details-section' }, [el('h3', { text: t('onlineWeather.details.tablesHeading') })]);
  for (const spec of specs) {
    box.appendChild(el('h4', { text: spec.title }));
    if (!spec.res.used.length) { box.appendChild(sentence('onlineWeather.details.noneReport')); continue; }
    box.appendChild(contributorTable(est, spec));
    // A station kriging gave no weight to (covered by nearer ones) stays in the table at 0 %.
    if (spec.res.used.some((c) => Math.round(c.weight * 100) === 0)) box.appendChild(sentence('onlineWeather.details.zeroWeightLegend'));
    if (spec.res.fallback === 'far') {
      box.appendChild(sentence('onlineWeather.details.weightsByDistance', { distance: distanceText(COMBINE_DEFAULTS.krigeMaxNearestM) }));
    } else if (spec.res.fallback) {
      box.appendChild(sentence('onlineWeather.details.weightsByDistanceOther'));
    }
    if (spec.unit === 'tempC' && [...spec.res.used, ...spec.res.rejected].some((c) => c.row.dT != null && c.row.cloud?.from === 'area')) {
      box.appendChild(sentence('onlineWeather.details.cloudAreaLegend'));
    }
    for (const c of spec.res.rejected) {
      box.appendChild(sentence('onlineWeather.details.leftOutReason', {
        station: stationLabel(c.row.obs), deviation: spec.spread(c.deviation, { sign: true }), count: spec.res.considered, limit: spec.spread(c.threshold),
      }));
    }
    const more = spec.res.candidates - spec.res.considered;
    if (est.mode === 'multi' && more > 0) box.appendChild(sentence('onlineWeather.details.moreStations', { count: more, considered: spec.res.considered }));
  }
  if (est.timeCorrect && est.cloudReports?.length) {
    box.appendChild(el('h4', { text: t('onlineWeather.details.quantity.cloud', { unit: unitLabel('humidity') }) }));
    box.appendChild(cloudTable(est));
  }
  if (est.mode === 'multi') {
    const o = COMBINE_DEFAULTS;
    box.appendChild(sentence('onlineWeather.details.method', {
      height: heightText(100), distance: distanceText(100 * o.lambda), power: o.power, madK: o.madK,
      range: distanceText(o.krigeRangeM), fallback: distanceText(o.krigeMaxNearestM),
      tempFloor: temperatureSpanText(o.tauMin.t), pressureFloor: pressureText(o.tauMin.p),
    }));
  }
  return box;
}

function reportsSection(est, last) {
  const rejectedRows = new Set([est.pressure, est.temperature, est.humidity].flatMap((x) => x.rejected.map((r) => r.row)));
  const usedRows = new Set([est.pressure, est.temperature, est.humidity].flatMap((x) => x.used.map((u) => u.row)));
  const rows = est.stations.filter((r) => usedRows.has(r) || rejectedRows.has(r));
  // Reports that only gave the cloud cover come after the contributors (a row exists for them in the multi-station mode).
  const cloudOnly = est.timeCorrect ? cloudOnlyReports(est).map((c) => est.stations.find((r) => r.obs === c.obs) ?? { obs: c.obs, reduced: null }) : [];
  const cloudOnlyObs = new Set(cloudOnly.map((r) => r.obs));
  rows.push(...cloudOnly);
  const box = el('div', { class: 'weather-details-section' }, [el('h3', { text: t('onlineWeather.details.reportsHeading') })]);
  const quantityName = { t: 'temperature', p: 'pressure', rh: 'humidity' };
  for (const r of rows) {
    const o = r.obs, st = o.station;
    const div = el('div', { class: 'weather-report' });
    const parts = [
      `${st.name} (${st.id})`,
      `${o.reportType ?? ''}${st.network && st.network !== o.reportType ? `, ${st.network}` : ''}`,
      distanceText(st.distanceM),
      Number.isFinite(st.elevM) ? t('onlineWeather.details.elevation', { height: heightText(st.elevM) }) : t('onlineWeather.details.elevationUnknown'),
      t('onlineWeather.details.observed', { time: dateTimeText(+o.time) }),
      Number.isFinite(o.cloudFraction) ? t('onlineWeather.details.cloudCover', { cover: cloudText(o.cloudFraction) }) : null,
    ];
    div.appendChild(el('p', { class: 'weather-report-head', text: parts.filter(Boolean).join(' · ') }));
    if (o.raw) div.appendChild(el('pre', { class: 'weather-raw', text: o.raw }));
    const notes = [
      ...(r.reduced?.flags ?? []).filter((f) => f !== 'noDeviceAltitude').map(flagText),
      ...(o.notes ?? []).map(noteText),
    ];
    if (cloudOnlyObs.has(o)) notes.unshift(t('onlineWeather.details.cloudOnlyNote'));
    for (const [q, why] of Object.entries(o.skip ?? {})) {
      notes.push(t('onlineWeather.details.notUsedFor', { quantity: t(`onlineWeather.tool.quantity.${quantityName[q]}`), reason: noteText(why) }));
    }
    if (o.fetchedAt) notes.push(t(o.fromCache ? 'onlineWeather.details.fetchedCached' : 'onlineWeather.details.fetched', { time: timeText(o.fetchedAt) }));
    if (notes.length) div.appendChild(el('ul', { class: 'weather-notes' }, notes.map((n) => el('li', { text: n }))));
    box.appendChild(div);
  }
  return box;
}

/** One row per service: off / used / unused, and why. No row is crossed out. */
function sourcesSection(est, last) {
  const box = el('div', { class: 'weather-details-section' }, [el('h3', { text: t('onlineWeather.details.sourcesHeading') })]);
  if (!last.status?.length) return box;
  const used = new Map();
  for (const q of [est.pressure, est.temperature, est.humidity]) {
    for (const u of q.used) used.set(keyOf(u.row.obs), u.row.obs.sourceId);
  }
  const count = (id) => [...used.values()].filter((v) => v === id).length;
  const rows = last.status.map((s) => {
    const n = count(s.id);
    const mode = s.mode === 'off' ? 'off' : n ? 'used' : 'unused';
    const why = s.mode === 'off' ? ''
      : n ? t('onlineWeather.details.usedStations', { count: n })
        : s.state === 'used' ? t('onlineWeather.details.reportsNoneNearest') : reasonText(s.reason, s.error);
    return [s.name, t(`onlineWeather.details.mode.${mode}`), why, s.stations ? `${s.selected}/${s.stations}` : '–', s.nextExpected ? `≈ ${timeText(s.nextExpected)}` : '–'];
  });
  box.appendChild(table([
    t('onlineWeather.details.col.source'), t('onlineWeather.details.col.mode'), t('onlineWeather.details.col.status'),
    t('onlineWeather.details.col.stations'), t('onlineWeather.details.col.nextReport'),
  ], rows));
  box.appendChild(sentence('onlineWeather.details.sourcesNote'));
  return box;
}

/** The credit lines providers ask for next to results their stations contributed to. */
function creditsSection(est, adapters) {
  const contributed = new Set(contributors(est).map((c) => c.obs.sourceId));
  for (const q of [est.pressure, est.temperature, est.humidity]) for (const u of q.used) contributed.add(u.row.obs.sourceId);
  const box = el('div', { class: 'weather-details-section' }, [el('h3', { text: t('onlineWeather.details.creditsHeading') })]);
  for (const s of adapters.filter((x) => contributed.has(x.id))) {
    box.appendChild(creditNode(s));
    if (s.credits?.processed) box.appendChild(el('p', { class: 'hint', text: `${s.credits.processed}.` }));
  }
  return box;
}

function summarySection(est, last, { currentAltitudeM, online }) {
  const box = el('div', { class: 'weather-details-section' });
  const usedKeys = new Set([est.pressure, est.temperature, est.humidity].flatMap((x) => x.used.map((u) => keyOf(u.row.obs))));
  const near = est.stations[0]?.obs;
  if (est.mode === 'multi') {
    box.appendChild(el('h3', { text: t('onlineWeather.details.atYourPosition') }));
    box.appendChild(sentence('onlineWeather.details.stationsFor', { count: usedKeys.size, time: timeText(+est.now) }));
  } else if (near) {
    box.appendChild(el('h3', { text: `${near.station.name} (${near.station.id})` }));
    box.appendChild(sentence('onlineWeather.details.observedAgo', { time: timeText(+near.time), minutes: Math.round(sToMin((+est.now - +near.time) / 1000)) }));
  }
  const correction = est.timeCorrect ? t('onlineWeather.details.timeCorrection', { time: timeText(+est.now) }) : '';
  if (est.mode === 'multi') {
    const nearest = Math.min(...[...usedKeys].map((k) => est.stations.find((r) => keyOf(r.obs) === k).distanceM));
    box.appendChild(sentence('onlineWeather.details.explainMulti', {
      height: heightText(est.deviceHeightM), radius: distanceText(last.radiusM, { decimals: 0 }),
      nearest: distanceText(nearest), correction,
    }));
  } else if (near) {
    box.appendChild(sentence('onlineWeather.details.explainNearest', {
      height: heightText(est.deviceHeightM), distance: distanceText(near.station.distanceM),
      elevation: Number.isFinite(near.station.elevM) ? t('onlineWeather.details.elevation', { height: heightText(near.station.elevM) }) : t('onlineWeather.details.elevationUnknown'),
      correction,
    }));
  }
  // Say so when the time correction ran without any cloud cover to scale it, so the missing cloud column is explained.
  const usedRows = est.temperature.used.map((u) => u.row);
  if (est.timeCorrect && usedRows.length && !usedRows.some((r) => Number.isFinite(r.cloud?.fraction))) {
    box.appendChild(sentence('onlineWeather.details.noCloudCover'));
  }
  box.appendChild(sentence('onlineWeather.details.fetchedAt', { when: dateTimeText(last.fetchedAt) }));

  const banners = [];
  if (!online) banners.push(t('onlineWeather.details.bannerOffline'));
  const rejected = new Set([est.pressure, est.temperature].flatMap((x) => x.rejected.map((r) => keyOf(r.row.obs)))).size;
  if (rejected) banners.push(t('onlineWeather.details.bannerRejected', { count: rejected }));
  if (Number.isFinite(currentAltitudeM) && Math.abs(currentAltitudeM - last.altitudeM) > ALTITUDE_CHANGE_M) {
    banners.push(t('onlineWeather.details.bannerAltitude', { distance: heightText(ALTITUDE_CHANGE_M) }));
  }
  for (const b of banners) box.appendChild(el('p', { class: 'hint caution', text: b }));
  return box;
}

/**
 * Build the dialog body for a stored result.
 * @param {{last:object, result:object}} stored  from the service's lastEstimate()
 * @param {{currentAltitudeM?:number|null, online?:boolean, adapters?:object[]}} [o]
 *   adapters: the services whose credits may be shown (the registry by default)
 */
export function stationDetailsBody({ last, result }, { currentAltitudeM = null, online = true, adapters = sources } = {}) {
  const body = el('div', { class: 'weather-details' }, [el('h2', { text: t('onlineWeather.details.title') })]);
  body.appendChild(summarySection(result, last, { currentAltitudeM, online }));
  const hints = hintsSection(hintsFor({ last, result }));
  if (hints) body.appendChild(hints);
  body.appendChild(quantitySection(result));
  body.appendChild(reportsSection(result, last));
  body.appendChild(sourcesSection(result, last));
  body.appendChild(creditsSection(result, adapters));
  return body;
}

/** Open the dialog. */
export function showStationDetails(stored, options = {}) {
  showDialog({
    bodyNode: stationDetailsBody(stored, { online: typeof navigator === 'undefined' || navigator.onLine !== false, ...options }),
    buttons: [{ label: t('onlineWeather.details.close') }],
    wide: true,
    cardClass: 'details',
  });
}
