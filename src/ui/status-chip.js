import { el } from '../dom.js';
import { t } from '../i18n.js';

const LABEL_KEYS = {
  live: 'catalog.statusLive',
  partial: 'catalog.statusPartial',
  planned: 'catalog.statusPlanned'
};

// A tool's Live/Partial/Planned indicator — one shared component so the
// rail, the category hub pages and Home all render the exact same shape
// for the exact same status. Several chips on one page share the same
// status (e.g. every "Planned" tool on Home), so this deliberately uses
// plain `text: t(...)` rather than the `i18n` prop — that prop's
// applyI18nText() stamps a *derived-from-the-key* id onto the node,
// which would give every chip sharing a status the exact same id
// (invalid duplicate HTML ids, and observed to cause real paint
// glitches in Chromium — a status label overlapping its neighbor's
// card). No live-retranslation is lost: every caller here (nav-rail.js,
// nav-tabbar.js, category-view.js, home-view.js) fully rebuilds its DOM
// on language change already, so a freshly-built chip is always current.
export function statusChip(status) {
  return el('span', { class: `status-chip status-chip-${status}`, text: t(LABEL_KEYS[status]) });
}
