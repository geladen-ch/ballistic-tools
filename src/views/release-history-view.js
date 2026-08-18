import { el, clear } from '../dom.js';
import { t } from '../i18n.js';
import { RELEASE_HISTORY } from '../release-history.js';

// One stacked entry per release, not a table — a table's fixed columns
// have nowhere to put the long prose in fullVersion/description on a
// narrow (mobile portrait) viewport short of horizontal scrolling, which
// is a poor way to read a changelog. This layout has no columns to run
// out of room: everything just wraps and stacks, correct at any width
// without a separate mobile-only structure.
function entry(release) {
  return el('div', { class: 'release-entry' }, [
    el('div', { class: 'release-entry-header' }, [
      el('span', { class: 'release-entry-version', text: release.cacheVersion }),
      el('span', { class: 'release-entry-date', text: release.date })
    ]),
    el('div', { class: 'release-entry-fullversion', text: release.fullVersion }),
    el('p', { class: 'release-entry-description', text: t(release.descriptionKey) })
  ]);
}

export function mount(container) {
  clear(container);
  container.appendChild(el('div', {}, [
    el('h1', { i18n: 'releaseHistory.title' }),
    el('p', { i18n: 'releaseHistory.intro' }),
    el('div', { class: 'card' }, RELEASE_HISTORY.map(entry))
  ]));
}
