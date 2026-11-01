// The scopes bundled with the app — a plain id list, kept as a real ES
// module for the same reason as rifles/rifle-catalog.js: the app
// (scopes.js) and the module-type service worker both import it, one
// source of truth for both. Each id has its record, in the stored form
// (scope-record.js), at ./<id>.json; every reticle a built-in scope lists
// is a built-in one (reticles/reticle-catalog.js).
export const SCOPE_IDS = [
  'sb-pm2-3-20x50',
  'sb-cm2-6-36x56',
  'sb-pm2-3-20x50-ultra-short',
  'sb-pm2-5-20x50-ultra-short',
  'sb-pm2-5-25x56',
  'sb-pm2-5-45x56-high-power',
  'sb-pm2-3-27x56-high-power',
  'trijicon-acog-4x32-rco-m4',
  'element-immersive-5x30-mrad',
  'element-immersive-5x30-bdc',
  'generic-3-12x-ffp-mrad',
  'generic-4-16x-ffp-mrad',
  'generic-4-24x-ffp-mrad',
  'generic-5-25x-ffp-mrad',
  'generic-5-30x-ffp-mrad'
];
