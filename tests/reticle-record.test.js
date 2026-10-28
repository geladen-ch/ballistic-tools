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
