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

  return {
    verdicts: results.map((r, i) => ({ id: r.id, verdict: verdicts[i] })),
    validCount: validIdxs.length,
    totalCount: results.length,
    meanBc,
    stdevBc
  };
}
