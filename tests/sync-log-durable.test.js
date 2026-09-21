// The durable half of sync-log.js — see docs/plans/orphaned-storage-cleanup.md
// phase 1. The in-memory verbose trace is covered by sync-log.test.js,
// which deliberately installs no IndexedDB fake; this file installs one
// and asserts on what survives a reload.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom, installFakeIndexedDb } from './helpers/fake-dom.js';

installFakeDom();
installFakeIndexedDb();

const {
  logSyncEvent, setVerboseSyncLoggingEnabled, setSyncLogCycle,
  flushSyncLog, getPersistedSyncLog, clearPersistedSyncLog,
  initSyncLog, resetSyncLogForTests, reloadSyncLogForTests,
  flushSyncLogWritesForTests, setSyncLogCapsForTests
} = await import('../src/sync/sync-log.js');

test.beforeEach(async () => {
  localStorage.clear();
  setVerboseSyncLoggingEnabled(false);
  setSyncLogCapsForTests();
  await resetSyncLogForTests();
});

async function settle() {
  await flushSyncLog();
  await flushSyncLogWritesForTests();
}

test('info survives a reload even though verbose logging is off', async () => {
  logSyncEvent('info', 'sync cycle ended — timer');
  await settle();
  await reloadSyncLogForTests();

  const lines = await getPersistedSyncLog();
  assert.equal(lines.length, 1);
  assert.match(lines[0], /INFO sync cycle ended — timer/);
});

test('debug is dropped when verbose is off but kept when it is on', async () => {
  logSyncEvent('debug', 'per-record trace');
  await settle();
  assert.deepEqual(await getPersistedSyncLog(), []);

  setVerboseSyncLoggingEnabled(true);
  logSyncEvent('debug', 'per-record trace');
  await settle();
  const lines = await getPersistedSyncLog();
  assert.equal(lines.length, 1);
  assert.match(lines[0], /DEBUG per-record trace/);
});

test('warn and error are written immediately, without waiting for a flush', async () => {
  logSyncEvent('warn', 'could not write own bundle');
  await flushSyncLogWritesForTests();

  const lines = await getPersistedSyncLog();
  assert.equal(lines.length, 1);
  assert.match(lines[0], /WARN could not write own bundle/);
});

test('a segment is flushed once it reaches its line count, without any timer', async () => {
  for (let i = 0; i < 205; i++) logSyncEvent('info', `line ${i}`);
  await flushSyncLogWritesForTests();

  // The first 200 crossed the threshold and were written on their own; the
  // rest are still buffered until something flushes them.
  const beforeFlush = await getPersistedSyncLog();
  assert.ok(beforeFlush.length >= 200, `expected the full segment to be written, saw ${beforeFlush.length}`);
});

test('consecutive identical lines collapse into one entry with a count', async () => {
  for (let i = 0; i < 40; i++) logSyncEvent('info', 'sync: nothing changed, not publishing a new bundle');
  await settle();

  const lines = await getPersistedSyncLog();
  assert.equal(lines.length, 1, 'forty identical quiet lines should collapse to one entry');
  assert.match(lines[0], /\(x40, through /);
});

test('a differing line breaks the collapse run', async () => {
  logSyncEvent('info', 'quiet');
  logSyncEvent('info', 'quiet');
  logSyncEvent('info', 'something happened');
  logSyncEvent('info', 'quiet');
  await settle();

  const lines = await getPersistedSyncLog();
  assert.equal(lines.length, 3);
  assert.match(lines[0], /\(x2/);
  assert.match(lines[1], /something happened/);
  assert.doesNotMatch(lines[2], /\(x/);
});

test('an over-long line is truncated rather than stored whole', async () => {
  logSyncEvent('info', 'x'.repeat(5000));
  await settle();

  const lines = await getPersistedSyncLog();
  assert.equal(lines.length, 1);
  assert.match(lines[0], /… \(truncated\)$/);
  assert.ok(lines[0].length < 2200, `expected a truncated line, got ${lines[0].length} chars`);
});

test('the cycle id tags every line produced inside one cycle', async () => {
  setSyncLogCycle('cabc123');
  logSyncEvent('info', 'inside');
  setSyncLogCycle(null);
  logSyncEvent('info', 'outside');
  await settle();

  const lines = await getPersistedSyncLog();
  assert.match(lines[0], /\[cabc123\] INFO inside/);
  assert.doesNotMatch(lines[1], /\[cabc123\]/);
});

test('the line cap prunes oldest segments first, down to the target', async () => {
  setSyncLogCapsForTests({ maxLines: 400 });
  // 400 * 1.1 = 440 before pruning starts, down to 400 * 0.9 = 360.
  for (let i = 0; i < 1000; i++) {
    logSyncEvent('info', `line ${i}`);
    if (i % 200 === 199) await settle();
  }
  await settle();

  const lines = await getPersistedSyncLog();
  assert.ok(lines.length <= 440, `expected pruning below the high-water mark, saw ${lines.length}`);
  assert.ok(lines.length > 0);
  // Oldest first: the earliest lines are the ones that went.
  assert.doesNotMatch(lines.join('\n'), /line 0\b/);
  assert.match(lines.join('\n'), /line 999\b/);
});

test('the byte cap prunes independently of the line cap', async () => {
  setSyncLogCapsForTests({ maxBytes: 40 * 1024 });
  for (let i = 0; i < 600; i++) {
    logSyncEvent('info', `${i} ${'y'.repeat(300)}`);
    if (i % 100 === 99) await settle();
  }
  await settle();

  const lines = await getPersistedSyncLog();
  const bytes = lines.reduce((sum, l) => sum + l.length, 0);
  assert.ok(bytes <= 40 * 1024 * 1.2, `expected the byte cap to bind, saw ${bytes} bytes`);
  assert.ok(lines.length > 0, 'at least one segment always survives');
});

test('the age cap drops segments older than the window', async () => {
  logSyncEvent('info', 'ancient');
  await settle();
  // Everything already written is now "older than the window".
  setSyncLogCapsForTests({ maxAgeMs: -1 });
  logSyncEvent('info', 'recent');
  await settle();

  const lines = await getPersistedSyncLog();
  assert.ok(!lines.join('\n').includes('ancient'), 'the expired segment should be gone');
  assert.match(lines.join('\n'), /recent/);
});

test('pruning never empties the store completely', async () => {
  setSyncLogCapsForTests({ maxLines: 1, maxBytes: 1, maxAgeMs: -1 });
  logSyncEvent('info', 'the only thing left');
  await settle();

  const lines = await getPersistedSyncLog();
  assert.equal(lines.length, 1, 'at least one segment must always survive');
});

test('hysteresis leaves a store sitting exactly at the cap alone', async () => {
  setSyncLogCapsForTests({ maxLines: 10 });
  for (let i = 0; i < 10; i++) {
    logSyncEvent('info', `line ${i}`);
    await settle();
  }
  const lines = await getPersistedSyncLog();
  assert.equal(lines.length, 10, 'ten lines against a cap of ten is not over the high-water mark');
});

// `navigator` is a read-only accessor on newer Node globals, so it has to
// be redefined rather than assigned.
function withNavigator(stub, fn) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', { value: stub, configurable: true, writable: true });
  return (async () => fn())().finally(() => {
    if (descriptor) Object.defineProperty(globalThis, 'navigator', descriptor);
    else delete globalThis.navigator;
  });
}

test('a near-quota origin skips the write instead of throwing', async () => {
  await withNavigator({ storage: { estimate: async () => ({ usage: 99, quota: 100 }) } }, async () => {
    logSyncEvent('info', 'should not be stored');
    await settle();
    assert.deepEqual(await getPersistedSyncLog(), [], 'the log must yield rather than fill the last of the quota');
  });
});

test('an unavailable estimate is treated as plenty of room', async () => {
  await withNavigator({ storage: { estimate: async () => { throw new Error('unsupported'); } } }, async () => {
    logSyncEvent('info', 'stored anyway');
    await settle();
    assert.equal((await getPersistedSyncLog()).length, 1);
  });
});

test('clearPersistedSyncLog empties the store and the pending buffer', async () => {
  logSyncEvent('info', 'one');
  await settle();
  logSyncEvent('info', 'two (still buffered)');
  await clearPersistedSyncLog();

  assert.deepEqual(await getPersistedSyncLog(), []);
});

test('initSyncLog is safe to call repeatedly', async () => {
  logSyncEvent('info', 'kept');
  await settle();
  await initSyncLog();
  await initSyncLog();
  assert.equal((await getPersistedSyncLog()).length, 1);
});
