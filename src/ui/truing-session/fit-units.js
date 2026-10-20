// The Truing Session's working units, and the one place its values are
// scaled to and from SI.
//
// Its fit — engine/truing-session.js, and the session model built on it
// (session-model.js, prepare-compute.js, plausibility.js) — works on scaled
// parameters: angles (come-ups, group sigmas, click sizes, the zero offset)
// in mrad, the drag and tracking corrections in percent, a target's
// incline in degrees. Those magnitudes are what its priors, covariances
// and convergence tolerances are tuned to, the usual reason an optimizer
// works on scaled variables rather than raw SI ones. Inside the tool, the
// session it builds up in memory uses the same working units.
//
// At the tool's edges everything is SI: what it takes from the rest of the
// app (the shot state; the rifle's precision and click size, scaled on
// entry with toFitAngle()), what it gives back (a BC gain factor, an MV SD
// in m/s), and what it stores (truing-session-state.js, through
// sessionStateToStored()/sessionStateFromStored() below). What it shows
// goes through ui/truing-session/units.js, which converts from these
// working units to the user's display units.
import { radToMrad, mradToRad, radToDeg, degToRad, fractionToPercent, percentToFraction } from '../../quantity.js';

export const toFitAngle = radToMrad;
export const fromFitAngle = mradToRad;
export const toFitIncline = radToDeg;
export const fromFitIncline = degToRad;
export const toFitRatio = fractionToPercent;
export const fromFitRatio = percentToFraction;

const mapValues = (obj, fn) => (obj ? Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, fn(v)])) : obj);
const mapOr = (v, fn) => (v == null ? v : fn(v));

// A recorded group: its come-up, the string's sigma, the parts of its
// noise, and per-shot come-ups — angles all.
const GROUP_ANGLES = [['observedComeUp', 'observedComeUpRad'], ['sigmaMrad', 'sigmaRad']];
const NOISE_ANGLES = [['r50Mrad', 'r50Rad'], ['v0SensMrad', 'v0SensRadPerMs'], ['sigmaObsMrad', 'sigmaObsRad'], ['windSdMrad', 'windSdRad']];

function convertKeys(obj, pairs, fn, forward) {
  if (!obj) return obj;
  const out = { ...obj };
  for (const [fit, stored] of pairs) {
    const [from, to] = forward ? [fit, stored] : [stored, fit];
    if (from in out) {
      out[to] = mapOr(out[from], fn);
      delete out[from];
    }
  }
  return out;
}

function groupToStored(g) {
  const out = convertKeys(g, GROUP_ANGLES, fromFitAngle, true);
  if (out.noise) out.noise = convertKeys(out.noise, NOISE_ANGLES, fromFitAngle, true);
  if (out.shotComeUps) { out.shotComeUpsRad = out.shotComeUps.map((x) => mapOr(x, fromFitAngle)); delete out.shotComeUps; }
  return out;
}

function groupFromStored(g) {
  const out = convertKeys(g, GROUP_ANGLES, toFitAngle, false);
  if (out.noise) out.noise = convertKeys(out.noise, NOISE_ANGLES, toFitAngle, false);
  if (out.shotComeUpsRad) { out.shotComeUps = out.shotComeUpsRad.map((x) => mapOr(x, toFitAngle)); delete out.shotComeUpsRad; }
  return out;
}

const TARGET_ANGLES = [['losAngleDeg', 'losAngleRad']];
const HOMEWORK_ANGLES = [['r50Mrad', 'r50Rad']];

// The saved plan's drag SD: the same name in memory (percent) and stored
// (a fraction).
const planToStored = (plan) => (plan && plan.dragSd != null ? { ...plan, dragSd: fromFitRatio(plan.dragSd) } : plan);
const planFromStored = (plan) => (plan && plan.dragSd != null ? { ...plan, dragSd: toFitRatio(plan.dragSd) } : plan);

function shootSessionToStored(s) {
  if (!s) return s;
  const out = { ...s, groups: (s.groups || []).map(groupToStored) };
  if (s.angleChecks) { out.angleChecksRad = mapValues(s.angleChecks, (d) => mapOr(d, fromFitIncline)); delete out.angleChecks; }
  return out;
}

function shootSessionFromStored(s) {
  if (!s) return s;
  const out = { ...s, groups: (s.groups || []).map(groupFromStored) };
  if (s.angleChecksRad) { out.angleChecks = mapValues(s.angleChecksRad, (r) => mapOr(r, toFitIncline)); delete out.angleChecksRad; }
  return out;
}

// The active location as the tool works with it: each target's incline
// in degrees (`losAngleDeg`) rather than the record's radians. The record
// itself is never written to from here.
export function locationToFit(location) {
  if (!location) return location;
  return {
    ...location,
    targets: (location.targets || []).map(({ losAngleRad, ...tg }) => ({ ...tg, losAngleDeg: toFitIncline(losAngleRad ?? 0) }))
  };
}

// The persisted tool state (truing-session-state.js), in memory in the
// fit's working units and stored in SI.
export function sessionStateToStored(state) {
  if (!state) return state;
  const out = { ...state };
  if ('shootSession' in out) out.shootSession = shootSessionToStored(out.shootSession);
  if ('homeworkState' in out) out.homeworkState = convertKeys(out.homeworkState, HOMEWORK_ANGLES, fromFitAngle, true);
  if ('plan' in out) out.plan = planToStored(out.plan);
  for (const key of ['targetOverrides', 'pendingTargetEdits']) {
    if (key in out) out[key] = mapValues(out[key], (t) => convertKeys(t, TARGET_ANGLES, fromFitIncline, true));
  }
  return out;
}

export function sessionStateFromStored(stored) {
  if (!stored) return stored;
  const out = { ...stored };
  if ('shootSession' in out) out.shootSession = shootSessionFromStored(out.shootSession);
  if ('homeworkState' in out) out.homeworkState = convertKeys(out.homeworkState, HOMEWORK_ANGLES, toFitAngle, false);
  if ('plan' in out) out.plan = planFromStored(out.plan);
  for (const key of ['targetOverrides', 'pendingTargetEdits']) {
    if (key in out) out[key] = mapValues(out[key], (t) => convertKeys(t, TARGET_ANGLES, toFitIncline, false));
  }
  return out;
}
