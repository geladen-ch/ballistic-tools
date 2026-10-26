// The Scope section above the editor: what the reticle is designed for.
// Its type (fixed magnification, first or second focal plane), its field
// of view — "from X1 to X2 at Y" in the user's distance unit, held as
// angles 2·atan(X/2/Y) — and, for variable scopes, the zoom range, where
// typing either end derives the other from the actual fields of view. A
// second-focal-plane reticle also needs the zoom its subtensions are true
// at. Also whether the reticle is illuminated, and in which colour. Every
// edit is one undo step, like any other change to the reticle.
import { el, clear } from '../../dom.js';
import { t } from '../../i18n.js';
import { fieldOfViewAngle, fieldOfViewWidth } from '../../quantity.js';
import { toDisplayUnit, fromDisplayUnit, quantityLabel, displayChoice } from '../../display-units.js';
import { SCOPE_TYPES, zoomPartner, validateScope, visibleFieldRadius } from '../../reticle/scope.js';
import { updateScope, ILLUMINATION_COLOURS } from '../../reticle/model.js';
import { numberField, checkboxField } from './fields.js';

const ZOOM_DECIMALS = 2;
const ZOOM_FOLLOW_TOLERANCE = 1e-6;

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
  const scope = () => ctl.doc.scope;

  const distanceDecimals = () => displayChoice('distance').decimals + 1;
  const formatDistance = (v) => String(Number(v.toFixed(distanceDecimals())) + 0);
  const formatZoom = (v) => String(Number(v.toFixed(ZOOM_DECIMALS)) + 0);

  // Applies a scope patch if it leaves the scope valid for the edited
  // field; returns the error key to show otherwise.
  function apply(patch, field) {
    const next = { ...scope(), ...patch };
    const errors = validateScope(next);
    const error = errors[field] || (field === 'fovMaxRad' && errors.fovMinRad);
    if (error) return `reticleDesigner.errors.${error}`;
    ctl.commit(updateScope(ctl.doc, patch), { coalesceKey: `scope:${field}` });
    return null;
  }

  // A calibration zoom left at the top of the range follows it when the
  // range changes.
  function withZoom(patch) {
    const s = { ...scope(), ...patch };
    const next = { ...patch };
    if (s.type !== 'fixed' && s.zoomMin > 0) {
      const max = zoomPartner(s, 'min', s.zoomMin);
      if (Number.isFinite(max)) next.zoomMax = max;
      if (Math.abs(scope().calibrationZoom - scope().zoomMax) <= ZOOM_FOLLOW_TOLERANCE * scope().zoomMax) {
        next.calibrationZoom = next.zoomMax ?? s.zoomMax;
      }
    }
    return next;
  }

  function widthField(labelKey, angleKey) {
    const field = numberField({
      labelKey,
      unitLabel: quantityLabel('distance'),
      value: fieldOfViewWidth(scope()[angleKey], scope().fovDistanceM),
      toDisplay: (m) => toDisplayUnit('distance', m),
      fromDisplay: (v) => fromDisplayUnit('distance', v),
      format: formatDistance,
      onInput: (widthM) => {
        if (!(widthM > 0)) return 'reticleDesigner.errors.positive';
        return apply(withZoom({ [angleKey]: fieldOfViewAngle(widthM, scope().fovDistanceM) }), angleKey);
      },
      onCommitEnd: () => ctl.breakCoalescing()
    });
    syncs.push(() => field.refresh(fieldOfViewWidth(scope()[angleKey], scope().fovDistanceM)));
    return field.node;
  }

  function distanceField() {
    const field = numberField({
      labelKey: 'reticleDesigner.scope.fovAt',
      unitLabel: quantityLabel('distance'),
      value: scope().fovDistanceM,
      toDisplay: (m) => toDisplayUnit('distance', m),
      fromDisplay: (v) => fromDisplayUnit('distance', v),
      format: formatDistance,
      // The field widths stay as entered; their angles follow the new
      // distance.
      onInput: (distanceM) => {
        if (!(distanceM > 0)) return 'reticleDesigner.errors.positive';
        const s = scope();
        return apply({
          fovDistanceM: distanceM,
          fovMaxRad: fieldOfViewAngle(fieldOfViewWidth(s.fovMaxRad, s.fovDistanceM), distanceM),
          fovMinRad: fieldOfViewAngle(fieldOfViewWidth(s.fovMinRad, s.fovDistanceM), distanceM)
        }, 'fovDistanceM');
      },
      onCommitEnd: () => ctl.breakCoalescing()
    });
    syncs.push(() => field.refresh(scope().fovDistanceM));
    return field.node;
  }

  function zoomField(labelKey, key) {
    const field = numberField({
      labelKey,
      unitLabel: '×',
      value: scope()[key],
      format: formatZoom,
      onInput: (value) => {
        if (!(value > 0)) return 'reticleDesigner.errors.positive';
        if (key === 'calibrationZoom') return apply({ calibrationZoom: value }, key);
        const which = key === 'zoomMin' ? 'min' : 'max';
        const other = zoomPartner(scope(), which, value);
        const patch = which === 'min' ? { zoomMin: value, zoomMax: other } : { zoomMax: value, zoomMin: other };
        if (Math.abs(scope().calibrationZoom - scope().zoomMax) <= ZOOM_FOLLOW_TOLERANCE * scope().zoomMax) {
          patch.calibrationZoom = patch.zoomMax;
        }
        return apply(patch, key);
      },
      onCommitEnd: () => ctl.breakCoalescing()
    });
    syncs.push(() => field.refresh(scope()[key]));
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
    const type = scope().type;
    const typeSelect = el('select', { id: 'reticle-scope-type' },
      SCOPE_TYPES.map((id) => el('option', { value: id, text: t(`reticleDesigner.scope.types.${id}`) })));
    typeSelect.value = type;
    typeSelect.addEventListener('change', () => {
      const next = typeSelect.value;
      const patch = { type: next };
      // A scope turned variable needs a minimum field below its maximum.
      if (next !== 'fixed' && !(scope().fovMinRad > 0 && scope().fovMinRad < scope().fovMaxRad)) {
        patch.fovMinRad = scope().fovMaxRad / 5;
      }
      ctl.commit(updateScope(ctl.doc, withZoom(patch)));
    });
    syncs.push(() => { typeSelect.value = scope().type; });
    body.appendChild(el('label', { class: 'reticle-field', for: typeSelect.id }, [
      el('span', { class: 'reticle-field-label', i18n: 'reticleDesigner.scope.type' }),
      el('span', { class: 'reticle-field-input' }, [typeSelect])
    ]));

    const fov = [widthField(type === 'fixed' ? 'reticleDesigner.scope.fov' : 'reticleDesigner.scope.fovFrom', 'fovMaxRad')];
    if (type !== 'fixed') fov.push(widthField('reticleDesigner.scope.fovTo', 'fovMinRad'));
    fov.push(distanceField());
    body.appendChild(el('div', { class: 'reticle-field-row' }, fov));

    if (type !== 'fixed') {
      const zoom = [zoomField('reticleDesigner.scope.zoomFrom', 'zoomMin'), zoomField('reticleDesigner.scope.zoomTo', 'zoomMax')];
      if (type === 'sfp') zoom.push(zoomField('reticleDesigner.scope.calibrationZoom', 'calibrationZoom'));
      body.appendChild(el('div', { class: 'reticle-field-row' }, zoom));
      body.appendChild(el('p', { class: 'hint', i18n: type === 'sfp' ? 'reticleDesigner.scope.sfpHint' : 'reticleDesigner.scope.zoomHint' }));
    }
    body.appendChild(illumination);
  }

  function update() {
    if (scope().type !== shownType) {
      shownType = scope().type;
      rebuild();
    } else {
      for (const sync of syncs) sync();
    }
    updateIllumination();
    const diameter = 2 * visibleFieldRadius(scope());
    const { enabled, colour } = ctl.doc.illumination;
    brief.textContent = t('reticleDesigner.scope.brief', {
      type: t(`reticleDesigner.scope.types.${scope().type}`),
      field: `${String(Number(ctl.units.toDisplay(diameter).toFixed(1)) + 0)} ${ctl.units.label}`
    }) + (enabled ? ` · ${t('reticleDesigner.illumination.brief', { colour: t(`reticleDesigner.illumination.colours.${colour}`) })}` : '');
  }

  return { node: details, update };
}
