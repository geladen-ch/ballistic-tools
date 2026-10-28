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
// | null) — the readout's correction as angles: what to draw; setRingOrientation('horizontal' | 'vertical').
import { el, clear } from '../../dom.js';
import { svgEl } from '../../svg.js';
import { t } from '../../i18n.js';
import { holdIcon, dialElevationIcon } from '../nav-icons.js';
import { fmt } from '../../reticle/render.js';
import { scopeOptics } from '../../scope-record.js';
import {
  AIM_MODES, aimAngle, sightPicture, ringRange, settleZoom, initialZoom, zoomLabel, subtensionFactor
} from '../../reticle/sight-picture.js';
import { getScopeAimMode, setScopeAimMode } from '../../range-solver-prefs.js';
import { ILLUMINATION_COLOURS } from '../../reticle/model.js';
import { reticleElementLayer, illuminationClass } from '../reticle-scene.js';
import { zoomRingSlider } from '../zoom-ring-slider.js';

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

// The last zoom per scope id, for the page lifetime.
const zoomByScope = new Map();

let clipCounter = 0;

export function scopeView() {
  clipCounter += 1;
  const clipId = `scope-view-clip-${clipCounter}`;

  let optic = null; // { scope, reticle, optics, range, buildRadius, elementLayer }
  let shot = null;
  let zoom = NaN;
  let mode = getScopeAimMode();

  const fieldCircle = (cls) => svgEl('circle', { class: cls, cx: fmt(HALF), cy: fmt(HALF), r: fmt(FIT_RADIUS) });
  const zoomGroup = svgEl('g', { class: 'scope-view-zoom' });
  const markLayer = svgEl('g', { class: 'scope-view-mark' });
  const arrowLayer = svgEl('g', { class: 'scope-view-arrow' });
  const svg = svgEl('svg', {
    viewBox: `0 0 ${SIZE} ${SIZE}`, class: 'scope-view-canvas', role: 'img', 'aria-label': t('rangeSolver.scopeView.canvasLabel')
  }, [
    svgEl('defs', {}, [svgEl('clipPath', { id: clipId }, [fieldCircle('')])]),
    svgEl('rect', { class: 'reticle-outside', x: '0', y: '0', width: String(SIZE), height: String(SIZE) }),
    fieldCircle('reticle-glass'),
    svgEl('g', { 'clip-path': `url(#${clipId})` }, [zoomGroup, markLayer]),
    fieldCircle('reticle-rim'),
    arrowLayer
  ]);
  // The square the reticle is drawn in. Its top corners, outside the
  // field circle, hold controls laid over it: the aiming-point mode
  // switch on the left, and a slot on the right for the caller's own.
  const corner = el('div', { class: 'scope-view-corner' });
  const cornerLeft = el('div', { class: 'scope-view-corner-left' });
  const square = el('div', { class: 'scope-view-frame' }, [svg, cornerLeft, corner]);
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

  function arrowNode(direction) {
    const ux = Math.cos(direction);
    const uy = Math.sin(direction);
    const at = (d, side) => `${fmt(HALF + ux * d - uy * side)} ${fmt(HALF + uy * d + ux * side)}`;
    const d = `M${at(ARROW_TIP, 0)}L${at(ARROW_BASE, ARROW_HALF_WIDTH)}L${at(ARROW_BASE, -ARROW_HALF_WIDTH)}Z`;
    return [
      svgEl('path', { class: 'scope-view-arrow-halo', d, 'stroke-width': fmt(2 * HALO) }),
      svgEl('path', { class: 'scope-view-arrow-head', d })
    ];
  }

  function render() {
    clear(markLayer);
    clear(arrowLayer);
    svg.setAttribute('aria-label', t('rangeSolver.scopeView.canvasLabel'));
    if (!optic) {
      zoomGroup.setAttribute('transform', '');
      zoomValue.textContent = '';
      sfpNote.textContent = '';
      return;
    }
    const { optics } = optic;
    const k = scaleAt(zoom);
    const s = k * optic.buildRadius / FIT_RADIUS;
    if (Math.abs(s - 1) < 1e-9) zoomGroup.setAttribute('transform', '');
    else zoomGroup.setAttribute('transform', `translate(${HALF} ${HALF}) scale(${s.toPrecision(6)}) translate(${-HALF} ${-HALF})`);

    zoomValue.textContent = zoomLabel(zoom);
    const factor = subtensionFactor(optics, zoom);
    sfpNote.textContent = Math.abs(factor - 1) > 1e-6
      ? t('rangeSolver.scopeView.sfpScale', { factor: String(Number(factor.toFixed(2))) })
      : '';

    if (!shot) return;
    const angle = aimAngle(shot, mode);
    if (!Number.isFinite(angle.x) || !Number.isFinite(angle.y)) return;
    const picture = sightPicture(optics, zoom, angle, { margin: MARK_RADIUS / FIT_RADIUS });
    if (picture.inside) {
      for (const n of markNodes(HALF + picture.point.x * k, HALF + picture.point.y * k)) markLayer.appendChild(n);
    } else {
      for (const n of arrowNode(picture.direction)) arrowLayer.appendChild(n);
      svg.setAttribute('aria-label', `${t('rangeSolver.scopeView.canvasLabel')} — ${t('rangeSolver.scopeView.offField')}`);
    }
  }

  // Coalesced to one frame: a zoom drag fires faster than it needs
  // drawing. Without requestAnimationFrame (tests), drawn at once.
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
    optic = {
      scope: next.scope, reticle: next.reticle, optics, range,
      buildRadius: sightPicture(optics, buildZoom, null).radius
    };
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
    dispose: () => {
      ring.dispose();
      if (frame !== null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frame);
    }
  };
}
