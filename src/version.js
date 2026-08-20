// Single source of truth for this build's version/release identity — shown
// on Home (see home-view.js), appended to the browser tab title (see
// i18n.js), and used to name the service worker's cache (see
// service-worker.js). All four constants are bumped by hand on release;
// nothing here is derived automatically from anything else.
export const CACHE_VERSION = 'v133';
export const RELEASE_ID = '1.3';
export const CODENAME_SHORT = 'PEWPEW';
export const CODENAME_LONG = 'Projectile Evaluation & Weapon Performance Engineering Workbench';
