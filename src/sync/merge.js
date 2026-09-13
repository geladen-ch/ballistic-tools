// The automatic-merge algorithm — see docs/plans/backup-sync.md Phase 4
// for the full specification and rationale behind every branch below.
// Generic over any flat list of `{ id, modifiedAt | deletedAt, ... }`
// records; bullets, rifles, locations, and rifle-precision projects are
// each merged independently by calling this once per library.
import { logSyncEvent } from './sync-log.js';
import { revisionOf } from './revision.js';

// Revision comparison — the primary ordering signal, ahead of the
// wall-clock timestamp comparison below. Never 'unknown': revisionOf()
// always returns a plain integer (0 for a record that predates this
// field), so there's nothing "unparseable" the way a hand-edited date
// string can be.
//
// This app's storage layer (user-library.js and its Locations/Rifle
// Precision equivalents) is what actually maintains the invariant that
// makes this safe to trust ahead of timestamps: every LOCAL write bumps a
// record's revision to one more than whatever was already stored, and
// every MERGE-APPLIED write adopts the incoming value verbatim with no
// bump at all — see revision.js's own comment for why "verbatim, not
// re-bumped" is the load-bearing half of that rule. That combination is
// what makes "edit on the phone, sync, edit on the laptop" resolve
// correctly regardless of either clock: the laptop's edit bumps from
// whatever it had (which included the phone's already-synced revision),
// so it provably comes after, with no clock involved in that ordering at
// all.
function compareRevisions(remote, local) {
  const remoteRev = revisionOf(remote);
  const localRev = revisionOf(local);
  if (remoteRev > localRev) return 'newer';
  if (remoteRev < localRev) return 'older';
  return 'same';
}

// compareModifiedAt (arsenal-export.js) generalized to compare on
// `deletedAt ?? modifiedAt` for each side — a tombstone's deletedAt sits
// on the exact same "when did this state last change" axis as
// modifiedAt, so the two compare directly with no separate rule needed
// for "tombstone vs. live record".
export function compareTimestamps(remoteTime, localTime) {
  const a = remoteTime ? Date.parse(remoteTime) : NaN;
  const b = localTime ? Date.parse(localTime) : NaN;
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 'unknown';
  if (a > b) return 'newer';
  if (a < b) return 'older';
  return 'same';
}

function lastChanged(record) {
  return record.deletedAt ?? record.modifiedAt;
}

// Plain structural equality over JSON-shaped data (objects/arrays/
// primitives) — not a library dependency (this project has none), and not
// JSON.stringify comparison, since that's sensitive to key order, which
// two independently-serialized copies of the same record have no
// obligation to preserve.
//
// An absent key and an explicitly-null one compare **equal** here, and
// that is not a convenience: this app's own storage layer manufactures
// that exact difference. location-library.js/rifle-precision-library.js's
// toStorable()/fromStorable() normalize a missing photo to `photo: null`
// on the IndexedDB round-trip, so the same record can legitimately gain a
// null-valued key just by surviving a reload. Comparing those as unequal
// sends already-merged records down the skip-review path forever — the
// same permanent "N items need review" failure the plan warns about for
// `unsaved`, arriving through a different door.
function deepEqual(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return a == null && b == null; // null ≍ undefined
  if (typeof a !== typeof b) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    return a.length === b.length && a.every((v, i) => deepEqual(v, b[i]));
  }
  if (typeof a === 'object') {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    return [...keys].every((k) => deepEqual(a[k], b[k]));
  }
  return false;
}

// Normalized-projection equality — a naive structural comparison is
// actively wrong here: the local copy carries `unsaved`, which
// stripLocalOnlyFields() (arsenal-export.js and its Locations/Rifle
// Precision equivalents) removes on export, so every already-merged
// record would otherwise compare unequal to its own remote copy forever,
// permanently pinning it to the skip-review path. `modifiedBy` is *not*
// dropped — it travels in the bundle (Phase 2), so both sides legitimately
// carry it once already merged. Photo fields need no special handling
// despite the plan's own caution about Blob-vs-data-URL: by the time a
// record reaches here (via load*WithTombstones()), location-library.js/
// rifle-precision-library.js's own fromStorable() has already normalized
// every photo to the same data-URL-string representation the export/
// bundle side uses, on both sides of this comparison. The other
// storage-layer artifact — a key that exists as `null` on one side and not
// at all on the other — is handled by deepEqual above rather than here,
// since it can appear at any depth, not just on the record's own fields.
export function equivalent(local, remote) {
  const { unsaved: _lu, ...localRest } = local;
  const { unsaved: _ru, ...remoteRest } = remote;
  return deepEqual(localRest, remoteRest);
}

function describeLeaf(v) {
  if (typeof v === 'string') return `string(len=${v.length})`;
  if (Array.isArray(v)) return `array(len=${v.length})`;
  if (v && typeof v === 'object') return `object(keys=${Object.keys(v).join('|')})`;
  return JSON.stringify(v);
}

// Diagnostic-only: walks `a`/`b` down to the first `limit` leaves where
// they actually differ, reporting each one's *path* and *shape* (type +
// length/key-list) rather than its content — this exists specifically so
// a 'same-timestamp-diverged-content' outcome can be logged usefully
// (Phase 10) without a verbose sync trace ever dumping a photo's raw
// base64 into the console. Never used for the merge decision itself,
// only to explain one after the fact.
export function describeDivergence(a, b, path = '', limit = 8, out = []) {
  if (out.length >= limit || deepEqual(a, b)) return out;
  const bothArrays = Array.isArray(a) && Array.isArray(b);
  const bothObjects = a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b);
  if (bothArrays && a.length === b.length) {
    for (let i = 0; i < a.length && out.length < limit; i++) describeDivergence(a[i], b[i], `${path}[${i}]`, limit, out);
    return out;
  }
  if (bothObjects) {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (out.length >= limit) break;
      describeDivergence(a[k], b[k], path ? `${path}.${k}` : k, limit, out);
    }
    return out;
  }
  out.push(`${path || '(root)'}: local=${describeLeaf(a)} remote=${describeLeaf(b)}`);
  return out;
}

// A bundle is validated at the envelope level (parseBackupBundle checks
// format/version and that the four lists are arrays) but not per record —
// a hand-edited or half-written file can still carry entries that aren't
// usable as records at all. One with no id is the dangerous shape: every
// such entry collides on `undefined` in the by-id map, so a batch of them
// would overwrite each other and land in storage under a key nothing can
// address again. Skip them here rather than downstream, where a missing
// `name` also throws in disambiguateByName()'s own grouping.
function isUsableRecord(record) {
  return !!record && typeof record === 'object'
    && typeof record.id === 'string' && record.id !== ''
    && typeof record.name === 'string';
}

// Per-record resolution: given the local record with the same id (or
// undefined if this device has never seen it) and the incoming remote
// record, decide what to do. See the plan's own pseudocode and per-branch
// notes for why each of these exists.
export function resolveRecord(local, remote) {
  if (!local) {
    if (remote.deletedAt) return { action: 'store-tombstone', record: remote };
    return { action: 'import', record: remote };
  }

  // Revision decides outright the moment the two differ — a higher
  // revision proves a causal chain of real writes leads from the lower
  // one to the higher one, regardless of what either side's clock says.
  // Only when revisions tie (the common case for every record that
  // predates this field, since both then default to 0, and the case for
  // two genuinely concurrent edits made offline) does this fall through
  // to the timestamp comparison — unchanged from before revisions existed,
  // deliberately: a real, same-instant divergence still surfaces for
  // review rather than being resolved by an arbitrary tiebreak. See
  // compareRevisions's own comment for why this order is safe to trust.
  const revCmp = compareRevisions(remote, local);
  const cmp = revCmp !== 'same' ? revCmp : compareTimestamps(lastChanged(remote), lastChanged(local));

  if (cmp === 'unknown') return { action: 'skip-review', reason: 'unresolvable-timestamp' };
  if (cmp === 'older') return { action: 'skip', reason: 'local-is-newer' };
  if (cmp === 'same') {
    if (equivalent(local, remote)) return { action: 'noop' };
    return { action: 'skip-review', reason: 'same-timestamp-diverged-content' };
  }
  // cmp === 'newer'
  if (remote.deletedAt) return { action: 'apply-tombstone', record: remote };
  return { action: 'overwrite', record: remote };
}

// Clock-anomaly detection — superseding an earlier design (a single
// "how far is the peer's exportedAt from my own now" check with a fixed
// tolerance) that turned out not to work at all for this app. That
// comparison cannot tell a wrong clock apart from a peer that simply
// hasn't synced in a while — both produce the identical number, since
// staleness and skew are indistinguishable from "exportedAt vs now"
// alone. And this app explicitly supports long dormancy — the tombstone
// retention window is sized in *months* on the stated grounds that "an
// occasional-use laptop can easily sit untouched for a season" — while
// Phase 8a/8b's manual sync makes even routine same-day latency common
// (export, then a person drags the file into the folder whenever they
// get to it). No fixed tolerance can sit between "an hour of manual
// latency, fine" and "three weeks of normal dormancy, also fine" while
// still catching a clock that's actually wrong — because a clock that's
// three weeks wrong looks *identical* to a device that just hasn't
// synced in three weeks.
//
// What actually distinguishes them is comparing a peer's bundle against
// *itself* or its own history, never against this device's own clock:
//
// - detectFutureExport: staleness can only ever push a timestamp further
//   into the reader's past — no dormancy, however long, makes a bundle's
//   exportedAt read as being from the future. Only a fast peer clock can.
//   Tight tolerance is fine here regardless of sync gap.
// - detectBackwardExport: a peer whose new bundle claims an earlier
//   exportedAt than the last one this device saw from that *same* peer
//   has had its clock reset, corrected backward, or manually changed —
//   again regardless of how long the gap between the two bundles was.
//
// Neither catches a clock that is consistently, staticly biased by a
// fixed amount and never corrects (e.g. permanently 2 hours ahead) —
// that failure mode produces monotonically increasing timestamps, so it
// looks healthy by both checks. But a static bias like that only flips a
// "newer wins" outcome when two edits land within the bias window of
// each other in real time; for edits days or weeks apart — the normal
// case for a mesh with long dormancy — it changes nothing. The case
// where it *would* matter (two near-simultaneous edits, ordered wrong by
// a small constant clock offset) is exactly what the revision counter
// below fixes without inspecting clocks at all.
const FUTURE_EXPORT_TOLERANCE_MS = 5 * 60 * 1000; // NTP/network jitter allowance, not sync latency
const BACKWARD_EXPORT_TOLERANCE_MS = 60 * 60 * 1000; // covers a DST fall-back

// Returns how far into the future `bundleExportedAt` reads relative to
// `now` (ms), or null if it's within tolerance or unparseable.
export function detectFutureExport(bundleExportedAt, { toleranceMs = FUTURE_EXPORT_TOLERANCE_MS, now = Date.now() } = {}) {
  const exportedAtMs = Date.parse(bundleExportedAt);
  if (!Number.isFinite(exportedAtMs)) return null;
  const aheadMs = exportedAtMs - now;
  return aheadMs > toleranceMs ? aheadMs : null;
}

// Returns how far `bundleExportedAt` falls behind `previousExportedAt`
// (ms), or null if it isn't behind (beyond tolerance) or either value is
// missing/unparseable. `previousExportedAt` is the last exportedAt this
// device recorded for this same peer (device-registry.js) — there being
// none yet (a peer seen for the first time) is not an anomaly.
export function detectBackwardExport(bundleExportedAt, previousExportedAt, { toleranceMs = BACKWARD_EXPORT_TOLERANCE_MS } = {}) {
  if (!previousExportedAt) return null;
  const currentMs = Date.parse(bundleExportedAt);
  const previousMs = Date.parse(previousExportedAt);
  if (!Number.isFinite(currentMs) || !Number.isFinite(previousMs)) return null;
  const backwardMs = previousMs - currentMs;
  return backwardMs > toleranceMs ? backwardMs : null;
}

// Runs resolveRecord over every item in remoteList against localList
// (matched by id), applies the resulting action through the caller's
// storage callbacks, and returns both a tally by action and the actual
// skip-review items (not just their count) — the review UI (Phase 6) has
// to show *which* record, from *which* peer, conflicts with *what*.
//
// `importRaw` and `tombstone` are deliberately two named callbacks even
// though a given library's own upsertRaw() is shape-agnostic and could
// serve both: keeping them distinct here is about the call site reading
// clearly (Phase 5 passes each library's importRaw/tombstone-write
// functions), not because the underlying storage write differs by
// action — see the plan's own note that both go through the same
// storage write path, the only difference being what content ends up on
// disk.
//
// Interrupted merges are safe to resume, by construction: every record is
// resolved and applied independently, with no transaction wrapping the
// batch, so a cycle that dies halfway just leaves a partially-merged
// dataset for the next cycle to continue converging.
export function mergeRecords(localList, remoteList, { importRaw, tombstone, recordType, peerLabel }) {
  const localById = new Map(localList.map((r) => [r.id, r]));
  const counts = { imported: 0, overwritten: 0, tombstoned: 0, skippedOlder: 0, skippedReview: 0, noop: 0, skippedInvalid: 0 };
  const reviewItems = [];
  // Every record this cycle reached a definite answer on — imported,
  // overwritten, tombstoned, or found to need nothing done. Callers use it
  // to retire any pending-review entry still standing against that record
  // (Phase 4: entries clear "when the record is later overwritten by an
  // unambiguously newer version from anywhere"), which a count alone
  // can't drive any more than it could drive the review UI itself.
  const resolvedIds = [];

  for (const remote of remoteList) {
    if (!isUsableRecord(remote)) {
      counts.skippedInvalid++;
      logSyncEvent('warn', 'merge:', recordType || 'record', '— skipping unusable record from', peerLabel || 'peer');
      continue;
    }
    const local = localById.get(remote.id);
    const result = resolveRecord(local, remote);
    // The verbose core of Phase 10's logging — every per-record decision,
    // not just the aggregate counts each caller already logs once per
    // library/peer. `recordType`/`peerLabel` are optional so tests and any
    // other caller of this generic algorithm can omit them freely; the log
    // line just falls back to 'record'/'peer' rather than requiring them.
    logSyncEvent('debug', 'merge:', recordType || 'record', remote.id, '—', result.action,
      result.reason ? `(${result.reason})` : '', 'from', peerLabel || 'peer');
    // Diagnostic-only, and only for the one outcome where "why" isn't
    // otherwise answerable from the tally alone: same revision, same
    // timestamp, yet the content doesn't match. Reports shape (path +
    // type/length), never content, so a photo's base64 never lands in the
    // console even with verbose logging on.
    if (result.reason === 'same-timestamp-diverged-content') {
      for (const line of describeDivergence(local, remote)) {
        logSyncEvent('debug', 'merge: divergence detail —', recordType || 'record', remote.id, ':', line);
      }
    }

    if (result.action === 'import') {
      importRaw(result.record);
      counts.imported++;
    } else if (result.action === 'overwrite') {
      importRaw(result.record);
      counts.overwritten++;
    } else if (result.action === 'store-tombstone' || result.action === 'apply-tombstone') {
      tombstone(result.record);
      counts.tombstoned++;
    } else if (result.action === 'skip') {
      counts.skippedOlder++;
    } else if (result.action === 'skip-review') {
      counts.skippedReview++;
      reviewItems.push({ reason: result.reason, local, remote });
    } else if (result.action === 'noop') {
      counts.noop++;
    }

    if (result.action !== 'skip-review') resolvedIds.push(remote.id);
  }

  return { counts, reviewItems, resolvedIds };
}
