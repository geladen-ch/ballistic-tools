import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildExportPayload, serializeExport, collectRifleBulletIds, parseImportPayload,
  compareModifiedAt, classifyImportItem, generateCopyName, resolveImportItem, planImportBatch
} from '../src/arsenal-export.js';

test('buildExportPayload strips the local-only unsaved flag but keeps everything else', () => {
  const payload = buildExportPayload({
    bullets: [{ id: 'b1', name: 'B1', unsaved: true, modifiedAt: '2020-01-01T00:00:00.000Z' }],
    rifles: [{ id: 'r1', name: 'R1', unsaved: false, cartridges: [] }]
  });
  assert.equal(payload.format, 'ebalka2-arsenal');
  assert.equal(payload.version, 1);
  assert.ok(typeof payload.exportedAt === 'string' && !Number.isNaN(Date.parse(payload.exportedAt)));
  assert.deepEqual(payload.bullets, [{ id: 'b1', name: 'B1', modifiedAt: '2020-01-01T00:00:00.000Z' }]);
  assert.deepEqual(payload.rifles, [{ id: 'r1', name: 'R1', cartridges: [] }]);
});

test('serializeExport produces JSON that round-trips back to the same payload', () => {
  const payload = buildExportPayload({ bullets: [{ id: 'b1', name: 'B1' }], rifles: [] });
  const text = serializeExport(payload);
  assert.deepEqual(JSON.parse(text), payload);
});

test('collectRifleBulletIds only includes cartridge bullets that are actually in the user library', () => {
  const rifle = { cartridges: [{ bulletId: 'user-bullet-1' }, { bulletId: 'built-in-bullet' }, { bulletId: 'user-bullet-1' }] };
  const ids = collectRifleBulletIds(rifle, new Set(['user-bullet-1', 'user-bullet-2']));
  assert.deepEqual([...ids], ['user-bullet-1']);
});

test('parseImportPayload accepts a well-formed export and returns just its bullets/rifles', () => {
  const payload = buildExportPayload({ bullets: [{ id: 'b1', name: 'B1' }], rifles: [{ id: 'r1', name: 'R1', cartridges: [] }] });
  const result = parseImportPayload(serializeExport(payload));
  assert.deepEqual(result, { bullets: [{ id: 'b1', name: 'B1' }], rifles: [{ id: 'r1', name: 'R1', cartridges: [] }] });
});

test('parseImportPayload rejects invalid JSON with code "invalid-json"', () => {
  assert.throws(() => parseImportPayload('not json {{{'), (err) => err.code === 'invalid-json');
});

test('parseImportPayload rejects well-formed JSON that isn\'t an Arsenal export, with code "invalid-format"', () => {
  assert.throws(() => parseImportPayload('{}'), (err) => err.code === 'invalid-format');
  assert.throws(() => parseImportPayload('[]'), (err) => err.code === 'invalid-format');
  assert.throws(() => parseImportPayload(JSON.stringify({ format: 'ebalka2-arsenal', bullets: [] })), (err) => err.code === 'invalid-format'); // missing rifles
  assert.throws(() => parseImportPayload(JSON.stringify({ format: 'something-else', bullets: [], rifles: [] })), (err) => err.code === 'invalid-format');
});

test('compareModifiedAt reports newer/older/same/unknown', () => {
  assert.equal(compareModifiedAt('2021-01-01T00:00:00.000Z', '2020-01-01T00:00:00.000Z'), 'newer');
  assert.equal(compareModifiedAt('2020-01-01T00:00:00.000Z', '2021-01-01T00:00:00.000Z'), 'older');
  assert.equal(compareModifiedAt('2020-01-01T00:00:00.000Z', '2020-01-01T00:00:00.000Z'), 'same');
  assert.equal(compareModifiedAt(undefined, '2020-01-01T00:00:00.000Z'), 'unknown');
  assert.equal(compareModifiedAt('2020-01-01T00:00:00.000Z', undefined), 'unknown');
  assert.equal(compareModifiedAt('not a date', '2020-01-01T00:00:00.000Z'), 'unknown');
});

test('classifyImportItem reports no conflict for a name not already in the library', () => {
  const result = classifyImportItem({ name: 'New Bullet' }, [{ name: 'Other Bullet' }]);
  assert.deepEqual(result, { conflict: false });
});

test('classifyImportItem matches names case/whitespace-insensitively and reports the comparison', () => {
  const existing = { name: 'My Bullet', modifiedAt: '2020-01-01T00:00:00.000Z' };
  const result = classifyImportItem({ name: '  MY bullet  ', modifiedAt: '2021-01-01T00:00:00.000Z' }, [existing]);
  assert.equal(result.conflict, true);
  assert.equal(result.existing, existing);
  assert.equal(result.comparison, 'newer');
});

test('generateCopyName finds the first free "- copy (N)" suffix', () => {
  const taken = new Set(['My Bullet - copy (1)', 'My Bullet - copy (2)']);
  assert.equal(generateCopyName('My Bullet', (name) => taken.has(name)), 'My Bullet - copy (3)');
  assert.equal(generateCopyName('Fresh Name', (name) => taken.has(name)), 'Fresh Name - copy (1)');
});

const genId = (prefix) => () => `${prefix}-generated`;

test('resolveImportItem with no conflict always saves under a freshly generated id, regardless of mode', () => {
  for (const mode of ['overwrite', 'overwriteIfNewer', 'rename']) {
    const result = resolveImportItem(
      { id: 'file-id', name: 'New One' },
      { existingList: [], mode, generateId: genId('bullet'), nameTaken: () => false }
    );
    assert.deepEqual(result, { action: 'save', record: { id: 'bullet-generated', name: 'New One' } });
  }
});

test('resolveImportItem "overwrite" always saves, reusing the existing record\'s id', () => {
  const existing = { id: 'existing-id', name: 'My Bullet', modifiedAt: '2020-01-01T00:00:00.000Z' };
  const result = resolveImportItem(
    { id: 'file-id', name: 'My Bullet', modifiedAt: '2019-01-01T00:00:00.000Z' }, // older, but overwrite mode doesn't care
    { existingList: [existing], mode: 'overwrite', generateId: genId('bullet'), nameTaken: () => false }
  );
  assert.deepEqual(result, { action: 'save', record: { id: 'existing-id', name: 'My Bullet', modifiedAt: '2019-01-01T00:00:00.000Z' } });
});

test('resolveImportItem "overwriteIfNewer" saves only when the imported item is actually newer', () => {
  const existing = { id: 'existing-id', name: 'My Bullet', modifiedAt: '2020-01-01T00:00:00.000Z' };
  const newer = resolveImportItem(
    { id: 'file-id', name: 'My Bullet', modifiedAt: '2021-01-01T00:00:00.000Z' },
    { existingList: [existing], mode: 'overwriteIfNewer', generateId: genId('bullet'), nameTaken: () => false }
  );
  assert.deepEqual(newer, { action: 'save', record: { id: 'existing-id', name: 'My Bullet', modifiedAt: '2021-01-01T00:00:00.000Z' } });

  const older = resolveImportItem(
    { id: 'file-id', name: 'My Bullet', modifiedAt: '2019-01-01T00:00:00.000Z' },
    { existingList: [existing], mode: 'overwriteIfNewer', generateId: genId('bullet'), nameTaken: () => false }
  );
  assert.deepEqual(older, { action: 'skip', reason: 'not-newer' });

  const unknown = resolveImportItem(
    { id: 'file-id', name: 'My Bullet' }, // no modifiedAt at all
    { existingList: [existing], mode: 'overwriteIfNewer', generateId: genId('bullet'), nameTaken: () => false }
  );
  assert.deepEqual(unknown, { action: 'skip', reason: 'not-newer' });
});

test('resolveImportItem "rename" saves under a fresh id and a disambiguated name, preserving modifiedAt', () => {
  const existing = { id: 'existing-id', name: 'My Bullet', modifiedAt: '2020-01-01T00:00:00.000Z' };
  const result = resolveImportItem(
    { id: 'file-id', name: 'My Bullet', modifiedAt: '2021-06-01T00:00:00.000Z' },
    { existingList: [existing], mode: 'rename', generateId: genId('bullet'), nameTaken: (name) => name === 'My Bullet - copy (1)' }
  );
  assert.deepEqual(result, {
    action: 'save',
    record: { id: 'bullet-generated', name: 'My Bullet - copy (2)', modifiedAt: '2021-06-01T00:00:00.000Z' }
  });
});

function makeIds(prefix) {
  let n = 0;
  return () => `${prefix}-${++n}`;
}

test('planImportBatch: new items save under fresh ids with no conflicts', () => {
  const result = planImportBatch({
    bullets: [{ id: 'file-b1', name: 'Bullet One' }],
    rifles: [{ id: 'file-r1', name: 'Rifle One', cartridges: [{ id: 'c1', bulletId: 'file-b1' }] }],
    mode: 'overwrite',
    existingBullets: [], existingRifles: [],
    generateBulletId: makeIds('user-bullet'), generateRifleId: makeIds('user-rifle')
  });

  assert.equal(result.bulletResults[0].resolved.action, 'save');
  const newBulletId = result.bulletResults[0].resolved.record.id;
  assert.equal(newBulletId, 'user-bullet-1');

  assert.equal(result.rifleResults[0].resolved.action, 'save');
  // The rifle's cartridge must point at the bullet's *new* local id, not the file's original one.
  assert.equal(result.rifleResults[0].resolved.record.cartridges[0].bulletId, newBulletId);
});

test('planImportBatch remaps a renamed bullet\'s new id into its rifle\'s cartridges', () => {
  const existingBullet = { id: 'local-b1', name: 'Bullet One', modifiedAt: '2020-01-01T00:00:00.000Z' };
  const result = planImportBatch({
    bullets: [{ id: 'file-b1', name: 'Bullet One', modifiedAt: '2021-01-01T00:00:00.000Z' }],
    rifles: [{ id: 'file-r1', name: 'Rifle One', cartridges: [{ id: 'c1', bulletId: 'file-b1' }] }],
    mode: 'rename',
    existingBullets: [existingBullet], existingRifles: [],
    generateBulletId: makeIds('user-bullet'), generateRifleId: makeIds('user-rifle')
  });

  const bulletRecord = result.bulletResults[0].resolved.record;
  assert.equal(bulletRecord.name, 'Bullet One - copy (1)');
  assert.notEqual(bulletRecord.id, 'local-b1');

  assert.equal(result.rifleResults[0].resolved.record.cartridges[0].bulletId, bulletRecord.id);
});

test('planImportBatch leaves a cartridge\'s bulletId untouched when its bullet wasn\'t part of the batch', () => {
  const result = planImportBatch({
    bullets: [], // the bullet was deselected / not included in this file
    rifles: [{ id: 'file-r1', name: 'Rifle One', cartridges: [{ id: 'c1', bulletId: 'some-bullet-id' }] }],
    mode: 'overwrite',
    existingBullets: [], existingRifles: [],
    generateBulletId: makeIds('user-bullet'), generateRifleId: makeIds('user-rifle')
  });
  assert.equal(result.rifleResults[0].resolved.record.cartridges[0].bulletId, 'some-bullet-id');
});

test('planImportBatch gives sequential, non-colliding copy names to two conflicting same-named items in one batch', () => {
  const existing = { id: 'local-b1', name: 'Dup', modifiedAt: '2020-01-01T00:00:00.000Z' };
  const result = planImportBatch({
    bullets: [
      { id: 'file-b1', name: 'Dup', modifiedAt: '2021-01-01T00:00:00.000Z' },
      { id: 'file-b2', name: 'Dup', modifiedAt: '2022-01-01T00:00:00.000Z' }
    ],
    rifles: [],
    mode: 'rename',
    existingBullets: [existing], existingRifles: [],
    generateBulletId: makeIds('user-bullet'), generateRifleId: makeIds('user-rifle')
  });
  assert.equal(result.bulletResults[0].resolved.record.name, 'Dup - copy (1)');
  assert.equal(result.bulletResults[1].resolved.record.name, 'Dup - copy (2)');
});
