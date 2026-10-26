// Pane 3: the element palette — the selection arrow and one icon per
// element type — plus the Group / Ungroup / Duplicate / Delete actions.
//
// Picking a type arms it: the next click (or press-and-drag for lines
// and bars) in the reticle view places one. An icon can also be dragged
// straight into the view. The highlighted icon follows the selection: an
// armed type, else the type of the single selected element, else the
// arrow.
import { el } from '../../dom.js';
import { t } from '../../i18n.js';
import { ELEMENT_TYPE_IDS } from '../../reticle/element-types.js';
import { findElement } from '../../reticle/model.js';
import { elementIcon } from './element-icons.js';

export const PALETTE_DRAG_TYPE = 'application/x-ebalka2-reticle-element';

// `onImportSvg`: opens the SVG import panel — the SVG shape "tool" has
// nothing to place by clicking; its drawing comes from a file or a paste.
export function elementPalette(ctl, { onImportSvg = () => {} } = {}) {
  const buttons = new Map();

  function toolButton(tool) {
    const label = t(tool === 'select' ? 'reticleDesigner.palette.select' : `reticleDesigner.types.${tool}`);
    const button = el('button', {
      type: 'button',
      class: 'reticle-tool',
      title: label,
      'aria-label': label,
      'aria-pressed': 'false',
      'data-tool': tool
    }, [elementIcon(tool)]);
    button.addEventListener('click', () => {
      if (tool === 'svg') {
        ctl.setTool('select');
        onImportSvg();
        return;
      }
      ctl.setTool(ctl.editor.tool === tool ? 'select' : tool);
    });
    if (tool !== 'select' && tool !== 'svg') {
      button.setAttribute('draggable', 'true');
      button.addEventListener('dragstart', (event) => {
        if (!event.dataTransfer) return;
        event.dataTransfer.setData(PALETTE_DRAG_TYPE, tool);
        event.dataTransfer.setData('text/plain', tool);
        event.dataTransfer.effectAllowed = 'copy';
      });
    }
    buttons.set(tool, button);
    return button;
  }

  function action(key, onClick) {
    const button = el('button', { type: 'button', class: 'secondary reticle-action', i18n: `reticleDesigner.palette.${key}` });
    button.addEventListener('click', onClick);
    return button;
  }

  const groupButton = action('group', () => ctl.groupSelection());
  const ungroupButton = action('ungroup', () => ctl.ungroupSelection());
  const duplicateButton = action('duplicate', () => ctl.duplicateSelection());
  const deleteButton = action('delete', () => ctl.deleteSelection());

  const node = el('section', { class: 'reticle-pane reticle-palette', 'aria-labelledby': 'reticle-palette-heading' }, [
    el('h2', { id: 'reticle-palette-heading', class: 'reticle-pane-title', i18n: 'reticleDesigner.panes.palette' }),
    el('div', { class: 'reticle-tools', role: 'toolbar' }, ['select', ...ELEMENT_TYPE_IDS].map(toolButton)),
    el('div', { class: 'reticle-actions' }, [groupButton, ungroupButton, duplicateButton, deleteButton])
  ]);

  function highlightedTool() {
    const { tool, selection } = ctl.editor;
    if (tool !== 'select') return tool;
    if (selection.length === 1) {
      const element = findElement(ctl.doc, selection[0]);
      if (element) return element.type;
    }
    return 'select';
  }

  function update() {
    const highlighted = highlightedTool();
    const armed = ctl.editor.tool;
    for (const [tool, button] of buttons) {
      button.classList.toggle('active', tool === highlighted);
      button.classList.toggle('armed', tool !== 'select' && tool === armed);
      button.setAttribute('aria-pressed', String(tool === armed));
    }
    const hasSelection = ctl.selectedElementIds().length > 0;
    groupButton.disabled = !ctl.canGroup();
    ungroupButton.disabled = ctl.selectedGroups().length === 0;
    duplicateButton.disabled = !hasSelection;
    deleteButton.disabled = !hasSelection;
  }

  return { node, update };
}
