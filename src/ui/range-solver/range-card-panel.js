// Range Solver's "Range Card" tab — every target at the active location,
// solved at once and sorted by range, with the currently active one
// enlarged; a tap-to-select photo picker (an inline, always-visible
// sibling of location-placement-view.js's own full-screen select mode,
// sharing its pin glyphs/classes via target-pin-glyphs.js and the same
// generic photoViewport() interaction engine); and a slot the caller
// re-parents its own windControl() node into (see range-solver-view.js's
// applyActiveTab()) rather than a second dial instance of its own — one
// cookie-backed wind value, one live reflection of it, wherever it's
// currently docked.
//
// This module only renders and dispatches taps back via onSelectTarget —
// it has no unit/ballistics knowledge of its own. The caller (range-
// solver-view.js) is the one place that already imports units.js/
// engine/trajectory.js, so it computes each row's display strings and
// elevation/windage values and hands them in fully formed via refresh().
import { el, clear } from '../../dom.js';
import { t } from '../../i18n.js';
import { photoViewport } from '../locations/photo-viewport.js';
import { crosshairGlyph, placedDot } from '../locations/target-pin-glyphs.js';
import { formatTargetSummary } from '../locations/target-summary.js';
import { locationPickerButton } from '../locations/location-picker-button.js';
import { zoomInIcon, zoomOutIcon } from '../nav-icons.js';
import { getRangeCardRowCount, setRangeCardRowCount, MIN_ROW_COUNT, MAX_ROW_COUNT } from '../../range-card-row-count-prefs.js';

function positionAt(node, coords) {
  node.style.left = `${(coords.x * 100).toFixed(3)}%`;
  node.style.top = `${(coords.y * 100).toFixed(3)}%`;
}

// Same label shape as location-placement-view.js's own select-mode pins —
// range/angle only, name prepended when the target has one.
function pinLabelParts(target) {
  const summary = formatTargetSummary(target.rangeM, target.losAngleDeg, { roundRange: true });
  return target.name ? [el('strong', { text: target.name }), ` ${summary}`] : [summary];
}

// A compact horizontal drag slider for the row-count preference — its own
// tiny widget rather than a reused <input type=range> so it can sit
// inline in the table's header row at a fixed, deliberately small
// footprint (a native range input's hit-target/track styling varies too
// much across browsers to guarantee that). Pointer-driven, same "capture
// on the track, drag anywhere" gesture as every slider in this app;
// arrow keys cover keyboard access, same convention windControl() uses
// for its own dial.
function rowCountControl(initial, onChange) {
  let value = initial;
  const track = el('div', { class: 'range-card-rowcount-track' });
  const fill = el('div', { class: 'range-card-rowcount-fill' });
  const thumb = el('div', { class: 'range-card-rowcount-thumb' });
  track.appendChild(fill);
  track.appendChild(thumb);
  const valueLabel = el('span', { class: 'range-card-rowcount-value' }, [String(value)]);
  const wrap = el('div', {
    class: 'range-card-rowcount', role: 'slider', tabindex: '0',
    'aria-valuemin': String(MIN_ROW_COUNT), 'aria-valuemax': String(MAX_ROW_COUNT), 'aria-valuenow': String(value)
  }, [
    el('span', { class: 'range-card-rowcount-caption', i18n: 'rangeSolver.rangeCardRowCountLabel' }),
    track,
    valueLabel
  ]);

  function render() {
    const pct = (value - MIN_ROW_COUNT) / (MAX_ROW_COUNT - MIN_ROW_COUNT);
    fill.style.width = `${pct * 100}%`;
    thumb.style.left = `${pct * 100}%`;
    valueLabel.textContent = String(value);
    wrap.setAttribute('aria-valuenow', String(value));
  }
  render();

  function setValue(next) {
    const clamped = Math.min(MAX_ROW_COUNT, Math.max(MIN_ROW_COUNT, next));
    if (clamped === value) return;
    value = clamped;
    render();
    onChange(value);
  }

  function setFromClientX(clientX) {
    const rect = track.getBoundingClientRect();
    const pct = rect.width ? Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)) : 0;
    setValue(Math.round(MIN_ROW_COUNT + pct * (MAX_ROW_COUNT - MIN_ROW_COUNT)));
  }

  track.addEventListener('pointerdown', (e) => {
    track.setPointerCapture(e.pointerId);
    setFromClientX(e.clientX);
  });
  track.addEventListener('pointermove', (e) => {
    if (e.buttons) setFromClientX(e.clientX);
  });
  // A long-press mid-drag otherwise fires the browser's own right-click-
  // equivalent context menu (Android's long-press menu, iOS's callout) on
  // top of the gesture — same fix photo-viewport.js's own widget already
  // needed for the exact same reason; CSS alone (user-select/-webkit-
  // touch-callout, see .range-card-rowcount-track in layout.css) doesn't
  // reliably suppress it everywhere.
  track.addEventListener('contextmenu', (e) => e.preventDefault());
  wrap.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); setValue(value + 1); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); setValue(value - 1); }
  });

  return { node: wrap };
}

// A slim custom vertical scrollbar for the table body. A plain
// overflow-y:auto div already gets a real, platform-styled scrollbar, but
// this app targets touch tablets where the native one can be a sliver too
// thin to reliably grab — this one is deliberately fat, at a predictable
// spot (the table's own right edge), and draggable anywhere on its track
// (not just the thumb), same convention rowCountControl() above uses.
// Hidden entirely whenever the content doesn't actually overflow.
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
  // Same long-press-context-menu fix as rowCountControl()'s own track —
  // see that one's comment.
  track.addEventListener('contextmenu', (e) => e.preventDefault());

  scrollEl.addEventListener('scroll', refresh);

  return { node: track, refresh };
}

// Direct click-and-drag scrolling on the row list itself — a finger swipe
// on a plain overflow-y:auto div already scrolls natively, but there's no
// mouse equivalent by default, so this adds one uniformly for every
// pointer type, same "manual pointer-driven gesture, not left to the
// browser" convention photo-viewport.js already uses for its own pan
// (and `touch-action: none` in layout.css is what clears the way for it,
// same reasoning as that module's own widget rule). `dragState` is a
// shared mutable flag each row's own click handler checks below, so a
// real drag never also fires a row selection — mirroring how photo-
// viewport.js's own endPointer() tells a tap from a completed pan.
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
    // Capture is deliberately deferred to pointermove, once a drag is
    // actually confirmed — NOT grabbed unconditionally here. A plain
    // click on a row (pointerdown+pointerup with ~0 movement, the common
    // case) then never involves capture at all, so its native click
    // fires exactly as it would with no listener on this element in the
    // way; capturing only matters for an actual drag, to keep tracking
    // pointermove/pointerup past this element's own bounds.
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
  // Same long-press-context-menu fix as rowCountControl()'s own track —
  // see that one's comment.
  scrollEl.addEventListener('contextmenu', (e) => e.preventDefault());
}

// Desktop-friendly zoom controls for the photo picker — photoViewport()'s
// own pinch/drag gesture handling is touch-first (two-finger pinch to
// zoom); a mouse has no pinch equivalent, so without these a desktop/
// trackpad user would have no way to zoom this inline picker at all
// (unlike location-placement-view.js's full-screen picker, which gets
// Zoom In/Out from its own nav bar — this inline one has no such bar).
function pickerZoomControls(viewport) {
  const inBtn = el('button', {
    type: 'button', class: 'icon-button range-card-zoom-btn', 'aria-label': t('rangeSolverLocations.zoomInButton')
  }, [zoomInIcon(18)]);
  const outBtn = el('button', {
    type: 'button', class: 'icon-button range-card-zoom-btn', 'aria-label': t('rangeSolverLocations.zoomOutButton')
  }, [zoomOutIcon(18)]);
  inBtn.addEventListener('click', () => viewport.zoomIn());
  outBtn.addEventListener('click', () => viewport.zoomOut());
  return el('div', { class: 'range-card-zoom-controls' }, [inBtn, outBtn]);
}

// The dialed correction, sign shown as a leading direction glyph — same
// convention range-solver-view.js's own renderAdjustment() uses for the
// single-target readout, just compact enough for a table cell (one line,
// no forced break).
function formatAdjustment(value, positiveGlyph, negativeGlyph, decimals) {
  const rounded = Number(value.toFixed(decimals));
  if (rounded === 0) return rounded.toFixed(decimals);
  const glyph = rounded > 0 ? positiveGlyph : negativeGlyph;
  return `${glyph}${Math.abs(rounded).toFixed(decimals)}`;
}

export function rangeCardPanel({ onSelectTarget, indicatorGlyphs, onManageLocations }) {
  let rowCountPref = getRangeCardRowCount();
  let latestRows = [];
  let latestActiveId = null;
  // Only meaningful once a first refresh() has actually happened — see
  // refresh() below for why the very first render never auto-centers/
  // auto-scrolls (there's nothing to move *from* yet, and it would fight
  // a restored pan/zoom from viewportCache on first showing a location).
  let hasRenderedOnce = false;
  // A real drag on the row list must never also select whatever row it
  // started/ended on — shared with wireDragToScroll() below.
  const dragState = { dragged: false };

  // Rebuilding photoViewport() (a fresh <img>, fresh pan/zoom state) only
  // when the active location's own identity/photo-presence actually
  // changes — not on every refresh() call, which would otherwise happen
  // on every wind/atmosphere keystroke and reset the user's pan/zoom
  // mid-interaction. viewportCache mirrors location-placement-view.js's
  // own savedViewports Map so re-opening the same location's photo (via
  // a target switch and back) restores the last pan/zoom instead of
  // resetting it.
  let lastLocationKey;
  let viewportInstance = null;
  let viewportLocationId = null;
  const viewportCache = new Map();

  const windSlot = el('div', { class: 'range-card-wind-slot' });
  const windStrip = el('div', { class: 'range-card-wind-strip' }, [windSlot]);

  // Landscape only (see layout.css's own media-query rule for --dial-d):
  // scales the wind dial to roughly fill whatever height the table
  // leaves it in their shared column, up to a sane cap — measured, not a
  // CSS container-query calc, because mixing cqh (this strip's own size)
  // with cqw (windControl()'s own nested inline-size container, for its
  // button sizing) across that container boundary collapsed the dial to
  // 0×0 rather than resolving the way the spec suggests it should; a
  // ResizeObserver is both simpler and actually correct. Reruns
  // automatically on every resize (row-count changes, window resize,
  // orientation flips) — nothing else needs to remember to call it. Same
  // "guard for the fake-DOM test harness" convention range-solver-view.js
  // already uses for its own ResizeObserver.
  let windDialResizeObserver = null;
  if (typeof ResizeObserver !== 'undefined') {
    windDialResizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      const d = Math.round(Math.max(130, Math.min(height * 0.8, width * 0.65, 340)));
      windStrip.style.setProperty('--rc-wind-dial-d', `${d}px`);
    });
    windDialResizeObserver.observe(windStrip);
  }

  const pickerHost = el('div', { class: 'range-card-picker-host' });

  const rowCount = rowCountControl(rowCountPref, (v) => {
    rowCountPref = setRangeCardRowCount(v);
    applyRowBudget();
  });

  // A separate line above the table — the manage-locations icon and the
  // active location's own name (same pieces the Target tab's own
  // .range-solver-location-row uses, see range-solver-view.js), plus the
  // row-count control. Row count used to live inline in the table header
  // itself, but its own content-sized width there ate into the header's
  // flex-basis budget shared with the name/range/elev/wind columns,
  // leaving those columns narrower than the identically-flexed cells
  // below them in the body — the table header's own column labels then
  // didn't actually line up with the values underneath. Moving it out
  // entirely is what fixes that, not any change to the columns themselves.
  const manageButton = locationPickerButton({
    label: t('rangeSolverLocations.manageButtonLabel'),
    onClick: onManageLocations
  });
  const locationNameEl = el('span', { class: 'range-card-location-name' });
  const locationBar = el('div', { class: 'range-card-location-bar' }, [manageButton, locationNameEl, rowCount.node]);

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

  // Row count is a visible-height budget (the table scrolls past it — see
  // .range-card-table-body's own CSS — rather than being a hard cap on
  // how many targets can ever be shown). Measured from the *actual*
  // rendered heights of the first `rowCountPref` rows, not a fixed
  // px-per-row estimate — rows aren't all the same height (the active one
  // is taller, see .range-card-row--active), so a flat estimate either
  // over-budgets (leaving a partial extra row peeking in at the bottom —
  // "3 rows" visibly showing a sliver of a 4th) or under-budgets
  // (clipping the last requested row half off), depending on where the
  // active row happens to fall relative to the visible window. Measuring
  // the real boxes side-steps guessing entirely; overflow:hidden/auto on
  // an ancestor never changes a child's own layout box, so this is
  // accurate regardless of the *previous* budget already applied.
  // Landscape only: table and wind share one narrow column with nothing
  // flexible between them to absorb overflow (unlike portrait, where the
  // picker's own flexible row does that job — see .range-card-panel's own
  // grid-template-areas in layout.css). A row-count budget sized purely
  // from rowCountPref, with no notion of how much room is actually left
  // in that column, can ask for more than a short-landscape phone screen
  // has — the table's own row then overflows past the panel's fixed
  // height, painting over wind's row rather than the table just scrolling
  // internally the way it already does when content exceeds rowCountPref
  // itself. landscapeRowCap() gives applyRowBudget() below a ceiling for
  // that case; Infinity everywhere else (portrait, or not actually
  // laid out yet) leaves the plain rowCountPref-driven budget alone.
  const LANDSCAPE_QUERY = typeof matchMedia === 'function' ? matchMedia('(orientation: landscape)') : null;
  // wind-control.js's own dial floors at 130px (see this module's own
  // windDialResizeObserver above) — this reservation just needs to be in
  // that neighborhood, not pixel-exact: a little slack here is far
  // cheaper than the overlap it exists to prevent.
  const WIND_MIN_RESERVE_PX = 140;
  const PANEL_GAP_PX = 10; // .range-card-panel's own `gap` — see layout.css

  function landscapeRowCap() {
    if (!LANDSCAPE_QUERY || !LANDSCAPE_QUERY.matches) return Infinity;
    if (typeof node.getBoundingClientRect !== 'function') return Infinity; // fake-DOM test harness
    const panelH = node.getBoundingClientRect().height;
    if (!panelH) return Infinity; // this tab isn't actually visible/laid out right now — nothing reliable to measure
    const barH = locationBar.getBoundingClientRect().height;
    // The cap below applies to .range-card-table-body's own max-height,
    // not the table's whole occupied row height — the header (plus the
    // table's own 2px top+bottom border) sits above the body and eats
    // into the same shared column, so it has to come off this budget too,
    // or wind ends up with less than WIND_MIN_RESERVE_PX regardless of
    // this function's own math (confirmed the hard way: without this, the
    // dial rendered a consistent ~8px past its own row on each side —
    // exactly the header's own height split by align-items:center).
    const headerH = tableHeader.getBoundingClientRect().height;
    const TABLE_BORDER_PX = 2;
    return panelH - barH - PANEL_GAP_PX * 2 - headerH - TABLE_BORDER_PX - WIND_MIN_RESERVE_PX;
  }

  function applyRowBudget() {
    // childNodes, not children — this app's own fake-DOM test harness
    // (tests/helpers/fake-dom.js) only implements the former; real
    // browsers have both and nothing but element children ever ends up
    // under tableBody, so the two are equivalent here.
    const rows = [...tableBody.childNodes].filter((child) => child.classList && child.classList.contains('range-card-row'));
    if (!rows.length || typeof rows[0].getBoundingClientRect !== 'function') {
      // No rows, or a DOM stub with no real layout (the fake-DOM test
      // harness above) — nothing to measure against; leave the budget
      // unset rather than guessing, same as the empty-table branch below.
      table.style.removeProperty('--rc-row-budget');
      return;
    }
    const wanted = rows.slice(0, rowCountPref).reduce((sum, rowEl) => sum + rowEl.getBoundingClientRect().height, 0);
    const cap = landscapeRowCap();
    // Never below one row's own height — a table clipped to *nothing* is
    // strictly worse than the overlap this cap exists to prevent; on any
    // realistic phone size the reserved wind floor above still leaves
    // room for several rows before this floor is what actually binds.
    const budget = Number.isFinite(cap) ? Math.max(rows[0].getBoundingClientRect().height, Math.min(wanted, cap)) : wanted;
    table.style.setProperty('--rc-row-budget', String(Math.max(1, Math.round(budget))));
  }

  const node = el('div', { class: 'range-card-panel' }, [locationBar, table, pickerHost, windStrip]);

  // Re-applies landscapeRowCap() above whenever the panel's own size
  // changes while this tab is already the visible one (rotating the
  // phone in place, resizing a desktop window) — remeasure() only ever
  // gets called from range-solver-view.js's applyActiveTab(), on
  // switching *into* this tab, so nothing else would otherwise notice a
  // resize that happens while already here.
  let panelResizeObserver = null;
  if (typeof ResizeObserver !== 'undefined') {
    panelResizeObserver = new ResizeObserver(() => applyRowBudget());
    panelResizeObserver.observe(node);
  }

  function renderRows() {
    clear(tableBody);
    if (!latestRows.length) {
      tableBody.appendChild(el('p', { class: 'hint range-card-table-empty', i18n: 'rangeSolver.rangeCardNoTargetsHint' }));
      table.style.removeProperty('--rc-row-budget');
      scrollbar.refresh();
      return;
    }
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

  function renderPins(location) {
    if (!viewportInstance) return;
    clear(viewportInstance.markersLayer);
    for (const target of location.targets) {
      if (!target.coords) continue;
      const active = target.id === latestActiveId;
      // The crosshair (bare svg, no positioning of its own) needs the
      // same manual "center on the parent pin's own (0,0) anchor" wrapper
      // .target-photo-overlay-pin-dot already gets — see that class's own
      // comment in layout.css.
      const glyph = active
        ? el('span', { class: 'target-photo-overlay-pin-crosshair' }, [crosshairGlyph(22)])
        : placedDot();
      const pin = el('button', {
        type: 'button',
        class: 'target-photo-overlay-pin' + (active ? ' range-card-pin--active' : '')
      }, [glyph, el('span', { class: 'target-photo-overlay-pin-label' }, pinLabelParts(target))]);
      positionAt(pin, target.coords);
      pin.addEventListener('click', () => onSelectTarget(target.id));
      viewportInstance.markersLayer.appendChild(pin);
    }
    const unplaced = location.targets.filter((target) => !target.coords);
    if (unplaced.length) {
      const stack = el('div', { class: 'target-photo-overlay-stack' });
      for (const target of unplaced) {
        const chip = el('button', {
          type: 'button',
          class: 'target-photo-overlay-chip' + (target.id === latestActiveId ? ' range-card-pin--active' : '')
        }, pinLabelParts(target));
        chip.addEventListener('click', () => onSelectTarget(target.id));
        stack.appendChild(chip);
      }
      viewportInstance.markersLayer.appendChild(stack);
    }
  }

  function renderPicker(location) {
    const hasPhoto = !!(location && location.photo);
    const key = `${location ? location.id : ''}:${hasPhoto}`;
    if (key === lastLocationKey) {
      if (location) renderPins(location);
      return;
    }
    lastLocationKey = key;
    if (viewportInstance) {
      viewportCache.set(viewportLocationId, viewportInstance.getViewport());
      viewportInstance = null;
      viewportLocationId = null;
    }
    clear(pickerHost);
    if (!location) {
      pickerHost.appendChild(el('p', { class: 'hint range-card-picker-hint', i18n: 'rangeSolver.rangeCardNoLocationHint' }));
      return;
    }
    if (!hasPhoto) {
      pickerHost.appendChild(el('p', { class: 'hint range-card-picker-hint', i18n: 'rangeSolver.rangeCardNoPhotoHint' }));
      return;
    }
    viewportInstance = photoViewport({ photo: location.photo, initialViewport: viewportCache.get(location.id) });
    viewportLocationId = location.id;
    pickerHost.appendChild(viewportInstance.node);
    pickerHost.appendChild(pickerZoomControls(viewportInstance));
    renderPins(location);
  }

  function refresh({ location, rows, activeTargetId }) {
    // Captured before latestActiveId is overwritten below — only an
    // actual change (not every recompute, e.g. from a wind-speed drag)
    // should move anything.
    const activeChanged = hasRenderedOnce && activeTargetId !== latestActiveId;
    latestRows = rows;
    latestActiveId = activeTargetId;
    locationNameEl.style.display = location ? '' : 'none';
    locationNameEl.textContent = location ? location.name : '';
    renderPicker(location);
    renderRows();
    if (activeChanged) {
      const target = location && location.targets.find((tg) => tg.id === activeTargetId);
      if (target && target.coords && viewportInstance) viewportInstance.centerOn(target.coords);
      const activeRowEl = tableBody.querySelector('.range-card-row--active');
      if (activeRowEl) activeRowEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
    hasRenderedOnce = true;
  }

  // applyRowBudget() measures real rendered row heights — while this
  // panel's tab is the *inactive* one, its whole subtree sits under a
  // display:none ancestor (range-solver-view.js's own applyActiveTab()),
  // which collapses every descendant's layout box to zero regardless of
  // its own CSS, so a refresh() that happens to land while hidden (e.g.
  // the very first recompute() on mount, before the user has ever
  // switched to this tab — recompute() runs unconditionally, not just
  // for the active tab) bakes in a zero budget that then clips the table
  // to nothing. Nothing re-measures it just from becoming visible again
  // (a tab switch alone doesn't call refresh()), so the table stayed
  // empty until some other refresh() happened to fire while actually
  // shown (picking a target, dragging the row-count control). Exposed so
  // range-solver-view.js's applyActiveTab() can re-measure right when
  // this tab actually becomes the visible one.
  function remeasure() {
    applyRowBudget();
    scrollbar.refresh();
  }

  function dispose() {
    windDialResizeObserver?.disconnect();
    panelResizeObserver?.disconnect();
  }

  return { node, windSlot, refresh, remeasure, dispose };
}
