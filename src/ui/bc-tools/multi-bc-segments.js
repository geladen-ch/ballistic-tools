// The interactive chart+table pair at the heart of the "Multiple BC"
// tool: a reference drag-model curve, shown as a backdrop the user drags
// speed-segment borders over (graphically, via an overlay of draggable
// handles on top of the Chartist chart), plus a table that mirrors the
// same borders/BC values and can edit them by typing. Both views are
// kept in perfect sync — every change, from either input path, re-renders
// both from one shared internal state.
//
// No existing chart in this codebase has a draggable overlay in data-
// coordinate space (checked). The pixel<->velocity mapping below is
// still low-risk: this component's own chart is built with
// `axisX: { type: FixedScaleAxis, low: 0, high, divisor }` rather than
// AutoScaleAxis specifically so the axis bounds are *exactly* the given
// low/high (FixedScaleAxis's own range.min/max), never "nicely"
// rounded/padded the way AutoScaleAxis's are — and the chart's own
// `'created'` event (fired on every render, initial and every `.update()`)
// hands back the live `chartRect`/`axisX` objects Chartist itself just
// drew with. Reading `chartRect.x1`/`chartRect.width()` and
// `axisX.range.min/max` straight off that event — rather than
// hand-duplicating Chartist's own scale math — is what makes the pixel
// <-> velocity conversion below a plain linear interpolation that can
// never drift from what's actually on screen. The chart's own SVG has no
// `viewBox` (this app's chart options never set one), so its internal
// drawing units are the container's own true CSS pixels — no separate
// scale factor is needed the way wind-direction-dial.js's fixed-viewBox
// SVG requires.
import { el, clear } from '../../dom.js';
import { LineChart, FixedScaleAxis } from '../../vendor/chartist/index.js';
import { DRAG_TABLES } from '../../engine/drag-tables.js';
import { bcSegmentsToCdCurve, machForVelocityMs, velocityMsForMach, validateSegments } from '../../engine/bc-segments-cd.js';
import { FIELD_BOUNDS } from '../../units.js';
import { fieldValidity } from '../field-validity.js';
import { t, i18nSpan } from '../../i18n.js';
import Qty from '../../vendor/js-quantities/quantities.mjs';

const MIN_SEGMENTS = 2;
const MAX_SEGMENTS = 5;
const BC_BOUNDS = FIELD_BOUNDS.bc;
// Reused for segment-border sanity bounds — same physical quantity as
// muzzle velocity, same "one bound, not a per-view guess" convention
// units.js's own FIELD_BOUNDS comment already documents for BC Tools'
// v1/v2/conversion velocity.
const BORDER_BOUNDS_MS = FIELD_BOUNDS.muzzleVelocity;

function toDisplay(velocityMs, unit) {
  return unit === 'm/s' ? velocityMs : Qty(velocityMs, 'm/s').to(unit).scalar;
}
function toMs(value, unit) {
  return unit === 'm/s' ? value : Qty(value, unit).to('m/s').scalar;
}
// Rounds in the *display* unit first, then converts that rounded value
// back to m/s for storage — never the other way around (a locked-in
// design decision: round-then-convert, not convert-then-round), so a
// border always reads as a clean whole number in whichever unit it's
// currently shown in.
function roundedMsFromDisplay(value, unit) {
  return toMs(Math.round(value), unit);
}

// segments: [{ toVelocityMs, bc }], derived fresh from borders/bcValues
// on every read — never stored as its own independent state, so it can
// never drift out of sync with the two arrays that actually own the data.
function toSegments(borders, bcValues) {
  return bcValues.map((bc, i) => ({ toVelocityMs: i < borders.length ? borders[i] : null, bc }));
}

// `initial*` restores a previous session's state (see bc-tools-view.js's
// own session-only panelState) — omitted/invalid falls back to the
// starting default (split exactly at Mach 1.0, both BCs blank).
export function multiBcSegments({
  initialBordersMs, initialBcValues, initialDragModel, initialSpeedUnit, initialMassKg, initialCaliberM, onChange
} = {}) {
  const hasValidInitialState = Array.isArray(initialBordersMs) && Array.isArray(initialBcValues)
    && initialBcValues.length === initialBordersMs.length + 1;
  let borders = hasValidInitialState ? [...initialBordersMs] : [velocityMsForMach(1.0)];
  let bcValues = hasValidInitialState ? [...initialBcValues] : [null, null];
  let dragModel = initialDragModel || 'G1';
  let speedUnit = initialSpeedUnit || 'm/s';
  // Both default to null ("not entered yet"), not some placeholder
  // physical value — bcSegmentsToCdCurve()'s own validMassCaliber check
  // (massKg > 0 && caliberM > 0) already treats null as "can't compute
  // yet" and reports an all-null curve, matching caliberM's own
  // longstanding null-until-entered default; massKg used to default to
  // 0.01 here, which meant a blank mass field silently produced a
  // plausible-looking curve behind the scenes even though Save/CSV/Copy
  // stayed disabled — masking the very thing bc-tools-view.js's own
  // `highlightRequired` mark now asks the user to actually fill in.
  let massKg = initialMassKg ?? null;
  let caliberM = initialCaliberM ?? null;

  let chart = null;
  let lastChartRect = null;
  let lastAxisX = null;

  const chartContainer = el('div', { class: 'chart-container bc-segments-chart' });
  const overlay = el('div', { class: 'bc-segment-overlay' });
  const chartWrap = el('div', { class: 'bc-segments-chart-wrap' }, [chartContainer, overlay]);
  // Mach is the chart's own primary X axis (bottom, native Chartist axis —
  // see renderChart() below). Absolute velocity, in the user's chosen
  // unit, is the secondary scale: Chartist itself has no dual/secondary-
  // axis feature (checked its vendored source), so this is a plain
  // sibling strip above the chart, its own tick labels positioned via the
  // exact same chartRect/axisX mapping the segment handles use
  // (machToPx() below), not a Chartist-native axis.
  const velocityRuler = el('div', { class: 'bc-velocity-ruler' });
  const chartHint = el('p', { class: 'hint', i18n: 'multiBc.chartHint' });
  const capHint = el('p', { class: 'hint warning' });
  capHint.style.display = 'none';

  // This panel is built eagerly at bc-tools-view.js's own mount() time,
  // regardless of which outer tab is active — so the very first chart
  // render can happen while chartContainer is still `display: none`
  // (Calculation is the default tab), and Chartist reads a 0-width
  // chartRect at that moment. Nothing would otherwise ever refresh it —
  // every existing recompute path (drag, typed edit, mass/caliber/model/
  // unit change) is user-driven, and a passive first visit to this tab
  // triggers none of them. A ResizeObserver catches exactly the moment
  // chartContainer's real size becomes known (hidden -> visible on tab
  // switch, and incidentally any later window resize too) and re-renders
  // then — feature-detected since this app's test harness's fake DOM has
  // no ResizeObserver.
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(() => { if (chart) renderChart(); }).observe(chartContainer);
  }

  const tableBody = el('tbody', {});
  const table = el('table', { class: 'multi-bc-table' }, [
    el('thead', {}, [el('tr', {}, [
      el('th', { i18n: 'multiBc.fromColumn' }),
      el('th', { i18n: 'multiBc.toColumn' }),
      el('th', { i18n: 'multiBc.bcColumn' })
    ])]),
    tableBody
  ]);

  function segmentCount() {
    return bcValues.length;
  }

  // ---- Coordinate mapping (chart data space <-> overlay pixel space) ----
  // The chart's own axisX is Mach-domained (see renderChart()) — every
  // pixel<->data conversion below goes through Mach, then in/out of
  // velocity at the edges, rather than through display-unit velocity the
  // way it did back when velocity was the chart's own primary axis.
  function machToPx(mach) {
    if (!lastChartRect || !lastAxisX) return 0;
    return lastChartRect.x1 + lastAxisX.projectValue(mach);
  }
  function velocityToPx(velocityMs) {
    return machToPx(machForVelocityMs(velocityMs));
  }
  function pxToMach(px) {
    if (!lastChartRect || !lastAxisX) return 0;
    const { min, max } = lastAxisX.range;
    const frac = (px - lastChartRect.x1) / lastChartRect.width();
    return min + frac * (max - min);
  }
  // Returns the *display*-unit velocity directly (not m/s) — every caller
  // immediately rounds in the display unit anyway (round-then-convert,
  // the locked-in design decision), so this skips the redundant m/s
  // round-trip in between.
  function pxToDisplayVelocity(px) {
    return toDisplay(velocityMsForMach(pxToMach(px)), speedUnit);
  }
  function clientXToOverlayPx(clientX) {
    const rect = chartContainer.getBoundingClientRect();
    return clientX - rect.left;
  }

  // ---- Handles (drag/remove) + click-to-add ----
  function neighborBoundsMs(index) {
    const lower = index === 0 ? 0 : borders[index - 1];
    const upper = index === borders.length - 1 ? null : borders[index + 1];
    return { lower, upper };
  }

  // One real DOM node per interior border, index-aligned with `borders` —
  // kept alive across drags (see updateOverlayPositions() below) rather
  // than rebuilt on every pointermove.
  let handleEls = [];

  // Destructive rebuild — only safe/needed when the *number* of borders
  // has changed (add/remove) or on first mount. Was previously called on
  // every single pointermove during a drag (via the old renderOverlay()),
  // which destroyed and recreated the very handle element that had just
  // been given pointer capture — per the Pointer Events spec, capture is
  // implicitly released the instant its element leaves the document, so
  // every drag silently stopped tracking the mouse after its first
  // pixel of movement (this is the actual bug behind "dragging doesn't
  // work"). Dragging now only ever calls updateOverlayPositions().
  function buildOverlay() {
    clear(overlay);
    handleEls = borders.map((borderMs, index) => {
      const handle = el('div', { class: 'bc-segment-handle' });
      const grip = el('div', { class: 'bc-segment-handle-grip' });
      // Only offer removal down to the floor of MIN_SEGMENTS segments —
      // below that there's nothing left to merge into.
      if (segmentCount() > MIN_SEGMENTS) {
        const remove = el('span', { class: 'bc-segment-handle-remove', 'aria-label': t('multiBc.removeSegment') }, ['×']);
        remove.addEventListener('pointerdown', (evt) => evt.stopPropagation());
        remove.addEventListener('click', (evt) => {
          evt.stopPropagation();
          removeBorder(index);
        });
        grip.appendChild(remove);
      }
      handle.appendChild(grip);
      handle.appendChild(el('div', { class: 'bc-segment-handle-line' }));

      // A plain click (no real drag) on the handle must never bubble to
      // the overlay's own "click empty space to add" listener below —
      // without this, releasing a drag (or just clicking the handle)
      // could spuriously insert a brand-new segment right where the
      // drag ended.
      handle.addEventListener('click', (evt) => evt.stopPropagation());

      let dragging = false;
      handle.addEventListener('pointerdown', (evt) => {
        evt.preventDefault(); // suppress native drag/text-selection competing with the gesture
        evt.stopPropagation();
        dragging = true;
        if (handle.setPointerCapture) handle.setPointerCapture(evt.pointerId);
        dragTo(evt);
      });
      handle.addEventListener('pointermove', (evt) => { if (dragging) dragTo(evt); });
      handle.addEventListener('pointerup', () => { dragging = false; });
      handle.addEventListener('pointercancel', () => { dragging = false; });
      function dragTo(evt) {
        const { lower, upper } = neighborBoundsMs(index);
        let velocityMs = roundedMsFromDisplay(pxToDisplayVelocity(clientXToOverlayPx(evt.clientX)), speedUnit);
        // Clamped strictly inside its own neighbors — a border can never
        // cross or touch another one via dragging (matches the "from
        // cannot exceed to" sanity check, kept strict here since a
        // zero-width segment has nothing meaningful to show) — AND inside
        // the same sanity bound the typed "to" field validates against
        // (BORDER_BOUNDS_MS). A typed field can only *show* a violation
        // and let the user retype; a drag has no equivalent recovery, so
        // it clamps instead of ever landing somewhere the table would
        // immediately flag as invalid.
        const minMs = Math.max(
          roundedMsFromDisplay(toDisplay(lower, speedUnit) + 1, speedUnit),
          BORDER_BOUNDS_MS.min
        );
        const maxMs = Math.min(
          upper == null ? Infinity : roundedMsFromDisplay(toDisplay(upper, speedUnit) - 1, speedUnit),
          BORDER_BOUNDS_MS.max
        );
        velocityMs = Math.min(Math.max(velocityMs, minMs), maxMs);
        borders[index] = velocityMs;
        // Never rebuilds — see this function's own header comment.
        // updateTableValues() only touches text/values in place, and
        // recomputeAndRenderChart()'s own chart.update() re-triggers the
        // 'created' handler below, which repositions (not rebuilds) the
        // still-alive, still-captured handle.
        updateTableValues();
        recomputeAndRenderChart();
        if (onChange) onChange();
      }

      return handle;
    });
    for (const handle of handleEls) overlay.appendChild(handle);
    updateOverlayPositions();
  }

  // Repositions the existing handle elements in place (never destroys/
  // recreates them) — safe to call on every drag frame, chart redraw, or
  // speed-unit switch. Self-heals into a full buildOverlay() if the
  // number of handles has drifted from the number of borders (segment
  // count just changed, or this is the very first render).
  function updateOverlayPositions() {
    if (handleEls.length !== borders.length) { buildOverlay(); return; }
    borders.forEach((borderMs, i) => {
      handleEls[i].style.left = `${velocityToPx(borderMs)}px`;
    });
  }

  // Secondary velocity-scale ticks, one per 0.5-Mach step (same physical
  // positions as the chart's own primary Mach gridlines — see
  // renderChart()'s axisX.divisor) from 0 up to the reference table's own
  // top Mach (5.0 for every built-in model except GS, which tops out at
  // 4.0 — read fresh off DRAG_TABLES rather than hardcoded, so this always
  // matches whatever chartDomainHighMach() itself just drew the chart to).
  const MACH_TICK_STEP = 0.5;
  function renderVelocityRuler() {
    clear(velocityRuler);
    if (!lastChartRect || !lastAxisX) return;
    const [topMach] = DRAG_TABLES[dragModel][DRAG_TABLES[dragModel].length - 1];
    for (let mach = 0; mach <= topMach + 1e-9; mach += MACH_TICK_STEP) {
      const label = Math.round(toDisplay(velocityMsForMach(mach), speedUnit));
      const tick = el('span', { class: 'bc-velocity-tick' }, [String(label)]);
      tick.style.left = `${machToPx(mach)}px`;
      velocityRuler.appendChild(tick);
    }
  }

  // Click on empty overlay space (not a handle, not the remove glyph —
  // both stopPropagation their own pointerdown) adds a new border there.
  overlay.addEventListener('click', (evt) => {
    if (segmentCount() >= MAX_SEGMENTS) {
      capHint.textContent = t('multiBc.maxSegmentsHint', { max: MAX_SEGMENTS });
      capHint.style.display = '';
      return;
    }
    const px = clientXToOverlayPx(evt.clientX);
    const clickedRounded = roundedMsFromDisplay(pxToDisplayVelocity(px), speedUnit);
    // Same sanity bound dragging/typing a border are held to (see
    // dragTo()'s own clamp) — a click near the domain's own edges (0, or
    // the reference table's own top Mach) would otherwise insert a
    // border the table immediately flags as invalid, with no drag-style
    // clamp to recover from since a click is a single discrete position.
    if (clickedRounded < BORDER_BOUNDS_MS.min || clickedRounded > BORDER_BOUNDS_MS.max) return;
    // Which existing segment the click landed in, and how far from its
    // own borders — reject clicks too close to an existing border or to
    // the domain edge (nothing meaningful to split there, and it avoids
    // an accidental zero-width segment).
    const segIndex = borders.findIndex((b) => clickedRounded < b);
    const lowerMs = segIndex === -1 ? (borders[borders.length - 1] ?? 0) : (segIndex === 0 ? 0 : borders[segIndex - 1]);
    const upperMs = segIndex === -1 ? null : borders[segIndex];
    const marginMs = toMs(1, speedUnit);
    if (clickedRounded - lowerMs < marginMs || (upperMs != null && upperMs - clickedRounded < marginMs)) return;

    const insertAt = segIndex === -1 ? borders.length : segIndex;
    borders.splice(insertAt, 0, clickedRounded);
    bcValues.splice(insertAt, 0, null); // the newly split-off lower half starts blank; the upper half keeps whatever it had
    capHint.style.display = 'none';
    renderAll();
    if (onChange) onChange();
  });

  function removeBorder(index) {
    // Merge rule: the higher segment's BC wins if set, else the lower
    // one's, else blank.
    const merged = bcValues[index + 1] ?? bcValues[index] ?? null;
    bcValues.splice(index, 2, merged);
    borders.splice(index, 1);
    capHint.style.display = 'none';
    renderAll();
    if (onChange) onChange();
  }

  // ---- Table ----
  function computeToMessage(index) {
    return () => {
      const input = toInputs[index];
      const raw = input.value.trim();
      if (raw === '') return t('fields.errorRequired');
      const parsed = parseFloat(raw);
      if (Number.isNaN(parsed) || !Number.isInteger(parsed)) return t('multiBc.errorWholeNumber');
      const velocityMs = toMs(parsed, speedUnit);
      const { lower, upper } = neighborBoundsMs(index);
      if (velocityMs <= lower) return t('multiBc.errorFromExceedsTo');
      if (upper != null && velocityMs >= upper) return t('multiBc.errorFromExceedsTo');
      const { min, max } = BORDER_BOUNDS_MS;
      if (velocityMs < min || velocityMs > max) {
        const dmin = Math.round(toDisplay(min, speedUnit));
        const dmax = Math.round(toDisplay(max, speedUnit));
        return t('fields.errorRange', { range: `${dmin} – ${dmax} ${speedUnit}` });
      }
      return null;
    };
  }
  function computeBcMessage(index) {
    return () => {
      const raw = bcInputs[index].value.trim();
      if (raw === '') return t('fields.errorRequired');
      const parsed = parseFloat(raw);
      if (Number.isNaN(parsed)) return t('fields.errorRequired');
      if (parsed < BC_BOUNDS.min || parsed > BC_BOUNDS.max) {
        return t('fields.errorRange', { range: `${BC_BOUNDS.min} – ${BC_BOUNDS.max}` });
      }
      return null;
    };
  }

  let toInputs = [];
  let toValidities = [];
  let fromCells = [];
  let bcInputs = [];

  function fromText(i) {
    const fromMs = i === 0 ? 0 : borders[i - 1];
    return String(Math.round(toDisplay(fromMs, speedUnit)));
  }

  // Full rebuild — only needed when the *number of rows* changes (add/
  // remove segment) or on first mount. Everything else (drag, typing a
  // "to" value, switching the speed unit) goes through
  // updateTableValues() below instead, so an actively-focused input is
  // never destroyed out from under the user mid-edit.
  function buildTable() {
    clear(tableBody);
    toInputs = [];
    toValidities = [];
    fromCells = [];
    bcInputs = [];
    for (let i = 0; i < segmentCount(); i++) {
      const fromCell = el('td', { class: 'multi-bc-from', text: fromText(i) });
      fromCells[i] = fromCell;

      let toCell;
      if (i < borders.length) {
        const toInput = el('input', { type: 'number', id: `multiBcTo${i}`, step: 1, value: String(Math.round(toDisplay(borders[i], speedUnit))) });
        const toValidity = fieldValidity(toInput, computeToMessage(i));
        toInput.addEventListener('input', () => {
          if (toValidity.validate()) {
            borders[i] = toMs(parseFloat(toInput.value), speedUnit);
            // Cascades to the next row's own "from" display, and
            // re-checks every other row's cross-field validity (this
            // border is their neighbor too) — never this input's own
            // .value, which already reflects what was just typed.
            updateTableValues();
            updateOverlayPositions();
            recomputeAndRenderChart();
          }
          if (onChange) onChange();
        });
        toInputs[i] = toInput;
        toValidities[i] = toValidity;
        toCell = el('td', {}, [toInput, toValidity.hintNode]);
      } else {
        toCell = el('td', { class: 'multi-bc-to-open', i18n: 'multiBc.andUp' });
      }

      const bcInput = el('input', { type: 'number', id: `multiBcBc${i}`, step: 0.001, value: bcValues[i] != null ? String(bcValues[i]) : '' });
      const bcValidity = fieldValidity(bcInput, computeBcMessage(i));
      bcInput.addEventListener('input', () => {
        const raw = bcInput.value.trim();
        bcValues[i] = raw === '' ? null : parseFloat(raw);
        bcValidity.validate();
        if (onChange) onChange();
        recomputeAndRenderChart();
      });
      bcInputs[i] = bcInput;

      tableBody.appendChild(el('tr', {}, [fromCell, toCell, el('td', {}, [bcInput, bcValidity.hintNode])]));
    }
  }

  // Updates every "from" cell's text and every "to" input's own value
  // (skipping whichever one currently has focus, so a value the user is
  // actively typing into is never overwritten out from under them) plus
  // re-runs every row's cross-field validity — border i is both row i's
  // own upper bound and row i+1's lower bound, so a single edit can
  // affect two rows' messages, not just the one that changed.
  function updateTableValues() {
    for (let i = 0; i < fromCells.length; i++) fromCells[i].textContent = fromText(i);
    for (let i = 0; i < toInputs.length; i++) {
      if (document.activeElement !== toInputs[i]) {
        toInputs[i].value = String(Math.round(toDisplay(borders[i], speedUnit)));
      }
    }
    for (const v of toValidities) if (v) v.validate();
  }

  // ---- Chart ----
  // Chart data is Mach-native on the X axis (the chart's own primary
  // scale — see renderChart()'s axisX below); DRAG_TABLES' own [mach, cd]
  // pairs and bcSegmentsToCdCurve()'s own per-point `mach` need no unit
  // conversion at all to become chart x-values, unlike back when velocity
  // was the primary axis.
  function referenceCurvePoints() {
    return DRAG_TABLES[dragModel].map(([mach, cd]) => ({ x: mach, y: cd }));
  }
  function resultCurvePoints() {
    const curve = bcSegmentsToCdCurve({ dragModel, segments: toSegments(borders, bcValues), massKg, caliberM });
    return curve.map((p) => ({ x: p.mach, y: p.cd }));
  }

  function chartDomainHighMach() {
    const [lastMach] = DRAG_TABLES[dragModel][DRAG_TABLES[dragModel].length - 1];
    return lastMach;
  }

  function renderChart() {
    const highMach = chartDomainHighMach();
    const series = [
      { name: 'reference', data: referenceCurvePoints() },
      { name: 'result', data: resultCurvePoints() }
    ];
    const options = {
      fullWidth: true,
      chartPadding: { right: 24 },
      // divisor is chosen so gridlines land exactly on 0.5-Mach steps
      // (the requested grid density) regardless of the reference model's
      // own top Mach (5.0 for most, 4.0 for GS). labelInterpolationFnc
      // rounds only the *rendered label text* to one decimal — the tick's
      // own position (and everything this component's own
      // machToPx()/pxToMach() computes from axisX.range) stays exact.
      // Needed specifically because FixedScaleAxis (unlike AutoScaleAxis)
      // has no onlyInteger/bounds-rounding of its own.
      axisX: {
        type: FixedScaleAxis, low: 0, high: highMach, divisor: Math.round(highMach / MACH_TICK_STEP),
        labelInterpolationFnc: (value) => value.toFixed(1)
      },
      axisY: { onlyInteger: false },
      showPoint: false,
      showLine: true,
      series: {
        reference: { showLine: true, lineSmooth: false },
        result: { showLine: true, lineSmooth: true }
      }
    };
    if (!chart) {
      chart = new LineChart(chartContainer, { series }, options);
      chart.on('created', ({ chartRect, axisX }) => {
        lastChartRect = chartRect;
        lastAxisX = axisX;
        updateOverlayPositions();
        renderVelocityRuler();
      });
    } else {
      chart.update({ series }, options, true);
    }
  }

  function recomputeAndRenderChart() {
    renderChart();
  }

  // Full rebuild — segment count just changed (add/remove) or this is
  // the initial mount.
  function renderAll() {
    buildTable();
    renderChart();
  }

  const legend = el('div', { class: 'chart-legend' }, [
    el('span', { class: 'chart-legend-item chart-legend-a' }, [el('span', { class: 'chart-legend-swatch' }), i18nSpan('multiBc.legendReference')]),
    el('span', { class: 'chart-legend-item chart-legend-b' }, [el('span', { class: 'chart-legend-swatch' }), i18nSpan('multiBc.legendResult')])
  ]);

  const node = el('div', {}, [
    chartHint,
    legend,
    velocityRuler,
    chartWrap,
    capHint,
    table
  ]);

  renderAll();

  return {
    node,
    setDragModel(id) {
      // Segments/borders are entirely independent of the reference
      // model — only the chart (both series, plus its own domain, since
      // different models' tables span different Mach ranges) needs
      // redrawing.
      dragModel = id;
      renderChart();
    },
    setSpeedUnit(unit) {
      // Restate, don't reset — every border is already stored SI (m/s),
      // so "restating" it just means re-rounding it fresh in the new
      // display unit rather than clearing it. Segment count is
      // unaffected, so this uses the lighter in-place update, same as a
      // drag.
      speedUnit = unit;
      borders = borders.map((ms) => roundedMsFromDisplay(toDisplay(ms, unit), unit));
      updateTableValues();
      // renderChart()'s own chart.update() re-triggers the 'created'
      // handler above, which repositions the overlay — no separate call
      // needed here.
      renderChart();
    },
    setMassCaliber(newMassKg, newCaliberM) {
      massKg = newMassKg;
      caliberM = newCaliberM;
      renderChart();
    },
    getSpeedUnit: () => speedUnit,
    getSegments: () => toSegments(borders, bcValues),
    getMassKg: () => massKg,
    getCaliberM: () => caliberM,
    getDragModel: () => dragModel,
    getValidity: () => validateSegments(toSegments(borders, bcValues), BC_BOUNDS),
    getCurve: () => bcSegmentsToCdCurve({ dragModel, segments: toSegments(borders, bcValues), massKg, caliberM })
  };
}
