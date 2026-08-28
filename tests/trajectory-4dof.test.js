import test from 'node:test';
import assert from 'node:assert/strict';
import { canMakeStepper4dof, makeStepper4dof } from '../src/engine/trajectory-4dof.js';
import { makeStepper } from '../src/engine/trajectory.js';
import { resolveSpinDrift, spinDriftCm } from '../src/engine/spin-drift.js';

const YARD_M = 0.9144;

// .308"/168gr Sierra International (Matchking), McCoy Modern Exterior
// Ballistics 2nd ed., Ch. 9.8 — the exact bullet/scenario used to
// validate this module.
//
// Drag comes from the bullet's own real Cd0(Mach) curve (Appendix A),
// not a BC+drag-model approximation — deliberately, not just for
// precision: an earlier version of this test used bc:0.462 with
// dragModel:'G7', which looks plausible (0.462 is this bullet's real,
// commonly-published BC) but is actually its *G1* BC, roughly 2x its
// real G7 BC — silently doubling the modeled drag deceleration. That
// single test-harness mistake was misread as a bug in the yaw-of-repose
// formula, since it degraded 1000yd drift by a consistent ~1.6x across
// twist rates. Real cdTable data sidesteps BC/drag-model guessing
// entirely for a bullet the book already gives full aero data for.
const CD0_TABLE = [
  [0, .140], [.8, .140], [.85, .142], [.90, .160], [.95, .240], [1.00, .430],
  [1.05, .449], [1.1, .447], [1.2, .434], [1.4, .410], [1.6, .385], [1.8, .365],
  [2.0, .350], [2.2, .339], [2.3, .320]
];

function referenceBullet(twistIn, twistDirection = 'right') {
  return {
    cdTable: CD0_TABLE,
    massKg: 168 / 15432.358352941432,
    caliberM: 0.308 * 0.0254,
    lengthM: 1.226 * 0.0254,
    muzzleVelocity: 2600 * 0.3048,
    riflingTwistMm: twistIn * 25.4,
    twistDirection
  };
}

function runToRange(step, initial, targetM) {
  let prev = initial, pt = initial;
  let guard = 0;
  while (pt.x < targetM) {
    prev = pt;
    pt = step(pt);
    if (++guard > 20000) throw new Error('runToRange: target range never reached');
  }
  const frac = (targetM - prev.x) / (pt.x - prev.x);
  return {
    z: prev.z + frac * (pt.z - prev.z),
    p: prev.p + frac * (pt.p - prev.p),
    t: prev.t + frac * (pt.t - prev.t)
  };
}

function driftInchesAtRange(twistIn, targetM, twistDirection = 'right') {
  const state = referenceBullet(twistIn, twistDirection);
  const { step, p0 } = makeStepper4dof(state);
  const initial = { x: 0, y: 0, z: 0, vx: state.muzzleVelocity, vy: 0, vz: 0, p: p0, t: 0 };
  const { z } = runToRange(step, initial, targetM);
  return -z * 100 / 2.54; // -z = right (this engine's convention), m -> inches
}

test('formula structure still reproduces McCoy\'s own published values when CMalpha/Iy are taken unscaled from his own book, not through the Lapua-calibrated pipeline', () => {
  // NOT a regression test of this module's production pipeline (see the
  // next test for that) — this specifically re-verifies the underlying
  // *equations* haven't drifted, by bypassing aero-coefficients.js's
  // estimation/calibration entirely and using McCoy's own raw numbers
  // (Table 9.2's Ix/Iy, Appendix A's Cd0/CLalpha/CMalpha0/Clp) directly.
  // That reproduces his published 1000yd drift for this bullet
  // (10"/12"/14" twist) to within 0.5%. This and the production-pipeline
  // comparison below now deliberately diverge: the production pipeline
  // was recalibrated against Lapua's independent, modern radar data
  // (see the next test) after McCoy's own Iy for this bullet turned out
  // to likely carry a real measurement bias (1970s-80s spark-range
  // photography vs. Lapua's modern Doppler radar), so it no longer
  // targets his published numbers as closely as this raw-equation check
  // does.
  const GRAVITY = 9.80665, IN_TO_M = 0.0254, LBIN2_TO_KGM2 = 0.45359237 * IN_TO_M ** 2;
  const d = 0.308 * IN_TO_M, m = 168 / 15432.358352941432, S = Math.PI / 4 * d * d;
  const Ix = 0.000247 * LBIN2_TO_KGM2, Iy = 0.001838 * LBIN2_TO_KGM2;
  const rho0 = 1.2250122659906946, a0 = 340.2940059031162; // standard sea level (15C, 1013.25 hPa)
  const CD0 = [[0, .140], [.8, .140], [.85, .142], [.9, .160], [.95, .240], [1, .430], [1.05, .449], [1.1, .447], [1.2, .434], [1.4, .410], [1.6, .385], [1.8, .365], [2, .350], [2.2, .339], [2.3, .320]];
  const CLALPHA = [[0, 1.75], [.5, 1.63], [.8, 1.45], [.85, 1.40], [.9, 1.35], [.95, 1.30], [1, 1.35], [1.05, 1.55], [1.1, 1.70], [1.2, 1.90], [1.4, 2.15], [1.6, 2.32], [1.8, 2.45], [2, 2.58], [2.2, 2.68], [2.5, 2.85]];
  const CMALPHA0 = [[0, 3.05], [.5, 3.26], [.8, 3.38], [.85, 3.40], [.9, 3.43], [.95, 3.45], [1, 3.24], [1.05, 3.17], [1.1, 3.15], [1.2, 3.12], [1.4, 3.06], [1.6, 2.98], [1.8, 2.88], [2, 2.79], [2.2, 2.69], [2.5, 2.56]];
  const CLP = [[0, -.0150], [.5, -.0125], [.8, -.0108], [.85, -.0107], [.9, -.0105], [.95, -.0103], [1, -.0100], [1.05, -.0099], [1.1, -.0098], [1.2, -.0095], [1.4, -.0088], [1.6, -.0083], [1.8, -.0080], [2, -.0075], [2.2, -.0073], [2.5, -.0068]];
  function interp(t, x) { const l = t.length - 1; if (x <= t[0][0]) return t[0][1]; if (x >= t[l][0]) return t[l][1]; let i = 0; while (t[i + 1][0] < x) i++; const [x0, y0] = t[i], [x1, y1] = t[i + 1]; return y0 + (y1 - y0) * (x - x0) / (x1 - x0); }
  function driftInchesRaw(twistIn, targetM) {
    const p0 = 2 * Math.PI * (2600 * 0.3048) / (twistIn * IN_TO_M) * -1;
    let x = 0, y = 0, z = 0, vx = 2600 * 0.3048, vy = 0, vz = 0, p = p0, t = 0;
    const H = 0.005;
    while (x < targetM) {
      const deriv = (vx, vy, vz, p) => {
        const speed = Math.sqrt(vx * vx + vy * vy + vz * vz), mach = speed / a0;
        const cd0 = interp(CD0, mach), cla = interp(CLALPHA, mach), cma = interp(CMALPHA0, mach), clp = interp(CLP, mach);
        const yawScale = (-2 * Ix * p) / (rho0 * S * d * cma * speed ** 4);
        const aRx = yawScale * (vz * GRAVITY), aRz = yawScale * (-vx * GRAVITY);
        const dragAccel = (rho0 * S * cd0 / (2 * m)) * speed, liftFactor = (rho0 * S * cla / (2 * m)) * speed * speed;
        const dpdt = (rho0 * S * d * d * clp / (2 * Ix)) * speed * p;
        return { ax: -dragAccel * vx + liftFactor * aRx, ay: -dragAccel * vy - GRAVITY, az: -dragAccel * vz + liftFactor * aRz, dpdt };
      };
      const k1 = deriv(vx, vy, vz, p);
      const k2 = deriv(vx + k1.ax * H / 2, vy + k1.ay * H / 2, vz + k1.az * H / 2, p + k1.dpdt * H / 2);
      const k3 = deriv(vx + k2.ax * H / 2, vy + k2.ay * H / 2, vz + k2.az * H / 2, p + k2.dpdt * H / 2);
      const k4 = deriv(vx + k3.ax * H, vy + k3.ay * H, vz + k3.az * H, p + k3.dpdt * H);
      const ax = (k1.ax + 2 * k2.ax + 2 * k3.ax + k4.ax) / 6, ay = (k1.ay + 2 * k2.ay + 2 * k3.ay + k4.ay) / 6, az = (k1.az + 2 * k2.az + 2 * k3.az + k4.az) / 6;
      const dpdt = (k1.dpdt + 2 * k2.dpdt + 2 * k3.dpdt + k4.dpdt) / 6;
      const hh6 = H * H / 6;
      x += vx * H + hh6 * (k1.ax + k2.ax + k3.ax); y += vy * H + hh6 * (k1.ay + k2.ay + k3.ay); z += vz * H + hh6 * (k1.az + k2.az + k3.az);
      vx += ax * H; vy += ay * H; vz += az * H; p += dpdt * H; t += H;
    }
    return -z * 100 / 2.54;
  }
  const golden = { 10: 11.1, 12: 9.3, 14: 8.0 };
  for (const [twist, expectedIn] of Object.entries(golden)) {
    const got = driftInchesRaw(Number(twist), 1000 * YARD_M);
    const relErr = Math.abs(got - expectedIn) / expectedIn;
    assert.ok(relErr < 0.01, `twist ${twist}": got ${got.toFixed(3)} in, expected ${expectedIn} in (${(relErr * 100).toFixed(2)}% off)`);
  }
});

// Independent (bullet, twist, drift-at-1000m) data pulled from Lapua's
// own radar-measured 6-DOF calculator by the user — this app's built-in
// `lapua-cd` bullet library supplied the exact mass/caliber/length/
// Cd(Mach) for each. 20 bullets total: the original 14-bullet
// calibration set below plus a later 6-bullet holdout batch (further
// down this file) never used to fit anything. This is the module's real
// regression anchor now: aero-coefficients.js's Iy(L/d) fit is
// calibrated directly against the first batch, not McCoy's book.
function driftCmAtRangeForState(state, targetM) {
  const { step, p0 } = makeStepper4dof(state);
  const initial = { x: 0, y: 0, z: 0, vx: state.muzzleVelocity, vy: 0, vz: 0, p: p0, t: 0 };
  const { z } = runToRange(step, initial, targetM);
  return -z * 100;
}

function lapuaBulletState({ caliberM, lengthM, massKg, twistIn, cdTable }) {
  return { cdTable, massKg, caliberM, lengthM, muzzleVelocity: 800, riflingTwistMm: twistIn * 25.4,
    twistDirection: 'right', tempC: 15, pressureHpa: 1000, humidityPct: 0 };
}

test('drift at 1000m matches Lapua\'s radar-measured values for bullets within the Iy(L/d) fit\'s own calibration range', () => {
  const bullets = [
    { label: 'GB422 167gr Scenar .308', twistIn: 12, golden: 21.6, caliberM: 0.00783, lengthM: 0.0315, massKg: 0.01085,
      cdTable: [[0, 0.18], [0.4, 0.178], [0.5, 0.154], [0.6, 0.129], [0.7, 0.131], [0.8, 0.136], [0.825, 0.14], [0.85, 0.144], [0.875, 0.153], [0.9, 0.177], [0.925, 0.226], [0.95, 0.26], [0.975, 0.349], [1, 0.427], [1.025, 0.45], [1.05, 0.452], [1.075, 0.45], [1.1, 0.447], [1.15, 0.437], [1.2, 0.429], [1.3, 0.418], [1.4, 0.406], [1.5, 0.394], [1.6, 0.382], [1.8, 0.359], [2, 0.339], [2.2, 0.321], [2.4, 0.301], [2.6, 0.28], [3, 0.25], [4, 0.2], [5, 0.18]] },
    { label: 'GB458 139gr Scenar 6.5mm', twistIn: 8, golden: 14.8, caliberM: 0.00671, lengthM: 0.0349, massKg: 0.009,
      cdTable: [[0, 0.19], [0.4, 0.19], [0.5, 0.186], [0.6, 0.182], [0.7, 0.167], [0.8, 0.155], [0.825, 0.154], [0.85, 0.152], [0.875, 0.151], [0.9, 0.152], [0.925, 0.167], [0.95, 0.228], [0.975, 0.296], [1, 0.379], [1.025, 0.388], [1.05, 0.391], [1.075, 0.389], [1.1, 0.386], [1.15, 0.378], [1.2, 0.371], [1.3, 0.354], [1.4, 0.339], [1.5, 0.328], [1.6, 0.319], [1.8, 0.301], [2, 0.288], [2.2, 0.278], [2.4, 0.261], [2.6, 0.248], [3, 0.23], [4, 0.2], [5, 0.19]] },
    { label: 'GB528 300gr Scenar .338', twistIn: 10, golden: 14.1, caliberM: 0.0086, lengthM: 0.0443, massKg: 0.01944,
      cdTable: [[0, 0.23], [0.3, 0.23], [0.4, 0.229], [0.5, 0.2], [0.6, 0.171], [0.7, 0.164], [0.8, 0.144], [0.85, 0.137], [0.875, 0.137], [0.9, 0.142], [0.925, 0.154], [0.95, 0.177], [0.975, 0.236], [1, 0.306], [1.025, 0.334], [1.05, 0.341], [1.075, 0.345], [1.1, 0.347], [1.125, 0.348], [1.15, 0.348], [1.2, 0.348], [1.3, 0.343], [1.4, 0.336], [1.5, 0.328], [1.6, 0.321], [1.8, 0.304], [2, 0.292], [2.2, 0.282], [2.6, 0.267], [3, 0.257], [4, 0.245], [5, 0.24]] }
  ];
  for (const b of bullets) {
    const got = driftCmAtRangeForState(lapuaBulletState(b), 1000);
    const relErr = Math.abs(got - b.golden) / b.golden;
    assert.ok(relErr < 0.12, `${b.label}: got ${got.toFixed(2)} cm, expected ${b.golden} cm (${(relErr * 100).toFixed(1)}% off)`);
  }
});

test('the Iy(L/d) fit generalizes to calibers it was never fitted on (6mm, 7mm), for in-range L/d and lead-core construction', () => {
  // A later holdout batch — none of these three fed the fit at all (the
  // fit only ever saw .224/6.5mm/.308/.338). All three land within a few
  // percent of the calibration set's own error, which is real evidence
  // the L/d relationship reflects actual physics rather than being
  // overfit to the calibers it happened to be built from.
  const bullets = [
    { label: 'GB493 90gr Scenar 6mm', twistIn: 8, golden: 21.3, caliberM: 0.00618, lengthM: 0.028, massKg: 0.0058,
      cdTable: [[0, 0.292], [0.3, 0.283], [0.4, 0.273], [0.5, 0.261], [0.6, 0.248], [0.7, 0.238], [0.8, 0.237], [0.85, 0.262], [0.875, 0.304], [0.9, 0.347], [0.925, 0.365], [0.95, 0.364], [0.975, 0.386], [1, 0.419], [1.025, 0.436], [1.05, 0.436], [1.075, 0.435], [1.1, 0.43], [1.125, 0.425], [1.15, 0.419], [1.2, 0.405], [1.3, 0.38], [1.4, 0.363], [1.5, 0.35], [1.6, 0.337], [1.8, 0.314], [2, 0.296], [2.2, 0.283], [2.6, 0.26], [3, 0.245], [4, 0.225], [5, 0.215]] },
    { label: 'GB542 105gr Scenar-L 6mm', twistIn: 8, golden: 14.9, caliberM: 0.00618, lengthM: 0.032, massKg: 0.0068,
      cdTable: [[0, 0.2], [0.4, 0.2], [0.5, 0.198], [0.6, 0.195], [0.7, 0.188], [0.8, 0.16], [0.825, 0.158], [0.85, 0.155], [0.875, 0.153], [0.9, 0.153], [0.925, 0.158], [0.95, 0.178], [0.975, 0.22], [1, 0.327], [1.025, 0.342], [1.05, 0.351], [1.075, 0.356], [1.1, 0.36], [1.15, 0.363], [1.2, 0.361], [1.3, 0.355], [1.4, 0.35], [1.5, 0.344], [1.6, 0.339], [1.8, 0.329], [2, 0.319], [2.2, 0.304], [2.4, 0.29], [2.6, 0.278], [3, 0.254], [4, 0.22], [5, 0.2]] },
    { label: 'GB553 150gr Scenar-L 7mm', twistIn: 9, golden: 17.0, caliberM: 0.007, lengthM: 0.034, massKg: 0.0097,
      cdTable: [[0, 0.23], [0.3, 0.22], [0.4, 0.21], [0.457, 0.2093], [0.482, 0.2034], [0.507, 0.1963], [0.532, 0.1907], [0.557, 0.1867], [0.582, 0.182], [0.607, 0.181], [0.632, 0.1794], [0.657, 0.1795], [0.682, 0.1774], [0.707, 0.175], [0.732, 0.1643], [0.757, 0.1569], [0.782, 0.1528], [0.807, 0.1464], [0.832, 0.1419], [0.857, 0.1419], [0.882, 0.1416], [0.907, 0.1458], [0.932, 0.1593], [0.957, 0.1807], [0.982, 0.2658], [1.007, 0.3295], [1.032, 0.3456], [1.057, 0.3565], [1.082, 0.3635], [1.107, 0.3671], [1.132, 0.3684], [1.157, 0.3691], [1.182, 0.3686], [1.207, 0.3673], [1.232, 0.3658], [1.257, 0.3644], [1.282, 0.3626], [1.307, 0.3608], [1.332, 0.3586], [1.357, 0.3568], [1.382, 0.3549], [1.407, 0.3534], [1.432, 0.3516], [1.457, 0.3497], [1.482, 0.3484], [1.507, 0.3469], [1.532, 0.3454], [1.557, 0.3435], [1.582, 0.3416], [1.607, 0.3399], [1.632, 0.3384], [1.657, 0.3366], [1.682, 0.3349], [1.707, 0.3332], [1.732, 0.3319], [1.757, 0.3301], [1.782, 0.3285], [1.807, 0.327], [1.832, 0.3253], [1.857, 0.3241], [1.882, 0.3228], [1.907, 0.3211], [1.932, 0.3197], [1.957, 0.3189], [1.982, 0.3172], [2.007, 0.3156], [2.032, 0.3141], [2.057, 0.313], [2.082, 0.3117], [2.107, 0.3105], [2.132, 0.3092], [2.157, 0.3082], [2.182, 0.3077], [2.207, 0.3064], [2.232, 0.3053], [2.257, 0.304], [2.282, 0.3027], [2.307, 0.3015], [2.332, 0.3003], [2.357, 0.299], [2.382, 0.2976], [2.407, 0.2962], [2.432, 0.2948], [2.457, 0.2936], [2.482, 0.2922], [2.507, 0.2911], [2.532, 0.2906], [2.557, 0.2897], [2.582, 0.2886], [2.607, 0.2881], [2.632, 0.2872], [2.657, 0.2858], [2.682, 0.2844], [2.707, 0.2832], [2.732, 0.2818], [2.757, 0.2803], [2.782, 0.279], [2.807, 0.2773], [2.832, 0.2768], [2.857, 0.274], [3, 0.27], [3.5, 0.255], [4, 0.243], [4.5, 0.235], [5, 0.23]] }
  ];
  for (const b of bullets) {
    const got = driftCmAtRangeForState(lapuaBulletState(b), 1000);
    const relErr = Math.abs(got - b.golden) / b.golden;
    assert.ok(relErr < 0.12, `${b.label}: got ${got.toFixed(2)} cm, expected ${b.golden} cm (${(relErr * 100).toFixed(1)}% off)`);
  }
});

test('a bullet past the Iy(L/d) fit\'s own upper L/d bound shows a larger, documented gap — the clamp\'s real edge, not silently extrapolated', () => {
  // GB554 (180gr Scenar-L 7mm, L/d=5.43) is lead-core, same construction
  // and shape family as everything the fit was built from — it just sits
  // past the fitted range's own maximum (5.201). Its ~24% error, well
  // above the ~7-12% seen for in-range bullets, is what the clamp-rather-
  // than-extrapolate design in aero-coefficients.js is choosing to accept
  // rather than risk something worse from extrapolating the line further.
  const state = lapuaBulletState({
    twistIn: 9, caliberM: 0.007, lengthM: 0.038, massKg: 0.01166,
    cdTable: [[0, 0.223], [0.3, 0.221], [0.382, 0.22], [0.4, 0.22], [0.4035, 0.22], [0.425, 0.2153], [0.4465, 0.2138], [0.468, 0.2147], [0.4895, 0.2055], [0.511, 0.2047], [0.5325, 0.2033], [0.554, 0.2029], [0.5755, 0.201], [0.597, 0.1984], [0.6185, 0.1998], [0.64, 0.1965], [0.6615, 0.2016], [0.683, 0.1941], [0.7045, 0.1843], [0.726, 0.18], [0.7475, 0.1712], [0.769, 0.166], [0.7905, 0.157], [0.812, 0.1536], [0.8335, 0.1515], [0.855, 0.1508], [0.8765, 0.1502], [0.898, 0.1525], [0.9195, 0.1609], [0.941, 0.1776], [0.9625, 0.1981], [0.984, 0.2825], [1.0055, 0.3353], [1.027, 0.3472], [1.0485, 0.3539], [1.07, 0.3568], [1.0915, 0.3564], [1.113, 0.3552], [1.1345, 0.3542], [1.156, 0.3537], [1.1775, 0.3534], [1.199, 0.3528], [1.2205, 0.3521], [1.242, 0.3512], [1.2635, 0.3497], [1.285, 0.3485], [1.3065, 0.3473], [1.328, 0.3464], [1.3495, 0.3453], [1.371, 0.344], [1.3925, 0.3429], [1.414, 0.3415], [1.4355, 0.3399], [1.457, 0.3382], [1.4785, 0.3366], [1.5, 0.3348], [1.5215, 0.3335], [1.543, 0.3319], [1.5645, 0.33], [1.586, 0.3282], [1.6075, 0.3265], [1.629, 0.3251], [1.6505, 0.3234], [1.672, 0.3221], [1.6935, 0.3208], [1.715, 0.3196], [1.7365, 0.3182], [1.758, 0.3171], [1.7795, 0.316], [1.801, 0.3146], [1.8225, 0.3136], [1.844, 0.3123], [1.8655, 0.3113], [1.887, 0.3101], [1.9085, 0.3088], [1.93, 0.3076], [1.9515, 0.3062], [1.973, 0.3051], [1.9945, 0.3034], [2.016, 0.3024], [2.0375, 0.3012], [2.059, 0.3001], [2.0805, 0.2984], [2.102, 0.2965], [2.1235, 0.2951], [2.145, 0.2939], [2.1665, 0.2924], [2.188, 0.291], [2.2095, 0.2897], [2.231, 0.2884], [2.2525, 0.2874], [2.274, 0.286], [2.2955, 0.2849], [2.317, 0.2838], [2.3385, 0.2829], [2.36, 0.2835], [2.3815, 0.2831], [2.403, 0.2826], [2.4245, 0.2814], [2.446, 0.2806], [2.4675, 0.2797], [2.489, 0.2786], [2.5105, 0.2737], [2.532, 0.272], [3, 0.249], [3.5, 0.23], [4, 0.218], [4.5, 0.21], [5, 0.205]]
  });
  const got = driftCmAtRangeForState(state, 1000);
  const golden = 14.5;
  const relErr = Math.abs(got - golden) / golden;
  assert.ok(relErr > 0.15, `expected a larger (>15%) gap past the fitted L/d range, got only ${(relErr * 100).toFixed(1)}% off — if this now passes tightly, the fit's range may have changed and this test's premise should be revisited`);
});

test('non-lead-core construction (AP and monolithic) is a known, documented limitation regardless of L/d, not silently "fixed"', () => {
  // AP492 (165gr .308 AP, steel core) was deliberately excluded from the
  // Iy(L/d) fit — its internal mass distribution differs meaningfully
  // from the lead-core match bullets the fit is based on. A later holdout
  // bullet, N563 (140gr 6.5mm Naturalis, monolithic copper-alloy
  // construction), sits comfortably *inside* the fitted L/d range
  // (5.08, nowhere near either edge) yet shows an almost identical-sized
  // error — confirming this isn't specifically about steel cores or
  // about range extrapolation, it's that any bullet whose mass
  // distribution meaningfully departs from lead-core-plus-jacket isn't
  // well served by a length-only correction. This test locks in that
  // both known gaps are still there, rather than letting a future change
  // silently paper over a limitation the model genuinely has.
  const ap492 = lapuaBulletState({
    twistIn: 12, caliberM: 0.00783, lengthM: 0.029, massKg: 0.0107,
    cdTable: [[0, 0.18], [0.3, 0.18], [0.4, 0.18], [0.5, 0.152], [0.6, 0.122], [0.7, 0.116], [0.8, 0.116], [0.85, 0.13], [0.875, 0.163], [0.9, 0.224], [0.925, 0.277], [0.95, 0.342], [0.975, 0.403], [1, 0.445], [1.025, 0.471], [1.05, 0.483], [1.075, 0.485], [1.1, 0.483], [1.125, 0.478], [1.15, 0.474], [1.2, 0.462], [1.3, 0.438], [1.4, 0.418], [1.5, 0.402], [1.6, 0.388], [1.8, 0.367], [2, 0.349], [2.2, 0.331], [2.6, 0.29], [3, 0.265], [4, 0.225], [5, 0.21]]
  });
  const n563 = lapuaBulletState({
    twistIn: 8, caliberM: 0.00671, lengthM: 0.0341, massKg: 0.0091,
    cdTable: [[0, 0.5], [0.3, 0.47], [0.4, 0.468], [0.5, 0.464], [0.6, 0.459], [0.7, 0.467], [0.8, 0.494], [0.85, 0.506], [0.875, 0.511], [0.9, 0.514], [0.925, 0.517], [0.95, 0.522], [0.975, 0.561], [1, 0.619], [1.025, 0.647], [1.05, 0.66], [1.075, 0.674], [1.1, 0.689], [1.125, 0.703], [1.15, 0.714], [1.2, 0.73], [1.3, 0.766], [1.4, 0.79], [1.5, 0.81], [1.6, 0.825], [1.8, 0.844], [2, 0.843], [2.2, 0.809], [2.4, 0.775], [2.6, 0.73], [3, 0.66], [4, 0.46], [5, 0.4]]
  });
  const cases = [
    { label: 'AP492 165gr AP .308', state: ap492, golden: 19.1 },
    { label: 'N563 140gr Naturalis 6.5mm', state: n563, golden: 57.9 }
  ];
  for (const c of cases) {
    const got = driftCmAtRangeForState(c.state, 1000);
    const relErr = Math.abs(got - c.golden) / c.golden;
    assert.ok(relErr > 0.2, `expected ${c.label} to still show a large (>20%) gap documenting this known limitation, got only ${(relErr * 100).toFixed(1)}% off — if this now passes cleanly, the limitation may have been fixed elsewhere and this test's premise should be revisited`);
  }
});

test('faster twist produces more drift than slower twist, at the same range', () => {
  const d10 = driftInchesAtRange(10, 1000 * YARD_M);
  const d12 = driftInchesAtRange(12, 1000 * YARD_M);
  const d14 = driftInchesAtRange(14, 1000 * YARD_M);
  assert.ok(d10 > d12 && d12 > d14, `expected d10 > d12 > d14, got ${d10}, ${d12}, ${d14}`);
});

test('drift magnitude grows monotonically with time of flight over a full-range flight, not fluctuating in and out', () => {
  const state = referenceBullet(12);
  const { step, p0 } = makeStepper4dof(state);
  let pt = { x: 0, y: 0, z: 0, vx: state.muzzleVelocity, vy: 0, vz: 0, p: p0, t: 0 };
  const samples = [];
  while (pt.x < 1000 * YARD_M) {
    pt = step(pt);
    samples.push({ t: pt.t, absDriftCm: Math.abs(pt.z) * 100 });
  }
  // Coarse, well-separated checkpoints (every 50th raw RK4 point) rather
  // than every single step — this is checking genuine growth over real
  // time, not sensitive to any sub-step numerical noise between adjacent
  // raw points.
  const checkpoints = samples.filter((_, i) => i % 50 === 0);
  assert.ok(checkpoints.length > 3, 'expected enough checkpoints for a meaningful monotonic check');
  for (let i = 1; i < checkpoints.length; i++) {
    assert.ok(
      checkpoints[i].absDriftCm > checkpoints[i - 1].absDriftCm,
      `drift did not grow between t=${checkpoints[i - 1].t.toFixed(2)}s (${checkpoints[i - 1].absDriftCm.toFixed(3)}cm) and t=${checkpoints[i].t.toFixed(2)}s (${checkpoints[i].absDriftCm.toFixed(3)}cm)`
    );
  }
});

test('right-hand twist drifts in the same direction (sign) as the existing Litz-based spin-drift.js', () => {
  const twistIn = 12;
  const state4dof = referenceBullet(twistIn, 'right');
  const drift4dof = driftInchesAtRange(twistIn, 1000 * YARD_M, 'right');

  const litzState = { massKg: state4dof.massKg, caliberM: state4dof.caliberM, lengthM: state4dof.lengthM, riflingTwistMm: state4dof.riflingTwistMm, calculateSpinDrift: true, twistDirection: 'right' };
  const spinDrift = resolveSpinDrift(litzState, state4dof.muzzleVelocity);
  const litzWindageCm = spinDriftCm(spinDrift, 1000 * YARD_M / state4dof.muzzleVelocity); // rough TOF estimate is fine — sign is what matters

  // Both should agree that right-hand twist drifts to the same side —
  // spinDriftCm's own convention: negative = right (this engine's -z).
  assert.ok(drift4dof > 0, `4dof drift should be positive inches-to-the-right, got ${drift4dof}`);
  assert.ok(litzWindageCm < 0, `Litz windage should be negative (right), got ${litzWindageCm}`);
});

test('left-hand twist drifts the opposite direction from right-hand twist', () => {
  const right = driftInchesAtRange(12, 1000 * YARD_M, 'right');
  const left = driftInchesAtRange(12, 1000 * YARD_M, 'left');
  assert.ok(right > 0 && left < 0, `expected opposite signs, got right=${right}, left=${left}`);
  assert.ok(Math.abs(right + left) / right < 1e-9, 'magnitudes should be identical, only sign should flip');
});

test('spin rate decays (never grows) over a long flight', () => {
  const state = referenceBullet(12);
  const { step, p0 } = makeStepper4dof(state);
  let pt = { x: 0, y: 0, z: 0, vx: state.muzzleVelocity, vy: 0, vz: 0, p: p0, t: 0 };
  let lastAbsP = Math.abs(p0);
  for (let i = 0; i < 2000; i++) {
    pt = step(pt);
    const absP = Math.abs(pt.p);
    assert.ok(absP <= lastAbsP + 1e-6, `|p| grew at step ${i}: ${absP} > ${lastAbsP}`);
    lastAbsP = absP;
  }
  assert.ok(lastAbsP < Math.abs(p0), 'spin should have decayed measurably over a long flight');
});

test('drop and velocity closely match the existing 3-DOF model (new terms are a small perturbation)', () => {
  const state = referenceBullet(12);
  const { step: step4 } = makeStepper4dof(state);
  const { step: step3 } = makeStepper(state);

  let p4 = { x: 0, y: 0, z: 0, vx: state.muzzleVelocity, vy: 0, vz: 0, p: 0, t: 0 };
  let p3 = { x: 0, y: 0, z: 0, vx: state.muzzleVelocity, vy: 0, vz: 0, t: 0 };
  for (let i = 0; i < 500; i++) { p4 = step4(p4); p3 = step3(p3); }

  assert.ok(Math.abs(p4.y - p3.y) / Math.abs(p3.y) < 0.001, `drop diverged: 4dof=${p4.y}, 3dof=${p3.y}`);
  assert.ok(Math.abs(p4.vx - p3.vx) / p3.vx < 0.001, `vx diverged: 4dof=${p4.vx}, 3dof=${p3.vx}`);
});

test('zero crosswind still produces only a small Magnus-driven vertical effect, not a large accidental one', () => {
  // The Magnus-*moment* correction (eq. 9.56's CMpα term) genuinely does
  // add a small vertical component even with zero crosswind — the
  // dominant new term is -relVx*aRz0 (spin/Magnus coupling with the
  // bullet's own crossrange yaw of repose), which doesn't depend on wind
  // at all. That's real, sourced physics (see this file's header
  // comment), not a bug — but it's still a genuinely different, much
  // smaller effect than actual crosswind-induced aerodynamic jump, which
  // this module still doesn't model. This test's job is to catch a
  // *large* accidental y-component (a real aero-jump-sized bug), not to
  // claim zero vertical effect the way it used to before the Magnus term
  // existed.
  const withSpin = referenceBullet(12);
  const { step } = makeStepper4dof(withSpin);
  const { step: step3 } = makeStepper(withSpin);
  let p4 = { x: 0, y: 0, z: 0, vx: withSpin.muzzleVelocity, vy: 0, vz: 0, p: makeStepper4dof(withSpin).p0, t: 0 };
  let p3 = { x: 0, y: 0, z: 0, vx: withSpin.muzzleVelocity, vy: 0, vz: 0, t: 0 };
  for (let i = 0; i < 500; i++) { p4 = step(p4); p3 = step3(p3); }
  const relDiff = Math.abs(p4.y - p3.y) / Math.abs(p3.y);
  assert.ok(relDiff < 0.01, `drop diverged more than the small Magnus-moment effect should account for: 4dof=${p4.y}, 3dof=${p3.y} (${(relDiff * 100).toFixed(3)}%)`);
});

test('non-standard shooting-site atmosphere changes drift output end-to-end', () => {
  const standard = referenceBullet(12);
  const highAltitudeHot = { ...standard, tempC: 35, pressureHpa: 850, humidityPct: 10 };
  const driftStandard = driftInchesAtRange(12, 1000 * YARD_M);

  const state = highAltitudeHot;
  const { step, p0 } = makeStepper4dof(state);
  const initial = { x: 0, y: 0, z: 0, vx: state.muzzleVelocity, vy: 0, vz: 0, p: p0, t: 0 };
  const { z } = runToRange(step, initial, 1000 * YARD_M);
  const driftHot = -z * 100 / 2.54;

  assert.notEqual(driftHot, driftStandard, 'atmosphere should change the drift output, not just Sg/CMalpha internally');
});

test('canMakeStepper4dof mirrors canEstimateAeroCoefficients/canComputeStability', () => {
  const full = referenceBullet(12);
  assert.equal(canMakeStepper4dof(full), true);
  for (const key of ['massKg', 'caliberM', 'lengthM', 'muzzleVelocity', 'riflingTwistMm']) {
    assert.equal(canMakeStepper4dof({ ...full, [key]: null }), false, `${key}: null should be unknown`);
  }
});
