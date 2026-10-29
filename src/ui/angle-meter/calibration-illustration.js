// The schematic for one calibration step (calibration.js's
// CALIBRATION_STEPS), the phone as the person sees it (the front camera's
// dot marks its top).
//
// Surface steps: the phone standing on a surface drawn a few degrees off
// level (the method doesn't need a level one, and the picture says so
// too), for the turned reading with a half-turn arrow about the vertical
// and a "step round" arc. A ring in the corner fills while the phone
// stays still and turns green when the reading is taken.
//
// Sighting steps: the phone held up with a crosshair on its screen, a
// dashed line of sight to the top of a distant mast; for the upside-down
// sighting the phone drawn upside down inside a dashed circle for turning
// it in its own plane. These are taken on a tap, so they have no ring.
//
// Drawn from a few shared parts in the same stroke style as nav-icons.js.
// All geometry is in the SVG's own user units.
import { svgEl } from '../../svg.js';
import { t } from '../../i18n.js';
import { radToDeg } from '../../quantity.js';

const LINE = { fill: 'none', stroke: 'currentColor', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
const PHONE_W = 56;
const PHONE_H = 108;
const SURFACE = { x1: 18, y1: 166, x2: 182, y2: 158 };
const SLOPE = (SURFACE.y2 - SURFACE.y1) / (SURFACE.x2 - SURFACE.x1);
const RING = { cx: 24, cy: 22, r: 11 };
const RING_LENGTH = 2 * Math.PI * RING.r;

// SVG's rotate() takes degrees: how each step's phone is drawn, as seen by
// the person (top pointing left = turned a quarter anticlockwise).
const ROLL_DRAWING = { upright: 0, turned: 0, sightUpright: 0, sightUpsideDown: 180 };
const SURFACE_DRAWING_DEG = radToDeg(Math.atan(SLOPE));

function surfaceY(x) {
  return SURFACE.y1 + SLOPE * (x - SURFACE.x1);
}

function phone() {
  return [
    svgEl('rect', { x: -PHONE_W / 2, y: -PHONE_H / 2, width: PHONE_W, height: PHONE_H, rx: 10, ...LINE, 'stroke-width': 2.2 }),
    svgEl('rect', { x: -PHONE_W / 2 + 5, y: -PHONE_H / 2 + 11, width: PHONE_W - 10, height: PHONE_H - 22, rx: 3, ...LINE, 'stroke-width': 1.2, opacity: 0.45 }),
    svgEl('circle', { cx: 0, cy: -PHONE_H / 2 + 5.5, r: 1.8, fill: 'currentColor' })
  ];
}

function surface() {
  const parts = [svgEl('line', { ...SURFACE, ...LINE, 'stroke-width': 2 })];
  for (let x = 26; x <= 176; x += 12) {
    parts.push(svgEl('line', { x1: x, y1: surfaceY(x) + 2, x2: x - 8, y2: surfaceY(x) + 11, stroke: 'currentColor', 'stroke-width': 1.1, opacity: 0.45, 'stroke-linecap': 'round' }));
  }
  return parts;
}

function unit(x, y) {
  const n = Math.hypot(x, y);
  return [x / n, y / n];
}

// An open arrowhead at `tip`, pointing along the unit direction (tx, ty).
function arrowHead(tip, tx, ty) {
  const nx = -ty, ny = tx;
  const back = 7, half = 4;
  const p1 = `${tip.x - back * tx + half * nx} ${tip.y - back * ty + half * ny}`;
  const p2 = `${tip.x - back * tx - half * nx} ${tip.y - back * ty - half * ny}`;
  return svgEl('path', { d: `M${p1} L${tip.x} ${tip.y} L${p2}`, ...LINE, 'stroke-width': 1.8 });
}

// Turning the phone in its own plane, like a steering wheel.
function inPlaneTurn(cx, cy, r) {
  const a0 = -0.35 * Math.PI, a1 = 1.15 * Math.PI;
  const at = (a) => ({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  const s0 = at(a0), s1 = at(a1);
  return [
    svgEl('path', { d: `M${s0.x} ${s0.y} A${r} ${r} 0 1 1 ${s1.x} ${s1.y}`, ...LINE, 'stroke-width': 1.6, opacity: 0.7, 'stroke-dasharray': '4 5' }),
    arrowHead(s1, -Math.sin(a1), Math.cos(a1))
  ];
}

// Half a turn about the vertical, above the phone.
function halfTurn(cx, cy) {
  const rx = 44, ry = 10, a = 0.5;
  const start = { x: cx - rx * Math.cos(a), y: cy + ry * Math.sin(a) };
  const end = { x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) };
  const label = svgEl('text', { x: cx + rx + 6, y: cy - 6, fill: 'currentColor', 'font-size': 11, opacity: 0.8, class: 'angle-meter-figure-label' });
  label.textContent = t('angleMeter.calibration.halfTurnLabel');
  return [
    svgEl('line', { x1: cx, y1: cy - 18, x2: cx, y2: cy + 30, stroke: 'currentColor', 'stroke-width': 1, 'stroke-dasharray': '3 4', opacity: 0.55 }),
    svgEl('path', { d: `M${start.x} ${start.y} A${rx} ${ry} 0 1 1 ${end.x} ${end.y}`, ...LINE, 'stroke-width': 2, 'stroke-dasharray': 210, class: 'angle-meter-figure-sweep' }),
    arrowHead(end, ...unit(1, 0.3)) // pointing on, out of the turn, so it reads at a glance
  ].concat(label);
}

// The person stepping round to the other side.
function stepRound() {
  const label = svgEl('text', { x: 100, y: 205, 'text-anchor': 'middle', fill: 'currentColor', 'font-size': 10.5, opacity: 0.8, class: 'angle-meter-figure-label' });
  label.textContent = t('angleMeter.calibration.stepRoundLabel');
  return [
    svgEl('path', { d: 'M34 182 Q100 200 166 182', ...LINE, 'stroke-width': 1.6, 'stroke-dasharray': '4 5' }),
    arrowHead({ x: 166, y: 182 }, 0.96, -0.27),
    label
  ];
}

// `step`: one of CALIBRATION_STEPS. Returns the <svg> plus setProgress(0..1,
// captured) for the stillness ring.
// The phone held up, aimed at a distant mast's top.
function sighting(rollDeg) {
  const px = 62, py = 118, scale = 0.72;
  const screenCross = [
    svgEl('line', { x1: -9, y1: 0, x2: 9, y2: 0, ...LINE, 'stroke-width': 1.4 }),
    svgEl('line', { x1: 0, y1: -9, x2: 0, y2: 9, ...LINE, 'stroke-width': 1.4 })
  ];
  const parts = [
    // ground far off, and the mast with its flag
    svgEl('line', { x1: 112, y1: 150, x2: 192, y2: 150, stroke: 'currentColor', 'stroke-width': 1.2, opacity: 0.45, 'stroke-linecap': 'round' }),
    svgEl('line', { x1: 168, y1: 150, x2: 168, y2: 66, ...LINE, 'stroke-width': 1.8 }),
    svgEl('path', { d: 'M168 66 L184 72 L168 78', ...LINE, 'stroke-width': 1.6 }),
    // the line of sight
    svgEl('line', { x1: px + 24, y1: py - 20, x2: 166, y2: 66, stroke: 'currentColor', 'stroke-width': 1.3, 'stroke-dasharray': '3 4', opacity: 0.7 }),
    svgEl('g', { transform: `translate(${px} ${py}) rotate(${rollDeg}) scale(${scale})` }, [...phone(), ...screenCross])
  ];
  if (rollDeg !== 0) parts.push(...inPlaneTurn(px, py, (PHONE_H / 2) * scale + 12));
  return parts;
}

export function calibrationIllustration(step) {
  const rollDeg = ROLL_DRAWING[step.id] ?? 0;
  if (step.kind === 'sight') {
    const node = svgEl('svg', { viewBox: '0 0 200 212', class: 'angle-meter-figure-svg', 'aria-hidden': 'true' }, sighting(rollDeg));
    return { node, setProgress() {} };
  }
  const sideways = Math.abs(rollDeg) === 90;
  const visibleH = sideways ? PHONE_W : PHONE_H;
  const cx = 100;
  const base = surfaceY(cx);
  const parts = [
    ...surface(),
    svgEl('g', { transform: `translate(${cx} ${base}) rotate(${SURFACE_DRAWING_DEG}) translate(0 ${-visibleH / 2 - 1}) rotate(${rollDeg})` }, phone())
  ];
  if (step.turned) parts.push(...halfTurn(cx, base - visibleH - 23), ...stepRound());

  const ringTrack = svgEl('circle', { cx: RING.cx, cy: RING.cy, r: RING.r, fill: 'none', stroke: 'currentColor', 'stroke-width': 2, opacity: 0.3 });
  const ringFill = svgEl('circle', {
    cx: RING.cx, cy: RING.cy, r: RING.r, fill: 'none', stroke: 'currentColor', 'stroke-width': 2.4, 'stroke-linecap': 'round',
    'stroke-dasharray': RING_LENGTH, 'stroke-dashoffset': RING_LENGTH, transform: `rotate(-90 ${RING.cx} ${RING.cy})`, class: 'angle-meter-figure-ring'
  });
  parts.push(ringTrack, ringFill);

  const node = svgEl('svg', { viewBox: '0 0 200 212', class: 'angle-meter-figure-svg', 'aria-hidden': 'true' }, parts);
  return {
    node,
    setProgress(progress, captured = false) {
      ringFill.setAttribute('stroke-dashoffset', String(RING_LENGTH * (1 - Math.max(0, Math.min(1, progress)))));
      ringFill.classList.toggle('captured', captured);
    }
  };
}
