// Core engine for the Truing Session tool: plans a shooting session that
// separates muzzle velocity, drag scale, zero and scope-tracking errors
// from each other (rather than treating a DOPE log as forensics on all of
// them at once), sequences shots as a safety-checked ladder, and reports
// the result with an honest degeneracy/resolution readout rather than a
// single confident number. Pure functions over a `state` (the same shape
// computeImpact() takes) plus plain numbers/arrays, returning plain
// numbers/objects -- no DOM, no localStorage, no i18n strings, mirroring
// engine/target-shapes.js and engine/dispersion-sources.js. `r50ToSD` is
// deliberately not duplicated here; it's imported from
// dispersion-sources.js, which already has it.
//
// The blunder mixture-of-Gaussians model below is implemented in full:
// both per-target terms (rangeErrM_t and the inclination term), decided
// jointly across every flagged target rather than one at a time, with the
// inclination parameterised in u = 1 - cos(delta) and its one-sidedness
// enforced by rejecting negative-u hypotheses outright rather than by a
// post-hoc sign check on the reported number.

import { computeImpact, makeImpactWalker, resolveLaunchAngle, resolveMuzzleVelocity, solveZeroAngle } from './trajectory.js';
import { speedOfSound } from './atmosphere.js';
import { r50ToSD } from './dispersion-sources.js';

// ---- Constants and priors ----
export const SIGMA_POI_MRAD = 0.1 / 0.6745;      // 0.148258
export const SIGMA_ROUND_MRAD = 0.1 / Math.sqrt(12); // 0.028868
export const MATERIALITY_MRAD = 0.1;
export const SUPERSONIC_MACH = 1.1;
export const DEGENERACY_R = 0.8;
export const UNRESOLVED_SIGMA_MRAD = 0.15;       // the certainty picker's "Less certain" default

// ---- dragPct's own prior is a mixture, not one flat sigma ----
// Two independent, additive sources of "how wrong might the assumed BC
// be", from a survey of published-vs-measured BC figures across several
// manufacturers and bullet lines:
//  1. Published-vs-true error for the reference article itself. Annex B's
//     |published - gift BC| figures, read as a symmetric distribution
//     (the actual skew is one manufacturer's marketing practice, not
//     physics): mostly small (same-lab measurements cluster around 2%),
//     occasionally large for a manufacturer whose published figure is a
//     compromise across a velocity band rather than a measurement (up to
//     ~10%, averaging ~8.5% in that regime) -- roughly 15-20% of entries
//     exceed 5%, hence the 80/20 mixture weight below.
//  2. This-barrel-vs-reference-barrel variation (twist, bore, throat) --
//     Gaussian, a fixed 1.75% (2sigma = 3.5%), present on top of source 1
//     regardless of how good the published figure is: even an honestly
//     and precisely measured BC was measured on someone else's barrel,
//     not this one. Only actually zero if the BC in use was independently
//     measured on this exact rifle -- out of scope for this version;
//     dragPct stays "never checked" either way, unlike the other priors below.
// Combining: source 2 is Gaussian and independent of source 1, so
// convolving them is exact, not an approximation -- a Gaussian mixture
// convolved with an independent Gaussian is the same mixture with each
// component's variance increased by the Gaussian's variance. No new
// machinery beyond addition in quadrature.
export const SIGMA_DRAG_BARREL_PCT = 1.75;
export const SIGMA_DRAG_PUBLISHED_NARROW_PCT = 2;
export const SIGMA_DRAG_PUBLISHED_WIDE_PCT = 8.5;
export const DRAG_MIXTURE_WEIGHTS = [0.8, 0.2]; // typical / occasionally-a-marketing-outlier
export const SIGMA_DRAG_NARROW_PCT = Math.hypot(SIGMA_DRAG_PUBLISHED_NARROW_PCT, SIGMA_DRAG_BARREL_PCT);
export const SIGMA_DRAG_WIDE_PCT = Math.hypot(SIGMA_DRAG_PUBLISHED_WIDE_PCT, SIGMA_DRAG_BARREL_PCT);

// The single-number stand-in for planning (before any shots exist -- there
// is no fit yet to run a real mixture evidence comparison against, only a
// round count to price a forecast for), derived rather than assumed: the
// mixture's own marginal SD, both components centred at 0.
export function dragPctMarginalSigma(weights = DRAG_MIXTURE_WEIGHTS, sigmas = [SIGMA_DRAG_NARROW_PCT, SIGMA_DRAG_WIDE_PCT]) {
  return Math.sqrt(weights.reduce((s, w, i) => s + w * sigmas[i] * sigmas[i], 0));
}

export const DEFAULT_PRIORS_UNCHECKED = { zeroMrad: 0.25, v0Ms: 20, dragPct: dragPctMarginalSigma(), trackPct: 1, windMs: 2 };
export const DEFAULT_PRIORS_CHECKED_NO_CHRONO = { zeroMrad: 0.08, v0Ms: 20, dragPct: dragPctMarginalSigma(), trackPct: 0.15, windMs: 0.5 };

export const BASE_PARAMS = ['zeroMrad', 'v0Ms', 'dragPct', 'trackPct', 'windMs'];

// ---- The observable, and sign conventions ----
// ---- Conditions that change during a session, and the zero that does not ----
// A group of shots may carry its own atmosphere and wind (`conditions`), because a session can last hours and the
// air moves. Only these fields are ever taken from it; everything else about the shot is the rifle's and the bullet's.
export const CONDITION_KEYS = ['tempC', 'pressureHpa', 'humidityPct', 'altitudeM', 'windSpeed', 'windAngle'];
// What a state that names no air is taken to be in (the defaults makeStepper() itself falls back to).
const AIR_DEFAULTS = { tempC: 15, pressureHpa: 1013, humidityPct: 0, altitudeM: 0 };
const AIR_KEYS = Object.keys(AIR_DEFAULTS);

// The rifle is zeroed once, before the exercise, and the turret keeps that setting. Unless the caller says where the zero
// was set (`state.zeroConditions`), it is taken to have been set in the cartridge's zero atmosphere when it names one, else
// in the air the state carries NOW -- the exercise's starting conditions -- and stays there however the air changes afterwards. Every place that changes the shot's air away
// from the state's own (a group's `conditions`) calls this first, so the bore does not follow the change. A bare state,
// with nothing altered, is left alone: it is its own zero air, so the per-call zero solve is the same number.
// Wind and slope are never part of the zero: see withFixedBore.
export function pinZeroConditions(state) {
  if (state.zeroConditions) return state;
  // a cartridge that names its zero atmosphere (Arsenal; the donor's, for a cartridge zeroed with another) was zeroed in that
  // air: the fields it gives replace the state's own, as in the ordinary zero solve
  const zeroAtmosphere = (state.zeroDonorBallistics ? { ...state, ...state.zeroDonorBallistics } : state).zeroAtmosphere;
  const zeroConditions = {};
  for (const k of AIR_KEYS) zeroConditions[k] = (zeroAtmosphere && zeroAtmosphere[k]) ?? state[k] ?? AIR_DEFAULTS[k];
  return { ...state, zeroConditions };
}

export function withConditions(state, conditions) {
  if (!conditions) return state;
  const out = { ...pinZeroConditions(state) };
  for (const k of CONDITION_KEYS) if (conditions[k] != null) out[k] = conditions[k];
  return out;
}

// The rifle's zero is set once, in whatever air it was set in; the turret keeps that setting. `state.zeroConditions`
// (optional: any of the condition fields above, plus `losAngleDeg`, default 0 -- zeroed on the flat) says what that air
// was, and the come-up is then measured against the bore angle that zero implies, not against a zero re-solved in
// every shot's own air. Without it the zero is set in the state's own air (see pinZeroConditions). The zero is one bore
// angle for the whole exercise: it is set on the level and in calm air, so neither the shot's wind (called or fitted) nor
// its incline moves it, unless `zeroConditions` names a wind or a zero angle on purpose; the incline and the wind of a
// shot then show up in its come-up, where they belong. (A state with no wind, no incline and no zeroConditions is
// returned as it is, since its own zero already is the level, calm one.) An explicit `state.launchAngle` always wins.
// The zero is solved with the state's own muzzle velocity and drag, so a fitted v0Ms or dragPct moves the zero the way it
// would on the real rifle.
export function withFixedBore(state) {
  if (state.launchAngle !== undefined) return state;
  if (!state.zeroConditions) {
    if (!state.windSpeed && !state.losAngleDeg) return state;
    state = pinZeroConditions(state);
  }
  const zc = state.zeroConditions;
  const zeroState = { ...state, windSpeed: 0, windAngle: 90, losAngleDeg: zc.losAngleDeg ?? 0 };
  for (const k of CONDITION_KEYS) if (zc[k] != null) zeroState[k] = zc[k];
  delete zeroState.zeroConditions;
  // a cartridge zeroed with another one flies its own ballistics from the donor's zero angle (see resolveLaunchAngle)
  return { ...state, launchAngle: zeroAngleFor(state.zeroDonorBallistics ? { ...zeroState, ...state.zeroDonorBallistics } : zeroState) };
}

// The zero angle for a zero state (the state the rifle was zeroed in), solved once per distinct zero state. Many states
// share one zero: the wind-perturbed copy of a state, every inclined copy of it (the zero is level), and the same fitted
// values met again by another pattern fit. Same inputs, same solve, same number; bounded like the walks below.
const ZERO_LIMIT = 256;
const zeroAngles = new Map();
function zeroAngleFor(zeroState) {
  const key = walkerKey(zeroState);
  let angle = zeroAngles.get(key);
  if (angle === undefined) {
    if (zeroAngles.size >= ZERO_LIMIT) {
      let drop = ZERO_LIMIT >> 1;
      for (const k of zeroAngles.keys()) { zeroAngles.delete(k); if (--drop === 0) break; }
    }
    angle = solveZeroAngle(zeroState);
    zeroAngles.set(key, angle);
  }
  return angle;
}

// ---- One integrator walk per state ----
// The estimator asks for the come-up of the same state at many ranges (every target, the perturbed copies of it for the
// sensitivity columns, the range-error step), and each call used to fly a fresh trajectory from the muzzle, and re-solve
// the zero, for the one range asked. A state's walk is now kept (see makeImpactWalker) and extended only as far as the
// farthest range asked for, so every range is landed from the same points: the answers are bit for bit what the fresh
// calls gave. Keyed by the state's content, so any two calls with the same state share a walk however the state object
// was built; the bore angle (zero) is solved once with the walk. Bounded, oldest out first, because a fit makes new
// states (new fitted values) at every iteration and the old ones are never asked for again.
const WALKER_LIMIT = 128;
const walkers = new Map();
const objectIds = new WeakMap();
let nextObjectId = 1;
function walkerKey(state) {
  let key = '';
  for (const name in state) {
    const v = state[name];
    // arrays (the Cd table) by identity: a spread copy keeps them, and they are never edited in place. Small plain
    // objects (zeroConditions is rebuilt for every state) by content. A different array object with the same content
    // only costs a miss, never a wrong answer.
    if (v !== null && typeof v === 'object') {
      if (Array.isArray(v)) {
        let id = objectIds.get(v);
        if (id === undefined) { id = nextObjectId++; objectIds.set(v, id); }
        key += `${name}:#${id}|`;
      } else key += `${name}:${JSON.stringify(v)}|`;
    } else key += `${name}:${v}|`;
  }
  return key;
}
function impactAt(state, rangeM) {
  const key = walkerKey(state);
  let walker = walkers.get(key);
  if (walker === undefined) {
    if (walkers.size >= WALKER_LIMIT) {
      let drop = WALKER_LIMIT >> 1;
      for (const k of walkers.keys()) { walkers.delete(k); if (--drop === 0) break; }
    }
    let fixed = withFixedBore(state);
    // a state that needs no fixed bore (no wind, no incline, no zero conditions) is its own zero state: the same solve
    // computeImpact() would do, taken from the same cache (a donor cartridge's zero is left to the engine)
    if (fixed.launchAngle === undefined) {
      // (the air the cartridge's zero atmosphere names replaces the state's own for that solve, as in resolveLaunchAngle)
      const zeroAir = fixed.zeroAtmosphere;
      const zeroState = zeroAir ? { ...fixed, ...Object.fromEntries(AIR_KEYS.filter((k) => zeroAir[k] != null).map((k) => [k, zeroAir[k]])) } : fixed;
      fixed = { ...fixed, launchAngle: fixed.zeroDonorBallistics ? resolveLaunchAngle(fixed) : zeroAngleFor(zeroState) };
    }
    walker = makeImpactWalker(fixed);
    walkers.set(key, walker);
  }
  return walker.impactAt(rangeM);
}
export function clearWalkers() { walkers.clear(); zeroAngles.clear(); }

export const comeUpMrad = (state, rangeM) => -impactAt(state, rangeM).dropCm * 10 / rangeM;
// The sideways displacement at `rangeM` in mrad, with the engine's own sign (the same number Range Solver turns into
// windage clicks): wind, and spin drift when the state has it switched on.
export const windageMrad = (state, rangeM) => impactAt(state, rangeM).windageCm * 10 / rangeM;
// Mach against the speed of sound in the state's own air (15 C when it names none): the supersonic ceiling moves 25 to 55 m
// in the cold and the heat, so a fixed sea-level reference put it in the wrong place.
export const machAt = (state, rangeM) => computeImpact(state, rangeM).velocity / speedOfSound(state.tempC ?? 15);

// ---- Observation noise for one group ----

// `resolved`: whether the group's shots could actually be told apart
// (walked down, or camera/monitor quality) -- default false for a near
// target read only from the firing line. An unresolved group
// is one holistic reading, not an n-shot average: sigma does not depend
// on `shots` at all in that case.
export function sigmaForGroup({ shots, r50Mrad = null, resolved = true, unresolvedSigma = UNRESOLVED_SIGMA_MRAD }) {
  if (!resolved) return unresolvedSigma;
  const sdRifle = r50Mrad != null ? r50ToSD(r50Mrad) : 0;
  const perShot = Math.hypot(sdRifle, SIGMA_POI_MRAD);
  return Math.hypot(perShot / Math.sqrt(shots), SIGMA_ROUND_MRAD);
}

// ---- The far-target distance ----
// A small memo for the physics the Prepare screen asks for over and over -- the same state, the same distances --
// on every homework checkbox or field change. Keyed by the full contents of the state (not its identity), so a
// changed input can never return a stale number; bounded, and cleared when full. Only the planning-time entry
// points use it (the estimator's states change on every iteration and would never hit).
const MEMO_LIMIT = 512;
const memo = new Map();
function memoized(kind, state, extra, compute) {
  const key = `${kind}|${extra}|${JSON.stringify(state)}`;
  if (memo.has(key)) return memo.get(key);
  const value = compute();
  if (memo.size >= MEMO_LIMIT) memo.clear();
  memo.set(key, value);
  return value;
}
export function clearPlanningMemo() { memo.clear(); }

export function rangeAtMach(state, mach, { lo = 50, hi = 2000, iters = 50 } = {}) {
  return memoized('mach', state, `${mach}|${lo}|${hi}|${iters}`, () => {
    let a = lo; let b = hi;
    for (let i = 0; i < iters; i++) {
      const mid = (a + b) / 2;
      if (machAt(state, mid) > mach) a = mid; else b = mid;
    }
    return (a + b) / 2;
  });
}


// ---- linear algebra: Gauss-Jordan inverse + determinant (product of pivots) ----
// A plain Gauss-Jordan with partial pivoting -- no matrix library is
// needed at this size; determinant is needed for the blunder mixture's
// log-evidence comparison below.
export function inverse(A) {
  const n = A.length;
  const M = A.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    if (Math.abs(M[piv][c]) < 1e-14) throw new Error(`singular at column ${c}`);
    [M[c], M[piv]] = [M[piv], M[c]];
    const d = M[c][c];
    for (let j = 0; j < 2 * n; j++) M[c][j] /= d;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c];
      if (f === 0) continue;
      for (let j = 0; j < 2 * n; j++) M[r][j] -= f * M[c][j];
    }
  }
  return M.map((row) => row.slice(n));
}

export function logDeterminant(A) {
  const n = A.length;
  const M = A.map((row) => [...row]);
  let logDet = 0, sign = 1;
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    if (piv !== c) { [M[c], M[piv]] = [M[piv], M[c]]; sign = -sign; }
    const d = M[c][c];
    if (Math.abs(d) < 1e-300) return -Infinity;
    logDet += Math.log(Math.abs(d));
    sign *= Math.sign(d) || 1;
    for (let r = c + 1; r < n; r++) {
      const f = M[r][c] / d;
      if (f === 0) continue;
      for (let j = c; j < n; j++) M[r][j] -= f * M[c][j];
    }
  }
  return logDet; // sign ignored -- every matrix here is a covariance/precision, positive definite
}

export const matVec = (A, v) => A.map((row) => row.reduce((s, a, j) => s + a * v[j], 0));
export const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);

// ---- Applying a parameter vector to a state ----
// v0Ms and dragPct are folded into the physics (nonlinear -> re-linearise
// every Gauss-Newton iteration); windMs is folded in as an along-axis
// (windAngle 0) addition -- the along-axis component is the only one this
// estimator ever fits, a deliberate simplification (real crosswind vector
// composition is not needed for the estimator's core behaviour). zeroMrad
// and trackPct are NOT state fields; they are added post-hoc to the
// come-up in predictedComeUp() below.
export function applyParameters(state, theta = {}) {
  const out = { ...state };
  if (theta.v0Ms) out.muzzleVelocity = state.muzzleVelocity + theta.v0Ms;
  if (theta.dragPct) {
    // Folded through bcGainFactor, not a direct rescale of `bc` -- the
    // latter is a no-op for a Cd-table bullet (247 of 385 library
    // bullets), since computeImpact()/makeStepper() only ever reads `bc`
    // when there is no cdTable at all. Routing through the same factor
    // makeStepper() already divides kFactor by (engine/trajectory.js)
    // covers both profile types with one line and no branch here.
    // Compounds onto whatever gain the cartridge already carries, exactly
    // like committing a session's result to the cartridge record (see
    // truing-session/session-model.js's bcCorrectionOffer): a factor of
    // 1.05 applied twice ends at 1.05^2 / applied-again, never overwritten.
    out.bcGainFactor = (state.bcGainFactor ?? 1) / (1 + theta.dragPct / 100);
  }
  // windAngle forced to 0, matching sensitivityColumns's own windMs
  // column above -- theta.windMs is specifically the along-axis
  // (headwind/tailwind) component, not the full wind vector, and the
  // applied state used for residuals must stay linearised consistently
  // with the column used to fit it (the same class of bug fitSession()
  // below has to guard against for the chrono/rangeCheck rows).
  if (theta.windMs) Object.assign(out, alongAxisWind(state, theta.windMs));
  return out;
}

// The state's called wind with `deltaMs` added to its head/tail component only (positive = more headwind). With no
// wind, or a pure head/tail wind, this is the plain addition it always was; with a crosswind called for the shot, the
// crosswind is kept, where forcing the angle to zero would have turned it into a headwind.
export function alongAxisWind(state, deltaMs) {
  const speed = state.windSpeed || 0;
  const angle = state.windAngle ?? 90;
  if (speed === 0) return { windSpeed: deltaMs, windAngle: 0 };
  if (angle === 0) return { windSpeed: speed + deltaMs, windAngle: 0 };
  const rad = angle * Math.PI / 180;
  const head = speed * Math.cos(rad) + deltaMs;
  const cross = speed * Math.sin(rad);
  return { windSpeed: Math.hypot(head, cross), windAngle: Math.atan2(cross, head) * 180 / Math.PI };
}

// Predicted come-up at range R for a target with index `t` (or no per-target
// term at all when omitted), given the physics state (v0Ms/dragPct/windMs
// already folded in via applyParameters) and the post-hoc terms.
//
// `targetTheta.knownLosDeg`: a target's own *recorded* inclination (a
// real, nonzero `losAngleDeg` the user measured and entered), baked
// straight into the baseline physics because it is a known quantity, not
// a nuisance parameter -- distinct from `targetTheta.losU`, the free
// *residual* inclination the blunder mixture below estimates on top of a
// flat/unmeasured target. A target never carries both: the losU_t mixture
// is dropped entirely once the angle is measured and entered.
export function predictedComeUp(appliedState, rangeM, theta = {}, targetTheta = {}) {
  const baseState = targetTheta.knownLosDeg ? { ...appliedState, losAngleDeg: targetTheta.knownLosDeg } : appliedState;
  const rangeErr = targetTheta.rangeErrM || 0;
  const base = comeUpMrad(baseState, rangeM + rangeErr);
  const zero = theta.zeroMrad || 0;
  // The come-up at the believed range itself is needed only by the tracking term and the inclination term; it is the
  // very value already computed when the range error is zero, and is skipped when neither term is in play.
  let atBelieved = rangeErr === 0 ? base : null;
  const believed = () => (atBelieved ??= comeUpMrad(baseState, rangeM));
  const track = theta.trackPct ? theta.trackPct * 0.01 * believed() : 0;
  let losTerm = 0;
  if (targetTheta.losU) {
    const deg = (targetTheta.knownLosDeg || 0) + losDegFromU(targetTheta.losU);
    losTerm = comeUpMrad({ ...baseState, losAngleDeg: deg }, rangeM) - believed();
  }
  return base + zero + track + losTerm;
}

// ---- sensitivity columns (the Jacobian), evaluated at `state` ----
// `state` here is already the applied (theta-folded) state for the current
// linearisation point -- the caller (fitSession, or planSession's own
// theta=0 case) is responsible for that. `knownLosDeg` folds a target's own
// recorded inclination into the baseline the derivatives are taken at, same
// reasoning as predictedComeUp above.
export function sensitivityColumns(state, rangeM, knownLosDeg = 0) {
  const baseState = knownLosDeg ? { ...state, losAngleDeg: knownLosDeg } : state;
  const b = comeUpMrad(baseState, rangeM);
  return {
    zeroMrad: 1,
    v0Ms: comeUpMrad({ ...baseState, muzzleVelocity: baseState.muzzleVelocity + 1 }, rangeM) - b,
    // Perturbs bcGainFactor, not `bc` directly -- a direct `bc` rescale
    // is a no-op for a Cd-table
    // bullet (247 of 385 library bullets), since makeStepper() only reads
    // `bc` when there's no cdTable at all. Dividing bcGainFactor by 1.05
    // is exactly equivalent to dividing bc by 1.05 for a BC-profile
    // bullet (kFactor is a pure multiplicative composition of the two),
    // so this is a strict generalisation, not a behaviour change for the
    // bullets the old form did work for.
    dragPct: (comeUpMrad({ ...baseState, bcGainFactor: (baseState.bcGainFactor ?? 1) / 1.05 }, rangeM) - b) / 5,
    trackPct: 0.01 * b,
    // windAngle forced to 0 for the perturbation: windMs is specifically
    // the along-axis (headwind/tailwind) component, independent of
    // whatever crosswind the ambient state also carries. Confirmed against
    // a reference case with a pure crosswind ambient state (windAngle 90,
    // windSpeed 0): only forcing windAngle 0 here reproduces the expected
    // sensitivity at long range -- leaving the ambient angle in place
    // understates it by three orders of magnitude.
    windMs: (comeUpMrad({ ...baseState, ...alongAxisWind(baseState, 5) }, rangeM) - b) / 5
  };
}

// sensitivityColumns() for the planning screens: memoised (see above) and frozen, because the result is shared.
export function planningColumns(state, rangeM) {
  return memoized('cols', state, rangeM, () => Object.freeze(sensitivityColumns(state, rangeM)));
}

// Per-target blunder columns, for the mixture model further down.
export function rangeErrColumn(state, rangeM, step = 10) {
  const b = comeUpMrad(state, rangeM);
  return (comeUpMrad(state, rangeM + step) - b) / step;
}

// ---- The inclination term is parameterised in u = 1 - cos(delta), never
// in degrees ----
// An unrecorded inclination always makes the shooter dial LESS than the
// flat prediction, uphill and downhill alike, and the size of that
// reduction goes as (1 - cos delta) -- i.e. QUADRATIC in the angle near
// zero, not linear. That matters for more than accuracy: a linear-Gaussian
// fit needs a column, and d(come-up)/d(delta) at delta = 0 is exactly
// zero, so a term parameterised in degrees cannot get off the ground.
// Measured directly on a reference .308 case at 600 m, the local slope
// near the origin comes out at +4.1e-4, -2.8e-5 and -9.0e-4 mrad/deg for
// steps of 0.5, 1 and 2 degrees -- not even consistently SIGNED, because
// it is solver noise around a stationary point, against -1.7e-2 mrad/deg
// at delta = 10. No step size fixes that; the parameterisation has to
// change.
//
// In u the same effect is close to linear, which is the whole point:
// effect/u over the useful range runs -5.16 (10 deg) to -5.55 (30 deg), a
// 1.08x spread, where effect/delta runs -0.0009 (2 deg) to -0.0248
// (30 deg), a 28x spread. So the column below is well-conditioned,
// non-zero at the origin, and re-linearised at the current u each
// Gauss-Newton iteration to pick up the residual curvature.
//
// Angles are still what the USER sees: losDegFromU converts back at the
// reporting boundary. Everything inside the estimator is u.
export const losUFromDeg = (deg) => 1 - Math.cos(deg * Math.PI / 180);
export const losDegFromU = (u) => Math.acos(Math.max(-1, Math.min(1, 1 - Math.max(u, 0)))) * 180 / Math.PI;

// The mixture's two components, stated in u directly -- NOT by converting
// a "sigma = 2 deg / 8 deg" figure with losUFromDeg, which would be wrong.
// u is convex in delta, so a Gaussian in u is far more concentrated at
// small angles than a Gaussian in degrees with the "same" sigma: sigma_u =
// u(8 deg) makes a 15 deg slope a 3.5-sigma event, and a 20 deg slope a
// 6.2-sigma one, i.e. effectively impossible. Transplanting a degrees
// sigma into u is a change of DISTRIBUTION, not of units.
//
// Chosen instead so the component spans the slopes that actually go
// unrecorded: at u(20 deg), a 15 deg slope sits at 0.56 sigma, 20 deg at
// 1.0, and 30 deg at 2.2 -- unusual but not impossible, which is what a
// blunder component is for. The "flat" component stays genuinely tight,
// since its job is to say "there is no meaningful slope here".
export const SIGMA_LOS_FLAT_U = losUFromDeg(2);       // 0.000609
export const SIGMA_LOS_INCLINED_U = losUFromDeg(20);  // 0.060307

export function losUColumn(state, rangeM, currentU = 0, knownLosDeg = 0, refDeg = 10) {
  const stepU = losUFromDeg(refDeg);
  const atU = (u) => comeUpMrad({ ...state, losAngleDeg: (knownLosDeg || 0) + losDegFromU(u) }, rangeM);
  return (atU(Math.max(currentU, 0) + stepU) - atU(Math.max(currentU, 0))) / stepU;
}

// ---- The posterior (planning: no observations needed) ----
// `groups`: [{ rangeM, shots, r50Mrad?, resolved?, sigmaMrad?, knownLosDeg?, col? }]
// `priors`: { paramName: sigma }, over `params` (defaults to BASE_PARAMS)
export function posterior({ state, groups, priors, params = BASE_PARAMS }) {
  const p = params.length;
  const prec = Array.from({ length: p }, (_, i) => Array.from({ length: p }, (_, j) => (i === j ? 1 / priors[params[i]] ** 2 : 0)));
  for (const g of groups) {
    const sigma = g.sigmaMrad ?? sigmaForGroup(g);
    // `g.col`: this range's sensitivity columns, when the caller has already computed them (the planner tries thousands of
    // designs over the same few distances, and the columns depend on the distance alone, not on the shots fired there).
    const col = g.col || sensitivityColumns(state, g.rangeM, g.knownLosDeg || 0);
    for (let i = 0; i < p; i++) for (let j = 0; j < p; j++) prec[i][j] += col[params[i]] * col[params[j]] / (sigma * sigma);
  }
  const cov = inverse(prec);
  return { cov, sd: params.map((_, i) => Math.sqrt(cov[i][i])), params };
}

export function resolutionMatrix({ cov, priors, params = BASE_PARAMS }) {
  const p = params.length;
  const priorPrec = Array.from({ length: p }, (_, i) => Array.from({ length: p }, (_, j) => (i === j ? 1 / priors[params[i]] ** 2 : 0)));
  const R = Array.from({ length: p }, (_, i) => Array.from({ length: p }, (_, j) =>
    (i === j ? 1 : 0) - params.reduce((s, _, k) => s + cov[i][k] * priorPrec[k][j], 0)));
  const Rtilde = Array.from({ length: p }, (_, i) => Array.from({ length: p }, (_, j) =>
    R[i][j] * priors[params[j]] / priors[params[i]]));
  return { R, Rtilde };
}

// ---- Planner, grading, required distance, invalidity floor ----
export function grade(sdDragPct) {
  if (sdDragPct <= 2) return { letter: 'A', label: 'convincing: a real BC correction' };
  if (sdDragPct <= 3) return { letter: 'B', label: 'usable: a BC correction with a wide band' };
  if (sdDragPct <= 4) return { letter: 'C', label: 'weak: little more than the published BC' };
  return { letter: 'D', label: 'come-up correction only, no BC conclusion' };
}

// The planner's enumeration cap: the optimum never uses more than two
// targets, so a long candidate list only needs its nearest, its farthest,
// and the ten distances closest to the Mach 1.1 point.
export const PLAN_CANDIDATE_CAP = 12;
function capCandidates(usable, ceiling) {
  const sorted = [...new Set(usable)].sort((a, b) => a - b);
  if (sorted.length <= PLAN_CANDIDATE_CAP) return sorted;
  const keep = new Set([sorted[0], sorted[sorted.length - 1]]);
  const byCeiling = sorted.slice(1, -1).sort((a, b) => Math.abs(a - ceiling) - Math.abs(b - ceiling));
  for (const d of byCeiling) {
    if (keep.size >= PLAN_CANDIDATE_CAP) break;
    keep.add(d);
  }
  return [...keep].sort((a, b) => a - b);
}

export function correlationOf(cov, params, a, b) {
  const i = params.indexOf(a), j = params.indexOf(b);
  if (i < 0 || j < 0) return 0;
  return cov[i][j] / Math.sqrt(cov[i][i] * cov[j][j]);
}

// Every group of parameters linked by |posterior correlation| > threshold,
// as connected components -- a pair, or a larger set when the links chain.
// Singletons are not returned; degenerate causes are reported jointly,
// never as separate single-cause findings.
export function degenerateGroups(cov, params, threshold = DEGENERACY_R, include = params) {
  const keys = params.filter((k) => include.includes(k));
  const parent = Object.fromEntries(keys.map((k) => [k, k]));
  const find = (k) => (parent[k] === k ? k : (parent[k] = find(parent[k])));
  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      if (Math.abs(correlationOf(cov, params, keys[i], keys[j])) > threshold) parent[find(keys[i])] = find(keys[j]);
    }
  }
  const groups = {};
  for (const k of keys) (groups[find(k)] ||= []).push(k);
  return Object.values(groups).filter((g) => g.length > 1);
}

// `r50Mrad`: the session's one resolved rifle precision -- applied to
// every planned group, since it is a property of the rifle, not the
// target. `nearResolved`: whether the plan's nearest target is read shot
// by shot; false by default, since planning should assume the same
// conservative, unresolved near-target read that Shoot defaults to.
export function planSession({ state, availableDistances, roundBudget, priors, r50Mrad = null, nearResolved = false, minShotsPerTarget = 3, maxTargets = 3, params = BASE_PARAMS }) {
  const ceiling = rangeAtMach(state, SUPERSONIC_MACH);
  const usable = capCandidates(availableDistances.filter((d) => d <= ceiling), ceiling);
  const dragIdx = params.indexOf('dragPct');
  // The physics behind a design depends only on its distances; compute each distance's columns once, not once per allocation.
  const columns = new Map(usable.map((r) => [r, planningColumns(state, r)]));
  const groupsFor = (chosen, shots) => chosen.map((r, i) => ({ rangeM: r, shots: shots[i], r50Mrad, resolved: i === 0 ? nearResolved : true, col: columns.get(r) }));
  const exact = (chosen, shots) => {
    const groups = groupsFor(chosen, shots);
    const post = posterior({ state, groups, priors, params });
    return {
      ranges: [...chosen], shots: [...shots], dragSd: post.sd[dragIdx], sd: post.sd, cov: post.cov, params,
      zeroDragCorr: Math.abs(correlationOf(post.cov, params, 'zeroMrad', 'dragPct'))
    };
  };

  // Ranking every design by the drag scale's posterior variance needs only one entry of the inverse. With the prior
  // precision diagonal (P) and a design's groups adding rank-one terms w_g u_g u_g', the matrix-inversion lemma gives
  //   var(drag) = P^-1[drag][drag] - d' (diag(sigma_g^2) + G)^-1 d,   G[g][h] = u_g' P^-1 u_h,   d[g] = P^-1[drag][drag] u_g[drag]
  // a system of size (number of groups, at most 3) instead of a 5x5 inversion per design; G and d are computed once per
  // candidate pair. It is used only to rank: every design within rounding of the best is then re-evaluated with the exact
  // posterior() in enumeration order, so the chosen design and every reported number are those the exact search gives.
  const n = usable.length;
  const prior2 = params.map((k) => priors[k] ** 2);
  const u = usable.map((r) => params.map((k) => columns.get(r)[k]));
  const G = usable.map((_, a) => usable.map((__, b) => u[a].reduce((sum, ua, i) => sum + prior2[i] * ua * u[b][i], 0)));
  const dvec = u.map((ua) => prior2[dragIdx] * ua[dragIdx]);
  const sigma2Near = [];
  const sigma2 = [];
  for (let sh = 0; sh <= roundBudget; sh++) {
    const sn = sh >= 1 ? sigmaForGroup({ shots: sh, r50Mrad, resolved: nearResolved }) : 0;
    const so = sh >= 1 ? sigmaForGroup({ shots: sh, r50Mrad, resolved: true }) : 0;
    sigma2Near.push(sn * sn); sigma2.push(so * so);
  }
  const REL_TOL = 1e-9;
  let vMin = Infinity;
  let near = [];
  const idxs = new Array(maxTargets);
  const shotsNow = new Array(maxTargets);
  const variance = (k) => {
    const M = (g, h) => G[idxs[g]][idxs[h]] + (g === h ? (g === 0 ? sigma2Near[shotsNow[0]] : sigma2[shotsNow[g]]) : 0);
    const d0 = dvec[idxs[0]];
    let q;
    if (k === 1) q = d0 * d0 / M(0, 0);
    else {
      const d1 = dvec[idxs[1]];
      if (k === 2) {
        const m00 = M(0, 0), m01 = M(0, 1), m11 = M(1, 1);
        q = (m11 * d0 * d0 - 2 * m01 * d0 * d1 + m00 * d1 * d1) / (m00 * m11 - m01 * m01);
      } else {
        const d2 = dvec[idxs[2]];
        const m00 = M(0, 0), m01 = M(0, 1), m02 = M(0, 2), m11 = M(1, 1), m12 = M(1, 2), m22 = M(2, 2);
        const c00 = m11 * m22 - m12 * m12, c01 = m02 * m12 - m01 * m22, c02 = m01 * m12 - m02 * m11;
        const c11 = m00 * m22 - m02 * m02, c12 = m01 * m02 - m00 * m12, c22 = m00 * m11 - m01 * m01;
        const det = m00 * c00 + m01 * c01 + m02 * c02;
        q = (c00 * d0 * d0 + c11 * d1 * d1 + c22 * d2 * d2 + 2 * (c01 * d0 * d1 + c02 * d0 * d2 + c12 * d1 * d2)) / det;
      }
    }
    return prior2[dragIdx] - q;
  };
  const chosenNow = new Array(maxTargets);
  const record = (k) => {
    const v = variance(k);
    if (v < vMin * (1 + REL_TOL)) {
      near.push({ ranges: chosenNow.slice(0, k), shots: shotsNow.slice(0, k), v });
      if (v < vMin) { vMin = v; near = near.filter((c) => c.v <= vMin * (1 + REL_TOL)); }
    }
  };
  const allocate = (k, idx, remaining) => {
    if (idx === k - 1) {
      if (remaining < minShotsPerTarget) return;
      shotsNow[idx] = remaining;
      record(k);
      return;
    }
    for (let sh = minShotsPerTarget; sh <= remaining - minShotsPerTarget * (k - idx - 1); sh++) {
      shotsNow[idx] = sh;
      allocate(k, idx + 1, remaining - sh);
    }
  };
  const pick = (start, depth) => {
    if (depth >= 1) allocate(depth, 0, roundBudget);
    if (depth === maxTargets) return;
    for (let i = start; i < n; i++) { idxs[depth] = i; chosenNow[depth] = usable[i]; pick(i + 1, depth + 1); }
  };
  if (dragIdx < 0 || n === 0) return null;
  pick(0, 0);
  let best = null;
  for (const c of near) {
    const e = exact(c.ranges, c.shots);
    if (!best || e.dragSd < best.dragSd) best = e;
  }
  return best;
}

// The posterior of an explicit plan -- `ranges` ascending, `shots` per
// range -- built the same way planSession() builds its candidates, so
// every "what if" comparison the Prepare screen prices is directly
// comparable with the plan itself.
export function planPosterior({ state, ranges, shots, priors, r50Mrad = null, nearResolved = false, params = BASE_PARAMS }) {
  const groups = ranges.map((r, i) => ({ rangeM: r, shots: shots[i], r50Mrad, resolved: i === 0 ? nearResolved : true, col: planningColumns(state, r) }));
  const post = posterior({ state, groups, priors, params });
  return {
    ...post,
    dragSd: post.sd[params.indexOf('dragPct')],
    zeroDragCorr: Math.abs(correlationOf(post.cov, params, 'zeroMrad', 'dragPct'))
  };
}

// ---- The whole-session planner ----
// planSession() chooses up to three distances and their shots for the drag scale's posterior spread, and leaves everything the
// session does besides -- the ladder's intermediate rungs, the shots at them -- uncounted. This planner plans every distance the
// session visits, with the round budget as the TOTAL. A design is a set of TARGET distances (one to `maxTargets`); the ladder's
// safety rungs that reaching them needs are found by walking the ladder itself (nextLadderRange, with the posterior after each
// group), and every distance visited, targets and rungs alike, gets its own shots (at least `minShots`) so that the shots add up to
// the budget exactly. The shots and the distances are chosen to minimise the relative posterior variance of zero, muzzle velocity and
// drag together, the drag term weighted `criterionWeight` times: the causes are told apart (a zero error is not read as a BC error),
// and with checked homework, whose tight priors make the zero and the velocity cheap, the drag scale is what the plan is for.
// The nearest distance is the glance-read near group: its reading is a glance, so its shots sharpen nothing and it gets the minimum.
//
// For a design of at most three groups the criterion has a closed form: with the prior precision diagonal, minimising the weighted
// sum of relative variances is maximising tr(M^-1 D), M = G + diag(sigma_g^2), G[g][h] = sum_i q_i u_g[i] u_h[i] over every
// parameter (q_i the prior variance), D[g][h] = sum over zero, velocity, drag of w_i q_i u_g[i] u_h[i] -- a system of size three,
// not a 5x5 inversion per allocation, and every allocation of the shots is enumerated. Designs with rungs (more than three groups)
// are allocated greedily then by swaps. Only the winner gets the exact posterior.
export const CAUSES_WEIGHT_UNCHECKED = 1;
export const CAUSES_WEIGHT_CHECKED = 4;
// The tested weights: 1 when nothing is checked, 4 when the zero, the click value and the muzzle velocity are.
export function causesWeightFor(homework) {
  return homework && homework.zeroVerified && homework.trackTested && homework.mvAverageChecked ? CAUSES_WEIGHT_CHECKED : CAUSES_WEIGHT_UNCHECKED;
}

export function planWholeSession({
  state, availableDistances, roundBudget, priors, r50Mrad = null, nearResolved = false, params = BASE_PARAMS, criterionWeight = 1, maxTargets = 3,
  minShots = 1, backdropMarginM = DEFAULT_BACKDROP_MARGIN_M, confidenceZ = DEFAULT_LADDER_CONFIDENCE_Z, maxJumpFactor = DEFAULT_LADDER_MAX_JUMP_FACTOR, walkShots = 2
}) {
  const key = JSON.stringify([availableDistances, roundBudget, priors, r50Mrad, nearResolved, params, criterionWeight, maxTargets, minShots, backdropMarginM, confidenceZ, maxJumpFactor, walkShots]);
  const plan = memoized('whole', state, key, () => computeWholeSession({ state, availableDistances, roundBudget, priors, r50Mrad, nearResolved, params, criterionWeight, maxTargets, minShots, backdropMarginM, confidenceZ, maxJumpFactor, walkShots }));
  return plan && JSON.parse(JSON.stringify(plan)); // the memo's own copy is never handed out
}

function computeWholeSession({ state, availableDistances, roundBudget, priors, r50Mrad, nearResolved, params, criterionWeight, maxTargets, minShots, backdropMarginM, confidenceZ, maxJumpFactor, walkShots }) {
  const ceiling = rangeAtMach(state, SUPERSONIC_MACH);
  const usable = capCandidates(availableDistances.filter((d) => d <= ceiling), ceiling);
  const zeroI = params.indexOf('zeroMrad'), v0I = params.indexOf('v0Ms'), dragI = params.indexOf('dragPct');
  if (dragI < 0 || usable.length === 0) return null;
  const columns = new Map(usable.map((r) => [r, planningColumns(state, r)]));
  const u = new Map(usable.map((r) => [r, params.map((k) => columns.get(r)[k])]));
  const q = params.map((k) => priors[k] ** 2);
  const wTerm = params.map((_, i) => (i === dragI ? criterionWeight : (i === zeroI || i === v0I ? 1 : 0)));
  const sigma2Near = [], sigma2 = [];
  for (let sh = 0; sh <= roundBudget; sh++) {
    const sn = sh >= 1 ? sigmaForGroup({ shots: sh, r50Mrad, resolved: nearResolved }) : 0;
    const so = sh >= 1 ? sigmaForGroup({ shots: sh, r50Mrad, resolved: true }) : 0;
    sigma2Near.push(sn * sn); sigma2.push(so * so);
  }
  const groupsFor = (ranges, shots) => ranges.map((r, i) => ({ rangeM: r, shots: shots[i], r50Mrad, resolved: i === 0 ? nearResolved : true, col: columns.get(r) }));
  // the rungs a set of target distances needs: the ladder walked with `walkShots` shots at every group so far
  const walk = (targets) => {
    const visited = []; let farthest = null;
    for (const t of targets) {
      for (let guard = 0; guard < usable.length + 2; guard++) {
        const cov = posterior({ state, groups: groupsFor(visited, visited.map(() => walkShots)), priors, params }).cov;
        const base = { state, theta: {}, cov, params, triedRanges: visited, farthestValidatedM: farthest, backdropMarginM, confidenceZ, maxJumpFactor, beyondCap: true };
        if (nextLadderRange({ ...base, candidateRanges: [t] }) === t) { visited.push(t); farthest = Math.max(farthest ?? 0, t); break; }
        const ins = nextLadderRange({ ...base, candidateRanges: usable.filter((r) => r < t && !visited.includes(r)) });
        if (ins == null) return null;
        visited.push(ins); farthest = Math.max(farthest ?? 0, ins);
      }
    }
    return visited.sort((a, b) => a - b);
  };
  // M and D for a design (the shots enter only through M's diagonal)
  const matrices = (ranges) => {
    const k = ranges.length;
    const G = Array.from({ length: k }, () => new Array(k)), D = Array.from({ length: k }, () => new Array(k));
    for (let a = 0; a < k; a++) for (let b = a; b < k; b++) {
      let g = 0, d = 0;
      const ua = u.get(ranges[a]), ub = u.get(ranges[b]);
      for (let i = 0; i < params.length; i++) { const t = q[i] * ua[i] * ub[i]; g += t; d += wTerm[i] * t; }
      G[a][b] = G[b][a] = g; D[a][b] = D[b][a] = d;
    }
    return { G, D };
  };
  // tr(M^-1 D) for M = G + diag(sigma^2): explicit for one to three groups, Gauss-Jordan beyond
  const traceOf = (G, D, shots) => {
    const k = shots.length;
    const s = (g) => (g === 0 ? sigma2Near[shots[0]] : sigma2[shots[g]]);
    if (k === 1) return D[0][0] / (G[0][0] + s(0));
    if (k === 2) {
      const m00 = G[0][0] + s(0), m01 = G[0][1], m11 = G[1][1] + s(1);
      return (m11 * D[0][0] - 2 * m01 * D[0][1] + m00 * D[1][1]) / (m00 * m11 - m01 * m01);
    }
    if (k === 3) {
      const m00 = G[0][0] + s(0), m01 = G[0][1], m02 = G[0][2], m11 = G[1][1] + s(1), m12 = G[1][2], m22 = G[2][2] + s(2);
      const c00 = m11 * m22 - m12 * m12, c01 = m02 * m12 - m01 * m22, c02 = m01 * m12 - m02 * m11;
      const c11 = m00 * m22 - m02 * m02, c12 = m01 * m02 - m00 * m12, c22 = m00 * m11 - m01 * m01;
      const det = m00 * c00 + m01 * c01 + m02 * c02;
      return (c00 * D[0][0] + c11 * D[1][1] + c22 * D[2][2] + 2 * (c01 * D[0][1] + c02 * D[0][2] + c12 * D[1][2])) / det;
    }
    const A = Array.from({ length: k }, (_, i) => [...G[i].map((x, j) => (i === j ? x + s(i) : x)), ...Array.from({ length: k }, (__, j) => (i === j ? 1 : 0))]);
    for (let c = 0; c < k; c++) {
      let piv = c; for (let r = c + 1; r < k; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
      [A[c], A[piv]] = [A[piv], A[c]];
      const d = A[c][c];
      for (let j = 0; j < 2 * k; j++) A[c][j] /= d;
      for (let r = 0; r < k; r++) if (r !== c) { const f = A[r][c]; if (f) for (let j = 0; j < 2 * k; j++) A[r][j] -= f * A[c][j]; }
    }
    let tr = 0;
    for (let a = 0; a < k; a++) for (let b = 0; b < k; b++) tr += A[a][k + b] * D[b][a];
    return tr;
  };
  let best = null;
  const consider = (targets) => {
    const ranges = walk(targets);
    if (!ranges) return;
    const k = ranges.length;
    const min = ranges.map(() => minShots);
    if (k * minShots > roundBudget) return;
    const { G, D } = matrices(ranges);
    const shots = new Array(k);
    let value = -Infinity, chosen = null;
    if (k <= 3) {
      const allocate = (idx, remaining) => {
        if (idx === k - 1) {
          if (remaining < minShots) return;
          shots[idx] = remaining;
          const v = traceOf(G, D, shots);
          if (v > value * (1 + 1e-12) || chosen === null) { value = v; chosen = shots.slice(); }
          return;
        }
        for (let sh = minShots; sh <= remaining - minShots * (k - idx - 1); sh++) { shots[idx] = sh; allocate(idx + 1, remaining - sh); }
      };
      allocate(0, roundBudget);
    } else {
      chosen = min.slice();
      for (let left = roundBudget - k * minShots; left > 0; left--) {
        let bi = 0, bv = -Infinity;
        for (let i = 0; i < k; i++) { chosen[i]++; const v = traceOf(G, D, chosen); chosen[i]--; if (v > bv) { bv = v; bi = i; } }
        chosen[bi]++;
      }
      value = traceOf(G, D, chosen);
      for (let pass = 0; pass < 20; pass++) {
        let improved = false;
        for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) {
          if (i === j || chosen[i] <= minShots) continue;
          chosen[i]--; chosen[j]++;
          const v = traceOf(G, D, chosen);
          if (v > value * (1 + 1e-12)) { value = v; improved = true; } else { chosen[i]++; chosen[j]--; }
        }
        if (!improved) break;
      }
    }
    if (chosen && (!best || value > best.value * (1 + 1e-12))) best = { ranges, shots: chosen, targets: [...targets], value };
  };
  const pickTargets = (start, chosen) => {
    if (chosen.length >= 1) consider(chosen);
    if (chosen.length === maxTargets) return;
    for (let i = start; i < usable.length; i++) { chosen.push(usable[i]); pickTargets(i + 1, chosen); chosen.pop(); }
  };
  pickTargets(0, []);
  if (!best) return null;
  const post = posterior({ state, groups: groupsFor(best.ranges, best.shots), priors, params });
  return {
    ranges: best.ranges, shots: best.shots, targets: best.targets, dragSd: post.sd[dragI], sd: post.sd, cov: post.cov, params,
    zeroDragCorr: Math.abs(correlationOf(post.cov, params, 'zeroMrad', 'dragPct'))
  };
}

export function requiredFarDistance({ state, priors, nearM, nearShots, nearOpts = {}, farShots, targetSdPct, r50Mrad = null, step = 5 }) {
  const ceiling = rangeAtMach(state, SUPERSONIC_MACH);
  const nearCol = planningColumns(state, nearM);
  for (let far = 200; far <= ceiling; far += step) {
    const groups = [{ rangeM: nearM, shots: nearShots, r50Mrad, ...nearOpts, col: nearCol }, { rangeM: far, shots: farShots, r50Mrad, col: planningColumns(state, far) }];
    if (posterior({ state, groups, priors }).sd[BASE_PARAMS.indexOf('dragPct')] <= targetSdPct) return far;
  }
  return null;
}

export function invalidityFloor({ state, priors, nearM, nearShots, nearOpts = {}, targetSdPct = 4, r50Mrad = null, step = 5 }) {
  const ceiling = rangeAtMach(state, SUPERSONIC_MACH);
  const nearCol = planningColumns(state, nearM);
  for (let far = 200; far <= ceiling; far += step) {
    const groups = [{ rangeM: nearM, shots: nearShots, r50Mrad, ...nearOpts, col: nearCol }, { rangeM: far, sigmaMrad: SIGMA_ROUND_MRAD, col: planningColumns(state, far) }];
    if (posterior({ state, groups, priors }).sd[BASE_PARAMS.indexOf('dragPct')] <= targetSdPct) return far;
  }
  return null;
}

// ---- Sequencing shots as a ladder: near-to-far, one safe step at a
// time, gated by whether the impact will even land on the backdrop ----
// A plan says WHICH ranges and how many rounds; it says nothing about
// ORDER. Shooting the farthest planned target first (or at all) before
// any data exists risks a shot landing off the visible backdrop entirely
// if the assumed BC/drag-model is wrong enough -- not a precision
// problem, an "I can't see where it hit" problem, unresolvable by more
// rounds because there is no data point to average. The fix is the same
// posterior machinery already used everywhere else (the Jacobian columns
// above, propagated through the CURRENT covariance instead of collapsed
// into a single sd[] entry), used here to bound how far it is safe to
// jump next.
export const DEFAULT_BACKDROP_MARGIN_M = 2;   // "2 m each way" -- a conservative, unmeasured default
export const DEFAULT_LADDER_CONFIDENCE_Z = 2;
export const TIGHTENED_LADDER_CONFIDENCE_Z = 3; // adopted for the rest of the session after one missed-impact report

// Predictive SD, in mrad, of come-up at `rangeM` under the CURRENT posterior
// (`cov` from `posterior()` with no groups yet -- see below -- or from
// `fitSession`'s own cov once real observations exist), propagated through
// the same sensitivity columns as every other algorithm in this file.
// What to dial for the NEXT shot: the elevation (come-up, mrad, positive up) and windage (mrad, the engine's own sign, the
// number Range Solver shows as windage clicks) for a target at `rangeM`, in the air and wind of that shot (`conditions`),
// with the current best fit (`theta`, from an analysis) folded in: the fitted muzzle velocity, drag scale, zero offset and
// tracking correction. The uncertainties are the elevation's own predictive SD from the fit's covariance, and the
// windage's SD from how well the crosswind is known (`crosswindSigmaMs`: 0 = taken as called). Windage is a prediction only:
// the estimator is vertical-only and learns nothing from where impacts land sideways. Spin drift is included only when the
// state has it switched on.
export function nextShotDope({ state, conditions = null, theta = {}, cov = null, params = BASE_PARAMS, rangeM, knownLosDeg = 0, crosswindSigmaMs = 0 }) {
  const shot = withConditions(state, conditions);
  const applied = applyParameters(shot, theta);
  const losState = knownLosDeg ? { ...applied, losAngleDeg: knownLosDeg } : applied;
  const impact = computeImpact(withFixedBore(losState), rangeM);
  const elevationMrad = predictedComeUp(applied, rangeM, theta, { knownLosDeg });
  const windage = impact.windageCm * 10 / rangeM;
  // d(windage)/d(crosswind): one metre per second more crosswind from the right (the engine's 90 degree convention),
  // on top of whatever wind was called
  const crossState = { ...losState, ...crosswindAdded(losState, 1) };
  const windageSensitivity = windageMrad(crossState, rangeM) - windage;
  return {
    rangeM, elevationMrad, windageMrad: windage,
    elevationSdMrad: cov ? predictiveComeUpSd({ state: shot, theta, cov, params, rangeM, knownLosDeg }) : null,
    windageSdMrad: Math.abs(windageSensitivity) * crosswindSigmaMs,
    velocityMs: impact.velocity, timeOfFlightS: impact.tof
  };
}
// The called wind with `deltaMs` more crosswind (from the right) added, keeping its head/tail component.
function crosswindAdded(state, deltaMs) {
  const speed = state.windSpeed || 0;
  const rad = (state.windAngle ?? 90) * Math.PI / 180;
  const head = speed * Math.cos(rad);
  const cross = speed * Math.sin(rad) + deltaMs;
  return { windSpeed: Math.hypot(head, cross), windAngle: Math.atan2(cross, head) * 180 / Math.PI };
}

export function predictiveComeUpSd({ state, theta = {}, cov, params = BASE_PARAMS, rangeM, knownLosDeg = 0 }) {
  const applied = applyParameters(state, theta);
  // with no fitted values to fold in and no recorded incline, the columns depend on the state and the range alone: the planning
  // screens ask for them over and over (the ladder walk, the whole-session planner), so they come from the memo
  const cols = !knownLosDeg && !Object.keys(theta).length ? planningColumns(state, rangeM) : sensitivityColumns(applied, rangeM, knownLosDeg);
  const col = params.map((k) => cols[k] || 0);
  return Math.sqrt(dot(col, matVec(cov, col)));
}

export const missMetres = (comeUpSdMrad, rangeM) => comeUpSdMrad * rangeM / 1000;

// A step may go at most this many times the farthest distance a group has actually landed at. 2 stalled every session on
// the 100/300/600 and 100/300/600/900 layouts after its first group (a 3 times gap); 3 removes those stalls and 4 leaves room for
// a 4 times gap. A step past the cap is still possible when nothing nearer is left (see BEYOND_CAP_CONFIDENCE_Z).
export const DEFAULT_LADDER_MAX_JUMP_FACTOR = 4;
// When no untried distance lies within the cap, the nearest one beyond it is proposed if its predicted miss, at this many
// sigma, still lands on the backdrop (never less than the ladder's own confidence, which a missed impact tightens to 3).
// The predicted spread describes the miss of the fit's own dope; measured on the campaign's rungs its 99th percentile is
// about 3 sigma outside a deliberately wrong drag model.
export const BEYOND_CAP_CONFIDENCE_Z = 3;

// The farthest of `candidateRanges` (ascending) not yet in `triedRanges`
// whose predicted impact, at `confidenceZ` sigma, still lands within
// `backdropMarginM` of the point of aim -- or null if even the nearest
// untried candidate already isn't safe (should not happen in practice: the
// near target's own sensitivity to every free parameter but zeroMrad is
// close to zero -- more near-target rounds mainly sharpen the zero
// estimate, not the drag scale -- and zeroMrad itself is rarely off by
// metres). Assumes the predicted miss grows monotonically with range for
// this call's own theta/cov (true of every column here: each parameter's
// sensitivity compounds with distance) and stops at the first range that
// breaks the margin, rather than searching past it -- a real but harmless
// simplification given how few candidate ranges a session ever has.
//
// **The covariance forecast alone is not enough to gate the very first
// jump.** It is built from `sensitivityColumns`, which are themselves
// computed from the ASSUMED model -- so it can only ever measure how
// uncertain the parameters are WITHIN that model, never whether the
// model's own shape is right, which is exactly the thing nothing has
// tested yet before any real data exists. Confirmed directly: with only
// the entry-gate priors and zero shots fired, this forecast approved an
// 800 m jump on a G1-assumed/G7-true mismatch at 2-sigma (predicted <=
// 1.59 m) that the true physics missed a 2 m backdrop by 3.70 m. The fix
// is a second, independent gate that owes nothing to the assumed model at
// all: `farthestValidatedM` (the farthest range an actual group has
// already landed on the backdrop at, or `null` before the first one) caps
// any jump at `maxJumpFactor` times itself, and before that first real
// group exists there is no forecast-driven jump at all -- the very next
// candidate range, full stop, exactly the "short-range shots, then
// closer/intermediate targets" progression this mechanism exists to
// guarantee. The two gates combine as the more conservative of the two,
// so a well-behaved (correctly-modelled) session still gets to skip
// rungs quickly once real data justifies it, while a mismatched one is
// caught by the doubling cap even where the forecast alone would have
// been fooled.
// `missedRanges`: ranges where an impact could not be seen. Nothing at or
// beyond the nearest of them is proposed again -- a miss is direct evidence
// the assumed model is wrong out there, and neither gate above can see that.
export function nextLadderRange({ state, theta = {}, cov, params = BASE_PARAMS, candidateRanges, triedRanges = [], missedRanges = [], retryRanges = [], farthestValidatedM = null, maxJumpFactor = DEFAULT_LADDER_MAX_JUMP_FACTOR, backdropMarginM = DEFAULT_BACKDROP_MARGIN_M, confidenceZ = DEFAULT_LADDER_CONFIDENCE_Z, beyondCap = true, destinationM = null, plannedRanges = null, stepFactor = null }) {
  const missCeiling = missedRanges.length ? Math.min(...missedRanges) : Infinity;
  let remaining = [...candidateRanges].filter((r) => (!triedRanges.includes(r) || retryRanges.includes(r)) && r < missCeiling).sort((a, b) => a - b);
  // `destinationM` (the plan's far target): the ladder exists to reach it safely and never goes past it. Once a group has landed
  // there, only the planned distances still unshot are left: the intermediate rungs were there to make the far shot safe, and
  // shooting the unplanned ones nearer than it afterwards is a round spent on nothing.
  if (destinationM != null) {
    remaining = remaining.filter((r) => r <= destinationM);
    const done = triedRanges.includes(destinationM) && !missedRanges.includes(destinationM) && !retryRanges.includes(destinationM);
    if (done && plannedRanges) remaining = remaining.filter((r) => plannedRanges.includes(r));
  }
  if (remaining.length === 0) return null;
  if (farthestValidatedM == null) return remaining[0]; // no real data yet: always the nearest ground available, never a forecast-driven jump
  const jumpCeiling = farthestValidatedM * maxJumpFactor;
  const missAt = (r, z) => z * missMetres(predictiveComeUpSd({ state, theta, cov, params, rangeM: r }), r);
  const safeList = [];
  for (const r of remaining) {
    if (r > jumpCeiling) break;
    if (missAt(r, confidenceZ) > backdropMarginM) break;
    safeList.push(r);
  }
  // Default: the farthest safe distance. With `stepFactor`, the safe distance nearest to that multiple of the farthest distance
  // shot (the last safe one when none reaches it): a finer ladder for a smaller factor.
  let safe = safeList.length ? safeList[safeList.length - 1] : null;
  if (stepFactor && safeList.length) safe = safeList.find((r) => r >= farthestValidatedM * stepFactor) ?? safe;
  // Nothing nearer is left: rather than stall, take the nearest distance beyond the cap when the fit says it is safe.
  if (safe === null && beyondCap && remaining[0] > jumpCeiling && missAt(remaining[0], Math.max(confidenceZ, BEYOND_CAP_CONFIDENCE_Z)) <= backdropMarginM) return remaining[0];
  return safe;
}

// The very first rung, before any group has landed, is the nearest ground the range offers, whatever its distance -- and
// nothing above tests it. This is the test: the predicted miss there under the prior spread (`cov` from `posterior()`
// with no groups), at `confidenceZ` sigma (3 by default: with no data at all the spread is the least trusted), against the backdrop margin. `safe: false` means the first shot may leave the
// backdrop, and with nothing validated there is nothing to retreat to: the user should be offered a nearer distance (the
// zero range is the natural one), or go on knowingly. Null when no distance is left.
export function ladderStartCheck({ state, cov, params = BASE_PARAMS, candidateRanges, triedRanges = [], backdropMarginM = DEFAULT_BACKDROP_MARGIN_M, confidenceZ = BEYOND_CAP_CONFIDENCE_Z }) {
  const first = [...candidateRanges].filter((r) => !triedRanges.includes(r)).sort((a, b) => a - b)[0];
  if (first == null) return null;
  const predMissM = missMetres(predictiveComeUpSd({ state, theta: {}, cov, params, rangeM: first }), first);
  return { rangeM: first, predMissM, marginNeededM: confidenceZ * predMissM, safe: confidenceZ * predMissM <= backdropMarginM };
}

// "I can't see the impact" is not a failed reading to discard silently --
// there is no come-up residual to record (nothing to average), and it is
// itself harder evidence than the covariance forecast above: that forecast
// only accounts for the assumed model's own parameter uncertainty, never
// for the assumed model being the wrong SHAPE entirely (dragPct above only
// ever rescales the assumed curve, never reshapes it) -- so a
// missed impact can happen at a range `nextLadderRange` called safe. The
// response is to retreat to the midpoint between the last range that WAS
// seen and the one that just failed, not to retry the same range or guess
// an arbitrary smaller step, and to tighten the margin's own confidence for
// the rest of the session -- one such event is real, not theoretical, risk.
export function retreatAfterMissedImpact({ lastSeenRangeM, failedRangeM }) {
  return Math.round((lastSeenRangeM + failedRangeM) / 2);
}

// The retreat midpoint snapped to the nearest actually-available,
// not-yet-tried ground strictly between the last range that was seen and
// the one that just failed -- or null when there is none, in which case
// the ladder simply carries on from what has already been validated.
export function snapRetreat({ lastSeenRangeM, failedRangeM, availableRanges, triedRanges = [] }) {
  const mid = retreatAfterMissedImpact({ lastSeenRangeM, failedRangeM });
  const options = availableRanges.filter((r) => r > lastSeenRangeM && r < failedRangeM && !triedRanges.includes(r));
  if (options.length === 0) return null;
  return options.reduce((best, r) => (Math.abs(r - mid) < Math.abs(best - mid) ? r : best));
}

// ---- Session bookkeeping for the ladder (the live panel and the study harness both call these) ----
// A missed impact is counted, never reshot at once, the ladder's confidence is tightened, and the ladder retreats to real
// ground between the last validated range and this one (`snapRetreat`), or to nothing when there is none. Nothing at or
// beyond a missed range is proposed while it stays in `missedRanges`.
export function registerMissedImpact(session, rangeM, availableRanges) {
  session.missedImpactCount = (session.missedImpactCount || 0) + 1;
  session.retryRanges = (session.retryRanges || []).filter((r) => r !== rangeM);
  session.missedRanges = [...(session.missedRanges || []), rangeM];
  if (!session.triedRanges.includes(rangeM)) session.triedRanges.push(rangeM);
  session.confidenceZ = TIGHTENED_LADDER_CONFIDENCE_Z;
  const retreat = session.farthestValidatedM != null
    ? snapRetreat({ lastSeenRangeM: session.farthestValidatedM, failedRangeM: rangeM, availableRanges, triedRanges: session.triedRanges })
    : null;
  session.retreatTo = retreat;
  return retreat;
}

// A group has landed at `rangeM`. It becomes the farthest validated range if it is, and clears any retreat. With `retry`
// (off by default), every distance that missed once is now released for one more try: the miss was with the number dialed
// before the fit had seen this group, and the fit has now been corrected. A distance that misses a second time stays
// banned for the session. It only helps when the shooter dials the fit's own elevation for the retry; dialing the app's own
// dope again gives the same miss (measured: no session that missed recovered without it, 82% did with it), so the live
// panel keeps it off until the next-shot elevation from the fit is shown.
export function registerRecordedGroup(session, rangeM, { retry = false } = {}) {
  if (!session.triedRanges.includes(rangeM)) session.triedRanges.push(rangeM);
  session.farthestValidatedM = session.farthestValidatedM == null ? rangeM : Math.max(session.farthestValidatedM, rangeM);
  session.retreatTo = null;
  session.retryRanges = (session.retryRanges || []).filter((r) => r !== rangeM);
  if (!retry) return;
  const retried = session.retriedMisses || (session.retriedMisses = []);
  const release = (session.missedRanges || []).filter((r) => !retried.includes(r));
  if (!release.length) return;
  session.missedRanges = session.missedRanges.filter((r) => !release.includes(r));
  session.retryRanges = [...new Set([...session.retryRanges, ...release])];
  retried.push(...release);
}

// The rungs the ladder is expected to take on its way to `destinationM`
// if every step lands -- the basis for the walk-out allowance the
// Prepare screen states separately from the planned session. Uses the
// prior-only covariance, so it is what the ladder will propose before any
// data narrows it; a real session can only move faster, never slower,
// unless an impact is missed.
export function planLadderWalk({ state, cov, params = BASE_PARAMS, candidateRanges, destinationM, backdropMarginM = DEFAULT_BACKDROP_MARGIN_M, confidenceZ = DEFAULT_LADDER_CONFIDENCE_Z, maxJumpFactor = DEFAULT_LADDER_MAX_JUMP_FACTOR, beyondCap = true }) {
  const candidates = candidateRanges.filter((r) => r <= destinationM);
  const rungs = [];
  let farthest = null;
  for (let guard = 0; guard < candidates.length + 1; guard++) {
    const next = nextLadderRange({ state, cov, params, candidateRanges: candidates, triedRanges: rungs, farthestValidatedM: farthest, backdropMarginM, confidenceZ, maxJumpFactor, beyondCap });
    if (next == null) break;
    rungs.push(next);
    farthest = farthest == null ? next : Math.max(farthest, next);
    if (next >= destinationM) break;
  }
  return { rungs, reachesDestination: rungs.includes(destinationM) };
}

// ---- The estimator (Gauss-Newton, to handle the mild physics
// nonlinearity a single linearisation at zero would miss) ----
// `observations`: [{ rangeM, observedComeUp, shots, r50Mrad?, resolved?, sigmaMrad?, targetIndex? }]
// Per-target terms (rangeErrM_t/losU_t) are opt-in per observation via
// `includeRangeErr`/`includeLosDeg` -- when included, they get their own
// theta entries named `rangeErrM_<targetIndex>`/`losU_<targetIndex>`.
//
// One other observation shape: `{ kind: 'chrono', sigmaMs,
// residualMs }` is a direct reading of v0Ms itself (a chronographed
// mean velocity minus the state's own resolved nominal), not a come-up
// residual at some rangeM -- it has no target, no rangeM, and its column
// is 1 on v0Ms and 0 on everything else. This is what lets a chronograph
// narrow v0Ms live, shot by shot, through the ordinary Bayesian update,
// rather than as the discrete prior-swap shortcut the planner alone uses.
// Its own residual must be re-linearised against the CURRENT theta.v0Ms
// each iteration (`o.residualMs - theta.v0Ms`), exactly like every come-up
// row's `observed - predictedComeUp(applied, ...theta...)` below --
// an earlier version used the raw, theta-independent `o.residualMs` on
// every iteration, which never "saw" v0Ms already moving away from 0 and
// kept adding the SAME full pull again each Gauss-Newton pass; with a
// large chronograph residual (a real case: two sessions of the same rifle
// shot ~20 degrees apart in temperature) this ran away to several times
// the correct value well before the iteration cap, while a small residual
// (most earlier scenarios) never accumulated enough drift to be obviously
// wrong. `laplaceLogEvidence` above already did this subtraction
// correctly; only this loop had the stale form.
export function fitSession({ state, observations, priors, params = BASE_PARAMS, maxIter = 5, tol = 0.01, start = null }) {
  const p = params.length;
  // One linearisation of the whole model at `theta`: the information matrix A, the right-hand side b, and the
  // sum of squared standardised residuals and log-variances that the evidence calculation needs.
  const linearize = (theta) => {
    const appliedBase = applyParameters(state, theta);
    const A = Array.from({ length: p }, (_, i) => Array.from({ length: p }, (_, j) => (i === j ? 1 / priors[params[i]] ** 2 : 0)));
    const b = params.map((k) => -theta[k] / priors[k] ** 2);
    let sse = 0; let logS = 0;
    for (const o of observations) {
      if (o.kind === 'chrono') {
        const sigma = o.sigmaMs;
        const resid = o.residualMs - theta.v0Ms; // re-linearised against the CURRENT theta, same as every come-up row's own predicted-vs-observed residual below -- see the fix note above fitSession
        const col = params.map((k) => (k === 'v0Ms' ? 1 : 0));
        for (let i = 0; i < p; i++) {
          b[i] += col[i] * resid / (sigma * sigma);
          for (let j = 0; j < p; j++) A[i][j] += col[i] * col[j] / (sigma * sigma);
        }
        sse += (resid * resid) / (sigma * sigma); logS += 2 * Math.log(sigma);
        continue;
      }
      if (o.kind === 'rangeCheck') {
        const sigma = o.sigmaM;
        const key = `rangeErrM_${o.targetIndex}`;
        const resid = o.residualM - (theta[key] || 0); // same re-linearisation as the chrono row above
        const col = params.map((k) => (k === key ? 1 : 0));
        for (let i = 0; i < p; i++) {
          b[i] += col[i] * resid / (sigma * sigma);
          for (let j = 0; j < p; j++) A[i][j] += col[i] * col[j] / (sigma * sigma);
        }
        sse += (resid * resid) / (sigma * sigma); logS += 2 * Math.log(sigma);
        continue;
      }
      const sigma = o.sigmaMrad ?? sigmaForGroup(o);
      const targetTheta = {
        rangeErrM: o.targetIndex != null ? (theta[`rangeErrM_${o.targetIndex}`] || 0) : 0,
        losU: o.targetIndex != null ? (theta[`losU_${o.targetIndex}`] || 0) : 0,
        knownLosDeg: o.knownLosDeg || 0
      };
      // A group shot in its own air and wind is predicted, and its columns taken, in that air and wind.
      const applied = o.conditions ? applyParameters(withConditions(state, o.conditions), theta) : appliedBase;
      const pred = predictedComeUp(applied, o.rangeM, theta, targetTheta);
      const resid = o.observedComeUp - pred;
      // The shared parameters' columns come from one call per observation (it used to be one call per parameter).
      const base = sensitivityColumns(applied, o.rangeM, o.knownLosDeg || 0);
      const col = params.map((k) => {
        if (k.startsWith('rangeErrM_')) return k === `rangeErrM_${o.targetIndex}` ? rangeErrColumn(applied, o.rangeM) : 0;
        if (k.startsWith('losU_')) return k === `losU_${o.targetIndex}` ? losUColumn(applied, o.rangeM, theta[k] || 0, o.knownLosDeg || 0) : 0;
        return base[k];
      });
      for (let i = 0; i < p; i++) {
        b[i] += col[i] * resid / (sigma * sigma);
        for (let j = 0; j < p; j++) A[i][j] += col[i] * col[j] / (sigma * sigma);
      }
      sse += (resid * resid) / (sigma * sigma); logS += 2 * Math.log(sigma);
    }
    return { A, b, sse, logS };
  };
  const solve = (initial, iterLimit = maxIter) => {
    const theta = { ...initial };
    let converged = false;
    for (let iter = 0; iter < iterLimit; iter++) {
      const { A, b } = linearize(theta);
      const delta = matVec(inverse(A), b);
      let maxRel = 0;
      for (let i = 0; i < p; i++) {
        theta[params[i]] += delta[i];
        maxRel = Math.max(maxRel, Math.abs(delta[i]) / priors[params[i]]);
      }
      if (maxRel < tol) { converged = true; break; }
    }
    return { theta, converged };
  };
  const zeros = Object.fromEntries(params.map((k) => [k, 0]));
  // A warm start (a nearby solution from an earlier analysis of almost the same data) usually converges in one step.
  // If it does not, fall back to the cold start, so the answer never depends on how good the guess was.
  // A warm start earns its keep only if it converges quickly, so it is given two iterations, not five: measured over full
  // sessions, a failed attempt costs more than the cold start it was meant to save.
  let solved = start ? solve(Object.fromEntries(params.map((k) => [k, Number.isFinite(start[k]) ? start[k] : 0])), Math.min(2, maxIter)) : null;
  if (!solved || !solved.converged) solved = solve(zeros);
  const { theta, converged } = solved;
  // The covariance and the evidence are taken from one last linearisation AT the solution, so they do not depend on
  // where the iteration started or stopped.
  const lin = linearize(theta);
  const cov = inverse(lin.A);
  // That linearisation also holds one more Newton step, at no extra cost. The iteration stops when a step is under
  // `tol` of the prior, which for a well-determined parameter can be a sizeable fraction of its SD; applying the last
  // step makes the reported solution accurate to well below that, whether the start was cold or warm.
  const polish = matVec(cov, lin.b);
  // The objective (residuals plus prior penalty) at the polished solution follows from the same linearisation, to
  // second order: f(theta + step) = f(theta) - step'b when step = A^-1 b. That is the quantity the evidence needs.
  const penaltyBefore = params.reduce((sum, k) => sum + (theta[k] ** 2) / (priors[k] ** 2), 0);
  const chi2 = lin.sse + penaltyBefore - polish.reduce((sum, d, i) => sum + d * lin.b[i], 0);
  params.forEach((k, i) => { theta[k] += polish[i]; });
  return { theta, cov, sd: Object.fromEntries(params.map((k, i) => [k, Math.sqrt(cov[i][i])])), params, converged, lin: { A: lin.A, chi2, logS: lin.logS } };
}

// Builds one `kind: 'chrono'` row (see fitSession above) from a session's
// raw per-shot velocity readings: nulls (a missed reading) are filtered
// out before either n or the mean is taken -- "a unit that misses a shot
// is not a special case, it is one fewer reading." `mvSD` is always the
// resolved, on-file figure (Arsenal, preset, or this session's own
// live override from the F-test below) -- never recomputed from
// `velocitiesMs` itself, which is too few shots to estimate a spread from
// reliably. Returns null when nothing was actually captured (an absent
// chronograph, or one that caught none of the shots) -- the caller simply
// omits the row. `mvSdSampleSize`: how many shots established `mvSD` -- the
// row's sigma is v0MsCheckedSigma's Student's-t-inflated SD/sqrt(n), so a
// spread resting on a small original sample is trusted correspondingly
// less.
export function chronoObservation({ state, velocitiesMs, mvSD, mvSdSampleSize = null }) {
  const valid = velocitiesMs.filter((v) => v != null && Number.isFinite(v));
  const n = valid.length;
  if (n === 0) return null;
  const mean = valid.reduce((s, v) => s + v, 0) / n;
  const assumedV0 = resolveMuzzleVelocity(state);
  return { kind: 'chrono', sigmaMs: v0MsCheckedSigma({ mvSD, nToday: n, mvSdSampleSize }), residualMs: mean - assumedV0, n, mean, assumedV0 };
}

// Sample SD (N - 1) of the captured readings, for the F-test below.
export function sampleSD(values) {
  const valid = values.filter((v) => v != null && Number.isFinite(v));
  const n = valid.length;
  if (n < 2) return null;
  const mean = valid.reduce((s, v) => s + v, 0) / n;
  return Math.sqrt(valid.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1));
}

// The v0Ms uncertainty a PLANNED session ends up with (before any shot
// exists): the session's own v0 prior combined with `nShots` chronographed
// readings of the checked sigma below -- exactly what fitSession() will do
// with the real chrono row once those shots exist, so a Prepare-screen
// forecast and the eventual fit agree on what a chronograph is worth.
export function plannedV0Sigma({ priorSigma, chronographed, mvSD, nShots, mvSdSampleSize = null }) {
  if (!chronographed || !mvSD || !nShots) return priorSigma;
  const rowSigma = v0MsCheckedSigma({ mvSD, nToday: nShots, mvSdSampleSize });
  return 1 / Math.sqrt(1 / priorSigma ** 2 + 1 / rowSigma ** 2);
}

// A live, in-session re-check of one target's distance via a second
// independent laser reading -- directly informs that target's own
// rangeErrM_t, wherever it is active (both the "fine" and "blunder"
// patterns for a target already carry one, per jointBlunderCheck/
// blunderPatternForTarget, differing only in prior sigma), the same way a
// chronograph reading directly informs v0Ms above. Modeled with the SAME
// instrument-precision sigma as the mixture's own "fine" component
// (0.002*R/2) by default -- a second reading with the same laser is NOT
// the "two genuinely independent methods" case that drops the mixture
// outright (several reads of the same instrument on the same,
// consistently misidentified object still agree with each other and still
// pass the check), but it is real, informative evidence for or against
// that target's own rangeErrM_t, on top of whatever the ballistic
// residuals alone imply -- and unlike more rounds, it costs a few seconds
// with equipment already in hand.
export function rangeCheckObservation({ targetIndex, believedRangeM, newReadingM, sigmaM = 0.002 * believedRangeM / 2 }) {
  return { kind: 'rangeCheck', targetIndex, sigmaM, residualM: newReadingM - believedRangeM };
}

// The other half of the in-session re-check, and the one that actually
// breaks the tie. A second DISTANCE reading cannot separate "this target
// is mis-ranged" from "this target is on a slope" -- those two are
// exactly degenerate for a single group (at 700 m a 20 degree slope and a
// -25.1 m range error shift the come-up identically), so a laser that
// confirms the distance leaves the ambiguity entirely intact. Measuring
// the ANGLE collapses it: the inclination stops being a free parameter
// and becomes a known quantity folded into that target's own baseline,
// and whatever residual survives must be range error.
//
// Unlike a distance re-read this is NOT an extra observation row with its
// own sigma -- the losU_t term is dropped outright once the angle is
// measured and entered, rather than treating the measurement as noisy
// evidence about it. So this rewrites the target's existing rows instead:
// `knownLosDeg`
// carries the measured angle into the physics, and `losMeasured` records
// that the measurement happened at all, which is what lets a measured
// FLAT (0 degrees) withdraw the term too.
export function applyAngleCheck(observations, targetIndex, measuredDeg) {
  return observations.map((o) => (o.targetIndex === targetIndex && o.rangeM != null
    ? { ...o, knownLosDeg: measuredDeg, losMeasured: true }
    : o));
}

// "This range is flat -- no line-of-sight angle anywhere beyond 5 degrees",
// applied to every target at once. Mechanically identical to the user
// having measured 0 at each of them: the inclination term is withdrawn
// everywhere and never competes for a residual again.
//
// The 5 degree threshold is not arbitrary. At the far end of a reference
// .308 case (870 m) a 5 degree slope moves the come-up by 0.0297 mrad --
// 30% of MATERIALITY_MRAD and about a fifth of the single-shot noise
// floor. Nothing at or under it is worth a parameter.
//
// This is a DECLARATION, not a measurement, and the difference matters:
// it collapses the mis-ranged/inclined degeneracy above by assertion. If
// the assertion is wrong, a real slope is reported as a confident range
// error instead -- measured directly on a case where a genuine 25 degree
// slope, declared away as flat, gets reported as a 30 m range error at
// over 90% confidence. It is still the right default for the ranges most
// people shoot on; it just has to be the user's own statement, and stated
// plainly enough that they know what they are turning off.
export function applyFlatRangeDeclaration(observations) {
  return observations.map((o) => (o.rangeM != null ? { ...o, knownLosDeg: 0, losMeasured: true } : o));
}

// Reconstructs the same {rangeErrM, losU, knownLosDeg} per-observation
// target terms fitSession's own inner loop uses, from a converged theta.
// Works unconditionally for any observation/params combination: a
// per-target key that isn't part of the active `params` for this fit
// simply isn't in `theta`, so it resolves to 0 exactly as if it had never
// been offered, with no separate "is this the target under test" check.
function targetThetaAt(theta, o) {
  return {
    rangeErrM: o.targetIndex != null ? (theta[`rangeErrM_${o.targetIndex}`] || 0) : 0,
    losU: o.targetIndex != null ? (theta[`losU_${o.targetIndex}`] || 0) : 0,
    knownLosDeg: o.knownLosDeg || 0
  };
}

// Laplace-approximated log evidence for a converged fit, around its own
// MAP estimate theta* (the model is nonlinear -- Gauss-Newton
// re-linearises every iteration -- so the textbook closed-form
// linear-Gaussian evidence, which needs one FIXED linearisation at
// theta=0, does not apply as-is; this is its curved equivalent):
//   log p(y) ~= log p(y|theta*) + log p(theta*) + 0.5*p*log(2pi) - 0.5*log|A|
// which collapses to the SSE-plus-prior-penalty form below. An earlier
// version of this lived duplicated inside blunderPatternForTarget, reused
// the flat-model b'A^-1b shortcut instead (plus had a sign error on
// log|P|), and, in combination, systematically overstated the "blunder"
// pattern's evidence for any real, non-blunder cause -- confirmed by
// re-running it against a clean, no-blunder-injected session, where it
// should favour "fine" and instead favoured "blunder" at ~90% every time.
// Shared here by every "which prior variant does the data actually
// support" comparison (the per-target blunder mixture, and dragPct's own
// published/barrel mixture below), so there is exactly one place this
// formula is written, not one copy per use.
export function laplaceLogEvidence({ state, observations, fit, priors, params }) {
  // A fit made by fitSession() already carries its linearisation at the solution: the residual-plus-prior objective
  // there, the log-variances and the information matrix -- exactly what is recomputed below for a fit that does not.
  if (fit.lin) {
    const logDetP = params.reduce((sum, k) => sum + Math.log(1 / priors[k] ** 2), 0);
    return -0.5 * (fit.lin.chi2 + logDeterminant(fit.lin.A) - logDetP + fit.lin.logS + observations.length * Math.log(2 * Math.PI));
  }
  const appliedBase = applyParameters(state, fit.theta);
  const appliedFor = (o) => (o.conditions ? applyParameters(withConditions(state, o.conditions), fit.theta) : appliedBase);
  let sse = 0, logS = 0;
  const n = observations.length;
  for (const o of observations) {
    if (o.kind === 'chrono') {
      const sigma = o.sigmaMs;
      const r = o.residualMs - fit.theta.v0Ms;
      sse += (r * r) / (sigma * sigma);
      logS += 2 * Math.log(sigma);
      continue;
    }
    if (o.kind === 'rangeCheck') {
      const sigma = o.sigmaM;
      const r = o.residualM - (fit.theta[`rangeErrM_${o.targetIndex}`] || 0);
      sse += (r * r) / (sigma * sigma);
      logS += 2 * Math.log(sigma);
      continue;
    }
    const sigma = o.sigmaMrad ?? sigmaForGroup(o);
    const applied = appliedFor(o);
    const pred = predictedComeUp(applied, o.rangeM, fit.theta, targetThetaAt(fit.theta, o));
    const r = o.observedComeUp - pred;
    sse += (r * r) / (sigma * sigma);
    logS += 2 * Math.log(sigma);
  }
  const thetaPriorPenalty = params.reduce((s, k) => s + (fit.theta[k] ** 2) / (priors[k] ** 2), 0);
  const p = params.length;
  const A = Array.from({ length: p }, (_, ii) => Array.from({ length: p }, (_, jj) => (ii === jj ? 1 / priors[params[ii]] ** 2 : 0)));
  for (const o of observations) {
    if (o.kind === 'chrono') {
      const sigma = o.sigmaMs;
      const col = params.map((k) => (k === 'v0Ms' ? 1 : 0));
      for (let ii = 0; ii < p; ii++) for (let jj = 0; jj < p; jj++) A[ii][jj] += col[ii] * col[jj] / (sigma * sigma);
      continue;
    }
    if (o.kind === 'rangeCheck') {
      const sigma = o.sigmaM;
      const key = `rangeErrM_${o.targetIndex}`;
      const col = params.map((k) => (k === key ? 1 : 0));
      for (let ii = 0; ii < p; ii++) for (let jj = 0; jj < p; jj++) A[ii][jj] += col[ii] * col[jj] / (sigma * sigma);
      continue;
    }
    const sigma = o.sigmaMrad ?? sigmaForGroup(o);
    const applied = appliedFor(o);
    const base = sensitivityColumns(applied, o.rangeM, o.knownLosDeg || 0);
    const col = params.map((k) => {
      if (k.startsWith('rangeErrM_')) return k === `rangeErrM_${o.targetIndex}` ? rangeErrColumn(applied, o.rangeM) : 0;
      if (k.startsWith('losU_')) return k === `losU_${o.targetIndex}` ? losUColumn(applied, o.rangeM, fit.theta[k] || 0, o.knownLosDeg || 0) : 0;
      return base[k];
    });
    for (let ii = 0; ii < p; ii++) for (let jj = 0; jj < p; jj++) A[ii][jj] += col[ii] * col[jj] / (sigma * sigma);
  }
  const logDetA = logDeterminant(A);
  const logDetP = params.reduce((s, k) => s + Math.log(1 / priors[k] ** 2), 0); // log|P| = sum(log(priorPrec))
  return -0.5 * (sse + thetaPriorPenalty + logDetA - logDetP + logS + n * Math.log(2 * Math.PI));
}

// Combines a set of {fit, logZ, weight} results into posterior mixture
// weights via the usual softmax-with-log-prior-weight, shared by both
// mixture consumers below.
// A zero-weight result (an outright-rejected hypothesis, e.g. the
// one-sided losU constraint in fitSessionMixture) contributes
// log(0) = -Infinity, so exp(...) = 0 and it simply drops out -- no
// special case needed, as long as `maxLogZ` itself isn't -Infinity, which
// only happens if EVERY hypothesis was rejected. That can't arise from the
// losU rule alone (the all-"fine" combination carries no losU term to
// reject), but guard rather than return NaN if it ever does.
function mixturePosteriorWeights(results) {
  const scores = results.map((r) => r.logZ + Math.log(r.weight));
  const maxLogZ = Math.max(...scores);
  if (!Number.isFinite(maxLogZ)) return results.map(() => 1 / results.length);
  const denom = scores.reduce((s, v) => s + Math.exp(v - maxLogZ), 0);
  return scores.map((v) => Math.exp(v - maxLogZ) / denom);
}

// ---- Warm starts across analyses ----
// A live analysis after group n+1 is the analysis after group n plus one observation, so the earlier solution of each
// pattern fit is an excellent starting point for the new one. `warmIn` is what the previous analysis handed back
// (`warm` on its result); it is used only when it was made for the same state, priors and parameters, and every fit
// that starts from it and fails to converge is redone from scratch (see fitSession), so a stale or poor guess can cost
// time but never changes the answer beyond solver tolerance. Pure values in and out; nothing is kept between calls.
function warmContext(warmIn, fingerprint) {
  const usable = warmIn && warmIn.fingerprint === fingerprint ? warmIn : null;
  const out = { fingerprint, byKey: {}, base: null };
  return {
    out,
    start: (key) => (usable ? usable.byKey[key] : null) || null,
    keep: (key, theta) => { out.byKey[key] = theta; }
  };
}

// ---- Blunder terms for one target, by 2-pattern enumeration ----
// Simplified to a single per-target range-error blunder; the "fine"/
// "blunder" prior pair matches the default weights below, or the
// re-checked pair if `rechecked` is set.
export function blunderPatternForTarget({ state, observations, priors, targetIndex, rechecked = false, params = BASE_PARAMS, warm = null }) {
  const fineSigma = (rangeM) => 0.002 * rangeM / 2;
  const blunderSigma = 20;
  const weights = rechecked ? [0.98, 0.02] : [0.9, 0.1];
  const target = observations.find((o) => o.targetIndex === targetIndex && o.rangeM != null);
  const results = [fineSigma(target.rangeM), blunderSigma].map((sigmaChoice, i) => {
    const p = [...params, `rangeErrM_${targetIndex}`];
    const priorsWithTerm = { ...priors, [`rangeErrM_${targetIndex}`]: sigmaChoice };
    const key = `screen:${targetIndex}:${i}`;
    const fit = fitSession({ state, observations, priors: priorsWithTerm, params: p, start: warm ? warm.start(key) : null });
    if (warm) warm.keep(key, fit.theta);
    const logZ = laplaceLogEvidence({ state, observations, fit, priors: priorsWithTerm, params: p });
    return { pattern: i === 0 ? 'fine' : 'blunder', logZ, weight: weights[i], fit };
  });
  return { results, posteriorWeights: mixturePosteriorWeights(results) };
}

// Collapses a set of {fit, logZ, weight} results into one Gaussian's
// mean/covariance over a shared `params` prefix, via the standard
// mixture-of-Gaussians combination (law of total variance). Each result's
// own fit may cover MORE parameters than `params` (a per-target
// rangeErrM_t nuisance term tacked on for a "blunder" pattern, say), as
// long as `params` is a prefix of that fit's own parameter list -- true
// of every caller here, since every extra per-target term is always
// appended after the shared base params, never inserted before them.
function combineMixture(results, params) {
  const posteriorWeights = mixturePosteriorWeights(results);
  const p = params.length;
  const mean = params.map((_, k) => results.reduce((s, r, i) => s + posteriorWeights[i] * r.fit.theta[params[k]], 0));
  const cov = Array.from({ length: p }, (_, ii) => Array.from({ length: p }, (_, jj) =>
    results.reduce((s, r, i) => {
      const di = r.fit.theta[params[ii]] - mean[ii];
      const dj = r.fit.theta[params[jj]] - mean[jj];
      return s + posteriorWeights[i] * (r.fit.cov[ii][jj] + di * dj);
    }, 0)));
  return {
    results, posteriorWeights,
    theta: Object.fromEntries(params.map((k, i) => [k, mean[i]])),
    cov,
    sd: Object.fromEntries(params.map((k, i) => [k, Math.sqrt(cov[i][i])])),
    params
  };
}

// ---- General multi-axis mixture fit ----
// Generalizes both blunderPatternForTarget (above) and the single-axis
// dragPct mixture (below) to any number of simultaneous "which hypothesis
// is true here" axes, run together rather than one at a time. Each axis
// is either:
//   { kind: 'param', key, sigmas, weights, labels? }   -- an already-active
//     parameter's own prior sigma is swapped between alternatives (e.g.
//     dragPct's narrow/wide components)
//   { kind: 'target', targetIndex, sigmas, weights, labels? } -- a
//     per-target nuisance term (rangeErrM_<targetIndex>) is conditionally
//     added, at one of the given sigmas (e.g. a target's own fine/blunder
//     choice)
// Enumerates the full cross-product of axis choices (independent prior
// weights, so a combination's weight is the product), fits and evaluates
// evidence for each, and collapses to one reported mean/covariance over
// the shared base `params` via combineMixture above. This matters because
// checking axes one at a time and reporting them separately -- as an
// earlier version of this engine did, before this function existed --
// lets an unmodelled blunder on one target leak into
// every other parameter's reported value even after that target has been
// correctly flagged: the flag alone does not fix the number.
// No cap on `axes.length` in this general function itself -- deliberately:
// this enumerates 2^(number of axes), exact rather than approximated, and
// it is each caller's own choice how many axes to offer. `jointBlunderCheck`
// below, the one caller that turns "how many targets" directly into "how
// many axes," imposes its own policy cap (`JOINT_BLUNDER_SHORTLIST`) for
// exactly this reason -- this function stays a general, uncapped primitive.
export function fitSessionMixture({ state, observations, priors, params = BASE_PARAMS, axes = [], warm = null, maxNonBaseline = Infinity }) {
  const combosOf = (n) => {
    if (n === 0) return [[]];
    const rest = combosOf(n - 1);
    const out = [];
    const arity = axes[n - 1].choices ? axes[n - 1].choices.length : axes[n - 1].sigmas.length;
    for (let i = 0; i < arity; i++) for (const sc of rest) out.push([...sc, i]);
    return out;
  };
  // Only target axes count (choice 0 is 'fine'); a cap drops the combinations with more simultaneous 'wrong' targets than that.
  const nonBaseline = (choices) => choices.reduce((n, c, ai) => n + (axes[ai].kind === 'target' && c !== 0 ? 1 : 0), 0);
  const results = combosOf(axes.length).filter((choiceIndices) => nonBaseline(choiceIndices) <= maxNonBaseline).map((choiceIndices) => {
    let p = [...params];
    const priorsCombo = { ...priors };
    let weight = 1;
    const labelParts = [];
    axes.forEach((axis, ai) => {
      const i = choiceIndices[ai];
      weight *= axis.weights[i];
      labelParts.push(axis.choices ? axis.choices[i].label : (axis.labels ? axis.labels[i] : `${axis.key ?? `target${axis.targetIndex}`}=${i}`));
      if (axis.kind === 'param') {
        priorsCombo[axis.key] = axis.sigmas[i];
      } else if (axis.choices) {
        // A target axis may be N-ary rather than binary, each choice
        // activating its own set of per-target terms at its own sigma.
        // This is what lets one target offer "fine / mis-ranged /
        // inclined" as three competing explanations instead of two
        // independent binary axes -- see jointBlunderCheck for why that
        // distinction matters both for honesty and for cost.
        for (const { suffix, sigma } of axis.choices[i].terms) {
          const key = `${suffix}_${axis.targetIndex}`;
          p = [...p, key];
          priorsCombo[key] = sigma;
        }
      } else {
        const key = `rangeErrM_${axis.targetIndex}`;
        p = [...p, key];
        priorsCombo[key] = axis.sigmas[i];
      }
    });
    // A pattern is identified by what each axis chose (a target by its index), not by its position, so it can be
    // recognised again after another target has been added or the set of resolved targets has changed.
    const warmKey = `mix:${axes.map((axis, ai) => `${axis.kind === 'param' ? axis.key : axis.targetIndex}=${axis.choices ? axis.choices[choiceIndices[ai]].label : choiceIndices[ai]}`).join('|')}`;
    const fit = fitSession({ state, observations, priors: priorsCombo, params: p, start: warm ? warm.start(warmKey) : null });
    if (warm) warm.keep(warmKey, fit.theta);
    const logZ = laplaceLogEvidence({ state, observations, fit, priors: priorsCombo, params: p });
    // The inclination's one-sided constraint, enforced as a rejection rather than a
    // post-hoc sign check: an inclination can only ever REDUCE the come-up,
    // both uphill and downhill, so u = 1 - cos(delta) is non-negative by
    // construction. A hypothesis whose fitted u comes back negative is
    // asking for an inclination that makes the shooter dial MORE, which no
    // real slope does -- it is not a small-probability explanation, it is
    // an impossible one, so it gets zero prior weight rather than a
    // downweighted share of the posterior.
    const impossible = p.some((k) => k.startsWith('losU_') && (fit.theta[k] || 0) < 0);
    return { label: labelParts.join(' + '), choiceIndices, fit, logZ, weight: impossible ? 0 : weight };
  });
  const combined = combineMixture(results, params);
  if (warm) warm.out.base = combined.theta;
  return combined;
}

// Marginal P(that axis's LAST choice, e.g. "blunder") summed over every
// combined hypothesis in a fitSessionMixture() result -- reads off
// `choiceIndices` directly rather than parsing the human-readable label.
export function marginalAxisWeight(mixtureResult, axisPosition, choiceIndex = 1) {
  return mixtureResult.results.reduce((s, r, ci) =>
    s + (r.choiceIndices[axisPosition] === choiceIndex ? mixtureResult.posteriorWeights[ci] : 0), 0);
}

// ---- Every re-checked target's fine/blunder status, decided JOINTLY,
// not one target at a time ----
// blunderPatternForTarget above tests one target holding every other
// target fixed at "fine" -- cheap, and enough to validate the mechanism,
// but it has a real failure mode: two targets close enough in range to
// share nearly the same sensitivity to a large SHARED cause (an
// uncorrected temperature-sensitivity coefficient, say) can each make the
// OTHER look like a blunder too, purely because checking either one alone
// forces the other's share of a real, shared residual back onto it. The
// fix is not more data -- it's letting every target's status be decided
// together, so a shared cause can be credited to whichever shared
// parameter (v0Ms, dragPct, ...) actually explains it, leaving only
// genuinely local residuals to compete for each target's own blunder
// flag. Confirmed directly on a case built for exactly this failure mode:
// one-at-a-time gives 99.5%/98.6% blunder for the real culprit and its
// innocent 5 m-away neighbour alike; the joint version gives 99.5%/13.7%
// -- same final theta, a much more honest flag.
//
// **Screen, then resolve: the exact enumeration never runs on more than
// `JOINT_BLUNDER_SHORTLIST` (4) targets.** 2^k is exact but genuinely
// exponential -- measured on this engine, ~2.2x per added axis: k=4 is
// 0.24 s, k=6 is 1.2 s, k=8 is 9.4 s, and a 12-target dense-range case
// had to be killed after 120+ seconds.
// 9.4 s is already unusable for a check the live Shoot panel wants
// re-run after every recorded group. So for k above the shortlist:
//
//   1. SCREEN every target with the cheap one-at-a-time check
//      (`blunderPatternForTarget`, linear in k, ~7 ms each).
//   2. RESOLVE the top `shortlist` of them, by screened probability, with
//      the full exact joint enumeration.
//   3. Report the exact marginal for those; report the screened value for
//      the rest, which are by construction all below the shortlist's own
//      lowest member and so are exactly the targets whose number matters
//      least.
//
// This is sound in the direction that matters: one-at-a-time's failure
// mode is over-flagging an innocent neighbour, not missing a real culprit
// (the shared residual it mis-assigns has to land on SOME target, and the
// genuinely-wrong one keeps its own share either way), so screening
// over-includes rather than under-includes. Verified on both a
// ladder-shaped session (7 groups, 100-700 m) and the adversarial case
// the joint check exists for (a large shared v0Ms error pinned by a
// chronograph, with close target pairs at 600/610, 750/760, 860/870): the
// real culprit made the shortlist every time, and the shortlist's own
// exact numbers matched the full k=7 enumeration to a tenth of a point,
// at 180 ms vs 1586 ms and 1217 ms vs 10212 ms respectively.
//
// The returned `exactlyResolved` lists which targets got the exact
// treatment, and `screened` says whether a screen ran at all, so a caller
// can be honest about which numbers are which rather than presenting them
// identically.
export const JOINT_BLUNDER_SHORTLIST = 4;
// The exact joint enumeration also drops the combinations in which more than this many targets are wrong at once.
// With the tool's re-checked prior (a target is wrong with weight 0.02) three or more of four being wrong together has a
// prior mass of about 3e-5, and even at the unchecked weight of 0.1 it is under 0.4%; measured on 585 real live
// analyses the Conclude list, grade and "not material" set were identical with the cap, at 1.5x the speed. A cap of one is
// too tight (it changed two of the 585 lists). Sessions in which several targets really are wrong at once are the ones that
// can lose a finding at the 0.5 line, by a hair; the cap is a parameter (`maxSimultaneous`) for exactly that reason.
export const JOINT_BLUNDER_MAX_SIMULTANEOUS = 2;
export function jointBlunderCheck({ state, observations, priors, targetIndices, rechecked = false, dragAxis = true, params = BASE_PARAMS, shortlist = JOINT_BLUNDER_SHORTLIST, warmIn = null, maxSimultaneous = JOINT_BLUNDER_MAX_SIMULTANEOUS }) {
  const warm = warmContext(warmIn, JSON.stringify([state, priors, params, rechecked, dragAxis]));
  // blunderPatternForTarget runs an ordinary fit, so it needs a scalar
  // dragPct prior; a caller using the dragPct axis normally omits it
  // (the axis supplies it per-hypothesis), and leaving it undefined here
  // is the 1/undefined^2 = NaN trap this engine has hit before.
  const screenPriors = { ...priors, dragPct: priors.dragPct ?? dragPctMarginalSigma() };
  let resolved = targetIndices;
  let screenedWeights = null;
  if (targetIndices.length > shortlist) {
    screenedWeights = {};
    for (const ti of targetIndices) {
      screenedWeights[ti] = blunderPatternForTarget({ state, observations, priors: screenPriors, targetIndex: ti, rechecked, params, warm }).posteriorWeights[1];
    }
    const keep = new Set([...targetIndices]
      .sort((a, b) => screenedWeights[b] - screenedWeights[a])
      .slice(0, shortlist));
    resolved = targetIndices.filter((ti) => keep.has(ti));
  }

  const axes = [];
  if (dragAxis) axes.push({ kind: 'param', key: 'dragPct', sigmas: [SIGMA_DRAG_NARROW_PCT, SIGMA_DRAG_WIDE_PCT], weights: DRAG_MIXTURE_WEIGHTS, labels: ['typical', 'outlier'] });
  const weights = rechecked ? [0.98, 0.02] : [0.9, 0.1];

  // A rough, theta=0 residual per target, used only to decide which terms
  // are worth OFFERING -- not to estimate anything. See the losU filter
  // below for why a sign is enough to settle it.
  const roughResidual = (ti) => {
    const o = observations.find((ob) => ob.targetIndex === ti && ob.rangeM != null);
    return o.observedComeUp - predictedComeUp(withConditions(state, o.conditions), o.rangeM, {}, { knownLosDeg: o.knownLosDeg || 0 });
  };

  // ONE axis per target, with three competing explanations, not two
  // independent binary axes. That is both more honest and much cheaper:
  //
  //  - Honest, because for a single group at a single target a range
  //    error and an inclination are EXACTLY degenerate -- measured, not
  //    argued: at 700 m a 20 degree slope shifts the come-up by -0.4178
  //    mrad, and so does a range error of -25.1 m. Two independent binary
  //    axes would also enumerate a fourth "both at once" hypothesis that
  //    the data can never distinguish from either alone, and which just
  //    splits weight arbitrarily between them.
  //  - Cheaper, because it is 3^k rather than 4^k combinations.
  //
  // The inclination option is only OFFERED where it could possibly apply.
  // Both filters remove impossible hypotheses rather than merely unlikely
  // ones, so neither costs any accuracy:
  //
  //  1. The angle was already measured and entered (a nonzero recorded
  //     `losAngleDeg`) -- then it is a known quantity folded into
  //     the baseline, not a free parameter (dropped outright above).
  //  2. The target's residual is POSITIVE -- the shooter dialled MORE than
  //     predicted. An inclination only ever makes you dial LESS, uphill
  //     and downhill alike, so it cannot explain a positive residual at
  //     all, so the term is never offered for that target.
  //
  // Prior weight: whatever mass the "something went wrong" component
  // carries (0.1, or 0.02 once re-checked) is split evenly between the two
  // failure modes wherever both are on offer. Even is a stated convention,
  // not a measurement -- a laser blunder and an unrecorded slope are both
  // real, and there is no basis here for ranking one above the other.
  const targetAxisOffset = axes.length;
  const losOffered = {};
  for (const ti of resolved) {
    const o = observations.find((ob) => ob.targetIndex === ti && ob.rangeM != null);
    const laserSigma = 0.002 * o.rangeM / 2;
    // `losMeasured` is how a MEASURED FLAT target says so. A stored
    // location record cannot tell "confirmed flat" from "never measured"
    // -- both look like losAngleDeg 0 -- so a 0 on file keeps the mixture.
    // In session we can do better: once the user actually puts a
    // clinometer on the target via a re-check, a reading of 0 is a
    // measurement, and the term is withdrawn exactly as a nonzero one
    // would be.
    const offerLos = !o.knownLosDeg && !o.losMeasured && roughResidual(ti) < 0;
    losOffered[ti] = offerLos;
    const choices = [
      { label: 'fine', terms: [{ suffix: 'rangeErrM', sigma: laserSigma }] },
      { label: 'mis-ranged', terms: [{ suffix: 'rangeErrM', sigma: 20 }] }
    ];
    const axisWeights = offerLos ? [weights[0], weights[1] / 2, weights[1] / 2] : [...weights];
    if (offerLos) {
      choices.push({ label: 'inclined', terms: [{ suffix: 'rangeErrM', sigma: laserSigma }, { suffix: 'losU', sigma: SIGMA_LOS_INCLINED_U }] });
    }
    axes.push({ kind: 'target', targetIndex: ti, choices, weights: axisWeights });
  }
  const losTargets = resolved.filter((ti) => losOffered[ti]);

  const combined = fitSessionMixture({ state, observations, priors, params, axes, warm, maxNonBaseline: maxSimultaneous });

  const marginalBlunder = {};
  // P(anything went wrong at this target) -- mis-ranged and inclined
  // summed. The two are exactly degenerate for a single group, so
  // this, not either part alone, is what decides whether a target is
  // flagged; the split between them only shapes the wording. A screened
  // target's one-at-a-time check has no inclination option, so its single
  // blunder weight already is this sum.
  const marginalSomethingWrong = {};
  if (screenedWeights) {
    for (const ti of targetIndices) {
      marginalBlunder[ti] = screenedWeights[ti];
      marginalSomethingWrong[ti] = screenedWeights[ti];
    }
  }
  resolved.forEach((ti, k) => {
    marginalBlunder[ti] = marginalAxisWeight(combined, targetAxisOffset + k, 1);
    marginalSomethingWrong[ti] = 1 - marginalAxisWeight(combined, targetAxisOffset + k, 0);
  });

  // Reported per target, in degrees, alongside its probability -- an
  // inclination flag is only actionable if it says roughly how much.
  // `combineMixture` only reports the shared `params` prefix, so the
  // per-target term is read back off the individual hypotheses: the
  // posterior-weighted mean of u over just the hypotheses where this
  // target's axis actually chose "inclined", i.e. E[u | inclined], which
  // is the number that belongs next to P(inclined).
  const marginalInclined = {};
  const inclinationDeg = {};
  for (const ti of losTargets) {
    const axisPos = targetAxisOffset + resolved.indexOf(ti);
    let wSum = 0, uSum = 0;
    combined.results.forEach((r, ci) => {
      if (r.choiceIndices[axisPos] !== 2) return; // 2 = the 'inclined' choice
      const w = combined.posteriorWeights[ci];
      wSum += w;
      uSum += w * Math.max(r.fit.theta[`losU_${ti}`] || 0, 0);
    });
    marginalInclined[ti] = wSum;
    // E[u | inclined], converted back to degrees. Only meaningful when
    // marginalInclined is itself meaningful -- at a 1% posterior weight
    // this is essentially a draw from the prior, and the UI must not
    // quote an angle it has no evidence for.
    inclinationDeg[ti] = wSum > 0 ? losDegFromU(uSum / wSum) : 0;
  }

  return { ...combined, marginalBlunder, marginalSomethingWrong, marginalInclined, inclinationDeg, losTargets, exactlyResolved: resolved, screened: screenedWeights != null, warm: warm.out };
}

// ---- dragPct's own prior, run as a mixture rather than one flat sigma ----
// A thin, single-axis case of fitSessionMixture above: the hypotheses
// differ only in which sigma dragPct's own prior uses this time, not in
// the parameter list. Collapses to a single reported mean/covariance via
// the standard Gaussian-mixture combination (law of total variance): the
// UI still wants one dragPct +/- SD to show, same as always, but that
// number now genuinely reflects "still consistent with a typical BC" vs
// "this really does look like one of the rare, badly-off ones", instead
// of a single compromise sigma splitting the difference between the two
// regimes no real bullet actually sits in.
export function fitSessionDragMixture({ state, observations, priors, params = BASE_PARAMS, weights = DRAG_MIXTURE_WEIGHTS, sigmas = [SIGMA_DRAG_NARROW_PCT, SIGMA_DRAG_WIDE_PCT], labels = ['typical', 'outlier'] }) {
  return fitSessionMixture({ state, observations, priors, params, axes: [{ kind: 'param', key: 'dragPct', sigmas, weights, labels }] });
}

// ---- Student's-t machinery, for v0Ms's "checked" prior below ----
// A recorded muzzleVelocitySD (Arsenal, or offline-measured and entered
// there) is itself an ESTIMATE, from whatever sample size established it
// -- not the true population SD. Treating it as exact and computing the
// mean's uncertainty as a plain Normal(0, SD/sqrt(n)) understates the real
// uncertainty whenever that original sample was small. The correct,
// closed-form fix is a Student's-t interval with (sampleSize - 1) degrees
// of freedom, approximated here as an INFLATION FACTOR applied to the
// ordinary Gaussian sigma -- t_crit(df)/z_crit at the same confidence
// level -- so the rest of the engine's linear-Gaussian machinery (the
// posterior and the estimator above) never has to know a t-distribution
// was involved; it just receives a
// slightly wider sigma. This replaces the old, undocumented "max(2, ...)"
// floor entirely -- there is no floor here, only a derived widening.
function lgamma(x) {
  // Lanczos approximation, standard coefficients, good to ~1e-10.
  const g = 7;
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgamma(1 - x);
  x -= 1;
  let a = c[0];
  const t = x + g + 0.5;
  for (let i = 1; i < g + 2; i++) a += c[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

function tPdf(x, df) {
  const logCoeff = lgamma((df + 1) / 2) - lgamma(df / 2) - 0.5 * Math.log(df * Math.PI);
  return Math.exp(logCoeff) * Math.pow(1 + (x * x) / df, -(df + 1) / 2);
}

// CDF by Simpson's-rule numerical integration from 0 to |x|, using
// symmetry -- avoids needing the incomplete beta function. `steps` is
// generous (this runs a handful of times per session, not per iteration).
function tCdfUpperHalf(x, df, steps = 2000) {
  const h = x / steps;
  let sum = tPdf(0, df) + tPdf(x, df);
  for (let i = 1; i < steps; i++) sum += tPdf(i * h, df) * (i % 2 === 0 ? 2 : 4);
  return (h / 3) * sum;
}
export function tCdf(x, df) {
  const half = tCdfUpperHalf(Math.abs(x), df);
  return x >= 0 ? 0.5 + half : 0.5 - half;
}

export function tQuantile(p, df, { lo = 0, hi = 50, iters = 60 } = {}) {
  // p is the upper-tail probability sought, e.g. 0.975 for a 95% two-sided interval.
  for (let i = 0; i < iters; i++) {
    const mid = (lo + hi) / 2;
    if (tCdf(mid, df) < p) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

export const Z_975 = 1.959964; // standard normal 97.5th percentile, for comparison

// The inflation factor itself: 1 as sampleSize -> infinity (no correction),
// growing as the original SD estimate's own sample gets smaller.
const tInflationCache = new Map();
export function tInflationFactor(sampleSize, confidence = 0.975) {
  const df = Math.max(sampleSize - 1, 1);
  const key = `${df}:${confidence}`;
  if (!tInflationCache.has(key)) tInflationCache.set(key, tQuantile(confidence, df) / tQuantile(confidence, 100000)); // denominator ~= Z at that confidence
  return tInflationCache.get(key);
}

// v0Ms's checked prior, replacing an older flat "max(2, SD/sqrt(n))" floor outright.
// `mvSdSampleSize`: how many shots established `mvSD` -- NOT an Arsenal
// field (the cartridge record gets no new field for this). Real only when
// `mvSD` was measured fresh this session (captured as ephemeral session
// state, never written back to Arsenal); a documented default of 10 for
// an existing Arsenal-stored `muzzleVelocitySD` whose provenance is
// unknown; null (no inflation) for a PRESETS.muzzleVelocitySD generic
// figure, since that number's own uncertainty is about applicability to
// this rifle, not small-sample statistics, which this model does not
// attempt to capture.
export function v0MsCheckedSigma({ mvSD, nToday, mvSdSampleSize = null }) {
  const inflation = mvSdSampleSize != null ? tInflationFactor(mvSdSampleSize) : 1;
  return inflation * mvSD / Math.sqrt(nToday);
}

// ---- F-distribution machinery, for the "does today's chronographed SD really
// differ from what's on file" test ----
// Standard incomplete-beta-via-continued-fraction (the Numerical Recipes
// approach), the same level of from-scratch numerics as the Student's-t
// machinery above -- no external stats library needed at this size.
function betacf(x, a, b) {
  const MAXIT = 200, EPS = 3e-14, FPMIN = 1e-300;
  const qab = a + b, qap = a + 1, qam = a - 1;
  let c = 1, d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d; h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

export function incompleteBeta(x, a, b) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? (bt * betacf(x, a, b)) / a : 1 - (bt * betacf(1 - x, b, a)) / b;
}

export function fCdf(x, d1, d2) {
  if (x <= 0) return 0;
  return incompleteBeta((d1 * x) / (d1 * x + d2), d1 / 2, d2 / 2);
}

export function fQuantile(p, d1, d2, { lo = 0, hi = 1000, iters = 80 } = {}) {
  for (let i = 0; i < iters; i++) {
    const mid = (lo + hi) / 2;
    if (fCdf(mid, d1, d2) < p) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

// Significance level for the SD-deviation check below -- a stated,
// adjustable convention (a conventional two-tailed 5% test), not derived.
export const SD_DEVIATION_ALPHA = 0.05;

// "Use the calculated SD only beyond 10 shots, and only if it deviates
// significantly from the user's; assume the user's SD was calculated over
// 10 shots" -- an F-test for equality of variances between this session's
// own chronographed shots (df1 = nToday - 1) and the SD already on file
// (df2 assumed = assumedSampleSize - 1 = 9, per the default above), two-tailed
// at SD_DEVIATION_ALPHA. Below 11 shots this session, the question is not
// even asked -- too little data to test anything.
export function sdDeviatesSignificantly({ sessionSD, nToday, assumedSD, assumedSampleSize = 10, alpha = SD_DEVIATION_ALPHA }) {
  if (nToday <= 10) return { tested: false, significant: false };
  const df1 = nToday - 1, df2 = assumedSampleSize - 1;
  const F = (sessionSD * sessionSD) / (assumedSD * assumedSD);
  const upper = fQuantile(1 - alpha / 2, df1, df2);
  const lower = 1 / fQuantile(1 - alpha / 2, df2, df1);
  return { tested: true, significant: F > upper || F < lower, F, lower, upper };
}
