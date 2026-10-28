import test from 'node:test';
import assert from 'node:assert/strict';

const {
  aimAngle, toReticleSubtension, subtensionFactor, sightPicture, ringRange, settleZoom, initialZoom, zoomLabel, zoomTicks
} = await import('../src/reticle/sight-picture.js');
const { fieldRadiusAtZoom } = await import('../src/reticle/scope.js');
const { fieldOfViewAngle, mradToRad } = await import('../src/quantity.js');

const close = (a, b, eps = 1e-12) => assert.ok(Math.abs(a - b) <= eps, `${a} !== ${b}`);

// 5–25x: 7.5 m to 1.5 m at 100 m.
const ffp = {
  type: 'ffp', fovMaxRad: fieldOfViewAngle(7.5, 100), fovMinRad: fieldOfViewAngle(1.5, 100), fovDistanceM: 100,
  zoomMin: 5, zoomMax: 25, calibrationZoom: undefined
};
const sfp = { ...ffp, type: 'sfp', calibrationZoom: 10 };
const fixed = { ...ffp, type: 'fixed', fovMinRad: ffp.fovMaxRad, zoomMin: 4, zoomMax: 4 };

test('hold: the readout\'s correction turned round — dial up holds below the centre, dial right left of it', () => {
  const a = aimAngle({ elevationRad: mradToRad(5), windageRad: mradToRad(1) }, 'hold');
  close(a.x, mradToRad(-1));
  close(a.y, mradToRad(5));
  const b = aimAngle({ elevationRad: mradToRad(-2), windageRad: mradToRad(-0.5) });
  assert.ok(b.y < 0 && b.x > 0);
});

test('dial elevation: the point sits on the horizontal axis at the windage hold', () => {
  const a = aimAngle({ elevationRad: mradToRad(5), windageRad: mradToRad(-2) }, 'dialElevation');
  assert.equal(a.y, 0);
  assert.ok(!Object.is(a.y, -0));
  close(a.x, mradToRad(2));
});

test('FFP and fixed subtensions are the true angle; SFP scales by zoom / calibration zoom', () => {
  const angle = { x: mradToRad(1), y: mradToRad(-2) };
  assert.deepEqual(toReticleSubtension(angle, ffp, 20), angle);
  assert.deepEqual(toReticleSubtension(angle, fixed, 4), angle);
  const at20 = toReticleSubtension(angle, sfp, 20);
  close(at20.x, mradToRad(2));
  close(at20.y, mradToRad(-4));
  assert.deepEqual(toReticleSubtension(angle, sfp, 10), angle);
  assert.equal(subtensionFactor(sfp, 20), 0.5);
  assert.equal(subtensionFactor(sfp, 5), 2);
  assert.equal(subtensionFactor(ffp, 20), 1);
});

test('the field radius follows the scope type', () => {
  close(sightPicture(ffp, 5, null).radius, ffp.fovMaxRad / 2);
  assert.ok(sightPicture(ffp, 25, null).radius < sightPicture(ffp, 5, null).radius);
  close(sightPicture(sfp, 5, null).radius, sightPicture(sfp, 25, null).radius);
  close(sightPicture(sfp, 7, null).radius, fieldRadiusAtZoom(sfp, 7));
  close(sightPicture(fixed, 4, null).radius, fixed.fovMaxRad / 2);
});

test('a point outside the field (less the margin) is reported with its direction', () => {
  const r = fieldRadiusAtZoom(ffp, 25);
  const inside = sightPicture(ffp, 25, { x: 0, y: r * 0.5 });
  assert.equal(inside.inside, true);
  const out = sightPicture(ffp, 25, { x: 0, y: r * 1.2 });
  assert.equal(out.inside, false);
  close(out.direction, Math.PI / 2);
  assert.equal(sightPicture(ffp, 25, { x: r * 0.95, y: 0 }, { margin: 0.1 }).inside, false);
  // SFP: at a higher zoom the same hold moves out of the field.
  const hold = { x: 0, y: fieldRadiusAtZoom(sfp, 10) * 0.8 };
  assert.equal(sightPicture(sfp, 10, hold).inside, true);
  assert.equal(sightPicture(sfp, 20, hold).inside, false);
  assert.equal(sightPicture(ffp, 10, null).point, null);
});

test('the ring covers the actual zoom range, none for a fixed scope', () => {
  assert.deepEqual(ringRange(ffp), [5, 25]);
  assert.equal(ringRange(fixed), null);
  assert.equal(ringRange({ ...ffp, zoomMin: NaN }), null);
});

test('zoom settles inside the ring and snaps to an SFP calibration zoom within ±5 %', () => {
  assert.equal(settleZoom(ffp, 2), 5);
  assert.equal(settleZoom(ffp, 40), 25);
  assert.equal(settleZoom(ffp, 9.8), 9.8);
  assert.equal(settleZoom(sfp, 9.5), 10);
  assert.equal(settleZoom(sfp, 10.5), 10);
  assert.equal(settleZoom(sfp, 9.49), 9.49);
  assert.equal(settleZoom(sfp, 10.51), 10.51);
  assert.equal(settleZoom(fixed, 7), 4);
});

test('the view opens at the calibration zoom for SFP and the highest for FFP', () => {
  assert.equal(initialZoom(sfp), 10);
  assert.equal(initialZoom(ffp), 25);
  assert.equal(initialZoom(fixed), 4);
});

test('zoom labels drop a whole number\'s decimal', () => {
  assert.equal(zoomLabel(8), '8×');
  assert.equal(zoomLabel(3.23), '3.2×');
});

test('ticks: both ends and every whole zoom, labels never overlapping', () => {
  const minGap = 0.12;
  const fits = (a, b) => Math.abs(a - b) >= minGap;
  const optics = { ...ffp, zoomMin: 3.23, zoomMax: 20 };
  const ticks = zoomTicks(optics, fits);
  assert.equal(ticks[0].zoom, 3.23);
  assert.equal(ticks.at(-1).zoom, 20);
  assert.deepEqual(ticks.slice(1, -1).map((t) => t.zoom), [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
  assert.equal(ticks[0].label, '3.2×');
  assert.equal(ticks.at(-1).label, '20×');
  const labelled = ticks.filter((t) => t.label);
  for (let i = 1; i < labelled.length; i += 1) assert.ok(labelled[i].position - labelled[i - 1].position >= minGap);
  // Multiples of 5 win over their neighbours.
  assert.ok(ticks.find((t) => t.zoom === 10).label);
  assert.ok(ticks.find((t) => t.zoom === 15).label);
});

test('ticks: the SFP calibration zoom is a marked, labelled tick even off a whole zoom', () => {
  const optics = { ...sfp, zoomMin: 4.1, zoomMax: 16, calibrationZoom: 12.5 };
  const ticks = zoomTicks(optics, (a, b) => Math.abs(a - b) >= 0.15);
  const cal = ticks.filter((t) => t.calibration);
  assert.equal(cal.length, 1);
  assert.equal(cal[0].zoom, 12.5);
  assert.equal(cal[0].label, '12.5×');
  assert.ok(!ticks.find((t) => t.zoom === 12).label && !ticks.find((t) => t.zoom === 13).label);
  assert.deepEqual(zoomTicks(fixed, () => true), []);
});
