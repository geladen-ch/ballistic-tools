// IndexedDB-backed store of automatic-merge conflicts that couldn't be
// resolved without a person — see docs/plans/backup-sync.md Phase 4's
// "Pending review needs somewhere to live". A skip-review outcome from
// mergeRecords() (merge.js) is produced mid-cycle from a peer's bundle
// that may not be readable later (Phase 8a/8b have no persisted folder
// handle at all), so it's captured here rather than recomputed on demand,
// and rather than kept only in memory (which would make the "N items need
// review" badge vanish on reload).
//
// Same in-memory-mirror-plus-background-persist shape as
// location-library.js/rifle-precision-library.js, for the same reason:
// Phase 6's Settings view needs a synchronous read for its badge count.
import { openDatabase, getAll, put, deleteRecord } from '../db.js';
import { DB_NAME, DB_VERSION, STORES } from '../db-schema.js';
import { onLibraryWrite } from './write-hooks.js';
import { equivalent } from './merge.js';
import { logSyncEvent } from './sync-log.js';

const STORE_NAME = 'pending-review';

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

// Must be awaited once, before any of the synchronous functions below are
// relied on for real data — same convention as
// initLocationLibrary()/initRiflePrecisionLibrary(). On any failure
// (IndexedDB unavailable) leaves `mirror` empty rather than blocking app
// boot.
export function initPendingReview() {
  if (!readyPromise) {
    readyPromise = (async () => {
      try {
        const db = await getDb();
        mirror = await getAll(db, STORE_NAME);
      } catch {
        mirror = [];
      }
    })();
  }
  return readyPromise;
}

function reviewId(recordType, recordId) {
  return `${recordType}:${recordId}`;
}

function persist(entry) {
  enqueueWrite(async () => {
    const db = await getDb();
    await put(db, STORE_NAME, entry);
  });
}

function upsertEntry(entry) {
  const idx = mirror.findIndex((e) => e.id === entry.id);
  mirror = idx === -1 ? [...mirror, entry] : mirror.map((e, i) => (i === idx ? entry : e));
  persist(entry);
  return entry;
}

// Adds one pending-review entry — called by runSyncCycle() (Phase 5) and
// manual-sync.js whenever mergeRecords() reports a skip-review outcome.
// `remoteVersion` is the full competing record, so the review UI (Phase 6)
// can show both sides without needing the original bundle file back.
//
// A *resolved* entry for the same record acts as a suppression marker (see
// markPendingReviewResolved below), and the incoming remote version is
// compared against the one the user already decided about: identical means
// this is the same conflict re-offered by an unchanged peer bundle, and it
// stays suppressed. This is what stops a `reason: 'unresolvable-timestamp'`
// conflict from recurring forever — resolving it restamps only the *local*
// side, while compareTimestamps() reports 'unknown' whenever *either* side
// is unparseable, so the peer's un-timestamped record would otherwise
// re-raise the identical conflict on every single cycle with nothing the
// user could ever do about it. A genuinely new version from that peer
// compares unequal and correctly re-raises.
export function addPendingReview({ recordType, recordId, reason, peerDeviceId, remoteVersion }) {
  const id = reviewId(recordType, recordId);
  const existing = mirror.find((e) => e.id === id);
  if (existing && existing.resolvedAt && existing.remoteVersion && remoteVersion
      && equivalent(existing.remoteVersion, remoteVersion)) {
    logSyncEvent('debug', 'pending review: suppressed, already resolved against this version —', id);
    return existing;
  }
  return upsertEntry({
    id, recordType, recordId, reason, peerDeviceId, remoteVersion, seenAt: new Date().toISOString()
  });
}

// Records that the user has decided this conflict, against this specific
// competing version. Must be called *after* the resolving write, not
// before: that write goes through the ordinary save path, which fires the
// library-write hook below and clears the outstanding entry — marking
// first would just have it cleared again a moment later.
export function markPendingReviewResolved(recordType, recordId, remoteVersion) {
  const id = reviewId(recordType, recordId);
  const existing = mirror.find((e) => e.id === id);
  return upsertEntry({
    id,
    recordType,
    recordId,
    reason: existing ? existing.reason : null,
    peerDeviceId: existing ? existing.peerDeviceId : null,
    remoteVersion,
    seenAt: existing ? existing.seenAt : new Date().toISOString(),
    resolvedAt: new Date().toISOString()
  });
}

// Undoes a decision recorded via markPendingReviewResolved — used only by
// the Backup & Sync settings UI's "Cancel" action
// (src/ui/backup-sync-settings.js), which reverts the resolving write and
// needs this exact conflict to come back as outstanding, in the same
// dialog, right away. addPendingReview() can't do this on its own: its
// suppression check above treats an identical `remoteVersion` arriving
// against an already-resolved marker as "nothing new from the peer, stay
// suppressed" — correct for every real sync cycle re-offering the same
// unchanged version, and exactly wrong for a deliberate, explicit Cancel
// of that same resolution. This bypasses that check entirely rather than
// special-casing it, since a person clicking Cancel is not "the peer"
// and should never be subject to peer-suppression logic.
export function reopenPendingReview(recordType, recordId, { reason, peerDeviceId, remoteVersion, seenAt } = {}) {
  const id = reviewId(recordType, recordId);
  const existing = mirror.find((e) => e.id === id);
  return upsertEntry({
    id,
    recordType,
    recordId,
    reason: reason ?? (existing && existing.reason) ?? null,
    peerDeviceId: peerDeviceId ?? (existing && existing.peerDeviceId) ?? null,
    remoteVersion: remoteVersion ?? (existing && existing.remoteVersion) ?? null,
    seenAt: seenAt ?? (existing && existing.seenAt) ?? new Date().toISOString()
    // Deliberately no `resolvedAt` — this is what makes isOutstanding()
    // true again.
  });
}

function isOutstanding(entry) {
  return !entry.resolvedAt;
}

export function listPendingReviews() {
  return mirror.filter(isOutstanding);
}

export function getPendingReviewCount() {
  return mirror.filter(isOutstanding).length;
}

// Retires the outstanding conflict for one record — because the user
// resolved it, because a later merge reached a definite answer for that
// record from anywhere, or because the record was written or deleted
// locally. A resolved suppression marker is deliberately left in place:
// it is the only thing standing between an un-timestamped peer record and
// an endlessly recurring review item, and it is retired instead by
// addPendingReview() the moment that peer publishes a genuinely different
// version. Cheap to call liberally — with nothing outstanding for that id
// it does no work at all, which matters because the merge path calls it
// once per resolved record per peer per cycle.
export function clearPendingReview(recordType, recordId) {
  const id = reviewId(recordType, recordId);
  const existing = mirror.find((e) => e.id === id);
  if (!existing || !isOutstanding(existing)) return;
  mirror = mirror.filter((e) => e.id !== id);
  enqueueWrite(async () => {
    const db = await getDb();
    await deleteRecord(db, STORE_NAME, id);
  });
}

// Any write to a record — a local edit, a local delete, or a merge-applied
// overwrite/tombstone — settles whatever conflict was outstanding against
// it: the record has moved on, and a stale competing version from before
// that move is no longer something to ask the user about. Registered at
// module load, like change-history.js's own capture hook.
onLibraryWrite(({ recordType, record }) => {
  if (record && record.id) clearPendingReview(recordType, record.id);
});

// A conflict's `remoteVersion` traces back to one specific peer's bundle
// at the moment `addPendingReview` captured it — but nothing requires
// that peer to *keep* offering it. If the record was renamed/edited again
// on either side, `clearPendingReview` above (fired by that later write)
// retires it. But a write only ever happens on the device that makes it —
// a peer whose own later edit or delete this device never gets to see
// again (the record simply stops appearing in that peer's bundle at all,
// with nothing else ever touching it locally either) leaves an entry with
// nothing left to review: the competing version it names is no longer
// being offered by anyone, and this device's own copy was never edited
// either. Call this once per (recordType, peer) per cycle, right after
// merging that peer's bundle, with the full set of ids that bundle
// currently lists for this record type — any outstanding entry
// attributed to that peer whose id isn't in that set has aged out.
//
// Deliberately scoped to entries attributed to *this* peer only: a
// conflict against Peer A says nothing about whether Peer B still offers
// anything, so a cycle that only reads Peer B's file must not touch
// entries pointing at Peer A.
export function expireStaleReviewsForPeer(recordType, peerDeviceId, currentRemoteIds) {
  const idSet = new Set(currentRemoteIds);
  const stale = mirror.filter((e) => (
    isOutstanding(e) && e.recordType === recordType && e.peerDeviceId === peerDeviceId && !idSet.has(e.recordId)
  ));
  for (const entry of stale) {
    logSyncEvent('debug', 'pending review: expired, peer no longer offers this version —', entry.id);
    clearPendingReview(entry.recordType, entry.recordId);
  }
}

// ---- test-only exports ----
// Same three-function split as location-library.js/
// rifle-precision-library.js: full reset for per-test isolation vs.
// reload-without-wiping for durability tests vs. deterministically
// awaiting in-flight background writes.

export async function resetPendingReviewForTests() {
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
  await initPendingReview();
}

export async function reloadPendingReviewForTests() {
  await writeChain;
  mirror = [];
  readyPromise = null;
  await initPendingReview();
}

export function flushPendingReviewWritesForTests() {
  return writeChain;
}
