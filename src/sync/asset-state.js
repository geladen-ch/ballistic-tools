// What this device knows about each photo asset in the sync folder,
// without ever opening one — see docs/plans/orphaned-storage-cleanup.md
// phases 2 and 5.
//
// The governing constraint is that plan's decision 10: no new *kind* of
// filesystem operation. Directory enumeration and whole-file reads are
// what the app already does on every platform it works with today; a
// metadata probe on an asset file is not, and whether `getFile()` on a
// cloud client's on-demand placeholder (OneDrive Files On-Demand, Dropbox
// Smart Sync, Drive File Stream, iCloud optimisation) triggers a full
// download is not knowable without testing each of them — and this app is
// advertised as working with any of them. So every question that would
// otherwise be answered by inspecting a file is answered from here
// instead:
//
//  - `writeIntentAt` — phase 2's crash journal. Set before a write
//    starts, cleared once it closes. A ref still carrying one is a write
//    this device did not finish, which is the *only* way a zero-byte or
//    truncated asset can come to exist locally.
//  - `badSeenAt` — phase 2's observed-bad mark, set when a reader finds
//    bytes that do not hash to the filename. Forces one rewrite.
//  - `firstSeenAt` — phase 5's age signal, replacing the file's own
//    `lastModified`. Also immune to a cloud client stamping mtime with
//    the download time.
//  - `bytes` — recorded from `blob.size` when this device writes the
//    asset, so a cleanup can report space freed without opening anything.
//    Unknown for an asset a peer wrote, which is accepted: the count is
//    always reportable, the size only sometimes.
import { openDatabase, getAll, put, deleteRecord } from '../db.js';
import { DB_NAME, DB_VERSION, STORES } from '../db-schema.js';

const STORE_NAME = 'asset-state';

// Same in-memory-mirror-plus-write-through shape as location-library.js
// and pending-review.js, for the same reason: writeAssetIfAbsent() needs
// a synchronous answer to "is there an intent pending for this ref", and
// it needs it on a path that runs once per photo per publish.
let mirror = new Map();
let dbPromise = null;
let readyPromise = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDatabase({ name: DB_NAME, version: DB_VERSION, stores: STORES });
  }
  return dbPromise;
}

// Must be awaited once at boot, alongside the other inits in app.js. On
// any failure (IndexedDB unavailable) the mirror stays empty and every
// query below answers "nothing known", which degrades to exactly the
// behaviour this module replaced: writeAssetIfAbsent trusts a file that is
// already present, and cleanup treats an unknown ref as first seen now and
// so too young to remove. Both err on the side of keeping data.
export function initAssetState() {
  if (!readyPromise) {
    readyPromise = (async () => {
      try {
        const db = await getDb();
        const stored = await getAll(db, STORE_NAME);
        mirror = new Map(stored.map((record) => [record.id, record]));
      } catch {
        mirror = new Map();
      }
    })();
  }
  return readyPromise;
}

export function getAssetState(ref) {
  return mirror.get(ref) || null;
}

export function listAssetState() {
  return [...mirror.values()];
}

async function write(record) {
  mirror.set(record.id, record);
  try {
    const db = await getDb();
    await put(db, STORE_NAME, record);
  } catch {
    // best-effort: the mirror is still correct for this session, and the
    // next boot falls back to "nothing known", which is the safe answer
  }
}

function merged(ref, fields) {
  return { id: ref, ...(mirror.get(ref) || {}), ...fields };
}

// Awaited on purpose, unlike most writes in this codebase, which are
// fire-and-forget onto a background chain. The whole point of the journal
// is that the intent is durable *before* the file it describes can exist;
// enqueueing it would reopen exactly the window it closes, since a crash
// between creating the file and flushing the intent would leave debris
// that nothing knows to repair.
export function markWriteIntent(ref) {
  return write(merged(ref, { writeIntentAt: new Date().toISOString() }));
}

export function hasWriteIntent(ref) {
  const record = mirror.get(ref);
  return !!(record && record.writeIntentAt);
}

// Clearing the intent and recording the size are one write: they always
// happen together, at the moment a write closes successfully.
export function clearWriteIntent(ref, { bytes } = {}) {
  const record = merged(ref, { writeIntentAt: null });
  if (bytes !== undefined) record.bytes = bytes;
  if (!record.firstSeenAt) record.firstSeenAt = new Date().toISOString();
  record.badSeenAt = null;
  return write(record);
}

// Set by a reader that found bytes not matching the filename's hash. The
// next publish of that photo, from any device that still holds it, rewrites
// the file instead of trusting that it is present.
export function markAssetBad(ref) {
  return write(merged(ref, { badSeenAt: new Date().toISOString() }));
}

export function isAssetBad(ref) {
  const record = mirror.get(ref);
  return !!(record && record.badSeenAt);
}

// Phase 5's age signal. Called once per ref per cleanup pass with whatever
// the directory listing showed; the first call for a ref starts its clock,
// and later calls leave it alone. A ref seen for the first time on this
// pass is therefore never eligible for removal on that same pass.
export function recordAssetsSeen(refs) {
  const now = new Date().toISOString();
  const fresh = [];
  for (const ref of refs) {
    if (mirror.get(ref)?.firstSeenAt) continue;
    fresh.push(write(merged(ref, { firstSeenAt: now })));
  }
  return Promise.all(fresh);
}

export function getFirstSeenAt(ref) {
  const record = mirror.get(ref);
  return (record && record.firstSeenAt) || null;
}

// Drops state for refs that no longer appear in the folder at all. This is
// what keeps the store bounded, and it is why an intent needs no
// time-based expiry: the record carrying it goes when its file does.
export async function pruneAssetState(refsPresent) {
  const present = new Set(refsPresent);
  const doomed = [...mirror.keys()].filter((ref) => !present.has(ref));
  if (doomed.length === 0) return 0;
  for (const ref of doomed) mirror.delete(ref);
  try {
    const db = await getDb();
    for (const ref of doomed) await deleteRecord(db, STORE_NAME, ref);
  } catch {
    // best-effort — the mirror is already pruned, so the next pass retries
  }
  return doomed.length;
}

// ---- test-only exports ----

export async function resetAssetStateForTests() {
  try {
    const db = await getDb();
    const stored = await getAll(db, STORE_NAME);
    await Promise.all(stored.map((record) => deleteRecord(db, STORE_NAME, record.id)));
  } catch {
    // no store yet / IndexedDB unavailable — nothing to wipe
  }
  mirror = new Map();
  readyPromise = null;
  await initAssetState();
}

export async function reloadAssetStateForTests() {
  mirror = new Map();
  readyPromise = null;
  await initAssetState();
}
