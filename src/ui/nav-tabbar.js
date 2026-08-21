// Mobile bottom tab bar — the rail's five pinned destinations (Home,
// Analysis, Measurement, Guns, Settings), shown instead of the rail below
// the layout.css breakpoint. Measurement/Analysis link to their category
// hub page (src/views/category-view.js) rather than straight to a tool —
// the same "one predictable extra tap" rule the rail's own collapsed
// flyout uses to avoid guessing which tool someone wants.
//
// While Guns is open, this whole bar is replaced by Custom/Arsenal/Done
// (see guns-nav.js) — a focused mode mirrored exactly on the desktop rail.
// Range Solver (see range-solver-nav.js) is the same idea a second time,
// with its own Target/Wind/Atmosphere/Gun/Exit-solver control instead.
import { el, clear } from '../dom.js';
import { t, onLanguageChange } from '../i18n.js';
import { GROUPS } from '../nav-tools.js';
import { isInGunsMode, onGunsModeChange, takeGunsReturnPath, resolveGunsDestination, goToGuns } from '../guns-nav.js';
import {
  isInRangeSolverMode, onRangeSolverModeChange,
  getRangeSolverTab, onRangeSolverTabChange, setRangeSolverTab
} from '../range-solver-nav.js';
import { isInLocationsMode, onLocationsModeChange } from '../locations-nav.js';
import {
  isInPlacementMode, onPlacementModeChange, requestZoomIn, requestZoomOut, requestDone
} from '../location-placement-nav.js';
import {
  homeIcon, measurementIcon, analysisIcon, arsenalIcon, gunsIcon, editIcon, checkIcon, settingsIcon,
  targetIcon, windIcon, atmosphereIcon, exitIcon, zoomInIcon, zoomOutIcon
} from './nav-icons.js';

// Guns has no fixed path of its own here — see the render loop below,
// which gives it source-aware routing (resolveGunsDestination/goToGuns
// in guns-nav.js) instead of the plain href/hash every other tab uses.
const TABS = [
  { id: 'home', path: '/', nameKey: 'nav.home', icon: homeIcon },
  { id: 'analysis', path: GROUPS.analysis.path, nameKey: GROUPS.analysis.nameKey, icon: analysisIcon, hue: 'analysis' },
  { id: 'measurement', path: GROUPS.measurement.path, nameKey: GROUPS.measurement.nameKey, icon: measurementIcon, hue: 'measurement' },
  { id: 'guns', path: '/guns/custom', nameKey: 'nav.guns', icon: gunsIcon },
  { id: 'settings', path: '/settings', nameKey: 'nav.settings', icon: settingsIcon }
];

function currentPath() {
  const hash = location.hash || '';
  return hash.slice(1) || '/';
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
    if (isInLocationsMode()) {
      container.className = 'app-tabbar locations-mode';
      for (const item of buildLocationsModeItems()) container.appendChild(item);
      return;
    }
    container.className = 'app-tabbar';
    const path = currentPath();
    for (const tab of TABS) {
      const isGuns = tab.id === 'guns';
      const hueClass = tab.hue ? ` tab-item-${tab.hue}` : '';
      const active = isGuns ? path.startsWith('/guns/') : path === tab.path;
      const link = el('a', {
        href: '#' + (isGuns ? resolveGunsDestination() : tab.path),
        class: 'tab-item' + hueClass + (active ? ' active' : '')
      }, [tab.icon(19), el('span', { text: t(tab.nameKey) })]);
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
    }, [editIcon(19), el('span', { text: t('guns.customTab') })]);
    const arsenalLink = el('a', {
      href: '#/guns/arsenal',
      class: 'tab-item' + (path === '/guns/arsenal' ? ' active' : '')
    }, [arsenalIcon(19), el('span', { text: t('guns.arsenalTab') })]);
    const doneBtn = el('button', { type: 'button', class: 'tab-item' }, [checkIcon(19), el('span', { text: t('guns.doneButton') })]);
    doneBtn.addEventListener('click', () => {
      location.hash = '#' + takeGunsReturnPath('/trajectory');
    });
    return [customLink, arsenalLink, doneBtn];
  }

  // Replaces the whole tab bar while Range Solver is open — see
  // nav-rail.js's own buildRangeSolverMode() for the desktop equivalent.
  // Target/Wind/Atmosphere are in-place input-pane tabs (setRangeSolverTab),
  // not routes; Gun reuses the same source-aware routing as every other
  // "go to Guns" entry point; Exit solver always returns to Home.
  function buildRangeSolverModeItems() {
    const active = getRangeSolverTab();
    const tabItem = (tab, iconFn, nameKey) => {
      const btn = el('button', {
        type: 'button', class: 'tab-item' + (tab === active ? ' active' : '')
      }, [iconFn(19), el('span', { text: t(nameKey) })]);
      btn.addEventListener('click', () => setRangeSolverTab(tab));
      return btn;
    };
    const gunLink = el('a', { href: '#' + resolveGunsDestination(), class: 'tab-item' }, [gunsIcon(19), el('span', { text: t('nav.guns') })]);
    gunLink.addEventListener('click', (e) => {
      e.preventDefault();
      goToGuns();
    });
    const exitBtn = el('button', { type: 'button', class: 'tab-item' }, [exitIcon(19), el('span', { text: t('rangeSolver.exitSolver') })]);
    exitBtn.addEventListener('click', () => {
      location.hash = '#/';
    });
    return [
      tabItem('target', targetIcon, 'rangeSolver.navTarget'),
      tabItem('wind', windIcon, 'rangeSolver.navWind'),
      tabItem('atmosphere', atmosphereIcon, 'rangeSolver.navAtmosphere'),
      gunLink,
      exitBtn
    ];
  }

  // Replaces the whole tab bar while Locations management is open — see
  // nav-rail.js's own buildLocationsMode() for the desktop equivalent.
  function buildLocationsModeItems() {
    const doneBtn = el('button', { type: 'button', class: 'tab-item' }, [checkIcon(19), el('span', { text: t('guns.doneButton') })]);
    doneBtn.addEventListener('click', () => { location.hash = '#/range-solver'; });
    return [doneBtn];
  }

  // Replaces the whole tab bar while the full-screen placement/picker
  // route is open — see nav-rail.js's own buildPlacementMode().
  function buildPlacementModeItems() {
    const zoomInBtn = el('button', { type: 'button', class: 'tab-item' }, [zoomInIcon(19), el('span', { text: t('rangeSolverLocations.zoomInButton') })]);
    zoomInBtn.addEventListener('click', () => requestZoomIn());
    const zoomOutBtn = el('button', { type: 'button', class: 'tab-item' }, [zoomOutIcon(19), el('span', { text: t('rangeSolverLocations.zoomOutButton') })]);
    zoomOutBtn.addEventListener('click', () => requestZoomOut());
    const doneBtn = el('button', { type: 'button', class: 'tab-item' }, [checkIcon(19), el('span', { text: t('guns.doneButton') })]);
    doneBtn.addEventListener('click', () => requestDone());
    return [zoomInBtn, zoomOutBtn, doneBtn];
  }

  render();
  onLanguageChange(render);
  onGunsModeChange(render);
  onRangeSolverModeChange(render);
  onRangeSolverTabChange(render);
  onLocationsModeChange(render);
  onPlacementModeChange(render);
  window.addEventListener('hashchange', render);
  return { render };
}
