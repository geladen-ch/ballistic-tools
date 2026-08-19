// Extracts real noise "donor" tracks from a local, gitignored bulk export
// of Labradar sessions (data/labradar.track/bulk/ — not part of this repo,
// supplied locally; see the "Noise model" section of the plan this tool
// implements). Each donor contributes its own (timeFraction, residual)
// sequence plus its own point-timing/SNR pattern, so synthetic-track.js's
// `donor` noise mode can transplant a real track's actual noise behavior
// onto a different (known-BC) true trajectory, rather than sampling from
// any invented distribution.
//
// The reference line each donor's residuals are measured against is fit
// to ONLY the first 30% of that donor's own time window — deliberately
// far from any tail contamination. An earlier pass that used the
// cleaning-purpose whole-track model (src/engine/labradar-clean.js's
// weightedLinearFit) showed a spurious "early points lean negative"
// artifact that disappeared entirely once the reference was
// tail-uncontaminated — confirmed as a fitting artifact, not real
// high-SNR noise, before this shape was trusted enough to build on.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import { parseLabradarTrack } from '../../src/labradar/track-parse.js';
import { cleanTrack } from '../../src/engine/labradar-clean.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DEFAULT_BULK_DIR = path.join(REPO_ROOT, 'data/labradar.track/bulk');
const MIN_DONOR_POINTS = 20;
const EARLY_WINDOW_FRACTION = 0.3;
const MIN_EARLY_POINTS = 5;

function walk(dir, exts, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, exts, out);
    else if (exts.some((ext) => entry.name.toLowerCase().endsWith(ext))) out.push(full);
  }
}

function listZipCsvEntries(zipPath) {
  try {
    return execFileSync('unzip', ['-Z1', zipPath]).toString().split('\n').filter((f) => f.toLowerCase().endsWith('.csv'));
  } catch {
    return [];
  }
}

function readZipEntry(zipPath, entry) {
  try {
    return execFileSync('unzip', ['-p', zipPath, entry], { maxBuffer: 1024 * 1024 * 20 }).toString('latin1');
  } catch {
    return null;
  }
}

// Weighted least-squares fit over an arbitrary point subset (not tied to
// labradar-clean.js's own length-based ranges, which fit specific
// index windows for cleaning/vM purposes — this fits whatever subset the
// caller passes, here always "the early portion of one donor track").
function weightedLinearFit(points) {
  let sumR = 0, sumX = 0, sumX2 = 0, sumY = 0, sumXY = 0;
  for (const p of points) {
    const r = p.a || 1, x = p.t, y = p.v;
    sumR += r; sumX += r * x; sumX2 += r * (x * x); sumY += r * y; sumXY += r * (x * y);
  }
  const denom = sumR * sumX2 - sumX * sumX;
  return { m: (sumR * sumXY - sumX * sumY) / denom, b: (sumY * sumX2 - sumX * sumXY) / denom };
}

function buildDonor(id, pts) {
  const t1 = pts[1].t;
  const tEnd = pts[pts.length - 1].t;
  const duration = tEnd - t1;
  if (duration <= 0) return null;

  const cutoffT = t1 + EARLY_WINDOW_FRACTION * duration;
  const early = pts.slice(1).filter((p) => p.t <= cutoffT);
  if (early.length < MIN_EARLY_POINTS) return null;
  const ref = weightedLinearFit(early);

  const samples = [];
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i];
    samples.push({
      tFrac: (p.t - t1) / duration,
      residual: p.v - (ref.m * p.t + ref.b),
      snr: p.snr
    });
  }

  const discardCount = cleanTrack(pts, { minLeft: 10, r2Threshold: 0.97 }).discarded.length;
  // t1Offset: how long after the device's own synthetic t=0 point
  // (pts[0]) this donor's first *real* sample (pts[1], tFrac=0 by
  // definition above) actually arrived — real tracks have a small but
  // nonzero gap here. Kept separately from `samples` so
  // synthetic-track.js can rescale it consistently with everything else
  // rather than collapsing it to 0 (which would put two points at the
  // same timestamp).
  return { id, duration, t1Offset: t1, samples, discardCount, pointCount: pts.length };
}

// Returns an array of donors: { id, duration, samples: [{tFrac, residual,
// snr}] (sorted by tFrac, one per donor point excluding the device's own
// synthetic pts[0]), discardCount, pointCount }. `root` overrides the
// default bulk directory (mainly for tests, which must never point this
// at the real gitignored data — see run-experiment.js's own tests, which
// build a tiny synthetic bulk dir instead).
export function loadDonorCorpus({ root = DEFAULT_BULK_DIR } = {}) {
  if (!fs.existsSync(root)) {
    throw new Error(
      `Donor corpus not found at ${root}. This directory is gitignored and local-only — ` +
      `the "donor" noise mode needs a real Labradar bulk export there. Use the ` +
      `"parametric" noise mode instead if it isn't available.`
    );
  }

  const looseCsvs = [];
  walk(root, ['.csv'], looseCsvs);
  const zips = [];
  walk(root, ['.zip'], zips);

  const seen = new Set();
  const donors = [];

  function consider(text, id) {
    if (!text) return;
    const hash = crypto.createHash('md5').update(text).digest('hex');
    if (seen.has(hash)) return;
    const pts = parseLabradarTrack(text);
    if (!pts || pts.length < MIN_DONOR_POINTS) return;
    seen.add(hash);
    const donor = buildDonor(id, pts);
    if (donor) donors.push(donor);
  }

  for (const f of looseCsvs) {
    let text;
    try { text = fs.readFileSync(f, 'latin1'); } catch { continue; }
    consider(text, f);
  }
  for (const zip of zips) {
    for (const entry of listZipCsvEntries(zip)) {
      consider(readZipEntry(zip, entry), `${zip}::${entry}`);
    }
  }

  if (donors.length === 0) {
    throw new Error(`No usable donor tracks found under ${root}.`);
  }
  return donors;
}

// The per-track discard counts alone — used by synthetic-track.js's
// `parametric` mode to resample a realistic per-trial severity scalar
// from the corpus's own empirical distribution (see "Diagnostic C" in
// the plan: most tracks have zero discards, a long tail have dozens).
export function discardCountDistribution(donors) {
  return donors.map((d) => d.discardCount);
}
