import test from 'node:test';
import assert from 'node:assert/strict';
import { degToRad } from '../src/quantity.js';
import {
  upFromOrientation, cameraElevationRad, rollRad, cameraHeadingRad, sampleFromOrientation, sampleFromGravity,
  windowStats, sampleWindow, wrapAngleRad, createGravitySign
} from '../src/ui/angle-meter/clinometer.js';
import { biasRad, correctedElevationRad, solveCalibration, createCalibrationRun, CALIBRATION_STEPS } from '../src/ui/angle-meter/calibration.js';
import { rollQuarterTurns, screenQuarterTurns, contentQuarterTurns } from '../src/ui/angle-meter/upright.js';

const close = (actual, expected, tol = 1e-9) => assert.ok(Math.abs(actual - expected) <= tol, `${actual} ≉ ${expected}`);

test('the rear camera of a phone lying flat, screen up, looks straight down', () => {
  close(sampleFromOrientation(0, 0, 0).elevationRad, -Math.PI / 2);
});

test('held upright in portrait, the camera looks level; tipping the top back aims it up', () => {
  close(sampleFromOrientation(0, 90, 0).elevationRad, 0);
  close(sampleFromOrientation(0, 100, 0).elevationRad, degToRad(10));
  close(sampleFromOrientation(0, 80, 0).elevationRad, degToRad(-10));
});

test('the elevation does not depend on heading nor on how the phone is turned about the camera axis', () => {
  // A phone aimed 7° up, then rolled about its camera axis: rotate the up vector about device z.
  const base = upFromOrientation(degToRad(97), 0);
  for (const rollDeg of [0, 30, 90, -90, 150]) {
    const r = degToRad(rollDeg);
    const up = { x: base.x * Math.cos(r) + base.y * Math.sin(r), y: -base.x * Math.sin(r) + base.y * Math.cos(r), z: base.z };
    close(cameraElevationRad(up), degToRad(7));
  }
  close(sampleFromOrientation(0, 97, 0).elevationRad, sampleFromOrientation(123, 97, 0).elevationRad);
});

test('roll: 0 in portrait, +90° with the top pointing left, −90° with it pointing right', () => {
  close(rollRad({ x: 0, y: 1, z: 0 }), 0);
  close(rollRad({ x: 1, y: 0, z: 0 }), Math.PI / 2);
  close(rollRad({ x: -1, y: 0, z: 0 }), -Math.PI / 2);
  // landscape via the orientation angles: phone on its long edge, top to the left (γ = −90°)
  close(sampleFromOrientation(0, 0, -90).rollRad, Math.PI / 2);
});

test('the gravity source agrees with the orientation source, and iOS readings are sign-flipped', () => {
  const up = upFromOrientation(degToRad(95), degToRad(3));
  const g = { x: up.x * 9.81, y: up.y * 9.81, z: up.z * 9.81 };
  close(sampleFromGravity(g).elevationRad, sampleFromOrientation(0, 95, 3).elevationRad);
  const ios = { x: -g.x, y: -g.y, z: -g.z };
  close(sampleFromGravity(ios, { invertedSign: true }).elevationRad, sampleFromOrientation(0, 95, 3).elevationRad);
});

test('the camera heading turns by half a turn when the phone is turned round on the spot', () => {
  const a = cameraHeadingRad(degToRad(40), degToRad(90), 0);
  const b = cameraHeadingRad(degToRad(220), degToRad(90), 0);
  close(Math.abs(wrapAngleRad(b - a)), Math.PI, 1e-9);
});

test('window statistics: mean, spread, circular roll mean, and old readings drop out', () => {
  const w = sampleWindow(1000);
  w.push(0, { elevationRad: 0.01, rollRad: Math.PI - 0.01, headingRad: null });
  w.push(500, { elevationRad: 0.03, rollRad: -Math.PI + 0.01, headingRad: null });
  let s = w.stats();
  close(s.meanElevationRad, 0.02);
  close(s.stdElevationRad, 0.01);
  close(Math.abs(s.meanRollRad), Math.PI, 1e-9);
  assert.equal(s.meanHeadingRad, null);
  w.push(1600, { elevationRad: 0.05, rollRad: 0, headingRad: 1 });
  s = w.stats();
  assert.equal(s.count, 1);
  close(s.meanElevationRad, 0.05);
  assert.equal(windowStats([]).count, 0);
});

const TRUE_BIAS = { bias0Rad: degToRad(0.8), biasCosRad: degToRad(-0.5), biasSinRad: 0 };

// What the phone reports for the four readings: standing on its bottom edge
// leaning `leanRad` (surface slope and the phone's own lean together) one
// way, then turned round, then sighting a target `targetRad` up, upright and
// upside down.
function readings(leanRad, targetRad = degToRad(4)) {
  const truth = [leanRad, -leanRad, targetRad, targetRad];
  return CALIBRATION_STEPS.map((step, i) => ({
    elevationRad: truth[i] + biasRad(TRUE_BIAS, truth[i], step.rollRad),
    rollRad: step.rollRad,
    headingRad: step.turned ? 0.3 + Math.PI : 0.3
  }));
}

test('the surface pair and the sighting pair recover the bias, whatever the lean and the target', () => {
  for (const [leanDeg, targetDeg] of [[0, 0], [3.5, 4], [-6.6, -12], [1, 30]]) {
    const solved = solveCalibration(readings(degToRad(leanDeg), degToRad(targetDeg)));
    close(solved.bias0Rad, TRUE_BIAS.bias0Rad, degToRad(0.01));
    close(solved.biasCosRad, TRUE_BIAS.biasCosRad, degToRad(0.01));
    assert.equal(solved.biasSinRad, 0);
  }
  const solved = solveCalibration(readings(degToRad(2)));
  for (const e of [degToRad(-5), 0, degToRad(8)]) {
    for (const r of [0, Math.PI]) close(correctedElevationRad(solved, e + biasRad(TRUE_BIAS, e, r), r), e, degToRad(0.02));
  }
});

test('implausible readings are rejected', () => {
  const captures = readings(0);
  captures[3] = { ...captures[3], elevationRad: captures[3].elevationRad + degToRad(14) }; // sighted another target
  assert.equal(solveCalibration(captures), null);
  assert.equal(solveCalibration(readings(0).slice(0, 3)), null);
});

test('no calibration leaves the reading as it is', () => {
  assert.equal(correctedElevationRad(null, 0.1, 0.2), 0.1);
});

// Feeds one still stretch of `ms` at ~50 Hz; returns the last result, or
// the reading's as soon as one is taken.
function standStill(run, reading, startMs, ms = 1600) {
  let last = null;
  for (let tMs = startMs; tMs <= startMs + ms; tMs += 20) {
    last = run.addSample(reading, tMs);
    if (last.status === 'captured' || last.status === 'done') break;
  }
  return last;
}

// Hand-held: `ms` of readings swaying ±`swayRad` about `reading`.
function holdOn(run, reading, startMs, ms, swayRad = degToRad(0.3)) {
  let last = null;
  for (let tMs = startMs, k = 0; tMs <= startMs + ms; tMs += 20, k++) {
    last = run.addSample({ ...reading, elevationRad: reading.elevationRad + swayRad * Math.sin(k / 4) }, tMs);
  }
  return last;
}

test('a calibration run: two hands-free surface readings, then two sightings each taken on a tap', () => {
  const captures = readings(degToRad(3));
  const run = createCalibrationRun();
  let t = 0;
  // half way through the still stretch: holding, progress counting up
  const half = standStill(run, captures[0], t, 700);
  assert.equal(half.status, 'hold');
  assert.ok(half.progress > 0.4 && half.progress < 0.6);
  assert.equal(standStill(run, captures[0], t + 720, 900).status, 'captured'); t += 3000;
  // stood back down without the half turn: the heading gives it away
  assert.equal(standStill(run, { ...captures[1], headingRad: captures[0].headingRad }, t).status, 'turn'); t += 2000;
  assert.equal(standStill(run, captures[1], t).status, 'captured'); t += 2000;
  // sighting upright: aiming, then the tap
  assert.equal(holdOn(run, captures[2], t, 1500).status, 'aim');
  assert.equal(run.capture(), 'captured'); t += 3000;
  // the upside-down sighting, still held upright: not as asked
  assert.equal(holdOn(run, captures[2], t, 1500).status, 'position');
  assert.equal(run.capture(), 'position'); t += 2000;
  assert.equal(holdOn(run, captures[3], t, 1500).status, 'aim');
  assert.equal(run.capture(), 'done');
  assert.ok(run.done);
  close(run.result().biasCosRad, TRUE_BIAS.biasCosRad, degToRad(0.01));
});

test('a sighting tap counts at the latest reading, whatever clock the tap itself was stamped by', () => {
  const captures = readings(0);
  const run = createCalibrationRun();
  // sensor timestamps on an epoch-like clock, far from any tap's
  const t0 = 1.7e12;
  standStill(run, captures[0], t0);
  standStill(run, captures[1], t0 + 3000);
  holdOn(run, captures[2], t0 + 6000, 1500);
  assert.equal(run.capture(), 'captured');
});

test('a sighting tap while the phone swings about is refused', () => {
  const captures = readings(0);
  const run = createCalibrationRun();
  standStill(run, captures[0], 0);
  standStill(run, captures[1], 3000);
  holdOn(run, captures[2], 6000, 1500, degToRad(4));
  assert.equal(run.capture(), 'unsteady');
  assert.equal(run.stepIndex, 2);
  // the tap's own jolt, in the last moment before it, doesn't count against it
  holdOn(run, captures[2], 8000, 1400);
  for (let tMs = 9410; tMs <= 9500; tMs += 20) run.addSample({ ...captures[2], elevationRad: captures[2].elevationRad + degToRad(5) }, tMs);
  assert.equal(run.capture(), 'captured');
});

test('a jolt that lasts restarts the still stretch; a single stray reading does not', () => {
  const captures = readings(0);
  const run = createCalibrationRun();
  standStill(run, captures[0], 0, 1000);
  const jolt = { ...captures[0], elevationRad: captures[0].elevationRad + degToRad(3) };
  const single = run.addSample(jolt, 1020);
  assert.ok(single.progress > 0.6, 'one stray reading leaves the progress alone');
  run.addSample(captures[0], 1040);
  let last = null;
  for (let k = 0; k < 5; k++) last = run.addSample(jolt, 1060 + 20 * k);
  assert.ok(last.progress < 0.1, 'five in a row: the phone moved, the stretch restarts from the first of them');
});

test('upright text: roll snaps to quarter turns with hysteresis, and an OS rotation is not applied twice', () => {
  assert.equal(rollQuarterTurns(degToRad(50), 0, 0), 0); // just past the corner: stays
  assert.equal(rollQuarterTurns(degToRad(60), 0, 0), 1);
  assert.equal(rollQuarterTurns(degToRad(40), 0, 1), 1);
  assert.equal(rollQuarterTurns(degToRad(-90), 0, 0), -1);
  assert.equal(rollQuarterTurns(degToRad(178), 0, 0), 2);
  assert.equal(rollQuarterTurns(degToRad(90), degToRad(80), 0), 0); // aimed nearly straight up: roll ignored
  // top pointing left: turn the content a quarter clockwise, unless the OS already did
  assert.equal(contentQuarterTurns(1, 0), 1);
  assert.equal(contentQuarterTurns(1, 1), 0);
  assert.equal(contentQuarterTurns(-1, 1), 2);
  assert.equal(contentQuarterTurns(2, 0), 2);
});

test('the OS rotation is read from screen.orientation, or the older window.orientation', () => {
  const saved = { screen: globalThis.screen, window: globalThis.window };
  try {
    globalThis.screen = { orientation: { angle: 90 } };
    assert.equal(screenQuarterTurns(), 1);
    globalThis.screen = { orientation: { angle: 270 } };
    assert.equal(screenQuarterTurns(), -1);
    globalThis.screen = {};
    globalThis.window = { orientation: -90 };
    assert.equal(screenQuarterTurns(), -1);
    globalThis.window = {};
    assert.equal(screenQuarterTurns(), 0);
  } finally {
    globalThis.screen = saved.screen;
    globalThis.window = saved.window;
  }
});

test('a heading that jumps by half a turn does not stop a surface reading that needs no turn', () => {
  // Some browsers' orientation angles fold over, so the derived heading jumps by π from sample to sample.
  const captures = readings(0);
  const run = createCalibrationRun();
  let last = null;
  for (let k = 0, t = 0; k <= 100; k++, t += 20) {
    last = run.addSample({ ...captures[0], headingRad: k % 2 === 0 ? 0.3 : 0.3 + Math.PI }, t);
    if (last.status === 'captured') break;
  }
  assert.equal(last.status, 'captured');
});

test('jitter of the kind a phone rocking on a rounded edge shows is averaged out, not taken for movement', () => {
  const captures = readings(0);
  const run = createCalibrationRun();
  let last = null;
  let seed = 1;
  const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 - 0.5; };
  for (let k = 0, t = 0; k <= 150; k++, t += 20) {
    // ±0.7° rocking about the true value
    last = run.addSample({ ...captures[0], elevationRad: captures[0].elevationRad + degToRad(1.5) * rand() * 0.9 }, t);
    if (last.status === 'captured') break;
  }
  assert.equal(last.status, 'captured');
});

// A phone on its long edge, top left, camera 1.7° up: up in device coordinates.
const EDGE_UP = (() => { const e = degToRad(1.7); return { x: Math.cos(e), y: 0.01, z: -Math.sin(e) }; })();

test("the accelerometer's sign convention is learnt from the orientation readings", () => {
  const sign = createGravitySign({ invertedSignGuess: false });
  const flipped = { x: -EDGE_UP.x * 9.81, y: -EDGE_UP.y * 9.81, z: -EDGE_UP.z * 9.81 }; // iOS-style
  // even orientation readings 15° off in roll agree with gravity in overall direction
  for (let k = 0; k < 20; k++) sign.vote({ x: Math.cos(0.26), y: Math.sin(0.26), z: EDGE_UP.z }, flipped);
  assert.equal(sign.sign, -1);
  close(cameraElevationRad(sign.upFromGravity(flipped)), degToRad(1.7), 1e-4);
});

test('gravity readings are the source whenever motion events carry values; orientation then only supplies the heading', async () => {
  const handlers = {};
  const savedWindow = globalThis.window;
  globalThis.window = {
    addEventListener(type, fn) { (handlers[type] ||= []).push(fn); },
    removeEventListener(type, fn) { handlers[type] = (handlers[type] || []).filter((h) => h !== fn); }
  };
  try {
    const { startClinometer } = await import('../src/ui/angle-meter/clinometer.js');
    const got = [];
    const stop = startClinometer((sample) => got.push(sample));
    const fire = (type, evt) => (handlers[type] || []).forEach((fn) => fn(evt));
    // no motion yet: orientation is the source
    fire('deviceorientation', { alpha: 10, beta: 90, gamma: 0, timeStamp: 0 });
    assert.equal(got.at(-1).source, 'orientation');
    // a phone on its long edge, the browser's angles wildly off; gravity says 1.7° up
    fire('devicemotion', { accelerationIncludingGravity: { x: EDGE_UP.x * 9.81, y: EDGE_UP.y * 9.81, z: EDGE_UP.z * 9.81 }, timeStamp: 16 });
    fire('deviceorientation', { alpha: 10, beta: -15, gamma: -84, timeStamp: 20 });
    fire('devicemotion', { accelerationIncludingGravity: { x: EDGE_UP.x * 9.81, y: EDGE_UP.y * 9.81, z: EDGE_UP.z * 9.81 }, timeStamp: 32 });
    assert.ok(got.slice(1).every((s) => s.source === 'gravity'));
    close(got.at(-1).elevationRad, degToRad(1.7), 1e-4);
    assert.ok(got.at(-1).headingRad != null);
    stop();
    assert.equal((handlers.devicemotion || []).length, 0);
  } finally {
    globalThis.window = savedWindow;
  }
});

test('a noisy sensor (half a degree of scatter at 30 readings a second) still completes the reading, just by averaging longer', () => {
  const captures = readings(0);
  const run = createCalibrationRun();
  let seed = 3;
  const gauss = () => { let a = 0; for (let i = 0; i < 6; i++) { seed = (seed * 16807) % 2147483647; a += seed / 2147483647 - 0.5; } return a / Math.sqrt(0.5); };
  let last = null;
  let tMs = 0;
  for (; tMs <= 6000; tMs += 33) {
    last = run.addSample({ ...captures[0], elevationRad: captures[0].elevationRad + degToRad(0.5) * gauss() }, tMs);
    if (last.status === 'captured') break;
  }
  assert.equal(last.status, 'captured');
  assert.ok(tMs <= 5000, `took ${tMs} ms`);
});

test('single stray readings several degrees off, from a phone standing untouched, are left out rather than restarting the reading', () => {
  const captures = readings(0);
  const run = createCalibrationRun();
  let last = null;
  let tMs = 0;
  for (let k = 0; tMs <= 4000; k++, tMs += 16) {
    const stray = k % 40 === 39; // one in forty, about 1.5 per second
    last = run.addSample(stray ? { ...captures[0], elevationRad: captures[0].elevationRad - degToRad(2.9) } : captures[0], tMs);
    if (last.status === 'captured') break;
  }
  assert.equal(last.status, 'captured');
  assert.ok(tMs < 2000, `took ${tMs} ms`);
});

test('the live readout leaves out a stray reading', () => {
  const w = sampleWindow(1000);
  for (let k = 0; k < 30; k++) w.push(k * 16, { elevationRad: degToRad(3), rollRad: 0, headingRad: null });
  w.push(30 * 16, { elevationRad: degToRad(-10), rollRad: 0, headingRad: null });
  close(w.stats(undefined, { outlierRad: degToRad(1.5) }).meanElevationRad, degToRad(3));
});

test('camera zoom: clamped to 1–8×, and a pinch scales the start zoom by how far the fingers spread', async () => {
  const { clampZoom, pinchZoom, MIN_ZOOM, MAX_ZOOM } = await import('../src/ui/angle-meter/camera-zoom.js');
  assert.equal(clampZoom(0.5), MIN_ZOOM);
  assert.equal(clampZoom(20), MAX_ZOOM);
  assert.equal(pinchZoom(2, 100, 150), 3);
  assert.equal(pinchZoom(2, 100, 25), MIN_ZOOM);
  assert.equal(pinchZoom(3, 0, 50), 3); // a degenerate start: no change
});
