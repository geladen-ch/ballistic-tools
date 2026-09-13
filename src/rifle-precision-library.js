// IndexedDB-backed CRUD for the user's own Rifle Precision Calculator
// project library — same shape and conventions as location-library.js
// (in-memory mirror as the sole synchronous read source, write-through
// with a FIFO background persist chain, Blob<->data-URL boundary
// conversion for photos), kept as its own module in its own store rather
// than folded into location-library.js since the two features are
// unrelated beyond sharing the same underlying database (see
// db-schema.js).
//
// A target has no record of its own here — it's a plain nested object in
// its parent project's `targets` array, and each target's photo is the
// only Blob-worthy field; editing one target just re-upserts the whole
// project.
//
// Every exported function below is synchronous, on purpose — same
// reasoning as location-library.js: views' mount() bodies are called
// synchronously by router.js and need an immediate, non-Promise return.
// `mirror` is the actual source of truth for every read; writes update it
// immediately and persist to IndexedDB in the background.
// initRiflePrecisionLibrary() must run once, before any view mounts (see
// app.js), to populate `mirror` from whatever's already stored.
import { openDatabase, getAll, put, deleteRecord } from './db.js';
import { DB_NAME, DB_VERSION, STORES } from './db-schema.js';
import { getDeviceId } from './sync/device-id.js';
import { notifyLibraryWrite } from './sync/write-hooks.js';
import { dataUrlToBlob, blobToDataUrl } from './data-url.js';
import { nextLocalRevision } from './sync/revision.js';

const STORE_NAME = 'rifle-precision-projects';

// See user-library.js's identical constant for why this errs long.
const TOMBSTONE_RETENTION_MS = 400 * 24 * 60 * 60 * 1000; // ~13 months

function isLive(entry) {
  return !entry.deletedAt;
}

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

// Converts every target's photo (data-URL string, or null) to a Blob for
// persistence — the only place the Blob representation exists; everywhere
// else in the app, including every other function in this file, only ever
// sees the string.
async function toStorable(project) {
  const targets = await Promise.all(
    project.targets.map(async (target) => {
      if (!target.photo) return { ...target, photo: null };
      try {
        return { ...target, photo: dataUrlToBlob(target.photo) };
      } catch {
        return { ...target, photo: null }; // malformed data-URL — best-effort
      }
    })
  );
  return { ...project, targets };
}

async function fromStorable(record) {
  const targets = await Promise.all(
    record.targets.map(async (target) => {
      if (!target.photo) return { ...target, photo: null };
      try {
        return { ...target, photo: await blobToDataUrl(target.photo) };
      } catch {
        return { ...target, photo: null };
      }
    })
  );
  return { ...record, targets };
}

function enqueueWrite(taskFn) {
  writeChain = writeChain.then(taskFn, taskFn).catch(() => {});
  return writeChain;
}

function persist(project) {
  return enqueueWrite(async () => {
    const db = await getDb();
    await put(db, STORE_NAME, await toStorable(project));
  });
}

function removePersisted(id) {
  return enqueueWrite(async () => {
    const db = await getDb();
    await deleteRecord(db, STORE_NAME, id);
  });
}

// Prunes tombstones older than the retention window — see
// location-library.js's identical helper for the full rationale.
function sweepTombstones() {
  const cutoff = Date.now() - TOMBSTONE_RETENTION_MS;
  const staleIds = mirror.filter((p) => p.deletedAt && Date.parse(p.deletedAt) <= cutoff).map((p) => p.id);
  if (staleIds.length === 0) return;
  const staleSet = new Set(staleIds);
  mirror = mirror.filter((p) => !staleSet.has(p.id));
  for (const id of staleIds) removePersisted(id);
}

// Must be awaited once, before any of the synchronous functions below are
// relied on for real data — see app.js's boot sequence. Safe to call
// multiple times. On any failure (IndexedDB unavailable, etc.) leaves
// `mirror` empty rather than blocking app boot.
export function initRiflePrecisionLibrary() {
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

function upsert(project) {
  const idx = mirror.findIndex((p) => p.id === project.id);
  const previous = idx === -1 ? null : mirror[idx];
  const stamped = {
    ...project, modifiedAt: new Date().toISOString(), modifiedBy: getDeviceId(),
    revision: nextLocalRevision(previous), unsaved: true
  };
  mirror = idx === -1 ? [...mirror, stamped] : mirror.map((p, i) => (i === idx ? stamped : p));
  persist(stamped);
  notifyLibraryWrite({ recordType: 'rifle-precision-project', record: stamped, previous });
  return stamped;
}

// Used only by import (see rifle-precision-export.js) — preserves the
// file's own modifiedAt/createdAt (and modifiedBy) rather than restamping
// "now"/this device, same reasoning as location-library.js's own
// upsertRaw(). `revision` is preserved verbatim too, via the same spread,
// deliberately never bumped here — see user-library.js's own upsertRaw()
// for why.
function upsertRaw(project) {
  const stamped = { ...project, unsaved: true };
  const idx = mirror.findIndex((p) => p.id === project.id);
  const previous = idx === -1 ? null : mirror[idx];
  mirror = idx === -1 ? [...mirror, stamped] : mirror.map((p, i) => (i === idx ? stamped : p));
  persist(stamped);
  notifyLibraryWrite({ recordType: 'rifle-precision-project', record: stamped, previous });
  return stamped;
}

// Live records only — tombstones are filtered out here so every existing
// read site keeps its current meaning with no edit. Use
// loadRiflePrecisionProjectsWithTombstones() for the few callers that need
// deletions too (the sync bundle builder, the merge engine).
export function loadRiflePrecisionProjects() {
  return mirror.filter(isLive);
}

export function loadRiflePrecisionProjectsWithTombstones() {
  return mirror;
}

export function saveRiflePrecisionProject(project) {
  return upsert(project);
}

export function importRiflePrecisionProject(project) {
  return upsertRaw(project);
}

// Soft-delete: replaces the project with a tombstone — keeping an empty
// `targets` array so it stays the shape every existing project-reading
// call site expects (toStorable()/fromStorable() above both map over it
// unconditionally) — rather than removing it outright, so the deletion can
// propagate through sync (Phase 1 of docs/plans/backup-sync.md) instead of
// a stale remote copy silently resurrecting it on a future merge.
export function deleteRiflePrecisionProject(id) {
  const idx = mirror.findIndex((p) => p.id === id);
  if (idx === -1) return; // already gone / never existed
  const existing = mirror[idx];
  const tomb = {
    id,
    name: existing.name,
    deletedAt: new Date().toISOString(),
    deletedBy: getDeviceId(),
    revision: nextLocalRevision(existing),
    unsaved: true,
    targets: []
  };
  mirror = mirror.map((p, i) => (i === idx ? tomb : p));
  persist(tomb);
  notifyLibraryWrite({ recordType: 'rifle-precision-project', record: tomb, previous: existing });
}

// Live only — a deleted project should 404 like one that never existed,
// not resolve by id and then have its detail view crash on a missing
// field.
export function findRiflePrecisionProjectById(id) {
  return mirror.find((p) => p.id === id && isLive(p)) || null;
}

// Case/whitespace-insensitive — same convention as location-library.js's
// own findUserLocationByName. Excludes tombstones: deleting a project and
// recreating it under the same name must keep working.
export function findRiflePrecisionProjectByName(name, { excludeId } = {}) {
  const normalized = name.trim().toLowerCase();
  return mirror.find((p) => p.id !== excludeId && isLive(p) && p.name.trim().toLowerCase() === normalized);
}

export function markRiflePrecisionProjectsSaved(ids) {
  const idSet = new Set(ids);
  mirror = mirror.map((p) => (idSet.has(p.id) ? { ...p, unsaved: false } : p));
  for (const project of mirror) {
    if (idSet.has(project.id)) persist(project);
  }
}

// ---- test-only exports ----
// Same three-function split as location-library.js: full reset for
// per-test isolation vs. reload-without-wiping for durability tests vs.
// deterministically awaiting in-flight background writes.

export async function resetRiflePrecisionLibraryForTests() {
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
  await initRiflePrecisionLibrary();
}

export async function reloadRiflePrecisionLibraryForTests() {
  await writeChain;
  mirror = [];
  readyPromise = null;
  await initRiflePrecisionLibrary();
}

export function flushRiflePrecisionLibraryWritesForTests() {
  return writeChain;
}
