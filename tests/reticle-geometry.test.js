import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from '../src/reticle/element-types.js';
import { expandInstances, recordPrimitives, elementPrimitives, primitiveHit, hitTestElements, primitiveBounds } from '../src/reticle/geometry.js';

const close = (a, b, eps = 1e-12) => assert.ok(Math.abs(a - b) <= eps, `${a} !== ${b}`);

function bar(overrides = {}) {
  return { ...createElement('hbar', { x: 2, y: 0, end: 10, units: 'mrad' }), nominalWidth: 0.5, endWidth: 0.25, thinningLength: 2, ...overrides };
}

test('a thinning bar widens from the end width at its start to nominal over the thinning length', () => {
  const [p] = recordPrimitives(bar());
  assert.equal(p.kind, 'polygon');
  assert.deepEqual(p.points, [[2, -0.125], [4, -0.25], [10, -0.25], [10, 0.25], [4, 0.25], [2, 0.125]]);
});

test('a bar shorter than its thinning length is cut off mid-taper', () => {
  const [p] = recordPrimitives(bar({ endX: 3 }));
  assert.equal(p.points.length, 4);
  const halfWidthAtEnd = Math.abs(p.points[1][1]);
  close(halfWidthAtEnd, (0.25 + (0.5 - 0.25) * 0.5) / 2);
});

test('a vertical bar runs along y, and a bar pointing left still thins at its start', () => {
  const v = { ...createElement('vbar', { x: 1, y: 3, end: 9, units: 'mrad' }), nominalWidth: 0.5, endWidth: 0, thinningLength: 2 };
  const [pv] = recordPrimitives(v);
  assert.deepEqual(pv.points[0], [1, 3]);
  assert.deepEqual(pv.points[1], [0.75, 5]);
  const [pl] = recordPrimitives(bar({ x: -2, endX: -10 }));
  assert.deepEqual(pl.points[1], [-4, -0.25]);
});

test('a mirrored bar keeps its taper towards the centre', () => {
  const instances = expandInstances(bar({ mirror: true }));
  assert.equal(instances.length, 2);
  const [p] = recordPrimitives(instances[1].record);
  assert.deepEqual(p.points[0], [-2, -0.125], 'thin end at the mirrored start');
  assert.deepEqual(p.points[1], [-4, -0.25]);
});

test('repeats come after the original, then the mirror of each; all copies are derived', () => {
  const dot = { ...createElement('dot', { x: 1, y: 0, units: 'mrad' }), mirror: true, repeat: { enabled: true, direction: 'down', count: 2, step: 0.5 } };
  const instances = expandInstances(dot);
  assert.deepEqual(instances.map((i) => i.role), ['original', 'derived', 'derived', 'derived', 'derived', 'derived']);
  assert.deepEqual(instances.map((i) => [i.record.x, i.record.y]), [[1, 0], [1, 0.5], [1, 1], [-1, 0], [-1, 0.5], [-1, 1]]);
  const left = { ...dot, mirror: false, repeat: { enabled: true, direction: 'left', count: 1, step: 2 } };
  assert.deepEqual(expandInstances(left).map((i) => i.record.x), [1, -1]);
  assert.equal(expandInstances({ ...dot, mirror: false, repeat: { ...dot.repeat, enabled: false } }).length, 1);
});

test('a repeated line moves both its ends', () => {
  const line = { ...createElement('vline', { x: 0, y: 1, end: 2, units: 'mrad' }), repeat: { enabled: true, direction: 'right', count: 1, step: 3 } };
  const copy = expandInstances(line)[1].record;
  assert.equal(copy.x, 3);
  assert.equal(copy.endY, 2);
});

test('chevron: apex up, arms of the given thickness, solid when too thick', () => {
  const chevron = { ...createElement('chevron', { x: 0, y: 0, units: 'mrad' }), overallWidth: 2, height: 1, lineWidth: 0.1 };
  const [p] = recordPrimitives(chevron);
  assert.equal(p.points.length, 6);
  assert.deepEqual(p.points[0], [0, 0]);
  assert.deepEqual(p.points[1], [1, 1]);
  close(p.points[3][1], 0.1 / Math.sin(Math.PI / 4));
  const [solid] = recordPrimitives({ ...chevron, lineWidth: 5 });
  assert.equal(solid.points.length, 3);
});

test('circles, horseshoes and dots', () => {
  const circle = createElement('circle', { x: 1, y: 2, units: 'mrad' });
  assert.equal(recordPrimitives(circle)[0].kind, 'ring');
  assert.equal(recordPrimitives({ ...circle, innerDiameter: 0 })[0].kind, 'disk');
  const shoe = { ...createElement('horseshoe', { x: 0, y: 0, units: 'mrad' }), outerDiameter: 2, innerDiameter: 1, cutoutAngle: Math.PI / 3 };
  const [band] = recordPrimitives(shoe);
  assert.equal(band.kind, 'arcBand');
  assert.ok(primitiveHit(band, 0, -0.75), 'top of the band');
  assert.ok(!primitiveHit(band, 0, 0.75), 'bottom is cut out');
  assert.ok(!primitiveHit(band, 0, 0), 'the hole');
  assert.deepEqual(primitiveBounds(band), { minX: -1, maxX: 1, minY: -1, maxY: 1 });
});

test('hit-testing finds the topmost element, through its derived copies too, with a tolerance', () => {
  const a = { ...createElement('hline', { x: -5, y: 0, end: 5, units: 'mrad' }), id: 'e1', width: 0.05 };
  const b = { ...createElement('dot', { x: 2, y: 0, units: 'mrad' }), id: 'e2', mirror: true };
  assert.equal(hitTestElements([a, b], 2, 0), 'e2');
  assert.equal(hitTestElements([a, b], -2, 0), 'e2', 'the mirror selects its element');
  assert.equal(hitTestElements([a, b], 0, 0.1), null);
  assert.equal(hitTestElements([a, b], 0, 0.1, 0.1), 'e1');
  assert.equal(elementPrimitives(b).filter((p) => p.role === 'derived').length, 1);
});

test('elementsInRect: an element counts when its own shape is wholly inside; a BDC mark by its point', async () => {
  const { createElement } = await import('../src/reticle/element-types.js');
  const { elementsInRect } = await import('../src/reticle/geometry.js');
  const els = [
    { ...createElement('dot', { x: 0.001, y: 0.001, units: 'mrad' }), id: 'a', mirror: true },
    { ...createElement('circle', { x: 0.001, y: 0.001, units: 'mrad' }), id: 'b' },
    { ...createElement('bdc', { x: 0, y: 0.002, units: 'mrad' }), id: 'c' }
  ];
  const rect = { minX: -0.0001, maxX: 0.0015, minY: 0.0005, maxY: 0.0025 };
  // The dot's mirrored copy at x = -1 mrad is outside, which doesn't matter; the 2 mrad circle sticks out.
  assert.deepEqual(elementsInRect(els, rect), ['a', 'c']);
  assert.deepEqual(elementsInRect(els, rect, { skip: (e) => e.type === 'bdc' }), ['a']);
});
