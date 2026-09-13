// Thin wrapper around the File System Access API for the shared sync
// folder — see docs/plans/backup-sync.md Phase 3. This surface
// (`showDirectoryPicker`) only exists in Chromium (desktop Chrome/Edge,
// Android Chrome); callers must feature-detect via
// isFileSystemAccessSupported() before touching anything else here, and
// fall back to Phase 8a/8b's plain-file flows where it's false.
import { openDatabase, getAll, put, deleteRecord } from '../db.js';
import { DB_NAME, DB_VERSION, STORES } from '../db-schema.js';
import { logSyncEvent } from './sync-log.js';

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

const ASSETS_DIR_NAME = 'assets';

function getAssetsDirHandle(dirHandle, { create = false } = {}) {
  return dirHandle.getDirectoryHandle(ASSETS_DIR_NAME, { create });
}

// Content-addressed, write-once (Phase 7's photo-splitting) — writes
// `assets/<filename>` only if it doesn't already exist. A filename derived
// from a content hash is guaranteed to name identical bytes every time, so
// finding it already present is a legitimate reason to skip the write
// entirely, not a conflict to resolve.
export async function writeAssetIfAbsent(dirHandle, filename, blob) {
  const assetsDir = await getAssetsDirHandle(dirHandle, { create: true });
  try {
    await assetsDir.getFileHandle(filename);
    logSyncEvent('debug', 'writeAssetIfAbsent:', filename, 'already present, skipping write');
    return; // already present
  } catch {
    // doesn't exist yet — fall through and write it
  }
  const fileHandle = await assetsDir.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(blob);
  await writable.close();
  logSyncEvent('debug', 'writeAssetIfAbsent:', filename, 'written');
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
