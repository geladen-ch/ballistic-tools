// Thin wrapper around the File System Access API for the shared sync
// folder — see docs/plans/backup-sync.md Phase 3. This surface
// (`showDirectoryPicker`) only exists in Chromium (desktop Chrome/Edge,
// Android Chrome); callers must feature-detect via
// isFileSystemAccessSupported() before touching anything else here, and
// fall back to Phase 8a/8b's plain-file flows where it's false.
import { openDatabase, getAll, put, deleteRecord } from '../db.js';
import { DB_NAME, DB_VERSION, STORES } from '../db-schema.js';
import { logSyncEvent } from './sync-log.js';
import { markWriteIntent, clearWriteIntent, hasWriteIntent, isAssetBad } from './asset-state.js';

const STORE_NAME = 'sync-folder-handle';
// A single fixed key — this app persists exactly one sync folder per
// installation, not a list.
const HANDLE_KEY = 'sync-folder';

let dbPromise = null;
function getDb() {
  if (!dbPromise) {
    dbPromise = openDatabase({ name: DB_NAME, version: DB_VERSION, stores: STORES });
  }
  return dbPromise;
}

export function isFileSystemAccessSupported() {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

// Prompts the user to pick a folder (a user-gesture-only browser API) and
// persists the resulting handle — handles aren't structured-cloneable into
// localStorage but are IndexedDB-storable, which is why this has its own
// store rather than reusing one of the localStorage-backed sync keys.
export async function pickFolder() {
  const handle = await window.showDirectoryPicker({ id: 'ballistics-sync', mode: 'readwrite' });
  const db = await getDb();
  await put(db, STORE_NAME, { id: HANDLE_KEY, handle });
  logSyncEvent('debug', 'pickFolder: folder chosen —', handle.name || '(unnamed)');
  return handle;
}

export async function getPersistedFolderHandle() {
  const db = await getDb();
  const all = await getAll(db, STORE_NAME);
  const entry = all.find((e) => e.id === HANDLE_KEY);
  return entry ? entry.handle : null;
}

export async function forgetFolder() {
  const db = await getDb();
  await deleteRecord(db, STORE_NAME, HANDLE_KEY);
}

// queryPermission never prompts, so it's always safe to call from a
// background trigger (Phase 5's timer/focus listeners). requestPermission
// does prompt, so `allowPrompt` must only be true when this call is
// directly inside a user gesture (e.g. the "Sync Now" click handler) —
// calling it from a background tick would throw or silently no-op
// depending on the browser, per the File System Access API's own
// same-user-gesture requirement.
export async function verifyPermission(handle, { allowPrompt = false } = {}) {
  const opts = { mode: 'readwrite' };
  if ((await handle.queryPermission(opts)) === 'granted') {
    logSyncEvent('debug', 'verifyPermission: already granted');
    return true;
  }
  if (!allowPrompt) {
    logSyncEvent('debug', 'verifyPermission: not granted, not prompting (no user gesture)');
    return false;
  }
  const granted = (await handle.requestPermission(opts)) === 'granted';
  logSyncEvent('debug', 'verifyPermission: user', granted ? 'granted' : 'denied', 'the permission prompt');
  return granted;
}

const BACKUP_FILE_PATTERN = /^backup-.+\.json$/;

export async function listBackupFiles(dirHandle) {
  const names = [];
  for await (const [name, entryHandle] of dirHandle.entries()) {
    if (entryHandle.kind === 'file' && BACKUP_FILE_PATTERN.test(name)) names.push(name);
  }
  logSyncEvent('debug', 'listBackupFiles: found', names.length, 'backup file(s)');
  return names;
}

export async function readFile(dirHandle, name) {
  const fileHandle = await dirHandle.getFileHandle(name);
  const file = await fileHandle.getFile();
  const text = await file.text();
  logSyncEvent('debug', 'readFile:', name, `(${text.length} bytes)`);
  return text;
}

// Removes a backup file by its exact name — for the copies of a device's
// bundle that a browser saved under a different name (see
// duplicate-bundles.js). Refuses anything that is not a `backup-*.json`, so
// a name that came from a bundle or a listing can never be turned into a
// deletion of something else. NotFoundError counts as success, as above.
export async function removeBackupFile(dirHandle, fileName) {
  if (!BACKUP_FILE_PATTERN.test(fileName)) throw new Error(`refusing to remove a file that is not a backup: ${fileName}`);
  try {
    await dirHandle.removeEntry(fileName);
    logSyncEvent('debug', 'removeBackupFile: removed', fileName);
    return true;
  } catch (err) {
    if (err && (err.name === 'NotFoundError' || /not found/i.test(err.message || ''))) return true;
    throw err;
  }
}

const ASSETS_DIR_NAME = 'assets';

// The inverse of photo-assets.js's assetFileName(): every asset is named
// `<photoRef>.<ext>`, so the ref is the name with its extension removed.
// Kept here rather than imported to avoid a cycle — photo-assets.js
// already imports this module.
function refFromAssetFileName(filename) {
  const dot = filename.lastIndexOf('.');
  return dot === -1 ? filename : filename.slice(0, dot);
}

function getAssetsDirHandle(dirHandle, { create = false } = {}) {
  return dirHandle.getDirectoryHandle(ASSETS_DIR_NAME, { create });
}

// Content-addressed, write-once, **plus repair of a write this device did
// not finish** (Phase 7's photo-splitting, extended by docs/plans/
// orphaned-storage-cleanup.md phase 2). A filename derived from a content
// hash names identical bytes every time, so finding it already present is
// normally a legitimate reason to skip the write entirely.
//
// The exception is the crash window this function used to leave open:
// `getFileHandle(create: true)` brings the file into existence before
// `close()` puts any bytes in it, so a process killed in between leaves a
// zero-byte file at the real name — and every later cycle then saw it as
// "already present" and skipped it, publishing a bundle that referenced
// permanently broken bytes.
//
// It is closed with a journal rather than by inspecting the file, because
// inspecting it would mean `getFile()` on every photo on every publish,
// and whether that hydrates a cloud client's on-demand placeholder cannot
// be established across every platform this app claims to support (see
// asset-state.js). A journal needs no such knowledge, and is *more*
// precise besides: it catches a truncated write as readily as an empty
// one, without needing size to be observable at all.
export async function writeAssetIfAbsent(dirHandle, filename, blob) {
  const assetsDir = await getAssetsDirHandle(dirHandle, { create: true });
  const ref = refFromAssetFileName(filename);
  let present = false;
  try {
    await assetsDir.getFileHandle(filename);
    present = true;
  } catch {
    // doesn't exist yet — fall through and write it
  }

  if (present) {
    // An intent still pending for this ref means the last attempt to write
    // it never closed; a bad mark means a reader found bytes that didn't
    // hash to this name. Either way the file on disk cannot be trusted,
    // and we hold the correct bytes right here.
    const pendingIntent = hasWriteIntent(ref);
    const knownBad = isAssetBad(ref);
    if (!pendingIntent && !knownBad) {
      logSyncEvent('debug', 'writeAssetIfAbsent:', filename, 'already present, skipping write');
      return;
    }
    logSyncEvent('info', 'writeAssetIfAbsent: repairing', filename,
      pendingIntent ? '(an earlier write never completed)' : '(a reader reported bad content)');
  }

  // Durable before the file can exist, deliberately awaited rather than
  // queued: a crash between creating the file and recording the intent
  // would leave debris nothing knows to repair, which is the exact hole
  // this closes.
  await markWriteIntent(ref);
  const fileHandle = await assetsDir.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(blob);
  await writable.close();
  await clearWriteIntent(ref, { bytes: blob.size });
  logSyncEvent('debug', 'writeAssetIfAbsent:', filename, 'written');
}

// Every asset file in the folder, by name. Directory enumeration lists a
// cloud client's on-demand placeholders exactly like any other entry,
// without touching their contents — which is why cleanup can be built on
// it while it may not open the files themselves (see asset-state.js).
// A folder that has only ever seen inline-mode publishes has no assets/
// at all; that is "nothing to do", not an error, and `create` is
// deliberately not passed, since a cleanup pass must not bring a
// directory into being as a side effect.
export async function listAssetFiles(dirHandle) {
  let assetsDir;
  try {
    assetsDir = await getAssetsDirHandle(dirHandle);
  } catch {
    return [];
  }
  const names = [];
  for await (const [name, entryHandle] of assetsDir.entries()) {
    if (entryHandle.kind === 'file') names.push(name);
  }
  logSyncEvent('debug', 'listAssetFiles: found', names.length, 'asset file(s)');
  return names;
}

// Removes one asset file. A file that is already gone counts as success:
// that is what makes two devices cleaning the same folder at the same time
// harmless, and removeEntry() throws NotFoundError rather than no-opping.
export async function removeAsset(dirHandle, filename) {
  try {
    const assetsDir = await getAssetsDirHandle(dirHandle);
    await assetsDir.removeEntry(filename);
    return true;
  } catch (err) {
    if (err && (err.name === 'NotFoundError' || /not found/i.test(err.message || ''))) return true;
    throw err;
  }
}

// Returns the asset as a File (itself a Blob) — throws if the assets
// folder or the file itself doesn't exist, which callers (photo-assets.js)
// treat as "not resolvable yet", not a hard error: a cloud sync client can
// easily deliver the bundle's own JSON before a larger photo asset file
// has finished syncing.
export async function readAssetFile(dirHandle, filename) {
  const assetsDir = await getAssetsDirHandle(dirHandle);
  const fileHandle = await assetsDir.getFileHandle(filename);
  logSyncEvent('debug', 'readAssetFile:', filename, 'resolved');
  return fileHandle.getFile();
}

// `createWritable()` stages into a swap file and commits atomically on
// close() — see docs/plans/backup-sync.md Phase 5's note on why there's
// deliberately no pagehide-triggered "best effort" write: an aborted write
// here is understood to leave the previous file intact, not a truncated
// one, but that's exactly the kind of guarantee worth re-verifying against
// the spec/browser behavior before leaning on it further, which is why
// Phase 5 avoids ever relying on an interrupted call to this function.
export async function writeOwnBackupFile(dirHandle, deviceId, text) {
  const fileHandle = await dirHandle.getFileHandle(`backup-${deviceId}.json`, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(text);
  await writable.close();
  logSyncEvent('debug', 'writeOwnBackupFile: wrote', `backup-${deviceId}.json`, `(${text.length} bytes)`);
}
