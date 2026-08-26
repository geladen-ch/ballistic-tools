import { el } from '../../dom.js';
import { t } from '../../i18n.js';

// A target's own group switcher, shown in the marking view's 'idle' mode
// (see rifle-precision-marking-view.js) — one tab per group, numbered by
// array position (not a stored group number, same "positional" convention
// rifle-precision-view.js's own groupLabel() uses), labeled with its own
// shot count so a shooter can tell groups apart at a glance without
// opening each one. Selecting a tab re-enters 'shot' mode for that group
// so more shots can be appended to it later — this is a plain "which
// group is selected right now" switcher, not a tab strip that shows/hides
// panels the way bc-tools-view.js's own tabSwitcher() does, so it's its
// own small component rather than reusing that one.
export function groupSelector({ groups = [], activeGroupId = null, onSelect } = {}) {
  const node = el('div', { class: 'section-tabs' });
  groups.forEach((group, index) => {
    const btn = el('button', {
      type: 'button',
      class: 'tab-btn' + (group.id === activeGroupId ? ' active' : ''),
      text: t('riflePrecision.groupTabLabel', { n: index + 1, count: group.shots.length })
    });
    btn.addEventListener('click', () => { if (onSelect) onSelect(group.id); });
    node.appendChild(btn);
  });
  return { node };
}
