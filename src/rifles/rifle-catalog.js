// The list of rifles bundled with the app. Same shape and reasoning as
// bullets/bullet-catalog.js: a plain id list kept as a real ES module (not
// JSON) so both the app (rifles.js) and the module-type service worker can
// `import` it directly, with exactly one source of truth either side has
// to stay in sync with.
export const RIFLE_IDS = [
  // Imported from data/rifles.info — see each file's own "source" field
  // for provenance (and for which parts are sourced vs. this app's own
  // placeholder defaults).
  'ak74',
  'akm',
  'fass57',
  'fass90',
  'k31',
  'm16a2',
  'm4a1',
  'svd'
];
