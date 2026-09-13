// IndexedDB-backed CRUD for the user's own "Locations & Targets" library
// (Range Solver) — same shape and conventions as user-library.js's Arsenal
// bullets/rifles (modifiedAt/unsaved stamping, name-collision lookup,
// opaque locally-unique ids), kept as its own module rather than folded
// into user-library.js since that file's own scope is explicitly "the
// user's Arsenal" and this is an unrelated feature that just happens to
// want the same conventions.
//
// A target has no record of its own here — it's a plain nested object in
// its parent location's `targets` array (see location-export.js's data
// model comment), so editing one just re-upserts the whole location, same
// as editing one of a rifle's cartridges today re-upserts the whole rifle
// in user-library.js.
//
// Every exported function below is synchronous, on purpose: this module's
// entire public API is called synchronously at ~20 sites across
// locations-view.js, location-placement-view.js, range-solver-view.js, and
// location-form.js — including inside two views' mount() bodies (called
// synchronously by router.js, which expects an immediate return, not a
// Promise) and a per-keystroke duplicate-name check. To back that with
// IndexedDB (inherently async) without touching any of those call sites,
// `mirror` below is the actual source of truth for every read; writes
// update it immediately and persist to IndexedDB in the background.
// initLocationLibrary() must run once, before any view mounts (see
// app.js), to populate `mirror` from whatever's already stored.
import { openDatabase, getAll, put, deleteRecord } from './db.js';
import { DB_NAME, DB_VERSION, STORES } from './db-schema.js';
import { getDeviceId } from './sync/device-id.js';
import { notifyLibraryWrite } from './sync/write-hooks.js';
import { dataUrlToBlob, blobToDataUrl } from './data-url.js';
import { nextLocalRevision } from './sync/revision.js';

const STORE_NAME = 'locations';

// See user-library.js's identical constant for why this errs long.
const TOMBSTONE_RETENTION_MS = 400 * 24 * 60 * 60 * 1000; // ~13 months

function isLive(entry) {
  return !entry.deletedAt;
}

let mirror = [];
let dbPromise = null;
let readyPromise = null;
// Serializes every background persist/delete into one FIFO chain, so two
// writes for the same location in quick succession can't land in the
// store out of order — `.catch(() => {})` keeps one failed write from
// breaking the chain for whatever's queued after it (best-effort, same
// posture as this module's own storage-full/disabled handling below).
let writeChain = Promise.resolve();

// stores: the FULL shared STORES list, not just this module's own store —
// see db-schema.js's comment on why every store must be declared together.
function getDb() {
  if (!dbPromise) {
    dbPromise = openDatabase({ name: DB_NAME, version: DB_VERSION, stores: STORES });
  }
  return dbPromise;
}

// Converts a mirror-shaped entry (photo as a data-URL string, or null)
// into what actually gets persisted (photo as a Blob) — this is the only
// place the Blob representation exists; everywhere else in the app,
// including every other function in this file, only ever sees the string.
async function toStorable(entry) {
  if (!entry.photo) return { ...entry, photo: null };
  try {
    return { ...entry, photo: dataUrlToBlob(entry.photo) };
  } catch {
    return { ...entry, photo: null }; // malformed data-URL — best-effort, don't block the rest of the save
  }
}

async function fromStorable(record) {
  if (!record.photo) return { ...record, photo: null };
  try {
    return { ...record, photo: await blobToDataUrl(record.photo) };
  } catch {
    return { ...record, photo: null };
  }
}

function enqueueWrite(taskFn) {
  writeChain = writeChain.then(taskFn, taskFn).catch(() => {});
  return writeChain;
}

function persist(entry) {
  return enqueueWrite(async () => {
    const db = await getDb();
    await put(db, STORE_NAME, await toStorable(entry));
  });
}

function removePersisted(id) {
  return enqueueWrite(async () => {
    const db = await getDb();
    await deleteRecord(db, STORE_NAME, id);
  });
}

// Prunes tombstones older than the retention window — run once per boot,
// from initLocationLibrary() below, right after mirror is populated. See
// docs/plans/backup-sync.md's "retention window is a correctness
// parameter": too short and a long-dormant device's still-live copy gets
// resurrected mesh-wide once every peer has already pruned the deletion.
function sweepTombstones() {
  const cutoff = Date.now() - TOMBSTONE_RETENTION_MS;
  const staleIds = mirror.filter((e) => e.deletedAt && Date.parse(e.deletedAt) <= cutoff).map((e) => e.id);
  if (staleIds.length === 0) return;
  const staleSet = new Set(staleIds);
  mirror = mirror.filter((e) => !staleSet.has(e.id));
  for (const id of staleIds) removePersisted(id);
}

// Must be awaited once, before any of the synchronous functions below are
// relied on for real data — see app.js's boot sequence. Safe to call
// multiple times (returns the same in-flight/settled promise). On any
// failure (IndexedDB unavailable — Safari private mode, disabled storage,
// etc.) leaves `mirror` empty rather than blocking app boot, same
// silent-degrade posture this module's old localStorage-backed load() had
// for corrupt/blocked storage.
export function initLocationLibrary() {
  if (!readyPromise) {
    readyPromise = (async () => {
      try {
        const db = await getDb();
        const stored = await getAll(db, STORE_NAME);
        mirror = await Promise.all(stored.map(fromStorable));
        sweepTombstones();
      } catch {
        mirror = [];
      }
    })();
  }
  return readyPromise;
}

// See user-library.js's own upsert() for why this stamping lives here
// rather than at each call site.
function upsert(entry) {
  const idx = mirror.findIndex((e) => e.id === entry.id);
  const previous = idx === -1 ? null : mirror[idx];
  const stamped = {
    ...entry, modifiedAt: new Date().toISOString(), modifiedBy: getDeviceId(),
    revision: nextLocalRevision(previous), unsaved: true
  };
  mirror = idx === -1 ? [...mirror, stamped] : mirror.map((e, i) => (i === idx ? stamped : e));
  persist(stamped);
  notifyLibraryWrite({ recordType: 'location', record: stamped, previous });
  return stamped;
}

// Used only by import (see location-export.js) — preserves the file's own
// modifiedAt (and modifiedBy) rather than restamping "now"/this device,
// same reasoning as user-library.js's own upsertRaw(). `revision` is
// preserved verbatim too, via the same spread, deliberately never bumped
// here — see user-library.js's own upsertRaw() for why.
function upsertRaw(entry) {
  const stamped = { ...entry, unsaved: true };
  const idx = mirror.findIndex((e) => e.id === entry.id);
  const previous = idx === -1 ? null : mirror[idx];
  mirror = idx === -1 ? [...mirror, stamped] : mirror.map((e, i) => (i === idx ? stamped : e));
  persist(stamped);
  notifyLibraryWrite({ recordType: 'location', record: stamped, previous });
  return stamped;
}

// Live records only — tombstones are filtered out here so every existing
// read site keeps its current meaning with no edit. Use
// loadUserLocationsWithTombstones() for the few callers that need
// deletions too (the sync bundle builder, the merge engine).
export function loadUserLocations() {
  return mirror.filter(isLive);
}

export function loadUserLocationsWithTombstones() {
  return mirror;
}

export function saveUserLocation(location) {
  return upsert(location);
}

export function importUserLocation(location) {
  return upsertRaw(location);
}

// Soft-delete: replaces the record with a tombstone — keeping an empty
// `targets` array so it stays the shape every existing location-reading
// call site expects — rather than removing it outright, so the deletion
// can propagate through sync (Phase 1 of docs/plans/backup-sync.md)
// instead of a stale remote copy silently resurrecting it on a future
// merge.
export function deleteUserLocation(id) {
  const idx = mirror.findIndex((e) => e.id === id);
  if (idx === -1) return; // already gone / never existed
  const existing = mirror[idx];
  const tomb = {
    id,
    name: existing.name,
    deletedAt: new Date().toISOString(),
    deletedBy: getDeviceId(),
    revision: nextLocalRevision(existing),
    unsaved: true,
    // `photo: null` is as load-bearing as `targets: []` above, and for a
    // subtler reason than the crash-avoidance one the plan gives for child
    // arrays: toStorable()/fromStorable() normalize an absent photo to
    // `photo: null` on the IndexedDB round-trip, so a tombstone written
    // without this key would silently grow one on the next reload. Two
    // devices either side of that reload then hold byte-identical
    // deletions that differ by one key, which merge.js's equivalent()
    // reads as "same timestamp, diverged content" — turning every deleted
    // location into a permanent, unresolvable review item.
    photo: null,
    targets: []
  };
  mirror = mirror.map((e, i) => (i === idx ? tomb : e));
  persist(tomb);
  notifyLibraryWrite({ recordType: 'location', record: tomb, previous: existing });
}

// Case/whitespace-insensitive — same convention as user-library.js's own
// findByName. Excludes tombstones: deleting something and recreating it
// under the same name must keep working. A plain scan over `mirror`, not
// an IndexedDB query — every read in this module goes through the
// in-memory mirror; IndexedDB itself is only ever touched by
// initLocationLibrary()'s one-time read and by
// persist()/removePersisted()'s background writes.
export function findUserLocationByName(name, { excludeId } = {}) {
  const normalized = name.trim().toLowerCase();
  return mirror.find((e) => e.id !== excludeId && isLive(e) && e.name.trim().toLowerCase() === normalized);
}

export function markUserLocationsSaved(ids) {
  const idSet = new Set(ids);
  mirror = mirror.map((e) => (idSet.has(e.id) ? { ...e, unsaved: false } : e));
  for (const entry of mirror) {
    if (idSet.has(entry.id)) persist(entry);
  }
}

// ---- test-only exports ----
// Naming follows the existing resetRangeSolverStateForTests() convention
// (range-solver-state.js). Three separate functions because "wipe the
// store for per-test isolation" and "reload the mirror to prove a write
// actually persisted" are opposite needs — one function can't do both.

// Full reset: deletes every record currently in the store (via db.js's
// own public getAll/deleteRecord, so it exercises the same code path a
// real IndexedDB would, not just the fake), then reinitializes from an
// empty store. Use in beforeEach for per-test isolation.
export async function resetLocationLibraryForTests() {
  // Flush first: a previous test's background persist()/removePersisted()
  // calls are fire-and-forget from that test's own perspective, so one can
  // still be in flight here. Without this, its write could land in the
  // store *after* the delete-loop below has already snapshotted it as
  // empty, resurrecting stale data into the next test.
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
  await initLocationLibrary();
}

// Reinitializes the mirror from whatever's currently in the store, without
// touching the store itself — use only in durability tests, to prove a
// write survived a simulated "restart" rather than just living in memory.
export async function reloadLocationLibraryForTests() {
  await writeChain; // don't reload ahead of a write still in flight
  mirror = [];
  readyPromise = null;
  await initLocationLibrary();
}

// Lets a test deterministically wait for in-flight background writes to
// settle before asserting durability, instead of an arbitrary timeout.
export function flushLocationLibraryWritesForTests() {
  return writeChain;
}

// Production-facing equivalent of the test helper above — lets a caller
// that just enqueued writes (see location-storage-migration.js) wait for
// them to actually land in IndexedDB before doing something that can't be
// undone if the write turns out to have failed, e.g. deleting the only
// other copy of that data.
export function waitForPendingWrites() {
  return writeChain;
}
