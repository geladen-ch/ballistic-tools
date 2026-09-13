import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from './helpers/fake-dom.js';

installFakeDom();

const {
  isVerboseSyncLoggingEnabled, setVerboseSyncLoggingEnabled, logSyncEvent, getSyncLog, clearSyncLog,
  resetVerboseSyncLoggingCacheForTests
} =
  await import('../src/sync/sync-log.js');

test.beforeEach(() => {
  localStorage.clear();
  clearSyncLog();
});

test('defaults to verbose logging off', () => {
  assert.equal(isVerboseSyncLoggingEnabled(), false);
});

test('setVerboseSyncLoggingEnabled persists and is read back', () => {
  setVerboseSyncLoggingEnabled(true);
  assert.equal(isVerboseSyncLoggingEnabled(), true);
  setVerboseSyncLoggingEnabled(false);
  assert.equal(isVerboseSyncLoggingEnabled(), false);
});

test('logSyncEvent is a no-op — no buffering, no formatting — while the verbose toggle is off', () => {
  logSyncEvent('debug', 'cycle started');
  assert.deepEqual(getSyncLog(), []);
});

test('once verbose logging is on, logSyncEvent buffers entries with their level', () => {
  setVerboseSyncLoggingEnabled(true);
  logSyncEvent('debug', 'cycle started');
  logSyncEvent('warn', 'cycle finished', { imported: 2 });
  const log = getSyncLog();
  assert.equal(log.length, 2);
  assert.ok(log[0].includes('DEBUG'));
  assert.ok(log[0].includes('cycle started'));
  assert.ok(log[1].includes('WARN'));
  assert.ok(log[1].includes('cycle finished'));
});

test('clearSyncLog empties the buffer', () => {
  setVerboseSyncLoggingEnabled(true);
  logSyncEvent('debug', 'something');
  clearSyncLog();
  assert.deepEqual(getSyncLog(), []);
});

test('the log caps at 1000 entries, dropping the oldest', () => {
  setVerboseSyncLoggingEnabled(true);
  for (let i = 0; i < 1005; i++) logSyncEvent('debug', `entry ${i}`);
  const log = getSyncLog();
  assert.equal(log.length, 1000);
  assert.ok(log[0].includes('entry 5'));
  assert.ok(log[999].includes('entry 1004'));
});

test('the toggle is read from storage once and cached, not on every call', () => {
  // merge.js logs one line per record per peer per cycle, so this check
  // sits on the hottest path in the feature; a synchronous storage read
  // there is pure waste.
  resetVerboseSyncLoggingCacheForTests();
  setVerboseSyncLoggingEnabled(false);

  let reads = 0;
  const realGetItem = localStorage.getItem.bind(localStorage);
  localStorage.getItem = (key) => {
    if (key === 'ballistics_sync_verbose_logging_v1') reads++;
    return realGetItem(key);
  };
  try {
    for (let i = 0; i < 50; i++) logSyncEvent('debug', 'record', i);
    assert.ok(reads <= 1, `expected at most one storage read, saw ${reads}`);
  } finally {
    localStorage.getItem = realGetItem;
  }
  assert.deepEqual(getSyncLog(), []);
});

test('the setter keeps the cache in step, so turning logging on takes effect immediately', () => {
  resetVerboseSyncLoggingCacheForTests();
  setVerboseSyncLoggingEnabled(false);
  logSyncEvent('debug', 'ignored');
  clearSyncLog();

  setVerboseSyncLoggingEnabled(true);
  assert.equal(isVerboseSyncLoggingEnabled(), true);
  logSyncEvent('debug', 'kept');
  assert.equal(getSyncLog().length, 1);
  setVerboseSyncLoggingEnabled(false);
});
