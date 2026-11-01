// A reticle record — a reticle in the built-in library or the user's
// Arsenal — as the app holds it and as it is stored. Pure.
//
// Held (decoded) — a reticle document (model.js) plus the record's own
// fields, without the document's `name`:
//   { id, name, manufacturer, model, source, referenceScope, illumination, elements, groups, nextId, ...bookkeeping }
// Stored (encoded) — what stored-reticle.js keeps of the document:
//   { id, name, manufacturer, model, source, referenceScope, illumination?, elements: [stored element...], ...bookkeeping }
//
// `name` is the manufacturer and model (scope-record.js's opticLabel), set
// afresh on every encode and decode. Bookkeeping fields (modifiedAt,
// revision, unsaved, ...) and fields a later build adds pass through both
// ways untouched. Decoding treats the record as untrusted input (it may
// come from another device or a file) and throws, with `code`
// 'invalid-format' or 'too-large', when it doesn't hold a valid reticle.
// A tombstone (`deletedAt`) holds no reticle and passes through as it is.
import { opticLabel } from '../scope-record.js';
import {
  MAX_NAME, storedElement, storedReferenceScope, storedIllumination, parseReferenceScope, parseIllumination, parseElements, fail
} from './stored-reticle.js';

// The reticle-file version whose element format records follow (see
// stored-reticle.js's parseElements): a repeat stored only when it is on.
const ELEMENT_FORMAT_VERSION = 2;
// Document-only fields: rebuilt on decoding, never stored.
const DOCUMENT_ONLY = ['groups', 'nextId'];
// The longest source / notes text kept.
const MAX_SOURCE = 2000;

const text = (v, max = MAX_NAME) => (typeof v === 'string' ? v.slice(0, max) : '');

export function encodeReticleRecord(reticle) {
  if (!reticle || typeof reticle !== 'object' || reticle.deletedAt) return reticle;
  const { id, manufacturer, model, source, referenceScope, illumination, elements, ...rest } = reticle;
  for (const key of DOCUMENT_ONLY) delete rest[key];
  delete rest.name;
  const out = {
    id, name: opticLabel({ manufacturer, model }), manufacturer: text(manufacturer), model: text(model), source: text(source, MAX_SOURCE)
  };
  out.referenceScope = storedReferenceScope(referenceScope);
  const storedLight = storedIllumination(illumination);
  if (storedLight) out.illumination = storedLight;
  out.elements = elements.map(storedElement);
  return { ...out, ...rest };
}

export function decodeReticleRecord(stored) {
  if (!stored || typeof stored !== 'object') throw fail('invalid-format', 'record');
  if (stored.deletedAt) return stored;
  const { referenceScope, illumination, elements, ...rest } = stored;
  const manufacturer = text(stored.manufacturer);
  const model = text(stored.model);
  return {
    ...rest,
    name: opticLabel({ manufacturer, model }),
    manufacturer,
    model,
    source: text(stored.source, MAX_SOURCE),
    referenceScope: parseReferenceScope(referenceScope),
    illumination: parseIllumination(illumination),
    ...parseElements(elements, ELEMENT_FORMAT_VERSION)
  };
}
