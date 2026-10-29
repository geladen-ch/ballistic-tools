// Per-device clinometer calibration.
//
// What a phone reports as its camera's elevation differs from the truth
// by a small error with two independent causes. The camera's optical
// axis is never exactly square to the housing (nor the sensor to the
// board), a small fixed tilt whose effect on the elevation depends only
// on how the phone is turned about the camera axis — εc·cos(roll) +
// εs·sin(roll). And the accelerometer's own offset along the camera axis
// shifts the reading by ε0/cos(elevation) whatever the roll. So:
//
//   reading = elevation + ε0/cos(elevation) + εc·cos(roll) + εs·sin(roll)
//
// Four readings, two kinds — each a reversal, so neither needs a level
// surface or a known target:
//
//   1–2. Surface. The phone stands upright on its bottom edge on any firm
//        surface, then is turned half a turn on the spot (the person steps
//        round to face the screen again). Whatever the surface slope and
//        however the phone leans on that edge (rounded edges, buttons and
//        cases make every phone lean a little, and differently on each
//        edge), the lean τ enters the two readings with opposite signs and
//        cancels; their mean is ε0 + εc. Taken hands-free (a tap would
//        knock the phone) once it has stood still long enough.
//   3–4. Sighting. Hand-held, the crosshair on a far, sharp target — once
//        upright, once upside down. The target's elevation T is the same
//        in both, the roll differs by half a turn, so their difference is
//        2·εc. Taken on a tap, from the readings just before it.
//
// Four equations for ε0, εc, τ and T. εs (the camera term with the phone
// held sideways) would need two more sightings and is left at zero.
import { degToRad } from '../../quantity.js';
import { wrapAngleRad } from './clinometer.js';

// Minimum cos(elevation) the ε0 term is divided by — the model is only
// fitted near horizontal; near vertical the term is meaningless anyway.
const MIN_COS_ELEVATION = 0.2;

export function biasRad(calibration, elevationRad, rollRad) {
  if (!calibration) return 0;
  const cosE = Math.max(MIN_COS_ELEVATION, Math.cos(elevationRad));
  return calibration.bias0Rad / cosE + calibration.biasCosRad * Math.cos(rollRad) + calibration.biasSinRad * Math.sin(rollRad);
}

export function correctedElevationRad(calibration, elevationRad, rollRad) {
  return elevationRad - biasRad(calibration, elevationRad, rollRad);
}

// `kind`: 'surface' (hands-free, camera off) or 'sight' (hand-held, on a
// tap, camera on). `turned`: the surface step that needs the half turn
// first.
export const CALIBRATION_STEPS = [
  { id: 'upright', kind: 'surface', rollRad: 0, turned: false, textKey: 'angleMeter.calibration.upright' },
  { id: 'turned', kind: 'surface', rollRad: 0, turned: true, textKey: 'angleMeter.calibration.turned' },
  { id: 'sightUpright', kind: 'sight', rollRad: 0, turned: false, textKey: 'angleMeter.calibration.sightUpright' },
  { id: 'sightUpsideDown', kind: 'sight', rollRad: Math.PI, turned: false, textKey: 'angleMeter.calibration.sightUpsideDown' }
];

// Wall-clock bookkeeping, not quantities of the domain.
export const CAPTURE_MS = 1500;
const MIN_SAMPLES = 10;
// A reading further than this from the still stretch's mean is a jolt and
// restarts it (on the turned step the roll limit also applies to the
// heading). Smaller scatter is expected and averaged out: on a long edge
// one phone's readings scattered by half a degree while it stood still,
// which tighter limits mistook for movement, so the reading never
// completed.
const STILL_DEVIATION_RAD = degToRad(2.5);
// A real move lasts; a glitch doesn't. A deviating reading only restarts
// the stretch once this many arrive in a row — fewer are outliers, left
// out of the mean. One phone, standing untouched, sent single readings
// several degrees off every second or so.
const JOLT_SAMPLES = 5;
const STILL_ROLL_DEVIATION_RAD = degToRad(5);
// What a reading needs instead of every sample sitting tight: its mean
// known to this (standard error), and no drift between the stretch's two
// halves beyond DRIFT_RAD (the phone still settling). A noisy sensor just
// takes longer, up to MAX_WINDOW_MS of averaging.
const MEAN_PRECISION_RAD = degToRad(0.06);
const DRIFT_RAD = degToRad(0.15);
const MAX_WINDOW_MS = 5000;
// Picking the phone up and setting it down moves it at least this much.
const MOVED_ELEVATION_RAD = degToRad(3);
const MOVED_ROLL_RAD = degToRad(25);
const MOVED_HEADING_RAD = degToRad(20);
const ROLL_TOLERANCE_RAD = degToRad(25);
const ELEVATION_TOLERANCE_RAD = degToRad(15);
const TURN_TOLERANCE_RAD = degToRad(45);
// Beyond these the readings are not a calibratable phone but a slip — a
// reading taken mid-move, the wrong edge, a soft surface.
const MAX_BIAS_RAD = degToRad(5);
const MAX_SLOPE_RAD = degToRad(15);
const MAX_TARGET_ELEVATION_RAD = degToRad(45);
// A sighting is the mean of the readings in this stretch before the tap,
// leaving out the last moments, when the tap itself jolts the phone.
const SIGHT_WINDOW_MS = 1000;
const SIGHT_TAP_GUARD_MS = 150;
const SIGHT_MIN_SAMPLES = 10;
// the hand's own sway; more than this and the person wasn't holding on target
const SIGHT_MAX_SPREAD_RAD = degToRad(1);
const SIGHT_ELEVATION_TOLERANCE_RAD = degToRad(45);
const SIGHT_BUFFER_MS = 3000;

function circularMean(values) {
  return Math.atan2(values.reduce((a, v) => a + Math.sin(v), 0), values.reduce((a, v) => a + Math.cos(v), 0));
}

function segmentMean(segment) {
  const n = segment.length;
  const headings = segment.map((s) => s.headingRad);
  return {
    elevationRad: segment.reduce((a, s) => a + s.elevationRad, 0) / n,
    rollRad: circularMean(segment.map((s) => s.rollRad)),
    headingRad: headings.every((h) => h != null) ? circularMean(headings) : null
  };
}

function inPosture(step, reading) {
  const elevationTolerance = step.kind === 'sight' ? SIGHT_ELEVATION_TOLERANCE_RAD : ELEVATION_TOLERANCE_RAD;
  return Math.abs(wrapAngleRad(reading.rollRad - step.rollRad)) <= ROLL_TOLERANCE_RAD &&
    Math.abs(reading.elevationRad) <= elevationTolerance;
}

// Statuses `addSample` reports for the current step, with `progress`
// (0..1, how far the still stretch is towards a reading):
//   'position' — not standing (or held) as the step asks yet
//   'turn'     — standing right, but not turned round yet
//   'hold'     — standing right, staying still; progress counts up
//   'aim'      — a sighting step, held as asked: waiting for the tap
//   'captured' — this sample completed the step's reading (the run moved on)
//   'done'     — all readings taken
// and `capture()` for a sighting step's tap, which reports 'captured',
// 'done', 'position' (not held as asked) or 'unsteady'. The tap counts as
// happening at the latest reading: sensor events and taps are stamped by
// different clocks in some browsers, so a tap's own timestamp can't be
// matched against the readings'.
export function createCalibrationRun() {
  const captures = [];
  let moved = true;
  let segment = [];
  let pending = [];
  let recent = []; // every reading of the last SIGHT_BUFFER_MS, for a sighting tap
  let stillSinceMs = null;

  // The heading only counts on the turned step, where the phone stands
  // upright: on a long edge the orientation angles sit at gamma = ±90°,
  // where they flip between two equivalent forms, and some browsers don't
  // carry alpha along consistently — the heading derived from them then
  // jumps by half a turn from one sample to the next, though the phone is
  // still. Elevation and roll are unaffected by that flip.
  function movedSince(step, capture, reading) {
    return Math.abs(reading.elevationRad - capture.elevationRad) > MOVED_ELEVATION_RAD ||
      Math.abs(wrapAngleRad(reading.rollRad - capture.rollRad)) > MOVED_ROLL_RAD ||
      (step.turned && capture.headingRad != null && reading.headingRad != null && Math.abs(wrapAngleRad(reading.headingRad - capture.headingRad)) > MOVED_HEADING_RAD);
  }

  function addSample(sample, tMs) {
    if (captures.length === CALIBRATION_STEPS.length) return { status: 'done', progress: 1 };
    const step = CALIBRATION_STEPS[captures.length];
    recent.push({ ...sample, tMs });
    while (recent.length > 1 && recent[0].tMs < tMs - SIGHT_BUFFER_MS) recent.shift();
    if (step.kind === 'sight') {
      const last = segmentMean(recent.filter((s) => s.tMs >= tMs - SIGHT_WINDOW_MS));
      return { status: inPosture(step, last) ? 'aim' : 'position', progress: 0 };
    }
    const previous = captures[captures.length - 1];
    if (!moved && previous && movedSince(step, previous, sample)) moved = true;

    // readings from another source (clinometer.js switched to gravity) don't mix with the stretch so far
    if (segment.length > 0 && segment[segment.length - 1].source !== sample.source) {
      segment = [];
      pending = [];
    }
    if (segment.length > 0) {
      const mean = segmentMean(segment);
      const dElevation = Math.abs(sample.elevationRad - mean.elevationRad);
      const dRoll = Math.abs(wrapAngleRad(sample.rollRad - mean.rollRad));
      const dHeading = step.turned && mean.headingRad != null && sample.headingRad != null ? Math.abs(wrapAngleRad(sample.headingRad - mean.headingRad)) : 0;
      const reason = dElevation > STILL_DEVIATION_RAD ? 'elevation' : dRoll > STILL_ROLL_DEVIATION_RAD ? 'roll' : dHeading > STILL_ROLL_DEVIATION_RAD ? 'heading' : null;
      if (reason) {
        pending.push({ ...sample, tMs });
        if (pending.length >= JOLT_SAMPLES) {
          segment = pending;
          pending = [];
          stillSinceMs = segment[0].tMs;
        }
        sample = null; // in `pending` or the new stretch, not added below
      } else {
        pending = [];
      }
    }
    if (sample) {
      if (segment.length === 0) stillSinceMs = tMs;
      segment.push({ ...sample, tMs });
    }
    // at most the last MAX_WINDOW_MS is averaged; the stretch may be longer
    while (segment.length > 1 && segment[0].tMs < tMs - MAX_WINDOW_MS) segment.shift();
    const still = segmentMean(segment);
    const n = segment.length;
    const spreadRad = Math.sqrt(segment.reduce((a, s) => a + (s.elevationRad - still.elevationRad) ** 2, 0) / n);
    const half = Math.floor(n / 2);
    const meanOf = (list) => list.reduce((a, s) => a + s.elevationRad, 0) / list.length;
    const driftRad = half > 0 ? Math.abs(meanOf(segment.slice(0, half)) - meanOf(segment.slice(half))) : Infinity;
    const precisionRad = spreadRad / Math.sqrt(n);

    if (!inPosture(step, still)) return { status: 'position', progress: 0 };
    if (step.turned) {
      const first = captures[0];
      if (first && first.headingRad != null && still.headingRad != null &&
          Math.abs(wrapAngleRad(still.headingRad - first.headingRad - Math.PI)) > TURN_TOLERANCE_RAD) return { status: 'turn', progress: 0 };
    }
    if (!moved) return { status: step.turned ? 'turn' : 'position', progress: 0 };

    const progress = Math.min(1, (tMs - stillSinceMs) / CAPTURE_MS);
    if (progress < 1 || segment.length < MIN_SAMPLES) return { status: 'hold', progress };
    // long enough, but the mean not yet precise or still drifting: keep averaging
    if (precisionRad > MEAN_PRECISION_RAD || driftRad > Math.max(DRIFT_RAD, 3 * precisionRad)) return { status: 'hold', progress: 0.95 };
    captures.push({ elevationRad: still.elevationRad, rollRad: still.rollRad, headingRad: still.headingRad });
    moved = false;
    segment = [];
    return { status: captures.length === CALIBRATION_STEPS.length ? 'done' : 'captured', progress: 1 };
  }

  function capture() {
    const step = CALIBRATION_STEPS[captures.length];
    const tapMs = recent.length > 0 ? recent[recent.length - 1].tMs : -Infinity;
    if (!step || step.kind !== 'sight') return captures.length === CALIBRATION_STEPS.length ? 'done' : 'position';
    const window = recent.filter((s) => s.tMs >= tapMs - SIGHT_WINDOW_MS - SIGHT_TAP_GUARD_MS && s.tMs <= tapMs - SIGHT_TAP_GUARD_MS);
    if (window.length < SIGHT_MIN_SAMPLES) return 'unsteady';
    const mean = segmentMean(window);
    if (!inPosture(step, mean)) return 'position';
    const spreadRad = Math.sqrt(window.reduce((a, s) => a + (s.elevationRad - mean.elevationRad) ** 2, 0) / window.length);
    if (spreadRad > SIGHT_MAX_SPREAD_RAD) return 'unsteady';
    captures.push({ elevationRad: mean.elevationRad, rollRad: mean.rollRad, headingRad: mean.headingRad });
    moved = false;
    segment = [];
    recent = [];
    return captures.length === CALIBRATION_STEPS.length ? 'done' : 'captured';
  }

  return {
    addSample,
    capture,
    get stepIndex() { return captures.length; },
    // the sensor clock's latest reading time (bookkeeping)
    get lastSampleMs() { return recent.length > 0 ? recent[recent.length - 1].tMs : null; },
    get done() { return captures.length === CALIBRATION_STEPS.length; },
    result: () => solveCalibration(captures)
  };
}

// Solves A·x = b for a small square system (Gaussian elimination with
// partial pivoting); null when singular.
function solveLinear(A, b) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let pivot = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[pivot][c])) pivot = r;
    if (Math.abs(M[pivot][c]) < 1e-9) return null;
    [M[c], M[pivot]] = [M[pivot], M[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}

// `captures`: the four readings in CALIBRATION_STEPS order. Returns
// { bias0Rad, biasCosRad, biasSinRad } or null when they don't make a
// plausible calibration.
export function solveCalibration(captures) {
  if (!captures || captures.length !== CALIBRATION_STEPS.length) return null;
  const inv = (c) => 1 / Math.max(MIN_COS_ELEVATION, Math.cos(c.elevationRad));
  // unknowns: [τ (lean and slope), T (target elevation), ε0, εc]
  const [s1, s2, a1, a2] = captures;
  const rows = [
    [1, 0, inv(s1), Math.cos(s1.rollRad)],
    [-1, 0, inv(s2), Math.cos(s2.rollRad)],
    [0, 1, inv(a1), Math.cos(a1.rollRad)],
    [0, 1, inv(a2), Math.cos(a2.rollRad)]
  ];
  const x = solveLinear(rows, captures.map((c) => c.elevationRad));
  if (!x || x.some((v) => !Number.isFinite(v))) return null;
  const [slopeRad, targetRad, bias0Rad, biasCosRad] = x;
  if (Math.abs(slopeRad) > MAX_SLOPE_RAD || Math.abs(targetRad) > MAX_TARGET_ELEVATION_RAD) return null;
  if ([bias0Rad, biasCosRad].some((v) => Math.abs(v) > MAX_BIAS_RAD)) return null;
  return { bias0Rad, biasCosRad, biasSinRad: 0 };
}
