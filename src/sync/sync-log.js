// A small in-memory sync-activity log plus its verbose-logging toggle —
// see docs/plans/backup-sync.md Phase 10. Same shape as debug-log.js's
// diagnostic buffer, kept as its own module since this one is sync-specific
// and gets its own "Copy sync debug log" button (Phase 6), separate from
// the app's existing general diagnostics download.
const VERBOSE_KEY = 'ballistics_sync_verbose_logging_v1';
// Larger than debug-log.js's 300-entry cap — a single verbose sync cycle
// can produce a per-record trace across four library types plus
// device-registry/history-capture events, far higher volume than the
// app's general boot/loading diagnostics.
const MAX_LOG_ENTRIES = 1000;

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

// Gated *inside* the function — checked before any string formatting or
// buffering happens — so every call site elsewhere in the sync code (down
// to merge.js's per-record resolveRecord() trace, the verbose core of this
// feature) can call this unconditionally at essentially no cost while the
// toggle is off, the same way callers of debug-log.js's logDiagnostic()
// never check anything themselves. Genuine failures are NOT routed through
// here — see each call site's own logDiagnostic('error'|'warn', ...) call,
// which fires regardless of this toggle.
export function logSyncEvent(level, ...args) {
  if (!isVerboseSyncLoggingEnabled()) return;
  const line = `[${new Date().toISOString()}] ${level.toUpperCase()} ${args.map(String).join(' ')}`;
  buffer.push(line);
  if (buffer.length > MAX_LOG_ENTRIES) buffer.shift();
  console.debug('[sync]', ...args);
}

export function getSyncLog() {
  return [...buffer];
}

export function clearSyncLog() {
  buffer = [];
}

// ---- test-only exports ----
// Drops the cached toggle so a test that manipulates localStorage directly
// (rather than through setVerboseSyncLoggingEnabled above) still sees its
// own change — the browser gets the same effect from the `storage`
// listener, which no test environment fires.
export function resetVerboseSyncLoggingCacheForTests() {
  verboseCache = null;
}
