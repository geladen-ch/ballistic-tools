// Mobile bottom tab bar — six destinations shown instead of the rail
// below the layout.css breakpoint: Home and Settings icon-only at the
// edges (universally recognizable glyphs, and pulled out of the equal
// flex split so shrinking them hands their width to the other four —
// see .tab-item-compact in layout.css), Analysis/Measurement/Range
// Solver/Guns labeled in between. Measurement/Analysis link to their
// category hub page (src/views/category-view.js) rather than straight to
// a tool — the same "one predictable extra tap" rule the rail's own
// collapsed flyout uses to avoid guessing which tool someone wants.
// Range Solver links straight to its one tool, not a hub page (see
// nav-tools.js's own GROUPS.shooting — it used to be filed under
// Analysis before crowding both that group and, in this bar's own case,
// the available width, earned it a direct top-level entry; unlike
// Analysis/Measurement it has exactly one tool, so there's no hub page
// to send it to instead).
//
// While Guns is open, this whole bar is replaced by Custom/Arsenal/Done
// (see guns-nav.js) — a focused mode mirrored exactly on the desktop rail.
// Range Solver's own in-tool nav (see range-solver-nav.js) is the same
// idea a second time, with its own Target/Atmosphere/Gun/Exit-solver
// control instead (Wind lives on the Target tab itself now, not a
// separate tab of its own) — not to be confused with the plain link to
// it above.
import { el, clear } from '../dom.js';
import { t, getLanguage, onLanguageChange } from '../i18n.js';
import { GROUPS } from '../nav-tools.js';
import { isInGunsMode, onGunsModeChange, requestGunsDone, resolveGunsDestination, goToGuns } from '../guns-nav.js';
import {
  isInRangeSolverMode, onRangeSolverModeChange,
  getRangeSolverTab, onRangeSolverTabChange, setRangeSolverTab
} from '../range-solver-nav.js';
import { isInLocationsMode, onLocationsModeChange } from '../locations-nav.js';
import {
  isInPlacementMode, onPlacementModeChange, requestZoomIn, requestZoomOut, requestDone
} from '../location-placement-nav.js';
import {
  isInMarkingMode, onMarkingModeChange,
  requestZoomIn as requestMarkingZoomIn, requestZoomOut as requestMarkingZoomOut, requestDone as requestMarkingDone
} from '../rifle-precision-nav.js';
import {
  homeIcon, measurementIcon, analysisIcon, arsenalIcon, gunsIcon, editIcon, checkIcon, settingsIcon,
  targetIcon, rangeCardIcon, atmosphereIcon, exitIcon, zoomInIcon, zoomOutIcon
} from './nav-icons.js';

// Guns has no fixed path of its own here — see the render loop below,
// which gives it source-aware routing (resolveGunsDestination/goToGuns
// in guns-nav.js) instead of the plain href/hash every other tab uses.
// `compact: true` (Home/Settings) renders icon-only, smaller, with no
// visible label — see render() below.
const TABS = [
  { id: 'home', path: '/', nameKey: 'nav.home', icon: homeIcon, compact: true },
  { id: 'analysis', path: GROUPS.analysis.path, nameKey: GROUPS.analysis.nameKey, icon: analysisIcon, hue: 'analysis' },
  { id: 'measurement', path: GROUPS.measurement.path, nameKey: GROUPS.measurement.nameKey, icon: measurementIcon, hue: 'measurement' },
  { id: 'range-solver', path: GROUPS.shooting.path, nameKey: GROUPS.shooting.nameKey, icon: targetIcon },
  { id: 'guns', path: '/guns/custom', nameKey: 'nav.guns', icon: gunsIcon },
  { id: 'settings', path: '/settings', nameKey: 'nav.settings', icon: settingsIcon, compact: true }
];

function currentPath() {
  const hash = location.hash || '';
  return hash.slice(1) || '/';
}

// Every tab-bar label, across every mode this file builds (default 6-tab
// row, Guns/Range-Solver/Locations/Placement's own focused-mode rows)
// carries the current language as a `lang` attribute — CSS's
// `hyphens: auto` (see .tab-item span in layout.css) uses it to pick a
// real hyphenation dictionary, so a label that has to wrap breaks at an
// actual syllable boundary instead of wherever overflow-wrap: break-word
// happens to land.
function labelSpan(text) {
  return el('span', { text, lang: getLanguage() });
}

export function mountNavTabbar(container) {
  function render() {
    clear(container);
    if (isInGunsMode()) {
      container.className = 'app-tabbar guns-mode';
      for (const item of buildGunsModeItems()) container.appendChild(item);
      return;
    }
    if (isInRangeSolverMode()) {
      container.className = 'app-tabbar range-solver-mode';
      for (const item of buildRangeSolverModeItems()) container.appendChild(item);
      return;
    }
    if (isInPlacementMode()) {
      container.className = 'app-tabbar placement-mode';
      for (const item of buildPlacementModeItems()) container.appendChild(item);
      return;
    }
    if (isInMarkingMode()) {
      container.className = 'app-tabbar rp-marking-mode';
      for (const item of buildMarkingModeItems()) container.appendChild(item);
      return;
    }
    if (isInLocationsMode()) {
      container.className = 'app-tabbar locations-mode';
      for (const item of buildLocationsModeItems()) container.appendChild(item);
      return;
    }
    container.className = 'app-tabbar';
    const path = currentPath();
    for (const tab of TABS) {
      const isGuns = tab.id === 'guns';
      const active = isGuns ? path.startsWith('/guns/') : path === tab.path;
      const href = '#' + (isGuns ? resolveGunsDestination() : tab.path);
      let link;
      if (tab.compact) {
        // Icon-only, no visible label — accessible name moves to
        // aria-label/title instead. See .tab-item-compact in layout.css
        // for the smaller icon + reduced footprint this buys the other
        // four tabs.
        const name = t(tab.nameKey);
        link = el('a', {
          href, class: 'tab-item-compact' + (active ? ' active' : ''), 'aria-label': name, title: name
        }, [tab.icon(14)]);
      } else {
        const hueClass = tab.hue ? ` tab-item-${tab.hue}` : '';
        link = el('a', {
          href, class: 'tab-item' + hueClass + (active ? ' active' : '')
        }, [tab.icon(17), labelSpan(t(tab.nameKey))]);
      }
      if (isGuns) {
        link.addEventListener('click', (e) => {
          e.preventDefault();
          goToGuns();
        });
      }
      container.appendChild(link);
    }
  }

  // Replaces the whole tab bar while Guns is open — see nav-rail.js's own
  // buildGunsMode() for the desktop equivalent of this exact same idea.
  function buildGunsModeItems() {
    const path = currentPath();
    const customLink = el('a', {
      href: '#/guns/custom',
      class: 'tab-item' + (path === '/guns/custom' ? ' active' : '')
    }, [editIcon(19), labelSpan(t('guns.customTab'))]);
    const arsenalLink = el('a', {
      href: '#/guns/arsenal',
      class: 'tab-item' + (path === '/guns/arsenal' ? ' active' : '')
    }, [arsenalIcon(19), labelSpan(t('guns.arsenalTab'))]);
    const doneBtn = el('button', { type: 'button', class: 'tab-item' }, [checkIcon(19), labelSpan(t('guns.doneButton'))]);
    doneBtn.addEventListener('click', () => {
      requestGunsDone('/trajectory');
    });
    return [customLink, arsenalLink, doneBtn];
  }

  // Replaces the whole tab bar while Range Solver is open — see
  // nav-rail.js's own buildRangeSolverMode() for the desktop equivalent.
  // Target/Atmosphere are in-place input-pane tabs (setRangeSolverTab),
  // not routes; Gun reuses the same source-aware routing as every other
  // "go to Guns" entry point; Exit solver always returns to Home.
  function buildRangeSolverModeItems() {
    const active = getRangeSolverTab();
    const tabItem = (tab, iconFn, nameKey) => {
      const btn = el('button', {
        type: 'button', class: 'tab-item' + (tab === active ? ' active' : '')
      }, [iconFn(19), labelSpan(t(nameKey))]);
      btn.addEventListener('click', () => setRangeSolverTab(tab));
      return btn;
    };
    const gunLink = el('a', { href: '#' + resolveGunsDestination(), class: 'tab-item' }, [gunsIcon(19), labelSpan(t('nav.guns'))]);
    gunLink.addEventListener('click', (e) => {
      e.preventDefault();
      goToGuns();
    });
    const exitBtn = el('button', { type: 'button', class: 'tab-item' }, [exitIcon(19), labelSpan(t('rangeSolver.exitSolver'))]);
    exitBtn.addEventListener('click', () => {
      location.hash = '#/';
    });
    return [
      tabItem('target', targetIcon, 'rangeSolver.navTarget'),
      tabItem('rangeCard', rangeCardIcon, 'rangeSolver.navRangeCard'),
      tabItem('atmosphere', atmosphereIcon, 'rangeSolver.navAtmosphere'),
      gunLink,
      exitBtn
    ];
  }

  // Replaces the whole tab bar while Locations management is open — see
  // nav-rail.js's own buildLocationsMode() for the desktop equivalent.
  function buildLocationsModeItems() {
    const doneBtn = el('button', { type: 'button', class: 'tab-item' }, [checkIcon(19), labelSpan(t('guns.doneButton'))]);
    doneBtn.addEventListener('click', () => { location.hash = '#/range-solver'; });
    return [doneBtn];
  }

  // Replaces the whole tab bar while the full-screen placement/picker
  // route is open — see nav-rail.js's own buildPlacementMode().
  function buildPlacementModeItems() {
    const zoomInBtn = el('button', { type: 'button', class: 'tab-item' }, [zoomInIcon(19), labelSpan(t('rangeSolverLocations.zoomInButton'))]);
    zoomInBtn.addEventListener('click', () => requestZoomIn());
    const zoomOutBtn = el('button', { type: 'button', class: 'tab-item' }, [zoomOutIcon(19), labelSpan(t('rangeSolverLocations.zoomOutButton'))]);
    zoomOutBtn.addEventListener('click', () => requestZoomOut());
    const doneBtn = el('button', { type: 'button', class: 'tab-item' }, [checkIcon(19), labelSpan(t('guns.doneButton'))]);
    doneBtn.addEventListener('click', () => requestDone());
    return [zoomInBtn, zoomOutBtn, doneBtn];
  }

  // Replaces the whole tab bar while the Rifle Precision Calculator's own
  // full-screen marking route is open — see nav-rail.js's own
  // buildMarkingMode() for the desktop equivalent of this exact same idea.
  function buildMarkingModeItems() {
    const zoomInBtn = el('button', { type: 'button', class: 'tab-item' }, [zoomInIcon(19), labelSpan(t('rangeSolverLocations.zoomInButton'))]);
    zoomInBtn.addEventListener('click', () => requestMarkingZoomIn());
    const zoomOutBtn = el('button', { type: 'button', class: 'tab-item' }, [zoomOutIcon(19), labelSpan(t('rangeSolverLocations.zoomOutButton'))]);
    zoomOutBtn.addEventListener('click', () => requestMarkingZoomOut());
    const doneBtn = el('button', { type: 'button', class: 'tab-item' }, [checkIcon(19), labelSpan(t('guns.doneButton'))]);
    doneBtn.addEventListener('click', () => requestMarkingDone());
    return [zoomInBtn, zoomOutBtn, doneBtn];
  }

  render();
  onLanguageChange(render);
  onGunsModeChange(render);
  onRangeSolverModeChange(render);
  onRangeSolverTabChange(render);
  onLocationsModeChange(render);
  onPlacementModeChange(render);
  onMarkingModeChange(render);
  window.addEventListener('hashchange', render);
  return { render };
}
