// Combined wind direction + speed dial. Three call sites so far, all
// opt-in via atmosphere-section.js's own `combinedWind` (except Range
// Solver, which never went through that shared section to begin with):
//   - Range Solver's Wind tab (range-solver-view.js): no label, no
//     headwind/crosswind caption — the tab itself already says "Wind",
//     and that pane is deliberately label-free throughout.
//   - Trajectory and Arsenal's rifle comparison (atmosphere-section.js's
//     own `combinedWind: true`): `label`/`hint` below both true, so it
//     looks like the rest of that section's fields and keeps the same
//     "Full value crosswind" style caption the old dial showed there.
// wind-direction-dial.js's own plain-pair branch inside atmosphere-
// section.js is what's left for everyone else — but every other
// atmosphereSection() caller (Hit Probability, BC Estimator, Cd-Mach
// Curve, Range Solver's own Atmosphere tab) passes `includeWind: false`,
// so as of Arsenal's switch that branch, and wind-direction-dial.js
// itself, have no live caller left. Left in place rather than removed
// here — that's a separate cleanup decision, not this widget swap.
//
// The direction ring keeps wind-direction-dial.js's own geometry, 15deg
// snap magnetism, "clock"/"clean" skin preference (the same shared cookie
// via wind-dial-prefs.js), and headwind/crosswind classification —
// reimplemented here rather than shared, so this component's own (larger,
// hub-carrying) layout can't regress the plain-dial call sites, and vice
// versa.
//
// What's new is the hub at the dial's center: a small degree readout, the
// wind-speed value itself — always a live, editable input, there's no
// separate "tap to edit" mode to switch into — and its unit, with the
// direction needle running underneath the hub rather than across it. Per
// the design review this shipped from: no manual-degrees box (arrow keys
// on the ring cover keyboard access instead). Large +/- buttons flank the
// dial, each notched with a CSS mask cut from the dial's own center point
// so their inner edge reads as wrapping around the ring rather than an
// arbitrary scoop.
import { el } from '../dom.js';
import { svgEl } from '../svg.js';
import { t } from '../i18n.js';
import { getWindDialAppearance } from '../wind-dial-prefs.js';
import { FIELD_UNITS, UNIT_GROUPS, unitChoice, engineToDisplay, displayToEngine, engineSpanToDisplay, displaySpanToEngine } from '../units.js';
import { getUnit } from '../prefs.js';

// One round step per display unit — a shooter thinking in mph wants ±1
// mph, not whatever a flat 0.5 m/s happens to convert to. km/h has no
// user-specified round step of its own, so it falls back to converting
// the same flat 0.5 m/s step every unit used before this table existed
// (matches the fallback large-stepper-field.js's own callers already
// relied on for it). Always applied — every windControl() caller gets
// the same unit-aware stepping and forced 1-decimal display, not just
// Range Solver's own instance.
const WIND_SPEED_STEPS = { 'm/s': 0.5, mph: 1, 'ft/s': 1 };
const FALLBACK_WIND_SPEED_STEP_MS = 0.5;
const DECIMALS = 1;

const VIEW = 270;
const CX = VIEW / 2;
const CY = VIEW / 2;
const R_FACE = 112;
const R_HANDLE = 92;
const R_HUB = 66;

function norm(deg) {
  return ((deg % 360) + 360) % 360;
}

function angularDist(a, b) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

function pointOn(deg, r) {
  const rad = (deg * Math.PI) / 180;
  return { x: CX + r * Math.sin(rad), y: CY - r * Math.cos(rad) };
}

// Same soft-magnetism rule as wind-direction-dial.js's own snap15(): a
// drag or click within 3deg of a 15deg mark settles exactly onto it.
function snap15(deg) {
  const nearest = norm(Math.round(deg / 15) * 15);
  return angularDist(deg, nearest) <= 3 ? nearest : deg;
}

// Same three-way split, and same i18n keys, as wind-direction-dial.js's
// own classify() — only rendered when the `hint` option is on.
function classify(deg) {
  const toHead = angularDist(deg, 0);
  const toTail = angularDist(deg, 180);
  const to3 = angularDist(deg, 90);
  const to9 = angularDist(deg, 270);
  if (Math.min(toHead, toTail) <= 15) return t(toHead < toTail ? 'windDial.headwind' : 'windDial.tailwind');
  if (Math.min(to3, to9) <= 15) return t('windDial.fullValue');
  return t('windDial.quartering');
}

function buildFace(ticksG, labelsG, skin) {
  while (ticksG.firstChild) ticksG.removeChild(ticksG.firstChild);
  while (labelsG.firstChild) labelsG.removeChild(labelsG.firstChild);

  for (let deg = 0; deg < 360; deg += 15) {
    const isHour = deg % 30 === 0;
    const isFullValue = deg === 90 || deg === 270;
    const isHalfValue = deg === 45 || deg === 135 || deg === 225 || deg === 315;
    const isHeadTail = deg === 0 || deg === 180;

    let len, cls = 'wind-control-tick', width = 1.5, opacity = 1;
    if (skin === 'clock') {
      if (isFullValue) { len = 18; cls = 'wind-control-tick-full'; width = 2; }
      else if (isHeadTail) { len = 16; cls = 'wind-control-tick-axis'; width = 2; }
      else if (isHalfValue) { len = 13; }
      else if (isHour) { len = 10; }
      else { len = 4; opacity = 0.5; }
    } else {
      len = isHour ? 6 : 4;
      opacity = isHour ? 0.55 : 0.3;
    }

    const outer = pointOn(deg, R_FACE - 2);
    const inner = pointOn(deg, R_FACE - 2 - len);
    ticksG.appendChild(svgEl('line', {
      x1: outer.x, y1: outer.y, x2: inner.x, y2: inner.y,
      class: cls, 'stroke-width': width, 'stroke-linecap': 'round', opacity
    }));
  }

  if (skin !== 'clock') return;

  for (const [deg, text] of [[0, '12'], [90, '3'], [180, '6'], [270, '9']]) {
    const p = pointOn(deg, R_FACE - 28);
    const label = svgEl('text', {
      x: p.x, y: p.y + 4, 'text-anchor': 'middle',
      class: (deg === 90 || deg === 270) ? 'wind-control-label-full' : 'wind-control-label'
    });
    label.textContent = text;
    labelsG.appendChild(label);
  }
  const tip = pointOn(0, R_FACE + 13);
  labelsG.appendChild(svgEl('path', {
    d: `M ${tip.x - 5} ${tip.y - 8} L ${tip.x + 5} ${tip.y - 8} L ${tip.x} ${tip.y} Z`,
    class: 'wind-control-marker'
  }));
}

export function windControl({
  angle = 0, speed = 0, min, max, onInput, skin = getWindDialAppearance(),
  label = false, hint = false
}) {
  let currentAngle = norm(angle);
  let dragging = false;

  // ---- direction ring ----
  const ticksG = svgEl('g');
  const labelsG = svgEl('g');
  const needle = svgEl('line', { class: 'wind-control-needle', 'stroke-width': 2.5, 'stroke-linecap': 'round' });
  const handle = svgEl('circle', { class: 'wind-control-handle', r: 9, 'stroke-width': 2 });

  const svg = svgEl('svg', {
    // id is a stand-in for the manual-degrees box the dial-only design
    // dropped — findById-style lookups (own tests included) still need
    // something addressable at "the wind angle control" in the Wind tab.
    id: 'windAngle', viewBox: `0 0 ${VIEW} ${VIEW}`, class: 'wind-control-svg',
    role: 'slider', tabindex: 0,
    'aria-label': t('fields.windAngle'), 'aria-valuemin': 0, 'aria-valuemax': 360
  }, [
    svgEl('circle', { class: 'wind-control-face', cx: CX, cy: CY, r: R_FACE, 'stroke-width': 1.5 }),
    ticksG,
    labelsG,
    needle,
    svgEl('circle', { class: 'wind-control-hub', cx: CX, cy: CY, r: R_HUB, 'stroke-width': 1.5 }),
    handle
  ]);

  const degreesEl = el('div', { class: 'wind-control-degrees' }, [`${Math.round(currentAngle)}°`]);
  const hintEl = hint ? el('p', { class: 'hint' }) : null;

  function renderNeedle() {
    const p = pointOn(currentAngle, R_HANDLE);
    handle.setAttribute('cx', p.x);
    handle.setAttribute('cy', p.y);
    needle.setAttribute('x1', CX);
    needle.setAttribute('y1', CY);
    needle.setAttribute('x2', p.x);
    needle.setAttribute('y2', p.y);
    svg.setAttribute('aria-valuenow', Math.round(currentAngle));
    degreesEl.textContent = `${Math.round(currentAngle)}°`;
    if (hintEl) hintEl.textContent = classify(currentAngle);
  }

  function angleFromEvent(evt) {
    const rect = svg.getBoundingClientRect();
    const scale = VIEW / rect.width;
    const x = (evt.clientX - rect.left) * scale - CX;
    const y = (evt.clientY - rect.top) * scale - CY;
    return norm((Math.atan2(x, -y) * 180) / Math.PI);
  }

  function updateFromPointer(evt) {
    currentAngle = snap15(angleFromEvent(evt));
    renderNeedle();
    if (onInput) onInput();
  }

  svg.addEventListener('pointerdown', (evt) => {
    dragging = true;
    if (svg.setPointerCapture) svg.setPointerCapture(evt.pointerId);
    if (svg.focus) svg.focus();
    updateFromPointer(evt);
  });
  svg.addEventListener('pointermove', (evt) => { if (dragging) updateFromPointer(evt); });
  svg.addEventListener('pointerup', () => { dragging = false; });
  svg.addEventListener('pointercancel', () => { dragging = false; });
  svg.addEventListener('keydown', (evt) => {
    const s = evt.shiftKey ? 15 : 1;
    if (evt.key === 'ArrowLeft' || evt.key === 'ArrowDown') {
      currentAngle = norm(currentAngle - s); renderNeedle(); if (onInput) onInput(); evt.preventDefault();
    } else if (evt.key === 'ArrowRight' || evt.key === 'ArrowUp') {
      currentAngle = norm(currentAngle + s); renderNeedle(); if (onInput) onInput(); evt.preventDefault();
    }
  });

  buildFace(ticksG, labelsG, skin);

  // ---- speed hub — same engine<->display unit convention as
  // large-stepper-field.js, including its stale/unknown-preference
  // fallback (this control only ever handles 'windSpeed'). ----
  const meta = FIELD_UNITS.windSpeed;
  const group = UNIT_GROUPS[meta.group];
  let displayUnit = getUnit(meta.group);
  if (!unitChoice('windSpeed', displayUnit)) displayUnit = group.defaultUnit;
  const choice = unitChoice('windSpeed', displayUnit);

  function round(v) {
    const factor = 10 ** DECIMALS;
    return Math.round(v * factor) / factor;
  }
  const toDisp = (v) => round(engineToDisplay('windSpeed', v, displayUnit));
  const toEng = (v) => displayToEngine('windSpeed', v, displayUnit);
  const stepEngine = displayUnit in WIND_SPEED_STEPS
    ? displaySpanToEngine('windSpeed', WIND_SPEED_STEPS[displayUnit], displayUnit)
    : FALLBACK_WIND_SPEED_STEP_MS;
  const stepDisp = round(engineSpanToDisplay('windSpeed', stepEngine, displayUnit));
  const dMin = min !== undefined ? toDisp(min) : undefined;
  const dMax = max !== undefined ? toDisp(max) : undefined;
  function clampDisp(v) {
    if (dMin !== undefined) v = Math.max(dMin, v);
    if (dMax !== undefined) v = Math.min(dMax, v);
    return v;
  }

  const speedInput = el('input', {
    id: 'windSpeed', class: 'wind-control-speed-input', type: 'text', inputmode: 'decimal',
    step: stepDisp, value: toDisp(speed), 'aria-label': t('fields.windSpeed')
  });
  const unitEl = el('div', { class: 'wind-control-unit' }, [choice.label]);

  // Silent validation: a red underline while the value is out of range or
  // unparseable, with no message — the hub has no room for one. On blur,
  // an out-of-range number is forced to the nearest bound; an unparseable
  // one has no "nearest" value to snap to, so it reverts to the value this
  // control was constructed with instead — same fallback large-stepper-
  // field.js's own bump() already uses for a blank/NaN box, rather than
  // tracking a separately-updated "last known good" value.
  function isSpeedValid(v) {
    return !Number.isNaN(v) && (dMin === undefined || v >= dMin) && (dMax === undefined || v <= dMax);
  }
  speedInput.addEventListener('input', () => {
    speedInput.classList.toggle('field-invalid', !isSpeedValid(parseFloat(speedInput.value)));
    if (onInput) onInput();
  });
  speedInput.addEventListener('blur', () => {
    const v = parseFloat(speedInput.value);
    speedInput.value = Number.isNaN(v) ? toDisp(speed) : clampDisp(round(v));
    speedInput.classList.remove('field-invalid');
    // The correction above can change what getEngineSpeed() now reports
    // (an out-of-range or NaN value the app already recomputed against
    // via 'input' just got clamped/reverted) — fire onInput again so the
    // rest of the view (recompute()/saveWind() in range-solver-view.js)
    // picks up the corrected value instead of staying stuck on the
    // pre-correction one.
    if (onInput) onInput();
  });
  speedInput.addEventListener('keydown', (evt) => { if (evt.key === 'Enter') speedInput.blur(); });

  // Reads off the input itself (not a closed-over variable), so repeated
  // clicks compound on whatever's currently showing — same convention as
  // large-stepper-field.js's own bump().
  function bump(delta) {
    const current = parseFloat(speedInput.value);
    const base = Number.isNaN(current) ? toDisp(speed) : current;
    speedInput.value = clampDisp(round(base + delta));
    speedInput.classList.remove('field-invalid');
    if (onInput) onInput();
  }
  const decButton = el('button', {
    type: 'button', class: 'wind-control-btn wind-control-dec', 'aria-label': t('fields.stepperDecrease')
  }, [el('span', { class: 'wind-control-glyph' }, ['−'])]);
  const incButton = el('button', {
    type: 'button', class: 'wind-control-btn wind-control-inc', 'aria-label': t('fields.stepperIncrease')
  }, [el('span', { class: 'wind-control-glyph' }, ['+'])]);
  decButton.addEventListener('click', () => bump(-stepDisp));
  incButton.addEventListener('click', () => bump(stepDisp));

  const dialWrap = el('div', { class: 'wind-control-dial-wrap' }, [
    svg,
    degreesEl,
    el('div', { class: 'wind-control-speed-wrap' }, [speedInput]),
    unitEl
  ]);

  const node = el('div', { class: 'field wind-control' }, [
    label ? el('label', { i18n: 'fields.wind' }) : null,
    el('div', { class: 'wind-control-combo' }, [decButton, dialWrap, incButton]),
    hintEl
  ]);

  renderNeedle();

  return {
    node,
    getAngle: () => currentAngle,
    getEngineSpeed: () => toEng(parseFloat(speedInput.value))
  };
}
