// The desktop navigation rail: Home, the two collapsible tool groups
// (Measurement/Analysis), then Guns and Settings pinned below. Has two
// widths — expanded (names + one-line descriptions) and collapsed
// (icons only, with a flyout reproducing the same list on demand) — see
// nav-prefs.js for what's persisted across reloads and what isn't.
//
// Every interactive bit here is a plain button/link with an explicit
// click handler, not native <details>/<summary> — this app's own click-
// driven convention (see checkbox/select handlers throughout src/ui/),
// and the only way this stays exercisable by the fake-DOM test harness,
// which has no native disclosure-widget behavior to fall back on.
//
// While Guns is open, the whole rail is replaced by Done + Custom/Arsenal
// (see buildGunsMode() below and guns-nav.js) — mirrored exactly on the
// mobile tab bar. Range Solver (see buildRangeSolverMode() below and
// range-solver-nav.js) is the same "focused mode" idea a second time, with
// its own Target/Wind/Atmosphere/Gun/Exit-solver control instead.
import { el, clear } from '../dom.js';
import { t, onLanguageChange } from '../i18n.js';
import { GROUPS, PINNED, toolsInGroup } from '../nav-tools.js';
import { isRailCollapsed, setRailCollapsed, isGroupOpen, setGroupOpen } from '../nav-prefs.js';
import { isInGunsMode, onGunsModeChange, takeGunsReturnPath, resolveGunsDestination, goToGuns } from '../guns-nav.js';
import {
  isInRangeSolverMode, onRangeSolverModeChange,
  getRangeSolverTab, onRangeSolverTabChange, setRangeSolverTab
} from '../range-solver-nav.js';
import { statusChip } from './status-chip.js';
import {
  homeIcon, measurementIcon, analysisIcon, arsenalIcon, gunsIcon, editIcon, checkIcon,
  settingsIcon, manualIcon, chevronIcon, collapseIcon, targetIcon, windIcon, atmosphereIcon, exitIcon
} from './nav-icons.js';

const GROUP_ICON = { measurement: measurementIcon, analysis: analysisIcon };
// Guns isn't looked up here — its icon is used directly by
// gunsPinnedLink()/collapsedGunsLink() below, which build its whole link
// differently (source-aware routing) rather than going through the
// generic pinnedLink()/collapsedIconLink() this map serves.
const PINNED_ICON = { settings: settingsIcon, manual: manualIcon };

function currentPath() {
  const hash = location.hash || '';
  return hash.slice(1) || '/';
}

export function mountNavRail(container) {
  // Which collapsed-rail flyout (if any) is open — ephemeral, not
  // persisted like the expanded rail's own group open/closed state:
  // navigating or switching language closes it, same as clicking away.
  let openFlyoutGroupId = null;

  function render() {
    clear(container);
    if (isInGunsMode()) {
      container.className = 'app-rail guns-mode';
      container.appendChild(buildGunsMode());
      return;
    }
    if (isInRangeSolverMode()) {
      container.className = 'app-rail range-solver-mode';
      container.appendChild(buildRangeSolverMode());
      return;
    }
    const collapsed = isRailCollapsed();
    container.className = 'app-rail' + (collapsed ? ' collapsed' : '');
    container.appendChild(collapsed ? buildCollapsed() : buildExpanded());
  }

  // Replaces the whole rail while Guns is open (see guns-nav.js) — the
  // rest of the app's nav (Home, other tools) is reached again only after
  // Done, the same "focused mode" both platforms share (see
  // nav-tabbar.js's own guns-mode build).
  function buildGunsMode() {
    const path = currentPath();
    const doneBtn = el('button', { type: 'button', class: 'done-btn' }, [checkIcon(13), el('span', { i18n: 'guns.doneButton' })]);
    doneBtn.addEventListener('click', () => {
      location.hash = '#' + takeGunsReturnPath('/trajectory');
    });
    const customLink = el('a', {
      href: '#/guns/custom',
      class: 'guns-tab' + (path === '/guns/custom' ? ' active' : '')
    }, [editIcon(13), el('span', { i18n: 'guns.customTab' })]);
    const arsenalLink = el('a', {
      href: '#/guns/arsenal',
      class: 'guns-tab' + (path === '/guns/arsenal' ? ' active' : '')
    }, [arsenalIcon(13), el('span', { i18n: 'guns.arsenalTab' })]);
    return el('nav', { class: 'rail-inner rail-guns-mode' }, [doneBtn, customLink, arsenalLink]);
  }

  // Replaces the whole rail while Range Solver is open (see range-solver-
  // nav.js) — Target/Wind/Atmosphere are in-place input-pane tabs (not
  // routes), so they call setRangeSolverTab() rather than changing
  // location.hash; Gun reuses the exact same source-aware routing as the
  // pinned Guns link above; Exit solver always returns to Home (no return-
  // path tracking — unlike Guns' Done, Range Solver doesn't remember where
  // it was opened from).
  function buildRangeSolverMode() {
    const active = getRangeSolverTab();
    const tabButton = (tab, iconFn, labelKey) => {
      const btn = el('button', {
        type: 'button',
        class: 'guns-tab' + (tab === active ? ' active' : '')
      }, [iconFn(13), el('span', { i18n: labelKey })]);
      btn.addEventListener('click', () => setRangeSolverTab(tab));
      return btn;
    };
    const gunLink = el('a', { href: '#' + resolveGunsDestination(), class: 'guns-tab' }, [gunsIcon(13), el('span', { i18n: 'nav.guns' })]);
    gunLink.addEventListener('click', (e) => {
      e.preventDefault();
      goToGuns();
    });
    const exitBtn = el('button', { type: 'button', class: 'done-btn' }, [exitIcon(13), el('span', { i18n: 'rangeSolver.exitSolver' })]);
    exitBtn.addEventListener('click', () => {
      location.hash = '#/';
    });
    return el('nav', { class: 'rail-inner rail-range-solver-mode' }, [
      tabButton('target', targetIcon, 'rangeSolver.navTarget'),
      tabButton('wind', windIcon, 'rangeSolver.navWind'),
      tabButton('atmosphere', atmosphereIcon, 'rangeSolver.navAtmosphere'),
      gunLink,
      exitBtn
    ]);
  }

  function pinnedLink(path, nameKey, iconFn, currentP) {
    return el('a', {
      href: '#' + path,
      class: 'rail-item' + (currentP === path ? ' current' : '')
    }, [iconFn(16), el('span', { text: t(nameKey) })]);
  }

  // Guns is the one pinned entry that doesn't go to a fixed path — same
  // source-aware routing as the "Change" button on a rifle summary (see
  // guns-nav.js's resolveGunsDestination/goToGuns): Custom or Arsenal,
  // whichever matches the currently active rifle, recording wherever this
  // was clicked from so Done comes back here. The href is still a real
  // (best-effort) link for hover/right-click; the click handler
  // recomputes and wins so it's never stale between renders.
  function gunsPinnedLink(currentP) {
    const link = el('a', {
      href: '#' + resolveGunsDestination(),
      class: 'rail-item' + (currentP.startsWith('/guns/') ? ' current' : '')
    }, [gunsIcon(16), el('span', { text: t('nav.guns') })]);
    link.addEventListener('click', (e) => {
      e.preventDefault();
      goToGuns();
    });
    return link;
  }

  function toolRow(tool) {
    return el('div', { class: 'row' }, [
      el('span', { class: 'name', text: t(tool.nameKey) }),
      statusChip(tool.status)
    ]);
  }

  function toolItem(tool, currentP) {
    const inner = [toolRow(tool), el('div', { class: 'desc', text: t(tool.descKey) })];
    if (tool.path) {
      return el('a', {
        href: '#' + tool.path,
        class: 'rail-tool' + (currentP === tool.path ? ' active' : '')
      }, inner);
    }
    return el('div', { class: 'rail-tool disabled', 'aria-disabled': 'true' }, inner);
  }

  function flyoutItem(tool, currentP) {
    const inner = [toolRow(tool), el('div', { class: 'desc', text: t(tool.descKey) })];
    if (tool.path) {
      return el('a', {
        href: '#' + tool.path,
        class: 'flyout-item' + (currentP === tool.path ? ' active' : '')
      }, inner);
    }
    return el('div', { class: 'flyout-item disabled', 'aria-disabled': 'true' }, inner);
  }

  function collapseControl(collapsed) {
    const btn = el('button', {
      type: 'button',
      id: 'rail-collapse-toggle',
      class: 'rail-collapse-btn',
      title: t(collapsed ? 'nav.expandRail' : 'nav.collapseRail')
    }, [
      collapseIcon(15, collapsed),
      collapsed ? null : el('span', { i18n: 'nav.collapseRail' })
    ]);
    btn.addEventListener('click', () => {
      setRailCollapsed(!collapsed);
      openFlyoutGroupId = null;
      render();
    });
    return el('div', { class: 'rail-bottom' }, [btn]);
  }

  // ---- expanded ----

  function groupAccordion(group, currentP) {
    const open = isGroupOpen(group.id);
    const summary = el('button', {
      type: 'button',
      class: 'rail-group-summary',
      'aria-expanded': String(open)
    }, [
      GROUP_ICON[group.id](14),
      el('span', { text: t(group.nameKey) }),
      el('span', { class: 'chev' + (open ? ' open' : '') }, [chevronIcon(9)])
    ]);
    summary.addEventListener('click', () => {
      setGroupOpen(group.id, !open);
      render();
    });

    const wrapper = el('div', { class: `rail-group ${group.id}` + (open ? ' open' : '') }, [summary]);
    if (open) {
      const sub = el('div', { class: 'rail-sub' });
      for (const tool of toolsInGroup(group.id)) sub.appendChild(toolItem(tool, currentP));
      wrapper.appendChild(sub);
    }
    return wrapper;
  }

  function buildExpanded() {
    const path = currentPath();
    const inner = el('nav', { class: 'rail-inner' });
    inner.appendChild(pinnedLink('/', 'nav.home', homeIcon, path));
    for (const group of Object.values(GROUPS)) inner.appendChild(groupAccordion(group, path));
    for (const p of PINNED) inner.appendChild(p.id === 'guns' ? gunsPinnedLink(path) : pinnedLink(p.path, p.nameKey, PINNED_ICON[p.icon], path));
    inner.appendChild(collapseControl(false));
    return inner;
  }

  // ---- collapsed ----

  function collapsedIconLink(path, nameKey, iconFn, currentP) {
    return el('a', {
      href: '#' + path,
      class: 'rail-c-item' + (currentP === path ? ' current' : ''),
      title: t(nameKey)
    }, [iconFn(18)]);
  }

  // Collapsed-rail counterpart of gunsPinnedLink() above — same
  // source-aware routing, icon-only.
  function collapsedGunsLink(currentP) {
    const link = el('a', {
      href: '#' + resolveGunsDestination(),
      class: 'rail-c-item' + (currentP.startsWith('/guns/') ? ' current' : ''),
      title: t('nav.guns')
    }, [gunsIcon(18)]);
    link.addEventListener('click', (e) => {
      e.preventDefault();
      goToGuns();
    });
    return link;
  }

  function collapsedGroupItem(group, currentP) {
    const isOpen = openFlyoutGroupId === group.id;
    const groupHasActive = toolsInGroup(group.id).some((tool) => tool.path === currentP);
    const btn = el('button', {
      type: 'button',
      class: `rail-c-item ${group.id}` + (groupHasActive ? ' current' : '') + (isOpen ? ' group-open' : ''),
      title: t(group.nameKey),
      'aria-expanded': String(isOpen)
    }, [GROUP_ICON[group.id](18)]);
    btn.addEventListener('click', () => {
      openFlyoutGroupId = isOpen ? null : group.id;
      render();
    });

    const wrapper = el('div', { class: 'rail-c-group-wrap' }, [btn]);
    if (isOpen) {
      const flyout = el('div', { class: 'flyout' }, [el('div', { class: 'flyout-head', text: t(group.nameKey) })]);
      for (const tool of toolsInGroup(group.id)) flyout.appendChild(flyoutItem(tool, currentP));
      wrapper.appendChild(flyout);
    }
    return wrapper;
  }

  function buildCollapsed() {
    const path = currentPath();
    const inner = el('nav', { class: 'rail-inner-c' });
    inner.appendChild(collapsedIconLink('/', 'nav.home', homeIcon, path));
    for (const group of Object.values(GROUPS)) inner.appendChild(collapsedGroupItem(group, path));
    for (const p of PINNED) inner.appendChild(p.id === 'guns' ? collapsedGunsLink(path) : collapsedIconLink(p.path, p.nameKey, PINNED_ICON[p.icon], path));
    inner.appendChild(collapseControl(true));
    return inner;
  }

  render();
  onLanguageChange(render);
  onGunsModeChange(render);
  onRangeSolverModeChange(render);
  onRangeSolverTabChange(render);
  window.addEventListener('hashchange', render);
  return { render };
}
