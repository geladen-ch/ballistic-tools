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
export const DB_VERSION = 2;

export const STORES = [
  { name: 'locations', keyPath: 'id' },
  { name: 'rifle-precision-projects', keyPath: 'id' },
];
