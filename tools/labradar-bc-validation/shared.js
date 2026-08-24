// Ground-truth configs, atmosphere, and small pure helpers shared by
// both experiment runners (run-experiment.js and
// run-cleaning-experiment.js) — extracted so the two stay in sync rather
// than risking drift between two hand-copied config lists. No side
// effects at import time (unlike the runners themselves, which each end
// in a top-level `main()` call) — safe to import from either runner or
// from ad-hoc validation scripts.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { trueStateAtTimes, timeToRange } from './synthetic-track.js';
import { BULLET_LIBRARIES } from '../../src/bullets/bullet-libraries.js';

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const ATMO = { tempC: 15, pressureHpa: 1013.25, altitudeM: 0, humidityPct: 0 };
export const EXTRAPOLATION_RANGE_M = 300;

const LIBRARY_BY_ID = new Map(BULLET_LIBRARIES.flatMap((lib) => lib.ids.map((id) => [id, lib])));

function loadBullet(id) {
  const lib = LIBRARY_BY_ID.get(id);
  const relativePath = lib ? `src/bullets/${lib.id}/${id}.json` : `src/bullets/${id}.json`;
  return JSON.parse(fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8'));
}

// See docs/plans/labradar-cleaning-experiment.md / docs/labradar-bc-validation.md
// "Ground-truth configs" for the rationale behind each choice.
export const TIER_A_CONFIGS = [
  { id: 'heavy-338', v1: 830, trueBc: 0.368, trueState: { bc: 0.368, dragModel: 'G7', ...ATMO } },
  { id: 'm4a1-m193', v1: 971, trueBc: 0.122, trueState: { bc: 0.122, dragModel: 'G7', ...ATMO } },
  { id: 'svd-7n1', v1: 830, trueBc: 0.202, trueState: { bc: 0.202, dragModel: 'G7', ...ATMO } }
];

export function buildTierBConfig() {
  const bullet = loadBullet('hrr-65-eldm-147');
  return {
    id: 'hrr-65-eldm-147',
    v1: 820,
    trueBc: null, // no single "true G7 BC" — ground truth is the bullet's own measured Cd(M) curve
    trueState: { cdTable: bullet.profile.table, massKg: bullet.massKg, caliberM: bullet.caliberM, ...ATMO }
  };
}

// Window "severities": how far downrange each synthetic track extends —
// see run-experiment.js's original header comment for why this is a
// swept axis rather than one assumed reliable/noisy distance split.
export const WINDOW_TARGET_RANGES_M = [120, 150, 200];

export function trueVelocityAtRange(trueState, v1, rangeM) {
  const t = timeToRange(trueState, v1, rangeM);
  return trueStateAtTimes(trueState, v1, [t])[0].v;
}

// Downstream extrapolation error: using a fit's own (bc, anchor
// velocity, anchor range) with the standard bc+G7 model, predict
// velocity at EXTRAPOLATION_RANGE_M and compare to the true trajectory's
// velocity there. Anchored at whatever point the fit actually anchored
// on (its own v1 if it has one, else the anchor point's raw velocity),
// not the muzzle, since that's what every method here actually has to
// anchor on. Takes primitives rather than a specific fit-result shape so
// callers with differently-shaped results (fit-methods.js's vs.
// adaptive-clean.js's own local fits) can all reuse it.
export function extrapolationErrorFrom(bc, anchorV1, anchorDistM, dragModel, trueVelocityAtExtrapolation) {
  const remainingRangeM = EXTRAPOLATION_RANGE_M - anchorDistM;
  if (remainingRangeM <= 0) return null;
  const predictedV = trueVelocityAtRange({ bc, dragModel, ...ATMO }, anchorV1, remainingRangeM);
  return (predictedV - trueVelocityAtExtrapolation) / trueVelocityAtExtrapolation;
}

export function summarize(values) {
  const n = values.length;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  const absMax = values.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
  return { n, mean, stdev: Math.sqrt(variance), absMax };
}

export function fmtPct(x) { return (x * 100).toFixed(2) + '%'; }

// Deterministic PRNG (Mulberry32) so a gate comparison and any rerun use
// the same noise draws per noise mode — otherwise two independently
// Math.random()-seeded runs could disagree just from sampling variance,
// not because the thing being compared actually differs.
export function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
