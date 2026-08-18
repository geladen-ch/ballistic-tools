import test from 'node:test';
import assert from 'node:assert/strict';
import { integrate, computeImpact, solveZeroAngle, solveHorizontalZeroAngle, makeStepper } from '../src/engine/trajectory.js';
import { displayToEngine, engineToDisplay } from '../src/units.js';
import { G7_TABLE } from '../src/engine/drag-tables.js';
import { LBIN2_TO_KGM2 } from '../src/engine/constants.js';
import { speedOfSound, temperatureAtHeightDelta } from '../src/engine/atmosphere.js';

const baseState = {
  muzzleVelocity: 840, bc: 0.475, dragModel: 'G1',
  maxRange: 1000, rangeStep: 100, zeroRange: 100, sightHeight: 50,
  windSpeed: 0, windAngle: 90,
  tempC: 15, pressureHpa: 1013.25, altitudeM: 0, humidityPct: 0
};

test('zero angle sends the trajectory through the sight line at zeroRange', () => {
  const launchAngle = solveZeroAngle(baseState);
  const impact = computeImpact({ ...baseState, launchAngle }, baseState.zeroRange);
  assert.ok(Math.abs(impact.dropCm) < 0.1, `drop at zero was ${impact.dropCm} cm`);
});

test('integrate produces monotonically increasing range samples', () => {
  const { points } = integrate(baseState);
  assert.ok(points.length > 5);
  for (let i = 1; i < points.length; i++) {
    assert.ok(points[i].range > points[i - 1].range);
  }
});

test('velocity decreases monotonically downrange (no wind)', () => {
  const { points } = integrate(baseState);
  for (let i = 1; i < points.length; i++) {
    assert.ok(points[i].velocity < points[i - 1].velocity);
  }
});

test('mach number matches velocity / speed of sound at that point\'s own (altitude-adjusted) temperature', () => {
  const { points } = integrate(baseState);
  for (const p of points) {
    assert.ok(Number.isFinite(p.mach));
    // losAngleDeg is 0 in baseState, so dropCm (perpendicular to the sight
    // line) and world-frame height gained since the muzzle are the same
    // thing — exactly the height delta the standard atmosphere model
    // applies the lapse rate to (see temperatureAtHeightDelta).
    const localTempC = temperatureAtHeightDelta(baseState.tempC, p.dropCm / 100);
    const speedSound = speedOfSound(localTempC);
    assert.ok(Math.abs(p.mach - p.velocity / speedSound) < 1e-9);
  }
});

test('bullet drops below the sight line well past the zero range', () => {
  const { points } = integrate({ ...baseState, maxRange: 600 });
  const last = points[points.length - 1];
  assert.ok(last.dropCm < 0);
});

test('a higher BC sheds less velocity over the same distance', () => {
  const lowBC = integrate({ ...baseState, bc: 0.3 });
  const highBC = integrate({ ...baseState, bc: 0.6 });
  const lastLow = lowBC.points[lowBC.points.length - 1];
  const lastHigh = highBC.points[highBC.points.length - 1];
  assert.ok(highBC.points.length === lowBC.points.length);
  assert.ok(lastHigh.velocity > lastLow.velocity);
});

test('rows land on exact multiples of rangeStep, starting at 0, ending at maxRange', () => {
  const { points } = integrate({ ...baseState, maxRange: 1000, rangeStep: 100 });
  assert.deepEqual(points.map((p) => p.range), [0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]);
});

test('a maxRange that is not an exact multiple of rangeStep still ends exactly at maxRange', () => {
  const { points } = integrate({ ...baseState, maxRange: 950, rangeStep: 300 });
  const ranges = points.map((p) => p.range);
  assert.deepEqual(ranges, [0, 300, 600, 900, 950]);
});

test('rangeStep larger than maxRange still returns exactly the 0 and maxRange rows', () => {
  const { points } = integrate({ ...baseState, maxRange: 50, rangeStep: 100 });
  assert.deepEqual(points.map((p) => p.range), [0, 50]);
});

test('a non-positive rangeStep degrades to just the 0 and maxRange rows instead of hanging', () => {
  const { points } = integrate({ ...baseState, maxRange: 300, rangeStep: 0 });
  assert.deepEqual(points.map((p) => p.range), [0, 300]);
});

test('BUG: Range column must match the step as entered, even under a non-metric distance preference', () => {
  // User has "yd" selected for the distance group and types "100" into
  // both maxRange and rangeStep, meaning 100 *yards* — this is exactly
  // the trajectory-view.js wiring: unitField converts the display value
  // (100 yd) to the engine unit (m) before it ever reaches integrate(),
  // and the view must convert engine range values back to yd for display.
  const maxRangeM = displayToEngine('maxRange', 100 * 9, 'yd'); // 900 yd
  const rangeStepM = displayToEngine('rangeStep', 100, 'yd');

  const { points } = integrate({ ...baseState, maxRange: maxRangeM, rangeStep: rangeStepM });
  const displayedRanges = points.map((p) => Math.round(engineToDisplay('range', p.range, 'yd')));

  assert.deepEqual(displayedRanges, [0, 100, 200, 300, 400, 500, 600, 700, 800, 900]);
});

test('the stepped table matches the unstepped physics at a shared range (interpolation is exact, not the nearest raw step)', () => {
  const { points } = integrate({ ...baseState, maxRange: 500, rangeStep: 500 });
  const atFiveHundred = points.find((p) => p.range === 500);
  const direct = computeImpact({ ...baseState, launchAngle: solveZeroAngle(baseState) }, 500);
  assert.ok(Math.abs(atFiveHundred.dropCm - direct.dropCm) < 1e-6);
  assert.ok(Math.abs(atFiveHundred.windageCm - direct.windageCm) < 1e-6);
});

test('BUG: zeroRange of 0 must not make the zero-angle solve diverge', () => {
  // Previously: heightErrorAt(theta) is constant in theta when zeroRange
  // is 0 (the integration loop never runs), so f1-f0 is always exactly 0
  // and the secant update divides by its near-zero fallback, producing a
  // huge, nonsensical angle instead of failing to converge gracefully.
  const angle = solveZeroAngle({ ...baseState, zeroRange: 0 });
  assert.equal(angle, 0);
  assert.ok(Number.isFinite(angle));
});

test('zeroRange of 0 (or below) is treated as "no elevation correction": fire level down the bore', () => {
  const { points, launchAngleDeg } = integrate({ ...baseState, maxRange: 300, rangeStep: 100, zeroRange: 0 });
  assert.equal(launchAngleDeg, 0);
  for (const p of points) assert.ok(Number.isFinite(p.dropCm) && Number.isFinite(p.velocity));

  // At the muzzle (range 0) the bore is sightHeight below the sight line,
  // with no compensation applied — drop should be exactly -sightHeight.
  assert.ok(Math.abs(points[0].dropCm - -baseState.sightHeight / 10) < 1e-6);
  // With no elevation and no wind, windage is exactly 0 throughout.
  for (const p of points) assert.equal(p.windageCm, 0);
  // Gravity is uncompensated, so drop only ever gets worse downrange.
  for (let i = 1; i < points.length; i++) assert.ok(points[i].dropCm < points[i - 1].dropCm);
});

test('a negative zeroRange degrades the same way as 0, rather than diverging', () => {
  const angle = solveZeroAngle({ ...baseState, zeroRange: -10 });
  assert.equal(angle, 0);
});

test('computeImpact with zeroRange 0 in state (no explicit launchAngle) stays finite', () => {
  const impact = computeImpact({ ...baseState, zeroRange: 0 }, 200);
  assert.ok(Number.isFinite(impact.dropCm));
  assert.ok(Number.isFinite(impact.velocity));
});

test('a library bullet\'s cdTable produces a finite, monotonically-decaying trajectory', () => {
  const { points } = integrate({
    ...baseState, bc: undefined, dragModel: undefined,
    cdTable: G7_TABLE, massKg: 0.01088622, caliberM: 0.0078232 // .308, 168gr
  });
  assert.ok(points.length > 2);
  for (const p of points) assert.ok(Number.isFinite(p.dropCm) && Number.isFinite(p.velocity));
  for (let i = 1; i < points.length; i++) assert.ok(points[i].velocity < points[i - 1].velocity);
});

test('a Cd-table bullet whose sectional density exactly matches a given BC reproduces the identical BC-based trajectory', () => {
  // The two drag paths are two different routes to the same physics: a
  // cdTable bullet's deceleration is rho*Cd*v^2/(2*(m/A)) from its own
  // actual mass/area, while the BC-based path (for a form factor of
  // exactly 1, i.e. this bullet behaves identically to the standard
  // curve) is (pi/8)*rho*Cd*v^2/BC. Equating the two gives the sectional
  // density this cdTable bullet needs: m/A = BC*LBIN2_TO_KGM2*(4/pi) — the
  // 4/pi accounts for BC's conventional d^2 denominator vs. this bullet's
  // actual A = pi*d^2/4 cross-sectional area. With that mass, feeding the
  // Cd table straight through must give bit-for-bit (well, float-for-
  // float) the same trajectory as the BC-based path drawing from the same
  // table.
  const targetBC = 0.5;
  const caliberM = 0.00782;
  const areaM2 = (Math.PI / 4) * caliberM * caliberM;
  const massKg = targetBC * LBIN2_TO_KGM2 * areaM2 * (4 / Math.PI);

  const bcBased = integrate({ ...baseState, bc: targetBC, dragModel: 'G7' });
  const cdTableBased = integrate({ ...baseState, bc: undefined, dragModel: undefined, cdTable: G7_TABLE, massKg, caliberM });

  assert.equal(bcBased.points.length, cdTableBased.points.length);
  for (let i = 0; i < bcBased.points.length; i++) {
    assert.ok(Math.abs(bcBased.points[i].dropCm - cdTableBased.points[i].dropCm) < 1e-6);
    assert.ok(Math.abs(bcBased.points[i].velocity - cdTableBased.points[i].velocity) < 1e-6);
  }
});

test('losAngleDeg omitted behaves identically to losAngleDeg: 0 (flat-fire default is unaffected by the new parameter)', () => {
  const withDefault = integrate(baseState);
  const explicitZero = integrate({ ...baseState, losAngleDeg: 0 });
  assert.deepEqual(withDefault, explicitZero);
});

test('the zero solve still sends the trajectory through the (inclined) sight line at zeroRange, uphill and downhill', () => {
  for (const losAngleDeg of [45, -45, 20]) {
    const state = { ...baseState, losAngleDeg };
    const launchAngle = solveZeroAngle(state);
    const impact = computeImpact({ ...state, launchAngle }, baseState.zeroRange);
    assert.ok(Math.abs(impact.dropCm) < 0.1, `losAngleDeg=${losAngleDeg}: drop at zero was ${impact.dropCm} cm`);
  }
});

test('an inclined shot (uphill or downhill) drops less than a level shot at the same distance along the sight line — the classic "shoots high" effect', () => {
  const target = 500;
  const level = computeImpact({ ...baseState, launchAngle: solveZeroAngle(baseState) }, target);

  for (const losAngleDeg of [45, -45]) {
    const state = { ...baseState, losAngleDeg };
    const inclined = computeImpact({ ...state, launchAngle: solveZeroAngle(state) }, target);
    assert.ok(
      Math.abs(inclined.dropCm) < Math.abs(level.dropCm),
      `losAngleDeg=${losAngleDeg}: inclined drop ${inclined.dropCm}cm should be smaller in magnitude than the level shot's ${level.dropCm}cm`
    );
  }
});

test('the same real station pressure gives identical density at the muzzle regardless of site elevation — pressureHpa is taken at face value, never sea-level-corrected', () => {
  const seaLevel = integrate(baseState);
  const highSite = integrate({ ...baseState, altitudeM: 2000 });
  assert.equal(seaLevel.points[0].mach, highSite.points[0].mach);
  assert.ok(Math.abs(seaLevel.points[0].velocity - highSite.points[0].velocity) < 1e-6);
});

test('site elevation still shapes the trajectory during a climbing shot, even with identical real station pressure — the ICAO pressure ratio a given climb represents depends on the *absolute* altitude it happens at, not just its size', () => {
  // Same actual muzzle conditions either way (see the face-value test
  // above) — the only difference is which part of the (curved, not
  // perfectly self-similar) standard pressure-vs-altitude curve a 60°,
  // 800m-slant climb sweeps through: starting from sea level, or starting
  // already 3000m up.
  const state = { ...baseState, maxRange: 800, rangeStep: 800, losAngleDeg: 60 };
  const lowSite = integrate(state);
  const highSite = integrate({ ...state, altitudeM: 3000 });
  const lastLow = lowSite.points[lowSite.points.length - 1];
  const lastHigh = highSite.points[highSite.points.length - 1];
  assert.ok(lastHigh.velocity > lastLow.velocity, `low=${lastLow.velocity}, high=${lastHigh.velocity}`);
});

test('atmosphere is recalculated from the bullet\'s own current altitude at every step — a climbing bullet meets thinner air and decelerates less than an altitude-pinned control with identical initial conditions', () => {
  const stepper = makeStepper({ ...baseState, altitudeM: 0 });
  const initial = { x: 0, y: 0, z: 0, vx: 800, vy: 400, vz: 0, t: 0 };
  let climbing = initial;
  let pinned = initial;
  // Stays comfortably supersonic throughout (well above TRANSONIC_HI) so
  // both runs take the same coarse step size at every iteration — once
  // either one dipped into the transonic band it'd briefly switch to the
  // much finer step, desynchronizing the two runs' elapsed *time* at the
  // same step *count* and confounding this comparison with the fixed
  // step-count adaptivity rather than the altitude effect being tested.
  for (let i = 0; i < 40; i++) {
    climbing = stepper.step(climbing);
    pinned = { ...stepper.step(pinned), y: 0 }; // same physics, but atmosphere always sees a height delta of 0
  }
  assert.ok(climbing.y > 100, `expected a genuine climb for this to be a meaningful test, got y=${climbing.y}`);
  const climbingSpeed = Math.hypot(climbing.vx, climbing.vy);
  const pinnedSpeed = Math.hypot(pinned.vx, pinned.vy);
  assert.ok(
    climbingSpeed > pinnedSpeed,
    `thinner air at altitude should let the climbing bullet retain more speed: climbing=${climbingSpeed}, pinned(never-climbed atmosphere)=${pinnedSpeed}`
  );
});

// solveHorizontalZeroAngle: the bore yaw that nulls spin drift at
// zeroRange, mirroring solveZeroAngle's own vertical solve — a real
// rifle's windage turret already absorbs spin drift for free when the
// shooter zeroes it, so the engine has to solve for the equivalent bore
// yaw explicitly instead of leaving it at 0 and showing spin drift as a
// windage offset even at the range the rifle is supposedly zeroed for.
const spinDriftState = {
  ...baseState,
  bc: 0.274, dragModel: 'G7', muzzleVelocity: 786.4,
  massKg: 0.0113, caliberM: 0.00778, lengthM: 0.035,
  riflingTwistMm: 279.4, twistDirection: 'right',
  zeroRange: 100, maxRange: 600, rangeStep: 100
};

// zeroForSpinDrift is the Settings-level opt-in (zero-spin-drift-prefs.js)
// gating whether the solve above actually applies — a second, more
// specific switch than calculateSpinDrift itself, off by default. Most
// tests below need both flags on to exercise the zeroing behavior;
// separate tests confirm each flag independently blocks it.
const zeroingOn = { calculateSpinDrift: true, zeroForSpinDrift: true };

test('solveHorizontalZeroAngle is 0 when spin drift is off (the setting, not just missing data)', () => {
  assert.equal(solveHorizontalZeroAngle({ ...spinDriftState, calculateSpinDrift: false, zeroForSpinDrift: true }), 0);
  assert.equal(solveHorizontalZeroAngle(spinDriftState), 0); // both flags absent entirely
});

test('solveHorizontalZeroAngle is 0 when zeroForSpinDrift is off, even with spin drift itself on and computable — this is the new setting\'s off-by-default behavior', () => {
  assert.equal(solveHorizontalZeroAngle({ ...spinDriftState, calculateSpinDrift: true }), 0); // zeroForSpinDrift absent
  assert.equal(solveHorizontalZeroAngle({ ...spinDriftState, calculateSpinDrift: true, zeroForSpinDrift: false }), 0);
});

test('solveHorizontalZeroAngle is 0 when spin drift is enabled but not computable (missing stability data), even with zeroForSpinDrift on', () => {
  const { caliberM, ...withoutCaliber } = spinDriftState;
  assert.equal(solveHorizontalZeroAngle({ ...withoutCaliber, ...zeroingOn }), 0);
});

test('solveHorizontalZeroAngle is 0 for a non-positive zeroRange, same degenerate handling as solveZeroAngle', () => {
  assert.equal(solveHorizontalZeroAngle({ ...spinDriftState, ...zeroingOn, zeroRange: 0 }), 0);
  assert.equal(solveHorizontalZeroAngle({ ...spinDriftState, ...zeroingOn, zeroRange: -10 }), 0);
});

test('solveHorizontalZeroAngle is nonzero when spin drift is enabled, computable, and zeroForSpinDrift is on', () => {
  const phi = solveHorizontalZeroAngle({ ...spinDriftState, ...zeroingOn });
  assert.ok(Number.isFinite(phi));
  assert.notEqual(phi, 0);
  // A fraction of a degree, not some wildly diverged secant result — spin
  // drift over a couple hundred meters is a few cm, not a real angle.
  assert.ok(Math.abs(phi) < (2 * Math.PI) / 180, `expected a small angle, got ${(phi * 180) / Math.PI} deg`);
});

test('with zeroForSpinDrift on, windage is nulled exactly at zeroRange — computeImpact and the stepped table agree', () => {
  const state = { ...spinDriftState, ...zeroingOn };
  const atZero = computeImpact(state, state.zeroRange);
  assert.ok(Math.abs(atZero.windageCm) < 1e-6, `expected ~0 windage at zeroRange, got ${atZero.windageCm}`);

  const { points } = integrate(state);
  const tableRow = points.find((p) => p.range === state.zeroRange);
  assert.ok(Math.abs(tableRow.windageCm) < 1e-6, `expected ~0 windage at the zeroRange table row, got ${tableRow.windageCm}`);
});

test('with zeroForSpinDrift on, windage is genuinely nonzero away from zeroRange (a residual, not zeroed everywhere)', () => {
  const state = { ...spinDriftState, ...zeroingOn };
  const beyondZero = computeImpact(state, 500);
  assert.ok(Math.abs(beyondZero.windageCm) > 0.01, `expected a real residual well past zeroRange, got ${beyondZero.windageCm}`);
});

test('spin drift enabled but zeroForSpinDrift off (the default combination): windage at zeroRange is still the raw spin-drift value, not nulled', () => {
  const state = { ...spinDriftState, calculateSpinDrift: true }; // zeroForSpinDrift left unset — the default
  const atZero = computeImpact(state, state.zeroRange);
  assert.ok(Math.abs(atZero.windageCm) > 0.01, `expected spin drift to still show up at zeroRange, got ${atZero.windageCm}`);
});

test('without spin drift, windage stays exactly 0 at every range with no wind — unchanged from before this feature', () => {
  const state = { ...spinDriftState, calculateSpinDrift: false, windSpeed: 0 };
  const { points } = integrate(state);
  for (const p of points) assert.equal(p.windageCm, 0);
});

test('solveHorizontalZeroAngle holds the already-solved vertical zero angle fixed rather than perturbing it', () => {
  const state = { ...spinDriftState, ...zeroingOn };
  const verticalOnly = solveZeroAngle(state);
  const { launchAngleDeg } = integrate(state);
  assert.ok(Math.abs(launchAngleDeg - (verticalOnly * 180) / Math.PI) < 1e-9);
});
