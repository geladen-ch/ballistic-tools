// Single shared IndexedDB schema for every store in this app. All stores
// live in one database (DB_NAME) rather than one database per feature, so
// they must all be declared here and passed to openDatabase() together —
// browsers only run onupgradeneeded (where db.js creates missing stores)
// when opening at a version higher than what's already on disk. A feature
// module that opened the database itself with its own store list, without
// bumping DB_VERSION, would silently never get its store created on a
// browser that already has an earlier version of this database (real
// IndexedDB; the test-only fake in fake-dom.js doesn't model this at all).
// So: every store this app ever adds goes in STORES below, and DB_VERSION
// bumps by one each time a store is added, never reused across app.js
// releases the way service-worker.js's CACHE_VERSION is (this is durable
// user data, not an ephemeral asset cache).
export const DB_NAME = 'ballistics-tools';
export const DB_VERSION = 5;

// Version 3 adds all three of docs/plans/backup-sync.md's new stores in a
// single bump rather than one bump each — see that plan's "One schema
// bump, not three" for why (a DB_VERSION bump is a one-way door: an older
// build can never open a newer on-disk database, so collapsing three
// planned bumps into one means a rollback strands users on exactly one
// version instead of three different ones).
// Version 4 adds both stores docs/plans/orphaned-storage-cleanup.md ever
// needs, in one bump, for the same reason version 3 collapsed three into
// one: a bump is a one-way door. 'sync-log' is used immediately (that
// plan's phase 1); 'asset-state' is not written to until its phase 2, and
// is declared here anyway because declaring it later would cost a second
// bump — which is precisely what this file's header warns against.
// Version 5 adds 'change-history-index': a small summary of each change-
// history entry, so the app can list its history without reading the
// snapshots — full copies of records, photos included, up to 128 MB in all —
// into memory at every start. Version 4 had not shipped when this was
// added, so for every user who upgrades it is still the one step from 3;
// it is a separate number only because a development build had already
// opened the database at 4, and a browser only creates a new store when
// the version goes up.
export const STORES = [
  { name: 'locations', keyPath: 'id' },
  { name: 'rifle-precision-projects', keyPath: 'id' },
  { name: 'sync-folder-handle', keyPath: 'id' },
  { name: 'change-history', keyPath: 'id' },
  { name: 'pending-review', keyPath: 'id' },
  { name: 'sync-log', keyPath: 'id' },
  { name: 'asset-state', keyPath: 'id' },
  { name: 'change-history-index', keyPath: 'id' },
];
