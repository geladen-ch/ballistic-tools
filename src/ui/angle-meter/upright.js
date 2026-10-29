// Keeping the clinometer's text upright for the person looking at it,
// however the phone stands — upside down on its top edge, sideways on a
// long edge — and whether or not the operating system auto-rotates.
//
// Everything is counted in quarter turns, positive clockwise as the
// person sees the screen (CSS rotate's own sense). The phone's roll
// (clinometer.js: +π/2 with its top pointing left, i.e. the phone turned
// a quarter anticlockwise) says how far the content must turn to read
// upright: one quarter clockwise for that case. The operating system may
// already have turned the page itself — auto-rotate on, phone on a long
// edge — and reports by how much through screen.orientation.angle (or
// the older window.orientation), positive for the same anticlockwise
// device turn. The overlay only turns its content by what is still
// missing, so the text is never turned twice.
import { degToRad } from '../../quantity.js';

const QUARTER_RAD = Math.PI / 2;
// Past the 45° corner by this much before the text flips, so it doesn't
// flicker while the phone is near a corner.
const HYSTERESIS_RAD = degToRad(10);
// Pointing nearly straight up or down, the roll is meaningless.
const MAX_ELEVATION_FOR_ROLL_RAD = degToRad(60);

function wrapQuarters(q) {
  // to −1, 0, 1, 2
  const m = ((q % 4) + 4) % 4;
  return m === 3 ? -1 : m;
}

// The phone's roll as whole quarter turns, sticking with `currentQuarters`
// until the roll is clearly into another quadrant.
export function rollQuarterTurns(rollRad, elevationRad, currentQuarters = 0) {
  if (!Number.isFinite(rollRad) || Math.abs(elevationRad) > MAX_ELEVATION_FOR_ROLL_RAD) return currentQuarters;
  const offset = Math.atan2(Math.sin(rollRad - currentQuarters * QUARTER_RAD), Math.cos(rollRad - currentQuarters * QUARTER_RAD));
  if (Math.abs(offset) <= QUARTER_RAD / 2 + HYSTERESIS_RAD) return currentQuarters;
  return wrapQuarters(Math.round(rollRad / QUARTER_RAD));
}

// How far the operating system has already turned the page, in quarter
// turns (0 when it can't say).
export function screenQuarterTurns() {
  const orientation = globalThis.screen && globalThis.screen.orientation;
  let angleDeg = orientation && Number.isFinite(orientation.angle) ? orientation.angle : null;
  if (angleDeg === null && globalThis.window && Number.isFinite(globalThis.window.orientation)) angleDeg = globalThis.window.orientation;
  if (angleDeg === null) return 0;
  return wrapQuarters(Math.round(degToRad(angleDeg) / QUARTER_RAD));
}

// The turn the overlay still has to apply to its content.
export function contentQuarterTurns(rollQuarters, screenQuarters) {
  return wrapQuarters(rollQuarters - screenQuarters);
}
