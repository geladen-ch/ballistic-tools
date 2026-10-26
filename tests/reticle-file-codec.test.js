import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from '../src/reticle/element-types.js';
import { createDocument, addElement, groupElements } from '../src/reticle/model.js';
import { serializeReticle, parseReticle, reticleFilename, FILE_FORMAT } from '../src/reticle/file-codec.js';

function sampleDoc() {
  let doc = createDocument({ name: 'Test reticle' });
  const ids = [];
  for (const e of [
    createElement('hline', { x: -0.005, y: 0, end: 0.005, units: 'mrad' }),
    { ...createElement('dot', { x: 0.002, y: 0.001, units: 'moa' }), mirror: true },
    createElement('horseshoe', { x: 0, y: 0, units: 'mrad' })
  ]) {
    const r = addElement(doc, e);
    doc = r.doc;
    ids.push(r.id);
  }
  return groupElements(doc, ids.slice(1)).doc;
}

const strip = (doc) => ({ ...doc, nextId: undefined });

test('a reticle survives a save/load round trip unchanged, angles in radians', () => {
  const doc = sampleDoc();
  const text = serializeReticle(doc);
  assert.equal(JSON.parse(text).format, FILE_FORMAT);
  const loaded = parseReticle(text);
  assert.deepEqual(strip(loaded), strip(doc));
});

test('loading assigns fresh ids and drops groups with fewer than two members', () => {
  const raw = JSON.parse(serializeReticle(sampleDoc()));
  raw.elements[0].id = 'zzz';
  raw.elements[0].groupId = 'lonely';
  const loaded = parseReticle(JSON.stringify(raw));
  assert.deepEqual(loaded.elements.map((e) => e.id), ['e1', 'e2', 'e3']);
  assert.equal(loaded.elements[0].groupId, null);
  assert.equal(loaded.groups.length, 1);
  assert.ok(loaded.nextId > 3);
});

test('rejects bad JSON, foreign files, newer versions and invalid elements', () => {
  const code = (text) => { try { parseReticle(text); } catch (err) { return err.code; } return null; };
  assert.equal(code('{nope'), 'invalid-json');
  assert.equal(code(JSON.stringify({ format: 'something-else', version: 1, elements: [] })), 'invalid-format');
  const raw = JSON.parse(serializeReticle(sampleDoc()));
  assert.equal(code(JSON.stringify({ ...raw, version: 99 })), 'unsupported-version');
  assert.equal(code(JSON.stringify({ ...raw, elements: [{ ...raw.elements[0], type: 'teapot' }] })), 'invalid-format');
  assert.equal(code(JSON.stringify({ ...raw, elements: [{ ...raw.elements[0], width: -1 }] })), 'invalid-format');
  assert.equal(code(JSON.stringify({ ...raw, elements: [{ ...raw.elements[0], x: 'left' }] })), 'invalid-format');
});

test('reticleFilename makes a safe name', () => {
  assert.equal(reticleFilename('My  Reticle/v2'), 'My-Reticlev2.reticle.json');
  assert.equal(reticleFilename(''), 'reticle.reticle.json');
});

test('numbers survive a round trip', () => {
  let doc = sampleDoc();
  doc = addElement(doc, { ...createElement('number', { x: 0.003, y: 0.001, units: 'mrad' }), text: '10', anchor: 'right', font: 'overpass-light' }).doc;
  const text = serializeReticle(doc);
  assert.equal(JSON.parse(text).version, 1);
  const withoutIds = ({ id, groupId, ...rest }) => rest;
  assert.deepEqual(parseReticle(text).elements.map(withoutIds), doc.elements.map(withoutIds));
  const raw = JSON.parse(text);
  raw.elements[3].text = '1a';
  assert.throws(() => parseReticle(JSON.stringify(raw)), (err) => err.code === 'invalid-format');
});

// ---- every element type, saved and loaded ----

import { ELEMENT_TYPE_IDS } from '../src/reticle/element-types.js';
import { updateScope } from '../src/reticle/model.js';
import { extractShape } from '../src/reticle/svg-import/extract.js';
import { storedElement, FILE_LIMITS } from '../src/reticle/file-codec.js';

function everyTypeDoc() {
  let doc = updateScope(createDocument({ name: 'All types' }), { type: 'sfp', calibrationZoom: 12 });
  const shape = extractShape('<svg xmlns="http://www.w3.org/2000/svg"><rect width="4" height="2"/><path d="M0 3L4 3" stroke="#000" stroke-width="0.5" stroke-linecap="round"/></svg>');
  for (const [i, type] of ELEMENT_TYPE_IDS.entries()) {
    const x = 0.0001 * (i + 1);
    let e = createElement(type, { x, y: -x, end: 3 * x, units: i % 2 ? 'moa' : 'mrad', svg: { shape, name: 'logo' } });
    if (type !== 'bdc') e = { ...e, mirror: i % 2 === 0, repeat: { enabled: i % 3 === 0, direction: 'left', count: 3, step: 0.0005 } };
    if (type === 'number') e = { ...e, text: '42', anchor: 'right', font: 'overpass-light' };
    if (type === 'svg') e = { ...e, reflect: false, scale: 0.0002 };
    doc = addElement(doc, e).doc;
  }
  return groupElements(doc, doc.elements.slice(0, 3).map((e) => e.id)).doc;
}

test('every element type saves and loads back exactly, with its groups and scope', () => {
  const doc = everyTypeDoc();
  const loaded = parseReticle(serializeReticle(doc));
  const withoutIds = ({ id, groupId, ...rest }) => rest;
  // A stored shape is canonical, so it loads back identical except for its
  // import-time warnings (not stored).
  const comparable = (e) => (e.type === 'svg' ? { ...withoutIds(e), shape: { ...e.shape, warnings: undefined } } : withoutIds(e));
  assert.deepEqual(loaded.elements.map(comparable), doc.elements.map(comparable));
  assert.deepEqual(loaded.scope, doc.scope);
  assert.equal(loaded.name, 'All types');
  assert.equal(loaded.groups.length, 1);
  assert.deepEqual(loaded.elements.map((e) => Boolean(e.groupId)), doc.elements.map((e) => Boolean(e.groupId)));
  // And again: a loaded reticle saves to the same file.
  assert.equal(serializeReticle(parseReticle(serializeReticle(loaded))), serializeReticle(loaded));
});

test('saving writes only each type\'s own fields', () => {
  const doc = everyTypeDoc();
  const polluted = doc.elements.map((e) => ({ ...e, reflected: true, junk: '<script>', onclick: 'alert(1)' }));
  for (const e of polluted) {
    const stored = storedElement(e);
    assert.ok(!('junk' in stored) && !('onclick' in stored) && !('reflected' in stored), e.type);
  }
  const svg = storedElement(polluted.find((e) => e.type === 'svg'));
  assert.deepEqual(Object.keys(svg.shape), ['paths']);
  assert.deepEqual(Object.keys(svg.shape.paths[0]).sort(), ['cap', 'd', 'fill', 'fillRule', 'join', 'miter', 'stroke']);
});

// ---- loading is untrusted input ----

test('loading keeps only known fields, whatever else a file carries', () => {
  const raw = JSON.parse(serializeReticle(everyTypeDoc()));
  raw.elements = raw.elements.map((e) => ({ ...e, junk: 1, onclick: 'alert(1)', __proto__: { polluted: true } }));
  raw.scope.extra = 'x';
  raw.elements[0] = JSON.parse(JSON.stringify(raw.elements[0]).replace('{', '{"__proto__":{"polluted":true},'));
  const loaded = parseReticle(JSON.stringify(raw));
  for (const e of loaded.elements) assert.ok(!('junk' in e) && !('onclick' in e) && !e.polluted, e.type);
  assert.ok(!('extra' in loaded.scope));
  assert.equal({}.polluted, undefined);
});

test('loading refuses out-of-range values, runaway repeats, tampered shapes and over-limit files', () => {
  const base = JSON.parse(serializeReticle(everyTypeDoc()));
  const code = (mutate) => {
    const raw = JSON.parse(JSON.stringify(base));
    mutate(raw);
    try { parseReticle(JSON.stringify(raw)); } catch (err) { return err.code; }
    return null;
  };
  assert.equal(code(() => {}), null);
  assert.equal(code((r) => { r.elements[0].x = 7; }), 'invalid-format', 'a position beyond half a turn');
  assert.equal(code((r) => { r.elements[0].width = 1e300; }), 'invalid-format');
  assert.equal(code((r) => { r.elements[0].repeat = { enabled: true, direction: 'up', count: 1e9, step: 0.001 }; }), 'invalid-format');
  const number = base.elements.findIndex((e) => e.type === 'number');
  assert.equal(code((r) => { r.elements[number].text = '1'.repeat(100); }), 'invalid-format');
  assert.equal(code((r) => { r.elements[number].font = '../../etc/passwd'; }), 'invalid-format');
  const svg = base.elements.findIndex((e) => e.type === 'svg');
  assert.equal(code((r) => { r.elements[svg].shape.paths[0].d = 'M0 0L1 1"/><script>alert(1)</script>'; }), 'invalid-format');
  assert.equal(code((r) => { r.elements[svg].shape.paths[0].d = 'M0 0' + ' L1 1'.repeat(100001); }), 'invalid-format');
  assert.equal(code((r) => { r.elements[svg].scale = 1e6; }), 'invalid-format');
  assert.equal(code((r) => { r.scope.fovMaxRad = -1; }), 'invalid-format');
  assert.equal(code((r) => { r.scope.calibrationZoom = 1e9; }), 'invalid-format');
  // Many elements, each repeated hard: within the per-element limit, over the drawn-copy total.
  assert.equal(code((r) => {
    r.elements = Array.from({ length: 200 }, () => ({ ...base.elements[1], groupId: null, mirror: true, repeat: { enabled: true, direction: 'up', count: 500, step: 0.0001 } }));
  }), 'too-large');
  assert.equal(code((r) => { r.elements = Array.from({ length: FILE_LIMITS.maxElements + 1 }, () => base.elements[1]); }), 'too-large');
  assert.equal(code((r) => { r.name = 'x'.repeat(FILE_LIMITS.maxChars); }), 'too-large');
});

test('a long reticle name is cut to 80 characters', () => {
  const raw = JSON.parse(serializeReticle(everyTypeDoc()));
  raw.name = 'n'.repeat(500);
  assert.equal(parseReticle(JSON.stringify(raw)).name.length, 80);
});

// ---- BDC marks ----

test('a BDC mark is saved as its position alone, and loads back on the vertical axis without mirror or repeat', () => {
  const doc = addElement(createDocument(), createElement('bdc', { x: 0.004, y: 0.003, units: 'mrad' })).doc;
  const stored = JSON.parse(serializeReticle(doc)).elements[0];
  assert.deepEqual(Object.keys(stored).sort(), ['groupId', 'id', 'type', 'x', 'y']);
  assert.equal(stored.x, 0, 'placed off the axis, it lands on it');
  // A file that claims a mirror or repeat for it gets neither.
  const raw = JSON.parse(serializeReticle(doc));
  raw.elements[0] = { ...raw.elements[0], mirror: true, repeat: { enabled: true, direction: 'down', count: 5, step: 0.001 } };
  const loaded = parseReticle(JSON.stringify(raw)).elements[0];
  assert.equal(loaded.mirror, false);
  assert.equal(loaded.repeat.enabled, false);
  assert.equal(loaded.y, 0.003);
  // One off the axis is a damaged file.
  raw.elements[0].x = 0.001;
  assert.throws(() => parseReticle(JSON.stringify(raw)), (err) => err.code === 'invalid-format');
});

// ---- illumination ----

test('illumination and each element\'s lit flag save and load back; a file without them is an unlit reticle', async () => {
  const { setIllumination } = await import('../src/reticle/model.js');
  let doc = setIllumination(createDocument(), { enabled: true, colour: 'green' });
  doc = addElement(doc, createElement('dot', { x: 0.001, y: 0, units: 'mrad', illuminated: true })).doc;
  doc = addElement(doc, createElement('hline', { x: 0.001, y: 0, end: 0.002, units: 'mrad' })).doc;
  doc = addElement(doc, createElement('bdc', { x: 0, y: 0.002, units: 'mrad', illuminated: true })).doc;
  assert.ok(!('illuminated' in doc.elements[2]), 'a BDC mark has no lit flag');
  const text = serializeReticle(doc);
  const loaded = parseReticle(text);
  assert.deepEqual(loaded.illumination, { enabled: true, colour: 'green' });
  assert.deepEqual(loaded.elements.map((e) => e.illuminated), [true, false, undefined]);
  assert.ok(!('illuminated' in JSON.parse(text).elements[2]));

  const raw = JSON.parse(text);
  delete raw.illumination;
  raw.elements[2].illuminated = true;
  const plain = parseReticle(JSON.stringify(raw));
  assert.deepEqual(plain.illumination, { enabled: false, colour: 'red' });
  assert.ok(!('illuminated' in plain.elements[2]), 'ignored on a BDC mark');
  assert.equal(plain.elements[0].illuminated, true, 'kept while the reticle is unlit');

  raw.illumination = { enabled: true, colour: 'purple' };
  assert.throws(() => parseReticle(JSON.stringify(raw)), (err) => err.code === 'invalid-format');
  raw.illumination = 'on';
  assert.throws(() => parseReticle(JSON.stringify(raw)), (err) => err.code === 'invalid-format');
});
