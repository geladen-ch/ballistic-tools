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

const DB_NAME = 'ballistics-tools';
const STORE_NAME = 'locations';
// Constant across releases, deliberately unlike service-worker.js's
// per-CACHE_VERSION cache-busting rename — that pattern is for an
// ephemeral asset cache; this is durable user data, versioned in place
// via IndexedDB's own onupgradeneeded mechanism (see db.js) if it ever
// needs to change.
const DB_VERSION = 1;

let mirror = [];
let dbPromise = null;
let readyPromise = null;
// Serializes every background persist/delete into one FIFO chain, so two
// writes for the same location in quick succession can't land in the
// store out of order — `.catch(() => {})` keeps one failed write from
// breaking the chain for whatever's queued after it (best-effort, same
// posture as this module's own storage-full/disabled handling below).
let writeChain = Promise.resolve();

function getDb() {
  if (!dbPromise) {
    dbPromise = openDatabase({ name: DB_NAME, version: DB_VERSION, stores: [{ name: STORE_NAME, keyPath: 'id' }] });
  }
  return dbPromise;
}

// data-URL string -> Blob, at the IndexedDB write boundary. Deliberately
// not `fetch(dataUrl).then(r => r.blob())` (fails under node --test: the
// test suite's fetch stub only serves file:// URLs) — atob/btoa are real
// globals in both Node 18+ and every browser, so this one implementation
// works identically in prod and tests.
function dataUrlToBlob(dataUrl) {
  const commaIdx = dataUrl.indexOf(',');
  const mime = dataUrl.slice(5, commaIdx).split(';')[0] || 'application/octet-stream';
  const binary = atob(dataUrl.slice(commaIdx + 1));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

// Blob -> data-URL string, on the one-time boot read. Not FileReader
// (isn't a Node global) for the same reason as above.
async function blobToDataUrl(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `data:${blob.type || 'application/octet-stream'};base64,${btoa(binary)}`;
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
  const stamped = { ...entry, modifiedAt: new Date().toISOString(), unsaved: true };
  const idx = mirror.findIndex((e) => e.id === entry.id);
  mirror = idx === -1 ? [...mirror, stamped] : mirror.map((e, i) => (i === idx ? stamped : e));
  persist(stamped);
  return stamped;
}

// Used only by import (see location-export.js) — preserves the file's own
// modifiedAt rather than restamping "now", same reasoning as
// user-library.js's own upsertRaw().
function upsertRaw(entry) {
  const stamped = { ...entry, unsaved: true };
  const idx = mirror.findIndex((e) => e.id === entry.id);
  mirror = idx === -1 ? [...mirror, stamped] : mirror.map((e, i) => (i === idx ? stamped : e));
  persist(stamped);
  return stamped;
}

export function loadUserLocations() {
  return mirror;
}

export function saveUserLocation(location) {
  return upsert(location);
}

export function importUserLocation(location) {
  return upsertRaw(location);
}

export function deleteUserLocation(id) {
  mirror = mirror.filter((e) => e.id !== id);
  removePersisted(id);
}

// Case/whitespace-insensitive — same convention as user-library.js's own
// findByName. A plain scan over `mirror`, not an IndexedDB query — every
// read in this module goes through the in-memory mirror; IndexedDB itself
// is only ever touched by initLocationLibrary()'s one-time read and by
// persist()/removePersisted()'s background writes.
export function findUserLocationByName(name, { excludeId } = {}) {
  const normalized = name.trim().toLowerCase();
  return mirror.find((e) => e.id !== excludeId && e.name.trim().toLowerCase() === normalized);
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
