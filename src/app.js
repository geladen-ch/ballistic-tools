import { registerRoute, startRouter, rerender } from './router.js';
import { initI18n, onLanguageChange } from './i18n.js';
import { CACHE_VERSION, RELEASE_ID } from './version.js';
import { logDiagnostic } from './debug-log.js';
import { mountLanguageSwitcher } from './ui/language-switcher.js';
import { mountDisplayModeSwitch } from './ui/display-mode-switch.js';
import { getDisplayMode, onDisplayModeChange } from './display-mode-prefs.js';
import { onRangeSolverModeChange } from './range-solver-nav.js';
import { onPlacementModeChange } from './location-placement-nav.js';
import { onMarkingModeChange } from './rifle-precision-nav.js';
import { getTheme, onThemeChange } from './range-solver-prefs.js';
import { mountNavRail } from './ui/nav-rail.js';
import { mountNavTabbar } from './ui/nav-tabbar.js';
import { mountTopbarScroll } from './ui/topbar-scroll.js';
import { mountDialogRoot } from './ui/app-dialog.js';
import { checkBootVersionChange, watchForLiveUpdate } from './update-notifications.js';
import { initLocationLibrary } from './location-library.js';
import { migrateLegacyLocationStorage } from './location-storage-migration.js';
import { initRiflePrecisionLibrary } from './rifle-precision-library.js';
import * as homeView from './views/home-view.js';
import * as trajectoryView from './views/trajectory-view.js';
import * as bcToolsView from './views/bc-tools-view.js';
import * as cdMachCurveView from './views/cd-mach-curve-view.js';
import * as hitProbabilityView from './views/hit-probability-view.js';
import * as rangeSolverView from './views/range-solver-view.js';
import * as locationsView from './views/locations-view.js';
import * as locationPlacementView from './views/location-placement-view.js';
import * as riflePrecisionView from './views/rifle-precision-view.js';
import * as riflePrecisionMarkingView from './views/rifle-precision-marking-view.js';
import * as riflePrecisionAnalysisView from './views/rifle-precision-analysis-view.js';
import * as settingsView from './views/settings-view.js';
import * as manualView from './views/manual-view.js';
import * as thanksView from './views/thanks-view.js';
import * as releaseHistoryView from './views/release-history-view.js';
import * as categoryView from './views/category-view.js';
import * as gunsView from './views/guns-view.js';

const view = document.getElementById('view');

// Stamped on <html> before anything else mounts, so a forced choice
// (see display-mode-prefs.js) is in place for the very first paint —
// layout.css's own mobile-chrome rules key off these two classes to
// override its automatic viewport-based detection in either direction.
function applyDisplayModeClass(mode) {
  document.documentElement.classList.toggle('force-desktop', mode === 'desktop');
  document.documentElement.classList.toggle('force-mobile', mode === 'mobile');
}
applyDisplayModeClass(getDisplayMode());
onDisplayModeChange(applyDisplayModeClass);

// `range-solver-mode` gates layout.css's mobile-only topbar hiding (and
// reuses the existing mobile-chrome/landscape-vertical rail machinery for
// free) — Range Solver only.
onRangeSolverModeChange((on) => {
  document.documentElement.classList.toggle('range-solver-mode', on);
});

// `placement-mode` gates the full-screen photo takeover (topbar hidden,
// content fills the remaining space) location-placement-view.js needs —
// unlike range-solver-mode's own topbar-hiding above, this applies on
// desktop too: "the image occupies all screen estate, except the
// navigation bar" isn't a mobile-only requirement here.
onPlacementModeChange((on) => {
  document.documentElement.classList.toggle('placement-mode', on);
});

// Same full-screen-photo-takeover idea as placement-mode above, for the
// Rifle Precision Calculator's own marking workflow (see
// rifle-precision-nav.js / rifle-precision-marking-view.js).
onMarkingModeChange((on) => {
  document.documentElement.classList.toggle('rifle-precision-marking-mode', on);
});

// Theme (see base.css's .theme-dark/.theme-high-contrast-light/.theme-
// high-contrast-dark) is app-wide — applied from the very first paint, not
// just once some view mounts, and re-applied instantly on every Settings
// change via onThemeChange (see range-solver-prefs.js).
const THEME_CLASSES = ['theme-dark', 'theme-high-contrast-light', 'theme-high-contrast-dark'];
function applyThemeClass(nextTheme) {
  document.documentElement.classList.remove(...THEME_CLASSES);
  document.documentElement.classList.add('theme-' + nextTheme);
}
applyThemeClass(getTheme());
onThemeChange(applyThemeClass);

const views = {
  '/': homeView,
  '/trajectory': trajectoryView,
  '/bc-tools': bcToolsView,
  '/cd-mach-curve': cdMachCurveView,
  '/hit-probability': hitProbabilityView,
  '/range-solver': rangeSolverView,
  '/locations': locationsView,
  '/rifle-precision': riflePrecisionView,
  '/settings': settingsView,
  '/manual': manualView,
  '/thanks': thanksView,
  '/release-history': releaseHistoryView
};

// Every view calls t() while building its DOM, so translations must be
// loaded and i18next initialized before the very first mount — otherwise
// the first paint would flash untranslated keys. Locations & Targets' and
// Rifle Precision's in-memory mirrors must be populated the same way:
// their views read the library synchronously inside mount()'s top-level
// body (router.js calls mount() synchronously and expects an immediate
// return, not a Promise), so both mirrors have to be warm before
// startRouter() ever runs, not lazily per-mount.
//
// index.html's #app-boot overlay covers this whole stretch (module graph
// already loaded by the time this line runs, so what's left is the locale
// fetches, the two IndexedDB opens, and the legacy-storage migration) —
// removed the instant the first route mounts below, in `finally` so a
// failure here can't leave it stuck on screen forever instead of
// surfacing the actual error.
const bootStartedAt = performance.now();
logDiagnostic('log', `[boot] starting (${CACHE_VERSION}, ${RELEASE_ID})`);
try {
  await Promise.all([initI18n(), initLocationLibrary(), initRiflePrecisionLibrary()]);
  // One-time import of any pre-v2.9 localStorage location data left behind
  // by the IndexedDB migration — must run after initLocationLibrary() above,
  // since it needs the mirror populated for id-collision checks. See
  // location-storage-migration.js's own comment.
  await migrateLegacyLocationStorage();

  mountLanguageSwitcher(document.getElementById('app-lang'));
  mountDisplayModeSwitch(document.getElementById('app-display-mode'));
  // The rail (desktop) and tab bar (mobile, see layout.css's breakpoint)
  // both listen for hashchange/language-change themselves — mounted once,
  // never re-mounted by the router the way routed views are.
  mountNavRail(document.getElementById('app-rail'));
  mountNavTabbar(document.getElementById('app-tabbar'));
  mountTopbarScroll(document.getElementById('app-topbar'));
  mountDialogRoot(document.getElementById('app-dialog'));

  for (const [path, mod] of Object.entries(views)) {
    registerRoute(path, () => mod.mount(view));
  }
  // The two category hub pages share one view module, parameterized by
  // group id — see category-view.js.
  registerRoute('/measurement', () => categoryView.mount(view, 'measurement'));
  registerRoute('/analysis', () => categoryView.mount(view, 'analysis'));
  // Guns' two tabs (Custom/Arsenal) are the same pattern — one view module,
  // parameterized — see guns-view.js.
  registerRoute('/guns/custom', () => gunsView.mount(view, 'custom'));
  registerRoute('/guns/arsenal', () => gunsView.mount(view, 'arsenal'));
  registerRoute('/locations/place', () => locationPlacementView.mount(view));
  registerRoute('/rifle-precision/target', () => riflePrecisionMarkingView.mount(view));
  registerRoute('/rifle-precision/analysis', () => riflePrecisionAnalysisView.mount(view));

  startRouter('/');
  logDiagnostic('log', `[boot] app started at #${location.hash.slice(1) || '/'} (${Math.round(performance.now() - bootStartedAt)}ms)`);
} catch (err) {
  // Nothing in the awaited chain above should actually reject anymore
  // (initI18n/initLocationLibrary/initRiflePrecisionLibrary/
  // migrateLegacyLocationStorage are all deliberately written to degrade
  // instead) — this is a safety net so a regression there, or a genuine
  // bug in the synchronous mounting code below it, is at least visible
  // in the console instead of silently leaving a blank app behind the
  // boot splash.
  logDiagnostic('error', '[boot] app failed to start:', err);
} finally {
  document.getElementById('app-boot')?.remove();
}

// The language switcher lives in the header, so it can fire from any
// page — re-mount whichever view is currently showing so its labels
// update immediately instead of waiting for the next navigation.
onLanguageChange(rerender);

// "You opened a tab and it's now running a different version than last
// time" — see update-notifications.js. Independent of the service-worker
// block below: this fires once per fresh load, from a plain CACHE_VERSION
// comparison, nothing to do with SW lifecycle timing.
checkBootVersionChange();

// Best-effort request to be exempted from storage eviction (relevant on
// iOS Safari, which can clear IndexedDB/localStorage for origins that go
// unused for a while — this app's location/rifle-precision data lives
// there). Fire-and-forget: browsers that don't support it, or that just
// decline, leave nothing for the app to react to either way.
navigator.storage?.persist?.();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // type: 'module' so the service worker can `import` bullet-libraries.js
    // directly (same source of truth the app itself uses) instead of
    // needing every bullet's URL listed by hand.
    navigator.serviceWorker.register('./service-worker.js', { type: 'module' })
      // "An update just finished installing while you were sitting in
      // this tab" — see update-notifications.js's own watchForLiveUpdate().
      // Deliberately no auto-reload here anymore: restarting is the
      // user's own choice (that dialog says as much), not something this
      // app forces on them mid-session.
      .then((registration) => {
        logDiagnostic('log', `[boot] service worker registered (scope ${registration.scope})`);
        watchForLiveUpdate(registration);
      })
      .catch((err) => {
        // offline support is a nice-to-have, not load-bearing — swallow and
        // move on, but still surface it: a registration failure here means
        // this visit gets zero offline capability, worth knowing about.
        logDiagnostic('error', '[boot] service worker registration failed:', err);
      });
  });
}
