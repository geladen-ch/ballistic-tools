import { el, clear } from '../dom.js';
import { GROUPS, toolsInGroup } from '../nav-tools.js';
import { statusChip } from '../ui/status-chip.js';

// One shared view for both category hub pages (#/measurement, #/analysis)
// — the mobile tab bar's Measurement/Analysis tabs land here rather than
// on a specific tool, and it's a real, bookmarkable page on desktop too,
// not just a mobile-only screen. Registered in app.js as
// `mount(container, 'measurement')` / `mount(container, 'analysis')`.
export function mount(container, groupId) {
  clear(container);
  const group = GROUPS[groupId];
  const tools = toolsInGroup(groupId);

  container.appendChild(
    el('div', {}, [
      el('h1', { i18n: group.nameKey }),
      el('p', { i18n: group.descKey }),
      el('div', { class: 'category-grid' }, tools.map((tool) => toolCard(tool)))
    ])
  );
}

// Exported for home-view.js, which shows both groups' cards on one page
// using the exact same card markup — one place defines what a tool card
// looks like.
export function toolCard(tool) {
  const inner = [
    el('div', { class: 'category-card-head' }, [
      el('h2', { i18n: tool.nameKey }),
      statusChip(tool.status)
    ]),
    el('p', { i18n: tool.descKey })
  ];
  if (tool.path) {
    return el('a', { href: '#' + tool.path, class: 'card category-card' }, inner);
  }
  return el('div', { class: 'card category-card disabled', 'aria-disabled': 'true' }, inner);
}
