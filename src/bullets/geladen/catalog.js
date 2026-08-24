// The "Geladen's own" built-in bullet library — see ../bullet-libraries.js
// for the registry entry (name/description/prefix) this list belongs to.
// Kept as a real ES module rather than JSON for the same reason every
// other library's own catalog.js is: both the app and the module-type
// service worker can `import` it directly, with no fetch.
export const BULLET_IDS = [
  'nato-m193',
  'nato-m80',
  'nato-m855',
  'ruag-338-swissp-ball-252',
  'ruag-338-swissp-target-250',
  'russian-545x39-7n10',
  'russian-545x39-7n6',
  'russian-762x39-m43',
  'russian-762x54r-7n1',
  'swiss-gp11',
  'swiss-gp90'
];
