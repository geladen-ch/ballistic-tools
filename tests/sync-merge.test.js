import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from './helpers/fake-dom.js';

installFakeDom();

const {
  compareTimestamps, equivalent, resolveRecord, mergeRecords, detectFutureExport, detectBackwardExport,
  describeDivergence
} = await import('../src/sync/merge.js');
const { setVerboseSyncLoggingEnabled, getSyncLog, clearSyncLog } = await import('../src/sync/sync-log.js');

test('compareTimestamps returns newer/older/same for parseable timestamps', () => {
  assert.equal(compareTimestamps('2021-01-02T00:00:00.000Z', '2021-01-01T00:00:00.000Z'), 'newer');
  assert.equal(compareTimestamps('2021-01-01T00:00:00.000Z', '2021-01-02T00:00:00.000Z'), 'older');
  assert.equal(compareTimestamps('2021-01-01T00:00:00.000Z', '2021-01-01T00:00:00.000Z'), 'same');
});

test('compareTimestamps returns unknown when either side is missing/unparseable', () => {
  assert.equal(compareTimestamps(undefined, '2021-01-01T00:00:00.000Z'), 'unknown');
  assert.equal(compareTimestamps('2021-01-01T00:00:00.000Z', undefined), 'unknown');
  assert.equal(compareTimestamps('garbage', '2021-01-01T00:00:00.000Z'), 'unknown');
});

test('equivalent ignores the local-only unsaved flag but treats modifiedBy as significant', () => {
  const local = { id: 'a', name: 'A', modifiedAt: '2021-01-01T00:00:00.000Z', modifiedBy: 'dev-1', unsaved: true };
  const remote = { id: 'a', name: 'A', modifiedAt: '2021-01-01T00:00:00.000Z', modifiedBy: 'dev-1' };
  assert.equal(equivalent(local, remote), true);

  const differentAuthor = { ...remote, modifiedBy: 'dev-2' };
  assert.equal(equivalent(local, differentAuthor), false);
});

test('equivalent is a true structural comparison, insensitive to key order', () => {
  const local = { unsaved: true, name: 'A', id: 'a' };
  const remote = { id: 'a', name: 'A' };
  assert.equal(equivalent(local, remote), true);
});

test('equivalent detects genuinely different content', () => {
  const local = { id: 'a', name: 'A' };
  const remote = { id: 'a', name: 'B' };
  assert.equal(equivalent(local, remote), false);
});

test('resolveRecord: no local match, remote is live -> import', () => {
  const remote = { id: 'a', name: 'A', modifiedAt: '2021-01-01T00:00:00.000Z' };
  assert.deepEqual(resolveRecord(undefined, remote), { action: 'import', record: remote });
});

test('resolveRecord: no local match, remote is a tombstone -> store-tombstone (not dropped)', () => {
  const remote = { id: 'a', name: 'A', deletedAt: '2021-01-01T00:00:00.000Z', deletedBy: 'dev-1' };
  assert.deepEqual(resolveRecord(undefined, remote), { action: 'store-tombstone', record: remote });
});

test('resolveRecord: remote strictly newer, both live -> overwrite', () => {
  const local = { id: 'a', name: 'A', modifiedAt: '2021-01-01T00:00:00.000Z' };
  const remote = { id: 'a', name: 'A2', modifiedAt: '2021-06-01T00:00:00.000Z' };
  assert.deepEqual(resolveRecord(local, remote), { action: 'overwrite', record: remote });
});

test('resolveRecord: remote strictly newer and a tombstone -> apply-tombstone', () => {
  const local = { id: 'a', name: 'A', modifiedAt: '2021-01-01T00:00:00.000Z' };
  const remote = { id: 'a', name: 'A', deletedAt: '2021-06-01T00:00:00.000Z', deletedBy: 'dev-1' };
  assert.deepEqual(resolveRecord(local, remote), { action: 'apply-tombstone', record: remote });
});

test('resolveRecord: local strictly newer -> skip, local-is-newer (covers the local tombstone case too)', () => {
  const local = { id: 'a', name: 'A', modifiedAt: '2021-06-01T00:00:00.000Z' };
  const remote = { id: 'a', name: 'A2', modifiedAt: '2021-01-01T00:00:00.000Z' };
  assert.deepEqual(resolveRecord(local, remote), { action: 'skip', reason: 'local-is-newer' });

  // A local deletion beats an older remote edit the same way any other
  // newer-wins comparison would.
  const localTombstone = { id: 'a', name: 'A', deletedAt: '2021-06-01T00:00:00.000Z', deletedBy: 'dev-1' };
  assert.deepEqual(resolveRecord(localTombstone, remote), { action: 'skip', reason: 'local-is-newer' });
});

test('resolveRecord: same timestamp, identical content -> noop (the steady state)', () => {
  const local = { id: 'a', name: 'A', modifiedAt: '2021-01-01T00:00:00.000Z', modifiedBy: 'dev-1', unsaved: false };
  const remote = { id: 'a', name: 'A', modifiedAt: '2021-01-01T00:00:00.000Z', modifiedBy: 'dev-1' };
  assert.deepEqual(resolveRecord(local, remote), { action: 'noop' });
});

test('resolveRecord: same timestamp, diverged content -> skip-review', () => {
  const local = { id: 'a', name: 'A', modifiedAt: '2021-01-01T00:00:00.000Z' };
  const remote = { id: 'a', name: 'B', modifiedAt: '2021-01-01T00:00:00.000Z' };
  assert.deepEqual(resolveRecord(local, remote), { action: 'skip-review', reason: 'same-timestamp-diverged-content' });
});

test('resolveRecord: unresolvable timestamp on either side -> skip-review', () => {
  const local = { id: 'a', name: 'A' }; // no modifiedAt at all
  const remote = { id: 'a', name: 'A', modifiedAt: '2021-01-01T00:00:00.000Z' };
  assert.deepEqual(resolveRecord(local, remote), { action: 'skip-review', reason: 'unresolvable-timestamp' });
});

// --- revision-based ordering ---
// A higher revision proves a causal chain of real writes leads from the
// lower one to the higher one — see merge.js's own comment. It decides
// outright, ahead of (and even against) what the timestamps alone would
// say, which is the entire point: this is what makes ordering correct
// regardless of which device's clock, if either, is wrong.

test('resolveRecord: higher revision wins even against a misleadingly newer-looking local timestamp', () => {
  // local has a LATER modifiedAt but a LOWER revision — a clock-skewed
  // device could produce exactly this. Revision must win the comparison
  // outright, not merely as a tiebreak.
  const local = { id: 'a', name: 'A', modifiedAt: '2021-06-01T00:00:00.000Z', revision: 1 };
  const remote = { id: 'a', name: 'A2', modifiedAt: '2021-01-01T00:00:00.000Z', revision: 2 };
  assert.deepEqual(resolveRecord(local, remote), { action: 'overwrite', record: remote });
});

test('resolveRecord: lower revision loses even against a misleadingly newer-looking remote timestamp', () => {
  const local = { id: 'a', name: 'A', modifiedAt: '2021-01-01T00:00:00.000Z', revision: 5 };
  const remote = { id: 'a', name: 'A2', modifiedAt: '2021-06-01T00:00:00.000Z', revision: 3 };
  assert.deepEqual(resolveRecord(local, remote), { action: 'skip', reason: 'local-is-newer' });
});

test('resolveRecord: a higher revision tombstone applies even against a misleadingly newer live remote timestamp', () => {
  const local = { id: 'a', name: 'A', deletedAt: '2021-01-01T00:00:00.000Z', deletedBy: 'dev-1', revision: 4 };
  const remote = { id: 'a', name: 'A2', modifiedAt: '2021-06-01T00:00:00.000Z', revision: 2 };
  assert.deepEqual(resolveRecord(local, remote), { action: 'skip', reason: 'local-is-newer' });
});

test('resolveRecord: equal revisions fall through to the timestamp comparison, unchanged from before revisions existed', () => {
  const local = { id: 'a', name: 'A', modifiedAt: '2021-01-01T00:00:00.000Z', revision: 3 };
  const remote = { id: 'a', name: 'A2', modifiedAt: '2021-06-01T00:00:00.000Z', revision: 3 };
  assert.deepEqual(resolveRecord(local, remote), { action: 'overwrite', record: remote });
});

test('resolveRecord: equal revisions with a genuinely diverged, same-instant edit still goes to review, not an arbitrary tiebreak', () => {
  // Deliberately not implementing the plan's literal "(revision,
  // modifiedAt, device.id)" third tier here — see merge.js's own comment.
  // A real, same-millisecond divergence between two equal revisions must
  // still surface for a human, exactly as it did before revisions existed.
  const local = { id: 'a', name: 'A', modifiedAt: '2021-01-01T00:00:00.000Z', revision: 3, modifiedBy: 'dev-1' };
  const remote = { id: 'a', name: 'B', modifiedAt: '2021-01-01T00:00:00.000Z', revision: 3, modifiedBy: 'dev-2' };
  assert.deepEqual(resolveRecord(local, remote), { action: 'skip-review', reason: 'same-timestamp-diverged-content' });
});

test('resolveRecord: records with no revision at all (both default to 0) behave exactly as before revisions existed', () => {
  // The backward-compatibility guarantee: every record that predates this
  // field ties on revision (0 vs 0) for every peer, so nothing changes
  // for the existing library of every current user until they've actually
  // synced and picked up the field.
  const local = { id: 'a', name: 'A', modifiedAt: '2021-01-01T00:00:00.000Z' };
  const remote = { id: 'a', name: 'A2', modifiedAt: '2021-06-01T00:00:00.000Z' };
  assert.deepEqual(resolveRecord(local, remote), { action: 'overwrite', record: remote });
});

test('mergeRecords tallies every action and applies imports/overwrites/tombstones through the given callbacks', () => {
  const local = [
    { id: 'unchanged', name: 'U', modifiedAt: '2021-01-01T00:00:00.000Z' },
    { id: 'local-newer', name: 'LN', modifiedAt: '2021-06-01T00:00:00.000Z' },
    { id: 'to-overwrite', name: 'Old', modifiedAt: '2021-01-01T00:00:00.000Z' },
    { id: 'to-delete', name: 'ToDelete', modifiedAt: '2021-01-01T00:00:00.000Z' },
    { id: 'diverged', name: 'A', modifiedAt: '2021-01-01T00:00:00.000Z' }
  ];
  const remote = [
    { id: 'unchanged', name: 'U', modifiedAt: '2021-01-01T00:00:00.000Z' },
    { id: 'local-newer', name: 'LN-remote-stale', modifiedAt: '2021-01-01T00:00:00.000Z' },
    { id: 'to-overwrite', name: 'New', modifiedAt: '2021-06-01T00:00:00.000Z' },
    { id: 'to-delete', name: 'ToDelete', deletedAt: '2021-06-01T00:00:00.000Z', deletedBy: 'dev-2', unsaved: true },
    { id: 'diverged', name: 'B', modifiedAt: '2021-01-01T00:00:00.000Z' },
    { id: 'brand-new', name: 'New Item', modifiedAt: '2021-03-01T00:00:00.000Z' }
  ];

  const written = [];
  const tombstoned = [];
  const { counts, reviewItems, resolvedIds } = mergeRecords(local, remote, {
    importRaw: (r) => written.push(r),
    tombstone: (r) => tombstoned.push(r)
  });

  assert.deepEqual(counts, {
    imported: 1, overwritten: 1, tombstoned: 1, skippedOlder: 1, skippedReview: 1, noop: 1, skippedInvalid: 0
  });
  // Every record that reached a definite answer — everything but the
  // skip-review one — so callers can retire an outstanding conflict
  // against it (Phase 4).
  assert.deepEqual(
    [...resolvedIds].sort(),
    ['brand-new', 'local-newer', 'to-delete', 'to-overwrite', 'unchanged']
  );
  assert.equal(written.length, 2); // brand-new (import) + to-overwrite (overwrite)
  assert.ok(written.some((r) => r.id === 'brand-new'));
  assert.ok(written.some((r) => r.id === 'to-overwrite' && r.name === 'New'));
  assert.equal(tombstoned.length, 1);
  assert.equal(tombstoned[0].id, 'to-delete');
  assert.equal(reviewItems.length, 1);
  assert.equal(reviewItems[0].reason, 'same-timestamp-diverged-content');
  assert.equal(reviewItems[0].local.id, 'diverged');
  assert.equal(reviewItems[0].remote.name, 'B');
});

test('mergeRecords logs every per-record decision when verbose sync logging is on (Phase 10)', () => {
  setVerboseSyncLoggingEnabled(true);
  clearSyncLog();
  const local = [{ id: 'a', name: 'A', modifiedAt: '2021-01-01T00:00:00.000Z' }];
  const remote = [{ id: 'a', name: 'A2', modifiedAt: '2021-06-01T00:00:00.000Z' }, { id: 'b', name: 'B', modifiedAt: '2021-01-01T00:00:00.000Z' }];

  mergeRecords(local, remote, {
    importRaw: () => {}, tombstone: () => {}, recordType: 'bullet', peerLabel: "Guns' iPhone"
  });

  const log = getSyncLog();
  assert.ok(log.some((line) => line.includes('bullet') && line.includes('a') && line.includes('overwrite') && line.includes("Guns' iPhone")));
  assert.ok(log.some((line) => line.includes('bullet') && line.includes('b') && line.includes('import')));
  setVerboseSyncLoggingEnabled(false);
});

test('mergeRecords logs nothing when verbose sync logging is off, and tolerates missing recordType/peerLabel', () => {
  setVerboseSyncLoggingEnabled(false);
  clearSyncLog();
  const local = [];
  const remote = [{ id: 'a', name: 'A', modifiedAt: '2021-01-01T00:00:00.000Z' }];

  assert.doesNotThrow(() => mergeRecords(local, remote, { importRaw: () => {}, tombstone: () => {} }));
  assert.deepEqual(getSyncLog(), []);
});

test('mergeRecords is safe to run on an empty remote list (no-op cycle)', () => {
  const local = [{ id: 'a', name: 'A', modifiedAt: '2021-01-01T00:00:00.000Z' }];
  const { counts, reviewItems, resolvedIds } = mergeRecords(local, [], { importRaw: () => {}, tombstone: () => {} });
  assert.deepEqual(counts, {
    imported: 0, overwritten: 0, tombstoned: 0, skippedOlder: 0, skippedReview: 0, noop: 0, skippedInvalid: 0
  });
  assert.deepEqual(reviewItems, []);
  assert.deepEqual(resolvedIds, []);
});

test('mergeRecords skips a remote entry with no usable id or name rather than storing it', () => {
  // A hand-edited or half-written bundle passes parseBackupBundle (which
  // only checks the envelope) but can still carry junk in the lists. An
  // entry with no id is the dangerous one: every such entry collides on
  // `undefined` in the by-id map and would land in storage under a key
  // nothing can address again.
  const written = [];
  const { counts } = mergeRecords([], [
    { name: 'No Id', modifiedAt: '2021-01-01T00:00:00.000Z' },
    { id: 'no-name', modifiedAt: '2021-01-01T00:00:00.000Z' },
    null,
    'not an object',
    { id: 'fine', name: 'Fine', modifiedAt: '2021-01-01T00:00:00.000Z' }
  ], { importRaw: (r) => written.push(r), tombstone: () => {} });

  assert.equal(counts.skippedInvalid, 4);
  assert.equal(counts.imported, 1);
  assert.deepEqual(written.map((r) => r.id), ['fine']);
});

test('equivalent() treats an absent key and an explicitly-null one as the same', () => {
  // Not a convenience: location-library.js's own toStorable()/fromStorable()
  // normalize a missing photo to `photo: null` on the IndexedDB round-trip,
  // so the identical record legitimately gains a null-valued key just by
  // surviving a reload. Comparing those as unequal pins every such record
  // to skip-review forever.
  const tombstone = { id: 'a', name: 'A', deletedAt: '2021-01-01T00:00:00.000Z', targets: [] };
  const afterReload = { ...tombstone, photo: null };
  assert.equal(equivalent(tombstone, afterReload), true);
  assert.deepEqual(resolveRecord(tombstone, afterReload), { action: 'noop' });

  // A real value still differs from both.
  assert.equal(equivalent(tombstone, { ...tombstone, photo: 'data:image/jpeg;base64,AAA' }), false);
});

test('detectFutureExport returns null for a bundle from the past or present, however long ago', () => {
  const now = Date.parse('2021-01-01T00:00:00.000Z');
  assert.equal(detectFutureExport('2021-01-01T00:00:00.000Z', { now }), null); // exactly now
  assert.equal(detectFutureExport('2020-12-31T23:59:00.000Z', { now }), null); // a minute ago
  // Regression: the whole point — a peer that simply hasn't synced in a
  // long while (routine here; the tombstone retention window is sized in
  // months for exactly this reason) must never be flagged. No amount of
  // staleness can be mistaken for "from the future".
  assert.equal(detectFutureExport('2019-01-01T00:00:00.000Z', { now }), null); // two years ago
});

test('detectFutureExport flags a bundle dated after this device\'s own clock, beyond jitter tolerance', () => {
  const now = Date.parse('2021-01-01T00:00:00.000Z');
  const ahead2h = Date.parse('2021-01-01T02:00:00.000Z');
  assert.equal(detectFutureExport('2021-01-01T02:00:00.000Z', { now }), ahead2h - now);
  // Within the small jitter allowance (NTP/network, not sync latency) —
  // not flagged.
  assert.equal(detectFutureExport('2021-01-01T00:01:00.000Z', { now }), null);
});

test('detectFutureExport returns null for an unparseable exportedAt rather than throwing', () => {
  assert.equal(detectFutureExport('not a date', { now: Date.now() }), null);
  assert.equal(detectFutureExport(undefined, { now: Date.now() }), null);
});

test('detectBackwardExport returns null when there\'s no previous exportedAt to compare against (a peer seen for the first time)', () => {
  assert.equal(detectBackwardExport('2021-01-01T00:00:00.000Z', null), null);
  assert.equal(detectBackwardExport('2021-01-01T00:00:00.000Z', undefined), null);
});

test('detectBackwardExport returns null when a peer\'s new exportedAt is later than its previous one, however far apart', () => {
  // The core property: a peer going quiet for weeks between two
  // perfectly ordinary syncs must never look like a clock jump — only an
  // exportedAt that goes *backward* relative to that same peer's own
  // history does.
  const threeWeeksLater = '2021-01-22T00:00:00.000Z';
  assert.equal(detectBackwardExport(threeWeeksLater, '2021-01-01T00:00:00.000Z'), null);
});

test('detectBackwardExport flags a peer whose new exportedAt is earlier than its own last one, beyond DST-fallback tolerance', () => {
  const previous = '2021-06-01T12:00:00.000Z';
  const jumpedBackBy2h = '2021-06-01T10:00:00.000Z';
  const expected = Date.parse(previous) - Date.parse(jumpedBackBy2h);
  assert.equal(detectBackwardExport(jumpedBackBy2h, previous), expected);
  // Within the DST-fallback allowance — not flagged.
  assert.equal(detectBackwardExport('2021-06-01T11:30:00.000Z', previous), null);
});

test('detectBackwardExport returns null for unparseable timestamps rather than throwing', () => {
  assert.equal(detectBackwardExport('not a date', '2021-01-01T00:00:00.000Z'), null);
  assert.equal(detectBackwardExport('2021-01-01T00:00:00.000Z', 'not a date'), null);
});

test('mergeRecords resolves every remote record independently (interrupted-merge safety)', () => {
  // No shared state between resolutions — applying only a subset of the
  // actions (simulating a cycle that died halfway) leaves the rest simply
  // unapplied, not corrupted; re-running with the same remote list
  // produces the same resolutions again.
  const local = [];
  const remote = [
    { id: 'a', name: 'A', modifiedAt: '2021-01-01T00:00:00.000Z' },
    { id: 'b', name: 'B', modifiedAt: '2021-01-01T00:00:00.000Z' }
  ];
  const first = mergeRecords(local, remote, { importRaw: () => {}, tombstone: () => {} });
  const second = mergeRecords(local, remote, { importRaw: () => {}, tombstone: () => {} });
  assert.deepEqual(first.counts, second.counts);
});

test('describeDivergence pinpoints the exact differing leaf by path, reporting shape not content', () => {
  const a = { id: 'p1', targets: [{ id: 't1', photo: 'x'.repeat(100) }, { id: 't2', photo: 'y' }] };
  const b = { id: 'p1', targets: [{ id: 't1', photo: 'x'.repeat(100) }, { id: 't2', photo: 'z'.repeat(50) }] };
  const lines = describeDivergence(a, b);
  assert.equal(lines.length, 1);
  assert.ok(lines[0].startsWith('targets[1].photo:'), lines[0]);
  assert.ok(lines[0].includes('len=1'), 'local photo length reported');
  assert.ok(lines[0].includes('len=50'), 'remote photo length reported');
  // The actual content must never appear — only shape.
  assert.ok(!lines[0].includes('zzzzz'));
});

test('describeDivergence reports a top-level type mismatch (e.g. a stray Blob-shaped object where a string is expected)', () => {
  const a = { id: 'p1', photo: 'data:image/jpeg;base64,AAA' };
  const b = { id: 'p1', photo: {} }; // e.g. an unconverted Blob, which JSON-serializes as {}
  const lines = describeDivergence(a, b);
  assert.equal(lines.length, 1);
  assert.ok(lines[0].startsWith('photo:'));
  assert.ok(lines[0].includes('string(len=26)'));
  assert.ok(lines[0].includes('object(keys='));
});

test('describeDivergence caps how many leaves it reports', () => {
  const a = { targets: Array.from({ length: 20 }, (_, i) => ({ id: `t${i}`, photo: 'a' })) };
  const b = { targets: Array.from({ length: 20 }, (_, i) => ({ id: `t${i}`, photo: 'b' })) };
  const lines = describeDivergence(a, b, '', 3);
  assert.equal(lines.length, 3);
});

test('describeDivergence returns an empty list for equal values', () => {
  assert.deepEqual(describeDivergence({ a: 1 }, { a: 1 }), []);
});
