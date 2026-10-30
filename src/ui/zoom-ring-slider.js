import { el, clear } from '../dom.js';
import { zoomTicks, zoomLabel } from '../reticle/sight-picture.js';

// A scope's zoom ring as a graduated slider: a bar at every whole zoom
// and at both ends, labels where they fit (reticle/sight-picture.js's
// zoomTicks), the SFP calibration zoom highlighted. A custom
// role="slider" rather than <input type="range">, which can carry
// neither the graduation nor a dependable vertical orientation across
// browsers. Vertical puts the highest zoom at the top, horizontal at the
// right; setOrientation() switches between them in place.
//
// `settle(zoom)` clamps and snaps a candidate zoom (sightPicture's
// settleZoom for the scope); `onInput(zoom)` gets every settled change.
// Nothing here is rebuilt during a drag — only the thumb and aria values
// move.
const KEY_STEP = 0.1;
const PAGE_STEP = 1;
// Room a label needs along the ring, in px: about four characters across,
// one line down.
const LABEL_SPAN_PX = { horizontal: 34, vertical: 16 };
const FALLBACK_LENGTH_PX = 240;

export function zoomRingSlider({ orientation = 'horizontal', label = '', onInput } = {}) {
  let optics = null;
  let range = null;
  let settle = (z) => z;
  let value = NaN;

  const scale = el('div', { class: 'zoom-ring-scale' });
  const thumb = el('div', { class: 'zoom-ring-thumb' });
  const track = el('div', { class: 'zoom-ring-track' }, [el('div', { class: 'zoom-ring-rail' }), scale, thumb]);
  const node = el('div', {
    class: `zoom-ring zoom-ring-${orientation}`, role: 'slider', tabindex: '0',
    'aria-orientation': orientation, 'aria-label': label
  }, [track]);

  const fraction = (z) => (range ? (z - range[0]) / (range[1] - range[0]) : 0);
  const place = (target, f) => {
    if (orientation === 'vertical') {
      target.style.top = `${((1 - f) * 100).toFixed(3)}%`;
      target.style.left = '';
    } else {
      target.style.left = `${(f * 100).toFixed(3)}%`;
      target.style.top = '';
    }
  };

  function trackLength() {
    if (typeof track.getBoundingClientRect !== 'function') return FALLBACK_LENGTH_PX;
    const box = track.getBoundingClientRect();
    const length = orientation === 'vertical' ? box.height : box.width;
    return length > 0 ? length : FALLBACK_LENGTH_PX;
  }

  function renderScale() {
    clear(scale);
    if (!range) return;
    const minGap = LABEL_SPAN_PX[orientation] / trackLength();
    for (const tick of zoomTicks(optics, (a, b) => Math.abs(a - b) >= minGap)) {
      const classes = ['zoom-ring-tick'];
      if (tick.calibration) classes.push('calibration');
      if (tick.end) classes.push('end');
      if (tick.label) classes.push('labelled');
      const bar = el('div', { class: classes.join(' ') }, tick.label ? [el('span', { class: 'zoom-ring-label', text: tick.label })] : []);
      place(bar, tick.position);
      scale.appendChild(bar);
    }
  }

  function renderValue() {
    if (!range) return;
    place(thumb, fraction(value));
    node.setAttribute('aria-valuenow', value.toFixed(2));
    node.setAttribute('aria-valuetext', zoomLabel(value));
  }

  function commit(candidate) {
    if (!range || !Number.isFinite(candidate)) return;
    const next = settle(candidate);
    if (next === value) return;
    value = next;
    renderValue();
    if (onInput) onInput(value);
  }

  // A keyboard step that lands back on the current value (inside the
  // calibration snap) keeps going until it leaves it, so the keys can
  // always move off the calibration zoom.
  function step(delta) {
    if (!range) return;
    let candidate = value;
    for (let i = 0; i < 1000; i += 1) {
      candidate += delta;
      if (candidate < range[0] - 1e-9 || candidate > range[1] + 1e-9) {
        commit(delta > 0 ? range[1] : range[0]);
        return;
      }
      if (settle(candidate) !== value) break;
    }
    commit(candidate);
  }

  function zoomAtPointer(event) {
    const box = track.getBoundingClientRect();
    const f = orientation === 'vertical'
      ? 1 - (event.clientY - box.top) / box.height
      : (event.clientX - box.left) / box.width;
    return range[0] + Math.min(1, Math.max(0, f)) * (range[1] - range[0]);
  }

  let dragging = false;
  node.addEventListener('pointerdown', (event) => {
    if (!range || event.button > 0) return;
    dragging = true;
    node.classList.add('dragging');
    if (node.setPointerCapture) node.setPointerCapture(event.pointerId);
    node.focus();
    commit(zoomAtPointer(event));
    event.preventDefault();
  });
  node.addEventListener('pointermove', (event) => {
    if (dragging) commit(zoomAtPointer(event));
  });
  const endDrag = () => {
    dragging = false;
    node.classList.remove('dragging');
  };
  node.addEventListener('pointerup', endDrag);
  node.addEventListener('pointercancel', endDrag);

  node.addEventListener('keydown', (event) => {
    if (!range) return;
    const keys = {
      ArrowUp: () => step(KEY_STEP), ArrowRight: () => step(KEY_STEP),
      ArrowDown: () => step(-KEY_STEP), ArrowLeft: () => step(-KEY_STEP),
      PageUp: () => step(PAGE_STEP), PageDown: () => step(-PAGE_STEP),
      Home: () => commit(range[0]), End: () => commit(range[1])
    };
    if (!keys[event.key]) return;
    keys[event.key]();
    event.preventDefault();
  });

  // Which labels fit depends on the ring's drawn length, so a resize
  // re-places them.
  let resizeObserver = null;
  if (typeof ResizeObserver !== 'undefined') {
    let lastLength = 0;
    resizeObserver = new ResizeObserver(() => {
      const length = trackLength();
      if (Math.abs(length - lastLength) < 1) return;
      lastLength = length;
      renderScale();
    });
    resizeObserver.observe(track);
  }

  // A scope's optics ({ type, zoomMin, zoomMax, calibrationZoom }), its
  // ring range ([lo, hi]), the settle function, and the zoom to show.
  function setRing(nextOptics, nextRange, nextSettle, zoom) {
    optics = nextOptics;
    range = nextRange;
    settle = nextSettle || ((z) => z);
    node.style.display = range ? '' : 'none';
    if (!range) return;
    node.setAttribute('aria-valuemin', range[0].toFixed(2));
    node.setAttribute('aria-valuemax', range[1].toFixed(2));
    value = settle(zoom);
    renderScale();
    renderValue();
  }

  function setOrientation(next) {
    if (next !== 'horizontal' && next !== 'vertical') return;
    if (next === orientation) return;
    node.classList.remove(`zoom-ring-${orientation}`);
    orientation = next;
    node.classList.add(`zoom-ring-${orientation}`);
    node.setAttribute('aria-orientation', orientation);
    renderScale();
    renderValue();
  }

  return {
    node,
    setRing,
    setOrientation,
    getOrientation: () => orientation,
    getValue: () => value,
    dispose: () => resizeObserver?.disconnect()
  };
}
