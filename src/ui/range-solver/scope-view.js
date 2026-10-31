// The Range Solver's scope view: the active rifle's reticle as seen
// through its scope at a magnification set on a zoom ring, with the
// solved shot's aiming point marked on it. No pan — the reticle centre is
// always the view's centre. Light glass and black reticle in every
// theme, everything beyond the field black, as the Reticle Designer and
// the thumbnails draw it.
//
// The optics are the scope's own (scope-record.js's scopeOptics), never
// the reticle's reference scope. The maths is reticle/sight-picture.js.
//
// setOptic({ scope, reticle } | null), setShot({ elevationRad, windageRad }
// | null) — the readout's correction as angles: what to draw.
//
// The zoom ring stands beside the reticle, or lies below it so the
// reticle gets the full width — range-solver-prefs.js's scope ring
// position, re-decided whenever the orientation or the viewport width
// crosses the mobile chrome's breakpoint.
//
// Zoom to reticle (fixed scopes only, reticle/reticle-zoom.js): a toggle
// in the bottom-right corner magnifies the whole field — glass, reticle,
// rim and the clip circle with them — about the centre, at first so the
// reticle fills it, then as set with − / + beside the toggle; the circle
// may grow past the square. The aiming mark and the off-field arrow keep
// their size.
import { el, clear } from '../../dom.js';
import { svgEl } from '../../svg.js';
import { t } from '../../i18n.js';
import { holdIcon, dialElevationIcon, zoomToReticleIcon } from '../nav-icons.js';
import { fmt } from '../../reticle/render.js';
import { scopeOptics } from '../../scope-record.js';
import {
  AIM_MODES, aimAngle, sightPicture, ringRange, settleZoom, initialZoom, zoomLabel, subtensionFactor
} from '../../reticle/sight-picture.js';
import { getScopeAimMode, setScopeAimMode, getScopeRingPosition } from '../../range-solver-prefs.js';
import { ILLUMINATION_COLOURS } from '../../reticle/model.js';
import { reticleElementLayer, illuminationClass } from '../reticle-scene.js';
import { zoomRingSlider } from '../zoom-ring-slider.js';
import {
  reticleZoomExtent, reticleZoomFit, stepReticleZoom, RETICLE_ZOOM_MIN, RETICLE_ZOOM_MAX
} from '../../reticle/reticle-zoom.js';

// Drawing units: the canvas and the field circle's radius within it.
const SIZE = 1000;
const HALF = SIZE / 2;
const FIT_RADIUS = 490;
// Imported strokes thinner than this many drawing units are drawn at it.
const MIN_STROKE = 3;
// The aiming mark, in drawing units: ring radius, centre dot, strokes.
const MARK_RADIUS = 22;
const MARK_DOT = 5;
const MARK_STROKE = 6;
const LEAD_STROKE = 2.5;
const HALO = 5;
// The off-field arrow: tip and base distance from the centre, half width.
const ARROW_TIP = FIT_RADIUS - 12;
const ARROW_BASE = FIT_RADIUS - 70;
const ARROW_HALF_WIDTH = 26;

// The mobile chrome's width breakpoint (layout.css's max-width: 780px,
// overridden either way by display-mode-prefs.js's force-mobile /
// force-desktop class on <html>).
const NARROW_QUERY = '(max-width: 780px)';
const PORTRAIT_QUERY = '(orientation: portrait)';

const mediaQuery = (query) => (typeof matchMedia === 'function' ? matchMedia(query) : null);

function isMobileChrome(narrow) {
  const classes = typeof document !== 'undefined' ? document.documentElement?.classList : null;
  if (classes?.contains('force-mobile')) return true;
  if (classes?.contains('force-desktop')) return false;
  return !!narrow?.matches;
}

// Whether the ring lies below the reticle, for a scope ring position.
function ringBelow(position, narrow, portrait) {
  if (!portrait?.matches) return false;
  if (position === 'below') return true;
  if (position === 'auto') return isMobileChrome(narrow);
  return false;
}

// The last zoom, and zoom to reticle's state ({ on, zoom }), per scope
// id, for the page lifetime.
const zoomByScope = new Map();
const reticleZoomByScope = new Map();

let clipCounter = 0;

export function scopeView() {
  clipCounter += 1;
  const clipId = `scope-view-clip-${clipCounter}`;
  const markClipId = `scope-view-mark-clip-${clipCounter}`;

  let optic = null; // { scope, reticle, optics, range, buildRadius, reticleZoomFit }
  let shot = null;
  let zoom = NaN;
  // Zoom to reticle: on or off, and the magnification it adds while on
  // (NaN until first switched on for the scope).
  let reticleZoomOn = false;
  let reticleZoom = NaN;
  let mode = getScopeAimMode();

  const fieldCircle = (cls) => svgEl('circle', { class: cls, cx: fmt(HALF), cy: fmt(HALF), r: fmt(FIT_RADIUS) });
  const zoomGroup = svgEl('g', { class: 'scope-view-zoom' });
  const markLayer = svgEl('g', { class: 'scope-view-mark' });
  const arrowLayer = svgEl('g', { class: 'scope-view-arrow' });
  // The field magnified by zoom to reticle; its clip path is in its own
  // user space, so the clip circle scales with it. The mark sits outside
  // it, at screen size, under a clip circle of the magnified radius.
  const fieldGroup = svgEl('g', { class: 'scope-view-field' }, [
    fieldCircle('reticle-glass'),
    svgEl('g', { 'clip-path': `url(#${clipId})` }, [zoomGroup]),
    fieldCircle('reticle-rim')
  ]);
  const markClipCircle = fieldCircle('');
  const svg = svgEl('svg', {
    viewBox: `0 0 ${SIZE} ${SIZE}`, class: 'scope-view-canvas', role: 'img', 'aria-label': t('rangeSolver.scopeView.canvasLabel')
  }, [
    svgEl('defs', {}, [
      svgEl('clipPath', { id: clipId }, [fieldCircle('')]),
      svgEl('clipPath', { id: markClipId }, [markClipCircle])
    ]),
    svgEl('rect', { class: 'reticle-outside', x: '0', y: '0', width: String(SIZE), height: String(SIZE) }),
    fieldGroup,
    svgEl('g', { 'clip-path': `url(#${markClipId})` }, [markLayer]),
    arrowLayer
  ]);
  // The square the reticle is drawn in. Its corners, outside the field
  // circle, hold controls laid over it: the aiming-point mode switch top
  // left, a slot top right for the caller's own, and zoom to reticle with
  // its magnification label bottom right.
  const corner = el('div', { class: 'scope-view-corner' });
  const cornerLeft = el('div', { class: 'scope-view-corner-left' });
  const reticleZoomValue = el('span', { class: 'scope-view-reticle-zoom-value' });
  const reticleZoomName = t('rangeSolver.scopeView.reticleZoom');
  const reticleZoomButton = el('button', {
    type: 'button', class: 'icon-button scope-view-reticle-zoom-toggle', 'aria-pressed': 'false',
    title: reticleZoomName, 'aria-label': reticleZoomName
  }, [zoomToReticleIcon(20)]);
  function rememberReticleZoom() {
    reticleZoomByScope.set(optic.scope.id, { on: reticleZoomOn, zoom: reticleZoom });
    scheduleRender();
  }
  reticleZoomButton.addEventListener('click', () => {
    if (!optic?.reticleZoomFit) return;
    reticleZoomOn = !reticleZoomOn;
    if (reticleZoomOn && !Number.isFinite(reticleZoom)) reticleZoom = optic.reticleZoomFit;
    rememberReticleZoom();
  });
  const reticleZoomStep = (direction, key, text) => {
    const name = t(`rangeSolver.scopeView.${key}`);
    const button = el('button', { type: 'button', class: 'scope-view-segment', title: name, 'aria-label': name }, [text]);
    button.addEventListener('click', () => {
      if (!optic?.reticleZoomFit || !reticleZoomOn) return;
      reticleZoom = stepReticleZoom(reticleZoom, direction, optic.reticleZoomFit);
      rememberReticleZoom();
    });
    return button;
  };
  const reticleZoomOut = reticleZoomStep(-1, 'reticleZoomOut', '−');
  const reticleZoomIn = reticleZoomStep(1, 'reticleZoomIn', '+');
  const reticleZoomSteps = el('div', {
    class: 'scope-view-segmented scope-view-reticle-zoom-steps', role: 'group', 'aria-label': reticleZoomName
  }, [reticleZoomOut, reticleZoomIn]);
  const cornerBottomRight = el('div', { class: 'scope-view-corner-bottom-right' }, [
    reticleZoomValue,
    el('div', { class: 'scope-view-reticle-zoom-row' }, [reticleZoomSteps, reticleZoomButton])
  ]);
  cornerBottomRight.style.display = 'none';
  const square = el('div', { class: 'scope-view-frame' }, [svg, cornerLeft, corner, cornerBottomRight]);
  const sight = el('div', { class: 'scope-view-sight' }, [square]);

  const zoomValue = el('span', { class: 'scope-view-zoom-value' });
  const ring = zoomRingSlider({
    orientation: 'vertical',
    label: t('rangeSolver.scopeView.zoomLabel'),
    onInput: (z) => {
      zoom = z;
      if (optic) zoomByScope.set(optic.scope.id, z);
      scheduleRender();
    }
  });
  const ringBox = el('div', { class: 'scope-view-ring' }, [ring.node, zoomValue]);

  const sfpNote = el('span', { class: 'scope-view-sfp-note' });
  // Icon-only, the mode's name as the tooltip and accessible name.
  const modeIcons = { hold: holdIcon, dialElevation: dialElevationIcon };
  const modeButtons = AIM_MODES.map((value) => {
    const name = t(`rangeSolver.scopeView.mode.${value}`);
    const button = el('button', {
      type: 'button', class: 'scope-view-segment', 'aria-pressed': 'false', 'data-mode': value, title: name, 'aria-label': name
    }, [modeIcons[value](20)]);
    button.addEventListener('click', () => {
      if (mode === value) return;
      mode = value;
      setScopeAimMode(value);
      renderModeButtons();
      scheduleRender();
    });
    return button;
  });
  const modeSwitch = el('div', { class: 'scope-view-segmented', role: 'group', 'aria-label': t('rangeSolver.scopeView.modeLabel') }, modeButtons);
  cornerLeft.appendChild(modeSwitch);
  const bar = el('div', { class: 'scope-view-bar' }, [sfpNote]);

  const main = el('div', { class: 'scope-view-main' }, [sight, ringBox]);
  const node = el('div', { class: 'scope-view' }, [main, bar]);

  const ringPosition = getScopeRingPosition();
  const narrowQuery = mediaQuery(NARROW_QUERY);
  const portraitQuery = mediaQuery(PORTRAIT_QUERY);
  function applyRingLayout() {
    const below = ringBelow(ringPosition, narrowQuery, portraitQuery);
    main.classList.toggle('ring-below', below);
    ring.setOrientation(below ? 'horizontal' : 'vertical');
  }
  const mediaQueries = [narrowQuery, portraitQuery].filter((q) => q && typeof q.addEventListener === 'function');
  for (const q of mediaQueries) q.addEventListener('change', applyRingLayout);
  applyRingLayout();

  function renderModeButtons() {
    for (const button of modeButtons) {
      const on = button.getAttribute('data-mode') === mode;
      button.classList.toggle('active', on);
      button.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
  }

  // Drawing units per radian of reticle subtension at `z`.
  const scaleAt = (z) => FIT_RADIUS / sightPicture(optic.optics, z, null).radius;

  // The reticle is drawn once per optic, at the field of the lowest zoom
  // (the widest a FFP scope shows); a FFP zoom is then a scale of that
  // drawing about the centre, never a rebuild.
  function buildReticle() {
    clear(zoomGroup);
    for (const c of ILLUMINATION_COLOURS) svg.classList.remove(`illum-${c}`);
    if (!optic) return;
    const k = FIT_RADIUS / optic.buildRadius;
    const toScreen = (x, y) => [HALF + x * k, HALF + y * k];
    zoomGroup.appendChild(reticleElementLayer(optic.reticle, { toScreen, k, minStroke: MIN_STROKE }));
    const illumination = illuminationClass(optic.reticle);
    if (illumination) svg.classList.add(illumination);
  }

  function markNodes(cx, cy) {
    const lead = (x2, y2, cls) => svgEl('line', { class: cls, x1: fmt(cx), y1: fmt(cy), x2: fmt(x2), y2: fmt(y2) });
    const nodes = [];
    // Leads to the vertical axis (horizontal line) and the horizontal axis
    // (vertical line), haloed, under the mark.
    for (const cls of ['scope-view-lead-halo', 'scope-view-lead']) {
      if (Math.abs(cx - HALF) > MARK_RADIUS) nodes.push(lead(HALF, cy, cls));
      if (Math.abs(cy - HALF) > MARK_RADIUS) nodes.push(lead(cx, HALF, cls));
    }
    nodes.push(
      svgEl('circle', { class: 'scope-view-mark-halo', cx: fmt(cx), cy: fmt(cy), r: fmt(MARK_RADIUS), 'stroke-width': fmt(MARK_STROKE + 2 * HALO) }),
      svgEl('circle', { class: 'scope-view-mark-ring', cx: fmt(cx), cy: fmt(cy), r: fmt(MARK_RADIUS), 'stroke-width': fmt(MARK_STROKE) }),
      svgEl('circle', { class: 'scope-view-mark-dot', cx: fmt(cx), cy: fmt(cy), r: fmt(MARK_DOT) })
    );
    return nodes;
  }

  // `fieldRadius`: the field circle's radius on screen, magnified by zoom
  // to reticle; the arrow sits at whichever edge is nearer along its
  // direction, the circle's or the square's.
  function arrowNode(direction, fieldRadius) {
    const ux = Math.cos(direction);
    const uy = Math.sin(direction);
    const inset = Math.min(fieldRadius, HALF / Math.max(Math.abs(ux), Math.abs(uy))) - FIT_RADIUS;
    const tip = ARROW_TIP + inset;
    const base = ARROW_BASE + inset;
    const at = (d, side) => `${fmt(HALF + ux * d - uy * side)} ${fmt(HALF + uy * d + ux * side)}`;
    const d = `M${at(tip, 0)}L${at(base, ARROW_HALF_WIDTH)}L${at(base, -ARROW_HALF_WIDTH)}Z`;
    return [
      svgEl('path', { class: 'scope-view-arrow-halo', d, 'stroke-width': fmt(2 * HALO) }),
      svgEl('path', { class: 'scope-view-arrow-head', d })
    ];
  }

  const scaleTransform = (s) => (Math.abs(s - 1) < 1e-9
    ? '' : `translate(${HALF} ${HALF}) scale(${s.toPrecision(6)}) translate(${-HALF} ${-HALF})`);

  // Zoom to reticle's control and label, and the magnification it adds
  // (1 while off or not offered).
  function renderReticleZoom() {
    const available = !!optic?.reticleZoomFit;
    const on = available && reticleZoomOn;
    const factor = on ? reticleZoom : 1;
    cornerBottomRight.style.display = available ? '' : 'none';
    reticleZoomButton.setAttribute('aria-pressed', on ? 'true' : 'false');
    reticleZoomButton.classList.toggle('active', on);
    reticleZoomSteps.style.display = on ? '' : 'none';
    reticleZoomOut.disabled = !(factor > RETICLE_ZOOM_MIN);
    reticleZoomIn.disabled = !(factor < RETICLE_ZOOM_MAX);
    svg.classList.toggle('reticle-zoomed', on);
    fieldGroup.setAttribute('transform', scaleTransform(factor));
    markClipCircle.setAttribute('r', fmt(FIT_RADIUS * factor));
    if (on) {
      const values = { nominal: zoomLabel(optic.optics.zoomMax), extra: zoomLabel(factor) };
      reticleZoomValue.textContent = t('rangeSolver.scopeView.reticleZoomValue', values);
      reticleZoomValue.setAttribute('aria-label', t('rangeSolver.scopeView.reticleZoomValueLabel', values));
      reticleZoomValue.style.display = '';
    } else {
      reticleZoomValue.textContent = '';
      reticleZoomValue.style.display = 'none';
    }
    return factor;
  }

  function render() {
    clear(markLayer);
    clear(arrowLayer);
    svg.setAttribute('aria-label', t('rangeSolver.scopeView.canvasLabel'));
    const magnification = renderReticleZoom();
    if (!optic) {
      zoomGroup.setAttribute('transform', '');
      zoomValue.textContent = '';
      sfpNote.textContent = '';
      return;
    }
    const { optics } = optic;
    const k = scaleAt(zoom);
    zoomGroup.setAttribute('transform', scaleTransform(k * optic.buildRadius / FIT_RADIUS));

    zoomValue.textContent = zoomLabel(zoom);
    const factor = subtensionFactor(optics, zoom);
    sfpNote.textContent = Math.abs(factor - 1) > 1e-6
      ? t('rangeSolver.scopeView.sfpScale', { factor: String(Number(factor.toFixed(2))) })
      : '';

    if (!shot) return;
    const angle = aimAngle(shot, mode);
    if (!Number.isFinite(angle.x) || !Number.isFinite(angle.y)) return;
    // Inside: clear of the (magnified) rim and of the square's edges by
    // the mark's radius.
    const picture = sightPicture(optics, zoom, angle);
    const fieldRadius = FIT_RADIUS * magnification;
    const dx = picture.point.x * k * magnification;
    const dy = picture.point.y * k * magnification;
    const room = HALF - MARK_RADIUS;
    const inside = Math.hypot(dx, dy) <= fieldRadius - MARK_RADIUS && Math.abs(dx) <= room && Math.abs(dy) <= room;
    if (inside) {
      for (const n of markNodes(HALF + dx, HALF + dy)) markLayer.appendChild(n);
    } else {
      for (const n of arrowNode(picture.direction, fieldRadius)) arrowLayer.appendChild(n);
      svg.setAttribute('aria-label', `${t('rangeSolver.scopeView.canvasLabel')} — ${t('rangeSolver.scopeView.offField')}`);
    }
  }

  // Coalesced to one frame: a zoom drag fires faster than it needs
  // drawing. Without requestAnimationFrame, drawn at once.
  let frame = null;
  function scheduleRender() {
    if (typeof requestAnimationFrame !== 'function') { render(); return; }
    if (frame !== null) return;
    frame = requestAnimationFrame(() => {
      frame = null;
      render();
    });
  }

  function setOptic(next) {
    if (!next) {
      optic = null;
      buildReticle();
      ring.setRing(null, null, null, NaN);
      render();
      return;
    }
    if (optic && optic.scope === next.scope && optic.reticle === next.reticle) return;
    const optics = scopeOptics(next.scope);
    const range = ringRange(optics);
    const buildZoom = range ? range[0] : optics.zoomMax;
    const buildRadius = sightPicture(optics, buildZoom, null).radius;
    optic = {
      scope: next.scope, reticle: next.reticle, optics, range, buildRadius,
      reticleZoomFit: optics.type === 'fixed'
        ? reticleZoomFit(reticleZoomExtent(next.reticle.elements, buildRadius), buildRadius)
        : null
    };
    const rememberedReticleZoom = reticleZoomByScope.get(next.scope.id);
    reticleZoomOn = rememberedReticleZoom?.on === true;
    reticleZoom = rememberedReticleZoom ? rememberedReticleZoom.zoom : NaN;
    const remembered = zoomByScope.get(next.scope.id);
    zoom = settleZoom(optics, Number.isFinite(remembered) ? remembered : initialZoom(optics));
    buildReticle();
    ring.setRing(optics, range, (z) => settleZoom(optics, z), zoom);
    ringBox.style.display = range ? '' : 'none';
    render();
  }

  function setShot(next) {
    shot = next;
    scheduleRender();
  }

  renderModeButtons();

  return {
    node,
    corner,
    setOptic,
    setShot,
    getZoom: () => zoom,
    getMode: () => mode,
    getReticleZoom: () => (optic?.reticleZoomFit && reticleZoomOn ? reticleZoom : 1),
    dispose: () => {
      for (const q of mediaQueries) q.removeEventListener('change', applyRingLayout);
      ring.dispose();
      if (frame !== null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frame);
    }
  };
}
