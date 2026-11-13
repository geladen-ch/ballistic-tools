// The Range Solver's Layout dialog: which optional elements the Fire! pane
// shows (scope view, corrections readout, targets list, photo targets), how
// many rows the targets list shows, and whether line-of-sight angles are
// ignored. Opened from the solver's Layout nav item.
//
// Its preview is the pane's own layout (fire-layout.js) built at the
// pane's true size and scaled down, so it shows exactly what the pane
// will. Optional elements that are switched off, or that would have no
// effect right now (fire-elements.js says why), sit in a "Not shown" tray
// under it. Nothing is saved until OK; Cancel discards.
import { el, clear } from '../../dom.js';
import { t } from '../../i18n.js';
import { showDialog } from '../app-dialog.js';
import { getFireConfig, setFireConfig } from '../../range-solver-fire-config.js';
import { MIN_ROW_COUNT, MAX_ROW_COUNT } from '../../range-card-row-count-prefs.js';
import { loadRangeSolverLocationState } from '../../range-solver-state.js';
import { loadUserLocations } from '../../location-library.js';
import { setRangeSolverTab } from '../../range-solver-nav.js';
import { resolveFireElements, effectiveElementIds } from './fire-elements.js';
import { fireLayoutFor, buildFireLayout, FIXED_ELEMENTS } from './fire-layout.js';

const OPTIONAL = ['scope', 'readout', 'list', 'picker'];
const FIXED = new Set(FIXED_ELEMENTS);
// Preview boxes shorter than this (true pane px) put switch and name on
// one line and drop the "Optional" tag.
const SHORT_BOX_PX = 110;

// What the mounted solver view knows and this dialog can't read from
// storage: whether the active gun has a usable scope, and the Fire! pane's
// element (for its true size). Published by range-solver-view.js.
let paneContext = { hasOptic: false, paneNode: null };
export function setFirePaneContext(next) {
  paneContext = { ...paneContext, ...next };
}

function activeLocation() {
  const id = loadRangeSolverLocationState()?.locationId ?? null;
  return id ? loadUserLocations().find((l) => l.id === id) || null : null;
}

const viewport = () => ({
  width: typeof innerWidth === 'number' ? innerWidth : 390,
  height: typeof innerHeight === 'number' ? innerHeight : 844
});

function isLandscape() {
  return typeof matchMedia === 'function' && matchMedia('(orientation: landscape)').matches;
}

// The pane's true size: its own box while it is laid out, else the
// viewport's (the pane fills most of it).
function paneSize() {
  const node = paneContext.paneNode;
  if (node && typeof node.getBoundingClientRect === 'function') {
    const r = node.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return { width: r.width, height: r.height };
  }
  const v = viewport();
  return { width: Math.max(1, v.width - 24), height: Math.max(1, v.height - 24) };
}

function switchGlyph(on) {
  return el('span', { class: 'fire-config-switch' + (on ? ' on' : ''), 'aria-hidden': 'true' });
}

// The dialog body. `draft`: getFireConfig()'s shape, changed in place; `context`: { location, hasOptic,
// orientation, pane: { width, height }, vmin }; `onChange()` runs after
// every change. Returns { node, render, layoutPreview }.
export function fireConfigBody({ draft, context, onChange = () => {} }) {
  const head = el('div', { class: 'fire-config-head' }, [
    el('h1', { i18n: 'rangeSolver.fireConfig.title' }),
    el('p', { i18n: 'rangeSolver.fireConfig.intro' })
  ]);
  const canvas = el('div', { class: 'fire-config-canvas' });
  const tray = el('div', { class: 'fire-config-tray' });
  const preview = el('div', { class: 'fire-config-preview' }, [canvas, tray]);
  const controls = el('div', { class: 'fire-config-controls' });
  const node = el('div', { class: 'fire-config' }, [head, preview, controls]);
  let schem = null;
  let foldLine = null;

  const change = (patch) => {
    Object.assign(draft, patch);
    render();
    onChange();
  };
  const resolved = () => resolveFireElements({ config: draft, location: context.location, hasOptic: context.hasOptic });
  const name = (id, r) => t(`rangeSolver.fireConfig.elements.${id === 'manual' && r.pictureIcon ? 'manualWithPicture' : id}`);

  function box(id, r) {
    if (!OPTIONAL.includes(id)) {
      return el('div', { class: 'fire-config-box' + (FIXED.has(id) ? ' fixed' : ''), text: name(id, r) });
    }
    const b = el('button', {
      type: 'button', class: 'fire-config-box optional', 'aria-pressed': 'true', id: `fireConfigBox-${id}`,
      'aria-label': `${name(id, r)} — ${t('rangeSolver.fireConfig.optional')}`
    }, [switchGlyph(true), el('span', { class: 'fire-config-box-name', text: name(id, r) }),
      el('em', { i18n: 'rangeSolver.fireConfig.optional' })]);
    b.addEventListener('click', () => change({ [id]: false }));
    return b;
  }

  function renderPreview(r) {
    clear(canvas);
    const ids = effectiveElementIds(r);
    const ctx = {
      paneWidth: context.pane.width, paneHeight: context.pane.height, vmin: context.vmin,
      pictureIcon: r.pictureIcon, ignoreLos: r.ignoreLos.effective
    };
    const layout = fireLayoutFor(context.orientation, ids, ctx);
    const cells = Object.fromEntries(ids.map((id) => [id, box(id, r)]));
    const root = buildFireLayout(layout.tree, cells, layout.floorCtx);
    schem = el('div', { class: 'fire-config-schem fire-pane-like' }, [root]);
    schem.style.width = `${context.pane.width}px`;
    schem.style.height = `${context.pane.height}px`;
    canvas.appendChild(schem);
    foldLine = el('div', { class: 'fire-config-fold' }, [el('span', { i18n: 'rangeSolver.fireConfig.screenBottom' })]);
    foldLine.hidden = true;
    canvas.appendChild(foldLine);

    clear(tray);
    const hidden = OPTIONAL.filter((id) => !r[id].effective);
    if (!hidden.length) return;
    tray.appendChild(el('div', { class: 'fire-config-tray-label', i18n: 'rangeSolver.fireConfig.notShown' }));
    const chips = el('div', { class: 'fire-config-chips' });
    for (const id of hidden) {
      const on = draft[id];
      const reason = r[id].reason;
      const chip = el('button', {
        type: 'button', class: 'fire-config-chip', 'aria-pressed': on ? 'true' : 'false', id: `fireConfigChip-${id}`
      }, [switchGlyph(on), el('b', { text: name(id, r) }),
        el('small', { text: reason ? t(`rangeSolver.fireConfig.hints.${reason}`) : t('rangeSolver.fireConfig.off') })]);
      chip.addEventListener('click', () => change({ [id]: !draft[id] }));
      chips.appendChild(chip);
    }
    tray.appendChild(chips);
  }

  function renderControls(r) {
    clear(controls);
    const listOn = r.list.effective;
    const stepperDisabled = draft.listRowsOptimal || !listOn;
    const stepButton = (delta, key) => {
      const b = el('button', { type: 'button', class: 'fire-config-step', 'aria-label': t(`rangeSolver.fireConfig.${key}`), id: `fireConfigRows${delta > 0 ? 'More' : 'Fewer'}`, text: delta > 0 ? '+' : '−' });
      b.disabled = stepperDisabled || (delta > 0 ? draft.listRows >= MAX_ROW_COUNT : draft.listRows <= MIN_ROW_COUNT);
      b.addEventListener('click', () => change({ listRows: Math.min(MAX_ROW_COUNT, Math.max(MIN_ROW_COUNT, draft.listRows + delta)) }));
      return b;
    };
    const optimal = el('input', { type: 'checkbox', id: 'fireConfigOptimal' });
    optimal.checked = !!draft.listRowsOptimal;
    optimal.disabled = !listOn;
    optimal.addEventListener('change', () => change({ listRowsOptimal: optimal.checked }));
    const listHint = listOn
      ? t(draft.listRowsOptimal ? 'rangeSolver.fireConfig.optimalFitHint' : 'rangeSolver.fireConfig.fixedRowsHint')
      : (draft.list ? t(`rangeSolver.fireConfig.hints.${r.list.reason}`) : t('rangeSolver.fireConfig.listOffHint'));
    controls.appendChild(el('div', { class: 'fire-config-group' + (listOn ? '' : ' off') }, [
      el('h2', { i18n: 'rangeSolver.fireConfig.rowsHeading' }),
      el('div', { class: 'fire-config-row' }, [
        el('span', { class: 'fire-config-stepper' + (stepperDisabled ? ' disabled' : '') }, [
          stepButton(-1, 'fewerRows'), el('output', { class: 'fire-config-rows', text: String(draft.listRows) }), stepButton(1, 'moreRows')
        ]),
        el('label', { class: 'fire-config-check' + (listOn ? '' : ' disabled') }, [optimal, el('span', { i18n: 'rangeSolver.fireConfig.optimalFit' })])
      ]),
      el('p', { class: 'fire-config-hint', text: listHint })
    ]));

    const blocked = r.ignoreLos.blocked;
    const ignore = el('input', { type: 'checkbox', id: 'fireConfigIgnoreLos' });
    ignore.checked = !!draft.ignoreLos && !blocked;
    ignore.disabled = blocked;
    ignore.addEventListener('change', () => change({ ignoreLos: ignore.checked }));
    controls.appendChild(el('div', { class: 'fire-config-group' }, [
      el('h2', { i18n: 'rangeSolver.fireConfig.losHeading' }),
      el('label', { class: 'fire-config-check' + (blocked ? ' disabled' : '') }, [ignore, el('span', { i18n: 'rangeSolver.fireConfig.ignoreLos' })]),
      el('p', {
        class: 'fire-config-hint' + (blocked ? ' warn' : ''),
        i18n: blocked ? 'rangeSolver.fireConfig.losBlockedHint' : 'rangeSolver.fireConfig.ignoreLosHint'
      })
    ]));
  }

  // Scales the true-size preview into the space the dialog leaves it, and
  // marks the screen's bottom when the pane will scroll. Needs layout (a
  // shown dialog); a no-op otherwise.
  function layoutPreview() {
    if (!schem || typeof canvas.getBoundingClientRect !== 'function') return;
    const root = schem.firstChild;
    for (const b of schem.querySelectorAll('.fire-config-box.optional')) {
      b.classList.remove('short');
    }
    const scaleNow = () => {
      const rect = schem.getBoundingClientRect();
      return rect.width ? rect.width / context.pane.width : 1;
    };
    const s0 = scaleNow();
    for (const b of schem.querySelectorAll('.fire-config-box.optional')) {
      b.classList.toggle('short', b.getBoundingClientRect().height / s0 < SHORT_BOX_PX);
    }
    const contentH = Math.max(context.pane.height, root.scrollHeight);
    const v = viewport();
    const areaW = Math.max(120, preview.getBoundingClientRect().width);
    const areaH = context.orientation === 'landscape' ? Math.min(0.6 * v.height, 520) : 0.44 * v.height;
    const s = Math.min(areaW / context.pane.width, areaH / contentH);
    schem.style.transform = `scale(${s})`;
    canvas.style.width = `${Math.round(context.pane.width * s)}px`;
    canvas.style.height = `${Math.round(contentH * s)}px`;
    foldLine.hidden = contentH <= context.pane.height + 1;
    foldLine.style.top = `${Math.round(context.pane.height * s)}px`;
  }

  function render() {
    const r = resolved();
    renderPreview(r);
    renderControls(r);
    layoutPreview();
  }

  render();
  return { node, render, layoutPreview };
}

export function openFireConfigDialog() {
  const draft = getFireConfig();
  const v = viewport();
  const context = {
    location: activeLocation(),
    hasOptic: !!paneContext.hasOptic,
    orientation: isLandscape() ? 'landscape' : 'portrait',
    pane: paneSize(),
    vmin: Math.min(v.width, v.height)
  };
  const body = fireConfigBody({ draft, context });
  showDialog({
    bodyNode: body.node,
    size: 'fill',
    buttons: [
      {
        label: t('rangeSolver.fireConfig.ok'),
        onClick: () => {
          setFireConfig(draft);
          setRangeSolverTab('fire');
        }
      },
      { label: t('rangeSolver.fireConfig.cancel') }
    ]
  });
  // The preview can only be scaled once the dialog is laid out.
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => body.layoutPreview());
}
