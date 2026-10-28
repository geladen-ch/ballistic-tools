// localStorage-backed CRUD for the user's own "Arsenal" — bullets,
// rifles and scopes the user enters themselves, stored in the exact same shape as a
// built-in library entry (see src/bullets/*.json, src/rifles/*.json) so
// every place that already knows how to render/consume a built-in entry
// works unchanged for a user one too. Unlike the built-in catalogs (fetched
// once and cached in-memory), these are re-read from storage on every call
// — there's no staleness risk to guard against, and the data is tiny, so
// simplicity wins over caching.
import { getDeviceId } from './sync/device-id.js';
import { notifyLibraryWrite } from './sync/write-hooks.js';
import { nextLocalRevision } from './sync/revision.js';
import { decodeRifle, encodeRifle } from './record-codec.js';
import { decodeScope, encodeScope } from './scope-record.js';

const BULLETS_KEY = 'ballistics_user_bullets_v1';
const RIFLES_KEY = 'ballistics_user_rifles_v1';
const SCOPES_KEY = 'ballistics_user_scopes_v1';

const RECORD_TYPE_BY_KEY = { [BULLETS_KEY]: 'bullet', [RIFLES_KEY]: 'rifle', [SCOPES_KEY]: 'scope' };

// Records are kept exactly as stored (see record-codec.js): what the app
// reads is decoded into SI, what it saves is encoded back, and what sync
// and import write, and what the WithTombstones readers hand to sync, is
// the stored form, untouched.
const identity = (r) => r;
const CODEC_BY_KEY = {
  [BULLETS_KEY]: { decode: identity, encode: identity },
  [RIFLES_KEY]: { decode: decodeRifle, encode: encodeRifle },
  [SCOPES_KEY]: { decode: decodeScope, encode: encodeScope }
};

// A tombstone's deletedAt must outlive the longest plausible dormancy of an
// unsynced secondary device — err long, a stale-but-live copy
// resurrecting everywhere is worse than a trash bin that grows a little.
const TOMBSTONE_RETENTION_MS = 400 * 24 * 60 * 60 * 1000; // ~13 months

function isLive(entry) {
  return !entry.deletedAt;
}

let sweptThisSession = false;

// Prunes tombstones older than the retention window. Runs lazily, once per
// page load, on first read — this module has no init()/boot hook the way
// location-library.js/rifle-precision-library.js do (it's synchronous
// localStorage, not IndexedDB), so "at library init time" here means "the
// first time anything reads from it".
function sweepTombstonesOnce() {
  if (sweptThisSession) return;
  sweptThisSession = true;
  const cutoff = Date.now() - TOMBSTONE_RETENTION_MS;
  for (const key of [BULLETS_KEY, RIFLES_KEY, SCOPES_KEY]) {
    const list = load(key);
    const pruned = list.filter((e) => !e.deletedAt || Date.parse(e.deletedAt) > cutoff);
    if (pruned.length !== list.length) save(key, pruned);
  }
}

function load(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return []; // corrupt/blocked storage — behave as an empty arsenal rather than crash
  }
}

function save(key, list) {
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch {
    // storage full or disabled — best-effort, same posture as prefs.js
  }
}

// Stamped here (rather than left to callers) so every write path — the
// Arsenal forms, the prefill collision-overwrite flow, a cartridge edit
// resaving its parent rifle — gets it automatically and
// consistently, with no risk of a caller forgetting it. `unsaved: true`
// marks that this entry's current content has no corresponding export to
// a file yet (see arsenal-export.js) — every write through here is by
// definition a fresh, not-yet-exported modification; only an actual
// export clears it (markSaved() below).
function upsert(key, record) {
  const { encode, decode } = CODEC_BY_KEY[key];
  const entry = encode(record);
  const list = load(key);
  const idx = list.findIndex((e) => e.id === entry.id);
  const previous = idx === -1 ? null : list[idx];
  const stamped = {
    ...entry, modifiedAt: new Date().toISOString(), modifiedBy: getDeviceId(),
    revision: nextLocalRevision(previous), unsaved: true
  };
  if (idx === -1) list.push(stamped);
  else list[idx] = stamped;
  save(key, list);
  notifyLibraryWrite({ recordType: RECORD_TYPE_BY_KEY[key], record: stamped, previous });
  return decode(stamped);
}

// Writes a record's fields exactly as given, unlike upsert() — used only
// by import (see arsenal-export.js's resolveImportItem()), which must
// preserve the imported record's own modifiedAt rather than restamping
// "now" (stamping "now" would both lose the real authoring date and break
// future newer/older comparisons against it), while still marking it
// unsaved: true, since importing is itself a local modification with no
// export of *this* library state yet. Also, deliberately, preserves
// whatever `modifiedBy` the incoming record carries (or its absence)
// rather than restamping it with this device's own id — the local device
// did not author that version, a peer or a prior export did, and
// `modifiedBy` is what lets a peer later render "(from Guns' iPhone)" for
// it.
//
// `revision` is preserved verbatim too — via the `{...entry}` spread,
// same as modifiedAt/modifiedBy — deliberately NOT bumped the way
// upsert()'s local edit is. See revision.js's own comment on why an
// unconditional "+1 on every merge-apply" (the plan's original, more
// literal wording) causes an unbounded revision climb once two devices
// gossip the same unchanged record back and forth: this app's model is
// every device publishes its complete state every cycle, not a one-way
// message hop, and re-adopting an already-known value must be a true
// no-op for revision purposes, exactly like it already is for
// modifiedAt/modifiedBy.
function upsertRaw(key, entry) {
  const list = load(key);
  const stamped = { ...entry, unsaved: true };
  const idx = list.findIndex((e) => e.id === entry.id);
  const previous = idx === -1 ? null : list[idx];
  if (idx === -1) list.push(stamped);
  else list[idx] = stamped;
  save(key, list);
  notifyLibraryWrite({ recordType: RECORD_TYPE_BY_KEY[key], record: stamped, previous });
  return stamped;
}

// Soft-delete: replaces the record with a tombstone rather than removing
// it outright, so a deletion can propagate through sync instead of a
// stale remote copy silently resurrecting it on a future merge.
// `childArrayField` carries forward an
// empty child array matching the record's normal shape (`cartridges` for a
// rifle, `reticleIds` for a scope, absent for a bullet) — see the plan's "tombstones must be
// shape-preserving": several existing call sites reach into that array
// with no guard, and a bare `{ id, deletedAt }` would crash them.
function tombstone(key, id, childArrayField) {
  const list = load(key);
  const idx = list.findIndex((e) => e.id === id);
  if (idx === -1) return; // already gone / never existed — nothing to tombstone
  const existing = list[idx];
  const tomb = {
    id,
    name: existing.name,
    deletedAt: new Date().toISOString(),
    deletedBy: getDeviceId(),
    revision: nextLocalRevision(existing),
    unsaved: true,
    ...(childArrayField ? { [childArrayField]: [] } : {})
  };
  list[idx] = tomb;
  save(key, list);
  notifyLibraryWrite({ recordType: RECORD_TYPE_BY_KEY[key], record: tomb, previous: existing });
}

// Flips unsaved back to false for exactly the given ids, once an export
// covering them has actually happened — deliberately not routed through
// upsert() above, since exporting doesn't change any of the entry's own
// data and so must not touch modifiedAt.
function markSaved(key, ids) {
  const idSet = new Set(ids);
  const list = load(key).map((e) => (idSet.has(e.id) ? { ...e, unsaved: false } : e));
  save(key, list);
}

// Case/whitespace-insensitive — "Same name" for the overwrite-warning
// check shouldn't hinge on exact capitalization or a trailing space.
// Excludes tombstones: deleting something and recreating it under the same
// name must keep working, not report a collision against a record the
// user cannot see anywhere.
function findByName(key, name, { excludeId } = {}) {
  const normalized = name.trim().toLowerCase();
  const found = load(key).find((e) => e.id !== excludeId && isLive(e) && e.name.trim().toLowerCase() === normalized);
  return found && CODEC_BY_KEY[key].decode(found);
}

// Opaque, locally-unique id — this is a single-user, single-device store,
// so a short random suffix is more than enough entropy; no need for a
// full UUID implementation just for this.
export function generateUserId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// Live records only — tombstones are filtered out here so every existing
// read site (there are dozens) keeps its current meaning with no edit. Use
// loadUserBulletsWithTombstones() for the few callers that need deletions
// too (the sync bundle builder, the merge engine, the tombstone GC sweep).
export function loadUserBullets() {
  sweepTombstonesOnce();
  return load(BULLETS_KEY).filter(isLive);
}

export function loadUserBulletsWithTombstones() {
  sweepTombstonesOnce();
  return load(BULLETS_KEY);
}

export function saveUserBullet(bullet) {
  return upsert(BULLETS_KEY, bullet);
}

// Used only by import (src/arsenal-export.js) — see upsertRaw() above for
// why this bypasses the usual modifiedAt stamping.
export function importUserBullet(bullet) {
  return upsertRaw(BULLETS_KEY, bullet);
}

export function deleteUserBullet(id) {
  tombstone(BULLETS_KEY, id);
}

export function findUserBulletByName(name, options) {
  return findByName(BULLETS_KEY, name, options);
}

export function markUserBulletsSaved(ids) {
  markSaved(BULLETS_KEY, ids);
}

// Live records only — see loadUserBullets() above.
export function loadUserRifles() {
  sweepTombstonesOnce();
  return load(RIFLES_KEY).filter(isLive).map(decodeRifle);
}

export function loadUserRiflesWithTombstones() {
  sweepTombstonesOnce();
  return load(RIFLES_KEY);
}

export function saveUserRifle(rifle) {
  return upsert(RIFLES_KEY, rifle);
}

// Used only by import (src/arsenal-export.js) — see upsertRaw() above for
// why this bypasses the usual modifiedAt stamping.
export function importUserRifle(rifle) {
  return upsertRaw(RIFLES_KEY, rifle);
}

// Tombstoned with an empty cartridges array — see tombstone() above —
// keeping the shape every existing rifle-reading call site expects.
export function deleteUserRifle(id) {
  tombstone(RIFLES_KEY, id, 'cartridges');
}

export function findUserRifleByName(name, options) {
  return findByName(RIFLES_KEY, name, options);
}

// The stored form of a record the app holds (for an export file): the
// stored record itself while it is the one the app read — same id,
// revision and timestamp, so not edited since — which keeps an untouched
// record byte-for-byte as it was; otherwise its fresh encoding.
function storedFormOf(key, record) {
  const stored = load(key).find((e) => e.id === record.id);
  const same = stored && stored.revision === record.revision && stored.modifiedAt === record.modifiedAt && stored.deletedAt === record.deletedAt;
  return same ? stored : CODEC_BY_KEY[key].encode(record);
}

export function storedUserBulletOf(bullet) {
  return storedFormOf(BULLETS_KEY, bullet);
}

export function storedUserRifleOf(rifle) {
  return storedFormOf(RIFLES_KEY, rifle);
}

export function markUserRiflesSaved(ids) {
  markSaved(RIFLES_KEY, ids);
}

// Live records only — see loadUserBullets() above.
export function loadUserScopes() {
  sweepTombstonesOnce();
  return load(SCOPES_KEY).filter(isLive).map(decodeScope);
}

export function loadUserScopesWithTombstones() {
  sweepTombstonesOnce();
  return load(SCOPES_KEY);
}

export function saveUserScope(scope) {
  return upsert(SCOPES_KEY, scope);
}

// Used only by import and sync — see upsertRaw() above.
export function importUserScope(scope) {
  return upsertRaw(SCOPES_KEY, scope);
}

// Tombstoned with an empty reticleIds array — see tombstone() above.
export function deleteUserScope(id) {
  tombstone(SCOPES_KEY, id, 'reticleIds');
}

// `name` is the scope's manufacturer and model (scope-record.js's
// opticLabel).
export function findUserScopeByName(name, options) {
  return findByName(SCOPES_KEY, name, options);
}

export function storedUserScopeOf(scope) {
  return storedFormOf(SCOPES_KEY, scope);
}

export function markUserScopesSaved(ids) {
  markSaved(SCOPES_KEY, ids);
}
