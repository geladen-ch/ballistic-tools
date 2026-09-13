// A tiny pub/sub so user-library.js/location-library.js/
// rifle-precision-library.js can notify interested sync machinery after
// every write, without those storage modules importing sync code
// directly (which would be a real import cycle: this app's storage layer
// predates sync and must stay usable on its own). Two subscribers use
// this today, both described in docs/plans/backup-sync.md: Phase 5's
// dirty flag (skip publishing a bundle with nothing new to say) and
// Phase 9's history-capture hook (a snapshot on every edit, regardless of
// the master toggle).
const listeners = [];

export function onLibraryWrite(listener) {
  listeners.push(listener);
}

// `event` is `{ recordType, record, previous }` — recordType is one of
// 'bullet', 'rifle', 'location', 'rifle-precision-project'; `record` is
// the value just written, and `previous` is the value it replaced (null
// for a brand-new record). Phase 9's history capture needs `previous`
// specifically: the plan's capture rule is "immediately before writing a
// new value for a given id, the *current* (about-to-be-superseded)
// content is pushed into the history store", which the post-write value
// alone cannot satisfy — a record deleted without ever having been
// edited on this build would otherwise have nothing to restore to.
export function notifyLibraryWrite(event) {
  for (const listener of listeners) listener(event);
}
