// Quasi-random number generation for the Monte-Carlo hit-probability path.
//
// This is a rank-1 lattice (a "Richtmyer" or additive sequence): point n of
// dimension j is simply frac(n * alpha_j), for a fixed irrational alpha_j.
// Unlike a plain PRNG its points are deliberately *not* independent — they
// spread out to fill the cube far more evenly, so an average over them
// converges much faster than the 1/sqrt(N) of ordinary Monte Carlo. Unlike a
// Sobol sequence it needs no direction-number tables to ship, which matters
// for a no-build-step app: the whole generator is the two files' worth of
// arithmetic below.
//
// Two implementation choices are load-bearing, and both are about exactness:
//
//   1. alpha_j = frac(sqrt(p_j)) over the primes 2, 3, 5, 7, ... Square roots
//      of distinct primes are linearly independent over the rationals, so no
//      exact linear relation can exist between any of them — which is what
//      stops the lattice from collapsing onto a few hyperplanes. (Sequences
//      whose alphas are algebraically linked to each other, such as the
//      "generalized golden ratio" alpha_j = g^-j, do not have this property
//      and can degenerate badly in higher dimensions.) The primes must be
//      primes rather than consecutive integers for a second reason too: any
//      perfect square would give frac(sqrt(k)) === 0 and a permanently dead
//      dimension.
//
//   2. Everything is 64-bit integer arithmetic, never floating point. The
//      obvious implementation, `x = (x + alpha) % 1` in doubles, rounds on
//      every single step and those errors accumulate linearly — measurably
//      drifting off the true frac(n * alpha) by ~1e-10 after a few million
//      points. Adding 64-bit integers and letting them wrap is *exact*
//      modular arithmetic: frac(n * alpha) stays correct forever. JS has no
//      uint64, so each dimension's state is a (hi, lo) pair of Uint32 with
//      an explicit carry.
//
// The alphas themselves are likewise computed exactly, via a BigInt integer
// square root at setup time (not in any hot loop) — see latticeSteps().

const MASK64 = (1n << 64n) - 1n;
const MASK32 = 0xffffffffn;
const TWO_POW_M32 = 2 ** -32;
const TWO_POW_M64 = 2 ** -64;

// Smallest positive value a lattice coordinate is allowed to take. A
// coordinate of exactly 0 would make Box-Muller's log(u) infinite. It can
// only happen if a dimension's whole 64-bit state lands on zero — odds about
// 1 in 1.8e19 per draw — but the guard costs one comparison and removes the
// possibility entirely rather than leaving a NaN to surface somewhere else.
const MIN_U = TWO_POW_M64;

// The first `count` primes, by trial division against the primes already
// found. Called once per lattice setup with a small count (one dimension per
// sampled quantity), so a sieve would be more machinery than it's worth.
export function firstPrimes(count) {
  const out = [];
  for (let n = 2; out.length < count; n++) {
    let isPrime = true;
    for (const p of out) {
      if (p * p > n) break;
      if (n % p === 0) { isPrime = false; break; }
    }
    if (isPrime) out.push(n);
  }
  return out;
}

// floor(sqrt(n)) for a BigInt, by Newton's method. Starting from a power of
// two at or above the true root, the iteration decreases monotonically and
// stops exactly at the floor — the standard integer-sqrt descent, with no
// floating point anywhere so it stays exact at any size.
export function isqrt(n) {
  if (n < 0n) throw new RangeError('isqrt: negative input');
  if (n < 2n) return n;
  let x = 1n << BigInt((n.toString(2).length + 1) >> 1);
  for (;;) {
    const next = (x + n / x) >> 1n;
    if (next >= x) return x;
    x = next;
  }
}

// The lattice's per-dimension step, as an exact 64-bit fixed-point fraction:
// step_j = floor(frac(sqrt(p_j)) * 2^64).
//
// Derivation of the one-liner: sqrt(p) * 2^64 === sqrt(p * 2^128), so
// isqrt(p << 128n) is floor(sqrt(p) * 2^64) exactly, in integers. Masking to
// 64 bits discards the integer part of sqrt(p) and keeps the fraction, which
// is all a mod-1 lattice uses. No double ever holds the root, so there is no
// rounding to inherit.
export function latticeSteps(dimensions) {
  const primes = firstPrimes(dimensions);
  const hi = new Uint32Array(dimensions);
  const lo = new Uint32Array(dimensions);
  for (let j = 0; j < dimensions; j++) {
    const step = isqrt(BigInt(primes[j]) << 128n) & MASK64;
    hi[j] = Number(step >> 32n) >>> 0;
    lo[j] = Number(step & MASK32) >>> 0;
  }
  return { hi, lo, primes };
}

// mulberry32 — a tiny, fast, well-distributed 32-bit PRNG. Used *only* to
// pick each replicate's random shift (see below), never to generate the
// sample points themselves, so its statistical quality only has to be good
// enough to decorrelate the replicates from each other. Seeded explicitly so
// every result in this app is reproducible.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0);
  };
}

// A lattice sequence over `dimensions` coordinates, shifted by a random
// offset.
//
// The shift is what makes this usable as an *estimator* rather than just a
// fixed grid. A raw lattice is deterministic: run it twice and you get the
// same answer, with a bias you cannot see or bound. Adding a uniform random
// offset to every coordinate (mod 1) leaves each individual point uniformly
// distributed, so the average over the shifted lattice is an unbiased
// estimate of the integral — while the points still keep their even spacing
// relative to each other. Averaging several independently shifted copies
// then gives both the estimate and, from their spread, an honest error bar.
// That is the only error bar this method has: unlike plain Monte Carlo you
// cannot get one from the sample variance of the points, because they are
// not independent.
export class LatticeSequence {
  constructor(dimensions, steps, rng) {
    this.dimensions = dimensions;
    this.stepHi = steps.hi;
    this.stepLo = steps.lo;
    this.hi = new Uint32Array(dimensions);
    this.lo = new Uint32Array(dimensions);
    for (let j = 0; j < dimensions; j++) {
      this.hi[j] = rng() >>> 0;
      this.lo[j] = rng() >>> 0;
    }
  }

  // Advances one point and writes its coordinates into `out` (length >=
  // dimensions). Each dimension is a 64-bit add that wraps — the wrap *is*
  // the "mod 1", performed exactly.
  next(out) {
    const { dimensions, hi, lo, stepHi, stepLo } = this;
    for (let j = 0; j < dimensions; j++) {
      const sumLo = (lo[j] + stepLo[j]) >>> 0;
      // Unsigned overflow happened iff the truncated sum came out below
      // either addend.
      const carry = sumLo < lo[j] ? 1 : 0;
      lo[j] = sumLo;
      hi[j] = (hi[j] + stepHi[j] + carry) >>> 0;
      const u = hi[j] * TWO_POW_M32 + lo[j] * TWO_POW_M64;
      out[j] = u > 0 ? u : MIN_U;
    }
    return out;
  }
}

// Box-Muller: turns two independent uniforms on (0,1) into two independent
// standard normals, via the polar form r = sqrt(-2 ln u), theta = 2 pi v.
// Kept in preference to an inverse-normal-CDF mapping for three reasons:
// it has a direct geometric reading here (r and theta are literally the
// polar coordinates of the impact point about the aim point), JS has no
// erfinv to build the alternative from, and it is measurably faster since
// log/sqrt/cos/sin are all single library calls.
export function boxMuller(u, v, out) {
  const r = Math.sqrt(-2 * Math.log(u));
  const theta = 2 * Math.PI * v;
  out[0] = r * Math.cos(theta);
  out[1] = r * Math.sin(theta);
  return out;
}
