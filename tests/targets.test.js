import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from './helpers/fake-dom.js';

installFakeDom();

const { loadTargetCatalog, loadTarget, loadTargetFunction, targetThumbUrl, targetDetailUrl, targetResultUrl } = await import('../src/targets.js');

test('loadTargetCatalog resolves a plain list of target ids', () => {
  const catalog = loadTargetCatalog();
  assert.ok(Array.isArray(catalog));
  assert.deepEqual(catalog, [
    'plate-40x60', 'issf-300m', 'ch-300m-b4', 'ch-300m-b10', 'ussr-4', 'ussr-5', 'ussr-8',
    'ch-campagne-e', 'ch-campagne-f', 'ch-campagne-g', 'ch-campagne-h', 'ch-campagne-k',
    'ch-nttc-score', 'circle-100mm', 'circle-200mm', 'square-1m', 'square-2m', 'killer-tubby'
  ]);
  for (const entry of catalog) assert.equal(typeof entry, 'string');
});

test('loadTargetCatalog returns the same array instance across repeated calls (an imported module binding, not a fetch)', () => {
  assert.equal(loadTargetCatalog(), loadTargetCatalog());
});

test('loadTarget resolves the plate-40x60 target\'s dimensions, zones, and SVG placement', async () => {
  const target = await loadTarget('plate-40x60');
  assert.equal(target.id, 'plate-40x60');
  assert.equal(target.widthM, 0.4);
  assert.equal(target.heightM, 0.6);
  assert.equal(target.aspectRatio, 1.5);
  assert.ok(Array.isArray(target.zones) && target.zones.length === 1);
  assert.equal(target.zones[0].id, 'hit');
  assert.equal(typeof target.zones[0].score, 'number');
  assert.equal(typeof target.resultSvg.pointOfAim.x, 'number');
  assert.equal(typeof target.resultSvg.pointOfAim.y, 'number');
  assert.equal(typeof target.resultSvg.pxPerMeter, 'number');
});

test('loadTarget rejects for an unknown id', async () => {
  await assert.rejects(() => loadTarget('does-not-exist'));
});

test('loadTarget caches per id — repeated calls resolve the same data without re-fetching', async () => {
  const first = await loadTarget('plate-40x60');
  const second = await loadTarget('plate-40x60');
  assert.equal(first, second);
});

test('loadTargetFunction resolves the target\'s hitProbability function', async () => {
  const hitProbability = await loadTargetFunction('plate-40x60');
  assert.equal(typeof hitProbability, 'function');
  const zones = hitProbability(10, 10, 0, 0);
  assert.ok(Array.isArray(zones) && zones.length === 1);
  assert.equal(zones[0].zoneId, 'hit');
  assert.ok(zones[0].probability > 0 && zones[0].probability <= 1);
});

test('the SVG URL builders point at the three per-target asset files', () => {
  assert.ok(targetThumbUrl('plate-40x60').href.endsWith('/targets/plate-40x60-thumb.svg'));
  assert.ok(targetDetailUrl('plate-40x60').href.endsWith('/targets/plate-40x60-detail.svg'));
  assert.ok(targetResultUrl('plate-40x60').href.endsWith('/targets/plate-40x60-result.svg'));
});

test('loadTarget resolves the issf-300m target\'s dimensions, zones, and SVG placement', async () => {
  const target = await loadTarget('issf-300m');
  assert.equal(target.id, 'issf-300m');
  assert.equal(target.widthM, 1.0);
  assert.equal(target.heightM, 1.0);
  assert.equal(target.aspectRatio, 1.0);
  assert.equal(target.zones.length, 11, 'scores 1-10 plus the 10x sub-ring');
  assert.deepEqual(target.zones.map((z) => z.id), ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '10x']);
  assert.deepEqual(target.zones.map((z) => z.score), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 10], '10x is a tiebreak marker, not extra points');
  assert.equal(target.resultSvg.pointOfAim.x, 500);
  assert.equal(target.resultSvg.pointOfAim.y, 500);
  assert.equal(target.resultSvg.pxPerMeter, 1000);
});

test('issf-300m\'s hitProbability: with negligible dispersion dead-center, essentially all mass lands in 10x', async () => {
  const hitProbability = await loadTargetFunction('issf-300m');
  const zones = hitProbability(0.01, 0.01, 0, 0);
  const byId = Object.fromEntries(zones.map((z) => [z.zoneId, z.probability]));
  assert.ok(byId['10x'] > 0.999, `expected ~all mass in 10x, got ${byId['10x']}`);
  const total = zones.reduce((s, z) => s + z.probability, 0);
  assert.ok(Math.abs(total - 1) < 1e-6, `zone probabilities should sum to ~1, got ${total}`);
});

test('issf-300m\'s hitProbability: a huge dispersion relative to the target scores near-zero total', async () => {
  const hitProbability = await loadTargetFunction('issf-300m');
  const zones = hitProbability(1000, 1000, 0, 0);
  const total = zones.reduce((s, z) => s + z.probability, 0);
  assert.ok(total < 5e-3, `a target this small under this much dispersion should score near-zero total, got ${total}`);
});

test('loadTarget resolves the ch-300m-b4 target\'s dimensions, zones, and SVG placement', async () => {
  const target = await loadTarget('ch-300m-b4');
  assert.equal(target.id, 'ch-300m-b4');
  assert.equal(target.widthM, 1.0);
  assert.equal(target.heightM, 1.0);
  assert.equal(target.aspectRatio, 1.0);
  assert.deepEqual(target.zones.map((z) => z.id), ['1', '2', '3', '4']);
  assert.deepEqual(target.zones.map((z) => z.score), [1, 2, 3, 4]);
  assert.equal(target.resultSvg.pointOfAim.x, 500);
  assert.equal(target.resultSvg.pointOfAim.y, 500);
  assert.equal(target.resultSvg.pxPerMeter, 1000);
});

test('ch-300m-b4\'s hitProbability: with negligible dispersion dead-center, essentially all mass lands in zone 4', async () => {
  const hitProbability = await loadTargetFunction('ch-300m-b4');
  const zones = hitProbability(0.01, 0.01, 0, 0);
  const byId = Object.fromEntries(zones.map((z) => [z.zoneId, z.probability]));
  assert.ok(byId['4'] > 0.999, `expected ~all mass in zone 4, got ${byId['4']}`);
  const total = zones.reduce((s, z) => s + z.probability, 0);
  assert.ok(Math.abs(total - 1) < 1e-6, `zone probabilities should sum to ~1, got ${total}`);
});

test('ch-300m-b4\'s hitProbability: a huge dispersion relative to the target scores near-zero total', async () => {
  const hitProbability = await loadTargetFunction('ch-300m-b4');
  const zones = hitProbability(1000, 1000, 0, 0);
  const total = zones.reduce((s, z) => s + z.probability, 0);
  assert.ok(total < 5e-3, `a target this small under this much dispersion should score near-zero total, got ${total}`);
});

test('ch-300m-b4\'s hitProbability: all zone probabilities stay non-negative across a range of dispersions', async () => {
  const hitProbability = await loadTargetFunction('ch-300m-b4');
  for (const sd of [1, 5, 10, 20, 35, 50, 100]) {
    const zones = hitProbability(sd, sd, 0, 0);
    for (const zone of zones) {
      assert.ok(zone.probability >= -1e-9, `zone ${zone.zoneId} went negative (${zone.probability}) at sd=${sd}`);
    }
  }
});

test('loadTarget resolves the ch-300m-b10 target\'s dimensions, zones, and SVG placement', async () => {
  const target = await loadTarget('ch-300m-b10');
  assert.equal(target.id, 'ch-300m-b10');
  assert.equal(target.widthM, 1.0);
  assert.equal(target.heightM, 1.0);
  assert.equal(target.aspectRatio, 1.0);
  assert.equal(target.zones.length, 11, 'scores 1-10 plus the 10x sub-ring');
  assert.deepEqual(target.zones.map((z) => z.id), ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '10x']);
  assert.deepEqual(target.zones.map((z) => z.score), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 10], '10x is a tiebreak marker, not extra points');
  assert.equal(target.resultSvg.pointOfAim.x, 500);
  assert.equal(target.resultSvg.pointOfAim.y, 500);
  assert.equal(target.resultSvg.pxPerMeter, 1000);
});

test('ch-300m-b10\'s hitProbability matches issf-300m\'s ring-for-ring — same physical target, identical scoring math', async () => {
  const b10 = await loadTargetFunction('ch-300m-b10');
  const issf = await loadTargetFunction('issf-300m');
  for (const [sdX, sdY, offsetX, offsetY] of [[15, 15, 0, 0], [8, 12, 3, -5], [40, 40, 0, 0]]) {
    const b10Zones = b10(sdX, sdY, offsetX, offsetY);
    const issfZones = issf(sdX, sdY, offsetX, offsetY);
    assert.deepEqual(b10Zones, issfZones, `mismatch at sdX=${sdX},sdY=${sdY},offsetX=${offsetX},offsetY=${offsetY}`);
  }
});

test('loadTarget resolves the ussr-4 target\'s dimensions, zones, and SVG placement', async () => {
  const target = await loadTarget('ussr-4');
  assert.equal(target.id, 'ussr-4');
  assert.equal(target.widthM, 0.5);
  assert.equal(target.heightM, 0.5);
  assert.equal(target.aspectRatio, 1.0);
  assert.equal(target.zones.length, 1);
  assert.equal(target.zones[0].id, 'hit');
  assert.equal(target.zones[0].score, 1);
  assert.equal(target.resultSvg.pointOfAim.x, 250);
  assert.equal(target.resultSvg.pointOfAim.y, 250);
  assert.equal(target.resultSvg.pxPerMeter, 1000);
});

test('ussr-4\'s hitProbability: with negligible dispersion dead-center, essentially all mass is a hit', async () => {
  const hitProbability = await loadTargetFunction('ussr-4');
  const zones = hitProbability(0.01, 0.01, 0, 0);
  assert.equal(zones.length, 1);
  assert.ok(zones[0].probability > 0.999, `expected ~certain hit, got ${zones[0].probability}`);
});

test('ussr-4\'s hitProbability: a huge dispersion relative to the target scores near-zero', async () => {
  const hitProbability = await loadTargetFunction('ussr-4');
  const zones = hitProbability(1000, 1000, 0, 0);
  assert.ok(zones[0].probability < 5e-3, `a target this small under this much dispersion should score near-zero, got ${zones[0].probability}`);
});

test('loadTarget resolves the ch-nttc-score target\'s dimensions and zones', async () => {
  const target = await loadTarget('ch-nttc-score');
  assert.equal(target.id, 'ch-nttc-score');
  assert.deepEqual(target.zones.map((z) => z.id), ['x', 'y', 'z']);
  assert.deepEqual(target.zones.map((z) => z.score), [5, 5, 2]);
});

test('ch-nttc-score\'s hitProbability: dead-center with negligible dispersion lands entirely in zone X', async () => {
  const hitProbability = await loadTargetFunction('ch-nttc-score');
  const zones = hitProbability(0.01, 0.01, 0, 0);
  const byId = Object.fromEntries(zones.map((z) => [z.zoneId, z.probability]));
  assert.ok(byId.x > 0.999, `expected ~all mass in zone X, got ${byId.x}`);
  const total = zones.reduce((s, z) => s + z.probability, 0);
  assert.ok(Math.abs(total - 1) < 1e-6, `zone probabilities should sum to ~1, got ${total}`);
});

test('ch-nttc-score\'s hitProbability: zone Z never goes negative across a range of dispersions', async () => {
  const hitProbability = await loadTargetFunction('ch-nttc-score');
  for (const sd of [1, 5, 10, 20, 50]) {
    const zones = hitProbability(sd, sd, 0, 0);
    const z = zones.find((zone) => zone.zoneId === 'z');
    assert.ok(z.probability >= -1e-9, `zone Z went negative (${z.probability}) at sd=${sd}`);
  }
});

test('loadTarget resolves the square-2m target\'s nested zones', async () => {
  const target = await loadTarget('square-2m');
  assert.deepEqual(target.zones.map((z) => z.id), ['1x1', '2x2']);
  assert.deepEqual(target.zones.map((z) => z.score), [1, 1]);
});

test('square-2m\'s hitProbability: dead-center with negligible dispersion lands entirely in the 1x1 zone', async () => {
  const hitProbability = await loadTargetFunction('square-2m');
  const zones = hitProbability(0.01, 0.01, 0, 0);
  const byId = Object.fromEntries(zones.map((z) => [z.zoneId, z.probability]));
  assert.ok(byId['1x1'] > 0.999, `expected ~all mass in the 1x1 zone, got ${byId['1x1']}`);
});

test('ussr-8\'s hitProbability: with negligible dispersion dead-center, essentially all mass is a hit', async () => {
  const hitProbability = await loadTargetFunction('ussr-8');
  const zones = hitProbability(0.01, 0.01, 0, 0);
  assert.ok(zones[0].probability > 0.999, `expected ~certain hit, got ${zones[0].probability}`);
});

test('ussr-8\'s hitProbability: never goes negative despite the tapered-corner subtraction, across a range of dispersions', async () => {
  const hitProbability = await loadTargetFunction('ussr-8');
  for (const sd of [1, 5, 10, 20, 50, 100]) {
    const zones = hitProbability(sd, sd, 0, 0);
    assert.ok(zones[0].probability >= -1e-9, `went negative (${zones[0].probability}) at sd=${sd}`);
  }
});

test('loadTarget resolves the killer-tubby target\'s dimensions, and its hitProbability matches ch-campagne-f\'s (same scoring rectangles)', async () => {
  const target = await loadTarget('killer-tubby');
  assert.equal(target.id, 'killer-tubby');
  assert.equal(target.widthM, 0.6);
  assert.equal(target.heightM, 1.2);
  assert.equal(target.resultSvg.pointOfAim.x, 300);
  assert.equal(target.resultSvg.pointOfAim.y, 700);

  const tubby = await loadTargetFunction('killer-tubby');
  const campagneF = await loadTargetFunction('ch-campagne-f');
  for (const [sdX, sdY, offsetX, offsetY] of [[15, 15, 0, 0], [8, 12, 3, -5], [40, 40, 0, 0]]) {
    assert.deepEqual(tubby(sdX, sdY, offsetX, offsetY), campagneF(sdX, sdY, offsetX, offsetY));
  }
});

test('every catalog target resolves to a well-formed record and a callable scoring function', async () => {
  const catalog = loadTargetCatalog();
  for (const id of catalog) {
    const target = await loadTarget(id);
    assert.equal(target.id, id, `id mismatch for ${id}`);
    assert.ok(target.widthM > 0 && target.heightM > 0, `implausible dimensions for ${id}`);
    assert.ok(Math.abs(target.aspectRatio - target.heightM / target.widthM) < 1e-9, `aspectRatio doesn't match height/width for ${id}`);
    assert.ok(target.zones.length > 0, `${id} has no zones`);

    const hitProbability = await loadTargetFunction(id);
    const zones = hitProbability(10, 10, 0, 0);
    assert.equal(zones.length, target.zones.length, `${id}'s scoring function returned a different zone count than its own data`);
  }
});
