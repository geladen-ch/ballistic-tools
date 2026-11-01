import test from 'node:test';
import assert from 'node:assert/strict';
import { bdcTrajectories } from '../src/ui/range-solver/bdc-trajectories.js';
import { degToRad } from '../src/quantity.js';

const STATE = {
  muzzleVelocity: 840, bc: 0.475, dragModel: 'G1', zeroRange: 100, sightHeightM: 0.05,
  tempC: 15, pressurePa: 101325, altitudeM: 0, humidity: 0, losAngleRad: 0,
  massKg: 0.0109, caliberM: 0.00782, lengthM: 0.0311, riflingTwistM: 0.254, twistDirection: 'right', calculateSpinDrift: true
};
const settle = (ms = 30) => new Promise((resolve) => setTimeout(resolve, ms));
// The table's elevation at 1000 m: what a head- or tailwind moves.
const elevationAt = (tables, rangeM) => tables.still.elevation[tables.still.range.indexOf(rangeM)];

for (const mode of ['litz', 'mccoy4dof']) {
  test(`flown again for a head- or tailwind, not for a crosswind alone (${mode})`, async () => {
    const results = [];
    const bdc = bdcTrajectories((tables) => results.push(tables));
    const state = { ...STATE, spinDriftMode: mode };
    bdc.update({ ...state, windSpeed: 0, windAngleRad: 0 }, 4);
    await settle();
    assert.equal(results.length, 1);
    assert.equal(results[0].referenceSpeed, 4);
    assert.ok(results[0].still.xPerWind.every(Number.isFinite), 'the crosswind drift is filled');
    assert.ok(results[0].still.xPerWind[200] < 0, 'a crosswind from the right moves the aiming point left on the reticle');

    bdc.update({ ...state, windSpeed: 6, windAngleRad: degToRad(90) }, 4);
    await settle();
    assert.equal(results.length, 1, 'a pure crosswind changes nothing it is flown for');

    bdc.update({ ...state, windSpeed: 6, windAngleRad: 0 }, 4);
    await settle();
    assert.equal(results.length, 2);
    assert.ok(elevationAt(results[1], 1000) > elevationAt(results[0], 1000), 'a headwind: more to hold at 1000 m');

    bdc.update({ ...state, windSpeed: 6, windAngleRad: degToRad(180) }, 4);
    await settle();
    assert.equal(results.length, 3);
    assert.ok(elevationAt(results[2], 1000) < elevationAt(results[0], 1000), 'a tailwind: less');
    bdc.dispose();
  });
}

test('a newer update drops an older one\'s result', async () => {
  const results = [];
  const bdc = bdcTrajectories((tables) => results.push(tables));
  bdc.update({ ...STATE, windSpeed: 0, windAngleRad: 0 }, 4);
  bdc.update({ ...STATE, windSpeed: 5, windAngleRad: 0 }, 4);
  await settle();
  assert.equal(results.length, 1);
  bdc.update({ ...STATE, windSpeed: 9, windAngleRad: 0 }, 4);
  bdc.dispose();
  await settle();
  assert.equal(results.length, 1, 'nothing after dispose');
});
