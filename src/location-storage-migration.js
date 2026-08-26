// One-time boot migration: Locations & Targets used to be stored under a
// single localStorage key (see location-library.js's own history) before
// v2.9 moved that storage to IndexedDB. Anyone who upgraded across that
// release kept using the app with an empty IndexedDB store — their old
// data was left behind under the legacy key, untouched and invisible to
// the current UI. This module finds that leftover key on boot, imports its
// contents into the current library, and removes the key — once. There's
// no separate "already migrated" flag: removing the key on success is
// itself what makes a later boot see nothing to do.
import { loadUserLocations, importUserLocation, waitForPendingWrites } from './location-library.js';
import { generateUserId } from './user-library.js';

const LEGACY_STORAGE_KEY = 'ballistics_user_locations_v1';

export async function migrateLegacyLocationStorage() {
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return;

    let legacyLocations;
    try {
      legacyLocations = JSON.parse(raw);
    } catch {
      // Corrupt/unreadable — leave the key in place rather than destroy the
      // only copy of it; a future boot will just try again (harmless).
      console.warn('location-storage-migration: legacy data is not valid JSON, leaving it in place');
      return;
    }
    if (!Array.isArray(legacyLocations)) return;

    const existingIds = new Set(loadUserLocations().map((entry) => entry.id));
    for (const location of legacyLocations) {
      const id = existingIds.has(location.id) ? generateUserId('location') : location.id;
      existingIds.add(id);
      importUserLocation({ ...location, id });
    }

    // Only remove the legacy key once every imported record is actually
    // durable in IndexedDB — this key is the only copy, so deleting it
    // ahead of that would risk losing data on a crash/close mid-write.
    await waitForPendingWrites();
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch (err) {
    // Must never block app boot.
    console.error('location-storage-migration: migration failed', err);
  }
}
