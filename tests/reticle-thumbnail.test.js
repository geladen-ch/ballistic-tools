import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from './helpers/fake-dom.js';

installFakeDom();

const { reticleThumbnail } = await import('../src/ui/reticle-thumbnail.js');
const { createDocument, addElement, setIllumination } = await import('../src/reticle/model.js');
const { createElement } = await import('../src/reticle/element-types.js');
const { fieldRadiusAtZoom, referenceOptics } = await import('../src/reticle/scope.js');
const { mradToRad } = await import('../src/quantity.js');

function findAll(node, predicate, out = []) {
  if (predicate(node)) out.push(node);
  for (const child of node.childNodes || []) findAll(child, predicate, out);
  return out;
}
const classesOf = (n) => (n.getAttribute?.('class') || '').split(' ');
const byClass = (root, cls) => findAll(root, (n) => classesOf(n).includes(cls));

function sample() {
  let doc = createDocument({ referenceScope: { type: 'ffp', zoomMin: 3, zoomMax: 20, calibrationZoom: 20 } });
  doc = addElement(doc, createElement('dot', { x: 0, y: 0, units: 'mrad' })).doc;
  doc = addElement(doc, { ...createElement('hline', { x: mradToRad(1), y: 0, end: mradToRad(5), units: 'mrad' }), illuminated: true }).doc;
  doc = addElement(doc, createElement('bdc', { x: 0, y: mradToRad(3), units: 'mrad' })).doc;
  return doc;
}

test('a thumbnail draws the field circle and every drawn element, sized as asked', () => {
  const doc = sample();
  const svg = reticleThumbnail(doc, { size: 64, label: 'P4LF' });
  assert.equal(svg.tagName.toLowerCase(), 'svg');
  assert.equal(svg.getAttribute('width'), '64');
  assert.equal(svg.getAttribute('aria-label'), 'P4LF');
  assert.ok(classesOf(svg).includes('reticle-thumbnail'));
  assert.equal(byClass(svg, 'reticle-glass').length, 1);
  assert.equal(byClass(svg, 'reticle-rim')[0].getAttribute('r'), '480');
  // The dot and the line; a BDC mark is not part of the drawn reticle.
  assert.equal(byClass(svg, 'reticle-shape').length, 2);
  // Scaled so the field at the top of the zoom range fills the circle: the dot at the centre.
  const radius = fieldRadiusAtZoom(referenceOptics(doc.referenceScope), 20);
  const dot = byClass(svg, 'reticle-shape')[0].getAttribute('d');
  const r = (doc.elements[0].diameter / 2) * (480 / radius);
  assert.ok(dot.startsWith(`M${(Math.round((500 - r) * 100) / 100)} 500`), dot);
});

test('lit elements and the illumination colour show only on an illuminated reticle', () => {
  const unlit = reticleThumbnail(sample());
  assert.ok(!byClass(unlit, 'lit').length);
  assert.ok(!classesOf(unlit).some((c) => c.startsWith('illum-')));
  const lit = reticleThumbnail(setIllumination(sample(), { enabled: true, colour: 'green' }));
  assert.ok(classesOf(lit).includes('illum-green'));
  assert.equal(byClass(lit, 'lit').length, 1);
});

test('each thumbnail clips with its own id; a broken element or scope does not break the picture', () => {
  const a = reticleThumbnail(sample());
  const b = reticleThumbnail(sample());
  const clipOf = (svg) => findAll(svg, (n) => n.tagName.toLowerCase() === 'clippath')[0].getAttribute('id');
  assert.notEqual(clipOf(a), clipOf(b));
  const broken = { ...sample(), referenceScope: { type: 'ffp', zoomMin: NaN, zoomMax: NaN }, elements: [{ type: 'dot', x: 0, y: 0 }, ...sample().elements] };
  const svg = reticleThumbnail(broken);
  assert.equal(byClass(svg, 'reticle-rim').length, 1);
  assert.ok(byClass(svg, 'reticle-shape').length >= 2);
});
