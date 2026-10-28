// Turning a reticle file from before the reticle library (file version 1
// or 2, as file-codec.js's parseReticle reads it) into library records: a
// reticle record, and a scope record from the optics the file's scope had.
// The file has no manufacturer, model, nominal magnification or clicks, so
// those come from the caller (the user, when loading one). Pure; records
// come out in the form the app holds them, ids left to the caller.
import { DEFAULT_CLICK_RAD } from '../scope-record.js';

// `doc` from parseReticle; `referenceScope` defaults to the one derived
// from the file's optics.
export function reticleRecordFromLegacy(doc, { manufacturer, model, referenceScope = doc.referenceScope }) {
  return {
    manufacturer,
    model,
    referenceScope: { ...referenceScope },
    illumination: { ...doc.illumination },
    elements: doc.elements,
    groups: doc.groups,
    nextId: doc.nextId
  };
}

// A scope with the file's optics: its type, its field(s) of view, and for
// an SFP the zoom its subtensions are true at. A fixed scope's one
// magnification is given as magnificationMin; clicks default to the
// unit's usual size.
export function scopeRecordFromLegacy(legacyScope, {
  manufacturer, model, magnificationMin, magnificationMax = magnificationMin, reticleIds = [], clickUnit = 'mrad',
  clickHorizontalRad = DEFAULT_CLICK_RAD[clickUnit], clickVerticalRad = DEFAULT_CLICK_RAD[clickUnit]
}) {
  const fixed = legacyScope.type === 'fixed';
  return {
    manufacturer,
    model,
    reticleIds: [...reticleIds],
    type: legacyScope.type,
    magnificationMin,
    magnificationMax: fixed ? magnificationMin : magnificationMax,
    fovMaxRad: legacyScope.fovMaxRad,
    fovMinRad: fixed ? null : legacyScope.fovMinRad,
    fovDistanceM: legacyScope.fovDistanceM,
    calibrationZoom: legacyScope.type === 'sfp' ? legacyScope.calibrationZoom : null,
    clickUnit,
    clickHorizontalRad,
    clickVerticalRad
  };
}
