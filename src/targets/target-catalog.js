// The list of targets bundled with the app. Code-shaped metadata (a plain
// id list), not data — kept as a real ES module rather than JSON so both
// the app (targets.js) and the module-type service worker can `import` it
// directly, with no fetch and exactly one source of truth either side has
// to stay in sync with. Same shape and reasoning as rifles/rifle-catalog.js
// and each built-in bullet library's own catalog.js (see
// bullets/bullet-libraries.js).
export const TARGET_IDS = [
  'plate-40x60',
  'issf-300m',
  'ch-300m-b4',
  'ch-300m-b10',
  'ussr-4',
  'ussr-5',
  'ussr-8',
  'ch-campagne-e',
  'ch-campagne-f',
  'ch-campagne-g',
  'ch-campagne-h',
  'ch-campagne-k',
  'ch-nttc-score',
  'circle-100mm',
  'circle-200mm',
  'square-1m',
  'square-2m',
  'killer-tubby'
];
