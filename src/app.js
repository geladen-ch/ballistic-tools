import { registerRoute, startRouter, rerender } from './router.js';
import { initI18n, onLanguageChange } from './i18n.js';
import { mountLanguageSwitcher } from './ui/language-switcher.js';
import { mountDisplayModeSwitch } from './ui/display-mode-switch.js';
import { getDisplayMode, onDisplayModeChange } from './display-mode-prefs.js';
import { onRangeSolverModeChange } from './range-solver-nav.js';
import { getTheme, onThemeChange } from './range-solver-prefs.js';
import { mountNavRail } from './ui/nav-rail.js';
import { mountNavTabbar } from './ui/nav-tabbar.js';
import { mountTopbarScroll } from './ui/topbar-scroll.js';
import { mountDialogRoot } from './ui/app-dialog.js';
import { checkBootVersionChange, watchForLiveUpdate } from './update-notifications.js';
import * as homeView from './views/home-view.js';
import * as trajectoryView from './views/trajectory-view.js';
import * as bcToolsView from './views/bc-tools-view.js';
import * as cdMachCurveView from './views/cd-mach-curve-view.js';
import * as hitProbabilityView from './views/hit-probability-view.js';
import * as rangeSolverView from './views/range-solver-view.js';
import * as settingsView from './views/settings-view.js';
import * as manualView from './views/manual-view.js';
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
  '/settings': settingsView,
  '/manual': manualView,
  '/release-history': releaseHistoryView
};

// Every view calls t() while building its DOM, so translations must be
// loaded and i18next initialized before the very first mount — otherwise
// the first paint would flash untranslated keys.
await initI18n();

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

startRouter('/');

// The language switcher lives in the header, so it can fire from any
// page — re-mount whichever view is currently showing so its labels
// update immediately instead of waiting for the next navigation.
onLanguageChange(rerender);

// "You opened a tab and it's now running a different version than last
// time" — see update-notifications.js. Independent of the service-worker
// block below: this fires once per fresh load, from a plain CACHE_VERSION
// comparison, nothing to do with SW lifecycle timing.
checkBootVersionChange();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // type: 'module' so the service worker can `import` bullet-catalog.js
    // directly (same source of truth the app itself uses) instead of
    // needing every bullet's URL listed by hand.
    navigator.serviceWorker.register('./service-worker.js', { type: 'module' })
      // "An update just finished installing while you were sitting in
      // this tab" — see update-notifications.js's own watchForLiveUpdate().
      // Deliberately no auto-reload here anymore: restarting is the
      // user's own choice (that dialog says as much), not something this
      // app forces on them mid-session.
      .then((registration) => watchForLiveUpdate(registration))
      .catch(() => {
        // offline support is a nice-to-have, not load-bearing — swallow and move on
      });
  });
}
