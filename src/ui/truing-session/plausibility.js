// Is a typed come-up or velocity believable? Advice only: the Shoot screen shows a warning next to the field and records whatever was typed.
// The envelope is deliberately the widest one there is, so an honest entry never trips it: it is built from the app's own numbers and the
// priors of a shooter who has checked nothing (the click value untested, the velocity average unverified), and it does not look at the
// session's fit or at earlier entries -- an earlier typo that bent the fit must not make a correct entry look wrong. It is not a check of
// one round against the others in its string (the shooter shoots an obvious flyer again).
import {
  posterior, nextShotDope, perShotSigmaMrad, sigmaForGroup, observationSigmaMrad, sensitivityColumns, withConditions, windErrorMrad, windSigmaMsFor,
  DEFAULT_PRIORS_UNCHECKED, BASE_PARAMS
} from '../../engine/truing-session.js';
import { resolveMuzzleVelocity } from '../../engine/trajectory.js';
import { convert } from '../../quantity.js';

// How many standard deviations either side of the expected value still count as reasonable.
export const PLAUSIBILITY_Z = 4;
// Physical bounds on a muzzle velocity reading, whatever the cartridge (m/s).
export const VELOCITY_FLOOR_MS = 150;
export const VELOCITY_CEILING_MS = 1500;

// The covariance of the come-up's causes for a shooter who has checked nothing: one per state object, since it depends on the state alone.
const covCache = new WeakMap();
function worstCaseCov(state) {
  if (!covCache.has(state)) covCache.set(state, posterior({ state, groups: [], priors: DEFAULT_PRIORS_UNCHECKED, params: BASE_PARAMS }).cov);
  return covCache.get(state);
}

// The come-up envelope for a string (or a round, with shots = 1) at `rangeM` in the given air: the app's own dope, plus or minus z times the
// worst-case spread of that dope and of the string's own noise (the rifle, the velocity spread at that distance, the reading). All in mrad.
export function comeUpEnvelope({ state, conditions = null, rangeM, knownLosDeg = 0, r50Mrad = null, mvSD = null, certaintyKey, shots = 1, z = PLAUSIBILITY_Z }) {
  const dope = nextShotDope({ state, conditions, theta: {}, cov: worstCaseCov(state), params: BASE_PARAMS, rangeM, knownLosDeg });
  const v0SensMrad = sensitivityColumns(withConditions(state, conditions), rangeM, knownLosDeg).v0Ms;
  // the worst wind reading the shooter can state (Poor), in the called wind of this shot
  const windSdMrad = windErrorMrad({ state: withConditions(state, conditions), rangeM, knownLosDeg, speedSigmaMs: windSigmaMsFor('poor') }).verticalMrad;
  const noise = sigmaForGroup({ shots, r50Mrad, mvSD, v0SensMrad, windSdMrad, sigmaObsMrad: observationSigmaMrad(certaintyKey) });
  const sd = Math.hypot(dope.elevationSdMrad ?? 0, noise);
  return { centerMrad: dope.elevationMrad, lowMrad: dope.elevationMrad - z * sd, highMrad: dope.elevationMrad + z * sd };
}

const inside = (x, e) => x >= e.lowMrad && x <= e.highMrad;

// `enteredClicks` is what was typed into a come-up field (scope clicks, positive up). `recommendedMrad` is the come-up the screen is
// recommending (the fit's, once there is one); a number that would be right as a difference to it is recognised. Returns
// { ok, lowMrad, highMrad, hints } where hints name what the entry may have been: 'delta' (the difference to the recommended come-up
// instead of the full one), 'mrad', 'moa', 'sign', 'tenth' (a digit or the decimal point out by a factor of ten).
export function comeUpPlausibility({ enteredClicks, clickMrad, recommendedMrad = null, ...envelopeArgs }) {
  const env = comeUpEnvelope(envelopeArgs);
  const rec = recommendedMrad ?? env.centerMrad;
  const x = enteredClicks;
  const result = { ok: true, lowMrad: env.lowMrad, highMrad: env.highMrad, hints: [] };
  if (!Number.isFinite(x) || inside(x * clickMrad, env)) return result;
  result.ok = false;
  const tests = [
    ['delta', rec + x * clickMrad],
    ['mrad', x],
    ['moa', convert(x, 'arcmin', 'mrad')],
    ['sign', -x * clickMrad],
    ['tenth', x * 10 * clickMrad],
    ['tenth', x / 10 * clickMrad]
  ];
  for (const [hint, mrad] of tests) if (inside(mrad, env) && !result.hints.includes(hint)) result.hints.push(hint);
  return result;
}

// The velocity envelope for a reading in the given air: the cartridge's velocity there, plus or minus z times the worst-case spread (the
// 20 m/s of an unverified average, even when it is ticked as verified, since that tick may be false, together with one round's own spread).
export function velocityEnvelope({ state, conditions = null, mvSD = null, z = PLAUSIBILITY_Z }) {
  const center = resolveMuzzleVelocity(withConditions(state, conditions));
  const sd = Math.hypot(DEFAULT_PRIORS_UNCHECKED.v0Ms, mvSD ?? 0);
  return { centerMs: center, lowMs: Math.max(VELOCITY_FLOOR_MS, center - z * sd), highMs: Math.min(VELOCITY_CEILING_MS, center + z * sd) };
}

// `enteredMs` is the typed reading in m/s. `readAs` lists what the same number would be in the other speed units, [{ label, ms }], so a number
// typed in the wrong unit is recognised. hints: { type: 'unit', label } (it would fit in that unit) and { type: 'digit' } (a digit missing or
// extra: out by a factor of ten).
export function velocityPlausibility({ enteredMs, readAs = [], ...envelopeArgs }) {
  const env = velocityEnvelope(envelopeArgs);
  const result = { ok: true, lowMs: env.lowMs, highMs: env.highMs, hints: [] };
  if (!Number.isFinite(enteredMs)) return result;
  const fits = (ms) => ms >= env.lowMs && ms <= env.highMs;
  if (fits(enteredMs)) return result;
  result.ok = false;
  for (const { label, ms } of readAs) if (fits(ms)) result.hints.push({ type: 'unit', label });
  if (fits(enteredMs * 10) || fits(enteredMs / 10)) result.hints.push({ type: 'digit' });
  return result;
}
