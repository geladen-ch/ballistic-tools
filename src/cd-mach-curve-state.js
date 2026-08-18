// Persisted input state for the Cd-Mach Curve tool — cookie-backed
// (survives navigation and an app restart). Two named slices in one
// cookie, same "read once at module load, one save writes the whole
// thing back" shape range-solver-state.js already uses: `atmosphere`
// (deliberately its own state rather than shot-state.js's shared session
// atmosphereState — this tool should default to genuine ICAO standard
// sea-level atmosphere every time it's opened fresh, regardless of
// whatever another tool's atmosphere is currently set to) and `inputs`
// (the pasted velocity table, mass/caliber, table unit system and output
// options — everything else the view shows, restored so navigating away
// and back doesn't lose what was typed in).
import { getCookie, setCookie } from './cookies.js';

const COOKIE_NAME = 'ballistics_cd_mach_curve_state_v1';

function load() {
  try {
    const raw = getCookie(COOKIE_NAME);
    if (raw) return JSON.parse(raw);
  } catch {
    // malformed cookie — fall through to defaults
  }
  return { atmosphere: null, inputs: null };
}

function persist() {
  try {
    setCookie(COOKIE_NAME, JSON.stringify(state));
  } catch {
    // best-effort — losing persistence isn't fatal
  }
}

let state = load();

// Genuine ICAO standard atmosphere at sea level — not just
// atmospherePreset:'standard'/altitudeM:0, but tempC/pressureHpa/
// humidityPct set to match (15°C, 1013.25 hPa, 0% humidity). This
// matters because atmosphere-section.js only *recomputes*
// temp/pressure/humidity from the altitude formula reactively (on the
// altitude field's own onInput) — it never re-derives them from a
// freshly-loaded preset at mount time. Without an explicit humidityPct:
// 0 here, a fresh open would show "Standard atmosphere" selected while
// silently sitting at atmosphere-section.js's own generic DEFAULTS
// humidity (50%), i.e. not actually standard/dry air. Once a save has
// happened, those real values win via the trailing spread below.
const STANDARD_SEA_LEVEL = {
  atmospherePreset: 'standard', altitudeM: 0,
  tempC: 15, pressureHpa: 1013.25, humidityPct: 0
};

export function loadCdMachCurveAtmosphereState() {
  return { ...STANDARD_SEA_LEVEL, ...state.atmosphere };
}

export function saveCdMachCurveAtmosphereState(partial) {
  state = { ...state, atmosphere: { ...state.atmosphere, ...partial } };
  persist();
}

// null until the first save — the view treats that as "nothing restored
// yet" and falls back to its own hardcoded defaults, same convention as
// range-solver-state.js's target/wind slices.
export function loadCdMachCurveInputsState() {
  return state.inputs;
}

export function saveCdMachCurveInputsState(partial) {
  state = { ...state, inputs: { ...state.inputs, ...partial } };
  persist();
}

export function resetCdMachCurveStateForTests() {
  state = { atmosphere: null, inputs: null };
}
