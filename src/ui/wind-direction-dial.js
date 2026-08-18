// Compact circular control for a wind-direction-in-degrees field, paired
// with a plain editable number box — same "control writes the box, the
// box writes the value" relationship as unitField()'s slider mode, just
// without any unit conversion (windAngle is always plain degrees, same
// pass-through convention as trajectory-view.js's other angle fields).
//
// Skin ("clock" vs "clean") is read once from settings.windDialAppearance
// at construction time unless the caller overrides it — matching every
// other cookie-backed preference in this app (views are re-mounted fresh
// on navigation, so "read at mount" is all the reactivity anything needs).
import { el } from '../dom.js';
import { svgEl } from '../svg.js';
import { t } from '../i18n.js';
import { getWindDialAppearance } from '../wind-dial-prefs.js';

const VIEW = 220;
const CX = VIEW / 2;
const CY = VIEW / 2;
const R_FACE = 86;
const R_HANDLE = 68;

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

// Shooters read wind by clock position (12/1:30/3/...) — a drag or click
// that lands within 3deg of one of those marks settles exactly onto it
// rather than leaving the value a fraction of a degree off.
function snap15(deg) {
  const nearest = norm(Math.round(deg / 15) * 15);
  return angularDist(deg, nearest) <= 3 ? nearest : deg;
}

// Same three-way split the clock skin's own tick weighting uses: within
// 15deg of the head/tail axis the crosswind component is negligible;
// within 15deg of 3/9 o'clock it's the full value; anything between is a
// quartering ("half value") wind.
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

    let len = 6;
    let cls = 'wind-dial-tick';
    let width = 1.5;
    let opacity = 1;

    if (skin === 'clock') {
      if (isFullValue) { len = 14; cls = 'wind-dial-tick-full'; width = 2; }
      else if (isHeadTail) { len = 12; cls = 'wind-dial-tick-axis'; width = 2; }
      else if (isHalfValue) { len = 10; }
      else if (isHour) { len = 8; }
      else { len = 4; opacity = 0.5; }
    } else {
      len = isHour ? 5 : 3;
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
    const p = pointOn(deg, R_FACE - 24);
    const label = svgEl('text', {
      x: p.x, y: p.y + 4, 'text-anchor': 'middle',
      class: (deg === 90 || deg === 270) ? 'wind-dial-label-full' : 'wind-dial-label'
    });
    label.textContent = text;
    labelsG.appendChild(label);
  }
  const tip = pointOn(0, R_FACE + 10);
  labelsG.appendChild(svgEl('path', {
    d: `M ${tip.x - 5} ${tip.y - 8} L ${tip.x + 5} ${tip.y - 8} L ${tip.x} ${tip.y} Z`,
    class: 'wind-dial-marker'
  }));
}

export function windDirectionDial({ id, value = 0, onInput, skin = getWindDialAppearance() }) {
  let angle = norm(value);
  let dragging = false;

  const ticksG = svgEl('g');
  const labelsG = svgEl('g');
  const handleLine = svgEl('line', { class: 'wind-dial-handle-line', 'stroke-width': 2, 'stroke-linecap': 'round' });
  const handle = svgEl('circle', { class: 'wind-dial-handle', r: 8, 'stroke-width': 2 });

  const svg = svgEl('svg', {
    viewBox: `0 0 ${VIEW} ${VIEW}`, class: 'wind-dial-svg',
    role: 'slider', tabindex: 0,
    'aria-label': t('fields.' + id), 'aria-valuemin': 0, 'aria-valuemax': 360
  }, [
    svgEl('circle', { class: 'wind-dial-face', cx: CX, cy: CY, r: R_FACE, 'stroke-width': 1.5 }),
    ticksG,
    labelsG,
    handleLine,
    handle,
    svgEl('circle', { class: 'wind-dial-center', cx: CX, cy: CY, r: 2.5 })
  ]);

  const numberInput = el('input', { type: 'number', id, min: 0, max: 359, step: 1, value: Math.round(angle) });
  const hint = el('p', { class: 'hint' });

  function renderHandle() {
    const p = pointOn(angle, R_HANDLE);
    handle.setAttribute('cx', p.x);
    handle.setAttribute('cy', p.y);
    handleLine.setAttribute('x1', CX);
    handleLine.setAttribute('y1', CY);
    handleLine.setAttribute('x2', p.x);
    handleLine.setAttribute('y2', p.y);
    svg.setAttribute('aria-valuenow', Math.round(angle));
    hint.textContent = classify(angle);
  }

  function setFromControl(newAngle) {
    angle = norm(newAngle);
    renderHandle();
    numberInput.value = String(Math.round(angle));
    if (onInput) onInput();
  }

  function angleFromEvent(evt) {
    const rect = svg.getBoundingClientRect();
    const scale = VIEW / rect.width;
    const x = (evt.clientX - rect.left) * scale - CX;
    const y = (evt.clientY - rect.top) * scale - CY;
    return norm((Math.atan2(x, -y) * 180) / Math.PI);
  }

  function updateFromPointer(evt) {
    setFromControl(snap15(angleFromEvent(evt)));
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
    const step = evt.shiftKey ? 15 : 1;
    if (evt.key === 'ArrowLeft' || evt.key === 'ArrowDown') { setFromControl(angle - step); evt.preventDefault(); }
    else if (evt.key === 'ArrowRight' || evt.key === 'ArrowUp') { setFromControl(angle + step); evt.preventDefault(); }
  });

  numberInput.addEventListener('input', () => {
    const v = parseInt(numberInput.value, 10);
    if (Number.isNaN(v)) return;
    angle = norm(v);
    renderHandle(); // don't overwrite numberInput.value while the user is typing into it
    if (onInput) onInput();
  });
  numberInput.addEventListener('change', () => {
    numberInput.value = String(Math.round(angle)); // snap back to the normalized value
  });

  buildFace(ticksG, labelsG, skin);
  renderHandle();

  const node = el('div', { class: 'field wind-dial-field' }, [
    el('label', { i18n: 'fields.' + id }),
    el('div', { class: 'wind-dial-body' }, [
      svg,
      el('div', { class: 'wind-dial-readout' }, [numberInput, hint])
    ])
  ]);

  return {
    node,
    getValue: () => angle,
    // Programmatic write path — mirrors unitField()'s setEngineValue: never
    // fires onInput itself, the caller decides when to recompute.
    setValue(deg) {
      angle = norm(deg);
      renderHandle();
      numberInput.value = String(Math.round(angle));
    }
  };
}
