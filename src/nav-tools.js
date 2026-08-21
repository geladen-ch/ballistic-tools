// Single source of truth for the app's navigation taxonomy — the rail,
// the mobile tab bar, the two category hub pages (measurement-view.js/
// analysis-view.js render through category-view.js) and the Home
// dashboard all read from this instead of each keeping their own list, so
// adding a tool (or wiring one up once it's built) means editing exactly
// one array.
//
// `path` is the tool's real route (registered in app.js) — null for a
// tool that doesn't exist yet. `status` drives the Live/Partial/Planned
// indicator (src/ui/status-chip.js): a null path always means 'planned'
// (there's nothing to link to yet); a real path is 'live' unless listed
// in PARTIAL_IDS below.
const PARTIAL_IDS = new Set(['hit-probability']);

// Tools kept in TOOL_DEFS (definition, locale keys, status all intact) but
// excluded from toolsInGroup()'s results — so every listing surface (Home,
// the category hub pages, both nav-rail layouts) stops showing the card
// without deleting the tool itself.
const HIDDEN_IDS = new Set(['range-card']);

export const GROUPS = {
  analysis: {
    id: 'analysis',
    path: '/analysis',
    nameKey: 'catalog.groupAnalysis',
    descKey: 'catalog.groupAnalysisDesc'
  },
  measurement: {
    id: 'measurement',
    path: '/measurement',
    nameKey: 'catalog.groupMeasurement',
    descKey: 'catalog.groupMeasurementDesc'
  }
};

const TOOL_DEFS = [
  { id: 'trajectory', group: 'analysis', path: '/trajectory', nameKey: 'nav.trajectory', descKey: 'home.trajectoryDesc' },
  { id: 'hit-probability', group: 'analysis', path: '/hit-probability', nameKey: 'nav.hitProbability', descKey: 'home.hitProbDesc' },
  { id: 'range-card', group: 'analysis', path: null, nameKey: 'catalog.rangeCard', descKey: 'catalog.rangeCardDesc' },
  { id: 'range-solver', group: 'analysis', path: '/range-solver', nameKey: 'catalog.rangeSolver', descKey: 'catalog.rangeSolverDesc' },

  { id: 'bc-tools', group: 'measurement', path: '/bc-tools', nameKey: 'catalog.bcTools', descKey: 'catalog.bcToolsDesc' },
  { id: 'cd-mach-curve', group: 'measurement', path: '/cd-mach-curve', nameKey: 'catalog.cdMachCurve', descKey: 'catalog.cdMachCurveDesc' },
  { id: 'group-size-photo', group: 'measurement', path: null, nameKey: 'catalog.groupSizePhoto', descKey: 'catalog.groupSizePhotoDesc' }
];

export const TOOLS = TOOL_DEFS.map((tool) => ({
  ...tool,
  status: tool.path == null ? 'planned' : (PARTIAL_IDS.has(tool.id) ? 'partial' : 'live')
}));

export function toolsInGroup(groupId) {
  return TOOLS.filter((tool) => tool.group === groupId && !HIDDEN_IDS.has(tool.id));
}

// Utilities that sit outside both groups — every tool reads from the
// active gun configuration (Guns) or governs the whole app (Settings), so
// neither belongs filed under one category. Guns' own `path` here is only
// a fallback (used for its "current" highlighting and as a static href
// before JS takes over) — every actual click routes through
// guns-nav.js's resolveGunsDestination/goToGuns instead, landing on
// whichever sub-tab (Custom or Arsenal) matches the active rifle, same as
// the "Change" button on a rifle summary (see guns-summary.js).
export const PINNED = [
  { id: 'guns', path: '/guns/custom', nameKey: 'nav.guns', descKey: 'home.gunsDesc', icon: 'guns' },
  { id: 'settings', path: '/settings', nameKey: 'nav.settings', icon: 'settings' },
  { id: 'manual', path: '/manual', nameKey: 'nav.manual', icon: 'manual' }
];
