import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildExportPayload, serializeExport, parseImportPayload,
  compareModifiedAt, classifyImportItem, generateCopyName, resolveImportItem
} from '../src/rifle-precision-export.js';

test('buildExportPayload strips the local-only unsaved flag but keeps everything else', () => {
  const payload = buildExportPayload({
    projects: [{ id: 'p1', name: 'P1', unsaved: true, createdAt: '2019-01-01T00:00:00.000Z', modifiedAt: '2020-01-01T00:00:00.000Z', targets: [] }]
  });
  assert.equal(payload.format, 'ebalka2-rifle-precision');
  assert.equal(payload.version, 1);
  assert.ok(typeof payload.exportedAt === 'string' && !Number.isNaN(Date.parse(payload.exportedAt)));
  assert.deepEqual(payload.projects, [{ id: 'p1', name: 'P1', createdAt: '2019-01-01T00:00:00.000Z', modifiedAt: '2020-01-01T00:00:00.000Z', targets: [] }]);
});

test('serializeExport produces JSON that round-trips back to the same payload', () => {
  const payload = buildExportPayload({ projects: [{ id: 'p1', name: 'P1', targets: [] }] });
  const text = serializeExport(payload);
  assert.deepEqual(JSON.parse(text), payload);
});

test('parseImportPayload accepts a well-formed export and returns just its projects', () => {
  const payload = buildExportPayload({ projects: [{ id: 'p1', name: 'P1', targets: [] }] });
  const result = parseImportPayload(serializeExport(payload));
  assert.deepEqual(result, { projects: [{ id: 'p1', name: 'P1', targets: [] }] });
});

test('parseImportPayload rejects invalid JSON with code "invalid-json"', () => {
  assert.throws(() => parseImportPayload('not json {{{'), (err) => err.code === 'invalid-json');
});

test('parseImportPayload rejects well-formed JSON that isn\'t a Rifle Precision export, with code "invalid-format"', () => {
  assert.throws(() => parseImportPayload('{}'), (err) => err.code === 'invalid-format');
  assert.throws(() => parseImportPayload('[]'), (err) => err.code === 'invalid-format');
  assert.throws(() => parseImportPayload(JSON.stringify({ format: 'something-else', projects: [] })), (err) => err.code === 'invalid-format');
});

test('compareModifiedAt reports newer/older/same/unknown', () => {
  assert.equal(compareModifiedAt('2021-01-01T00:00:00.000Z', '2020-01-01T00:00:00.000Z'), 'newer');
  assert.equal(compareModifiedAt('2020-01-01T00:00:00.000Z', '2021-01-01T00:00:00.000Z'), 'older');
  assert.equal(compareModifiedAt('2020-01-01T00:00:00.000Z', '2020-01-01T00:00:00.000Z'), 'same');
  assert.equal(compareModifiedAt(undefined, '2020-01-01T00:00:00.000Z'), 'unknown');
});

test('classifyImportItem reports no conflict for a name not already in the library', () => {
  const result = classifyImportItem({ name: 'New Project' }, [{ name: 'Other Project' }]);
  assert.deepEqual(result, { conflict: false });
});

test('classifyImportItem matches names case/whitespace-insensitively and reports the comparison', () => {
  const existing = { name: 'My Project', modifiedAt: '2020-01-01T00:00:00.000Z' };
  const result = classifyImportItem({ name: '  MY project  ', modifiedAt: '2021-01-01T00:00:00.000Z' }, [existing]);
  assert.equal(result.conflict, true);
  assert.equal(result.existing, existing);
  assert.equal(result.comparison, 'newer');
});

test('generateCopyName finds the first free "- copy (N)" suffix', () => {
  const taken = new Set(['My Project - copy (1)', 'My Project - copy (2)']);
  assert.equal(generateCopyName('My Project', (name) => taken.has(name)), 'My Project - copy (3)');
  assert.equal(generateCopyName('Fresh Name', (name) => taken.has(name)), 'Fresh Name - copy (1)');
});

const genId = (prefix) => () => `${prefix}-generated`;

test('resolveImportItem with no conflict always saves under a freshly generated id, regardless of mode', () => {
  for (const mode of ['overwrite', 'overwriteIfNewer', 'rename']) {
    const result = resolveImportItem(
      { id: 'file-id', name: 'New One' },
      { existingList: [], mode, generateId: genId('rp-project'), nameTaken: () => false }
    );
    assert.deepEqual(result, { action: 'save', record: { id: 'rp-project-generated', name: 'New One' } });
  }
});

test('resolveImportItem "overwrite" always saves, reusing the existing record\'s id', () => {
  const existing = { id: 'existing-id', name: 'My Project', modifiedAt: '2020-01-01T00:00:00.000Z' };
  const result = resolveImportItem(
    { id: 'file-id', name: 'My Project', modifiedAt: '2019-01-01T00:00:00.000Z' }, // older, but overwrite mode doesn't care
    { existingList: [existing], mode: 'overwrite', generateId: genId('rp-project'), nameTaken: () => false }
  );
  assert.deepEqual(result, { action: 'save', record: { id: 'existing-id', name: 'My Project', modifiedAt: '2019-01-01T00:00:00.000Z' } });
});

test('resolveImportItem "overwriteIfNewer" saves only when the imported item is actually newer', () => {
  const existing = { id: 'existing-id', name: 'My Project', modifiedAt: '2020-01-01T00:00:00.000Z' };
  const newer = resolveImportItem(
    { id: 'file-id', name: 'My Project', modifiedAt: '2021-01-01T00:00:00.000Z' },
    { existingList: [existing], mode: 'overwriteIfNewer', generateId: genId('rp-project'), nameTaken: () => false }
  );
  assert.deepEqual(newer, { action: 'save', record: { id: 'existing-id', name: 'My Project', modifiedAt: '2021-01-01T00:00:00.000Z' } });

  const older = resolveImportItem(
    { id: 'file-id', name: 'My Project', modifiedAt: '2019-01-01T00:00:00.000Z' },
    { existingList: [existing], mode: 'overwriteIfNewer', generateId: genId('rp-project'), nameTaken: () => false }
  );
  assert.deepEqual(older, { action: 'skip', reason: 'not-newer' });
});

test('resolveImportItem "rename" saves under a fresh id and a disambiguated name, preserving modifiedAt', () => {
  const existing = { id: 'existing-id', name: 'My Project', modifiedAt: '2020-01-01T00:00:00.000Z' };
  const result = resolveImportItem(
    { id: 'file-id', name: 'My Project', modifiedAt: '2021-06-01T00:00:00.000Z' },
    { existingList: [existing], mode: 'rename', generateId: genId('rp-project'), nameTaken: (name) => name === 'My Project - copy (1)' }
  );
  assert.deepEqual(result, {
    action: 'save',
    record: { id: 'rp-project-generated', name: 'My Project - copy (2)', modifiedAt: '2021-06-01T00:00:00.000Z' }
  });
});

// The one shape difference from Locations/Arsenal: a project has its own
// createdAt, separate from modifiedAt, that must survive import untouched
// in every mode — resolveImportItem never special-cases it, since `...item`
// already carries every field through, but this pins down that behavior.
test('resolveImportItem preserves createdAt through every conflict mode', () => {
  const createdAt = '2018-03-01T00:00:00.000Z';
  const noConflict = resolveImportItem(
    { id: 'file-id', name: 'New One', createdAt },
    { existingList: [], mode: 'overwrite', generateId: genId('rp-project'), nameTaken: () => false }
  );
  assert.equal(noConflict.record.createdAt, createdAt);

  const existing = { id: 'existing-id', name: 'My Project', modifiedAt: '2020-01-01T00:00:00.000Z' };
  const overwrite = resolveImportItem(
    { id: 'file-id', name: 'My Project', createdAt },
    { existingList: [existing], mode: 'overwrite', generateId: genId('rp-project'), nameTaken: () => false }
  );
  assert.equal(overwrite.record.createdAt, createdAt);

  const renamed = resolveImportItem(
    { id: 'file-id', name: 'My Project', createdAt },
    { existingList: [existing], mode: 'rename', generateId: genId('rp-project'), nameTaken: () => false }
  );
  assert.equal(renamed.record.createdAt, createdAt);
});

test('a project\'s target photo, calibration, and groups survive a full export/import round trip', () => {
  const project = {
    id: 'p1', name: 'P1', unsaved: true, createdAt: '2019-01-01T00:00:00.000Z', modifiedAt: '2020-01-01T00:00:00.000Z',
    distanceM: 100, caliberMm: 7.62,
    targets: [{
      id: 't1', name: null, notes: null, photo: 'data:image/jpeg;base64,AAA',
      photoWidth: 100, photoHeight: 100,
      calibration: { point1: { x: 0.1, y: 0.1 }, point2: { x: 0.2, y: 0.2 }, realLengthMm: 100 },
      groups: [{ id: 'g1', poa: { x: 0.5, y: 0.5 }, shots: [{ x: 0.51, y: 0.49 }] }]
    }]
  };
  const payload = buildExportPayload({ projects: [project] });
  const parsed = parseImportPayload(serializeExport(payload));
  assert.equal(parsed.projects[0].targets[0].photo, project.targets[0].photo);
  assert.deepEqual(parsed.projects[0].targets[0].calibration, project.targets[0].calibration);
  assert.deepEqual(parsed.projects[0].targets[0].groups, project.targets[0].groups);
});

test('resolveImportItem carries a project\'s nested targets through untouched', () => {
  const targets = [{ id: 't1', name: 'Target 1', groups: [] }];
  const result = resolveImportItem(
    { id: 'file-id', name: 'New Project', targets },
    { existingList: [], mode: 'overwrite', generateId: genId('rp-project'), nameTaken: () => false }
  );
  assert.deepEqual(result.record.targets, targets);
});
