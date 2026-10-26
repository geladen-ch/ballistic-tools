// The scope a reticle is designed for: its type (fixed magnification,
// first focal plane, second focal plane), its field of view and its zoom
// range. Pure — no DOM. Angles in radians, distances in metres.
//
// A variable scope is defined by its field of view at the two ends of the
// zoom range; the advertised magnification ratio (e.g. 4–24x) is only an
// approximation of the ratio between the two fields. The zoom figures are
// therefore an auxiliary input: typing one end derives the other from the
// actual fields of view.
import { fieldOfViewAngle } from '../quantity.js';

export const SCOPE_TYPES = ['fixed', 'ffp', 'sfp'];

const ZOOM_TOLERANCE = 1e-6;

// A typical 5–25x long-range scope: 7.5 m to 1.5 m at 100 m.
export function defaultScope() {
  const distanceM = 100;
  return {
    type: 'ffp',
    fovMaxRad: fieldOfViewAngle(7.5, distanceM),
    fovMinRad: fieldOfViewAngle(1.5, distanceM),
    fovDistanceM: distanceM,
    zoomMin: 5,
    zoomMax: 25,
    calibrationZoom: 25
  };
}

// Magnification is inversely proportional to the tangent of the half
// field, so the zoom ratio is exactly tan(max/2) / tan(min/2) — which is
// also the ratio of the two field widths at one distance.
export function zoomRatio(fovMaxRad, fovMinRad) {
  const lo = Math.tan(fovMinRad / 2);
  return lo > 0 ? Math.tan(fovMaxRad / 2) / lo : NaN;
}

// The other end of the zoom range, from one end and the two fields.
// `which` names the end that was typed: 'min' (lowest magnification, max
// field) or 'max'.
export function zoomPartner(scope, which, value) {
  const ratio = zoomRatio(scope.fovMaxRad, scope.fovMinRad);
  if (!(value > 0) || !Number.isFinite(ratio)) return NaN;
  return which === 'min' ? value * ratio : value / ratio;
}

// Angular radius of the visible field, in the reticle's own (calibrated)
// subtensions — the circle the designer draws around the reticle.
// Fixed and FFP: the reticle scales with the image, so the largest field
// the scope ever shows is the maximum field of view. SFP: the reticle sits
// at the field stop and never changes size, so in subtensions calibrated
// at the calibration zoom the visible field is the field at that zoom.
export function visibleFieldRadius(scope) {
  const halfMax = scope.fovMaxRad / 2;
  if (scope.type !== 'sfp') return halfMax;
  if (!(scope.zoomMin > 0) || !(scope.calibrationZoom > 0)) return halfMax;
  return Math.atan(Math.tan(halfMax) * scope.zoomMin / scope.calibrationZoom);
}

// The scope's zoom range as [lowest, highest] magnification; a fixed scope
// has none (null).
export function zoomRange(scope) {
  if (scope.type === 'fixed' || !(scope.zoomMin > 0) || !(scope.zoomMax > scope.zoomMin)) return null;
  return [scope.zoomMin, scope.zoomMax];
}

// Angular radius, in the reticle's own subtensions, of the field seen at
// magnification `zoom` — what the view shows when the zoom ring is set
// there. FFP: the reticle scales with the image, so a higher zoom shows a
// smaller part of the reticle, down to the minimum field at the top of
// the range. SFP: the reticle stays the same size against the field stop,
// so the part of it seen never changes (only what its subtensions are
// worth does). Fixed: there is only one field.
export function fieldRadiusAtZoom(scope, zoom) {
  const range = zoomRange(scope);
  if (scope.type !== 'ffp' || !range || !(zoom > 0)) return visibleFieldRadius(scope);
  const clamped = Math.min(range[1], Math.max(range[0], zoom));
  return Math.atan(Math.tan(scope.fovMaxRad / 2) * range[0] / clamped);
}

// Error keys (reticleDesigner.errors.*) per invalid field, empty when the
// scope is consistent.
export function validateScope(scope) {
  const errors = {};
  if (!SCOPE_TYPES.includes(scope.type)) errors.type = 'scopeType';
  if (!(scope.fovMaxRad > 0 && scope.fovMaxRad < Math.PI)) errors.fovMaxRad = 'positive';
  if (!(scope.fovDistanceM > 0)) errors.fovDistanceM = 'positive';
  if (scope.type !== 'fixed') {
    if (!(scope.fovMinRad > 0)) errors.fovMinRad = 'positive';
    else if (!(scope.fovMinRad < scope.fovMaxRad)) errors.fovMinRad = 'fovMinBelowMax';
  }
  if (scope.type === 'sfp') {
    if (!(scope.zoomMin > 0)) errors.zoomMin = 'positive';
    if (!(scope.zoomMax > 0)) errors.zoomMax = 'positive';
    if (!(scope.calibrationZoom > 0)) errors.calibrationZoom = 'positive';
    // A derived zoom end carries rounding from the field ratio, so a
    // calibration zoom typed as the same round figure must still count
    // as inside the range.
    else if (scope.zoomMin > 0 && scope.zoomMax > 0
      && (scope.calibrationZoom < scope.zoomMin * (1 - ZOOM_TOLERANCE)
        || scope.calibrationZoom > scope.zoomMax * (1 + ZOOM_TOLERANCE))) {
      errors.calibrationZoom = 'calibrationInRange';
    }
  }
  return errors;
}
