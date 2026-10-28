// What the shooter sees through a scope for one solved shot: where on the
// reticle the target goes, how much of the reticle the field shows at a
// given zoom, and the zoom ring's graduation. Pure — no DOM. Angles in
// radians, y positive down (as reticle/geometry.js), zoom a plain ratio.
import { fieldRadiusAtZoom } from './scope.js';

export const AIM_MODES = ['hold', 'dialElevation'];

// An SFP zoom this close to the calibration zoom (as a fraction of it)
// snaps to it, so the subtensions are true without fiddling the ring.
export const CALIBRATION_SNAP = 0.05;

// The true angle from the reticle centre to the target's aiming point,
// from the correction the Range Solver's readout shows — `elevationRad`
// positive to dial up, `windageRad` positive to dial right. The point is
// that correction turned round: a dial-up shot is held below the centre,
// a dial-right one left of it.
// - 'hold': nothing dialed — both components.
// - 'dialElevation': elevation is on the turret, windage is held — the
//   point sits on the horizontal axis.
export function aimAngle({ elevationRad, windageRad }, mode = 'hold') {
  const x = -windageRad;
  const y = mode === 'dialElevation' ? 0 : elevationRad;
  return { x: x + 0, y: y + 0 }; // + 0 turns -0 into 0
}

// A true angle in the reticle's own subtensions at `zoom`. FFP and fixed:
// the reticle scales with the image, so they are the same. SFP: the
// reticle keeps its size against the field stop, so above the
// calibration zoom it covers less true angle and a hold reaches further
// out on it (by zoom / calibrationZoom).
export function toReticleSubtension(angle, optics, zoom) {
  if (optics.type !== 'sfp' || !(optics.calibrationZoom > 0) || !(zoom > 0)) return { ...angle };
  const f = zoom / optics.calibrationZoom;
  return { x: angle.x * f, y: angle.y * f };
}

// How much the subtensions are worth at `zoom`, as a factor on their
// nominal value: 1 except for SFP away from its calibration zoom.
export function subtensionFactor(optics, zoom) {
  if (optics.type !== 'sfp' || !(optics.calibrationZoom > 0) || !(zoom > 0)) return 1;
  return optics.calibrationZoom / zoom;
}

// The scene for one shot at one zoom: the field radius and the aiming
// point, both in reticle subtensions, and whether that point is inside
// the field (with `margin`, a fraction of the radius kept clear at the
// rim for the mark itself). `angle` null: no solved shot, no point.
export function sightPicture(optics, zoom, angle, { margin = 0 } = {}) {
  const radius = fieldRadiusAtZoom(optics, zoom);
  if (!angle) return { radius, point: null, inside: false, direction: null };
  const point = toReticleSubtension(angle, optics, zoom);
  const inside = Math.hypot(point.x, point.y) <= radius * (1 - margin);
  return { radius, point, inside, direction: Math.atan2(point.y, point.x) };
}

// The zoom range the ring covers — [lowest, highest] — or null for a
// fixed scope (or an inconsistent one).
export function ringRange(optics) {
  if (optics.type === 'fixed') return null;
  const { zoomMin, zoomMax } = optics;
  return zoomMin > 0 && zoomMax > zoomMin && Number.isFinite(zoomMax) ? [zoomMin, zoomMax] : null;
}

// `zoom` clamped to the ring, snapped to the calibration zoom for an SFP
// scope when within CALIBRATION_SNAP of it.
export function settleZoom(optics, zoom) {
  const range = ringRange(optics);
  if (!range) return optics.zoomMax;
  let z = Math.min(range[1], Math.max(range[0], zoom));
  const cal = optics.calibrationZoom;
  if (optics.type === 'sfp' && cal > 0 && Math.abs(z / cal - 1) <= CALIBRATION_SNAP + 1e-9) z = Math.min(range[1], Math.max(range[0], cal));
  return z;
}

// The zoom a scope's view opens at: the calibration zoom for SFP (the
// only one its subtensions are true at), the highest for FFP.
export function initialZoom(optics) {
  const range = ringRange(optics);
  if (!range) return optics.zoomMax;
  return settleZoom(optics, optics.type === 'sfp' && optics.calibrationZoom > 0 ? optics.calibrationZoom : range[1]);
}

// A zoom as its label: one decimal, dropped when whole ("8×", "3.2×").
export function zoomLabel(zoom) {
  return `${String(Number(zoom.toFixed(1)))}×`;
}

// The ring's graduation: a bar at each end and at every whole zoom
// between, the calibration zoom marked for SFP. Labels go on max, min,
// the calibration zoom, then multiples of 5, then the rest, each only if
// it keeps clear of the ones already placed. `labelFits` is the room
// check — (positionA, positionB) → whether labels at those two positions
// (0..1 along the ring) would not overlap — so this stays pure.
// Returns [{ zoom, position, label|null, calibration, end }] in zoom order.
export function zoomTicks(optics, labelFits) {
  const range = ringRange(optics);
  if (!range) return [];
  const [lo, hi] = range;
  const position = (z) => (z - lo) / (hi - lo);
  const near = (a, b) => Math.abs(a - b) < 1e-6 * hi;
  const cal = optics.type === 'sfp' && optics.calibrationZoom >= lo * (1 - 1e-6) && optics.calibrationZoom <= hi * (1 + 1e-6)
    ? optics.calibrationZoom : null;

  const zooms = [lo];
  for (let z = Math.ceil(lo - 1e-9); z <= hi + 1e-9; z += 1) if (!near(z, lo) && !near(z, hi)) zooms.push(z);
  zooms.push(hi);
  if (cal !== null && !zooms.some((z) => near(z, cal))) zooms.push(cal);
  zooms.sort((a, b) => a - b);

  const ticks = zooms.map((zoom) => ({
    zoom,
    position: Math.min(1, Math.max(0, position(zoom))),
    label: null,
    calibration: cal !== null && near(zoom, cal),
    end: near(zoom, lo) || near(zoom, hi)
  }));

  const rank = (tick) => {
    if (near(tick.zoom, hi)) return 0;
    if (near(tick.zoom, lo)) return 1;
    if (tick.calibration) return 2;
    if (Number.isInteger(tick.zoom) && tick.zoom % 5 === 0) return 3;
    return 4;
  };
  const placed = [];
  const order = [...ticks].sort((a, b) => rank(a) - rank(b) || a.zoom - b.zoom);
  for (const tick of order) {
    if (placed.every((p) => labelFits(p.position, tick.position))) {
      tick.label = zoomLabel(tick.zoom);
      placed.push(tick);
    }
  }
  return ticks;
}
