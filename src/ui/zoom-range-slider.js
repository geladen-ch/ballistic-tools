import { el } from '../dom.js';
import { engineToDisplay, displayToEngine, unitChoice } from '../units.js';
import { getUnit } from '../prefs.js';
import { i18nSpan } from '../i18n.js';

// A "view start" / "view end" range-slider pair for zooming/panning a
// chart's X axis — two native <input type="range"> sliders, shown in the
// user's current distance-unit preference (via the same 'range' field
// metadata the trajectory table's own Range column already converts
// through), mutually constrained so the window between them can never be
// narrower than `minWindowM` (an engine-unit, i.e. unit-preference-
// independent, floor — see trajectory-view.js's MIN_ZOOM_WINDOW_M).
//
// The two sliders' bounds are updated live via plain attribute mutation,
// never by replacing either element — replacing a slider out from under
// an in-progress drag would break the gesture in a real browser. Each
// slider's own 'input' handler only ever touches the *other* slider's
// min/max and its own label text, never its own `.value` (which the
// browser already holds correctly from the user's own drag).
// `idPrefix` distinguishes multiple sliders sharing one page's DOM (the
// Trajectory chart's own vs. the Arsenal Comparison chart's) — defaults
// to the id this component originally shipped with, so the one existing
// caller didn't need updating.
export function zoomRangeSlider({ minWindowM, onInput, idPrefix = 'trajectoryChartView' }) {
  const distanceUnit = getUnit('distance');
  const choice = unitChoice('range', distanceUnit);
  const toDisp = (m) => engineToDisplay('range', m, distanceUnit);
  const toEng = (d) => displayToEngine('range', d, distanceUnit);

  let fullRangeM = minWindowM;
  let startM = 0;
  let endM = minWindowM;

  const startInput = el('input', { type: 'range', id: `${idPrefix}Start` });
  const endInput = el('input', { type: 'range', id: `${idPrefix}End` });
  const startValue = el('span', { class: 'range-slider-value' });
  const endValue = el('span', { class: 'range-slider-value' });

  function formatDisp(m) {
    return `${toDisp(m).toFixed(choice.decimals)} ${choice.label}`;
  }

  function clampStart(candidateM) {
    return Math.max(0, Math.min(candidateM, endM - minWindowM));
  }
  function clampEnd(candidateM) {
    return Math.min(fullRangeM, Math.max(candidateM, startM + minWindowM));
  }

  // Resets every attribute on *both* sliders from the current state —
  // only ever called outside a drag (construction, or setBounds() from an
  // unrelated field changing), never from either slider's own 'input'.
  function applyAll() {
    startInput.min = '0';
    startInput.max = String(toDisp(fullRangeM - minWindowM));
    startInput.value = String(toDisp(startM));
    endInput.min = String(toDisp(minWindowM));
    endInput.max = String(toDisp(fullRangeM));
    endInput.value = String(toDisp(endM));
    startValue.textContent = formatDisp(startM);
    endValue.textContent = formatDisp(endM);
  }

  startInput.addEventListener('input', () => {
    startM = clampStart(toEng(parseFloat(startInput.value)));
    endInput.min = String(toDisp(startM + minWindowM));
    startValue.textContent = formatDisp(startM);
    if (onInput) onInput();
  });
  endInput.addEventListener('input', () => {
    endM = clampEnd(toEng(parseFloat(endInput.value)));
    startInput.max = String(toDisp(endM - minWindowM));
    endValue.textContent = formatDisp(endM);
    if (onInput) onInput();
  });

  // Called whenever the table's own Max Range field changes. If the view
  // was previously showing the full range (the common, "not zoomed in"
  // case), it keeps tracking the full range; otherwise the existing
  // window is preserved as closely as the new bounds allow.
  function setBounds(newFullRangeM) {
    if (!Number.isFinite(newFullRangeM)) return; // caller's field is mid-edit / invalid — nothing to apply yet
    const wasFullyZoomedOut = startM <= 1e-6 && endM >= fullRangeM - 1e-6;
    fullRangeM = Math.max(newFullRangeM, minWindowM);
    if (wasFullyZoomedOut) {
      startM = 0;
      endM = fullRangeM;
    } else {
      startM = clampStart(startM);
      endM = clampEnd(endM);
    }
    applyAll();
  }

  setBounds(minWindowM);

  const node = el('div', {}, [
    el('div', { class: 'field' }, [
      el('label', {}, [i18nSpan('fields.chartViewStart'), startValue]),
      startInput
    ]),
    el('div', { class: 'field' }, [
      el('label', {}, [i18nSpan('fields.chartViewEnd'), endValue]),
      endInput
    ])
  ]);

  return {
    node,
    setBounds,
    getWindow: () => ({ startM, endM })
  };
}
