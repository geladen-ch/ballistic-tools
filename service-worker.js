// Network-first app shell for offline use: every GET tries the network
// first and refreshes the cache with whatever comes back, falling back to
// the cache only when the network is unreachable. This app has no
// cache-busting filenames (zero build step), so a cache-first strategy
// means any staleness — a browser's SW update check landing at an
// inconvenient time, a page that's been open since before an edit — is
// stuck until the *next* service worker version fully installs and
// activates, which itself depends on browser-controlled timing this file
// can't force. Network-first sidesteps that whole dependency: as long as
// the network is reachable, the response is always what's actually on
// disk right now, no update handshake required. Offline support still
// works via the cache fallback and the CACHE_VERSION precache below.
//
// This is a module-type worker (registered with { type: 'module' } in
// app.js) specifically so it can import the bullet library registry
// directly — see BULLET_LIBRARIES below — instead of every bullet's URL
// having to be listed here by hand.
// The browser's SW update check byte-compares this file's own script
// text only — never what it imports — so a change confined to
// version.js's CACHE_VERSION alone won't be noticed by an already-open
// tab. Editing this file directly (even just a comment, like this one)
// is what actually triggers that detection.
import { BULLET_LIBRARIES } from './src/bullets/bullet-libraries.js';
import { RIFLE_IDS } from './src/rifles/rifle-catalog.js';
import { CACHE_VERSION } from './src/version.js';

const CACHE_NAME = `ballistics-tools-${CACHE_VERSION}`;

const APP_SHELL_URLS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './LICENSE',
  './icons/icon.svg',
  './icons/icon-safe.svg',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './src/app.js',
  './src/router.js',
  './src/dom.js',
  './src/pool.js',
  './src/units.js',
  './src/prefs.js',
  './src/cookies.js',
  './src/table-columns.js',
  './src/trajectory-columns.js',
  './src/trajectory-state.js',
  './src/comparison-state.js',
  './src/cd-mach-curve-state.js',
  './src/labradar/track-parse.js',
  './src/labradar/zip-batch.js',
  './src/drag-model-prefs.js',
  './src/zero-spin-drift-prefs.js',
  './src/nav-tools.js',
  './src/nav-prefs.js',
  './src/display-mode-prefs.js',
  './src/range-solver-nav.js',
  './src/range-solver-state.js',
  './src/range-solver-prefs.js',
  './src/version.js',
  './src/svg.js',
  './src/bullets.js',
  './src/bullets/bullet-libraries.js',
  './src/bullets/geladen/catalog.js',
  './src/bullets/lapua-cd/catalog.js',
  './src/bullets/hornady-reverse/catalog.js',
  './src/rifles.js',
  './src/rifles/rifle-catalog.js',
  './src/library-prefs.js',
  './src/bullet-library-prefs.js',
  './src/spin-drift-prefs.js',
  './src/update-notification-prefs.js',
  './src/update-notifications.js',
  './src/release-history.js',
  './src/csv-prefs.js',
  './src/wind-dial-prefs.js',
  './src/csv-export.js',
  './src/download.js',
  './src/chart-svg-export.js',
  './src/shot-state.js',
  './src/guns-nav.js',
  './src/user-library.js',
  './src/arsenal-prefill.js',
  './src/arsenal-export.js',
  './src/db.js',
  './src/db-schema.js',
  './src/location-library.js',
  './src/location-export.js',
  './src/location-photo.js',
  './src/location-placement-nav.js',
  './src/rifle-precision-library.js',
  './src/rifle-precision-nav.js',
  './src/rifle-precision-photo-export.js',
  './src/i18n.js',
  './src/styles/base.css',
  './src/styles/layout.css',
  './src/vendor/chartist/index.js',
  './src/vendor/chartist/index.css',
  './src/ui/unit-field.js',
  './src/ui/language-switcher.js',
  './src/ui/display-mode-switch.js',
  './src/ui/muzzle-velocity-temp-field.js',
  './src/ui/scope-clicks-field.js',
  './src/ui/column-toggles.js',
  './src/ui/zoom-range-slider.js',
  './src/ui/wind-direction-dial.js',
  './src/ui/large-stepper-field.js',
  './src/ui/theme-picker.js',
  './src/ui/chart-column-select.js',
  './src/ui/download-button.js',
  './src/ui/copy-button.js',
  './src/ui/nav-icons.js',
  './src/ui/nav-rail.js',
  './src/ui/nav-tabbar.js',
  './src/ui/topbar-scroll.js',
  './src/ui/status-chip.js',
  './src/ui/stability-indicator.js',
  './src/ui/app-dialog.js',
  './src/ui/collapsible-hint.js',
  './src/ui/section.js',
  './src/ui/sections/rifle-section.js',
  './src/ui/sections/cartridge-section.js',
  './src/ui/sections/bullet-section.js',
  './src/ui/bullet-library-checkboxes.js',
  './src/ui/sections/atmosphere-section.js',
  './src/ui/sections/guns-summary.js',
  './src/ui/drag-model-select.js',
  './src/ui/velocity-table-parse.js',
  './src/ui/arsenal/mass-field.js',
  './src/ui/arsenal/caliber-field.js',
  './src/ui/arsenal/bullet-form.js',
  './src/ui/arsenal/cd-table-parse.js',
  './src/ui/arsenal/cartridge-form.js',
  './src/ui/arsenal/rifle-form.js',
  './src/ui/labradar/track-list.js',
  './src/ui/labradar/track-chart.js',
  './src/ui/labradar/results-summary.js',
  './src/ui/arsenal/export-dialog.js',
  './src/ui/arsenal/import-dialog.js',
  './src/ui/locations/location-export-dialog.js',
  './src/ui/locations/location-form.js',
  './src/ui/locations/location-import-dialog.js',
  './src/ui/locations/location-photo-field.js',
  './src/ui/locations/location-picker-button.js',
  './src/ui/locations/photo-pin-geometry.js',
  './src/ui/locations/photo-viewport.js',
  './src/ui/locations/target-form.js',
  './src/ui/locations/target-summary.js',
  './src/ui/rifle-precision/project-form.js',
  './src/ui/rifle-precision/photo-add-flow.js',
  './src/ui/rifle-precision/group-selector.js',
  './src/ui/rifle-precision/analysis-diagram.js',
  './src/ui/rifle-precision/confidence-o-meter.js',
  './src/ui/rifle-precision/hit-probability-slider.js',
  './src/views/home-view.js',
  './src/views/category-view.js',
  './src/views/guns-view.js',
  './src/views/trajectory-view.js',
  './src/views/bc-tools-view.js',
  './src/views/cd-mach-curve-view.js',
  './src/views/hit-probability-view.js',
  './src/views/range-solver-view.js',
  './src/views/locations-view.js',
  './src/views/location-placement-view.js',
  './src/views/rifle-precision-view.js',
  './src/views/rifle-precision-marking-view.js',
  './src/views/rifle-precision-analysis-view.js',
  './src/views/arsenal-view.js',
  './src/views/settings-view.js',
  './src/views/manual-view.js',
  './src/views/thanks-view.js',
  './src/views/release-history-view.js',
  './src/manual-markdown.js',
  './src/manual/en.md',
  './src/manual/fr.md',
  './src/manual/ru.md',
  './src/manual/de.md',
  './src/manual/it.md',
  './src/THANKS.md',
  './src/engine/constants.js',
  './src/engine/drag-tables.js',
  './src/engine/atmosphere.js',
  './src/engine/trajectory.js',
  './src/engine/bc-estimate.js',
  './src/engine/cd-mach-curve.js',
  './src/engine/labradar-clean.js',
  './src/engine/labradar-bc.js',
  './src/engine/stability.js',
  './src/engine/spin-drift.js',
  './src/engine/target-shapes.js',
  './src/engine/dispersion-sources.js',
  './src/engine/single-shot.js',
  './src/engine/rifle-precision-constants.js',
  './src/engine/rifle-precision-stats.js',
  './src/engine/spotter-corrected.js',
  './src/targets.js',
  './src/targets/target-catalog.js',
  './src/targets/plate-40x60.json',
  './src/targets/plate-40x60.js',
  './src/targets/plate-40x60-thumb.svg',
  './src/targets/plate-40x60-detail.svg',
  './src/targets/plate-40x60-result.svg',
  './src/targets/issf-300m.json',
  './src/targets/issf-300m.js',
  './src/targets/issf-300m-thumb.svg',
  './src/targets/issf-300m-detail.svg',
  './src/targets/issf-300m-result.svg',
  './src/targets/ch-300m-b4.json',
  './src/targets/ch-300m-b4.js',
  './src/targets/ch-300m-b4-thumb.svg',
  './src/targets/ch-300m-b4-detail.svg',
  './src/targets/ch-300m-b4-result.svg',
  './src/targets/ch-300m-b10.json',
  './src/targets/ch-300m-b10.js',
  './src/targets/ch-300m-b10-thumb.svg',
  './src/targets/ch-300m-b10-detail.svg',
  './src/targets/ch-300m-b10-result.svg',
  './src/targets/ussr-4.json',
  './src/targets/ussr-4.js',
  './src/targets/ussr-4-thumb.svg',
  './src/targets/ussr-4-detail.svg',
  './src/targets/ussr-4-result.svg',
  './src/targets/ussr-5.json',
  './src/targets/ussr-5.js',
  './src/targets/ussr-5-thumb.svg',
  './src/targets/ussr-5-detail.svg',
  './src/targets/ussr-5-result.svg',
  './src/targets/ussr-8.json',
  './src/targets/ussr-8.js',
  './src/targets/ussr-8-thumb.svg',
  './src/targets/ussr-8-detail.svg',
  './src/targets/ussr-8-result.svg',
  './src/targets/ch-campagne-e.json',
  './src/targets/ch-campagne-e.js',
  './src/targets/ch-campagne-e-thumb.svg',
  './src/targets/ch-campagne-e-detail.svg',
  './src/targets/ch-campagne-e-result.svg',
  './src/targets/ch-campagne-f.json',
  './src/targets/ch-campagne-f.js',
  './src/targets/ch-campagne-f-thumb.svg',
  './src/targets/ch-campagne-f-detail.svg',
  './src/targets/ch-campagne-f-result.svg',
  './src/targets/ch-campagne-g.json',
  './src/targets/ch-campagne-g.js',
  './src/targets/ch-campagne-g-thumb.svg',
  './src/targets/ch-campagne-g-detail.svg',
  './src/targets/ch-campagne-g-result.svg',
  './src/targets/ch-campagne-h.json',
  './src/targets/ch-campagne-h.js',
  './src/targets/ch-campagne-h-thumb.svg',
  './src/targets/ch-campagne-h-detail.svg',
  './src/targets/ch-campagne-h-result.svg',
  './src/targets/ch-campagne-k.json',
  './src/targets/ch-campagne-k.js',
  './src/targets/ch-campagne-k-thumb.svg',
  './src/targets/ch-campagne-k-detail.svg',
  './src/targets/ch-campagne-k-result.svg',
  './src/targets/ch-nttc-score.json',
  './src/targets/ch-nttc-score.js',
  './src/targets/ch-nttc-score-thumb.svg',
  './src/targets/ch-nttc-score-detail.svg',
  './src/targets/ch-nttc-score-result.svg',
  './src/targets/circle-100mm.json',
  './src/targets/circle-100mm.js',
  './src/targets/circle-100mm-thumb.svg',
  './src/targets/circle-100mm-detail.svg',
  './src/targets/circle-100mm-result.svg',
  './src/targets/circle-200mm.json',
  './src/targets/circle-200mm.js',
  './src/targets/circle-200mm-thumb.svg',
  './src/targets/circle-200mm-detail.svg',
  './src/targets/circle-200mm-result.svg',
  './src/targets/square-1m.json',
  './src/targets/square-1m.js',
  './src/targets/square-1m-thumb.svg',
  './src/targets/square-1m-detail.svg',
  './src/targets/square-1m-result.svg',
  './src/targets/square-2m.json',
  './src/targets/square-2m.js',
  './src/targets/square-2m-thumb.svg',
  './src/targets/square-2m-detail.svg',
  './src/targets/square-2m-result.svg',
  './src/targets/killer-tubby.json',
  './src/targets/killer-tubby.js',
  './src/targets/killer-tubby-thumb.svg',
  './src/targets/killer-tubby-detail.svg',
  './src/targets/killer-tubby-result.svg',
  './src/workers/ballistics-worker.js',
  './src/workers/worker-pool.js',
  './src/vendor/js-quantities/quantities.mjs',
  './src/vendor/fflate/fflate.js',
  './src/vendor/i18next/i18next.js',
  './src/locales/en.json',
  './src/locales/fr.json',
  './src/locales/ru.json',
  './src/locales/de.json',
  './src/locales/it.json',
  './src/bullets/caliber-designations.json' // one shared lookup file, not one-per-bullet — fine to list by hand
];

// One entry per bullet/rifle, derived from the imported catalogs rather
// than enumerated here — this is the whole point of the module-worker
// switch, and is what keeps this file's size independent of how large
// either library grows. Each bullet library keeps its own ids in its own
// directory (see bullets/bullet-libraries.js), so this flat-maps across
// all of them rather than reading a single ids array.
const BULLET_URLS = BULLET_LIBRARIES.flatMap((lib) => lib.ids.map((id) => `./src/bullets/${lib.id}/${id}.json`));
const RIFLE_URLS = RIFLE_IDS.map((id) => `./src/rifles/${id}.json`);

const PRECACHE_URLS = [...APP_SHELL_URLS, ...BULLET_URLS, ...RIFLE_URLS];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => Promise.all(
        // cache.addAll() fetches with default HTTP-cache semantics, so a
        // file the browser's own HTTP cache still has warm from an earlier
        // version gets precached again unchanged — a new CACHE_VERSION
        // silently inherits stale bytes for whichever files happened to
        // still be warm. { cache: 'reload' } forces every precache fetch
        // to hit the network, so a version bump always reflects what's
        // actually on disk.
        PRECACHE_URLS.map((url) => fetch(url, { cache: 'reload' }).then((response) => cache.put(url, response)))
      ))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
      }
      return response;
    }).catch(() => caches.match(event.request))
  );
});
