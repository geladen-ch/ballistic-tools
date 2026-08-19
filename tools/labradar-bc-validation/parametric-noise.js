// Parametric approximation of the real per-time-fraction noise shape
// measured from donor-corpus.js's real bulk corpus (see the "Noise
// model" table in the plan this tool implements: tight/symmetric on
// high-SNR early samples, growing into a heavy, one-sided
// velocity-overestimating tail toward the end of the track). Modeled as
// a two-piece ("split") normal — one location, a separate scale on each
// side of it — since a single symmetric stdev can't represent a shape
// that's genuinely symmetric early and genuinely skewed late. This is an
// approximation to be validated against the donor-bootstrap mode's own
// results, not trusted outright — see run-experiment.js's
// cross-validation gate.
//
// Knots are fit directly to the measured table at each decile's center
// (tFrac = 0.05, 0.15, ..., 0.95): location = p50 (the two-piece
// normal's median coincides with its location parameter exactly), and
// each side's scale from that side's own spread — sigma = (quantile -
// median) / 1.645, loosely borrowing the normal distribution's own
// 95th-percentile z-score as a per-side scale estimator (a convenient
// approximation, not a rigorous two-piece-normal quantile fit — the
// real test is the cross-validation gate, not how tightly this
// reproduces the table). Linearly interpolated between knots, clamped
// at the ends, for a smooth function of any tFrac in [0,1].
const KNOTS = [
  { tFrac: 0.05, location: 0.01, sigmaL: 0.4195, sigmaR: 0.3891 },
  { tFrac: 0.15, location: 0.01, sigmaL: 0.5471, sigmaR: 0.4802 },
  { tFrac: 0.25, location: -0.03, sigmaL: 0.6809, sigmaR: 0.7052 },
  { tFrac: 0.35, location: -0.03, sigmaL: 0.9909, sigmaR: 1.1672 },
  { tFrac: 0.45, location: 0.01, sigmaL: 1.2645, sigmaR: 1.8906 },
  { tFrac: 0.55, location: 0.12, sigmaL: 1.6231, sigmaR: 3.3860 },
  { tFrac: 0.65, location: 0.28, sigmaL: 1.9088, sigmaR: 9.4225 },
  { tFrac: 0.75, location: 0.62, sigmaL: 2.3830, sigmaR: 16.665 },
  { tFrac: 0.85, location: 1.18, sigmaL: 3.1307, sigmaR: 22.977 },
  { tFrac: 0.95, location: 3.44, sigmaL: 4.2917, sigmaR: 29.556 }
];

function interpolateParams(tFrac) {
  const t = Math.min(1, Math.max(0, tFrac));
  if (t <= KNOTS[0].tFrac) return KNOTS[0];
  if (t >= KNOTS[KNOTS.length - 1].tFrac) return KNOTS[KNOTS.length - 1];
  for (let i = 0; i < KNOTS.length - 1; i++) {
    const a = KNOTS[i], b = KNOTS[i + 1];
    if (t >= a.tFrac && t <= b.tFrac) {
      const frac = (t - a.tFrac) / (b.tFrac - a.tFrac);
      return {
        location: a.location + frac * (b.location - a.location),
        sigmaL: a.sigmaL + frac * (b.sigmaL - a.sigmaL),
        sigmaR: a.sigmaR + frac * (b.sigmaR - a.sigmaR)
      };
    }
  }
  return KNOTS[KNOTS.length - 1]; // unreachable given the clamps above
}

function standardNormal(rng) {
  // Box-Muller — only the deterministic-formula half (one output per two
  // draws, not the paired sin/cos form) since a single value per call is
  // all sampleResidual needs.
  let u1 = 0;
  while (u1 === 0) u1 = rng(); // avoid log(0)
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

// residual(tFrac) — ignores `snr`, since the fitted shape is already
// indexed by time-fraction (which is itself what drives real SNR
// falloff — see the Noise model table); accepted for interface parity
// with donor-corpus.js's own per-sample shape, not used here.
export function sampleResidual(tFrac, snr, rng = Math.random) {
  const { location, sigmaL, sigmaR } = interpolateParams(tFrac);
  const absZ = Math.abs(standardNormal(rng));
  // Fixed 50/50 mixing (not the density-continuity-weighted
  // sigmaL/(sigmaL+sigmaR) convention) is what makes `location` land
  // exactly on the median and the knot-fitting formula above (sigma =
  // (quantile - median) / 1.645) self-consistent — with unequal
  // sigmaL/sigmaR, the density-weighted convention would pull the
  // median away from `location` toward whichever side has the larger
  // scale.
  const onLeft = rng() < 0.5;
  return onLeft ? location - absZ * sigmaL : location + absZ * sigmaR;
}

// Resamples a per-trial severity scalar from the corpus's own discard-
// count distribution (see donor-corpus.js's discardCountDistribution)
// and turns it into a multiplier on the noise scale — 0 discards (55%
// of real tracks) maps to a mild multiplier, the long tail of bad
// sessions (dozens of discards) maps to a much larger one. Scaled by
// the corpus's own median-of-nonzero discard count so the multiplier is
// self-calibrating rather than hand-tuned.
export function makeSeverityScaler(discardCounts) {
  const nonZero = discardCounts.filter((c) => c > 0).sort((a, b) => a - b);
  const referenceCount = nonZero.length ? nonZero[Math.floor(nonZero.length / 2)] : 1;
  return (rng = Math.random) => {
    const count = discardCounts[Math.floor(rng() * discardCounts.length)];
    return 0.4 + 0.6 * (count / referenceCount);
  };
}

export function residualAtWithSeverity(severityMultiplier) {
  return (tFrac, snr, rng = Math.random) => sampleResidual(tFrac, snr, rng) * severityMultiplier;
}
