import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from '../src/reticle/element-types.js';
import { createDocument, addElement, groupElements, setIllumination } from '../src/reticle/model.js';
import { encodeReticleRecord, decodeReticleRecord } from '../src/reticle/reticle-record.js';

function sample() {
  let doc = createDocument({ referenceScope: { type: 'sfp', zoomMin: 4, zoomMax: 16, calibrationZoom: 10 } });
  const ids = [];
  for (const e of [
    createElement('hline', { x: -0.005, y: 0, end: 0.005, units: 'mrad' }),
    { ...createElement('dot', { x: 0.002, y: 0.001, units: 'mrad' }), mirror: true },
    createElement('circle', { x: 0, y: 0, units: 'mrad' })
  ]) {
    const r = addElement(doc, e);
    doc = r.doc;
    ids.push(r.id);
  }
  doc = groupElements(doc, ids.slice(1)).doc;
  const { name, ...rest } = doc;
  return { ...rest, id: 'user-reticle-1', manufacturer: 'Acme', model: 'Mil-Dot' };
}

test('a reticle record round-trips; the name is manufacturer and model', () => {
  const reticle = sample();
  const stored = encodeReticleRecord(reticle);
  assert.equal(stored.name, 'Acme Mil-Dot');
  assert.deepEqual(Object.keys(stored), ['id', 'name', 'manufacturer', 'model', 'referenceScope', 'elements']);
  assert.ok(!('id' in stored.elements[0]), 'element ids are not stored');
  const back = decodeReticleRecord(stored);
  // What shapes the reticle comes back (a repeat that is off loses its
  // unused settings, as in a file — see stored-reticle.js).
  assert.equal(back.name, 'Acme Mil-Dot');
  assert.deepEqual(back.referenceScope, reticle.referenceScope);
  assert.deepEqual(back.illumination, { enabled: false, colour: 'red' });
  assert.deepEqual(back.elements.map((e) => [e.type, e.x, e.y, e.mirror]), reticle.elements.map((e) => [e.type, e.x, e.y, e.mirror]));
  assert.deepEqual(back.elements.map((e) => Boolean(e.groupId)), [false, true, true]);
  assert.equal(back.groups.length, 1);
  assert.deepEqual(encodeReticleRecord(back), stored, 'and encodes back to the same record');
});

test('illumination is stored only when not the default', () => {
  const lit = setIllumination(sample(), { enabled: true, colour: 'green' });
  assert.deepEqual(encodeReticleRecord(lit).illumination, { enabled: true, colour: 'green' });
  assert.deepEqual(decodeReticleRecord(encodeReticleRecord(lit)).illumination, { enabled: true, colour: 'green' });
});

test('bookkeeping and unknown top-level fields pass through; document-only ones do not', () => {
  const reticle = { ...sample(), modifiedAt: '2026-10-01T00:00:00.000Z', revision: 3, unsaved: true, futureField: { a: 1 } };
  const stored = encodeReticleRecord(reticle);
  assert.equal(stored.revision, 3);
  assert.deepEqual(stored.futureField, { a: 1 });
  assert.ok(!('groups' in stored) && !('nextId' in stored));
  const back = decodeReticleRecord({ ...stored, groups: [{ id: 'gX' }], nextId: 999 });
  assert.equal(back.revision, 3);
  assert.deepEqual(back.futureField, { a: 1 });
  assert.equal(back.groups.length, 1);
  assert.notEqual(back.groups[0].id, 'gX', 'groups are rebuilt from the elements, never taken from the record');
  assert.ok(back.nextId < 999);
});

test('a tombstone passes through both ways', () => {
  const tomb = { id: 'r', name: 'Acme X', deletedAt: '2026-01-01T00:00:00.000Z', elements: [] };
  assert.equal(encodeReticleRecord(tomb), tomb);
  assert.equal(decodeReticleRecord(tomb), tomb);
});

test('decoding is untrusted: a bad record throws with a code', () => {
  const stored = encodeReticleRecord(sample());
  const code = (record) => {
    try { decodeReticleRecord(record); } catch (err) { return err.code; }
    return null;
  };
  assert.equal(code(stored), null);
  assert.equal(code(null), 'invalid-format');
  assert.equal(code({ ...stored, referenceScope: { type: 'ffp', zoomMin: 10, zoomMax: 2 } }), 'invalid-format');
  assert.equal(code({ ...stored, elements: 'x' }), 'invalid-format');
  assert.equal(code({ ...stored, elements: [{ type: 'dot', x: 99, y: 0, diameter: 0.001 }] }), 'invalid-format');
  assert.equal(code({ ...stored, illumination: { enabled: true, colour: 'purple' } }), 'invalid-format');
  assert.equal(code({ ...stored, elements: Array.from({ length: 5001 }, () => stored.elements[1]) }), 'too-large');
  // Over-long or non-string text fields are cut or emptied, not refused.
  const odd = decodeReticleRecord({ ...stored, manufacturer: 'm'.repeat(500), model: 42 });
  assert.equal(odd.manufacturer.length, 80);
  assert.equal(odd.model, '');
});

test('a reference scope is stored with only the fields its type uses', () => {
  const keysFor = (referenceScope) => Object.keys(encodeReticleRecord({ ...sample(), referenceScope }).referenceScope);
  assert.deepEqual(keysFor({ type: 'fixed', zoomMin: 4, zoomMax: 4, calibrationZoom: 4 }), ['type', 'zoomMin']);
  assert.deepEqual(keysFor({ type: 'ffp', zoomMin: 3, zoomMax: 20, calibrationZoom: 7 }), ['type', 'zoomMin', 'zoomMax']);
  assert.deepEqual(keysFor({ type: 'sfp', zoomMin: 3, zoomMax: 12, calibrationZoom: 10 }), ['type', 'zoomMin', 'zoomMax', 'calibrationZoom']);
  // Read back: a fixed scope's one magnification is both ends; not an SFP, the calibration zoom is the top.
  const back = (referenceScope) => decodeReticleRecord(encodeReticleRecord({ ...sample(), referenceScope })).referenceScope;
  assert.deepEqual(back({ type: 'fixed', zoomMin: 4, zoomMax: 4, calibrationZoom: 4 }), { type: 'fixed', zoomMin: 4, zoomMax: 4, calibrationZoom: 4 });
  assert.deepEqual(back({ type: 'ffp', zoomMin: 3, zoomMax: 20, calibrationZoom: 7 }), { type: 'ffp', zoomMin: 3, zoomMax: 20, calibrationZoom: 20 });
});

// ---- imported drawings ----

test('compact path data: relative, on the grid, and read back exactly by the path parser', async () => {
  const { parsePathData, formatCompactCommands } = await import('../src/reticle/svg-import/path-data.js');
  const commands = parsePathData('M10.0004 -5L12.5 -5L12.5 -7.25C13 -8 14 -8 15 -7.25Q16 -6 15 -5ZM-0.5 0.25L-0.5 0.25Z');
  const text = formatCompactCommands(commands, -3);
  assert.equal(text, 'm10-5 2.5 0 0-2.25c.5-.75 1.5-.75 2.5 0q1 1.25 0 2.25zm-10.5 5.25 0 0z');
  const back = parsePathData(text);
  assert.deepEqual(back.map((c) => c.c), commands.map((c) => c.c));
  back.forEach((c, i) => c.p.forEach((v, k) => assert.ok(Math.abs(v - commands[i].p[k]) <= 0.0005 + 1e-12, `${i}.${k}`)));
  assert.equal(formatCompactCommands(parsePathData('M100 200L300 200'), 1), 'm100 200 200 0');
});

test('an imported drawing is stored in runs of paths drawn alike, compact, and reads back the same', async () => {
  const { extractShape } = await import('../src/reticle/svg-import/extract.js');
  const shape = extractShape('<svg xmlns="http://www.w3.org/2000/svg" viewBox="-10 -10 20 20">'
    + '<path d="M-5 0H5" fill="none" stroke="#000" stroke-width="0.5"/><path d="M0 -5V5" fill="none" stroke="#000" stroke-width="0.5"/>'
    + '<circle r="1"/><path d="M-5 -5h1" fill="none" stroke="#000" stroke-width="0.5"/></svg>');
  const reticle = { ...sample(), elements: [] };
  const doc = addElement(reticle, createElement('svg', { x: 0, y: 0, units: 'mrad', svg: { shape, name: 'cross' } })).doc;
  const stored = encodeReticleRecord(doc);
  const runs = stored.elements[0].shape.runs;
  assert.deepEqual(runs.map((r) => [r.fill, r.d.length]), [[false, 2], [true, 1], [false, 1]], 'in drawing order');
  assert.ok(runs.every((r) => !('paths' in r)) && !('paths' in stored.elements[0].shape));
  const back = decodeReticleRecord(JSON.parse(JSON.stringify(stored)));
  assert.equal(back.elements[0].shape.paths.length, 4);
  assert.deepEqual(back.elements[0].shape.paths.map((p) => p.stroke), doc.elements[0].shape.paths.map((p) => p.stroke));
  assert.deepEqual(encodeReticleRecord(back), stored, 'and stores back the same');
});

test('a stored drawing is untrusted: bad runs are refused, too many paths is too large', async () => {
  const { extractShape } = await import('../src/reticle/svg-import/extract.js');
  const { LIMITS } = await import('../src/reticle/svg-import/extract.js');
  const shape = extractShape('<svg xmlns="http://www.w3.org/2000/svg" viewBox="-10 -10 20 20"><circle r="1"/></svg>');
  const doc = addElement({ ...sample(), elements: [] }, createElement('svg', { x: 0, y: 0, units: 'mrad', svg: { shape, name: 'dot' } })).doc;
  const stored = encodeReticleRecord(doc);
  const code = (mutate) => {
    const raw = JSON.parse(JSON.stringify(stored));
    mutate(raw.elements[0].shape);
    try { decodeReticleRecord(raw); } catch (err) { return err.code; }
    return null;
  };
  assert.equal(code(() => {}), null);
  assert.equal(code((s) => { s.runs[0].d[0] = 'm0 0"/><script>'; }), 'invalid-format');
  assert.equal(code((s) => { s.runs[0].d = 'm0 0'; }), 'invalid-format');
  assert.equal(code((s) => { s.runs = []; }), 'invalid-format');
  assert.equal(code((s) => { s.runs[0].d = Array.from({ length: LIMITS.maxElements + 1 }, () => s.runs[0].d[0]); }), 'too-large');
});
