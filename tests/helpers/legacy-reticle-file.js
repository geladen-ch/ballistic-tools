// Test-only: a reticle document as a reticle file of 4.3.x (version 2),
// which the app now only reads (src/reticle/file-codec.js). The scope is
// written as the optics the document's reference scope stands for, so it
// reads back as the same reference scope (a fixed one within rounding).
import { FILE_FORMAT } from '../../src/reticle/file-codec.js';
import { referenceOptics } from '../../src/reticle/scope.js';
import { pick, storedElement, storedIllumination } from '../../src/reticle/stored-reticle.js';

const LEGACY_PATH_KEYS = ['d', 'fill', 'fillRule', 'stroke', 'cap', 'join', 'miter'];

const SCOPE_KEYS_BY_TYPE = {
  fixed: ['type', 'fovMaxRad', 'fovDistanceM'],
  ffp: ['type', 'fovMaxRad', 'fovMinRad', 'fovDistanceM', 'zoomMin', 'zoomMax'],
  sfp: ['type', 'fovMaxRad', 'fovMinRad', 'fovDistanceM', 'zoomMin', 'zoomMax', 'calibrationZoom']
};

export function legacyReticleFile(doc) {
  const payload = { format: FILE_FORMAT, version: 2 };
  if (doc.name) payload.name = doc.name;
  payload.scope = pick(referenceOptics(doc.referenceScope), SCOPE_KEYS_BY_TYPE[doc.referenceScope.type]);
  const illumination = storedIllumination(doc.illumination);
  if (illumination) payload.illumination = illumination;
  // 4.3.x stored a drawing as its plain path list, absolute.
  payload.elements = doc.elements.map((e) => {
    const stored = storedElement(e);
    if (e.type === 'svg') stored.shape = { paths: e.shape.paths.map((p) => pick(p, LEGACY_PATH_KEYS)) };
    return stored;
  });
  return JSON.stringify(payload, null, 2);
}
