import test from 'node:test';
import assert from 'node:assert/strict';
import { sessionStateToStored, sessionStateFromStored } from '../src/ui/truing-session/fit-units.js';

const close = (a, b) => assert.ok(Math.abs(a - b) <= 1e-12 * Math.max(1, Math.abs(b)), `${a} != ${b}`);

const memory = {
  phase: 'shoot',
  homeworkState: { r50Mrad: 0.14, mvSD: 5, backdropHeightM: 2 },
  plan: { ranges: [100, 500], shots: [3, 5], dragSd: 2.5, zeroDragCorr: 0.1 },
  targetOverrides: { a: { rangeM: 300, losAngleDeg: 6 } },
  pendingTargetEdits: { b: { losAngleDeg: -3 } },
  shootSession: {
    groups: [
      { rangeM: 500, observedComeUp: 4.2, shots: 3, sigmaMrad: 0.1, noise: { r50Mrad: 0.14, v0SensMrad: 0.02, sigmaObsMrad: 0.05, windSdMrad: 0.03 }, shotComeUps: [4.1, 4.2, 4.3] },
      { rangeM: 300, observedComeUp: 2, shots: 1, sigmaMrad: 0.2 }
    ],
    angleChecks: { a: 5.5 },
    rangeChecks: [{ rangeM: 300 }]
  }
};

test('the Truing state is stored in radians and fractions, under SI names', () => {
  const stored = sessionStateToStored(memory);
  close(stored.homeworkState.r50Rad, 0.00014);
  assert.ok(!('r50Mrad' in stored.homeworkState));
  close(stored.plan.dragSd, 0.025);
  close(stored.targetOverrides.a.losAngleRad, 6 * Math.PI / 180);
  close(stored.pendingTargetEdits.b.losAngleRad, -3 * Math.PI / 180);
  const [g] = stored.shootSession.groups;
  close(g.observedComeUpRad, 0.0042);
  close(g.sigmaRad, 0.0001);
  close(g.noise.v0SensRadPerMs, 0.00002);
  close(g.shotComeUpsRad[2], 0.0043);
  assert.deepEqual(Object.keys(g.noise).sort(), ['r50Rad', 'sigmaObsRad', 'v0SensRadPerMs', 'windSdRad']);
  close(stored.shootSession.angleChecksRad.a, 5.5 * Math.PI / 180);
  assert.ok(!('angleChecks' in stored.shootSession));
  assert.deepEqual(stored.shootSession.rangeChecks, [{ rangeM: 300 }]);
  assert.equal(stored.phase, 'shoot');
});

test('a stored Truing state reads back in the working units, the input left untouched', () => {
  const before = JSON.stringify(memory);
  const back = sessionStateFromStored(JSON.parse(JSON.stringify(sessionStateToStored(memory))));
  assert.equal(JSON.stringify(memory), before);
  const walk = (a, b) => {
    if (typeof b === 'number') return close(a, b);
    if (b && typeof b === 'object') {
      assert.deepEqual(Object.keys(a).sort(), Object.keys(b).sort());
      for (const k of Object.keys(b)) walk(a[k], b[k]);
      return;
    }
    assert.equal(a, b);
  };
  walk(back, memory);
});

test('missing and null slices pass through', () => {
  assert.equal(sessionStateToStored(null), null);
  assert.deepEqual(sessionStateToStored({ shootSession: null, plan: null }), { shootSession: null, plan: null });
  assert.deepEqual(sessionStateFromStored({ phase: 'prepare' }), { phase: 'prepare' });
});
