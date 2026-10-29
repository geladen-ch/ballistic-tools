// The phone as a clinometer: the elevation of the rear camera's optical
// axis above horizontal, +up — the same sign as the engine's own
// losAngleRad — read from the device's orientation sensors.
//
// Everything here works on the "up" vector expressed in device
// coordinates (x to the right of the screen, y to its top, z out of the
// screen towards the user), the direction a level would call vertical.
// The rear camera looks along −z, so its elevation is asin(up · −z): it
// does not depend on the compass heading, nor on how the phone is turned
// about the camera axis, so the reading is the same held in portrait or
// landscape. Roll — that turn about the camera axis — comes from the
// up vector's in-screen component and is what the calibration's bias
// model (calibration.js) is keyed on.
//
// Two sources: `devicemotion`'s accelerationIncludingGravity (m/s², already
// SI) is used whenever it carries values (see startClinometer for why);
// `deviceorientation` (degrees by the W3C spec — converted to radians
// right at the event) supplies the compass heading, and the tilt only on
// a device without motion events. At rest the accelerometer reads the reaction to gravity, i.e.
// "up"; iOS is documented to report it with the opposite sign to the spec
// and to Android — the starting guess, corrected from the orientation
// readings whenever there are any.
import { degToRad } from '../../quantity.js';

function clampUnit(v) {
  return Math.max(-1, Math.min(1, v));
}

// The W3C deviceorientation angles define the device's attitude as the
// intrinsic Z-X'-Y'' rotation R = Rz(α)·Rx(β)·Ry(γ). World up in device
// coordinates is R's third row; it needs β and γ only.
export function upFromOrientation(betaRad, gammaRad) {
  return {
    x: -Math.cos(betaRad) * Math.sin(gammaRad),
    y: Math.sin(betaRad),
    z: Math.cos(betaRad) * Math.cos(gammaRad)
  };
}

// The compass direction the camera looks along (−R's third column, its
// horizontal part), in radians — only ever compared against itself
// between two readings (did the phone get turned round?), so whatever the
// platform's own heading reference is does not matter. Taken from the full
// rotation rather than α alone, which degenerates with the phone held
// upright (β = 90°, the gimbal lock of this angle order).
export function cameraHeadingRad(alphaRad, betaRad, gammaRad) {
  const sa = Math.sin(alphaRad), ca = Math.cos(alphaRad);
  const sb = Math.sin(betaRad);
  const sg = Math.sin(gammaRad), cg = Math.cos(gammaRad);
  const x = -(cg * sa * sb + ca * sg);
  const y = -(sa * sg - ca * cg * sb);
  return Math.atan2(x, y);
}

export function cameraElevationRad(up) {
  const n = Math.hypot(up.x, up.y, up.z);
  return Math.asin(clampUnit(-up.z / n));
}

// 0 held upright in portrait, +π/2 with the phone's top pointing left
// (its right-hand edge up), −π/2 top pointing right, ±π upside down.
export function rollRad(up) {
  return Math.atan2(up.x, up.y);
}

// One reading from either source. `headingRad` is null when the source
// has no heading (the accelerometer fallback).
export function sampleFromOrientation(alphaDeg, betaDeg, gammaDeg) {
  const beta = degToRad(betaDeg);
  const gamma = degToRad(gammaDeg);
  const up = upFromOrientation(beta, gamma);
  return {
    elevationRad: cameraElevationRad(up),
    rollRad: rollRad(up),
    headingRad: Number.isFinite(alphaDeg) ? cameraHeadingRad(degToRad(alphaDeg), beta, gamma) : null
  };
}

export function sampleFromGravity(g, { invertedSign = false } = {}) {
  const s = invertedSign ? -1 : 1;
  const up = { x: s * g.x, y: s * g.y, z: s * g.z };
  return { elevationRad: cameraElevationRad(up), rollRad: rollRad(up), headingRad: null };
}

export function isFiniteOrientation(evt) {
  return !!evt && Number.isFinite(evt.beta) && Number.isFinite(evt.gamma);
}

export function isFiniteGravity(evt) {
  const g = evt && evt.accelerationIncludingGravity;
  return !!g && Number.isFinite(g.x) && Number.isFinite(g.y) && Number.isFinite(g.z) && Math.hypot(g.x, g.y, g.z) > 0;
}

// iOS/iPadOS Safari — the one platform that gates these events behind a
// permission prompt — is also the one whose accelerometer sign is flipped.
export function isIosMotionPlatform() {
  return typeof globalThis.DeviceMotionEvent !== 'undefined' && typeof globalThis.DeviceMotionEvent.requestPermission === 'function';
}

export function wrapAngleRad(a) {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

// A sliding time window of readings. `spanMs` is wall-clock bookkeeping
// (event timestamps), not a physical quantity of the domain.
export function sampleWindow(spanMs) {
  let samples = [];
  return {
    push(tMs, sample) {
      samples.push({ tMs, ...sample });
      const cutoff = tMs - spanMs;
      while (samples.length > 0 && samples[0].tMs < cutoff) samples.shift();
    },
    clear() { samples = []; },
    // `outlierRad`: leave out readings further than this from the window's
    // median elevation — a browser's stray glitch rather than the phone
    // moving, which would shift the median too.
    stats(elevationOf = (s) => s.elevationRad, { outlierRad = null } = {}) {
      if (outlierRad == null || samples.length < 3) return windowStats(samples, elevationOf);
      const sorted = samples.map(elevationOf).sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      return windowStats(samples.filter((s) => Math.abs(elevationOf(s) - median) <= outlierRad), elevationOf);
    }
  };
}

// Mean and standard deviation of the window's elevations (as mapped by
// `elevationOf`, e.g. bias-corrected), the circular mean of its rolls and
// headings, how many readings it holds and how much time they span.
export function windowStats(samples, elevationOf = (s) => s.elevationRad) {
  const count = samples.length;
  if (count === 0) return { count: 0, coveredMs: 0, meanElevationRad: NaN, stdElevationRad: NaN, meanRollRad: NaN, meanHeadingRad: null };
  const elevations = samples.map(elevationOf);
  const mean = elevations.reduce((a, b) => a + b, 0) / count;
  const variance = elevations.reduce((a, e) => a + (e - mean) ** 2, 0) / count;
  const circularMean = (values) => Math.atan2(
    values.reduce((a, v) => a + Math.sin(v), 0),
    values.reduce((a, v) => a + Math.cos(v), 0)
  );
  const headings = samples.map((s) => s.headingRad);
  return {
    count,
    coveredMs: samples[count - 1].tMs - samples[0].tMs,
    meanElevationRad: mean,
    stdElevationRad: Math.sqrt(variance),
    meanRollRad: circularMean(samples.map((s) => s.rollRad)),
    meanHeadingRad: headings.every((h) => h != null) ? circularMean(headings) : null
  };
}

// Gravity is the primary source. The orientation angles are the
// platform's fused attitude, but turning it into angles is the browser's
// job, and with the phone on a long edge (gamma at ±90°, where the angles
// fold over) one Android browser sent readings that were plainly wrong
// while the phone stood untouched: the tilt's sign dropped, interleaved
// families of values several degrees apart, the roll swinging by 15°. The
// accelerometer measures gravity directly and has nothing to fold, and
// gravity is exactly what a clinometer measures. So whenever motion
// events carry values, tilt and roll come from them; orientation readings
// then only supply the compass heading (the turned calibration step), and
// are the source only on a device without motion events.
//
// The accelerometer's own sign convention (flipped on iOS, see above) is
// learnt from the orientation readings where there are any, rather than
// assumed: the two up vectors agree in direction overall, however wrong a
// fold makes one small component.
const MOTION_FRESH_MS = 500;
const MAX_SIGN_VOTES = 50;

function unitVector(v) {
  const n = Math.hypot(v.x, v.y, v.z);
  return { x: v.x / n, y: v.y / n, z: v.z / n };
}

export function createGravitySign({ invertedSignGuess = false } = {}) {
  let votes = 0;
  const sign = () => (votes === 0 ? (invertedSignGuess ? -1 : 1) : Math.sign(votes));
  return {
    // One orientation up vector next to the latest raw accelerometer reading.
    vote(up, g) {
      const dot = up.x * g.x + up.y * g.y + up.z * g.z;
      votes = Math.max(-MAX_SIGN_VOTES, Math.min(MAX_SIGN_VOTES, votes + (dot >= 0 ? 1 : -1)));
    },
    upFromGravity(g) {
      const s = sign();
      return unitVector({ x: s * g.x, y: s * g.y, z: s * g.z });
    },
    get sign() { return sign(); }
  };
}

export function sampleFromUp(up, headingRad = null) {
  return { elevationRad: cameraElevationRad(up), rollRad: rollRad(up), headingRad };
}

// Listens to both sources and reports every usable reading as
// onSample(sample, tMs), `sample.source` saying which: gravity readings
// whenever motion events carry values, orientation readings otherwise.
// Returns the stop function.
export function startClinometer(onSample) {
  let lastHeadingRad = null;
  let lastGravity = null;
  let lastMotionMs = null;
  const gravity = createGravitySign({ invertedSignGuess: isIosMotionPlatform() });
  const onOrientation = (evt) => {
    if (!isFiniteOrientation(evt)) return;
    const beta = degToRad(evt.beta);
    const gamma = degToRad(evt.gamma);
    const up = upFromOrientation(beta, gamma);
    lastHeadingRad = Number.isFinite(evt.alpha) ? cameraHeadingRad(degToRad(evt.alpha), beta, gamma) : null;
    if (lastGravity) gravity.vote(up, lastGravity);
    if (lastMotionMs !== null && evt.timeStamp - lastMotionMs < MOTION_FRESH_MS) return;
    onSample({ ...sampleFromUp(up, lastHeadingRad), source: 'orientation' }, evt.timeStamp);
  };
  const onMotion = (evt) => {
    if (!isFiniteGravity(evt)) return;
    const g = evt.accelerationIncludingGravity;
    lastGravity = { x: g.x, y: g.y, z: g.z };
    lastMotionMs = evt.timeStamp;
    onSample({ ...sampleFromUp(gravity.upFromGravity(g), lastHeadingRad), source: 'gravity' }, evt.timeStamp);
  };
  window.addEventListener('deviceorientation', onOrientation);
  window.addEventListener('devicemotion', onMotion);
  return () => {
    window.removeEventListener('deviceorientation', onOrientation);
    window.removeEventListener('devicemotion', onMotion);
  };
}
