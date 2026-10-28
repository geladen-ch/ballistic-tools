// The Scope section above the editor: the reference scope the reticle is
// drawn for. Its type (fixed magnification, first or second focal plane)
// and its magnification — one figure for a fixed scope, the zoom range for
// a variable one — plus, for a second-focal-plane reticle, the zoom its
// subtensions are true at. The field of view is not entered: it is assumed
// from the magnification (see reticle/scope.js), only so the view can draw
// the field the reticle sits in; a real scope brings its own optics. Also
// whether the reticle is illuminated, and in which colour. Every edit is
// one undo step, like any other change to the reticle.
import { el, clear } from '../../dom.js';
import { t } from '../../i18n.js';
import { SCOPE_TYPES, validateReferenceScope, visibleFieldRadius, referenceOptics } from '../../reticle/scope.js';
import { updateReferenceScope, ILLUMINATION_COLOURS } from '../../reticle/model.js';
import { numberField, checkboxField } from './fields.js';

const ZOOM_DECIMALS = 2;
const ZOOM_FOLLOW_TOLERANCE = 1e-6;
// A scope turned variable with no range above its magnification gets one
// this many times it.
const NEW_RANGE_RATIO = 5;

let sectionOpen = true;

export function scopeSection(ctl) {
  const body = el('div', { class: 'reticle-scope-body' });
  const brief = el('span', { class: 'reticle-scope-brief' });
  const details = el('details', { class: 'card reticle-scope' }, [
    el('summary', { class: 'reticle-scope-summary' }, [
      el('span', { class: 'reticle-scope-title', i18n: 'reticleDesigner.scope.title' }),
      brief
    ]),
    body
  ]);
  if (sectionOpen) details.setAttribute('open', '');
  details.addEventListener('toggle', () => { sectionOpen = Boolean(details.open); });

  let shownType = null;
  let syncs = [];
  const ref = () => ctl.doc.referenceScope;

  const formatZoom = (v) => String(Number(v.toFixed(ZOOM_DECIMALS)) + 0);

  // Applies a reference-scope patch if it leaves it valid for the edited
  // field; returns the error key to show otherwise.
  function apply(patch, field) {
    const next = { ...ref(), ...patch };
    const errors = validateReferenceScope(next);
    const error = errors[field] || (field === 'zoomMin' && errors.zoomMax);
    if (error) return `reticleDesigner.errors.${error}`;
    ctl.commit(updateReferenceScope(ctl.doc, patch), { coalesceKey: `scope:${field}` });
    return null;
  }

  // A calibration zoom left at the top of the range follows it when the
  // range changes.
  function followingCalibration(patch) {
    const current = ref();
    if (!('zoomMax' in patch)) return patch;
    const atTop = Math.abs(current.calibrationZoom - current.zoomMax) <= ZOOM_FOLLOW_TOLERANCE * current.zoomMax;
    return atTop ? { ...patch, calibrationZoom: patch.zoomMax } : patch;
  }

  function zoomField(labelKey, key) {
    const field = numberField({
      labelKey,
      unitLabel: '×',
      value: ref()[key],
      format: formatZoom,
      onInput: (value) => {
        if (!(value > 0)) return 'reticleDesigner.errors.positive';
        if (key === 'calibrationZoom') return apply({ calibrationZoom: value }, key);
        // A fixed scope's one magnification is both ends of its range.
        const patch = ref().type === 'fixed' ? { zoomMin: value, zoomMax: value } : { [key]: value };
        return apply(followingCalibration(patch), key);
      },
      onCommitEnd: () => ctl.breakCoalescing()
    });
    syncs.push(() => field.refresh(ref()[key]));
    return field.node;
  }

  // "Reticle is illuminated", and the colour as a row of swatches shown
  // while it is.
  const illuminated = checkboxField({
    labelKey: 'reticleDesigner.illumination.enabled',
    checked: ctl.doc.illumination.enabled,
    onChange: (on) => ctl.setIllumination({ enabled: on })
  });
  const swatches = ILLUMINATION_COLOURS.map((colour) => {
    const label = t(`reticleDesigner.illumination.colours.${colour}`);
    const button = el('button', {
      type: 'button', class: 'reticle-swatch', 'data-colour': colour, 'aria-pressed': 'false', title: label
    }, [el('span', { class: 'reticle-swatch-chip', 'aria-hidden': 'true' }), el('span', { text: label })]);
    button.addEventListener('click', () => ctl.setIllumination({ colour }));
    return button;
  });
  const swatchRow = el('div', { class: 'reticle-swatches', role: 'group', 'aria-label': t('reticleDesigner.illumination.colour') }, swatches);
  const illumination = el('div', { class: 'reticle-illumination' }, [illuminated.node, swatchRow]);

  function updateIllumination() {
    const { enabled, colour } = ctl.doc.illumination;
    illuminated.refresh(enabled);
    swatchRow.style.display = enabled ? '' : 'none';
    for (const button of swatches) {
      const on = button.getAttribute('data-colour') === colour;
      button.classList.toggle('active', on);
      button.setAttribute('aria-pressed', String(on));
    }
  }

  function rebuild() {
    clear(body);
    syncs = [];
    const type = ref().type;
    const typeSelect = el('select', { id: 'reticle-scope-type' },
      SCOPE_TYPES.map((id) => el('option', { value: id, text: t(`reticleDesigner.scope.types.${id}`) })));
    typeSelect.value = type;
    typeSelect.addEventListener('change', () => {
      const next = typeSelect.value;
      const current = ref();
      let patch = { type: next };
      if (next === 'fixed') {
        patch = { ...patch, zoomMax: current.zoomMin, calibrationZoom: current.zoomMin };
      } else if (!(current.zoomMax > current.zoomMin)) {
        // A scope turned variable needs a range above its magnification.
        const zoomMax = current.zoomMin * NEW_RANGE_RATIO;
        patch = { ...patch, zoomMax, calibrationZoom: zoomMax };
      }
      ctl.commit(updateReferenceScope(ctl.doc, patch));
    });
    syncs.push(() => { typeSelect.value = ref().type; });
    body.appendChild(el('label', { class: 'reticle-field', for: typeSelect.id }, [
      el('span', { class: 'reticle-field-label', i18n: 'reticleDesigner.scope.type' }),
      el('span', { class: 'reticle-field-input' }, [typeSelect])
    ]));

    const zoom = type === 'fixed'
      ? [zoomField('reticleDesigner.scope.magnification', 'zoomMin')]
      : [zoomField('reticleDesigner.scope.zoomFrom', 'zoomMin'), zoomField('reticleDesigner.scope.zoomTo', 'zoomMax')];
    if (type === 'sfp') zoom.push(zoomField('reticleDesigner.scope.calibrationZoom', 'calibrationZoom'));
    body.appendChild(el('div', { class: 'reticle-field-row' }, zoom));
    body.appendChild(el('p', { class: 'hint', i18n: 'reticleDesigner.scope.referenceHint' }));
    if (type === 'sfp') body.appendChild(el('p', { class: 'hint', i18n: 'reticleDesigner.scope.sfpHint' }));
    body.appendChild(illumination);
  }

  function update() {
    if (ref().type !== shownType) {
      shownType = ref().type;
      rebuild();
    } else {
      for (const sync of syncs) sync();
    }
    updateIllumination();
    const diameter = 2 * visibleFieldRadius(referenceOptics(ref()));
    const { enabled, colour } = ctl.doc.illumination;
    brief.textContent = t('reticleDesigner.scope.brief', {
      type: t(`reticleDesigner.scope.types.${ref().type}`),
      field: `${String(Number(ctl.units.toDisplay(diameter).toFixed(1)) + 0)} ${ctl.units.label}`
    }) + (enabled ? ` · ${t('reticleDesigner.illumination.brief', { colour: t(`reticleDesigner.illumination.colours.${colour}`) })}` : '');
  }

  return { node: details, update };
}
