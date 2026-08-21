// localStorage-backed CRUD for the user's own "Locations & Targets"
// library (Range Solver) — same shape and conventions as
// user-library.js's Arsenal bullets/rifles (modifiedAt/unsaved stamping,
// name-collision lookup, opaque locally-unique ids), kept as its own
// module rather than folded into user-library.js since that file's own
// scope is explicitly "the user's Arsenal" and this is an unrelated
// feature that just happens to want the same storage pattern.
//
// A target has no record of its own here — it's a plain nested object in
// its parent location's `targets` array (see location-export.js's data
// model comment), so editing one just re-upserts the whole location,
// same as editing one of a rifle's cartridges today re-upserts the whole
// rifle in user-library.js.
const LOCATIONS_KEY = 'ballistics_user_locations_v1';

function load() {
  try {
    const raw = localStorage.getItem(LOCATIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return []; // corrupt/blocked storage — behave as an empty library rather than crash
  }
}

function save(list) {
  try {
    localStorage.setItem(LOCATIONS_KEY, JSON.stringify(list));
  } catch {
    // storage full or disabled — best-effort, same posture as prefs.js
  }
}

// See user-library.js's own upsert() for why this stamping lives here
// rather than at each call site.
function upsert(entry) {
  const list = load();
  const stamped = { ...entry, modifiedAt: new Date().toISOString(), unsaved: true };
  const idx = list.findIndex((e) => e.id === entry.id);
  if (idx === -1) list.push(stamped);
  else list[idx] = stamped;
  save(list);
  return stamped;
}

// Used only by import (see location-export.js) — preserves the file's own
// modifiedAt rather than restamping "now", same reasoning as
// user-library.js's own upsertRaw().
function upsertRaw(entry) {
  const list = load();
  const stamped = { ...entry, unsaved: true };
  const idx = list.findIndex((e) => e.id === entry.id);
  if (idx === -1) list.push(stamped);
  else list[idx] = stamped;
  save(list);
  return stamped;
}

export function loadUserLocations() {
  return load();
}

export function saveUserLocation(location) {
  return upsert(location);
}

export function importUserLocation(location) {
  return upsertRaw(location);
}

export function deleteUserLocation(id) {
  save(load().filter((e) => e.id !== id));
}

// Case/whitespace-insensitive — same convention as user-library.js's own
// findByName.
export function findUserLocationByName(name, { excludeId } = {}) {
  const normalized = name.trim().toLowerCase();
  return load().find((e) => e.id !== excludeId && e.name.trim().toLowerCase() === normalized);
}

export function markUserLocationsSaved(ids) {
  const idSet = new Set(ids);
  save(load().map((e) => (idSet.has(e.id) ? { ...e, unsaved: false } : e)));
}
