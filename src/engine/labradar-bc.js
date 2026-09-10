// Per-track BC estimation and multi-track aggregation for the Labradar
// tool — ports BCFetcher.processTrackData's per-track pipeline and
// BCFetcher.reportAllDone's two whole-track rejection gates (see
// data/legacy.code/labrabaco/engine/labrabacoengine.js) on top of this
// app's own cleanTrack()/estimateBCFromTimeWindow().
import { cleanTrack, fitVelocityModel } from './labradar-clean.js';
import { estimateBCFromTimeWindow, estimateBCWholeWindow } from './bc-estimate.js';

// `points` is a track's parsed (and still-metric, still-raw) sample
// array (see src/labradar/track-parse.js). Anchors vStart/vEnd/t2 at the
// cleaned/kept set's index-1 point, exactly matching legacy's
// calcBC(null, null, dragmodel) — the modeled velocity at the first
// *retained interior* point stands in for a muzzle velocity at t=0, and
// the modeled velocity at the last retained point is the "observed" end
// velocity after that elapsed window. vStart/vEnd are read off
// fitVelocityModel()'s fit (NOT cleanTrack()'s own returned `model`,
// which is fit over a deliberately different point range for R^2/
// cleaning purposes — see labradar-clean.js's comment on
// weightedLinearRegression) — this distinction was confirmed load-
// bearing by diffing against the real legacy engine on real sample
// tracks; reusing the cleaning-purpose model here silently introduced a
// ~0.5% BC error.
export function estimateTrackBC({
  points, dragModel, atmo, minLeft, r2CleanThreshold
}) {
  const { kept, discarded, r2 } = cleanTrack(points, { minLeft, r2Threshold: r2CleanThreshold });
  const velocityModel = fitVelocityModel(kept);
  const vM = (t) => velocityModel.m * t + velocityModel.b;
  const vStart = vM(kept[1].t);
  const tEnd = kept[kept.length - 1].t;
  const vEnd = vM(tEnd);
  const t2 = tEnd - kept[1].t;

  const { bc } = estimateBCFromTimeWindow({ v1: vStart, t2, v2: vEnd, dragModel, ...atmo });

  return {
    bc,
    r2Linear: r2,
    keptPoints: kept,
    discardedPoints: discarded,
    keptCount: kept.length,
    discardedCount: discarded.length
  };
}

// Fits BC via estimateBCWholeWindow() — jointly with a reference
// velocity, against every kept point at once, using the app's own drag
// model directly instead of a linear approximation — rather than
// estimateTrackBC()'s two-point linear-fit-then-bisect. Validated
// (tools/labradar-bc-validation/, docs/reports/labradar-bc-validation.md)
// to recover BC 3-9x more accurately across every tested configuration,
// including a real ~9% curve-shape bias estimateTrackBC carries even on
// a noiseless track. This is the function the real app actually calls
// (see src/workers/ballistics-worker.js) — estimateTrackBC itself is
// left untouched on purpose, since
// tools/labradar-bc-validation/run-experiment.js imports it directly as
// its own "linear" comparison baseline; rewriting it in place would
// silently invalidate that already-published report's methodology.
//
// Anchors the same way estimateTrackBC does: kept[1] (the first
// *retained interior* point, excluding kept[0] — the device's own
// synthetic t=0 point) stands in for the reference point, with every
// other kept point (including the last, unlike the cleaning fit's own
// R^2 range) contributing to the fit.
export function estimateTrackBCWholeWindow({
  points, dragModel, atmo, minLeft, r2CleanThreshold
}) {
  const { kept, discarded, r2 } = cleanTrack(points, { minLeft, r2Threshold: r2CleanThreshold });
  const t1 = kept[1].t;
  const samples = kept.slice(1).map((p) => ({ t: p.t - t1, v: p.v, weight: p.a || 1 }));
  const { bc, v1 } = estimateBCWholeWindow({ samples, v1Guess: kept[1].v, dragModel, ...atmo });

  return {
    bc,
    v1,
    r2Linear: r2,
    keptPoints: kept,
    discardedPoints: discarded,
    keptCount: kept.length,
    discardedCount: discarded.length
  };
}

// Two-sided 95% Student-t quantile t(0.975, n-1), indexed by sample size
// n the way src/engine/rifle-precision-constants.js's own tables are
// (index 0 and 1 unused — a single shot has no interval).
//
// Deliberately NOT that file's TDIST_QUANTILE, despite its "Student's-t
// quantile (two-tailed, 95%)" label: those are the 0.9875 quantiles, the
// Bonferroni split that gives a joint 95% over a shot group's *two*
// point-of-impact coordinates at once. A BC average is one scalar, so
// reusing them would report an interval 25-100% wider than the 95% it
// claims (at n = 5, 3.495 against the correct 2.776).
//
// Past n = 31 the table gives way to the Cornish-Fisher expansion around
// z = 1.959964, accurate to well under 0.001 there — a Labradar session
// is a shot string, not a thousand-round corpus, so the long precomputed
// tail those legacy tables carry would be dead weight here.
const T95_BY_SAMPLE_SIZE = [
  null, null,
  12.7062047364, 4.3026527299, 3.1824463053, 2.7764451052, 2.5705818366,
  2.4469118488, 2.3646242510, 2.3060041350, 2.2621571627, 2.2281388520,
  2.2009851601, 2.1788128297, 2.1603686565, 2.1447866879, 2.1314495456,
  2.1199052992, 2.1098155778, 2.1009220402, 2.0930240544, 2.0859634473,
  2.0796138447, 2.0738730679, 2.0686576104, 2.0638985616, 2.0595385528,
  2.0555294386, 2.0518305165, 2.0484071418, 2.0452296421, 2.0422724563
];

function tCritical95(n) {
  if (n < 2) return null;
  if (n < T95_BY_SAMPLE_SIZE.length) return T95_BY_SAMPLE_SIZE[n];
  const df = n - 1;
  const z = 1.959964;
  return z
    + (z ** 3 + z) / (4 * df)
    + (5 * z ** 5 + 16 * z ** 3 + 3 * z) / (96 * df * df);
}

// `results`: array of { id, bc, r2Linear } (typically estimateTrackBC()'s
// own output, plus an `id` — e.g. the track's filename — the caller adds
// to key it against `overrides`).
//
// `overrides[id] === true`  forces that track into the averaged set
//   regardless of the R^2 gate, and exempts it from the sigma-clip pass
//   below — a manual override is meant to stick, not get silently
//   reclassified by the very statistic it's overriding.
// `overrides[id] === false` forces that track out, regardless of either
//   gate.
//
// Matches legacy's reportAllDone(): a per-track linear-R^2 gate first
// (skipped entirely when r2GateThreshold is falsy — the UI's "None"
// option), then one pass of sigma-clipping over whatever's still
// "valid" (mean/stdev computed from that same still-valid set, skipped
// when sigmaClip is falsy), then a plain unweighted arithmetic mean.
export function aggregateTracks(results, { r2GateThreshold = null, sigmaClip = null, overrides = {} } = {}) {
  const verdicts = results.map((r) => {
    if (Object.prototype.hasOwnProperty.call(overrides, r.id)) {
      return overrides[r.id] ? 'valid' : 'excluded';
    }
    if (r2GateThreshold && r.r2Linear < r2GateThreshold) return 'rejected-r2';
    return 'valid';
  });

  if (sigmaClip) {
    const validIdxs = [];
    for (let i = 0; i < results.length; i++) if (verdicts[i] === 'valid') validIdxs.push(i);
    if (validIdxs.length > 0) {
      const bcs = validIdxs.map((i) => results[i].bc);
      const mean = bcs.reduce((a, b) => a + b, 0) / bcs.length;
      const variance = bcs.reduce((a, b) => a + (b - mean) ** 2, 0) / bcs.length;
      const outlierThreshold = sigmaClip * Math.sqrt(variance);
      for (const i of validIdxs) {
        const isForcedInclude = overrides[results[i].id] === true;
        if (!isForcedInclude && Math.abs(results[i].bc - mean) > outlierThreshold) {
          verdicts[i] = 'rejected-outlier';
        }
      }
    }
  }

  const validIdxs = [];
  for (let i = 0; i < results.length; i++) if (verdicts[i] === 'valid') validIdxs.push(i);
  const validBcs = validIdxs.map((i) => results[i].bc);
  const meanBc = validBcs.length ? validBcs.reduce((a, b) => a + b, 0) / validBcs.length : null;
  const stdevBc = validBcs.length
    ? Math.sqrt(validBcs.reduce((a, b) => a + (b - meanBc) ** 2, 0) / validBcs.length)
    : null;

  // 95% confidence interval of the *mean* BC — how well this session
  // pinned down the bullet's BC, not how much shot-to-shot spread it
  // saw (that's stdevBc, which stays on legacy's population/n
  // denominator so the sigma-clip gate above keeps behaving exactly as
  // it always did). The interval uses the sample/(n-1) standard
  // deviation and a Student-t multiplier, both of which matter at the
  // handful-of-shots sample sizes this tool sees. Needs at least two
  // valid tracks; a single track carries no interval at all.
  let ci95Bc = null;
  let ci95PctBc = null;
  if (validBcs.length >= 2) {
    const n = validBcs.length;
    const sampleStdev = Math.sqrt(
      validBcs.reduce((a, b) => a + (b - meanBc) ** 2, 0) / (n - 1)
    );
    ci95Bc = tCritical95(n) * sampleStdev / Math.sqrt(n);
    if (meanBc !== 0) ci95PctBc = 100 * ci95Bc / Math.abs(meanBc);
  }

  return {
    verdicts: results.map((r, i) => ({ id: r.id, verdict: verdicts[i] })),
    validCount: validIdxs.length,
    totalCount: results.length,
    meanBc,
    stdevBc,
    ci95Bc,
    ci95PctBc
  };
}
