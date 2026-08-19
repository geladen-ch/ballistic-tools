import test from 'node:test';
import assert from 'node:assert/strict';
import { weightedLinearFit, fitVelocityModel, rSquared, cleanTrack } from '../src/engine/labradar-clean.js';

// Builds a synthetic track: points[0] (always excluded from fit/R^2 and
// from the worst-point search — the device's own calculated, not
// measured, t=0 point), then points 1..n-2 on a clean line, then a last
// point (real data, eligible for trimming, but excluded from fit/R^2).
// `overrides` lets a test bump specific point velocities off the line.
function makeLinePoints(n, m, b, overrides = {}) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const t = i * 0.01;
    const v = overrides[i] !== undefined ? overrides[i] : m * t + b;
    const snr = i === 0 ? 0 : 20; // point 0 has no real SNR, matching real tracks
    const a = snr ? Math.pow(10, snr / 10) : 0;
    pts.push({ t, v, dist: 0, snr, a });
  }
  return pts;
}

test('weightedLinearFit recovers an exact line, ignoring point 0 and the last point', () => {
  // Points 0 and "last" are wildly off the line; only 1..length-2 matter.
  const pts = makeLinePoints(6, 2, 10, { 0: 9999, 5: -9999 });
  const { m, b } = weightedLinearFit(pts);
  assert.ok(Math.abs(m - 2) < 1e-9, `m=${m}`);
  assert.ok(Math.abs(b - 10) < 1e-9, `b=${b}`);
});

test('fitVelocityModel includes the last point (unlike weightedLinearFit)', () => {
  const clean = makeLinePoints(6, 2, 10);
  const withBadTail = makeLinePoints(6, 2, 10, { 5: 999 });

  const cleanModel = fitVelocityModel(clean);
  assert.ok(Math.abs(cleanModel.m - 2) < 1e-9);
  assert.ok(Math.abs(cleanModel.b - 10) < 1e-9);

  const skewedModel = fitVelocityModel(withBadTail);
  assert.notEqual(skewedModel.m.toFixed(6), cleanModel.m.toFixed(6), 'a bad last point should skew fitVelocityModel');

  // weightedLinearFit, by contrast, must be unaffected by the same bad
  // last point — it never looks at it.
  const wlrClean = weightedLinearFit(clean);
  const wlrBadTail = weightedLinearFit(withBadTail);
  assert.equal(wlrClean.m.toFixed(9), wlrBadTail.m.toFixed(9));
  assert.equal(wlrClean.b.toFixed(9), wlrBadTail.b.toFixed(9));
});

test('rSquared is 1 for a perfect fit over its own range, unaffected by a bad point 0 or last point', () => {
  const pts = makeLinePoints(8, 3, 5, { 0: -500, 7: 500 });
  const model = weightedLinearFit(pts);
  const r2 = rSquared(pts, model);
  assert.ok(Math.abs(r2 - 1) < 1e-9, `r2=${r2}`);
});

test('cleanTrack removes injected outliers and keeps the rest, with a high resulting R^2', () => {
  const n = 20;
  const pts = makeLinePoints(n, -2, 100, { 5: 40, 12: 160 }); // two clear outliers among the clean trend
  const { kept, discarded, r2 } = cleanTrack(pts, { minLeft: 10, r2Threshold: 0.97 });

  assert.equal(kept.length + discarded.length, n);
  const discardedIdx = discarded.map((p) => pts.indexOf(p)).sort((a, b) => a - b);
  assert.deepEqual(discardedIdx, [5, 12], `expected only the injected outliers discarded, got indices ${discardedIdx}`);
  assert.ok(r2 > 0.97, `r2=${r2}`);
});

test('cleanTrack: a lone bad last point gets removed then immediately restored, since the fit range never saw it as a problem', () => {
  // Surprising but faithful (matches legacy exactly): the fit/R^2 range
  // excludes the last point entirely, so if it's the ONLY thing wrong,
  // the very first step's R^2 (computed before removing anything) is
  // already the best achievable — the restore pass's very first check
  // (r2/r2Best === 1) always passes, so everything discarded so far,
  // including this point, is pushed straight back on.
  const n = 15;
  const pts = makeLinePoints(n, 1, 50, { [n - 1]: 5000 });
  const { kept, discarded } = cleanTrack(pts, { minLeft: 10, r2Threshold: 0.97 });
  assert.equal(discarded.length, 0, 'a lone bad last point should end up restored, not permanently trimmed');
  assert.equal(kept.length, n);
});

test('cleanTrack: a bad last point CAN be permanently trimmed when it coincides with a genuine fit-range problem', () => {
  // Here the fit range (excludes point 0 and the last point) has its own
  // outlier at index 8, so R^2 only reaches its best once that's
  // removed too — meaning the step at which the even-worse last point
  // gets trimmed doesn't yet qualify for restoration.
  const n = 20;
  const pts = makeLinePoints(n, 1, 50, { 8: 80, [n - 1]: 200 });
  const { kept, discarded, r2 } = cleanTrack(pts, { minLeft: 10, r2Threshold: 0.97 });
  const discardedIdx = discarded.map((p) => pts.indexOf(p)).sort((a, b) => a - b);
  assert.deepEqual(discardedIdx, [8, n - 1]);
  assert.equal(kept.length, n - 2);
  assert.ok(r2 > 0.97, `r2=${r2}`);
});

test('cleanTrack: temporarily-discarded points are restored once the algorithm rolls back past a good-enough step, not just the single most recent removal', () => {
  // A clean trend with two real outliers. The trim loop removes the two
  // outliers first (they're always "worst"), then keeps trimming
  // legitimate, on-trend points down toward the floor since it always
  // trims to the floor unconditionally — the restore pass afterward must
  // bring all of those legitimate points back, not just stop after
  // undoing one removal.
  const n = 20;
  const pts = makeLinePoints(n, 5, 200, { 3: -1000, 16: 1000 });
  const { kept, discarded } = cleanTrack(pts, { minLeft: 10, r2Threshold: 0.97 });

  // Only the two genuine outliers should still be missing — every
  // legitimate on-trend point removed along the way back down to the
  // floor must have been restored.
  assert.equal(kept.length, n - 2);
  const discardedIdx = discarded.map((p) => pts.indexOf(p)).sort((a, b) => a - b);
  assert.deepEqual(discardedIdx, [3, 16]);
});

test('cleanTrack: the trim-to-floor loop can remove one point past minLeft (do/while checks after the splice) when nothing ever restores', () => {
  // r2Threshold above 1 can never be satisfied (r2/r2Best maxes out at
  // exactly 1), so the restore pass runs out of steps without ever
  // pushing anything back — kept bottoms out at minLeft - 1, not
  // minLeft. This is a faithfully-preserved legacy accident (see
  // labradar-clean.js's own comment), not a bug to silently "fix" here.
  const n = 30;
  const pts = makeLinePoints(n, 1, 0);
  const { kept } = cleanTrack(pts, { minLeft: 10, r2Threshold: 1.5 });
  assert.equal(kept.length, 9);
});

test('cleanTrack: minLeft is floored at 10 even if a smaller value is requested', () => {
  const n = 30;
  const pts = makeLinePoints(n, 1, 0);
  const { kept } = cleanTrack(pts, { minLeft: 2, r2Threshold: 1.5 });
  assert.equal(kept.length, 9); // 10 - 1, same floor as the default
});

test('cleanTrack: kept is re-sorted by time', () => {
  const n = 12;
  const pts = makeLinePoints(n, 1, 0);
  const shuffled = [pts[0], ...pts.slice(1).reverse()];
  const { kept } = cleanTrack(shuffled, { minLeft: 10, r2Threshold: 0.97 });
  for (let i = 1; i < kept.length; i++) {
    assert.ok(kept[i].t >= kept[i - 1].t, 'kept must be sorted ascending by time');
  }
});
