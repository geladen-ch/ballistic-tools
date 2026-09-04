import test from 'node:test';
import assert from 'node:assert/strict';
import {
  firstPrimes, isqrt, latticeSteps, mulberry32, LatticeSequence, boxMuller
} from '../src/engine/qrng.js';

const MASK64 = (1n << 64n) - 1n;

test('firstPrimes returns the primes, in order, starting at 2', () => {
  assert.deepEqual(firstPrimes(10), [2, 3, 5, 7, 11, 13, 17, 19, 23, 29]);
});

test('firstPrimes never yields a perfect square (which would be a dead dimension)', () => {
  // frac(sqrt(k)) === 0 for any perfect square k, freezing that coordinate at
  // its starting value forever. Using primes rules this out by construction —
  // this test pins that reasoning down rather than trusting it.
  for (const p of firstPrimes(40)) {
    const root = Math.round(Math.sqrt(p));
    assert.notEqual(root * root, p, `${p} is a perfect square`);
  }
});

test('isqrt returns the exact integer floor of the square root', () => {
  assert.equal(isqrt(0n), 0n);
  assert.equal(isqrt(1n), 1n);
  assert.equal(isqrt(15n), 3n);
  assert.equal(isqrt(16n), 4n);
  assert.equal(isqrt(17n), 4n);
  // Exactness at a size no double could represent: (2^80 + 1)^2 - 1 must
  // floor back to exactly 2^80, which a floating-point sqrt would round away.
  const big = (1n << 80n) + 1n;
  assert.equal(isqrt(big * big), big);
  assert.equal(isqrt(big * big - 1n), big - 1n);
});

test('isqrt rejects negative input', () => {
  assert.throws(() => isqrt(-1n), RangeError);
});

test('latticeSteps is exactly floor(frac(sqrt(p)) * 2^64)', () => {
  const { hi, lo, primes } = latticeSteps(8);
  for (let j = 0; j < primes.length; j++) {
    // Recomputed here by a deliberately different route than the
    // implementation's isqrt(p << 128n): scale first, then take the root of
    // the product, and subtract the integer part explicitly.
    const scaled = BigInt(primes[j]) << 128n;
    const expected = (isqrt(scaled) - (BigInt(Math.floor(Math.sqrt(primes[j]))) << 64n)) & MASK64;
    const actual = (BigInt(hi[j]) << 32n) | BigInt(lo[j]);
    assert.equal(actual, expected, `step for sqrt(${primes[j]})`);
  }
});

test('latticeSteps matches the known decimal expansion of frac(sqrt(2))', () => {
  const { hi, lo } = latticeSteps(1);
  const step = (BigInt(hi[0]) << 32n) | BigInt(lo[0]);
  // frac(sqrt(2)) = 0.41421356237309504880...
  const asFraction = Number(step) / 2 ** 64;
  assert.ok(Math.abs(asFraction - 0.4142135623730950) < 1e-15, `got ${asFraction}`);
});

test('the lattice accumulates with no drift: state after n steps is exactly (n * step) mod 2^64', () => {
  // This is the whole reason the state is a pair of Uint32 rather than a
  // double. A `x = (x + alpha) % 1` implementation in floating point rounds
  // on every step and accumulates error linearly; integer addition that wraps
  // is exact modular arithmetic and stays correct indefinitely.
  const dimensions = 4;
  const steps = latticeSteps(dimensions);
  const zeroShift = () => 0; // start at the origin so state === n * step
  const lattice = new LatticeSequence(dimensions, steps, zeroShift);
  const out = new Float64Array(dimensions);

  const n = 100000;
  for (let i = 0; i < n; i++) lattice.next(out);

  for (let j = 0; j < dimensions; j++) {
    const step = (BigInt(steps.hi[j]) << 32n) | BigInt(steps.lo[j]);
    const expected = (BigInt(n) * step) & MASK64;
    const actual = (BigInt(lattice.hi[j]) << 32n) | BigInt(lattice.lo[j]);
    assert.equal(actual, expected, `dimension ${j} drifted after ${n} steps`);
  }
});

test('lattice coordinates all lie strictly inside (0, 1)', () => {
  const dimensions = 6;
  const lattice = new LatticeSequence(dimensions, latticeSteps(dimensions), mulberry32(7));
  const out = new Float64Array(dimensions);
  for (let i = 0; i < 20000; i++) {
    lattice.next(out);
    for (let j = 0; j < dimensions; j++) {
      assert.ok(out[j] > 0 && out[j] < 1, `coordinate ${out[j]} out of range`);
    }
  }
});

test('a one-dimensional lattice fills the unit interval evenly', () => {
  // frac(n * sqrt(2)) is equidistributed, and sqrt(2) is badly approximable
  // (its continued fraction is [1;2,2,2,...]), so the discrepancy is about as
  // low as a single irrational can give. 10 equal bins over 10000 points
  // should each hold very close to a tenth of them.
  const lattice = new LatticeSequence(1, latticeSteps(1), () => 0);
  const out = new Float64Array(1);
  const bins = new Array(10).fill(0);
  const n = 10000;
  for (let i = 0; i < n; i++) {
    lattice.next(out);
    bins[Math.min(9, Math.floor(out[0] * 10))]++;
  }
  for (const count of bins) {
    assert.ok(Math.abs(count - n / 10) < 5, `bin count ${count} too far from ${n / 10}`);
  }
});

test('boxMuller turns lattice points into standard normals', () => {
  const lattice = new LatticeSequence(2, latticeSteps(2), mulberry32(11));
  const u = new Float64Array(2);
  const z = new Float64Array(2);
  let n = 0, sum = 0, sumSq = 0;
  for (let i = 0; i < 200000; i++) {
    lattice.next(u);
    boxMuller(u[0], u[1], z);
    for (const value of z) { n++; sum += value; sumSq += value * value; }
  }
  const mean = sum / n;
  const variance = sumSq / n - mean * mean;
  assert.ok(Math.abs(mean) < 0.005, `mean ${mean} should be ~0`);
  assert.ok(Math.abs(variance - 1) < 0.005, `variance ${variance} should be ~1`);
});

test('mulberry32 is deterministic for a given seed and differs between seeds', () => {
  const a = mulberry32(42), b = mulberry32(42), c = mulberry32(43);
  const fromA = [a(), a(), a()];
  const fromB = [b(), b(), b()];
  const fromC = [c(), c(), c()];
  assert.deepEqual(fromA, fromB);
  assert.notDeepEqual(fromA, fromC);
  for (const value of fromA) assert.ok(Number.isInteger(value) && value >= 0 && value <= 0xffffffff);
});
