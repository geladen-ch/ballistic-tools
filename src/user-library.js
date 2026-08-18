// localStorage-backed CRUD for the user's own "Arsenal" — bullets and
// rifles the user enters themselves, stored in the exact same shape as a
// built-in library entry (see src/bullets/*.json, src/rifles/*.json) so
// every place that already knows how to render/consume a built-in entry
// works unchanged for a user one too. Unlike the built-in catalogs (fetched
// once and cached in-memory), these are re-read from storage on every call
// — there's no staleness risk to guard against, and the data is tiny, so
// simplicity wins over caching.
const BULLETS_KEY = 'ballistics_user_bullets_v1';
const RIFLES_KEY = 'ballistics_user_rifles_v1';

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
// Arsenal forms, the "Set active"/prefill collision-overwrite flow, a
// cartridge edit resaving its parent rifle — gets it automatically and
// consistently, with no risk of a caller forgetting it. `unsaved: true`
// marks that this entry's current content has no corresponding export to
// a file yet (see arsenal-export.js) — every write through here is by
// definition a fresh, not-yet-exported modification; only an actual
// export clears it (markSaved() below).
function upsert(key, entry) {
  const list = load(key);
  const stamped = { ...entry, modifiedAt: new Date().toISOString(), unsaved: true };
  const idx = list.findIndex((e) => e.id === entry.id);
  if (idx === -1) list.push(stamped);
  else list[idx] = stamped;
  save(key, list);
  return stamped;
}

// Writes a record's fields exactly as given, unlike upsert() — used only
// by import (see arsenal-export.js's resolveImportItem()), which must
// preserve the imported record's own modifiedAt rather than restamping
// "now" (stamping "now" would both lose the real authoring date and break
// future newer/older comparisons against it), while still marking it
// unsaved: true, since importing is itself a local modification with no
// export of *this* library state yet.
function upsertRaw(key, entry) {
  const list = load(key);
  const stamped = { ...entry, unsaved: true };
  const idx = list.findIndex((e) => e.id === entry.id);
  if (idx === -1) list.push(stamped);
  else list[idx] = stamped;
  save(key, list);
  return stamped;
}

function remove(key, id) {
  save(key, load(key).filter((e) => e.id !== id));
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
function findByName(key, name, { excludeId } = {}) {
  const normalized = name.trim().toLowerCase();
  return load(key).find((e) => e.id !== excludeId && e.name.trim().toLowerCase() === normalized);
}

// Opaque, locally-unique id — this is a single-user, single-device store,
// so a short random suffix is more than enough entropy; no need for a
// full UUID implementation just for this.
export function generateUserId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function loadUserBullets() {
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
  remove(BULLETS_KEY, id);
}

export function findUserBulletByName(name, options) {
  return findByName(BULLETS_KEY, name, options);
}

export function markUserBulletsSaved(ids) {
  markSaved(BULLETS_KEY, ids);
}

export function loadUserRifles() {
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

export function deleteUserRifle(id) {
  remove(RIFLES_KEY, id);
}

export function findUserRifleByName(name, options) {
  return findByName(RIFLES_KEY, name, options);
}

export function markUserRiflesSaved(ids) {
  markSaved(RIFLES_KEY, ids);
}
