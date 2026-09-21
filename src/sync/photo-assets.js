// Phase 7's photo-splitting scheme — see docs/plans/backup-sync.md.
// Replaces an inline data-URL `photo` with a content-hash `photoRef:
// "sha256-<hex>"` plus a write-once `assets/<ref>.jpg` file in the synced
// folder, so an unchanged photo isn't re-embedded (and re-uploaded through
// the cloud sync client) on every cycle.
//
// Writing a referenced bundle (applyReferencedPhotoStorage) only ever
// happens where there's real folder *write* access — auto-sync.js's
// Chromium path — so that half stays tied to a File System Access
// dirHandle. Resolving one back (resolveBundlePhotoRefs) is more general:
// Phase 8a's directory-picker flow can *read* an assets/ subfolder too
// (via a plain `<input type="file" webkitdirectory>`, no dirHandle
// involved at all), so that half takes an abstract `readAsset(filename)`
// function instead of assuming any particular browser API — auto-sync.js
// supplies one backed by fs-folder.js's real dirHandle,
// manual-sync.js's directory-picker flow supplies one backed by a plain
// FileList lookup, and its plain multi-file (non-directory) flow supplies
// none at all.
import { dataUrlToBlob, blobToDataUrl } from '../data-url.js';
import { writeAssetIfAbsent } from './fs-folder.js';
import { markAssetBad } from './asset-state.js';
import { logSyncEvent } from './sync-log.js';
import { logDiagnostic } from '../debug-log.js';

// Every asset file is written under this fixed extension regardless of
// the photo's actual format — location-photo.js's renderPhoto() usually
// produces a JPEG (canvas.toDataURL('image/jpeg', ...)), but returns an
// unedited upload's original bytes verbatim whenever no rotation/crop/
// downscale is actually needed, so an untouched PNG (or anything else the
// user picked) can end up here too. That's fine for the bytes themselves
// — content-addressed by hash, format-agnostic — but it means this
// extension must never be trusted as a claim about what's actually
// inside; see `photoMime` below, which is the field that carries the
// real answer through the bundle instead.
const ASSET_EXTENSION = 'jpg';

// Exported so callers can build a `readAsset(filename)` function that
// knows what filename to look for — fs-folder.js's dirHandle-backed one
// (auto-sync.js) and manual-sync.js's FileList-backed one (Phase 8a's
// directory picker) both need this same mapping from a bare photoRef to
// the actual asset filename on disk.
export function assetFileName(photoRef) {
  return `${photoRef}.${ASSET_EXTENSION}`;
}

async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// The one place a data-URL becomes a photoRef. Exported so asset-cleanup.js
// can compute the ref of a photo this device holds locally and recognise
// the asset file that photo would be written to — if the two ever computed
// it differently, cleanup would mistake live photos for orphans and delete
// them, so there is deliberately only one implementation.
export async function photoRefFor(dataUrl) {
  const bytes = new Uint8Array(await dataUrlToBlob(dataUrl).arrayBuffer());
  return `sha256-${await sha256Hex(bytes)}`;
}

// Converts one photo data-URL to a { photoRef, photoMime } pair, writing
// assets/<ref>.jpg if not already present. `photoMime` is the photo's
// *actual* MIME type (from dataUrlToBlob()'s own extraction, i.e.
// whatever the original data-URL genuinely declared) — it travels
// alongside photoRef specifically so the reading side never has to trust
// the asset file's own inferred type (see ASSET_EXTENSION's comment on
// why that can be wrong). Returns null (never throws) if the write itself
// fails — permission revoked mid-cycle, disk full, whatever — so the
// caller can fall back to keeping that one record's photo inline rather
// than silently losing it.
async function refFor(dirHandle, dataUrl) {
  const blob = dataUrlToBlob(dataUrl);
  const photoRef = await photoRefFor(dataUrl);
  try {
    await writeAssetIfAbsent(dirHandle, assetFileName(photoRef), blob);
    return { photoRef, photoMime: blob.type || 'application/octet-stream' };
  } catch (err) {
    logSyncEvent('warn', 'sync: failed to write photo asset, keeping this record inline —', err && err.message);
    logDiagnostic('warn', '[sync] failed to write photo asset, keeping this record inline —', err && err.message);
    return null;
  }
}

// Mutates `bundle` in place: every location/target photo becomes a
// photoRef (+ photoMime) backed by a written asset file, and
// bundle.photoStorage is set to 'referenced'. Call only when this
// device's own iPhone-sync-support toggle is off (photo-storage-prefs.js)
// — the caller (auto-sync.js) decides that, this function just does the
// conversion.
export async function applyReferencedPhotoStorage(bundle, dirHandle) {
  bundle.photoStorage = 'referenced';
  logSyncEvent('debug', 'sync: publishing with referenced photo storage');

  for (const location of bundle.locations.locations) {
    if (!location.photo) continue;
    const result = await refFor(dirHandle, location.photo);
    if (result) {
      delete location.photo;
      location.photoRef = result.photoRef;
      location.photoMime = result.photoMime;
    }
  }

  for (const project of bundle.riflePrecision.projects) {
    for (const target of project.targets) {
      if (!target.photo) continue;
      const result = await refFor(dirHandle, target.photo);
      if (result) {
        delete target.photo;
        target.photoRef = result.photoRef;
        target.photoMime = result.photoMime;
      }
    }
  }
}

// `holder.photoMime`, when present, is the photo's true original MIME
// type (see refFor's own comment) — used to override whatever
// `blobToDataUrl` would otherwise fall back to (the asset File's own
// `.type`, which the browser infers from the '.jpg' extension and so
// cannot be trusted for anything that wasn't genuinely JPEG). A bundle
// written before this field existed simply has no photoMime, and
// blobToDataUrl falls back to the file's own (usually-correct, since most
// photos really are JPEG) inferred type — backward compatible by
// construction, same posture as every other optional field in this plan.
async function resolveOne(readAsset, holder) {
  if (!holder.photoRef) return true; // nothing to resolve, already fine (inline or no photo)
  if (!readAsset) return false; // no asset access at all — never resolvable
  try {
    const file = await readAsset(assetFileName(holder.photoRef));
    if (!file) return false;
    // Verify the bytes actually hash to the ref that named them before
    // trusting them (docs/plans/orphaned-storage-cleanup.md phase 2).
    // This costs one digest over data already in memory — the file has to
    // be read in full anyway to build the data URL — and it is the
    // strongest integrity check content-addressed storage permits,
    // catching a truncated or corrupted file as readily as an empty one.
    // Marking the ref bad is what gets it repaired: the next publish from
    // any device still holding that photo rewrites the file rather than
    // trusting that it is present.
    const bytes = new Uint8Array(await file.arrayBuffer());
    const actual = `sha256-${await sha256Hex(bytes)}`;
    if (actual !== holder.photoRef) {
      logSyncEvent('warn', 'photo asset failed verification:', holder.photoRef, '— content does not match its name');
      logDiagnostic('warn', '[sync] photo asset failed verification:', holder.photoRef);
      markAssetBad(holder.photoRef);
      return false;
    }
    holder.photo = await blobToDataUrl(new Blob([bytes], { type: file.type }), { mimeOverride: holder.photoMime });
    delete holder.photoRef;
    delete holder.photoMime;
    return true;
  } catch {
    return false; // routine — the asset likely hasn't finished syncing yet, or isn't reachable this way
  }
}

// Resolves every photoRef in a just-parsed bundle back to a real photo —
// a no-op when bundle.photoStorage isn't 'referenced', which covers every
// bundle from before this feature existed (no photoStorage field at all)
// as well as one written with the iPhone-sync-support toggle on.
//
// Two distinct failure postures for two distinct callers:
//
// - `onUnresolvable: 'skip'` (auto-sync.js's runSyncCycle, Phase 5 — the
//   one *repeating, persisted* context): a record whose photo can't be
//   resolved yet is dropped from *this cycle's* remote list entirely, not
//   merged in with a null photo. The asset almost certainly just hasn't
//   finished syncing through the cloud client, and the next cycle will
//   see the same bundle and retry. Merging a temporary null in now would
//   both lose the photo locally and set up a false
//   "same-timestamp-diverged-content" conflict the moment the asset does
//   show up later against a record whose modifiedAt never changed.
// - `onUnresolvable: 'null'` (manual-sync.js's one-off imports, Phase
//   8a/8b — including 8a's directory-picker flow, which *can* resolve
//   some photos but is still a one-shot action with no persisted state to
//   retry from): best-effort applies — the record still imports, just
//   without its photo, exactly like any other field an importing device
//   can't resolve (see docs/plans/backup-sync.md Phase 7's "Conflict with
//   iOS manual sync").
//
// `readAsset` is null for contexts with no asset access at all (Phase 8b
// always; Phase 8a's plain multi-file picker) — every referenced photo is
// necessarily unresolvable there.
//
// Returns `{ anySkipped }` — true only under `onUnresolvable: 'skip'` when
// at least one record was left out of the bundle this way. The caller
// (auto-sync.js) surfaces this as a "still syncing" notice in Settings;
// `onUnresolvable: 'null'` never sets it, since that path already imports
// every record immediately (the missing photo is self-evident once the
// user sees the item, not something worth a separate warning for).
export async function resolveBundlePhotoRefs(bundle, { readAsset = null, onUnresolvable = 'skip' } = {}) {
  if (bundle.photoStorage !== 'referenced') return { anySkipped: false };

  let anySkipped = false;

  const liveLocations = [];
  for (const location of bundle.locations.locations) {
    const ok = await resolveOne(readAsset, location);
    if (ok) {
      liveLocations.push(location);
    } else if (onUnresolvable === 'null') {
      delete location.photoRef;
      delete location.photoMime;
      location.photo = null;
      liveLocations.push(location);
    } else {
      anySkipped = true;
      logSyncEvent('debug', 'sync: could not resolve photo for location', location.id, '— retrying next cycle');
    }
  }
  bundle.locations.locations = liveLocations;

  const liveProjects = [];
  for (const project of bundle.riflePrecision.projects) {
    let allOk = true;
    for (const target of project.targets) {
      const ok = await resolveOne(readAsset, target);
      if (!ok) {
        allOk = false;
        if (onUnresolvable === 'null') {
          delete target.photoRef;
          delete target.photoMime;
          target.photo = null;
        }
      }
    }
    // A project is one merge unit (Phase 1 — no per-child granularity), so
    // a partially-resolved project can't be meaningfully applied under
    // 'skip': the whole project waits for next cycle instead.
    if (allOk || onUnresolvable === 'null') {
      liveProjects.push(project);
    } else {
      anySkipped = true;
      logSyncEvent('debug', 'sync: could not resolve every photo for project', project.id, '— retrying next cycle');
    }
  }
  bundle.riflePrecision.projects = liveProjects;

  return { anySkipped };
}
