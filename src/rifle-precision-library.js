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

const STORE_NAME = 'rifle-precision-projects';

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

// data-URL string -> Blob, at the IndexedDB write boundary. See
// location-library.js's identical helper for why atob/btoa rather than
// fetch()/FileReader (both fail under node --test).
function dataUrlToBlob(dataUrl) {
  const commaIdx = dataUrl.indexOf(',');
  const mime = dataUrl.slice(5, commaIdx).split(';')[0] || 'application/octet-stream';
  const binary = atob(dataUrl.slice(commaIdx + 1));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

async function blobToDataUrl(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `data:${blob.type || 'application/octet-stream'};base64,${btoa(binary)}`;
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
      } catch {
        mirror = [];
      }
    })();
  }
  return readyPromise;
}

function upsert(project) {
  const stamped = { ...project, modifiedAt: new Date().toISOString(), unsaved: true };
  const idx = mirror.findIndex((p) => p.id === project.id);
  mirror = idx === -1 ? [...mirror, stamped] : mirror.map((p, i) => (i === idx ? stamped : p));
  persist(stamped);
  return stamped;
}

// Used only by import (see rifle-precision-export.js) — preserves the
// file's own modifiedAt/createdAt rather than restamping "now", same
// reasoning as location-library.js's own upsertRaw().
function upsertRaw(project) {
  const stamped = { ...project, unsaved: true };
  const idx = mirror.findIndex((p) => p.id === project.id);
  mirror = idx === -1 ? [...mirror, stamped] : mirror.map((p, i) => (i === idx ? stamped : p));
  persist(stamped);
  return stamped;
}

export function loadRiflePrecisionProjects() {
  return mirror;
}

export function saveRiflePrecisionProject(project) {
  return upsert(project);
}

export function importRiflePrecisionProject(project) {
  return upsertRaw(project);
}

export function deleteRiflePrecisionProject(id) {
  mirror = mirror.filter((p) => p.id !== id);
  removePersisted(id);
}

export function findRiflePrecisionProjectById(id) {
  return mirror.find((p) => p.id === id) || null;
}

// Case/whitespace-insensitive — same convention as location-library.js's
// own findUserLocationByName.
export function findRiflePrecisionProjectByName(name, { excludeId } = {}) {
  const normalized = name.trim().toLowerCase();
  return mirror.find((p) => p.id !== excludeId && p.name.trim().toLowerCase() === normalized);
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
