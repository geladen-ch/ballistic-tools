import { el, clear } from '../dom.js';
import { getPool } from '../pool.js';
import { unitField } from '../ui/unit-field.js';
import { atmosphereSection } from '../ui/sections/atmosphere-section.js';
import { setDragModelSelectValue } from '../ui/drag-model-select.js';
import { applyI18nText, t } from '../i18n.js';

// Session-only (in-memory, not persisted across a reload — no cookie
// backing needed) state for the Calculation panel's own fields, so
// navigating away to another tool and back doesn't reset them to their
// hardcoded defaults. Same pattern hit-probability-view.js uses for its
// own panel fields (module-level, read once at mount, written on every
// change), scoped to this view. The active tab/mode itself is deliberately
// NOT persisted here, matching that same precedent — only field values are.
let panelState = {};

function persistedValue(key, defaultValue) {
  return key in panelState ? panelState[key] : defaultValue;
}

// A unitField() that reads its initial value from panelState and writes
// back to it on every change.
function persistedUnitField(id, { onInput, ...rest }) {
  const initialValue = persistedValue(id, rest.value);
  let field;
  field = unitField({
    ...rest, id, value: initialValue,
    onInput: () => {
      panelState[id] = field.getEngineValue();
      if (onInput) onInput();
    }
  });
  return field;
}

// A tiny reusable tab-switcher: `tabs` is [{ key, labelKey }], `onSwitch`
// is called with the newly active key after the button classes and
// visibility are already updated. Same hand-rolled pattern already
// shipping in hit-probability-view.js (own buttons/panels, no route
// change, no shared component) — used twice here, once for the outer
// Calculation/Conversion/Labradar tabs and once for the inner Velocity/ToF
// mode switch.
function tabSwitcher(tabs, panels, onSwitch) {
  const buttons = tabs.map((tabDef, i) => {
    const btn = el('button', { type: 'button', class: 'tab-btn' + (i === 0 ? ' active' : ''), i18n: tabDef.labelKey });
    btn.addEventListener('click', () => {
      for (const b of buttons) b.className = 'tab-btn';
      btn.className = 'tab-btn active';
      for (const key of Object.keys(panels)) panels[key].style.display = key === tabDef.key ? '' : 'none';
      if (onSwitch) onSwitch(tabDef.key);
    });
    return btn;
  });
  return { node: el('div', { class: 'section-tabs' }, buttons) };
}

export function mount(container) {
  clear(container);

  const dragModelSelect = el('select', { id: 'dragModel' });
  setDragModelSelectValue(dragModelSelect, persistedValue('dragModel', 'G1'));
  dragModelSelect.addEventListener('change', () => {
    panelState.dragModel = dragModelSelect.value;
  });
  const atmosphere = atmosphereSection({ includeWind: false });

  // ---- Shared fields (both Velocity and ToF mode) ----
  const v1Field = persistedUnitField('v1', { value: 880, step: 0.1 });
  const r1Field = persistedUnitField('r1', { value: 3, step: 1 });
  const r2Field = persistedUnitField('r2', { value: 300, step: 1 });

  // ---- Mode-specific field: far velocity (v2) vs. time of flight (tof) ----
  const v2Field = persistedUnitField('v2', { value: 780, step: 0.1 });
  const tofInput = el('input', { type: 'number', id: 'tof', step: '0.001', value: persistedValue('tof', '0.35') });
  tofInput.addEventListener('input', () => {
    panelState.tof = tofInput.value;
  });
  const tofField = el('div', { class: 'field' }, [
    el('label', { i18n: 'fields.tof' }),
    tofInput
  ]);
  tofField.style.display = 'none';

  let mode = 'velocity'; // 'velocity' | 'tof'
  const modeSwitcher = tabSwitcher(
    [
      { key: 'velocity', labelKey: 'bcEstimate.modeVelocity' },
      { key: 'tof', labelKey: 'bcEstimate.modeTof' }
    ],
    { velocity: v2Field.node, tof: tofField },
    (key) => {
      mode = key;
      invalidateResult();
    }
  );

  const status = el('div', { class: 'status', i18n: 'common.idle' });
  const result = el('div', { id: 'bc-result', class: 'card', style: 'font-size:28px;font-weight:700;color:var(--accent);' }, ['—']);
  const runButton = el('button', { class: 'section-button', i18n: 'bcEstimate.estimateButton' });

  const controls = el('div', { class: 'card' }, [
    el('h2', { i18n: 'bcEstimate.measuredVelocitiesHeading' }),
    modeSwitcher.node,
    v1Field.node, r1Field.node, v2Field.node, tofField, r2Field.node,
    el('div', { class: 'field' }, [el('label', { i18n: 'common.dragModel' }), dragModelSelect]),
    atmosphere.node,
    runButton,
    status
  ]);

  const results = el('div', { class: 'tool-results' }, [
    el('div', {}, [el('h2', { i18n: 'bcEstimate.resultHeading' }), result])
  ]);

  const calculationPanel = el('div', {}, [
    el('p', { i18n: 'bcEstimate.intro' }),
    el('div', { class: 'tool-layout' }, [controls, results])
  ]);
  const conversionPanel = el('div', { class: 'card' }, [
    el('p', { i18n: 'bcTools.conversionStub' })
  ]);
  conversionPanel.style.display = 'none';
  const labradarPanel = el('div', { class: 'card' }, [
    el('p', { i18n: 'bcTools.labradarStub' })
  ]);
  labradarPanel.style.display = 'none';

  const outerPanels = { calculation: calculationPanel, conversion: conversionPanel, labradar: labradarPanel };
  const outerTabs = tabSwitcher(
    [
      { key: 'calculation', labelKey: 'bcTools.tabCalculation' },
      { key: 'conversion', labelKey: 'bcTools.tabConversion' },
      { key: 'labradar', labelKey: 'bcTools.tabLabradar' }
    ],
    outerPanels
  );

  container.appendChild(el('div', {}, [
    el('h1', { i18n: 'bcTools.title' }),
    el('p', { i18n: 'bcTools.intro' }),
    outerTabs.node,
    calculationPanel,
    conversionPanel,
    labradarPanel
  ]));

  // ---- Read inputs / run ----
  function readTof() {
    const raw = tofInput.value;
    const parsed = parseFloat(raw);
    if (raw.trim() === '' || Number.isNaN(parsed) || parsed <= 0) {
      throw new Error(t('bcTools.invalidTof'));
    }
    return parsed;
  }

  function readInputs() {
    const base = {
      dragModel: dragModelSelect.value,
      ...atmosphere.getValues(),
      v1: v1Field.getEngineValue(),
      r1: r1Field.getEngineValue(),
      r2: r2Field.getEngineValue()
    };
    return mode === 'velocity'
      ? { ...base, v2: v2Field.getEngineValue() }
      : { ...base, tof: readTof() };
  }

  const pool = getPool();
  let latestRequestId = 0;

  function invalidateResult() {
    latestRequestId++;
    clear(result);
    result.appendChild(document.createTextNode('—'));
    applyI18nText(status, 'common.idle');
    status.className = 'status';
  }

  async function run() {
    const id = ++latestRequestId;
    applyI18nText(status, 'common.computing');
    status.className = 'status';
    runButton.disabled = true;
    try {
      const jobType = mode === 'velocity' ? 'bcEstimate' : 'bcEstimateTof';
      const { bc } = await pool.run(jobType, readInputs());
      if (id !== latestRequestId) return;
      clear(result);
      result.appendChild(document.createTextNode(bc.toFixed(4)));
      applyI18nText(status, 'bcEstimate.statusOk');
      status.className = 'status ok';
    } catch (err) {
      if (id !== latestRequestId) return;
      applyI18nText(status, 'common.error', { message: err.message });
      status.className = 'status error';
    } finally {
      if (id === latestRequestId) runButton.disabled = false;
    }
  }

  runButton.addEventListener('click', run);
  run();

  return () => {
    latestRequestId++;
  };
}

// Test-only: resets the Calculation panel's persisted field values back to
// "nothing saved yet" — same purpose resetHitProbabilityStateForTests()
// serves for hit-probability-view.js's own panelState, needed because
// tests that mount() this view multiple times in one process would
// otherwise see values leak in from an earlier test case.
export function resetBcToolsStateForTests() {
  panelState = {};
}
