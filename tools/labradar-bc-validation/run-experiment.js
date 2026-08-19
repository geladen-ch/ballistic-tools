// Runner for the synthetic BC-fit/noise-handling validation. Not a
// node:test spec — a manual analysis tool (`node
// tools/labradar-bc-validation/run-experiment.js`), same category as
// tools/dev-server.js. See /home/gnosis/.claude/plans (or the project's
// own notes) for the full rationale; the short version: does fitting the
// real drag model directly against a Labradar track's kept points (not a
// generic linear/quadratic curve) recover BC more accurately, especially
// once the track's real, one-sided, tail-heavy noise is accounted for?
import fs from 'node:fs';
import path from 'node:path';
import { loadDonorCorpus, discardCountDistribution } from './donor-corpus.js';
import { generateSyntheticTrack, timeToRange } from './synthetic-track.js';
import { makeSeverityScaler, residualAtWithSeverity } from './parametric-noise.js';
import { estimateTrackBC } from '../../src/engine/labradar-bc.js';
import { estimateTrackBCQuadratic, estimateTrackBCPhysicsFit } from './fit-methods.js';
import {
  REPO_ROOT, ATMO, EXTRAPOLATION_RANGE_M, TIER_A_CONFIGS, buildTierBConfig,
  WINDOW_TARGET_RANGES_M, trueVelocityAtRange, extrapolationErrorFrom, summarize, fmtPct, mulberry32
} from './shared.js';

const CLEAN_OPTS = { minLeft: 10, r2CleanThreshold: 0.97 };

const FIT_METHODS = {
  linear: (points, dragModel) => estimateTrackBC({ points, dragModel, atmo: ATMO, ...CLEAN_OPTS }),
  quadratic: (points, dragModel) => estimateTrackBCQuadratic({ points, dragModel, atmo: ATMO, ...CLEAN_OPTS }),
  physicsFit: (points, dragModel) => estimateTrackBCPhysicsFit({ points, dragModel, atmo: ATMO, ...CLEAN_OPTS })
};

// --- Metrics ------------------------------------------------------------

function extrapolationError(fitResult, dragModel, trueVelocityAtExtrapolation) {
  const anchor = fitResult.keptPoints[1];
  const anchorV1 = fitResult.v1 !== undefined ? fitResult.v1 : anchor.v;
  return extrapolationErrorFrom(fitResult.bc, anchorV1, anchor.dist, dragModel, trueVelocityAtExtrapolation);
}

// --- One config x severity x noiseMode run ------------------------------

function runTrials({ config, targetRangeM, noiseMode, donors, severityScaler, trialCount, rng }) {
  const windowDurationS = timeToRange(config.trueState, config.v1, targetRangeM);
  const trueVelocityAtExtrapolation = trueVelocityAtRange(config.trueState, config.v1, EXTRAPOLATION_RANGE_M);

  const bcErrors = { linear: [], quadratic: [], physicsFit: [] };
  const extrapErrors = { linear: [], quadratic: [], physicsFit: [] };

  for (let trial = 0; trial < trialCount; trial++) {
    const donor = donors[Math.floor(rng() * donors.length)];
    const residualAt = noiseMode === 'donor'
      ? undefined
      : residualAtWithSeverity(severityScaler(rng));
    const points = generateSyntheticTrack({
      trueState: config.trueState, v1: config.v1, donor, windowDurationS, noiseMode, residualAt, rng
    });

    for (const [name, fit] of Object.entries(FIT_METHODS)) {
      let result;
      try {
        result = fit(points, 'G7');
      } catch {
        continue; // e.g. bracket exhausted on a pathological draw — skip this trial for this method
      }
      if (config.trueBc !== null) {
        bcErrors[name].push((result.bc - config.trueBc) / config.trueBc);
      }
      const ee = extrapolationError(result, 'G7', trueVelocityAtExtrapolation);
      if (ee !== null) extrapErrors[name].push(ee);
    }
  }

  const out = { bc: {}, extrap: {} };
  for (const name of Object.keys(FIT_METHODS)) {
    if (bcErrors[name].length) out.bc[name] = summarize(bcErrors[name]);
    if (extrapErrors[name].length) out.extrap[name] = summarize(extrapErrors[name]);
  }
  return out;
}

function printSummaryTable(rows) {
  const header = ['config', 'range(m)', 'noise', 'method', 'bcErr.mean', 'bcErr.stdev', 'bcErr.max', 'extrap.mean', 'extrap.stdev'];
  console.log(header.join('\t'));
  for (const row of rows) console.log(row.join('\t'));
}

function rowsFor(config, targetRangeM, noiseMode, result) {
  const rows = [];
  for (const name of Object.keys(FIT_METHODS)) {
    const bc = result.bc[name];
    const ex = result.extrap[name];
    rows.push([
      config.id, targetRangeM, noiseMode, name,
      bc ? fmtPct(bc.mean) : '-', bc ? fmtPct(bc.stdev) : '-', bc ? fmtPct(bc.absMax) : '-',
      ex ? fmtPct(ex.mean) : '-', ex ? fmtPct(ex.stdev) : '-'
    ]);
  }
  return rows;
}

// --- Main -----------------------------------------------------------------

function main() {
  const donors = loadDonorCorpus();
  const severityScaler = makeSeverityScaler(discardCountDistribution(donors));
  const configs = [...TIER_A_CONFIGS, buildTierBConfig()];

  const gateN = Number(process.env.GATE_N || 150);
  const fullN = Number(process.env.FULL_N || 300);
  const gateConfigIds = (process.env.GATE_CONFIGS || 'm4a1-m193').split(',');

  console.log(`# Cross-validation gate (N=${gateN} per cell, configs: ${gateConfigIds.join(',')})`);
  const allRows = [];
  let gatePassed = true;
  for (const config of configs.filter((c) => gateConfigIds.includes(c.id))) {
    for (const targetRangeM of WINDOW_TARGET_RANGES_M) {
      const rngDonor = mulberry32(1);
      const donorResult = runTrials({ config, targetRangeM, noiseMode: 'donor', donors, severityScaler, trialCount: gateN, rng: rngDonor });
      const rngParam = mulberry32(1);
      const paramResult = runTrials({ config, targetRangeM, noiseMode: 'parametric', donors, severityScaler, trialCount: gateN, rng: rngParam });
      allRows.push(...rowsFor(config, targetRangeM, 'donor', donorResult));
      allRows.push(...rowsFor(config, targetRangeM, 'parametric', paramResult));

      for (const name of Object.keys(FIT_METHODS)) {
        const d = donorResult.bc[name], p = paramResult.bc[name];
        if (!d || !p) continue;
        const signAgrees = Math.sign(d.mean) === Math.sign(p.mean) || Math.abs(d.mean) < 0.01;
        const magnitudeClose = Math.abs(d.mean - p.mean) < 0.03; // within 3 BC-percentage-points of each other
        if (!signAgrees || !magnitudeClose) gatePassed = false;
      }
    }
  }
  printSummaryTable(allRows);
  console.log();
  console.log(gatePassed
    ? '# Gate PASSED: donor and parametric noise modes agree closely enough — using parametric for the full sweep.'
    : '# Gate FAILED: donor and parametric noise modes diverge — using donor-bootstrap for the full sweep.');
  const sweepNoiseMode = gatePassed ? 'parametric' : 'donor';

  console.log();
  console.log(`# Full sweep (N=${fullN} per cell, noise mode: ${sweepNoiseMode})`);
  const sweepRows = [];
  for (const config of configs) {
    for (const targetRangeM of WINDOW_TARGET_RANGES_M) {
      const rng = mulberry32(42);
      const result = runTrials({ config, targetRangeM, noiseMode: sweepNoiseMode, donors, severityScaler, trialCount: fullN, rng });
      sweepRows.push(...rowsFor(config, targetRangeM, sweepNoiseMode, result));
    }
  }
  printSummaryTable(sweepRows);

  const csvPath = path.join(REPO_ROOT, 'tools/labradar-bc-validation/last-run.csv');
  const csvHeader = 'config,range_m,noise,method,bc_err_mean,bc_err_stdev,bc_err_max,extrap_err_mean,extrap_err_stdev\n';
  const csvBody = sweepRows.map((r) => r.join(',')).join('\n');
  fs.writeFileSync(csvPath, csvHeader + csvBody + '\n');
  console.log();
  console.log(`# CSV written to ${csvPath}`);
}

main();
