// A local change-history/revert safety net — see docs/plans/backup-sync.md
// Phase 9. Captures a full snapshot of every library write (the same
// upsert()/tombstone paths Phase 5's dirty flag hooks, via write-hooks.js)
// so an accidental deletion or edit — local, or merged in from another
// device — can be recovered. Explicitly **not** gated by the master
// backup/sync toggle: every user gets this, whether or not sync itself is
// ever turned on.
//
// Same in-memory-mirror-plus-background-persist shape as
// location-library.js/pending-review.js, and the same
// fire-and-forget/failure-tolerant posture for the capture write itself —
// a slow or failing IndexedDB write here must never block or throw into
// the caller's own synchronous upsert().
import { openDatabase, getAll, put, deleteRecord } from '../db.js';
import { DB_NAME, DB_VERSION, STORES } from '../db-schema.js';
import { onLibraryWrite } from './write-hooks.js';
import { SYNCED_LIBRARIES } from './synced-libraries.js';
import { getDeviceId } from './device-id.js';
import { logSyncEvent } from './sync-log.js';

const STORE_NAME = 'change-history';

// Bounds storage growth — a plain global cap (oldest entries pruned first)
// rather than a per-record count or age window, since "how much history
// is worth keeping" has no natural correctness constraint the way the
// tombstone retention window does (Phase 1); this is a convenience safety
// net, not a sync-correctness mechanism.
const MAX_ENTRIES = 500;

// A second, byte-based cap, because an entry count alone badly
// misrepresents the cost here. Capture is deliberately NOT gated by the
// backup/sync master toggle (see the header above), so every user pays for
// it — and a snapshot is a full record, which for a location or a
// rifle-precision project means every photo it holds, inline as a base64
// data-URL. A handful of edits to a photo-heavy project can run to tens of
// megabytes while sitting nowhere near 500 entries, so whichever cap binds
// first wins. Entries are pruned newest-first-kept, exactly like the count
// cap, and at least one entry always survives so a single oversized
// snapshot can't empty the store.
const MAX_BYTES = 8 * 1024 * 1024;

let mirror = [];
let dbPromise = null;
let readyPromise = null;
let writeChain = Promise.resolve();

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

function generateEntryId() {
  return `hist-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// Two captures landing in the same millisecond (a batch import, or just
// synchronous back-to-back edits) would otherwise tie on capturedAt alone
// — `seq` breaks the tie by actual capture order. Session-local and reset
// on reload, which is fine: it only needs to disambiguate entries that
// also share an identical capturedAt string, and capturedAt is compared
// first regardless.
let nextSeq = 0;

function byCapturedAtDesc(a, b) {
  return (Date.parse(b.capturedAt) - Date.parse(a.capturedAt)) || (b.seq - a.seq);
}

// Approximate serialized size of one snapshot. JSON.stringify on a record
// that is mostly one long base64 string is cheap and close enough — this
// only has to be accurate enough to stop a photo-heavy library from
// growing without bound, not to predict IndexedDB's own storage exactly.
function snapshotBytes(snapshot) {
  try {
    return JSON.stringify(snapshot).length;
  } catch {
    return 0; // circular/unserializable — shouldn't happen for a plain record
  }
}

function pruneIfNeeded() {
  const totalBytes = mirror.reduce((sum, e) => sum + (e.bytes || 0), 0);
  if (mirror.length <= MAX_ENTRIES && totalBytes <= MAX_BYTES) return;

  const sorted = [...mirror].sort(byCapturedAtDesc); // newest first
  const keep = new Set();
  let keptBytes = 0;
  for (const entry of sorted) {
    // `keep.size === 0` guarantees the newest entry always survives, even
    // if it alone is larger than MAX_BYTES.
    if (keep.size >= MAX_ENTRIES) break;
    if (keep.size > 0 && keptBytes + (entry.bytes || 0) > MAX_BYTES) break;
    keep.add(entry.id);
    keptBytes += entry.bytes || 0;
  }

  const toRemove = mirror.filter((e) => !keep.has(e.id));
  if (toRemove.length === 0) return;
  mirror = mirror.filter((e) => keep.has(e.id));
  logSyncEvent('debug', 'history pruned:', toRemove.length, 'entry/entries dropped');
  for (const entry of toRemove) {
    enqueueWrite(async () => {
      const db = await getDb();
      await deleteRecord(db, STORE_NAME, entry.id);
    });
  }
}

// Registered once at module load — see app.js, which imports this module
// specifically so the subscription exists before any view can trigger a
// write.
//
// What gets stored is the **superseded** value (`previous`), not the value
// just written — the plan's rule is "immediately before writing a new
// value for a given id, the *current* (about-to-be-superseded) content is
// pushed into the history store", and the difference is not academic.
// Storing the post-write value instead would mean a record that has never
// been edited on this build — which is every record in every existing
// user's library on upgrade day — has no prior version anywhere at the
// moment it is deleted, so the trash bin could not restore the one thing
// it exists to restore. It would also make "revert" on the newest entry a
// no-op re-save of the current state.
//
// A brand-new record has no `previous` and captures nothing: there is no
// earlier version to go back to, and an entry saying so would only pad the
// list. `supersededBy`/`supersededByDelete` carry who made the change this
// entry undoes, which is what the UI labels each row with — the snapshot's
// own modifiedBy names the author of the version being *kept*, not the one
// that replaced it.
onLibraryWrite(({ recordType, record, previous }) => {
  if (!previous) return;

  const actor = record.deletedAt ? record.deletedBy : record.modifiedBy;
  const entry = {
    id: generateEntryId(),
    recordType,
    recordId: record.id,
    snapshot: previous,
    bytes: snapshotBytes(previous),
    capturedAt: new Date().toISOString(),
    seq: nextSeq++,
    supersededBy: actor || null,
    supersededByDelete: !!record.deletedAt
  };
  mirror = [...mirror, entry];
  enqueueWrite(async () => {
    const db = await getDb();
    await put(db, STORE_NAME, entry);
  });
  pruneIfNeeded();

  // Distinguishes a local edit/delete from one applied by a merge purely
  // from who's already stamped on the record (Phase 4's `resolveRecord`
  // 'overwrite'/'apply-tombstone' write the *peer's* modifiedBy/deletedBy
  // verbatim) — no separate "origin" flag needs to travel through
  // write-hooks.js for this Phase 10 log line to distinguish the two.
  const origin = actor && actor !== getDeviceId() ? 'merge-applied' : 'local';
  const kind = record.deletedAt ? 'delete' : 'edit';
  logSyncEvent('debug', 'history captured:', recordType, record.id, `(${origin} ${kind})`);
});

// Must be awaited once at boot, alongside initLocationLibrary()/
// initRiflePrecisionLibrary() (see app.js) — before that, `mirror` only
// reflects whatever's been captured this session, not prior ones. Safe to
// call multiple times. On any failure (IndexedDB unavailable) leaves
// `mirror` as whatever was captured so far rather than blocking boot.
export function initChangeHistory() {
  if (!readyPromise) {
    readyPromise = (async () => {
      try {
        const db = await getDb();
        mirror = await getAll(db, STORE_NAME);
      } catch {
        // leave mirror as-is (whatever's been captured this session)
      }
    })();
  }
  return readyPromise;
}

export function listHistoryFor(recordType, recordId) {
  return mirror.filter((e) => e.recordType === recordType && e.recordId === recordId).sort(byCapturedAtDesc);
}

export function listRecentHistory(limit = 20) {
  return [...mirror].sort(byCapturedAtDesc).slice(0, limit);
}

// "Recently deleted" trash bin (Phase 9's UI) — driven by the libraries'
// own tombstones (`!isLive`, Phase 1) rather than by what happens to be in
// the history store, which is what the plan specifies and is now the only
// thing that works: history holds superseded values, so a plain deletion
// leaves a *live* snapshot behind, never a tombstone one. Reading the
// tombstones directly also means a record deleted with no history at all
// (deleted on a peer and merged in here, or pruned by the caps above)
// still shows up as deleted — just without a restore action, since
// `previousSnapshot` is what the restore needs and there isn't one.
export function listRecentlyDeleted(limit = 20) {
  const rows = [];
  for (const lib of SYNCED_LIBRARIES) {
    for (const record of lib.loadLocalWithTombstones()) {
      if (!record.deletedAt) continue;
      const previous = listHistoryFor(lib.recordType, record.id).find((e) => !e.snapshot.deletedAt);
      rows.push({
        recordType: lib.recordType,
        recordId: record.id,
        tombstone: record,
        deletedAt: record.deletedAt,
        deletedBy: record.deletedBy || null,
        previousSnapshot: previous ? previous.snapshot : null
      });
    }
  }
  rows.sort((a, b) => Date.parse(b.deletedAt) - Date.parse(a.deletedAt));
  return rows.slice(0, limit);
}

// Restores `snapshot` through the normal save path (a fresh
// modifiedAt/modifiedBy for this device) — an ordinary edit, not a new
// merge path, exactly like Phase 4's pending-review resolution. Works
// equally for reverting to a tombstone snapshot (undoing an edit made
// after a deletion) or a live one (undoing a deletion or a bad edit).
export function revertToSnapshot(recordType, snapshot) {
  const lib = SYNCED_LIBRARIES.find((l) => l.recordType === recordType);
  if (!lib) return;
  logSyncEvent('debug', 'history revert applied:', recordType, snapshot.id);
  lib.save(snapshot);
}

// ---- test-only exports ----
// Same three-function split as location-library.js/pending-review.js.

export async function resetChangeHistoryForTests() {
  await writeChain;
  try {
    const db = await getDb();
    const existing = await getAll(db, STORE_NAME);
    await Promise.all(existing.map((record) => deleteRecord(db, STORE_NAME, record.id)));
  } catch {
    // no store yet / IndexedDB unavailable — nothing to wipe
  }
  mirror = [];
  readyPromise = null;
  await initChangeHistory();
}

export async function reloadChangeHistoryForTests() {
  await writeChain;
  mirror = [];
  readyPromise = null;
  await initChangeHistory();
}

export function flushChangeHistoryWritesForTests() {
  return writeChain;
}
