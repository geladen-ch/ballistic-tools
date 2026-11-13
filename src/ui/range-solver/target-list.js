// The Fire! pane's targets list: every target at the active location,
// solved at once and sorted by range, with the selected one enlarged. Tap
// a row to select its target. With no selection (a hand-typed range),
// every row is the same small size.
//
// Renders and dispatches only — the caller (range-solver-view.js) computes
// each row's display strings and correction values and hands them in via
// refresh(). The table's class names (range-card-*) are historical: this
// list grew out of the Range Card tab.
//
// How many rows show: a visible-height budget on the table body (it
// scrolls past it), either "as many whole rows as fit the list's cell"
// (Optimal fit) or a fixed count, capped at what fits.
import { el, clear } from '../../dom.js';
import { MAX_ROW_COUNT } from '../../range-card-row-count-prefs.js';

// A slim custom vertical scrollbar for the table body. A plain
// overflow-y:auto div already gets a real, platform-styled scrollbar, but
// on touch tablets the native one can be a sliver too thin to reliably
// grab — this one is deliberately fat, at a predictable spot (the table's
// own right edge), and draggable anywhere on its track. Hidden whenever
// the content doesn't overflow.
function tableScrollbar(scrollEl) {
  const thumb = el('div', { class: 'range-card-scrollbar-thumb' });
  const track = el('div', { class: 'range-card-scrollbar-track range-card-scrollbar--hidden' }, [thumb]);

  function refresh() {
    const { scrollHeight, clientHeight, scrollTop } = scrollEl;
    const overflowing = scrollHeight > clientHeight + 1;
    track.classList.toggle('range-card-scrollbar--hidden', !overflowing);
    if (!overflowing) return;
    const trackH = track.clientHeight;
    const thumbH = Math.max(24, trackH * (clientHeight / scrollHeight));
    const maxThumbTop = trackH - thumbH;
    const scrollRange = scrollHeight - clientHeight;
    const thumbTop = scrollRange ? (scrollTop / scrollRange) * maxThumbTop : 0;
    thumb.style.height = `${thumbH}px`;
    thumb.style.transform = `translateY(${thumbTop}px)`;
  }

  function setFromClientY(clientY) {
    const rect = track.getBoundingClientRect();
    const thumbH = thumb.offsetHeight;
    const usable = Math.max(1, rect.height - thumbH);
    const pct = Math.min(1, Math.max(0, (clientY - rect.top - thumbH / 2) / usable));
    scrollEl.scrollTop = pct * (scrollEl.scrollHeight - scrollEl.clientHeight);
  }

  track.addEventListener('pointerdown', (e) => {
    track.setPointerCapture(e.pointerId);
    setFromClientY(e.clientY);
  });
  track.addEventListener('pointermove', (e) => {
    if (e.buttons) setFromClientY(e.clientY);
  });
  // A long-press mid-drag otherwise fires the browser's own context menu
  // (Android's long-press menu, iOS's callout) on top of the gesture; CSS
  // alone doesn't reliably suppress it everywhere.
  track.addEventListener('contextmenu', (e) => e.preventDefault());
  scrollEl.addEventListener('scroll', refresh);
  return { node: track, refresh };
}

// Click-and-drag scrolling on the row list itself — a finger swipe already
// scrolls natively, but a mouse has no equivalent, so this adds one for
// every pointer type (`touch-action: none` in layout.css clears the way).
// `dragState` is shared with each row's click handler, so a real drag
// never also selects the row it started or ended on.
function wireDragToScroll(scrollEl, dragState) {
  const DRAG_THRESHOLD_PX = 6;
  let startY = null;
  let startScrollTop = 0;
  let pointerId = null;

  scrollEl.addEventListener('pointerdown', (e) => {
    startY = e.clientY;
    startScrollTop = scrollEl.scrollTop;
    dragState.dragged = false;
    pointerId = e.pointerId;
    // Capture only once a drag is confirmed (pointermove below), so a
    // plain tap's native click fires exactly as it would without this.
  });
  scrollEl.addEventListener('pointermove', (e) => {
    if (startY === null) return;
    const dy = e.clientY - startY;
    if (!dragState.dragged && Math.abs(dy) > DRAG_THRESHOLD_PX) {
      dragState.dragged = true;
      scrollEl.setPointerCapture(pointerId);
    }
    if (dragState.dragged) scrollEl.scrollTop = startScrollTop - dy;
  });
  function end(e) {
    startY = null;
    if (dragState.dragged) {
      try { scrollEl.releasePointerCapture(e.pointerId); } catch { /* already released */ }
    }
  }
  scrollEl.addEventListener('pointerup', end);
  scrollEl.addEventListener('pointercancel', end);
  scrollEl.addEventListener('contextmenu', (e) => e.preventDefault());
}

// The dialed correction, sign shown as a leading direction glyph — same
// convention as the pane's own readout, compact enough for one line.
export function formatAdjustment(value, positiveGlyph, negativeGlyph, decimals) {
  const rounded = Number(value.toFixed(decimals));
  if (rounded === 0) return rounded.toFixed(decimals);
  const glyph = rounded > 0 ? positiveGlyph : negativeGlyph;
  return `${glyph}${Math.abs(rounded).toFixed(decimals)}`;
}

const TABLE_BORDER_PX = 2;

export function targetList({ onSelectTarget, indicatorGlyphs }) {
  let latestRows = [];
  let latestActiveId = null;
  let hasRenderedOnce = false;
  let budget = { optimal: true, count: 6 };
  const dragState = { dragged: false };

  const tableHeader = el('div', { class: 'range-card-table-header' }, [
    el('span', { class: 'range-card-col range-card-col-name' }),
    el('span', { class: 'range-card-col range-card-col-range', i18n: 'rangeSolver.rangeCardRangeHeader' }),
    el('span', { class: 'range-card-col range-card-col-elev', i18n: 'rangeSolver.elevationLabel' }),
    el('span', { class: 'range-card-col range-card-col-wind', i18n: 'rangeSolver.windageLabel' })
  ]);
  const tableBody = el('div', { class: 'range-card-table-body' });
  const scrollbar = tableScrollbar(tableBody);
  wireDragToScroll(tableBody, dragState);
  const tableBodyWrap = el('div', { class: 'range-card-table-body-wrap' }, [tableBody, scrollbar.node]);
  const table = el('div', { class: 'range-card-table' }, [tableHeader, tableBodyWrap]);
  const node = el('div', { class: 'fire-target-list' }, [table]);

  // The budget is measured from real rendered rows (the selected row is
  // taller), so it needs layout: the fake-DOM test harness has none, and
  // a hidden pane measures zero — remeasure() runs again once shown.
  function applyRowBudget() {
    // childNodes, not children — the fake-DOM test harness only has the former.
    const rows = [...tableBody.childNodes].filter((child) => child.classList && child.classList.contains('range-card-row'));
    if (!rows.length || typeof node.getBoundingClientRect !== 'function') {
      table.style.removeProperty('--rc-row-budget');
      return;
    }
    const heights = rows.map((rowEl) => rowEl.getBoundingClientRect().height);
    const available = node.getBoundingClientRect().height - tableHeader.getBoundingClientRect().height - TABLE_BORDER_PX;
    if (!(available > 0) || !heights[0]) {
      table.style.removeProperty('--rc-row-budget');
      return;
    }
    let total;
    if (budget.optimal) {
      // Whole rows that fit, with the selected row's extra height counted
      // once, wherever it sits; the leftover sliver stays empty.
      const activeIndex = rows.findIndex((rowEl) => rowEl.classList.contains('range-card-row--active'));
      const plain = heights.find((h, i) => i !== activeIndex) || heights[0];
      const activeH = activeIndex >= 0 ? heights[activeIndex] : 0;
      const fit = activeIndex >= 0 ? 1 + Math.floor((available - activeH) / plain) : Math.floor(available / plain);
      const n = Math.min(rows.length, MAX_ROW_COUNT, Math.max(1, fit));
      total = activeIndex >= 0 && n >= 1 ? activeH + (n - 1) * plain : n * plain;
      if (n === rows.length) total = heights.reduce((a, h) => a + h, 0);
    } else {
      // A fixed count: the first `count` rows' real heights, capped at
      // what the cell holds (never below one row).
      const wanted = heights.slice(0, budget.count).reduce((a, h) => a + h, 0);
      total = Math.max(heights[0], Math.min(wanted, available));
    }
    table.style.setProperty('--rc-row-budget', String(Math.max(1, Math.round(total))));
  }

  let resizeObserver = null;
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => remeasure());
    resizeObserver.observe(node);
  }

  function renderRows() {
    clear(tableBody);
    for (const row of latestRows) {
      const active = row.id === latestActiveId;
      const elevText = row.valid ? formatAdjustment(row.elevValue, indicatorGlyphs.elevationPositive, indicatorGlyphs.elevationNegative, row.decimals) : '—';
      const windText = row.valid ? formatAdjustment(row.windValue, indicatorGlyphs.windagePositive, indicatorGlyphs.windageNegative, row.decimals) : '—';
      const rowEl = el('div', {
        class: 'range-card-row row-clickable' + (active ? ' range-card-row--active' : ''),
        role: 'button', tabindex: '0'
      }, [
        el('span', { class: 'range-card-row-name', text: row.name }),
        el('span', { class: 'range-card-row-range', text: row.rangeDisplay }),
        el('span', { class: 'range-card-row-elev', text: elevText }),
        el('span', { class: 'range-card-row-wind', text: windText })
      ]);
      rowEl.addEventListener('click', () => { if (!dragState.dragged) onSelectTarget(row.id); });
      rowEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectTarget(row.id); }
      });
      tableBody.appendChild(rowEl);
    }
    applyRowBudget();
    scrollbar.refresh();
  }

  // `rows`: [{ id, name, rangeDisplay, valid, elevValue, windValue, decimals }]
  // sorted as they should show; `activeTargetId`: the selected target, or
  // null for none (no enlarged row).
  function refresh({ rows, activeTargetId }) {
    // Only a change to a selected target scrolls; deselecting (a hand-typed
    // range) leaves the list where it is.
    const scrollToActive = hasRenderedOnce && activeTargetId !== null && activeTargetId !== latestActiveId;
    latestRows = rows;
    latestActiveId = activeTargetId;
    renderRows();
    if (scrollToActive) {
      const activeRowEl = tableBody.querySelector('.range-card-row--active');
      if (activeRowEl && typeof activeRowEl.scrollIntoView === 'function') activeRowEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
    hasRenderedOnce = true;
  }

  // { optimal: boolean, count: 3..12 } — see the module comment.
  function setRowBudget(next) {
    budget = { ...budget, ...next };
    applyRowBudget();
    scrollbar.refresh();
  }

  function remeasure() {
    applyRowBudget();
    scrollbar.refresh();
  }

  function dispose() {
    resizeObserver?.disconnect();
  }

  return { node, refresh, setRowBudget, remeasure, dispose };
}
