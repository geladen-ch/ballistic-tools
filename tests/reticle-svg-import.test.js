import test from 'node:test';
import assert from 'node:assert/strict';
import { parseXml } from '../src/reticle/svg-import/xml.js';
import { parsePathData, formatCommands, flattenCommands } from '../src/reticle/svg-import/path-data.js';
import { extractShape, parseTransform, LIMITS } from '../src/reticle/svg-import/extract.js';
import { normalizeShape } from '../src/reticle/svg-import/shape.js';

const svg = (body, attrs = '') => `<svg xmlns="http://www.w3.org/2000/svg" ${attrs}>${body}</svg>`;
const code = (fn) => { try { fn(); } catch (err) { return err.code; } return null; };
const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} !== ${b}`);
const near = (actual, expected, eps = 1e-6) => expected.forEach((v, i) => close(actual[i], v, eps));

// ---- XML ----

test('xml: elements, attributes, entities, CDATA and comments', () => {
  const root = parseXml(`<?xml version="1.0"?><!-- hi --><svg a="1 &amp; 2" b='&#x41;'><g/><style><![CDATA[.x{fill:none}]]></style></svg>`);
  assert.equal(root.name, 'svg');
  assert.deepEqual(root.attrs, { a: '1 & 2', b: 'A' });
  assert.equal(root.children[0].name, 'g');
  assert.deepEqual(root.children[1].children, ['.x{fill:none}']);
});

test('xml: DOCTYPE/ENTITY, unknown entities and broken structure are refused', () => {
  assert.equal(code(() => parseXml('<!DOCTYPE svg [<!ENTITY a "aaaa">]><svg>&a;</svg>')), 'doctype');
  assert.equal(code(() => parseXml('<svg>&lol;</svg>')), 'malformedXml');
  assert.equal(code(() => parseXml('<svg><g></svg>')), 'malformedXml');
  assert.equal(code(() => parseXml('<svg><g>')), 'malformedXml');
  assert.equal(code(() => parseXml('<svg a="1" a="2"/>')), 'malformedXml');
  assert.equal(code(() => parseXml('<svg/><svg/>')), 'malformedXml');
  assert.equal(code(() => parseXml('<svg a=1/>')), 'malformedXml');
  assert.equal(code(() => parseXml('<svg>' + '<g>'.repeat(40) + '</g>'.repeat(40) + '</svg>', { maxDepth: 32 })), 'tooDeep');
  assert.equal(code(() => parseXml('<svg>' + '<g/>'.repeat(20) + '</svg>', { maxElements: 10 })), 'tooManyElements');
});

// ---- path data ----

test('path data: relative, H/V, S/T and implicit linetos become absolute M/L/Q/C/Z', () => {
  const cmds = parsePathData('m10 10 5 0 h5 v5 z M0,0 c1 1 2 2 3 3 s4 4 5 5 Q1 1 2 2 t3 3');
  assert.equal(formatCommands(cmds), 'M10 10L15 10L20 10L20 15ZM0 0C1 1 2 2 3 3C4 4 7 7 8 8Q1 1 2 2Q3 3 5 5');
  assert.equal(formatCommands(parsePathData('M1e1-2.5.5.5')), 'M10 -2.5L0.5 0.5');
});

test('path data: arcs become cubic Béziers through the right end point', () => {
  const cmds = parsePathData('M0 0A10 10 0 0 1 20 0');
  assert.ok(cmds.slice(1).every((c) => c.c === 'C'));
  near(cmds[cmds.length - 1].p.slice(4), [20, 0]);
  // A half circle reaches 10 above the chord (sweep 1 goes through negative y here).
  const ys = flattenCommands(cmds)[0].points.map((p) => p[1]);
  close(Math.min(...ys), -10, 0.05);
  // Flags written without separators.
  assert.equal(parsePathData('M0 0a5 5 0 1020 0').length > 1, true);
});

test('path data: malformed or absurd input is refused', () => {
  assert.equal(code(() => parsePathData('L0 0')), 'badPathData');
  assert.equal(code(() => parsePathData('M0 0 L1')), 'badPathData');
  assert.equal(code(() => parsePathData('M0 0 X1 1')), 'badPathData');
  assert.equal(code(() => parsePathData('M0 0 L1e400 0')), 'badNumber');
  assert.equal(code(() => parsePathData('M0 0 A1 1 0 2 1 3 3')), 'badPathData');
  assert.equal(code(() => parsePathData('M0 0' + ' L1 1'.repeat(20), { segments: 10 })), 'tooComplex');
});

test('transforms: lists compose left to right; rotate about a point; junk is refused', () => {
  near(parseTransform('translate(10 20) scale(2)'), [2, 0, 0, 2, 10, 20]);
  near(parseTransform('rotate(90 10 0)'), [0, 1, -1, 0, 10, -10]);
  near(parseTransform('matrix(1,0,0,1,5,6)'), [1, 0, 0, 1, 5, 6]);
  assert.equal(code(() => parseTransform('translate(1) evil()')), 'badTransform');
  assert.equal(code(() => parseTransform('scale()')), 'badTransform');
});

// ---- extraction ----

test('extract: shapes in user units with transforms; fills and strokes; ink bounds', () => {
  const shape = extractShape(svg(
    '<rect x="-1" y="-1" width="2" height="2"/>'
    + '<g transform="translate(10 0)"><line x1="0" y1="0" x2="0" y2="4" stroke="red" stroke-width="0.5"/></g>'
    + '<circle cx="0" cy="10" r="1" fill="#123" />',
    'viewBox="0 0 100 100" width="10mm"'));
  assert.equal(shape.paths.length, 3);
  assert.equal(shape.paths[0].fill, true);
  assert.equal(shape.paths[0].stroke, 0);
  assert.equal(shape.paths[1].fill, false, 'a line encloses nothing — only its stroke is ink');
  assert.equal(shape.paths[1].stroke, 0.5);
  assert.ok(shape.paths[1].d.startsWith('M10 0'), 'the transform is applied');
  near(shape.bounds, [-1, -1, 10.25, 11], 0.01);
  assert.deepEqual(shape.warnings, []);
});

test('extract: any visible colour is ink; none, transparent, zero opacity, hidden and display:none are not', () => {
  const shape = extractShape(svg(
    '<rect width="1" height="1" fill="white"/>'
    + '<rect width="1" height="1" fill="none"/>'
    + '<rect width="1" height="1" fill="transparent"/>'
    + '<rect width="1" height="1" fill-opacity="0"/>'
    + '<rect width="1" height="1" style="visibility:hidden"/>'
    + '<g style="display:none"><rect width="1" height="1"/></g>'
    + '<g opacity="0"><rect width="1" height="1"/></g>'
    + '<rect width="1" height="1" fill="none" stroke="currentColor"/>'));
  assert.equal(shape.paths.length, 2);
  assert.equal(shape.paths[1].fill, false);
  assert.equal(shape.paths[1].stroke, 1);
});

test('extract: style sheets with simple selectors, inline style beats attributes', () => {
  const shape = extractShape(svg(
    '<style>.st0{fill:none;stroke:#000;stroke-width:2} #big{stroke-width:4} rect{fill-rule:evenodd}</style>'
    + '<path class="st0" d="M0 0L5 0"/><path id="big" class="st0" d="M0 2L5 2"/>'
    + '<rect width="2" height="2" fill="none" style="fill:black"/>'));
  assert.deepEqual(shape.paths.map((p) => [p.fill, p.stroke, p.fillRule]), [[false, 2, 'nonzero'], [false, 4, 'nonzero'], [true, 0, 'evenodd']]);
});

test('extract: <use> of shapes and symbols, with loops and runaway expansion refused', () => {
  const shape = extractShape(svg('<defs><path id="p" d="M0 0L1 0L1 1Z"/><symbol id="s"><use href="#p"/></symbol></defs>'
    + '<use xlink:href="#p" x="5"/><use href="#s" y="5"/>', 'xmlns:xlink="http://www.w3.org/1999/xlink"'));
  assert.equal(shape.paths.length, 2, 'defs content is drawn only through <use>');
  assert.ok(shape.paths[0].d.startsWith('M5 0'));
  assert.ok(shape.paths[1].d.startsWith('M0 5'));
  assert.equal(code(() => extractShape(svg('<g id="a"><use href="#a"/></g>'))), 'useLoop');
  // Each level references the previous one twice: 2^12 copies.
  let defs = '<path id="l0" d="M0 0L1 1"/>';
  for (let k = 1; k <= 12; k++) defs += `<g id="l${k}"><use href="#l${k - 1}"/><use href="#l${k - 1}"/></g>`;
  assert.equal(code(() => extractShape(svg(`<defs>${defs}</defs><use href="#l12"/>`))), 'tooComplex');
});

test('extract: scripts, foreign content, images and metadata leave nothing behind', () => {
  const shape = extractShape(svg(
    '<script>alert(1)</script><foreignObject><div xmlns="http://www.w3.org/1999/xhtml">x</div></foreignObject>'
    + '<metadata><rdf:RDF xmlns:rdf="x"/></metadata><sodipodi:namedview xmlns:sodipodi="y"/>'
    + '<image href="data:image/png;base64,AAAA"/><a href="javascript:alert(1)"><rect width="1" height="1" onclick="alert(1)"/></a>'));
  assert.equal(shape.paths.length, 1);
  assert.deepEqual(Object.keys(shape.paths[0]).sort(), ['cap', 'd', 'fill', 'fillRule', 'join', 'miter', 'stroke']);
  assert.ok(/^[MLQCZ0-9 .eE+-]+$/.test(shape.paths[0].d), 'path data is numbers and commands only');
  assert.deepEqual(shape.warnings, ['images']);
});

test('extract: warns about what is drawn differently (clips, dashes, markers)', () => {
  const shape = extractShape(svg('<path d="M0 0L5 0" stroke="#000" stroke-dasharray="1 1" clip-path="url(#c)" marker-end="url(#m)"/>'));
  assert.deepEqual(shape.warnings.sort(), ['clips', 'dashes', 'markers']);
});

test('extract: refusals — text, non-SVG, empty drawing, units, size and complexity limits', () => {
  assert.equal(code(() => extractShape(svg('<text>12</text>'))), 'text');
  assert.equal(code(() => extractShape(svg('<defs><text>12</text></defs>'))), 'text');
  assert.equal(code(() => extractShape('<html/>')), 'notSvg');
  assert.equal(code(() => extractShape('')), 'empty');
  assert.equal(code(() => extractShape('not xml at all')), 'malformedXml');
  assert.equal(code(() => extractShape(svg('<rect width="1" height="1" fill="none"/>'))), 'nothingToDraw');
  assert.equal(code(() => extractShape(svg('<line x2="5"/>'))), 'nothingToDraw');
  assert.equal(code(() => extractShape(svg('<rect width="10mm" height="1"/>'))), 'unsupportedUnit');
  assert.equal(code(() => extractShape(svg('<rect width="1" height="1"/>') + ' '.repeat(LIMITS.maxChars))), 'tooLarge');
  assert.equal(code(() => extractShape(svg('<path d="M0 0' + ' L1 1'.repeat(LIMITS.maxSegments) + '"/>'))), 'tooComplex');
  assert.equal(code(() => extractShape(svg('<rect width="1" height="1" transform="scale(1e9)"/>'))), 'badNumber');
  assert.equal(code(() => extractShape(svg('<path d="M0 0L1 NaN"/>'))), 'badPathData');
});

test('extract: a nested <svg> viewport places and fits its content', () => {
  const shape = extractShape(svg('<svg x="10" y="10" width="10" height="10" viewBox="0 0 100 100"><rect width="100" height="100"/></svg>'));
  near(shape.bounds, [10, 10, 20, 20], 1e-6);
});

test('extract: random garbage never escapes as anything but an ImportError', () => {
  let seed = 7;
  const rand = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const pieces = ['<svg>', '</svg>', '<path d="', 'M0 0', 'L', '1e9', 'A1 1 0 1 1', '"/>', '<g transform="', 'scale(', ')', '">', '</g>', '&amp;', '<!--', '-->', '<use href="#a" id="a"/>', '<rect width="1" height="1"/>', '"', "'", '<', '>'];
  for (let k = 0; k < 2000; k++) {
    let text = '';
    const n = 1 + Math.floor(rand() * 12);
    for (let j = 0; j < n; j++) text += pieces[Math.floor(rand() * pieces.length)];
    try {
      const shape = extractShape(text);
      assert.ok(shape.paths.length > 0);
    } catch (err) {
      assert.equal(err.name, 'ImportError', `${text} threw ${err}`);
    }
  }
});

// ---- stored shapes ----

test('normalizeShape: re-validates a stored shape and recomputes its bounds', () => {
  const shape = extractShape(svg('<rect x="1" y="2" width="3" height="4"/>'));
  const again = normalizeShape({ ...shape, bounds: [0, 0, 999, 999], extra: 'x' });
  near(again.bounds, [1, 2, 4, 6]);
  assert.equal(again.paths[0].d, shape.paths[0].d);
  assert.equal(code(() => normalizeShape({ paths: [{ d: 'M0 0L1 1<script>', fill: true }] })), 'badPathData');
  assert.equal(code(() => normalizeShape({ paths: [{ d: 'M0 0L1 1', fill: false, stroke: 0 }] })), 'badShape');
  assert.equal(code(() => normalizeShape({ paths: [] })), 'badShape');
  assert.equal(code(() => normalizeShape(null)), 'badShape');
});

// ---- the element ----

test('SVG shape element: origin placement, scale, reflect on and off when mirrored, exact hit-testing', async () => {
  const { createElement } = await import('../src/reticle/element-types.js');
  const { expandInstances, recordPrimitives, primitiveHit } = await import('../src/reticle/geometry.js');
  // An L: a filled 1×3 bar plus a stroked foot, origin at its top-left.
  const shape = extractShape(svg('<rect width="1" height="3"/><path d="M0 3L3 3" stroke="#000" stroke-width="0.2" fill="none"/>'));
  const element = { ...createElement('svg', { x: 2, y: 1, units: 'mrad', svg: { shape, name: 'L' } }), scale: 0.5, mirror: true };
  const [orig, mirrored] = expandInstances(element).map((i) => recordPrimitives(i.record)[0]);
  assert.deepEqual([orig.bounds.minX, orig.bounds.maxX], [2, 3.5]);
  assert.ok(primitiveHit(orig, 2.25, 1.5), 'inside the bar');
  assert.ok(!primitiveHit(orig, 3, 1.5), 'beside the bar, inside the bounding box');
  assert.ok(primitiveHit(orig, 3, 2.5), 'on the stroked foot');
  assert.equal(mirrored.flip, true);
  assert.deepEqual([mirrored.bounds.minX, mirrored.bounds.maxX], [-3.5, -2]);
  assert.ok(primitiveHit(mirrored, -2.25, 1.5));
  const kept = recordPrimitives(expandInstances({ ...element, reflect: false })[1].record)[0];
  assert.equal(kept.flip, false);
  assert.deepEqual([kept.bounds.minX, kept.bounds.maxX], [-2, -0.5]);
});

test('SVG shape element: survives a file round trip; a tampered shape in a file is refused', async () => {
  const { createElement } = await import('../src/reticle/element-types.js');
  const { createDocument, addElement } = await import('../src/reticle/model.js');
  const { serializeReticle, parseReticle } = await import('../src/reticle/file-codec.js');
  const shape = extractShape(svg('<circle r="2"/>'));
  const doc = addElement(createDocument(), { ...createElement('svg', { x: 0.001, y: 0, units: 'mrad', svg: { shape, name: 'ring' } }), reflect: false }).doc;
  const loaded = parseReticle(serializeReticle(doc)).elements[0];
  assert.equal(loaded.name, 'ring');
  assert.equal(loaded.reflect, false);
  assert.equal(loaded.scale, doc.elements[0].scale);
  assert.deepEqual(loaded.shape.paths, shape.paths);
  const raw = JSON.parse(serializeReticle(doc));
  raw.elements[0].shape.paths[0].d = 'M0 0L1 1"/><script>';
  assert.throws(() => parseReticle(JSON.stringify(raw)), (err) => err.code === 'invalid-format');
});

test('ink bounds: butt, square and round caps; miter tips within the limit; round joins', async () => {
  const { inkBounds } = await import('../src/reticle/svg-import/path-data.js');
  const line = [{ points: [[0, 0], [10, 0]], closed: false }];
  near(inkBounds(line, { stroke: 2, cap: 'butt' }), [0, -1, 10, 1]);
  near(inkBounds(line, { stroke: 2, cap: 'square' }), [-1, -1, 11, 1]);
  near(inkBounds(line, { stroke: 2, cap: 'round' }), [-1, -1, 11, 1]);
  const corner = [{ points: [[0, 0], [10, 0], [10, 10]], closed: false }];
  near(inkBounds(corner, { stroke: 2, join: 'miter', miter: 4 }), [0, -1, 11, 10]);
  near(inkBounds(corner, { stroke: 2, join: 'bevel' }), [0, -1, 11, 10]);
  // A sharp spike: the miter tip exceeds the limit and is cut off (bevel).
  const spike = [{ points: [[0, 0], [10, 0.2], [0, 0.4]], closed: false }];
  assert.ok(inkBounds(spike, { stroke: 2, join: 'miter', miter: 4 })[2] < 11.1);
  assert.ok(inkBounds(spike, { stroke: 2, join: 'miter', miter: 100 })[2] > 50);
  near(inkBounds(corner, { stroke: 2, join: 'round' }), [0, -1, 11, 10]);
  assert.equal(inkBounds(line, { stroke: 0, fill: false }), null);
});

test('client: a worker that never answers, crashes or answers garbage resolves to a refusal', async () => {
  const { importSvg, loadReticleFile, setImportersForTests, IMPORT_TIMEOUT_MS } = await import('../src/reticle/svg-import/client.js');
  setImportersForTests({});
  const realWorker = global.Worker;
  const realSetTimeout = global.setTimeout;
  try {
    let terminated = 0;
    const fake = (behaviour) => class {
      constructor() { this.terminate = () => { terminated++; }; }
      postMessage() { behaviour(this); }
    };
    // Never answers: the timer fires (sped up here) and the worker is killed.
    global.setTimeout = (fn, ms) => realSetTimeout(fn, ms === IMPORT_TIMEOUT_MS ? 1 : ms);
    global.Worker = fake(() => {});
    assert.deepEqual(await importSvg('<svg/>'), { ok: false, code: 'timeout', detail: {} });
    global.Worker = fake((w) => w.onerror(new Error('boom')));
    assert.equal((await importSvg('<svg/>')).code, 'unexpected');
    global.Worker = fake((w) => w.onmessage({ data: 'garbage' }));
    assert.equal((await importSvg('<svg/>')).code, 'unexpected');
    global.Worker = class { constructor() { throw new Error('no workers'); } };
    assert.equal((await importSvg('<svg/>')).code, 'unexpected');
    assert.equal(terminated, 3);
    // Loading a reticle file goes through the same worker and the same guards.
    global.Worker = fake(() => {});
    assert.equal((await loadReticleFile('{}')).code, 'timeout');
    global.Worker = fake((w) => w.onmessage({ data: { ok: true, shape: {} } }));
    assert.equal((await loadReticleFile('{}')).code, 'unexpected', 'a reply without a document is refused');
  } finally {
    global.Worker = realWorker;
    global.setTimeout = realSetTimeout;
  }
});
