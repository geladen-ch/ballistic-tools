// Pane 4: the settings of whatever is selected. Every valid edit applies
// to the reticle at once.
//
// - One element: its position, its own fields (a line's or bar's end, a
//   number's digits, an SVG shape's scale and size) and everything else
//   it has (dimensions, mirror, repeat, a number's anchor and font, an SVG
//   shape's reflect option).
// - A group or a multi-selection: the position of the whole (the centroid
//   of the elements' positions) and every setting all its elements have in
//   common — a line width when all are lines, mirror and repeat unless a
//   BDC mark (which has neither) is among them, "illuminated" on an
//   illuminated reticle, and so on. Changing one changes it on every element; a field whose
//   elements differ shows "mixed" until set.
//
// The pane is rebuilt only when what it shows changes shape (another
// selection, a repeat switched on, the unit switch); otherwise its fields
// are refreshed in place, so the field being typed in keeps its focus.
import { el, clear } from '../../dom.js';
import { t, i18nSpan } from '../../i18n.js';
import { radToDeg, degToRad } from '../../quantity.js';
import {
  ELEMENT_TYPES, REPEAT_DIRECTIONS, NUMBER_ANCHORS, DIGIT_FONT_IDS, MAX_REPEAT_COUNT, MAX_ANGLE, axisOf, endKeyOf, validateElement,
  canMirror, canRepeat, canIlluminate, staysOnVerticalAxis
} from '../../reticle/element-types.js';
import { digitFont } from '../../reticle/digit-text.js';
import {
  centroidOf, findElement, findGroup, moveEndpoint, resolveElementIds, setCentroid, translate, updateElement, updateElements
} from '../../reticle/model.js';
import { numberField, checkboxField } from './fields.js';

const CLAMP_EPSILON = 1e-12;
// The stepper arrows' step on coordinate fields (positions, a segment's
// end), in the unit the tool shows.
const POSITION_STEPS = { mrad: 0.1, moa: 0.05 };
// What a shared value reads as while its elements differ.
const MIXED = Symbol('mixed');

export function elementSettingsPane(ctl) {
  const body = el('div', { class: 'reticle-settings-body' });
  const node = el('section', { class: 'reticle-pane reticle-settings', 'aria-labelledby': 'reticle-settings-heading' }, [
    el('h2', { id: 'reticle-settings-heading', class: 'reticle-pane-title', i18n: 'reticleDesigner.panes.settings' }),
    body
  ]);
  let shapeKey = null;
  let syncs = [];

  const decimals = () => ctl.units.decimals;
  const formatAngle = (v) => String(Number(v.toFixed(decimals())) + 0);
  const mixedLabel = () => t('reticleDesigner.settings.mixed');
  const orNaN = (v) => (v === MIXED ? NaN : v);

  // `get` returns the value, or MIXED when the elements differ.
  // `step`: the stepper arrows' step in the shown unit ('any' = none).
  function angleField(labelKey, get, apply, fieldKey, { step = 'any' } = {}) {
    const field = numberField({
      labelKey,
      step,
      unitLabel: ctl.units.label,
      value: orNaN(get()),
      toDisplay: ctl.units.toDisplay,
      fromDisplay: ctl.units.fromDisplay,
      format: formatAngle,
      placeholder: mixedLabel(),
      onInput: (value) => apply(value, `field:${fieldKey}`),
      onCommitEnd: () => ctl.breakCoalescing()
    });
    syncs.push(() => field.refresh(orNaN(get())));
    return field.node;
  }

  function selectField(labelKey, id, options, get, onChange) {
    const select = el('select', { id }, [
      // Selected only while the elements differ.
      el('option', { value: '', text: mixedLabel(), disabled: 'disabled', hidden: 'hidden' }),
      ...options.map(([value, label]) => el('option', { value, text: label }))
    ]);
    const show = () => {
      const v = get();
      select.value = v === MIXED ? '' : v;
    };
    show();
    select.addEventListener('change', () => { if (select.value) onChange(select.value); });
    syncs.push(show);
    return el('label', { class: 'reticle-field', for: id }, [
      el('span', { class: 'reticle-field-label' }, [i18nSpan(labelKey)]),
      el('span', { class: 'reticle-field-input' }, [select])
    ]);
  }

  function currentShapeKey() {
    const { selection, units } = ctl.editor;
    const ids = resolveElementIds(ctl.doc, selection);
    if (ids.length === 0) return 'none';
    const elements = ids.map((id) => findElement(ctl.doc, id));
    const single = selection.length === 1 && Boolean(findElement(ctl.doc, selection[0]));
    return [
      single ? 'e' : 'm', selection.join(','), ids.join(','), units,
      elements.map((e) => e.type).join(','), elements.every((e) => e.repeat.enabled), ctl.doc.illumination.enabled
    ].join(':');
  }

  // ---- settings every selected element has ----

  // The elements' common value of `read(element)`, or MIXED.
  function common(ids, read) {
    const values = ids.map((id) => read(findElement(ctl.doc, id)));
    return values.every((v) => v === values[0]) ? values[0] : MIXED;
  }

  // true / false when every element agrees, null when they differ.
  function commonFlag(ids, read) {
    const v = common(ids, read);
    return v === MIXED ? null : v === true;
  }

  // Applies `patchFor(element)` to every element if each one stays valid —
  // one undo step for all; otherwise returns the error key of the first
  // that wouldn't and applies nothing.
  function applyAll(ids, patchFor, { key = null, field = null } = {}) {
    const patches = new Map();
    for (const id of ids) {
      const element = findElement(ctl.doc, id);
      const patch = patchFor(element);
      const candidate = { ...element, ...patch, repeat: patch.repeat ? { ...element.repeat, ...patch.repeat } : element.repeat };
      const errors = validateElement(candidate);
      const error = (field && errors[field]) || Object.values(errors)[0];
      if (error) return `reticleDesigner.errors.${error}`;
      patches.set(id, patch);
    }
    ctl.commit(updateElements(ctl.doc, patches), { coalesceKey: key });
    return null;
  }

  // Dimensions, the number and SVG options, mirror and repeat — those every
  // element in `ids` has.
  function sharedFields(ids) {
    const fieldKey = ids.join('+');
    const elements = ids.map((id) => findElement(ctl.doc, id));
    const types = [...new Set(elements.map((e) => e.type))];
    const children = [];

    // A dimension every type has, under the same name and kind.
    const params = ELEMENT_TYPES[types[0]].params.filter((p) =>
      types.every((type) => ELEMENT_TYPES[type].params.some((q) => q.key === p.key && q.kind === p.kind)));
    const fields = params.map((param) => {
      const get = () => common(ids, (e) => e[param.key]);
      const apply = (value, key) => {
        const error = applyAll(ids, () => ({ [param.key]: value }), { key, field: param.key });
        if (!error) {
          if (types.some((type) => ELEMENT_TYPES[type].principal === param.key)) ctl.rememberPrincipal(value);
          if (param.key === 'digitHeight') ctl.rememberNumber({ digitHeight: value });
        }
        return error;
      };
      if (param.kind === 'degrees') {
        const field = numberField({
          labelKey: `reticleDesigner.params.${param.key}`,
          unitLabel: '°',
          value: orNaN(get()),
          toDisplay: radToDeg,
          fromDisplay: degToRad,
          format: (v) => String(Number(v.toFixed(1)) + 0),
          placeholder: mixedLabel(),
          onInput: (value) => apply(value, `field:${fieldKey}:${param.key}`),
          onCommitEnd: () => ctl.breakCoalescing()
        });
        syncs.push(() => field.refresh(orNaN(get())));
        return field.node;
      }
      return angleField(`reticleDesigner.params.${param.key}`, get, apply, `${fieldKey}:${param.key}`);
    });

    // A number's anchor and font, when all are numbers.
    if (types.length === 1 && types[0] === 'number') {
      fields.push(selectField('reticleDesigner.params.anchor', `reticle-number-anchor-${fieldKey}`,
        NUMBER_ANCHORS.map((a) => [a, t(`reticleDesigner.anchors.${a}`)]),
        () => common(ids, (e) => e.anchor),
        (value) => {
          ctl.rememberNumber({ anchor: value });
          applyAll(ids, () => ({ anchor: value }));
        }));
      // Font names are the fonts' own, not translated.
      fields.push(selectField('reticleDesigner.params.font', `reticle-number-font-${fieldKey}`,
        DIGIT_FONT_IDS.map((f) => [f, `${digitFont(f).family} ${digitFont(f).style}`]),
        () => common(ids, (e) => e.font),
        (value) => {
          ctl.rememberNumber({ font: value });
          applyAll(ids, () => ({ font: value }));
        }));
    }
    if (fields.length) children.push(el('div', { class: 'reticle-field-row' }, fields));

    const checks = [];
    if (types.length === 1 && types[0] === 'svg') {
      const reflect = checkboxField({
        labelKey: 'reticleDesigner.settings.reflect',
        checked: commonFlag(ids, (e) => e.reflect),
        onChange: (on) => applyAll(ids, () => ({ reflect: on }))
      });
      syncs.push(() => reflect.refresh(commonFlag(ids, (e) => e.reflect)));
      checks.push(reflect.node);
    }
    // Lit or not: only on an illuminated reticle, for visible elements.
    if (ctl.doc.illumination.enabled && types.every(canIlluminate)) {
      const lit = checkboxField({
        labelKey: 'reticleDesigner.settings.illuminated',
        checked: commonFlag(ids, (e) => e.illuminated),
        onChange: (on) => {
          if (!applyAll(ids, () => ({ illuminated: on }))) ctl.rememberIlluminated(on);
        }
      });
      syncs.push(() => lit.refresh(commonFlag(ids, (e) => e.illuminated)));
      checks.push(lit.node);
    }
    if (types.every(canMirror)) {
      const mirror = checkboxField({
        labelKey: 'reticleDesigner.settings.mirror',
        checked: commonFlag(ids, (e) => e.mirror),
        onChange: (on) => applyAll(ids, () => ({ mirror: on }))
      });
      syncs.push(() => mirror.refresh(commonFlag(ids, (e) => e.mirror)));
      checks.push(mirror.node);
    }
    const repeatable = types.every(canRepeat);
    if (repeatable) {
      const repeat = checkboxField({
        labelKey: 'reticleDesigner.settings.repeat',
        checked: commonFlag(ids, (e) => e.repeat.enabled),
        // Switched on: an element not yet repeating takes the last-entered
        // direction, count and step; one already repeating keeps its own.
        onChange: (on) => applyAll(ids, (e) => ({
          repeat: on ? (e.repeat.enabled ? { enabled: true } : { enabled: true, ...ctl.repeatDefaults() }) : { enabled: false }
        }))
      });
      syncs.push(() => repeat.refresh(commonFlag(ids, (e) => e.repeat.enabled)));
      checks.push(repeat.node);
    }
    if (checks.length) children.push(el('div', { class: 'reticle-check-row' }, checks));

    if (repeatable && elements.every((e) => e.repeat.enabled)) children.push(repeatFields(ids, fieldKey));
    return children;
  }

  function repeatFields(ids, fieldKey) {
    const remember = () => ctl.rememberRepeat(findElement(ctl.doc, ids[0]).repeat);
    const direction = selectField('reticleDesigner.settings.repeatDirection', `reticle-repeat-direction-${fieldKey}`,
      REPEAT_DIRECTIONS.map((dir) => [dir, t(`reticleDesigner.directions.${dir}`)]),
      () => common(ids, (e) => e.repeat.direction),
      (value) => {
        if (!applyAll(ids, () => ({ repeat: { direction: value } }))) remember();
      });
    const countValue = () => orNaN(common(ids, (e) => e.repeat.count));
    const count = numberField({
      labelKey: 'reticleDesigner.settings.repeatCount',
      value: countValue(),
      integer: true,
      step: 1,
      placeholder: mixedLabel(),
      onInput: (value) => {
        if (!(value >= 1)) return 'reticleDesigner.errors.positiveInteger';
        if (value > MAX_REPEAT_COUNT) return 'reticleDesigner.errors.repeatCountMax';
        const error = applyAll(ids, () => ({ repeat: { count: value } }), { key: `field:${fieldKey}:repeatCount`, field: 'repeatCount' });
        if (!error) remember();
        return error;
      },
      onCommitEnd: () => ctl.breakCoalescing()
    });
    syncs.push(() => count.refresh(countValue()));
    const step = angleField('reticleDesigner.settings.repeatStep', () => common(ids, (e) => e.repeat.step), (value, key) => {
      if (!(value > 0)) return 'reticleDesigner.errors.positive';
      if (value > MAX_ANGLE) return 'reticleDesigner.errors.outOfRange';
      const error = applyAll(ids, () => ({ repeat: { step: value } }), { key, field: 'repeatStep' });
      if (!error) remember();
      return error;
    }, `${fieldKey}:repeatStep`);
    return el('div', { class: 'reticle-field-row' }, [direction, count.node, step]);
  }

  // ---- one element ----

  function buildElement(id) {
    const element = () => findElement(ctl.doc, id);
    const e0 = element();
    const axis = axisOf(e0);
    const children = [el('h3', { class: 'reticle-settings-type', i18n: `reticleDesigner.types.${e0.type}` })];
    if (e0.type === 'svg' && e0.name) children.push(el('p', { class: 'reticle-settings-name', text: e0.name }));
    if (e0.type === 'bdc') children.push(el('p', { class: 'hint', i18n: 'reticleDesigner.settings.bdcHint' }));
    if (e0.groupId) children.push(el('p', { class: 'hint', i18n: 'reticleDesigner.settings.inGroup' }));

    // Position. Lines and bars: x, y is the start and moves only the
    // start (a bar's clamped by the end-point rule); everything else
    // moves whole.
    const positionApply = (coord) => (value, key) => {
      if (Math.abs(value) > MAX_ANGLE) return 'reticleDesigner.errors.outOfRange';
      const current = element();
      if (axis) {
        const point = { x: current.x, y: current.y, [coord]: value };
        const next = moveEndpoint(ctl.doc, id, 'start', point);
        ctl.commit(next, { coalesceKey: key });
        return Math.abs(findElement(next, id)[coord] - value) > CLAMP_EPSILON ? 'reticleDesigner.errors.startClamped' : null;
      }
      const moved = translate(ctl.doc, [id], coord === 'x' ? value - current.x : 0, coord === 'y' ? value - current.y : 0);
      ctl.commit(moved.doc, { coalesceKey: key });
      return null;
    };
    const positionKey = axis ? 'start'
      : e0.type === 'chevron' ? 'apex'
        : e0.type === 'number' ? 'anchor'
          : e0.type === 'svg' ? 'origin'
            : e0.type === 'bdc' ? 'mark' : 'centre';
    // A BDC mark sits on the vertical axis: only its y is set.
    children.push(el('div', { class: 'reticle-field-row' }, [
      staysOnVerticalAxis(e0.type) ? null : angleField(`reticleDesigner.params.${positionKey}X`, () => element().x, positionApply('x'), `${id}:x`, { step: POSITION_STEPS[ctl.editor.units] }),
      angleField(`reticleDesigner.params.${positionKey}Y`, () => element().y, positionApply('y'), `${id}:y`, { step: POSITION_STEPS[ctl.editor.units] })
    ]));
    if (axis) {
      const endKey = endKeyOf(e0);
      children.push(el('div', { class: 'reticle-field-row' }, [
        angleField(`reticleDesigner.params.${endKey}`, () => element()[endKey], (value, key) => {
          if (Math.abs(value) > MAX_ANGLE) return 'reticleDesigner.errors.outOfRange';
          const next = moveEndpoint(ctl.doc, id, 'end', { x: value, y: value });
          ctl.commit(next, { coalesceKey: key });
          return Math.abs(findElement(next, id)[endKey] - value) > CLAMP_EPSILON ? 'reticleDesigner.errors.endClamped' : null;
        }, `${id}:end`, { step: POSITION_STEPS[ctl.editor.units] })
      ]));
    }
    if (e0.type === 'number') children.push(numberTextField(id, element));
    if (e0.type === 'svg') children.push(svgSizeFields(id, element));
    children.push(...sharedFields([id]));
    return children;
  }

  // An SVG shape's size, settable three ways that all edit the one stored
  // scale (rad per SVG unit): the scale itself, or the drawing's absolute
  // width or height (its ink extents). Editing one updates the others.
  function svgSizeFields(id, element) {
    const extent = (axisIndex) => {
      const b = element().shape.bounds;
      return b[axisIndex + 2] - b[axisIndex];
    };
    const setScale = (scale, key) => {
      if (!(scale > 0) || !Number.isFinite(scale)) return 'reticleDesigner.errors.positive';
      const error = validateElement({ ...element(), scale }).scale;
      if (error) return `reticleDesigner.errors.${error}`;
      ctl.commit(updateElement(ctl.doc, id, { scale }), { coalesceKey: key });
      return null;
    };
    // The scale can be far below the display precision of a position
    // (a drawing in thousandths of an mrad per unit), so it is shown to
    // significant digits instead.
    const scaleField = numberField({
      labelKey: 'reticleDesigner.params.svgScale',
      unitLabel: ctl.units.label,
      value: element().scale,
      toDisplay: ctl.units.toDisplay,
      fromDisplay: ctl.units.fromDisplay,
      format: (v) => String(Number(v.toPrecision(5))),
      onInput: (value) => setScale(value, `field:${id}:scale`),
      onCommitEnd: () => ctl.breakCoalescing()
    });
    syncs.push(() => scaleField.refresh(element().scale));
    const sizeField = (labelKey, axisIndex) => {
      if (!(extent(axisIndex) > 0)) return null;
      return angleField(labelKey, () => extent(axisIndex) * element().scale,
        (value, key) => (value > 0 ? setScale(value / extent(axisIndex), key) : 'reticleDesigner.errors.positive'), `${id}:size${axisIndex}`);
    };
    return el('div', { class: 'reticle-field-row' }, [
      scaleField.node,
      sizeField('reticleDesigner.params.svgWidth', 0),
      sizeField('reticleDesigner.params.svgHeight', 1)
    ]);
  }

  // A number's digits apply on every valid keystroke like any other
  // setting; a run of typing is one undo step.
  function numberTextField(id, element) {
    const text = el('input', { type: 'text', inputmode: 'numeric', autocomplete: 'off', maxlength: '12', id: `reticle-number-text-${id}` });
    text.value = element().text;
    const textMessage = el('span', { class: 'reticle-field-message', role: 'status' });
    let typing = false;
    text.addEventListener('focus', () => { typing = true; });
    text.addEventListener('input', () => {
      const error = applyAll([id], () => ({ text: text.value }), { key: `field:${id}:text`, field: 'text' });
      textMessage.textContent = error ? t(error) : '';
      text.classList.toggle('invalid', Boolean(error));
    });
    text.addEventListener('blur', () => {
      typing = false;
      ctl.breakCoalescing();
      text.value = element().text;
      textMessage.textContent = '';
      text.classList.remove('invalid');
    });
    syncs.push(() => { if (!typing) text.value = element().text; });
    return el('div', { class: 'reticle-field-row' }, [
      el('label', { class: 'reticle-field', for: text.id }, [
        el('span', { class: 'reticle-field-label' }, [i18nSpan('reticleDesigner.params.text')]),
        el('span', { class: 'reticle-field-input' }, [text]),
        textMessage
      ])
    ]);
  }

  // ---- a group or a multi-selection ----

  function buildSeveral(selection) {
    const ids = resolveElementIds(ctl.doc, selection);
    const isGroup = selection.length === 1 && Boolean(findGroup(ctl.doc, selection[0]));
    const position = () => centroidOf(ctl.doc, ids);
    const apply = (coord) => (value, key) => {
      if (Math.abs(value) > MAX_ANGLE) return 'reticleDesigner.errors.outOfRange';
      const target = { ...position(), [coord]: value };
      const next = setCentroid(ctl.doc, ids, target.x, target.y);
      ctl.commit(next, { coalesceKey: key });
      return Math.abs(centroidOf(next, ids)[coord] - value) > CLAMP_EPSILON ? 'reticleDesigner.errors.moveLimited' : null;
    };
    const fieldKey = selection.join('+');
    const prefix = isGroup ? 'group' : 'selection';
    // No x when every element is a BDC mark: none of them moves sideways.
    const sideways = ids.some((id) => !staysOnVerticalAxis(findElement(ctl.doc, id).type));
    return [
      el('h3', {
        class: 'reticle-settings-type',
        text: isGroup ? t('reticleDesigner.settings.group', { count: ids.length }) : t('reticleDesigner.settings.multiple', { count: ids.length })
      }),
      el('div', { class: 'reticle-field-row' }, [
        sideways ? angleField(`reticleDesigner.params.${prefix}X`, () => position().x, apply('x'), `${fieldKey}:x`, { step: POSITION_STEPS[ctl.editor.units] }) : null,
        angleField(`reticleDesigner.params.${prefix}Y`, () => position().y, apply('y'), `${fieldKey}:y`, { step: POSITION_STEPS[ctl.editor.units] })
      ]),
      ...sharedFields(ids)
    ];
  }

  function rebuild() {
    clear(body);
    syncs = [];
    const { selection } = ctl.editor;
    let children;
    if (resolveElementIds(ctl.doc, selection).length === 0) {
      children = [el('p', { class: 'hint', i18n: 'reticleDesigner.settings.nothing' })];
    } else if (selection.length === 1 && findElement(ctl.doc, selection[0])) {
      children = buildElement(selection[0]);
    } else {
      children = buildSeveral(selection);
    }
    for (const child of children) body.appendChild(child);
  }

  function update() {
    const key = currentShapeKey();
    if (key !== shapeKey) {
      shapeKey = key;
      rebuild();
    } else {
      for (const sync of syncs) sync();
    }
  }

  return { node, update };
}
