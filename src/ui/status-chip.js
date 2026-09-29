import { el } from '../dom.js';
import { t } from '../i18n.js';

// A tool's Planned indicator — one shared component so the rail, the
// category hub pages and Home all render the exact same shape for the
// exact same status. Live and partial tools show no chip at all (only a
// tool with no route yet is worth flagging); this returns null for
// anything but 'planned', and el()'s child loop (dom.js) already skips
// null children. Several chips on one page share status 'planned' (e.g.
// every "Planned" tool on Home), so this deliberately uses plain
// `text: t(...)` rather than the `i18n` prop — that prop's
// applyI18nText() stamps a *derived-from-the-key* id onto the node,
// which would give every chip the exact same id (invalid duplicate HTML
// ids, and observed to cause real paint glitches in Chromium — a status
// label overlapping its neighbor's card). No live-retranslation is lost:
// every caller here (nav-rail.js, category-view.js) fully rebuilds its
// DOM on language change already, so a freshly-built chip is always
// current.
function plannedChip(status) {
  if (status !== 'planned') return null;
  return el('span', { class: 'status-chip status-chip-planned', text: t('catalog.statusPlanned') });
}

// A tool's Experimental badge — independent of the Planned/live/partial
// status above (a tool can be fully live and still carry it, e.g. the
// Truing Session tool). Same per-chip-instance `text` reasoning as
// plannedChip(): several Experimental badges can appear on one page, so
// this must not use the `i18n` prop either.
function experimentalChip(tool) {
  if (!tool || !tool.experimental) return null;
  return el('span', { class: 'status-chip status-chip-experimental', text: t('catalog.statusExperimental') });
}

// Returns every chip that applies to `tool` (zero, one or two), for a
// caller to spread as children — see nav-rail.js's toolRow() and
// category-view.js's toolCard() for the two call sites.
export function statusChip(tool) {
  return [plannedChip(tool.status), experimentalChip(tool)].filter(Boolean);
}
