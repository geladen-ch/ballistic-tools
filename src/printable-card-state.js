// Persisted settings of Trajectory's Printable card tab — cookie-backed, so
// they survive navigation and an app restart; global, not per rifle. SI as
// held in memory (distances in m, angles in rad, speeds in m/s,
// temperatures in °C, a temperature step as a °C span). A field
// left null takes its default where it is read: the auto title, today's
// date, the Range Solver's reference wind for the user's wind unit, the
// temperature columns' first temperature (the reference less two steps)
// and step (5 °C or 10 °F).
//
// The scope view's settings are the card's own copy (scope-view.js's
// `settings` option), not the Range Solver's: zoom and zoom to reticle per
// scope id, and the overlay toggles.
import { getCookie } from './cookies.js';
import { saveCookieState } from './versioned-cookie.js';
import { STEP_LEVELS, DEFAULT_STEP } from './printable-card/rows.js';

const COOKIE_NAME = 'ballistics_printable_card_v1';

export const PAPER_CHOICES = ['a4', 'letter', 'a5', 'halfLetter'];
export const MAX_MODES = ['distance', 'mach1.1', 'mach1.0'];
export const MACH_OF_MODE = { 'mach1.1': 1.1, 'mach1.0': 1.0 };
export const TITLE_MAX_LENGTH = 44;

const DEFAULTS = {
  paper: 'a4',
  title: null,
  date: null,
  maxMode: 'distance',
  maxDistanceM: null,
  initialStep: DEFAULT_STEP,
  refineThresholdRad: 0,
  crosswindMs: null,
  spinDrift: false,
  slope: false,
  temperature: true,
  temperatureStartC: null,
  temperatureStepC: null,
  targets: false,
  photo: false,
  reticle: false,
  scope: { bdcOn: true, windOn: true, zoomByScope: {}, reticleZoomByScope: {} }
};

const isFiniteOrNull = (v) => v === null || Number.isFinite(v);
const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// Every field checked on load: a damaged or foreign value falls back to
// its default instead of reaching the view.
function sanitize(raw) {
  const s = isPlainObject(raw) ? raw : {};
  const pick = (key, ok) => (key in s && ok(s[key]) ? s[key] : DEFAULTS[key]);
  const scopeRaw = isPlainObject(s.scope) ? s.scope : {};
  const zoomByScope = {};
  if (isPlainObject(scopeRaw.zoomByScope)) {
    for (const [id, z] of Object.entries(scopeRaw.zoomByScope)) if (Number.isFinite(z) && z > 0) zoomByScope[id] = z;
  }
  const reticleZoomByScope = {};
  if (isPlainObject(scopeRaw.reticleZoomByScope)) {
    for (const [id, v] of Object.entries(scopeRaw.reticleZoomByScope)) {
      if (isPlainObject(v) && typeof v.on === 'boolean' && isFiniteOrNull(v.zoom)) reticleZoomByScope[id] = { on: v.on, zoom: v.zoom };
    }
  }
  return {
    paper: pick('paper', (v) => PAPER_CHOICES.includes(v)),
    title: pick('title', (v) => v === null || (typeof v === 'string' && v.length <= TITLE_MAX_LENGTH)),
    date: pick('date', (v) => v === null || (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v))),
    maxMode: pick('maxMode', (v) => MAX_MODES.includes(v)),
    maxDistanceM: pick('maxDistanceM', (v) => v === null || (Number.isFinite(v) && v > 0)),
    initialStep: pick('initialStep', (v) => STEP_LEVELS.includes(v)),
    refineThresholdRad: pick('refineThresholdRad', (v) => Number.isFinite(v) && v >= 0),
    crosswindMs: pick('crosswindMs', (v) => v === null || (Number.isFinite(v) && v >= 0)),
    spinDrift: pick('spinDrift', (v) => typeof v === 'boolean'),
    slope: pick('slope', (v) => typeof v === 'boolean'),
    temperature: pick('temperature', (v) => typeof v === 'boolean'),
    temperatureStartC: pick('temperatureStartC', isFiniteOrNull),
    temperatureStepC: pick('temperatureStepC', (v) => v === null || (Number.isFinite(v) && v > 0)),
    targets: pick('targets', (v) => typeof v === 'boolean'),
    photo: pick('photo', (v) => typeof v === 'boolean'),
    reticle: pick('reticle', (v) => typeof v === 'boolean'),
    scope: {
      bdcOn: typeof scopeRaw.bdcOn === 'boolean' ? scopeRaw.bdcOn : DEFAULTS.scope.bdcOn,
      windOn: typeof scopeRaw.windOn === 'boolean' ? scopeRaw.windOn : DEFAULTS.scope.windOn,
      zoomByScope,
      reticleZoomByScope
    }
  };
}

let state = null;

function readCookie() {
  try {
    const raw = getCookie(COOKIE_NAME);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null; // malformed -- treated as absent
  }
}

function current() {
  if (!state) state = sanitize(readCookie());
  return state;
}

export function loadPrintableCardState() {
  return current();
}

export function savePrintableCardState(partial) {
  state = sanitize({ ...current(), ...partial });
  saveCookieState(COOKIE_NAME, state);
  return state;
}

export function savePrintableCardScopeState(partial) {
  return savePrintableCardState({ scope: { ...current().scope, ...partial } });
}

export function resetPrintableCardStateForTests() {
  state = null;
}
