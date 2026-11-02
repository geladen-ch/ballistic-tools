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
// setOptic({ scope, reticle } | null), setShot({ elevationRad, windageRad,
// crosswindMs } | null) — the readout's correction as angles: what to
// draw; and the wind's crosswind part (m/s, positive from the right), for
// the Upwind BDC range display.
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
//
// BDC overlay (reticle/bdc-overlay.js), for a reticle with BDC marks: a
// toggle in the bottom-left corner labels each mark with the range it
// holds for — a dot on the mark's level, moved across by spin drift,
// marks its hold — and lays crosswind holds beside it, a dot every quarter of the
// reference wind up to one and a half times it, from either side, the
// reference larger. In Dial elevation the centre holds for the target's
// range, the elevation for it being on the turret, and the marks below
// it for that elevation plus their own. Above the toggle, while on, the
// reference crosswind in the user's unit. Where the ranges go is the BDC
// range display setting (range-solver-prefs.js): Callout (in a lane by
// the square's right edge, joined to the marks by leaders —
// bdc-callouts.js), Below (under each hold) or Upwind (beside it, on the
// side the wind comes from, that side's wind holds left out). The
// trajectory is the caller's (setBdcTables, asked for through
// onBdcChange whenever wantsBdc() may have changed); the ranges follow
// the zoom, true for the subtensions at it.
//
// Settings' reticle overlay colour (range-solver-prefs.js) colours all of
// it — vermillion, blue, or Auto's choice between them for the reticle's
// illumination — and its shape draws holds as dots or as upright hashes,
// a hold point (the aiming mark's centre, a BDC mark's own) then a small
// cross.
import { el, clear } from '../../dom.js';
import { svgEl } from '../../svg.js';
import { t } from '../../i18n.js';
import { holdIcon, dialElevationIcon, zoomToReticleIcon, bdcOverlayIcon } from '../nav-icons.js';
import { fmt } from '../../reticle/render.js';
import { scopeOptics } from '../../scope-record.js';
import {
  AIM_MODES, aimAngle, sightPicture, ringRange, settleZoom, initialZoom, zoomLabel, subtensionFactor, toReticleSubtension
} from '../../reticle/sight-picture.js';
import {
  getScopeAimMode, setScopeAimMode, getScopeRingPosition, isScopeBdcOverlayOn, setScopeBdcOverlayOn,
  getReticleOverlayColor, reticleOverlayHex, getReticleOverlayShape, getBdcRangeDisplay
} from '../../range-solver-prefs.js';
import { calloutLayout, CAP_HEIGHT, LEADER_STROKE } from './bdc-callouts.js';
import { bdcLevels, bdcOverlay } from '../../reticle/bdc-overlay.js';
import { displayChoice, toDisplayUnit } from '../../display-units.js';
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
// The aiming mark's centre as a cross (the hashes shape): half its arm
// and its stroke, in drawing units.
const MARK_CROSS = 9;
const MARK_CROSS_STROKE = 3;
// The BDC overlay, in drawing units: dot radii (a mark's own, a crosswind
// hold's, the reference's); for the hashes shape a mark's cross (half its
// arm, its stroke) and the crosswind holds' upright hashes (their length,
// hanging from the mark's level, and their stroke; the reference's longer
// and thicker); their halo, and the range label's full size.
const BDC_DOT = 5;
const BDC_WIND_DOT = 3.5;
const BDC_WIND_DOT_MAJOR = 6.5;
const BDC_CROSS = 7;
const BDC_CROSS_STROKE = 2.5;
const BDC_HASH = 15;
const BDC_HASH_STROKE = 3;
const BDC_HASH_MAJOR = 20;
const BDC_HASH_MAJOR_STROKE = 6;
const BDC_HALO = 2.5;
const BDC_LABEL_SIZE = 36;
// Labels crowding each other shrink down to this share of their size
// before any is left out.
const BDC_LABEL_MIN_SCALE = 0.75;
// The label's outline, as a share of its size.
const BDC_LABEL_OUTLINE = 7.5 / 36;
// The least distance between two labels' baselines, in label sizes.
const BDC_LABEL_PITCH = 1.1;

// The Callout display's leaders as drawn: the stroke's halo (the stroke
// itself is bdc-callouts.js's).
const BDC_LEADER_HALO = 1.5;
// The corners' controls (screen pixels, from the square's corner, their
// largest extent — every control shown, the zoom to reticle steps and
// the reference wind included): where the square's layout can't be
// measured (tests), what the Callout display's numbers keep out of and
// its leaders route round in a corner whose controls are shown. Measured
// otherwise, so a hidden control keeps nothing out.
const BDC_CONTROL_ZONES_PX = {
  topLeft: { width: 72, height: 40 },
  topRight: { width: 40, height: 40 },
  bottomLeft: { width: 64, height: 64 },
  bottomRight: { width: 104, height: 64 }
};
// The square's width on screen when it can't be measured (tests).
const FALLBACK_SQUARE_PX = 560;
// The Upwind display: the gap between a mark's hold and its range.
const BDC_UPWIND_GAP = 6;

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

export function scopeView({ onBdcChange = () => {} } = {}) {
  clipCounter += 1;
  const clipId = `scope-view-clip-${clipCounter}`;
  const markClipId = `scope-view-mark-clip-${clipCounter}`;

  let optic = null; // { scope, reticle, optics, range, buildRadius, reticleZoomFit, bdcLevels }
  let shot = null;
  let bdcOn = isScopeBdcOverlayOn();
  // Settings' reticle overlay colour and shape, read once: Settings is a
  // page of its own, so they can't change under a mounted view.
  const overlayColor = getReticleOverlayColor();
  const hashes = getReticleOverlayShape() === 'hashes';
  const bdcDisplay = getBdcRangeDisplay();
  let bdcTables = null;
  let zoom = NaN;
  // Zoom to reticle: on or off, and the magnification it adds while on
  // (NaN until first switched on for the scope).
  let reticleZoomOn = false;
  let reticleZoom = NaN;
  let mode = getScopeAimMode();

  const fieldCircle = (cls) => svgEl('circle', { class: cls, cx: fmt(HALF), cy: fmt(HALF), r: fmt(FIT_RADIUS) });
  const zoomGroup = svgEl('g', { class: 'scope-view-zoom' });
  const markLayer = svgEl('g', { class: 'scope-view-mark' });
  const bdcLayer = svgEl('g', { class: 'scope-view-bdc' });
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
  // The Callout display's numbers and leaders, free to use the square
  // outside the field.
  const calloutLayer = svgEl('g', { class: 'scope-view-bdc-callouts' });
  const svg = svgEl('svg', {
    viewBox: `0 0 ${SIZE} ${SIZE}`, class: 'scope-view-canvas', role: 'img', 'aria-label': t('rangeSolver.scopeView.canvasLabel')
  }, [
    svgEl('defs', {}, [
      svgEl('clipPath', { id: clipId }, [fieldCircle('')]),
      svgEl('clipPath', { id: markClipId }, [markClipCircle])
    ]),
    svgEl('rect', { class: 'reticle-outside', x: '0', y: '0', width: String(SIZE), height: String(SIZE) }),
    fieldGroup,
    svgEl('g', { 'clip-path': `url(#${markClipId})` }, [bdcLayer, markLayer]),
    calloutLayer,
    arrowLayer
  ]);
  // The square the reticle is drawn in. Its corners, outside the field
  // circle, hold controls laid over it: the aiming-point mode switch top
  // left, a slot top right for the caller's own, the BDC overlay bottom
  // left, and zoom to reticle with its magnification label bottom right.
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
  const bdcName = t('rangeSolver.scopeView.bdcOverlay');
  const bdcButton = el('button', {
    type: 'button', class: 'icon-button scope-view-bdc-toggle', 'aria-pressed': 'false', title: bdcName, 'aria-label': bdcName
  }, [bdcOverlayIcon(20)]);
  bdcButton.addEventListener('click', () => {
    bdcOn = !bdcOn;
    setScopeBdcOverlayOn(bdcOn);
    onBdcChange();
    scheduleRender();
  });
  const bdcWindValue = el('span', { class: 'scope-view-bdc-wind-value' });
  const cornerBottomLeft = el('div', { class: 'scope-view-corner-bottom-left' }, [bdcWindValue, bdcButton]);
  cornerBottomLeft.style.display = 'none';
  const square = el('div', { class: 'scope-view-frame' }, [svg, cornerLeft, corner, cornerBottomLeft, cornerBottomRight]);
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

  // An upright cross at (cx, cy), haloed: [halo, cross].
  function crossNodes(cx, cy, half, stroke, halo, cls) {
    const d = `M${fmt(cx - half)} ${fmt(cy)}H${fmt(cx + half)}M${fmt(cx)} ${fmt(cy - half)}V${fmt(cy + half)}`;
    return [
      svgEl('path', { class: 'scope-view-stroke-halo', d, 'stroke-width': fmt(stroke + 2 * halo) }),
      svgEl('path', { class: cls, d, 'stroke-width': fmt(stroke) })
    ];
  }

  function markNodes(cx, cy) {
    const lead = (x2, y2, cls) => svgEl('line', { class: cls, x1: fmt(cx), y1: fmt(cy), x2: fmt(x2), y2: fmt(y2) });
    const nodes = [];
    // Leads to the vertical axis (horizontal line) and the horizontal axis
    // (vertical line), haloed, under the mark. Dial elevation's mark sits
    // on the horizontal axis: no line along it back to the centre.
    const toVerticalAxis = mode !== 'dialElevation' && Math.abs(cx - HALF) > MARK_RADIUS;
    for (const cls of ['scope-view-lead-halo', 'scope-view-lead']) {
      if (toVerticalAxis) nodes.push(lead(HALF, cy, cls));
      if (Math.abs(cy - HALF) > MARK_RADIUS) nodes.push(lead(cx, HALF, cls));
    }
    // The ring and its halo see-through as one, so the reticle and the
    // wind holds behind show; the centre's cross or dot stays opaque.
    nodes.push(svgEl('g', { class: 'scope-view-mark-circle' }, [
      svgEl('circle', { class: 'scope-view-mark-halo', cx: fmt(cx), cy: fmt(cy), r: fmt(MARK_RADIUS), 'stroke-width': fmt(MARK_STROKE + 2 * HALO) }),
      svgEl('circle', { class: 'scope-view-mark-ring', cx: fmt(cx), cy: fmt(cy), r: fmt(MARK_RADIUS), 'stroke-width': fmt(MARK_STROKE) })
    ]));
    if (hashes) nodes.push(...crossNodes(cx, cy, MARK_CROSS, MARK_CROSS_STROKE, HALO, 'scope-view-mark-cross'));
    else nodes.push(svgEl('circle', { class: 'scope-view-mark-dot', cx: fmt(cx), cy: fmt(cy), r: fmt(MARK_DOT) }));
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

  // Whether the overlay is offered (a reticle with BDC marks) and on.
  const bdcAvailable = () => !!optic && optic.bdcLevels.length > 0;
  const wantsBdc = () => bdcAvailable() && bdcOn;

  function renderBdcToggle() {
    const on = wantsBdc();
    cornerBottomLeft.style.display = bdcAvailable() ? '' : 'none';
    bdcButton.setAttribute('aria-pressed', on ? 'true' : 'false');
    bdcButton.classList.toggle('active', on);
    // The reference crosswind the overlay's larger dots stand for, in the
    // user's wind speed unit — once its trajectories are in.
    const reference = on && bdcTables ? bdcTables.referenceSpeed : NaN;
    if (Number.isFinite(reference)) {
      const choice = displayChoice('windSpeed');
      const value = `${String(Number(toDisplayUnit('windSpeed', reference).toFixed(choice.decimals)))} ${choice.label}`;
      bdcWindValue.textContent = value;
      const label = t('rangeSolver.scopeView.bdcReferenceWind', { value });
      bdcWindValue.setAttribute('title', label);
      bdcWindValue.setAttribute('aria-label', label);
      bdcWindValue.style.display = '';
    } else {
      bdcWindValue.textContent = '';
      bdcWindValue.style.display = 'none';
    }
  }

  // The overlay's rows at `zoom`, drawn at `scale` drawing units per
  // radian of reticle subtension, their ranges as the BDC range display
  // setting has them. A dot's halo ring and the label's outline keep it
  // readable over the reticle's own lines; the labels go over every dot.
  // Below and Upwind: where the rows in view come closer than the labels
  // need, every label shrinks to fit the tightest of them, down to
  // BDC_LABEL_MIN_SCALE; past that, one that would still run into the
  // label above it is left out — zoom in (or zoom to reticle) to see it.
  // Upwind: the label beside the mark's hold on the side the wind comes
  // from (`shot.crosswindMs`, positive from the right; the right with
  // none), that side's wind holds left out. Callout: renderCallouts.
  function renderBdc(scale, fieldRadius) {
    if (!wantsBdc() || !bdcTables || !shot) return;
    const { optics } = optic;
    const dialed = mode === 'dialElevation' ? shot.elevationRad : 0;
    if (!Number.isFinite(dialed)) return;
    const rows = bdcOverlay({
      levels: optic.bdcLevels, still: bdcTables.still, referenceSpeed: bdcTables.referenceSpeed,
      factor: subtensionFactor(optics, zoom), dialedElevationRad: dialed
    });
    const screenX = (x) => HALF + toReticleSubtension({ x, y: 0 }, optics, zoom).x * scale;
    const dot = (cx, cy, r, cls) => [
      svgEl('circle', { class: 'scope-view-bdc-halo', cx: fmt(cx), cy: fmt(cy), r: fmt(r), 'stroke-width': fmt(2 * BDC_HALO) }),
      svgEl('circle', { class: cls, cx: fmt(cx), cy: fmt(cy), r: fmt(r) })
    ];
    // A hash hangs from the mark's level, its top end on it; a cross
    // (the mark's own hold) is centred on it.
    const hash = (cx, cy, length, stroke) => {
      const d = `M${fmt(cx)} ${fmt(cy)}V${fmt(cy + length)}`;
      return [
        svgEl('path', { class: 'scope-view-stroke-halo', d, 'stroke-width': fmt(stroke + 2 * BDC_HALO) }),
        svgEl('path', { class: 'scope-view-bdc-hash', d, 'stroke-width': fmt(stroke) })
      ];
    };
    const windNodes = (x, cy, major) => (hashes
      ? hash(x, cy, major ? BDC_HASH_MAJOR : BDC_HASH, major ? BDC_HASH_MAJOR_STROKE : BDC_HASH_STROKE)
      : dot(x, cy, major ? BDC_WIND_DOT_MAJOR : BDC_WIND_DOT, 'scope-view-bdc-wind'));
    const holdNodes = (cx, cy) => (hashes
      ? crossNodes(cx, cy, BDC_CROSS, BDC_CROSS_STROKE, BDC_HALO, 'scope-view-bdc-cross')
      : dot(cx, cy, BDC_DOT, 'scope-view-bdc-dot'));
    const rangeText = (row) => String(Math.round(toDisplayUnit('distance', row.rangeM)));
    if (bdcDisplay === 'callout') {
      // Each row's holds as drawn, as boxes (their ink, not their white
      // halo): its mark's own first, then the wind holds.
      const holdBox = (x, cy, wind) => {
        if (hashes && wind) {
          const half = (wind.major ? BDC_HASH_MAJOR_STROKE : BDC_HASH_STROKE) / 2;
          return { x0: x - half, x1: x + half, y0: cy, y1: cy + (wind.major ? BDC_HASH_MAJOR : BDC_HASH) };
        }
        const r = hashes ? BDC_CROSS : !wind ? BDC_DOT : wind.major ? BDC_WIND_DOT_MAJOR : BDC_WIND_DOT;
        return { x0: x - r, x1: x + r, y0: cy - r, y1: cy + r };
      };
      const marks = rows.map((row) => {
        const cy = HALF + row.level * scale;
        const cx = screenX(row.x);
        for (const wind of row.winds) {
          for (const n of windNodes(screenX(wind.x), cy, wind.major)) bdcLayer.appendChild(n);
        }
        for (const n of holdNodes(cx, cy)) bdcLayer.appendChild(n);
        return { row, cx, cy, holds: [holdBox(cx, cy, null), ...row.winds.map((wind) => holdBox(screenX(wind.x), cy, wind))] };
      });
      renderCallouts(marks, scale, fieldRadius, rangeText);
      return;
    }
    let tightest = Infinity;
    let above = null;
    for (const row of rows) {
      const cy = HALF + row.level * scale;
      if (cy < 0 || cy > SIZE) continue;
      if (above !== null) tightest = Math.min(tightest, cy - above);
      above = cy;
    }
    const labelSize = Math.min(BDC_LABEL_SIZE, Math.max(BDC_LABEL_SIZE * BDC_LABEL_MIN_SCALE, tightest / BDC_LABEL_PITCH));
    const holdRadius = hashes ? BDC_CROSS : BDC_DOT;
    const upwind = bdcDisplay === 'upwind';
    const labelSide = upwind && shot.crosswindMs < 0 ? -1 : 1;
    // Below: the baseline under the hold; Upwind: the figures centred on
    // the mark's level.
    const labelDrop = upwind ? (CAP_HEIGHT * labelSize) / 2 : holdRadius + 4 + labelSize * 0.75;
    const labels = [];
    let lastBaseline = -Infinity;
    for (const row of rows) {
      const cy = HALF + row.level * scale;
      const cx = screenX(row.x);
      for (const wind of row.winds) {
        const x = screenX(wind.x);
        if (upwind && Math.sign(x - cx) === labelSide) continue;
        for (const n of windNodes(x, cy, wind.major)) bdcLayer.appendChild(n);
      }
      for (const n of holdNodes(cx, cy)) bdcLayer.appendChild(n);
      const baseline = cy + labelDrop;
      if (baseline - lastBaseline < labelSize * BDC_LABEL_PITCH) continue;
      lastBaseline = baseline;
      labels.push(svgEl('text', {
        class: 'scope-view-bdc-label',
        x: fmt(upwind ? cx + labelSide * (holdRadius + BDC_HALO + BDC_UPWIND_GAP) : cx),
        y: fmt(baseline), 'font-size': fmt(labelSize), 'stroke-width': fmt(labelSize * BDC_LABEL_OUTLINE),
        'text-anchor': upwind ? (labelSide > 0 ? 'start' : 'end') : 'middle'
      }, [document.createTextNode(rangeText(row))]));
    }
    for (const n of labels) bdcLayer.appendChild(n);
  }

  // The Callout display (bdc-callouts.js): only the marks in view get a
  // number. A leader's halo stays inside the field (the clipped layer): on
  // the black outside it only the line runs on; a number on the glass
  // keeps its white outline, one on the black goes without.
  function renderCallouts(marks, scale, fieldRadius, text) {
    const inView = marks.filter(({ cx, cy }) => Math.hypot(cx - HALF, cy - HALF) <= fieldRadius && cy >= 0 && cy <= SIZE && cx >= 0 && cx <= SIZE);
    // The corners' controls that are shown, in drawing units at the
    // square's size on screen: as laid out, or at their largest where
    // nothing is.
    const squareRect = typeof svg.getBoundingClientRect === 'function' ? svg.getBoundingClientRect() : null;
    const measured = !!squareRect?.width;
    const unitsPerPx = SIZE / (measured ? squareRect.width : FALLBACK_SQUARE_PX);
    const zone = (node, fallback, right, bottom) => {
      if (node.style.display === 'none') return null;
      let width = fallback.width, height = fallback.height;
      if (measured) {
        const box = node.getBoundingClientRect();
        if (!box.width || !box.height) return null;
        width = right ? squareRect.right - box.left : box.right - squareRect.left;
        height = bottom ? squareRect.bottom - box.top : box.bottom - squareRect.top;
      }
      const w = width * unitsPerPx, h = height * unitsPerPx;
      return { x0: right ? SIZE - w : 0, x1: right ? SIZE : w, y0: bottom ? SIZE - h : 0, y1: bottom ? SIZE : h };
    };
    const zones = [
      zone(cornerLeft, BDC_CONTROL_ZONES_PX.topLeft, false, false), zone(corner, BDC_CONTROL_ZONES_PX.topRight, true, false),
      zone(cornerBottomLeft, BDC_CONTROL_ZONES_PX.bottomLeft, false, true), zone(cornerBottomRight, BDC_CONTROL_ZONES_PX.bottomRight, true, true)
    ].filter(Boolean);
    const { labelSize, numbers, leaders } = calloutLayout({ marks: inView, size: SIZE, unit: scale, zones, text });
    for (const points of leaders) {
      if (!points) continue;
      const d = points.map((p, i) => `${i ? 'L' : 'M'}${fmt(p.x)} ${fmt(p.y)}`).join('');
      bdcLayer.appendChild(svgEl('path', { class: 'scope-view-stroke-halo', d, 'stroke-width': fmt(LEADER_STROKE + 2 * BDC_LEADER_HALO) }));
      calloutLayer.appendChild(svgEl('path', { class: 'scope-view-bdc-leader', d, 'stroke-width': fmt(LEADER_STROKE) }));
    }
    for (const { row, x, cy } of numbers) {
      const onGlass = Math.hypot(x - HALF, cy - HALF) <= fieldRadius;
      calloutLayer.appendChild(svgEl('text', {
        class: `scope-view-bdc-label${onGlass ? '' : ' off-glass'}`, x: fmt(x), y: fmt(cy + (CAP_HEIGHT * labelSize) / 2), 'font-size': fmt(labelSize),
        'stroke-width': fmt(labelSize * BDC_LABEL_OUTLINE), 'text-anchor': 'middle'
      }, [document.createTextNode(text(row))]));
    }
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
    clear(bdcLayer);
    clear(calloutLayer);
    // The Callout display's numbers use the square outside the field, so
    // the canvas isn't clipped to the circle while they may be drawn.
    svg.classList.toggle('bdc-callouts', wantsBdc() && bdcDisplay === 'callout');
    clear(arrowLayer);
    renderBdcToggle();
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

    renderBdc(k * magnification, FIT_RADIUS * magnification);
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
        : null,
      bdcLevels: bdcLevels(next.reticle.elements)
    };
    node.style.setProperty('--scope-mark', reticleOverlayHex(overlayColor, next.reticle.illumination));
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

  // The hold table the BDC overlay reads and its reference crosswind
  // (bdc-trajectories.js), or null.
  function setBdcTables(next) {
    bdcTables = next;
    scheduleRender();
  }

  renderModeButtons();

  return {
    node,
    corner,
    setOptic,
    setShot,
    setBdcTables,
    wantsBdc,
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
