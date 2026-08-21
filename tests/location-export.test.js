import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildExportPayload, serializeExport, parseImportPayload,
  compareModifiedAt, classifyImportItem, generateCopyName, resolveImportItem
} from '../src/location-export.js';

test('buildExportPayload strips the local-only unsaved flag but keeps everything else', () => {
  const payload = buildExportPayload({
    locations: [{ id: 'l1', name: 'L1', unsaved: true, modifiedAt: '2020-01-01T00:00:00.000Z', targets: [] }]
  });
  assert.equal(payload.format, 'ebalka2-locations');
  assert.equal(payload.version, 1);
  assert.ok(typeof payload.exportedAt === 'string' && !Number.isNaN(Date.parse(payload.exportedAt)));
  assert.deepEqual(payload.locations, [{ id: 'l1', name: 'L1', modifiedAt: '2020-01-01T00:00:00.000Z', targets: [] }]);
});

test('serializeExport produces JSON that round-trips back to the same payload', () => {
  const payload = buildExportPayload({ locations: [{ id: 'l1', name: 'L1', targets: [] }] });
  const text = serializeExport(payload);
  assert.deepEqual(JSON.parse(text), payload);
});

test('parseImportPayload accepts a well-formed export and returns just its locations', () => {
  const payload = buildExportPayload({ locations: [{ id: 'l1', name: 'L1', targets: [] }] });
  const result = parseImportPayload(serializeExport(payload));
  assert.deepEqual(result, { locations: [{ id: 'l1', name: 'L1', targets: [] }] });
});

test('parseImportPayload rejects invalid JSON with code "invalid-json"', () => {
  assert.throws(() => parseImportPayload('not json {{{'), (err) => err.code === 'invalid-json');
});

test('parseImportPayload rejects well-formed JSON that isn\'t a Locations export, with code "invalid-format"', () => {
  assert.throws(() => parseImportPayload('{}'), (err) => err.code === 'invalid-format');
  assert.throws(() => parseImportPayload('[]'), (err) => err.code === 'invalid-format');
  assert.throws(() => parseImportPayload(JSON.stringify({ format: 'something-else', locations: [] })), (err) => err.code === 'invalid-format');
});

test('compareModifiedAt reports newer/older/same/unknown', () => {
  assert.equal(compareModifiedAt('2021-01-01T00:00:00.000Z', '2020-01-01T00:00:00.000Z'), 'newer');
  assert.equal(compareModifiedAt('2020-01-01T00:00:00.000Z', '2021-01-01T00:00:00.000Z'), 'older');
  assert.equal(compareModifiedAt('2020-01-01T00:00:00.000Z', '2020-01-01T00:00:00.000Z'), 'same');
  assert.equal(compareModifiedAt(undefined, '2020-01-01T00:00:00.000Z'), 'unknown');
});

test('classifyImportItem reports no conflict for a name not already in the library', () => {
  const result = classifyImportItem({ name: 'New Location' }, [{ name: 'Other Location' }]);
  assert.deepEqual(result, { conflict: false });
});

test('classifyImportItem matches names case/whitespace-insensitively and reports the comparison', () => {
  const existing = { name: 'My Range', modifiedAt: '2020-01-01T00:00:00.000Z' };
  const result = classifyImportItem({ name: '  MY range  ', modifiedAt: '2021-01-01T00:00:00.000Z' }, [existing]);
  assert.equal(result.conflict, true);
  assert.equal(result.existing, existing);
  assert.equal(result.comparison, 'newer');
});

test('generateCopyName finds the first free "- copy (N)" suffix', () => {
  const taken = new Set(['My Range - copy (1)', 'My Range - copy (2)']);
  assert.equal(generateCopyName('My Range', (name) => taken.has(name)), 'My Range - copy (3)');
  assert.equal(generateCopyName('Fresh Name', (name) => taken.has(name)), 'Fresh Name - copy (1)');
});

const genId = (prefix) => () => `${prefix}-generated`;

test('resolveImportItem with no conflict always saves under a freshly generated id, regardless of mode', () => {
  for (const mode of ['overwrite', 'overwriteIfNewer', 'rename']) {
    const result = resolveImportItem(
      { id: 'file-id', name: 'New One' },
      { existingList: [], mode, generateId: genId('location'), nameTaken: () => false }
    );
    assert.deepEqual(result, { action: 'save', record: { id: 'location-generated', name: 'New One' } });
  }
});

test('resolveImportItem "overwrite" always saves, reusing the existing record\'s id', () => {
  const existing = { id: 'existing-id', name: 'My Range', modifiedAt: '2020-01-01T00:00:00.000Z' };
  const result = resolveImportItem(
    { id: 'file-id', name: 'My Range', modifiedAt: '2019-01-01T00:00:00.000Z' }, // older, but overwrite mode doesn't care
    { existingList: [existing], mode: 'overwrite', generateId: genId('location'), nameTaken: () => false }
  );
  assert.deepEqual(result, { action: 'save', record: { id: 'existing-id', name: 'My Range', modifiedAt: '2019-01-01T00:00:00.000Z' } });
});

test('resolveImportItem "overwriteIfNewer" saves only when the imported item is actually newer', () => {
  const existing = { id: 'existing-id', name: 'My Range', modifiedAt: '2020-01-01T00:00:00.000Z' };
  const newer = resolveImportItem(
    { id: 'file-id', name: 'My Range', modifiedAt: '2021-01-01T00:00:00.000Z' },
    { existingList: [existing], mode: 'overwriteIfNewer', generateId: genId('location'), nameTaken: () => false }
  );
  assert.deepEqual(newer, { action: 'save', record: { id: 'existing-id', name: 'My Range', modifiedAt: '2021-01-01T00:00:00.000Z' } });

  const older = resolveImportItem(
    { id: 'file-id', name: 'My Range', modifiedAt: '2019-01-01T00:00:00.000Z' },
    { existingList: [existing], mode: 'overwriteIfNewer', generateId: genId('location'), nameTaken: () => false }
  );
  assert.deepEqual(older, { action: 'skip', reason: 'not-newer' });
});

test('resolveImportItem "rename" saves under a fresh id and a disambiguated name, preserving modifiedAt', () => {
  const existing = { id: 'existing-id', name: 'My Range', modifiedAt: '2020-01-01T00:00:00.000Z' };
  const result = resolveImportItem(
    { id: 'file-id', name: 'My Range', modifiedAt: '2021-06-01T00:00:00.000Z' },
    { existingList: [existing], mode: 'rename', generateId: genId('location'), nameTaken: (name) => name === 'My Range - copy (1)' }
  );
  assert.deepEqual(result, {
    action: 'save',
    record: { id: 'location-generated', name: 'My Range - copy (2)', modifiedAt: '2021-06-01T00:00:00.000Z' }
  });
});

test('a location\'s photo and a target\'s pin coords survive a full export/import round trip', () => {
  const location = {
    id: 'l1', name: 'L1', unsaved: true, modifiedAt: '2020-01-01T00:00:00.000Z',
    photo: 'data:image/jpeg;base64,AAA',
    targets: [{ id: 't1', name: null, notes: null, rangeM: 400, losAngleDeg: 0, coords: { x: 0.25, y: 0.75 } }]
  };
  const payload = buildExportPayload({ locations: [location] });
  const parsed = parseImportPayload(serializeExport(payload));
  assert.equal(parsed.locations[0].photo, location.photo);
  assert.deepEqual(parsed.locations[0].targets[0].coords, { x: 0.25, y: 0.75 });
});

test('resolveImportItem carries a location\'s nested targets through untouched', () => {
  const targets = [{ id: 't1', name: 'Target 1', rangeM: 400, losAngleDeg: 0 }];
  const result = resolveImportItem(
    { id: 'file-id', name: 'New Range', targets },
    { existingList: [], mode: 'overwrite', generateId: genId('location'), nameTaken: () => false }
  );
  assert.deepEqual(result.record.targets, targets);
});
