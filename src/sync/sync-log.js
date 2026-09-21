// A sync-activity log in two layers — see docs/plans/backup-sync.md Phase
// 10 for the original in-memory trace, and docs/plans/orphaned-storage-
// cleanup.md phase 1 for the durable one added on top.
//
//  - `buffer` is the **verbose session trace**: everything, gated behind
//    the verbose toggle, in memory only, lost on reload. It backs
//    getSyncLog() and the "Copy sync debug log" button, and its semantics
//    are deliberately unchanged — with the toggle off it stays empty.
//  - `pending`/IndexedDB is the **durable audit trail**: info/warn/error
//    always, debug only when verbose is on, written in segments that
//    survive a reload. It backs getPersistedSyncLog() and the diagnostics
//    download.
//
// Two layers rather than one because the two answer different questions.
// The trace answers "what is this cycle doing right now", which is why it
// is opt-in and exhaustive. The audit trail answers "what happened before
// the thing I am now investigating", which is useless if it only starts
// recording once the user has already noticed a problem and gone looking
// for the switch — by then the evidence is gone. Everything in that plan
// either repairs files or deletes them from a folder shared between
// devices, and none of it should run without a record that outlives the
// tab.
import { openDatabase, getAll, put, deleteRecord } from '../db.js';
import { DB_NAME, DB_VERSION, STORES } from '../db-schema.js';

const VERBOSE_KEY = 'ballistics_sync_verbose_logging_v1';
// Larger than debug-log.js's 300-entry cap — a single verbose sync cycle
// can produce a per-record trace across four library types plus
// device-registry/history-capture events, far higher volume than the
// app's general boot/loading diagnostics.
const MAX_LOG_ENTRIES = 1000;

const STORE_NAME = 'sync-log';

// One record per ~200 lines rather than one per line. A log line is tiny
// and high-volume; a record each would mean a transaction per line and
// tens of thousands of records to sort and prune. Segments cut both by
// roughly 200x, and rotation then deletes whole segments, which is how
// log rotation works everywhere else.
const SEGMENT_MAX_LINES = 200;
const FLUSH_IDLE_MS = 2000;

// Three caps, whichever binds first — the same two-cap shape
// change-history.js uses, plus age. Held in an object rather than as bare
// constants only so the tests can shrink them: exercising a 20,000-line
// cap honestly would mean logging 22,000 lines per assertion, and the age
// cap could not be tested at all without either that or a clock stub.
const CAPS = {
  maxLines: 20000,
  maxBytes: 4 * 1024 * 1024,
  maxAgeMs: 30 * 24 * 60 * 60 * 1000
};
// One pathological line must not be able to dominate a segment. Photos and
// base64 must never reach the log at all — see merge.js's
// describeDivergence(), which exists precisely so a verbose trace can
// describe a diverging record without dumping its contents.
const MAX_LINE_CHARS = 2000;
// Hysteresis: prune at 110% of a cap down to 90%, so a flush sitting right
// on the boundary doesn't trigger a delete every single time.
const PRUNE_HIGH_WATER = 1.1;
const PRUNE_TARGET = 0.9;

let buffer = [];

// The toggle is read once and cached, not re-read from localStorage on
// every call: merge.js logs one line *per record per peer per cycle*, so
// this check sits on the hottest path in the whole feature and a
// synchronous storage read there is pure waste. `null` means "not read
// yet"; the setter below updates the cache in step, and the cross-tab
// `storage` listener keeps a second tab's cache honest (the one case a
// plain cache would get wrong — turning verbose logging on in one tab
// while another is mid-sync).
let verboseCache = null;

function readVerbosePref() {
  try {
    return localStorage.getItem(VERBOSE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function isVerboseSyncLoggingEnabled() {
  if (verboseCache === null) verboseCache = readVerbosePref();
  return verboseCache;
}

export function setVerboseSyncLoggingEnabled(enabled) {
  verboseCache = !!enabled;
  try {
    localStorage.setItem(VERBOSE_KEY, enabled ? 'true' : 'false');
  } catch {
    // storage full/disabled — best-effort, same posture as prefs.js
  }
}

if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('storage', (event) => {
    if (!event || event.key === null || event.key === VERBOSE_KEY) verboseCache = null;
  });
}

// Best-effort checkpoint when the tab goes away. Deliberately
// `visibilitychange` and not `pagehide`: fs-folder.js's own Phase 5 note
// already establishes that this project does not rely on pagehide, and
// visibilitychange fires earlier and far more reliably on mobile. Whatever
// is still buffered when a process is killed outright is lost, which is
// the accepted trade for not writing a record per line — anything at
// `warn` or above was already flushed on its own.
if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushSyncLog();
  });
}

// ---- durable layer ----

let dbPromise = null;
let readyPromise = null;
// Metadata only — { id, seq, endedAt, lineCount, bytes } per stored
// segment, never the lines themselves. Pruning needs to know how much is
// stored and in what order; it does not need the content, and db.js
// deliberately offers no cursors or indexes (see its header), so the one
// getAll() at init is where that index comes from. The lines are dropped
// immediately afterwards rather than held for the life of the tab.
let index = [];
let indexLines = 0;
let indexBytes = 0;
let nextSeq = 0;

let pending = [];
let pendingBytes = 0;
let flushTimer = null;
let writeChain = Promise.resolve();
let currentCycle = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDatabase({ name: DB_NAME, version: DB_VERSION, stores: STORES });
  }
  return dbPromise;
}

function enqueueWrite(taskFn) {
  writeChain = writeChain.then(taskFn, taskFn).catch(() => {});
  return writeChain;
}

function generateSegmentId() {
  return `log-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// Rough, and deliberately so: this only has to keep a runaway log from
// filling the origin's quota, not to predict IndexedDB's own storage.
function lineBytes(line) {
  return (line.text ? line.text.length : 0) + 64;
}

// A sync cycle groups every line it produces, so a later reader can pull
// one cycle out of a month of them. Set by auto-sync.js around each cycle;
// null outside one (a boot-time line, a manual import).
export function setSyncLogCycle(cycle) {
  currentCycle = cycle || null;
}

function scheduleFlush() {
  if (flushTimer !== null) return;
  if (typeof setTimeout !== 'function') return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushSyncLog();
  }, FLUSH_IDLE_MS);
  // Node keeps the event loop alive for a pending timer, which would hang
  // `node --test` on a suite that logged anything. Browsers have no
  // unref(); the guard covers both.
  if (flushTimer && typeof flushTimer.unref === 'function') flushTimer.unref();
}

function appendDurable(level, text, at) {
  const last = pending[pending.length - 1];
  // Consecutive identical lines collapse into one entry with a count. A
  // quiet cycle (read the folder, nothing changed, nothing published) is
  // the overwhelming majority of cycles at a 5-minute timer plus every tab
  // focus, and without this the log is almost entirely that, so the caps
  // evict the interesting parts first. Collapsing happens here, in the
  // segment under construction — a flushed segment is immutable, so across
  // a flush boundary you get one collapsed entry per segment rather than
  // one overall. That is expected, not a defect.
  if (last && last.level === level && last.text === text && last.cycle === currentCycle) {
    last.repeat = (last.repeat || 1) + 1;
    last.until = at;
    return;
  }
  const line = { at, level, cycle: currentCycle, text };
  pending.push(line);
  pendingBytes += lineBytes(line);
  if (pending.length >= SEGMENT_MAX_LINES) flushSyncLog();
  else scheduleFlush();
}

// Gated *inside* the function — checked before any string formatting or
// buffering happens for the verbose trace — so every call site elsewhere
// in the sync code (down to merge.js's per-record resolveRecord() trace,
// the verbose core of this feature) can call this unconditionally at
// essentially no cost while the toggle is off, the same way callers of
// debug-log.js's logDiagnostic() never check anything themselves. Genuine
// failures are NOT routed through here alone — see each call site's own
// logDiagnostic('error'|'warn', ...) call, which fires regardless of this
// toggle.
//
// `info`, `warn` and `error` always reach the durable layer; `debug` only
// when verbose is on. The in-memory trace and the console stay gated
// exactly as before, so nothing gets noisier for a user who has not asked
// for it.
export function logSyncEvent(level, ...args) {
  const verbose = isVerboseSyncLoggingEnabled();
  const durable = level !== 'debug';
  if (!verbose && !durable) return;

  const at = new Date().toISOString();
  let text = args.map(String).join(' ');
  if (text.length > MAX_LINE_CHARS) text = `${text.slice(0, MAX_LINE_CHARS)}… (truncated)`;

  if (verbose) {
    buffer.push(`[${at}] ${level.toUpperCase()} ${text}`);
    if (buffer.length > MAX_LOG_ENTRIES) buffer.shift();
    console.debug('[sync]', ...args);
  }

  if (durable || verbose) {
    try {
      appendDurable(level, text, at);
    } catch {
      // The log must never be able to break the thing it is logging.
    }
  }
}

export function getSyncLog() {
  return [...buffer];
}

export function clearSyncLog() {
  buffer = [];
}

// Writes whatever is buffered as one segment. Safe to call at any time;
// a no-op when there is nothing pending.
export function flushSyncLog() {
  if (flushTimer !== null && typeof clearTimeout === 'function') {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (pending.length === 0) return writeChain;

  const lines = pending;
  const bytes = pendingBytes;
  pending = [];
  pendingBytes = 0;

  const segment = {
    id: generateSegmentId(),
    seq: nextSeq++,
    startedAt: lines[0].at,
    endedAt: lines[lines.length - 1].until || lines[lines.length - 1].at,
    lineCount: lines.reduce((sum, l) => sum + (l.repeat || 1), 0),
    bytes,
    lines
  };

  return enqueueWrite(async () => {
    if (await isNearQuota()) return; // dropping log lines beats blocking the user's own data
    const db = await getDb();
    await put(db, STORE_NAME, segment);
    index.push({
      id: segment.id, seq: segment.seq, endedAt: segment.endedAt,
      lineCount: segment.lineCount, bytes: segment.bytes
    });
    indexLines += segment.lineCount;
    indexBytes += segment.bytes;
    await pruneIfNeeded();
  });
}

// The log must never be the reason a user's actual data cannot be saved,
// so a near-full origin drops log lines rather than competing for the last
// of the quota. Absent or unimplemented storage estimation is treated as
// "plenty of room", which is the same assumption the app makes today.
async function isNearQuota() {
  try {
    if (typeof navigator === 'undefined' || !navigator.storage || !navigator.storage.estimate) return false;
    const { usage, quota } = await navigator.storage.estimate();
    if (!quota) return false;
    return usage / quota > 0.95;
  } catch {
    return false;
  }
}

// Oldest segments first, in plain age order — unlike change-history.js's
// newest-first-kept, because a log's value is chronological continuity,
// not recency alone. At least one segment always survives.
async function pruneIfNeeded() {
  const cutoff = Date.now() - CAPS.maxAgeMs;
  const bySeq = [...index].sort((a, b) => a.seq - b.seq);

  const doomed = [];
  // Age is monotonic, so it needs no hysteresis — an expired segment is
  // expired whatever the totals say.
  while (bySeq.length > 1 && Date.parse(bySeq[0].endedAt) <= cutoff) doomed.push(bySeq.shift());

  let lines = bySeq.reduce((sum, s) => sum + s.lineCount, 0);
  let bytes = bySeq.reduce((sum, s) => sum + s.bytes, 0);
  if (lines > CAPS.maxLines * PRUNE_HIGH_WATER || bytes > CAPS.maxBytes * PRUNE_HIGH_WATER) {
    while (bySeq.length > 1 && (lines > CAPS.maxLines * PRUNE_TARGET || bytes > CAPS.maxBytes * PRUNE_TARGET)) {
      const dropped = bySeq.shift();
      lines -= dropped.lineCount;
      bytes -= dropped.bytes;
      doomed.push(dropped);
    }
  }
  if (doomed.length === 0) return;

  const doomedIds = new Set(doomed.map((s) => s.id));
  index = index.filter((s) => !doomedIds.has(s.id));
  indexLines = index.reduce((sum, s) => sum + s.lineCount, 0);
  indexBytes = index.reduce((sum, s) => sum + s.bytes, 0);
  try {
    const db = await getDb();
    for (const segment of doomed) await deleteRecord(db, STORE_NAME, segment.id);
  } catch {
    // best-effort — the index is already updated, so a failed delete just
    // means the next prune tries again
  }
}

// Must be awaited once at boot, alongside the other inits in app.js. On
// any failure (IndexedDB unavailable — Safari private mode, disabled
// storage, a test environment with no fake) the durable layer simply does
// nothing and the app is otherwise unaffected.
export function initSyncLog() {
  if (!readyPromise) {
    readyPromise = (async () => {
      try {
        const db = await getDb();
        const stored = await getAll(db, STORE_NAME);
        index = stored.map((s) => ({
          id: s.id, seq: s.seq || 0, endedAt: s.endedAt,
          lineCount: s.lineCount || 0, bytes: s.bytes || 0
        }));
        indexLines = index.reduce((sum, s) => sum + s.lineCount, 0);
        indexBytes = index.reduce((sum, s) => sum + s.bytes, 0);
        nextSeq = index.reduce((max, s) => Math.max(max, s.seq + 1), 0);
        await pruneIfNeeded();
      } catch {
        index = [];
        indexLines = 0;
        indexBytes = 0;
      }
    })();
  }
  return readyPromise;
}

function formatLine(line) {
  const repeat = line.repeat > 1 ? ` (x${line.repeat}, through ${line.until})` : '';
  const cycle = line.cycle ? ` [${line.cycle}]` : '';
  return `[${line.at}]${cycle} ${String(line.level).toUpperCase()} ${line.text}${repeat}`;
}

// The full durable history, oldest first, formatted like getSyncLog()'s
// lines. Reads the store fresh rather than holding every line in memory
// for the life of the tab — this is called when someone downloads
// diagnostics, not on any hot path.
export async function getPersistedSyncLog() {
  await flushSyncLog();
  try {
    const db = await getDb();
    const stored = await getAll(db, STORE_NAME);
    return stored
      .sort((a, b) => (a.seq || 0) - (b.seq || 0))
      .flatMap((segment) => (segment.lines || []).map(formatLine));
  } catch {
    return [];
  }
}

export async function clearPersistedSyncLog() {
  pending = [];
  pendingBytes = 0;
  try {
    const db = await getDb();
    const stored = await getAll(db, STORE_NAME);
    await Promise.all(stored.map((segment) => deleteRecord(db, STORE_NAME, segment.id)));
  } catch {
    // nothing stored / IndexedDB unavailable — nothing to clear
  }
  index = [];
  indexLines = 0;
  indexBytes = 0;
}

// Flushes whatever is buffered and applies the rotation caps, on demand —
// used by the manual "Clean up storage now" action. Boot does the same
// thing via initSyncLog().
export async function rotateSyncLogNow() {
  await flushSyncLog();
  await writeChain;
  try {
    await pruneIfNeeded();
  } catch {
    // best-effort, exactly as at boot
  }
}

// ---- test-only exports ----
// Drops the cached toggle so a test that manipulates localStorage directly
// (rather than through setVerboseSyncLoggingEnabled above) still sees its
// own change — the browser gets the same effect from the `storage`
// listener, which no test environment fires.
export function resetVerboseSyncLoggingCacheForTests() {
  verboseCache = null;
}

// Lets a test deterministically wait for in-flight segment writes to land
// before asserting durability, instead of an arbitrary timeout.
export function flushSyncLogWritesForTests() {
  return writeChain;
}

// Full reset of the durable layer for per-test isolation.
export async function resetSyncLogForTests() {
  await writeChain;
  await clearPersistedSyncLog();
  nextSeq = 0;
  currentCycle = null;
  readyPromise = null;
  await initSyncLog();
}

// Shrinks the rotation caps so a test can exercise them without writing
// tens of thousands of lines. Pass nothing to restore the real values.
export function setSyncLogCapsForTests(overrides) {
  CAPS.maxLines = overrides && overrides.maxLines !== undefined ? overrides.maxLines : 20000;
  CAPS.maxBytes = overrides && overrides.maxBytes !== undefined ? overrides.maxBytes : 4 * 1024 * 1024;
  CAPS.maxAgeMs = overrides && overrides.maxAgeMs !== undefined ? overrides.maxAgeMs : 30 * 24 * 60 * 60 * 1000;
}

// Reloads the index from the store without touching it, to prove a write
// survived a simulated restart.
export async function reloadSyncLogForTests() {
  await writeChain;
  readyPromise = null;
  await initSyncLog();
}
