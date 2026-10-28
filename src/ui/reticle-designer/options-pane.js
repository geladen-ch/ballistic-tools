// Pane 1: editing options — the tool's mrad/MOA switch (independent of the
// app-wide unit preferences), the guide grid, snapping, zero-mark and
// BDC-mark toggles, for an illuminated reticle whether to show its
// illumination and dim the field. None of these is an undo step itself.
import { el } from '../../dom.js';
import { t, applyI18nText } from '../../i18n.js';
import { RETICLE_UNIT_IDS, RETICLE_UNITS } from '../../reticle/angle-units.js';
import { checkboxField } from './fields.js';

export function optionsPane(ctl) {
  const unitButtons = RETICLE_UNIT_IDS.map((id) => {
    const button = el('button', { type: 'button', class: 'reticle-segment', 'aria-pressed': 'false', 'data-units': id, text: RETICLE_UNITS[id].label });
    button.addEventListener('click', () => ctl.setEditor({ units: id }));
    return button;
  });

  const grid = checkboxField({ labelKey: 'reticleDesigner.options.grid', checked: ctl.editor.grid, onChange: (on) => ctl.setEditor({ grid: on }) });
  const snap = checkboxField({ labelKey: 'reticleDesigner.options.snap_mrad', checked: ctl.editor.snap, onChange: (on) => ctl.setEditor({ snap: on }) });
  const zero = checkboxField({ labelKey: 'reticleDesigner.options.zero', checked: ctl.editor.showZero, onChange: (on) => ctl.setEditor({ showZero: on }) });
  const bdc = checkboxField({ labelKey: 'reticleDesigner.options.bdc', checked: ctl.editor.showBdc, onChange: (on) => ctl.setEditor({ showBdc: on }) });
  const illumination = checkboxField({
    labelKey: 'reticleDesigner.options.illumination', checked: ctl.editor.showIllumination, onChange: (on) => ctl.setEditor({ showIllumination: on })
  });
  const dim = checkboxField({ labelKey: 'reticleDesigner.options.dimField', checked: ctl.editor.dimField, onChange: (on) => ctl.setEditor({ dimField: on }) });

  const node = el('section', { class: 'reticle-pane reticle-options', 'aria-labelledby': 'reticle-options-heading' }, [
    el('h2', { id: 'reticle-options-heading', class: 'reticle-pane-title', i18n: 'reticleDesigner.panes.options' }),
    el('div', { class: 'reticle-segmented', role: 'group', 'aria-label': t('reticleDesigner.options.units') }, unitButtons),
    el('div', { class: 'reticle-option-checks' }, [grid.node, snap.node, zero.node, bdc.node, illumination.node, dim.node])
  ]);

  function update() {
    const { units } = ctl.editor;
    for (const button of unitButtons) {
      const on = button.getAttribute('data-units') === units;
      button.classList.toggle('active', on);
      button.setAttribute('aria-pressed', String(on));
    }
    // Labels follow the unit switch: "Grid (1 mrad)" / "Grid (1 MOA)".
    applyI18nText(grid.label, 'reticleDesigner.options.grid', { unit: RETICLE_UNITS[units].label });
    applyI18nText(snap.label, `reticleDesigner.options.snap_${units}`);
    grid.refresh(ctl.editor.grid);
    snap.refresh(ctl.editor.snap);
    zero.refresh(ctl.editor.showZero);
    bdc.refresh(ctl.editor.showBdc);
    illumination.refresh(ctl.editor.showIllumination);
    dim.refresh(ctl.editor.dimField);
    // Only an illuminated reticle has illumination to show.
    const illuminated = ctl.doc.illumination.enabled;
    illumination.node.style.display = illuminated ? '' : 'none';
    dim.node.style.display = illuminated ? '' : 'none';
  }

  return { node, update };
}
