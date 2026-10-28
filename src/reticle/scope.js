// Scope optics: a scope's type (fixed magnification, first focal plane,
// second focal plane), its field of view and its zoom range. Pure — no
// DOM. Angles in radians, distances in metres.
//
// A real variable scope is defined by its field of view at the two ends of
// the zoom range; the advertised magnification ratio (e.g. 4–24x) is only
// an approximation of the ratio between the two fields.
//
// A reticle is drawn for a *reference scope* instead: just the type and
// the magnification (the zoom range for a variable scope, plus the zoom
// its subtensions are true at for an SFP one). Its field of view is not
// entered but assumed — REFERENCE_FIELD_WIDTH_M at REFERENCE_DISTANCE_M
// at REFERENCE_ZOOM, inversely proportional to the zoom — so the Reticle
// Designer can draw the field the reticle sits in. The real scope a
// reticle is mounted in brings its own optics.
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

export const REFERENCE_ZOOM = 3;
export const REFERENCE_FIELD_WIDTH_M = 12;
export const REFERENCE_DISTANCE_M = 100;

// A reference scope: { type, zoomMin, zoomMax, calibrationZoom }. A fixed
// scope has one magnification, held as zoomMin = zoomMax; calibrationZoom
// only means something for SFP.
export function defaultReferenceScope() {
  return { type: 'ffp', zoomMin: 5, zoomMax: 25, calibrationZoom: 25 };
}

// tan(half field) at REFERENCE_ZOOM; magnification is inversely
// proportional to the tangent of the half field (see zoomRatio below).
const referenceHalfTan = () => Math.tan(fieldOfViewAngle(REFERENCE_FIELD_WIDTH_M, REFERENCE_DISTANCE_M) / 2);

// The assumed full field angle at magnification `zoom`.
export function referenceFieldAt(zoom) {
  return 2 * Math.atan(referenceHalfTan() * REFERENCE_ZOOM / zoom);
}

// The inverse: the magnification that shows full field angle `fovRad`
// under the reference assumption.
export function referenceZoomForField(fovRad) {
  const half = Math.tan(fovRad / 2);
  return half > 0 ? referenceHalfTan() * REFERENCE_ZOOM / half : NaN;
}

// A reference scope as optics — the shape every function below works on.
export function referenceOptics(ref) {
  const zoomMin = ref.zoomMin;
  const zoomMax = ref.type === 'fixed' ? ref.zoomMin : ref.zoomMax;
  return {
    type: ref.type,
    fovMaxRad: referenceFieldAt(zoomMin),
    fovMinRad: referenceFieldAt(zoomMax),
    fovDistanceM: REFERENCE_DISTANCE_M,
    zoomMin,
    zoomMax,
    calibrationZoom: ref.calibrationZoom
  };
}

// A reference scope from a scope's optics, as reticle files before
// reference scopes stored them: a variable scope keeps its zoom range (and
// calibration zoom); a fixed one had no magnification, so it gets the one
// its field of view stands for under the reference assumption.
export function referenceScopeFromOptics(scope) {
  const fallback = defaultReferenceScope();
  if (scope.type === 'fixed') {
    const zoom = referenceZoomForField(scope.fovMaxRad);
    const z = zoom > 0 ? zoom : REFERENCE_ZOOM;
    return { type: 'fixed', zoomMin: z, zoomMax: z, calibrationZoom: z };
  }
  const zoomMin = scope.zoomMin > 0 ? scope.zoomMin : fallback.zoomMin;
  const zoomMax = scope.zoomMax > zoomMin ? scope.zoomMax : zoomMin * fallback.zoomMax / fallback.zoomMin;
  const calibrationZoom = scope.type === 'sfp' && scope.calibrationZoom > 0 ? scope.calibrationZoom : zoomMax;
  return { type: scope.type, zoomMin, zoomMax, calibrationZoom };
}

// Error keys (reticleDesigner.errors.*) per invalid field of a reference
// scope, empty when it is consistent.
export function validateReferenceScope(ref) {
  const errors = {};
  if (!SCOPE_TYPES.includes(ref.type)) errors.type = 'scopeType';
  if (!(ref.zoomMin > 0) || !Number.isFinite(ref.zoomMin)) errors.zoomMin = 'positive';
  if (ref.type === 'fixed') return errors;
  if (!(ref.zoomMax > 0) || !Number.isFinite(ref.zoomMax)) errors.zoomMax = 'positive';
  else if (!errors.zoomMin && !(ref.zoomMax > ref.zoomMin)) errors.zoomMax = 'zoomMaxAboveMin';
  if (ref.type === 'sfp') {
    if (!(ref.calibrationZoom > 0) || !Number.isFinite(ref.calibrationZoom)) errors.calibrationZoom = 'positive';
    else if (!errors.zoomMin && !errors.zoomMax
      && (ref.calibrationZoom < ref.zoomMin * (1 - ZOOM_TOLERANCE) || ref.calibrationZoom > ref.zoomMax * (1 + ZOOM_TOLERANCE))) {
      errors.calibrationZoom = 'calibrationInRange';
    }
  }
  return errors;
}

// Magnification is inversely proportional to the tangent of the half
// field, so the zoom ratio is exactly tan(max/2) / tan(min/2) — which is
// also the ratio of the two field widths at one distance.
export function zoomRatio(fovMaxRad, fovMinRad) {
  const lo = Math.tan(fovMinRad / 2);
  return lo > 0 ? Math.tan(fovMaxRad / 2) / lo : NaN;
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
