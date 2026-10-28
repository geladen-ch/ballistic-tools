// IndexedDB-backed CRUD for the user's own Arsenal reticles — same
// conventions as user-library.js's bullets, rifles and scopes
// (modifiedAt/revision/unsaved stamping, soft-delete tombstones, name
// lookup, opaque locally-unique ids), kept in IndexedDB rather than
// localStorage because a reticle can be large (see db-schema.js).
//
// Every exported function is synchronous, like location-library.js's:
// `mirror` is the source of truth for every read, writes update it at once
// and persist to IndexedDB in the background, and initReticleLibrary()
// must run once at boot (app.js) to fill it from what is stored.
//
// `mirror` holds every record as stored (reticle/reticle-record.js): the
// app's reads decode, its saves encode, and import, sync and the
// WithTombstones reader see the stored form. Decoding validates a whole
// reticle, so each stored record is decoded once and the result reused
// while it stays the same record; a decoded reticle is shared, never to
// be changed in place. A stored record that doesn't decode (damaged in
// transit, or from a later build) is still listed, flagged `damaged`,
// with no elements — so it can be seen and deleted, never silently lost.
import { openDatabase, getAll, put, deleteRecord } from './db.js';
import { DB_NAME, DB_VERSION, STORES } from './db-schema.js';
import { getDeviceId } from './sync/device-id.js';
import { notifyLibraryWrite } from './sync/write-hooks.js';
import { nextLocalRevision } from './sync/revision.js';
import { encodeReticleRecord, decodeReticleRecord } from './reticle/reticle-record.js';
import { defaultReferenceScope } from './reticle/scope.js';
import { DEFAULT_ILLUMINATION } from './reticle/model.js';
import { opticLabel } from './scope-record.js';

const STORE_NAME = 'reticles';
const RECORD_TYPE = 'reticle';

// See user-library.js's identical constant for why this errs long.
const TOMBSTONE_RETENTION_MS = 400 * 24 * 60 * 60 * 1000; // ~13 months

let mirror = [];
let dbPromise = null;
let readyPromise = null;
// One FIFO chain for every background write — see location-library.js.
let writeChain = Promise.resolve();
const decoded = new WeakMap();

function isLive(entry) {
  return !entry.deletedAt;
}

// stores: the FULL shared STORES list — see db-schema.js.
function getDb() {
  if (!dbPromise) dbPromise = openDatabase({ name: DB_NAME, version: DB_VERSION, stores: STORES });
  return dbPromise;
}

function enqueueWrite(taskFn) {
  writeChain = writeChain.then(taskFn, taskFn).catch(() => {});
  return writeChain;
}

function persist(entry) {
  return enqueueWrite(async () => {
    const db = await getDb();
    await put(db, STORE_NAME, entry);
  });
}

function removePersisted(id) {
  return enqueueWrite(async () => {
    const db = await getDb();
    await deleteRecord(db, STORE_NAME, id);
  });
}

function decode(stored) {
  if (decoded.has(stored)) return decoded.get(stored);
  let reticle;
  try {
    reticle = decodeReticleRecord(stored);
  } catch {
    const { referenceScope, illumination, elements, ...rest } = stored;
    reticle = {
      ...rest, name: opticLabel(stored), damaged: true,
      referenceScope: defaultReferenceScope(), illumination: { ...DEFAULT_ILLUMINATION }, elements: [], groups: [], nextId: 1
    };
  }
  decoded.set(stored, reticle);
  return reticle;
}

// See location-library.js's sweepTombstones().
function sweepTombstones() {
  const cutoff = Date.now() - TOMBSTONE_RETENTION_MS;
  const staleIds = mirror.filter((e) => e.deletedAt && Date.parse(e.deletedAt) <= cutoff).map((e) => e.id);
  if (staleIds.length === 0) return;
  const staleSet = new Set(staleIds);
  mirror = mirror.filter((e) => !staleSet.has(e.id));
  for (const id of staleIds) removePersisted(id);
}

// Must be awaited once before the functions below are relied on for real
// data (app.js's boot). Safe to call repeatedly. On any failure
// (IndexedDB unavailable) leaves the library empty rather than blocking
// boot.
export function initReticleLibrary() {
  if (!readyPromise) {
    readyPromise = (async () => {
      try {
        const db = await getDb();
        mirror = await getAll(db, STORE_NAME);
        sweepTombstones();
      } catch {
        mirror = [];
      }
    })();
  }
  return readyPromise;
}

function replaceInMirror(idx, stamped) {
  mirror = idx === -1 ? [...mirror, stamped] : mirror.map((e, i) => (i === idx ? stamped : e));
}

// See user-library.js's upsert() for why the stamping lives here.
function upsert(reticle) {
  const entry = encodeReticleRecord(reticle);
  const idx = mirror.findIndex((e) => e.id === entry.id);
  const previous = idx === -1 ? null : mirror[idx];
  const stamped = {
    ...entry, modifiedAt: new Date().toISOString(), modifiedBy: getDeviceId(),
    revision: nextLocalRevision(previous), unsaved: true
  };
  replaceInMirror(idx, stamped);
  persist(stamped);
  notifyLibraryWrite({ recordType: RECORD_TYPE, record: stamped, previous });
  return decode(stamped);
}

// Import and sync: the record exactly as given (its own modifiedAt,
// modifiedBy and revision) — see user-library.js's upsertRaw().
function upsertRaw(entry) {
  const stamped = { ...entry, unsaved: true };
  const idx = mirror.findIndex((e) => e.id === entry.id);
  const previous = idx === -1 ? null : mirror[idx];
  replaceInMirror(idx, stamped);
  persist(stamped);
  notifyLibraryWrite({ recordType: RECORD_TYPE, record: stamped, previous });
  return stamped;
}

// Live records only; loadUserReticlesWithTombstones() for deletions too.
export function loadUserReticles() {
  return mirror.filter(isLive).map(decode);
}

export function loadUserReticlesWithTombstones() {
  return mirror;
}

export function getUserReticle(id) {
  const stored = mirror.find((e) => e.id === id && isLive(e));
  return stored ? decode(stored) : null;
}

export function saveUserReticle(reticle) {
  return upsert(reticle);
}

export function importUserReticle(reticle) {
  return upsertRaw(reticle);
}

// Soft-delete, keeping an empty `elements` array so a tombstone keeps the
// shape of a reticle record — see user-library.js's tombstone().
export function deleteUserReticle(id) {
  const idx = mirror.findIndex((e) => e.id === id);
  if (idx === -1) return;
  const existing = mirror[idx];
  const tomb = {
    id,
    name: existing.name,
    deletedAt: new Date().toISOString(),
    deletedBy: getDeviceId(),
    revision: nextLocalRevision(existing),
    unsaved: true,
    elements: []
  };
  replaceInMirror(idx, tomb);
  persist(tomb);
  notifyLibraryWrite({ recordType: RECORD_TYPE, record: tomb, previous: existing });
}

// Case/whitespace-insensitive, tombstones excluded — see user-library.js's
// findByName. `name` is the manufacturer and model (opticLabel).
export function findUserReticleByName(name, { excludeId } = {}) {
  const normalized = name.trim().toLowerCase();
  const found = mirror.find((e) => e.id !== excludeId && isLive(e) && typeof e.name === 'string' && e.name.trim().toLowerCase() === normalized);
  return found ? decode(found) : null;
}

// The stored form of a reticle the app holds, for an export file — see
// user-library.js's storedFormOf().
export function storedUserReticleOf(reticle) {
  const stored = mirror.find((e) => e.id === reticle.id);
  const same = stored && stored.revision === reticle.revision && stored.modifiedAt === reticle.modifiedAt && stored.deletedAt === reticle.deletedAt;
  return same ? stored : encodeReticleRecord(reticle);
}

export function markUserReticlesSaved(ids) {
  const idSet = new Set(ids);
  mirror = mirror.map((e) => (idSet.has(e.id) ? { ...e, unsaved: false } : e));
  for (const entry of mirror) if (idSet.has(entry.id)) persist(entry);
}

// ---- test-only exports (see location-library.js's) ----

export async function resetReticleLibraryForTests() {
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
  await initReticleLibrary();
}

export async function reloadReticleLibraryForTests() {
  await writeChain;
  mirror = [];
  readyPromise = null;
  await initReticleLibrary();
}

export function flushReticleLibraryWritesForTests() {
  return writeChain;
}
