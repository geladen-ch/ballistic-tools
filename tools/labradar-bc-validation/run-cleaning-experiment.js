// Runner for the cleaning-step follow-up experiment — see
// docs/plans/labradar-cleaning-experiment.md for the full rationale.
// Not a node:test spec — a manual analysis tool (`node
// tools/labradar-bc-validation/run-cleaning-experiment.js`), same
// category as run-experiment.js and tools/dev-server.js.
//
// Compares 4 cleaning variants (see adaptive-clean.js): C0 (shipped,
// unchanged), C1 (physics reference only), C2 (raised threshold only),
// C3 (both — the actual proposal), primarily paired with the physics
// whole-window curve fit, plus a smaller secondary sweep pairing C0/C3
// with today's shipped linear curve fit.
import fs from 'node:fs';
import path from 'node:path';
import { loadDonorCorpus, discardCountDistribution } from './donor-corpus.js';
import { generateSyntheticTrack, timeToRange, trueStateAtTimes } from './synthetic-track.js';
import { makeSeverityScaler, residualAtWithSeverity } from './parametric-noise.js';
import { cleanC0, cleanC1, cleanC2, cleanC3 } from './adaptive-clean.js';
import { physicsFitFromKept } from './fit-methods.js';
import { fitVelocityModel } from '../../src/engine/labradar-clean.js';
import { estimateBCFromTimeWindow } from '../../src/engine/bc-estimate.js';
import {
  REPO_ROOT, ATMO, EXTRAPOLATION_RANGE_M, TIER_A_CONFIGS, buildTierBConfig,
  WINDOW_TARGET_RANGES_M, trueVelocityAtRange, extrapolationErrorFrom, summarize, fmtPct, mulberry32
} from './shared.js';

const CLEAN_VARIANTS = { C0: cleanC0, C1: cleanC1, C2: cleanC2, C3: cleanC3 };
const TRUE_OUTLIER_CUTOFF_MS = 15; // m/s — roughly the real corpus's own p90-tail severity, see docs/labradar-bc-validation.md

// Mirrors src/engine/labradar-bc.js's estimateTrackBC exactly, for the
// portion *after* its own cleanTrack call — duplicated rather than
// extracted, since that file is shipped source and this experiment
// makes no changes to any shipped file (see the plan).
function linearFitFromKept(kept, dragModel, atmo) {
  const velocityModel = fitVelocityModel(kept);
  const vM = (t) => velocityModel.m * t + velocityModel.b;
  const vStart = vM(kept[1].t);
  const tEnd = kept[kept.length - 1].t;
  const vEnd = vM(tEnd);
  const t2 = tEnd - kept[1].t;
  const { bc } = estimateBCFromTimeWindow({ v1: vStart, t2, v2: vEnd, dragModel, ...atmo });
  return { bc, v1: vStart };
}

// Ground-truth cleaning quality: every synthetic point carries a known
// injected residual, so whether a point is truly corrupted is known
// exactly. Returns { recall, precision, falseDiscardRate } for one
// variant's kept/discarded split against the track's true residuals
// (indexed the same way — index i corresponds to points[i+1]).
function scoreCleaning(discarded, trueResidualAbs, points) {
  const discardedSet = new Set(discarded);
  let truePositives = 0, trueOutliers = 0, falsePositives = 0, goodPoints = 0;
  for (let i = 1; i < points.length; i++) {
    const isTrueOutlier = trueResidualAbs[i - 1] > TRUE_OUTLIER_CUTOFF_MS;
    const wasDiscarded = discardedSet.has(points[i]);
    if (isTrueOutlier) { trueOutliers++; if (wasDiscarded) truePositives++; }
    else { goodPoints++; if (wasDiscarded) falsePositives++; }
  }
  return {
    recall: trueOutliers ? truePositives / trueOutliers : null,
    precision: (truePositives + falsePositives) ? truePositives / (truePositives + falsePositives) : null,
    falseDiscardRate: goodPoints ? falsePositives / goodPoints : null
  };
}

function meanOf(values) { return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null; }
function percentile(values, p) {
  if (!values.length) return null;
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
}

function runTrials({ config, targetRangeM, curveFit, variantNames, donors, severityScaler, trialCount, rng }) {
  const windowDurationS = timeToRange(config.trueState, config.v1, targetRangeM);
  const trueVelocityAtExtrapolation = trueVelocityAtRange(config.trueState, config.v1, EXTRAPOLATION_RANGE_M);

  const bcErrors = {}, extrapErrors = {}, recalls = {}, precisions = {}, falseDiscardRates = {}, discardCounts = {};
  const cleanMs = {};
  for (const name of variantNames) {
    bcErrors[name] = []; extrapErrors[name] = []; recalls[name] = []; precisions[name] = [];
    falseDiscardRates[name] = []; discardCounts[name] = []; cleanMs[name] = [];
  }

  for (let trial = 0; trial < trialCount; trial++) {
    const donor = donors[Math.floor(rng() * donors.length)];
    const residualAt = residualAtWithSeverity(severityScaler(rng)); // parametric noise for this sweep — see note in main()
    const points = generateSyntheticTrack({
      trueState: config.trueState, v1: config.v1, donor, windowDurationS, noiseMode: 'parametric', residualAt, rng
    });

    const trueVs = trueStateAtTimes(config.trueState, config.v1, points.slice(1).map((p) => p.t)).map((s) => s.v);
    const trueResidualAbs = points.slice(1).map((p, i) => Math.abs(p.v - trueVs[i]));

    for (const name of variantNames) {
      const t0 = process.hrtime.bigint();
      const cleaned = CLEAN_VARIANTS[name](points, { minLeft: 10, dragModel: 'G7', atmo: ATMO });
      const t1 = process.hrtime.bigint();
      cleanMs[name].push(Number(t1 - t0) / 1e6);
      discardCounts[name].push(cleaned.discarded.length);

      const score = scoreCleaning(cleaned.discarded, trueResidualAbs, points);
      if (score.recall !== null) recalls[name].push(score.recall);
      if (score.precision !== null) precisions[name].push(score.precision);
      if (score.falseDiscardRate !== null) falseDiscardRates[name].push(score.falseDiscardRate);

      let fit;
      try {
        fit = curveFit === 'physics'
          ? physicsFitFromKept(cleaned.kept, { dragModel: 'G7', atmo: ATMO })
          : linearFitFromKept(cleaned.kept, 'G7', ATMO);
      } catch { continue; }

      if (config.trueBc !== null) bcErrors[name].push((fit.bc - config.trueBc) / config.trueBc);
      const anchor = cleaned.kept[1];
      const ee = extrapolationErrorFrom(fit.bc, fit.v1, anchor.dist, 'G7', trueVelocityAtExtrapolation);
      if (ee !== null) extrapErrors[name].push(ee);
    }
  }

  const out = {};
  for (const name of variantNames) {
    out[name] = {
      bc: bcErrors[name].length ? summarize(bcErrors[name]) : null,
      extrap: extrapErrors[name].length ? summarize(extrapErrors[name]) : null,
      recall: meanOf(recalls[name]),
      precision: meanOf(precisions[name]),
      falseDiscardRate: meanOf(falseDiscardRates[name]),
      discardMean: meanOf(discardCounts[name]),
      discardP95: percentile(discardCounts[name], 0.95),
      discardMax: discardCounts[name].length ? Math.max(...discardCounts[name]) : null,
      cleanMsMean: meanOf(cleanMs[name])
    };
  }
  return out;
}

function fmt(x, digits = 2) { return x === null || x === undefined ? '-' : x.toFixed(digits); }

function printTable(rows, header) {
  console.log(header.join('\t'));
  for (const row of rows) console.log(row.join('\t'));
}

function rowsFor(config, targetRangeM, curveFit, result, variantNames) {
  return variantNames.map((name) => {
    const r = result[name];
    return [
      config.id, targetRangeM, curveFit, name,
      r.bc ? fmtPct(r.bc.mean) : '-', r.bc ? fmtPct(r.bc.stdev) : '-',
      r.extrap ? fmtPct(r.extrap.mean) : '-', r.extrap ? fmtPct(r.extrap.stdev) : '-',
      fmt(r.recall), fmt(r.precision), fmt(r.falseDiscardRate),
      fmt(r.discardMean, 1), fmt(r.discardP95, 1), fmt(r.discardMax, 0),
      fmt(r.cleanMsMean, 3)
    ];
  });
}

const TABLE_HEADER = [
  'config', 'range(m)', 'curveFit', 'variant',
  'bcErr.mean', 'bcErr.stdev', 'extrap.mean', 'extrap.stdev',
  'recall', 'precision', 'falseDiscardRate',
  'discard.mean', 'discard.p95', 'discard.max', 'cleanMs.mean'
];

function main() {
  const donors = loadDonorCorpus();
  const severityScaler = makeSeverityScaler(discardCountDistribution(donors));
  const configs = [...TIER_A_CONFIGS, buildTierBConfig()];
  const trialCount = Number(process.env.N || 300);

  // Parametric noise mode throughout (not donor-bootstrap): the previous
  // experiment's cross-validation gate already established parametric
  // noise agrees with donor-bootstrap on qualitative conclusions and is
  // far cheaper to run at this trial count across 4 variants x 2 curve
  // fits x 4 configs x 3 severities; the ground-truth precision/recall
  // metric here is a new, additional check that donor-bootstrap mode
  // cannot straightforwardly support anyway (a donor's own residuals
  // ARE the "true outlier" signal, circular with the recall metric).

  console.log(`# Primary sweep: 4 cleaning variants x physics curve fit (N=${trialCount} per cell)`);
  const primaryRows = [];
  const primaryVariants = ['C0', 'C1', 'C2', 'C3'];
  for (const config of configs) {
    for (const targetRangeM of WINDOW_TARGET_RANGES_M) {
      const rng = mulberry32(42);
      const result = runTrials({ config, targetRangeM, curveFit: 'physics', variantNames: primaryVariants, donors, severityScaler, trialCount, rng });
      primaryRows.push(...rowsFor(config, targetRangeM, 'physics', result, primaryVariants));
    }
  }
  printTable(primaryRows, TABLE_HEADER);

  console.log();
  console.log(`# Secondary sweep: C0 vs C3 x linear curve fit (N=${trialCount} per cell)`);
  const secondaryRows = [];
  const secondaryVariants = ['C0', 'C3'];
  for (const config of configs) {
    for (const targetRangeM of WINDOW_TARGET_RANGES_M) {
      const rng = mulberry32(43);
      const result = runTrials({ config, targetRangeM, curveFit: 'linear', variantNames: secondaryVariants, donors, severityScaler, trialCount, rng });
      secondaryRows.push(...rowsFor(config, targetRangeM, 'linear', result, secondaryVariants));
    }
  }
  printTable(secondaryRows, TABLE_HEADER);

  const csvPath = path.join(REPO_ROOT, 'tools/labradar-bc-validation/last-cleaning-run.csv');
  const csvHeader = TABLE_HEADER.join(',') + '\n';
  const csvBody = [...primaryRows, ...secondaryRows].map((r) => r.join(',')).join('\n');
  fs.writeFileSync(csvPath, csvHeader + csvBody + '\n');
  console.log();
  console.log(`# CSV written to ${csvPath}`);
}

main();
