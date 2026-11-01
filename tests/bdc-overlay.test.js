import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BDC_WIND_FRACTIONS, BDC_WIND_SIDES, isMajorWindFraction, referenceWindSpeed, bdcLevels, holdTable,
  rangeForElevation, holdXAt, bdcOverlay, withReferenceWind
} from '../src/reticle/bdc-overlay.js';
import { integrate, computeImpact } from '../src/engine/trajectory.js';
import { degToRad, linearToAngleAtRange, mradToRad } from '../src/quantity.js';

const STATE = {
  muzzleVelocity: 840, bc: 0.475, dragModel: 'G1', zeroRange: 100, sightHeightM: 0.05,
  windSpeed: 0, windAngleRad: degToRad(90), tempC: 15, pressurePa: 101325, altitudeM: 0, humidity: 0,
  maxRange: 1500, rangeStep: 5
};
const tableFor = (overrides = {}) => holdTable(integrate({ ...STATE, ...overrides }).points);
const near = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol, `${what}: ${a} vs ${b}`);

test('the reference wind is a round number in the user\'s unit; quarters up to one and a half times it, the reference major', () => {
  assert.equal(referenceWindSpeed('m/s'), 4);
  assert.equal(referenceWindSpeed('mph'), 10);
  assert.equal(referenceWindSpeed('km/h'), 10);
  assert.equal(referenceWindSpeed('ft/s'), 10);
  assert.equal(referenceWindSpeed('furlongs/fortnight'), 4);
  assert.deepEqual(BDC_WIND_FRACTIONS, [0.25, 0.5, 0.75, 1, 1.25, 1.5]);
  assert.deepEqual(BDC_WIND_FRACTIONS.filter(isMajorWindFraction), [1]);
  assert.deepEqual(BDC_WIND_SIDES, [1, -1]);
});

test('the BDC levels are the marks\' y, top to bottom, each once, nothing else', () => {
  const levels = bdcLevels([
    { type: 'bdc', x: 0, y: 0.004 }, { type: 'dot', x: 0, y: 0.001 }, { type: 'bdc', x: 0, y: 0 }, { type: 'bdc', x: 0, y: 0.004 }
  ]);
  assert.deepEqual(levels, [0, 0.004]);
  assert.deepEqual(bdcLevels(undefined), []);
});

test('a hold table leaves out the muzzle and turns drop and drift round into holds', () => {
  const table = holdTable([
    { range: 0, dropM: -0.05, windageM: 0 },
    { range: 100, dropM: -0.1, windageM: 0.02 }
  ]);
  assert.deepEqual(table.range, [100]);
  near(table.elevation[0], 0.001, 1e-12, 'elevation');
  near(table.x[0], -0.0002, 1e-12, 'x');
  assert.equal(holdXAt(table, 100, 'xPerWind'), null, 'no crosswind drift without a reference flight');
});

test('the crosswind drift per m/s is the difference from the reference flight', () => {
  const still = { range: [100, 200], elevation: [0, 0.001], x: [0.0001, 0.0002] };
  const reference = { range: [100, 200], elevation: [0, 0.001], x: [-0.0003, -0.0006] };
  const table = withReferenceWind(still, reference, 4);
  near(table.xPerWind[0], -0.0001, 1e-12, '100 m');
  near(table.xPerWind[1], -0.0002, 1e-12, '200 m');
  assert.equal(still.xPerWind, undefined, 'the table handed in is left as it is');
});

const SPIN = { massKg: 0.0109, caliberM: 0.00782, lengthM: 0.0311, riflingTwistM: 0.254, twistDirection: 'right', calculateSpinDrift: true };
// A wind from its parts, as bdc-trajectories.js builds it.
const windOf = (headwind, crosswind) => ({ windSpeed: Math.hypot(headwind, crosswind), windAngleRad: Math.atan2(crosswind, headwind) });
// The worst gap (rad) between the overlay's crosswind holds and a full
// solve with that crosswind added to the head- or tailwind.
function worstWindGap(state, headwind, still, ranges) {
  let worst = 0;
  for (const rangeM of ranges) {
    const [row] = bdcOverlay({ levels: [0], still, referenceSpeed: 4, dialedElevationRad: -linearToAngleAtRange(computeImpact({ ...state, ...windOf(headwind, 0) }, rangeM).dropM, rangeM) });
    near(row.rangeM, rangeM, 0.5, 'the row\'s range');
    for (const wind of row.winds) {
      const exact = computeImpact({ ...state, ...windOf(headwind, wind.side * wind.fraction * 4) }, row.rangeM);
      worst = Math.max(worst, Math.abs(wind.x + linearToAngleAtRange(exact.windageM, row.rangeM)));
    }
  }
  return worst;
}

for (const mode of ['off', 'litz', 'mccoy4dof']) {
  test(`the crosswind holds scaled and mirrored from the reference flight match full solves (${mode} spin drift), with a head- or tailwind too`, () => {
    const state = { ...STATE, ...SPIN, spinDriftMode: mode };
    for (const headwind of [0, 5, -5]) {
      const still = holdTable(integrate({ ...state, ...windOf(headwind, 0) }).points);
      const reference = holdTable(integrate({ ...state, ...windOf(headwind, 4) }).points);
      const worst = worstWindGap(state, headwind, withReferenceWind(still, reference, 4), [300, 800, 1200]);
      assert.ok(worst < mradToRad(0.002), `${headwind} m/s: ${worst}`);
    }
  });
}

test('a mark holds for the far side of the trajectory: the zero for the centre, longer below it', () => {
  const still = tableFor();
  near(rangeForElevation(still, 0), 100, 0.5, 'centre');
  const r = rangeForElevation(still, mradToRad(5));
  assert.ok(r > 400 && r < 1000, String(r));
  const impact = computeImpact(STATE, r);
  near(-linearToAngleAtRange(impact.dropM, r), mradToRad(5), mradToRad(0.01), 'the elevation at that range');
  assert.equal(rangeForElevation(still, mradToRad(-5)), null, 'never that high above the sight line');
  assert.equal(rangeForElevation(still, mradToRad(500)), null, 'past the table');
});

test('the hold across is interpolated within the table, null outside it', () => {
  const table = { range: [100, 200], elevation: [0, 0.001], x: [0, 0.002] };
  assert.equal(holdXAt(table, 150), 0.001);
  assert.equal(holdXAt(table, 100), 0);
  assert.equal(holdXAt(table, 200), 0.002);
  assert.equal(holdXAt(table, 99), null);
  assert.equal(holdXAt(table, 201), null);
});

test('the overlay\'s rows: range, spin drift across, and the crosswind holds from either side', () => {
  const spin = { ...SPIN, spinDriftMode: 'litz' };
  const still = withReferenceWind(tableFor(spin), tableFor({ ...spin, windSpeed: 4, windAngleRad: degToRad(90) }), 4);
  const rows = bdcOverlay({ levels: [0, mradToRad(4), mradToRad(400)], still, referenceSpeed: 4 });
  assert.equal(rows.length, 2, 'a level past the table is left out');
  const row = rows[1];
  const impact = computeImpact({ ...STATE, ...spin }, row.rangeM);
  near(row.x, -linearToAngleAtRange(impact.windageM, row.rangeM), 1e-6, 'the mark moved by spin drift');
  assert.ok(Math.abs(row.x) > 1e-5, 'spin drift is there');
  assert.equal(row.winds.length, 12);
  const reference = row.winds.find((w) => w.fraction === 1 && w.side === 1);
  assert.equal(reference.major, true);
  const windImpact = computeImpact({ ...STATE, ...spin, windSpeed: 4, windAngleRad: degToRad(90) }, row.rangeM);
  near(reference.x, -linearToAngleAtRange(windImpact.windageM, row.rangeM), 2e-6, 'the reference crosswind\'s hold');
  const fromLeft = row.winds.find((w) => w.fraction === 1 && w.side === -1);
  assert.ok(Math.sign(reference.x - row.x) === -Math.sign(fromLeft.x - row.x), 'either side of the mark');
  assert.equal(row.winds.find((w) => w.fraction === 0.25).major, false);
  assert.deepEqual(bdcOverlay({ levels: [0], still: tableFor() , referenceSpeed: 4 })[0].winds, [], 'no crosswind drift, no wind holds');
});

test('dialed: the centre holds for the dialed range, the marks for that elevation plus their own; SFP scales the marks', () => {
  const still = tableFor();
  const dialed = -linearToAngleAtRange(computeImpact(STATE, 600).dropM, 600);
  const [centre, below] = bdcOverlay({ levels: [0, mradToRad(2)], still, dialedElevationRad: dialed });
  near(centre.rangeM, 600, 0.5, 'centre');
  near(below.rangeM, rangeForElevation(still, dialed + mradToRad(2)), 1e-9, 'below');
  const [, scaled] = bdcOverlay({ levels: [0, mradToRad(2)], still, factor: 2 });
  near(scaled.rangeM, rangeForElevation(still, mradToRad(4)), 1e-9, 'SFP');
});
