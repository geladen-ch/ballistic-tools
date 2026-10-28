// A scope record — a real rifle scope in the built-in library or the
// user's Arsenal — and what is worked out from it. Pure, all SI:
//
// scope = {
//   id, name, manufacturer, model,
//   reticleIds: [...]            // built-in or Arsenal reticles; at least one to be usable on a rifle
//   type: 'fixed' | 'ffp' | 'sfp',
//   magnificationMin, magnificationMax,   // nominal; equal for a fixed scope
//   fovMaxRad, fovMinRad, fovDistanceM,   // field of view at both ends (fovMinRad: variable only)
//   calibrationZoom,                      // SFP only: the zoom the subtensions are true at
//   clickUnit: 'mrad' | 'arcmin', clickHorizontalRad, clickVerticalRad
// }
//
// The field of view takes precedence over the nominal low magnification:
// the nominal high one is taken to go with the narrowest field, and the
// actual low magnification follows from the ratio of the two fields
// (actualMagnificationMin).
//
// `name` is never typed: it is the manufacturer and model (opticLabel),
// set afresh whenever a record is encoded or decoded, so it can't drift.
// It is there because every library record has one — the name lookups,
// change history and sync identify records by it.
import { mradToRad, moaToRad } from './quantity.js';
import { SCOPE_TYPES, zoomRatio, validateScope } from './reticle/scope.js';

export const SCOPE_CLICK_UNITS = ['mrad', 'arcmin'];

// The usual click of a turret in each unit: 0.1 mrad, 0.25 MOA.
export const DEFAULT_CLICK_RAD = Object.freeze({ mrad: mradToRad(0.1), arcmin: moaToRad(0.25) });

// The label of a scope or a reticle: its manufacturer and model.
export function opticLabel(record) {
  const part = (v) => (typeof v === 'string' ? v.trim() : '');
  return [part(record.manufacturer), part(record.model)].filter(Boolean).join(' ');
}

export function encodeScope(scope) {
  if (!scope || typeof scope !== 'object' || scope.deletedAt) return scope;
  return { ...scope, name: opticLabel(scope) };
}

export function decodeScope(stored) {
  if (!stored || typeof stored !== 'object' || stored.deletedAt) return stored;
  return { ...stored, name: opticLabel(stored) };
}

export function isVariableScope(scope) {
  return scope.type === 'ffp' || scope.type === 'sfp';
}

// The lowest magnification the scope really has: the nominal high one
// scaled by the ratio of the two fields of view. A fixed scope's is its
// one magnification.
export function actualMagnificationMin(scope) {
  if (!isVariableScope(scope)) return scope.magnificationMin;
  const ratio = zoomRatio(scope.fovMaxRad, scope.fovMinRad);
  return ratio > 0 && Number.isFinite(ratio) ? scope.magnificationMax / ratio : NaN;
}

// The scope as optics (reticle/scope.js's shape), with its actual zoom
// range.
export function scopeOptics(scope) {
  const variable = isVariableScope(scope);
  return {
    type: scope.type,
    fovMaxRad: scope.fovMaxRad,
    fovMinRad: variable ? scope.fovMinRad : scope.fovMaxRad,
    fovDistanceM: scope.fovDistanceM,
    zoomMin: actualMagnificationMin(scope),
    zoomMax: scope.magnificationMax,
    calibrationZoom: scope.calibrationZoom
  };
}

// A new scope's values: a variable first-focal-plane scope with the usual
// mrad clicks, no reticle yet.
export function defaultScopeRecord() {
  return {
    manufacturer: '',
    model: '',
    reticleIds: [],
    type: 'ffp',
    magnificationMin: 5,
    magnificationMax: 25,
    fovMaxRad: null,
    fovMinRad: null,
    fovDistanceM: 100,
    calibrationZoom: null,
    clickUnit: 'mrad',
    clickHorizontalRad: DEFAULT_CLICK_RAD.mrad,
    clickVerticalRad: DEFAULT_CLICK_RAD.mrad
  };
}

const positive = (v) => typeof v === 'number' && Number.isFinite(v) && v > 0;

// Error keys per invalid field, empty when the record is consistent: the
// field-of-view and calibration checks are reticle/scope.js's
// (reticleDesigner.errors.*); the rest are 'required', 'positive' and
// 'magnificationOrder' (the nominal high magnification above the low one).
export function validateScopeRecord(scope) {
  const errors = {};
  if (!opticLabel({ manufacturer: scope.manufacturer })) errors.manufacturer = 'required';
  if (!opticLabel({ model: scope.model })) errors.model = 'required';
  if (!SCOPE_TYPES.includes(scope.type)) errors.type = 'scopeType';
  if (!positive(scope.magnificationMin)) errors.magnificationMin = 'positive';
  if (!positive(scope.magnificationMax)) errors.magnificationMax = 'positive';
  else if (isVariableScope(scope) && positive(scope.magnificationMin) && !(scope.magnificationMax > scope.magnificationMin)) {
    errors.magnificationMax = 'magnificationOrder';
  }
  if (!errors.type) {
    const optics = validateScope(scopeOptics(scope));
    for (const key of ['fovMaxRad', 'fovMinRad', 'fovDistanceM']) if (optics[key]) errors[key] = optics[key];
    if (scope.type === 'sfp' && !errors.fovMaxRad && !errors.fovMinRad && !errors.magnificationMax && optics.calibrationZoom) {
      errors.calibrationZoom = optics.calibrationZoom;
    }
  }
  if (!SCOPE_CLICK_UNITS.includes(scope.clickUnit)) errors.clickUnit = 'required';
  if (!positive(scope.clickHorizontalRad)) errors.clickHorizontalRad = 'positive';
  if (!positive(scope.clickVerticalRad)) errors.clickVerticalRad = 'positive';
  if (!Array.isArray(scope.reticleIds) || !scope.reticleIds.every((id) => typeof id === 'string')) errors.reticleIds = 'required';
  return errors;
}

// Usable on a rifle: has at least one reticle.
export function isUsableScope(scope) {
  return Array.isArray(scope.reticleIds) && scope.reticleIds.length > 0;
}
