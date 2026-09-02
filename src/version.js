// Single source of truth for this build's version/release identity — shown
// on Home (see home-view.js), appended to the browser tab title (see
// i18n.js), and used to name the service worker's cache (see
// service-worker.js). All four constants are bumped by hand on release;
// nothing here is derived automatically from anything else.
export const CACHE_VERSION = 'v165';
export const RELEASE_ID = '3.2.11';
export const CODENAME_SHORT = 'BADASS';
export const CODENAME_LONG = 'Ballistics Analysis and Data Assessment Software Suite';
