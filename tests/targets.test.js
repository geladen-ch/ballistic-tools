import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from './helpers/fake-dom.js';

installFakeDom();

const { loadTargetCatalog, loadTarget, loadTargetFunction, targetThumbUrl, targetDetailUrl, targetResultUrl } = await import('../src/targets.js');

test('loadTargetCatalog resolves a plain list of target ids', () => {
  const catalog = loadTargetCatalog();
  assert.ok(Array.isArray(catalog));
  assert.deepEqual(catalog, [
    'circle-gong', 'rect-plate', 'issf-300m', 'ch-300m-b4', 'ch-300m-b10', 'ussr-4', 'ussr-5', 'ussr-8',
    'ch-campagne-e', 'ch-campagne-f', 'ch-campagne-g', 'ch-campagne-h', 'ch-campagne-k',
    'ch-nttc-score', 'square-2m', 'killer-tubby', 'ipsc-popper', 'ipsc-popper-mini',
    'ipsc-target', 'ipsc-target-mini'
  ]);
  for (const entry of catalog) assert.equal(typeof entry, 'string');
});

test('loadTargetCatalog returns the same array instance across repeated calls (an imported module binding, not a fetch)', () => {
  assert.equal(loadTargetCatalog(), loadTargetCatalog());
});

test('loadTarget resolves the circle-gong target\'s custom flag and zones (no static widthM/heightM/resultSvg — those come from the live dimension field, see custom-target-render.js)', async () => {
  const target = await loadTarget('circle-gong');
  assert.equal(target.id, 'circle-gong');
  assert.deepEqual(target.custom, { shape: 'circle' });
  assert.ok(Array.isArray(target.zones) && target.zones.length === 1);
  assert.equal(target.zones[0].id, 'hit');
  assert.equal(typeof target.zones[0].score, 'number');
});

test('loadTarget resolves the rect-plate target\'s custom flag and zones', async () => {
  const target = await loadTarget('rect-plate');
  assert.equal(target.id, 'rect-plate');
  assert.deepEqual(target.custom, { shape: 'rectangle' });
  assert.ok(Array.isArray(target.zones) && target.zones.length === 1);
  assert.equal(target.zones[0].id, 'hit');
});

test('loadTarget rejects for an unknown id', async () => {
  await assert.rejects(() => loadTarget('does-not-exist'));
});

test('loadTarget caches per id — repeated calls resolve the same data without re-fetching', async () => {
  const first = await loadTarget('circle-gong');
  const second = await loadTarget('circle-gong');
  assert.equal(first, second);
});

test('circle-gong\'s hitProbability takes its radius from the dims argument', async () => {
  const hitProbability = await loadTargetFunction('circle-gong');
  assert.equal(typeof hitProbability, 'function');
  const small = hitProbability(10, 10, 0, 0, { diameterCm: 10 });
  const large = hitProbability(10, 10, 0, 0, { diameterCm: 100 });
  assert.equal(small.length, 1);
  assert.equal(small[0].zoneId, 'hit');
  assert.ok(small[0].probability > 0 && small[0].probability <= 1);
  assert.ok(large[0].probability > small[0].probability, 'a bigger gong should score a higher hit probability under the same dispersion');
});

test('rect-plate\'s hitProbability takes its width/height from the dims argument', async () => {
  const hitProbability = await loadTargetFunction('rect-plate');
  const small = hitProbability(10, 10, 0, 0, { widthCm: 10, heightCm: 10 });
  const large = hitProbability(10, 10, 0, 0, { widthCm: 100, heightCm: 100 });
  assert.equal(small.length, 1);
  assert.equal(small[0].zoneId, 'hit');
  assert.ok(large[0].probability > small[0].probability, 'a bigger plate should score a higher hit probability under the same dispersion');
});

test('the SVG URL builders point at a fixed target\'s three per-target asset files', () => {
  assert.ok(targetThumbUrl('issf-300m').href.endsWith('/targets/issf-300m-thumb.svg'));
  assert.ok(targetDetailUrl('issf-300m').href.endsWith('/targets/issf-300m-detail.svg'));
  assert.ok(targetResultUrl('issf-300m').href.endsWith('/targets/issf-300m-result.svg'));
});

test('the thumbnail URL builder also covers the two user-sizeable targets (they only ship a -thumb.svg — no -detail.svg/-result.svg, those are generated at runtime, see custom-target-render.test.js)', () => {
  assert.ok(targetThumbUrl('circle-gong').href.endsWith('/targets/circle-gong-thumb.svg'));
  assert.ok(targetThumbUrl('rect-plate').href.endsWith('/targets/rect-plate-thumb.svg'));
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

test('loadTarget resolves the ipsc-popper target\'s dimensions, zones, and SVG placement', async () => {
  const target = await loadTarget('ipsc-popper');
  assert.equal(target.id, 'ipsc-popper');
  assert.equal(target.widthM, 0.3);
  assert.equal(target.heightM, 0.85);
  assert.ok(Math.abs(target.aspectRatio - 0.85 / 0.3) < 1e-9);
  assert.equal(target.zones.length, 1);
  assert.equal(target.zones[0].id, 'hit');
  assert.equal(target.zones[0].score, 1);
  assert.equal(target.resultSvg.pointOfAim.x, 150);
  assert.equal(target.resultSvg.pointOfAim.y, 150, 'the circular head\'s own center, not the bounding-box center');
  assert.equal(target.resultSvg.pxPerMeter, 1000);
});

test('ipsc-popper\'s hitProbability: with negligible dispersion dead-center (the circular head\'s own center), essentially all mass is a hit', async () => {
  const hitProbability = await loadTargetFunction('ipsc-popper');
  const zones = hitProbability(0.01, 0.01, 0, 0);
  assert.equal(zones.length, 1);
  assert.ok(zones[0].probability > 0.999, `expected ~certain hit, got ${zones[0].probability}`);
});

test('ipsc-popper\'s hitProbability: a huge dispersion relative to the target scores near-zero', async () => {
  const hitProbability = await loadTargetFunction('ipsc-popper');
  const zones = hitProbability(1000, 1000, 0, 0);
  assert.ok(zones[0].probability < 5e-3, `a target this small under this much dispersion should score near-zero, got ${zones[0].probability}`);
});

test('loadTarget resolves the ipsc-popper-mini target\'s dimensions, zones, and SVG placement', async () => {
  const target = await loadTarget('ipsc-popper-mini');
  assert.equal(target.id, 'ipsc-popper-mini');
  assert.equal(target.widthM, 0.2);
  assert.equal(target.heightM, 0.56);
  assert.ok(Math.abs(target.aspectRatio - 0.56 / 0.2) < 1e-9);
  assert.equal(target.zones.length, 1);
  assert.equal(target.zones[0].id, 'hit');
  assert.equal(target.resultSvg.pointOfAim.x, 100);
  assert.equal(target.resultSvg.pointOfAim.y, 100, 'the circular head\'s own center, not the bounding-box center');
  assert.equal(target.resultSvg.pxPerMeter, 1000);
});

test('ipsc-popper-mini\'s hitProbability: with negligible dispersion dead-center, essentially all mass is a hit; a huge dispersion scores near-zero', async () => {
  const hitProbability = await loadTargetFunction('ipsc-popper-mini');
  const centered = hitProbability(0.01, 0.01, 0, 0);
  assert.ok(centered[0].probability > 0.999, `expected ~certain hit, got ${centered[0].probability}`);
  const wide = hitProbability(1000, 1000, 0, 0);
  assert.ok(wide[0].probability < 5e-3, `a target this small under this much dispersion should score near-zero, got ${wide[0].probability}`);
});

test('ipsc-popper is bigger than ipsc-popper-mini: same dispersion off both targets\' centers scores strictly higher on the full popper', async () => {
  const popper = await loadTargetFunction('ipsc-popper');
  const mini = await loadTargetFunction('ipsc-popper-mini');
  const full = popper(15, 15, 0, 0)[0].probability;
  const small = mini(15, 15, 0, 0)[0].probability;
  assert.ok(full > small, `expected full popper (${full}) > mini (${small})`);
});

test('loadTarget resolves the ipsc-target target\'s dimensions, zones (with both scoring standards), and SVG placement', async () => {
  const target = await loadTarget('ipsc-target');
  assert.equal(target.id, 'ipsc-target');
  assert.equal(target.widthM, 0.45);
  assert.equal(target.heightM, 0.57);
  assert.ok(Math.abs(target.aspectRatio - 0.57 / 0.45) < 1e-9);
  assert.deepEqual(target.zones.map((z) => z.id), ['a', 'c', 'd']);
  assert.deepEqual(target.zones.map((z) => z.scoreMajor), [5, 4, 2]);
  assert.deepEqual(target.zones.map((z) => z.scoreMinor), [5, 3, 1]);
  assert.equal(target.resultSvg.pointOfAim.x, 225);
  assert.equal(target.resultSvg.pointOfAim.y, 187.5);
  assert.equal(target.resultSvg.pxPerMeter, 1000);
});

test('ipsc-target\'s hitProbability: with negligible dispersion dead-center (the A-zone\'s own center), essentially all mass is in zone A', async () => {
  const hitProbability = await loadTargetFunction('ipsc-target');
  const zones = hitProbability(0.01, 0.01, 0, 0);
  const byId = Object.fromEntries(zones.map((z) => [z.zoneId, z.probability]));
  assert.ok(byId.a > 0.999, `expected ~all mass in zone A, got ${byId.a}`);
  const total = zones.reduce((s, z) => s + z.probability, 0);
  assert.ok(Math.abs(total - 1) < 1e-6, `zone probabilities should sum to ~1, got ${total}`);
});

test('ipsc-target\'s hitProbability: no zone ever goes negative (nested A ⊆ C ⊆ D subtraction) across a range of dispersions', async () => {
  const hitProbability = await loadTargetFunction('ipsc-target');
  for (const sd of [1, 5, 10, 20, 35, 50]) {
    const zones = hitProbability(sd, sd, 0, 0);
    for (const zone of zones) assert.ok(zone.probability >= -1e-9, `zone ${zone.zoneId} went negative (${zone.probability}) at sd=${sd}`);
  }
});

test('loadTarget resolves the ipsc-target-mini target\'s dimensions, zones, and SVG placement', async () => {
  const target = await loadTarget('ipsc-target-mini');
  assert.equal(target.id, 'ipsc-target-mini');
  assert.equal(target.widthM, 0.3);
  assert.equal(target.heightM, 0.375);
  assert.ok(Math.abs(target.aspectRatio - 0.375 / 0.3) < 1e-9);
  assert.deepEqual(target.zones.map((z) => z.id), ['a', 'c', 'd']);
  assert.equal(target.resultSvg.pointOfAim.x, 150);
  assert.equal(target.resultSvg.pointOfAim.y, 122.5);
  assert.equal(target.resultSvg.pxPerMeter, 1000);
});

test('ipsc-target-mini\'s hitProbability: with negligible dispersion dead-center, essentially all mass is in zone A', async () => {
  const hitProbability = await loadTargetFunction('ipsc-target-mini');
  const zones = hitProbability(0.01, 0.01, 0, 0);
  const byId = Object.fromEntries(zones.map((z) => [z.zoneId, z.probability]));
  assert.ok(byId.a > 0.999, `expected ~all mass in zone A, got ${byId.a}`);
});

test('ipsc-target is bigger than ipsc-target-mini: same dispersion off both targets\' centers scores strictly higher total hit probability on the full target', async () => {
  const full = await loadTargetFunction('ipsc-target');
  const mini = await loadTargetFunction('ipsc-target-mini');
  const sum = (zones) => zones.reduce((s, z) => s + z.probability, 0);
  const fullTotal = sum(full(15, 15, 0, 0));
  const miniTotal = sum(mini(15, 15, 0, 0));
  assert.ok(fullTotal > miniTotal, `expected full (${fullTotal}) > mini (${miniTotal})`);
});

test('every catalog target resolves to a well-formed record and a callable scoring function', async () => {
  const catalog = loadTargetCatalog();
  for (const id of catalog) {
    const target = await loadTarget(id);
    assert.equal(target.id, id, `id mismatch for ${id}`);
    assert.ok(target.zones.length > 0, `${id} has no zones`);

    // The two user-sizeable targets carry no static widthM/heightM/
    // aspectRatio — those are derived at render time from the live
    // dimension field(s), see custom-target-render.js — so their own
    // scoring function needs a `dims` argument here, standing in for
    // whatever the Simulation panel's fields currently hold.
    const dims = target.custom
      ? (target.custom.shape === 'circle' ? { diameterCm: 25 } : { widthCm: 40, heightCm: 50 })
      : undefined;
    if (!target.custom) {
      assert.ok(target.widthM > 0 && target.heightM > 0, `implausible dimensions for ${id}`);
      assert.ok(Math.abs(target.aspectRatio - target.heightM / target.widthM) < 1e-9, `aspectRatio doesn't match height/width for ${id}`);
    }

    const hitProbability = await loadTargetFunction(id);
    const zones = hitProbability(10, 10, 0, 0, dims);
    assert.equal(zones.length, target.zones.length, `${id}'s scoring function returned a different zone count than its own data`);
  }
});
