// Reordering a list of rows by dragging a handle on each — mouse, touch
// and pen through one Pointer Events path, plus ArrowUp/ArrowDown on a
// focused handle. HTML5 drag-and-drop is deliberately not used: it does
// not work on touch in iOS Safari, and the lists this serves are edited
// on phones and tablets at the range.
//
// The caller builds and owns the row nodes; this only wires them. Rows
// are moved visually (transforms) while a drag is on, and nothing in the
// DOM is reordered — on a drop, onMove(from, to) tells the caller, which
// saves the new order and re-renders. A cancelled drag (pointercancel,
// lost capture, Escape) puts everything back and calls nothing.
//
// Only the handle has `touch-action: none` (sortable-rows CSS), so a swipe
// anywhere else still scrolls the page. While the pointer sits near the
// viewport's visible top or bottom edge — below the sticky top bar, above
// a bottom tab bar when one is showing — the window scrolls, so a list
// taller than the screen can be reordered end to end.

const EDGE_PX = 48;
const MAX_SCROLL_STEP_PX = 14;

// The slot a lifted row lands in: `y` is its centre now, `midpoints` the
// rows' centres before the drag began (same coordinate space), `fromIndex`
// where it started. It passes a row once its centre crosses that row's.
export function dropIndexFor(y, midpoints, fromIndex) {
  let after = 0;
  for (let j = fromIndex + 1; j < midpoints.length; j++) if (midpoints[j] < y) after++;
  if (after > 0) return fromIndex + after;
  let before = 0;
  for (let j = 0; j < fromIndex; j++) if (midpoints[j] > y) before++;
  return fromIndex - before;
}

// `rows`: [{ node, handle }], in display order, all children of one
// container. `onMove(fromIndex, toIndex)`: a completed move to a
// different slot.
export function sortableRows({ rows, onMove }) {
  let drag = null;

  // How far the rows' container has moved up the viewport since the drag
  // began — by auto-scroll, a hand scroll, or a layout shift above it.
  // Measured on the container itself, never from window.scrollY: the top
  // bar collapses once the page leaves the top, and scroll anchoring then
  // changes scrollY with nothing on screen moving.
  function containerShift() {
    return drag.containerTop - drag.container.getBoundingClientRect().top;
  }

  function layout() {
    const dy = (drag.clientY - drag.startClientY) + containerShift();
    const to = dropIndexFor(drag.midpoints[drag.from] + dy, drag.midpoints, drag.from);
    drag.to = to;
    rows.forEach((row, j) => {
      if (j === drag.from) {
        row.node.style.transform = `translateY(${dy}px)`;
        return;
      }
      let shift = 0;
      if (drag.from < j && j <= to) shift = -drag.height;
      else if (to <= j && j < drag.from) shift = drag.height;
      row.node.style.transform = shift ? `translateY(${shift}px)` : '';
    });
  }

  // The part of the viewport the page actually shows: the sticky top bar
  // publishes its height as --topbar-height (topbar-scroll.js), and a
  // bottom tab bar, when visible, covers the bottom.
  function visibleBand() {
    const viewportH = window.innerHeight || 0;
    let top = 0;
    let bottom = viewportH;
    try {
      top = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--topbar-height')) || 0;
      const tabbar = document.querySelector('.app-tabbar');
      const rect = tabbar && tabbar.getBoundingClientRect();
      if (rect && rect.height > 0 && rect.top > viewportH / 2) bottom = Math.min(bottom, rect.top);
    } catch { /* no layout — full viewport */ }
    return { top, bottom };
  }

  function autoScrollTick() {
    if (!drag) return;
    const { top, bottom } = drag.band;
    const y = drag.clientY;
    let step = 0;
    if (y < top + EDGE_PX) step = -MAX_SCROLL_STEP_PX * Math.min(1, (top + EDGE_PX - y) / EDGE_PX);
    else if (bottom && y > bottom - EDGE_PX) step = MAX_SCROLL_STEP_PX * Math.min(1, (y - (bottom - EDGE_PX)) / EDGE_PX);
    if (step) {
      window.scrollBy(0, step);
      layout();
    }
    drag.frame = requestAnimationFrame(autoScrollTick);
  }

  function onEscape(e) {
    if (e.key === 'Escape') finish(false);
  }

  function start(index, e) {
    if (drag || rows.length < 2) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const container = rows[index].node.parentNode;
    const measurable = (node) => node && typeof node.getBoundingClientRect === 'function';
    if (!measurable(container) || !rows.every((row) => measurable(row.node))) return;
    const rects = rows.map((row) => row.node.getBoundingClientRect());
    e.preventDefault();
    drag = {
      from: index, to: index, pointerId: e.pointerId, handle: rows[index].handle,
      startClientY: e.clientY, clientY: e.clientY,
      container, containerTop: container.getBoundingClientRect().top,
      midpoints: rects.map((r) => r.top + r.height / 2),
      height: rects[index].height, frame: null, band: visibleBand()
    };
    try { drag.handle.setPointerCapture(e.pointerId); } catch { /* not capturable — still works while over the handle */ }
    rows.forEach((row, j) => row.node.classList.add(j === index ? 'sortable-row--lifted' : 'sortable-row--shifting'));
    document.body?.classList?.add('sortable-dragging');
    document.addEventListener('keydown', onEscape);
    if (typeof requestAnimationFrame === 'function') drag.frame = requestAnimationFrame(autoScrollTick);
  }

  function finish(commit) {
    if (!drag) return;
    const { from, to, pointerId, handle, frame } = drag;
    drag = null;
    if (frame != null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frame);
    try { handle.releasePointerCapture(pointerId); } catch { /* already released */ }
    document.removeEventListener?.('keydown', onEscape);
    document.body?.classList?.remove('sortable-dragging');
    for (const row of rows) {
      row.node.classList.remove('sortable-row--lifted', 'sortable-row--shifting');
      row.node.style.transform = '';
    }
    if (commit && to !== from) onMove(from, to);
  }

  rows.forEach((row, index) => {
    const { handle } = row;
    handle.addEventListener('pointerdown', (e) => start(index, e));
    handle.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.pointerId) return;
      drag.clientY = e.clientY;
      layout();
    });
    handle.addEventListener('pointerup', (e) => { if (drag && e.pointerId === drag.pointerId) finish(true); });
    handle.addEventListener('pointercancel', () => finish(false));
    handle.addEventListener('lostpointercapture', () => finish(false));
    // A long press on a handle otherwise opens the browser's own context
    // menu (Android) or callout (iOS) on top of the drag.
    handle.addEventListener('contextmenu', (e) => e.preventDefault());
    handle.addEventListener('keydown', (e) => {
      if (drag) return;
      const to = e.key === 'ArrowUp' ? index - 1 : e.key === 'ArrowDown' ? index + 1 : null;
      if (to === null) return;
      e.preventDefault();
      if (to >= 0 && to < rows.length) onMove(index, to);
    });
  });

  return { cancel: () => finish(false) };
}
