// Pane 5: every element of the reticle as a list, members of a group
// shown together under their group. Clicking a row selects it (Shift or
// Ctrl/Cmd adds to the selection); a member row selects that member on its
// own, the group row the whole group.
//
// The list is rebuilt on every change, so a rebuild keeps its scroll
// position and the focused row, and a selection made elsewhere (in the
// view) scrolls the list just enough to show the selected row.
import { el, clear } from '../../dom.js';
import { t } from '../../i18n.js';
import { groupMembers, isLit } from '../../reticle/model.js';
import { elementIcon } from './element-icons.js';

// A number is listed by its digits, an SVG shape by its file name.
function listName(element) {
  const type = t(`reticleDesigner.types.${element.type}`);
  if (element.type === 'number') return `${type} ${element.text}`;
  if (element.type === 'svg' && element.name) return `${type} ${element.name}`;
  return type;
}

export function elementListPane(ctl) {
  const list = el('ul', { class: 'reticle-element-list', role: 'listbox', 'aria-multiselectable': 'true' });
  const node = el('section', { class: 'reticle-pane reticle-list', 'aria-labelledby': 'reticle-list-heading' }, [
    el('h2', { id: 'reticle-list-heading', class: 'reticle-pane-title', i18n: 'reticleDesigner.panes.list' }),
    list
  ]);

  const formatAngle = (v) => String(Number(ctl.units.toDisplay(v).toFixed(ctl.units.decimals)) + 0);

  function select(entry, event) {
    if (event && (event.shiftKey || event.ctrlKey || event.metaKey)) ctl.toggleSelection(entry);
    else ctl.setSelection([entry]);
  }

  function row(entry, children, { selected, className }) {
    const item = el('li', {
      class: `reticle-list-row ${className}${selected ? ' selected' : ''}`,
      role: 'option',
      'aria-selected': String(selected),
      tabindex: '0',
      'data-entry': entry
    }, children);
    item.addEventListener('click', (event) => select(entry, event));
    item.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        select(entry, event);
      }
    });
    return item;
  }

  function elementRow(element, selection, inGroup) {
    const marks = [];
    if (isLit(ctl.doc, element)) marks.push(t('reticleDesigner.list.illuminated'));
    if (element.mirror) marks.push(t('reticleDesigner.list.mirrored'));
    if (element.repeat.enabled) marks.push(t('reticleDesigner.list.repeated', { count: element.repeat.count }));
    const selected = selection.has(element.id);
    const derivedSelected = !selected && inGroup && selection.has(element.groupId);
    return row(element.id, [
      elementIcon(element.type, 16),
      el('span', { class: 'reticle-list-name', text: listName(element) }),
      // A BDC mark has only its height on the vertical axis.
      el('span', { class: 'reticle-list-pos', text: element.type === 'bdc' ? formatAngle(element.y) : `${formatAngle(element.x)}, ${formatAngle(element.y)}` }),
      marks.length ? el('span', { class: 'reticle-list-marks', text: marks.join(' · ') }) : null
    ], { selected, className: `${inGroup ? 'member' : ''}${derivedSelected ? ' in-selected-group' : ''}` });
  }

  let shownSelection = '';

  function update() {
    const scrollTop = list.scrollTop;
    const focusedEntry = list.contains?.(document.activeElement) ? document.activeElement.getAttribute('data-entry') : null;
    rebuild();
    list.scrollTop = scrollTop;
    const rows = () => [...list.querySelectorAll('.reticle-list-row')];
    if (focusedEntry) rows().find((r) => r.getAttribute('data-entry') === focusedEntry)?.focus({ preventScroll: true });
    const selection = ctl.editor.selection.join(',');
    if (selection !== shownSelection) {
      shownSelection = selection;
      const first = rows().find((r) => r.classList.contains('selected'));
      // Not when the user picked it here: that row is already in view.
      if (first && first.getAttribute('data-entry') !== focusedEntry) revealRow(first);
    }
  }

  // Scrolls the list (not the page) so `row` is in view.
  function revealRow(row) {
    if (!row.getBoundingClientRect || !list.getBoundingClientRect) return;
    const rowRect = row.getBoundingClientRect();
    const top = rowRect.top - list.getBoundingClientRect().top + list.scrollTop;
    const bottom = top + rowRect.height;
    if (top < list.scrollTop) list.scrollTop = top;
    else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight;
  }

  function rebuild() {
    clear(list);
    const doc = ctl.doc;
    const selection = new Set(ctl.editor.selection);
    if (doc.elements.length === 0) {
      list.appendChild(el('li', { class: 'hint reticle-list-empty', i18n: 'reticleDesigner.list.empty' }));
      return;
    }
    const shownGroups = new Set();
    for (const element of doc.elements) {
      if (!element.groupId) {
        list.appendChild(elementRow(element, selection, false));
        continue;
      }
      if (shownGroups.has(element.groupId)) continue;
      shownGroups.add(element.groupId);
      const members = groupMembers(doc, element.groupId);
      const group = el('li', { class: 'reticle-list-group' });
      const header = row(element.groupId, [
        el('span', { class: 'reticle-list-name', text: t('reticleDesigner.settings.group', { count: members.length }) })
      ], { selected: selection.has(element.groupId), className: 'group-header' });
      const inner = el('ul', { class: 'reticle-list-members', role: 'group' }, members.map((m) => elementRow(m, selection, true)));
      group.appendChild(header);
      group.appendChild(inner);
      list.appendChild(group);
    }
  }

  return { node, update };
}
