// The reticle document and every edit to it, as pure functions returning a
// new document — the shape history.js snapshots. No DOM.
//
// document = { manufacturer, model, referenceScope, illumination, elements: [record...], groups: [{ id }], nextId }
// `referenceScope` = the scope the reticle is drawn for (see scope.js).
// A reticle record (reticle-record.js) is a document plus the record's
// own id and bookkeeping.
// `illumination` = { enabled, colour }: whether the reticle is illuminated
// and in which colour; each element then says whether it is lit.
// Element ids are 'e<n>', group ids 'g<n>', both drawn from nextId.
// Groups are flat: an element belongs to at most one group (its groupId),
// and a group always has at least two members — one left with fewer is
// dissolved.
//
// Two rules keep thinning bars pointing outwards, so the thin end (the
// start, where the taper begins) faces the centre:
//  - End-point rule: the end is never closer to zero than the start along
//    the bar's axis (|end| >= |start|). Dragging or typing either end is
//    clamped to it.
//  - Moving a whole bar along its axis stops when the start reaches zero,
//    and also wherever the end-point rule would otherwise break (only
//    possible for a bar lying across zero, moved towards its start's
//    side). Movement across the axis is free.
// A plain line looks the same from either end, so neither rule applies to
// it: both ends move freely, and so does the whole line (a newly drawn one
// still gets the end nearer zero as its start).
import { defaultReferenceScope } from './scope.js';
import { axisOf, endKeyOf, startOnAxis, endOnAxis, staysOnVerticalAxis, followsEndPointRule } from './element-types.js';
import { translateRecord } from './geometry.js';

export const ILLUMINATION_COLOURS = ['red', 'amber', 'green'];
export const DEFAULT_ILLUMINATION = Object.freeze({ enabled: false, colour: 'red' });

export function createDocument({ referenceScope = defaultReferenceScope(), manufacturer = '', model = '' } = {}) {
  return { manufacturer, model, referenceScope, illumination: { ...DEFAULT_ILLUMINATION }, elements: [], groups: [], nextId: 1 };
}

// Switches illumination on or off, or picks its colour. Elements keep
// their own `illuminated` flags either way.
export function setIllumination(doc, patch) {
  const next = { ...DEFAULT_ILLUMINATION, ...doc.illumination, ...patch };
  if (next.enabled === doc.illumination?.enabled && next.colour === doc.illumination?.colour) return doc;
  return { ...doc, illumination: next };
}

// Whether an element is drawn lit: the reticle is illuminated and so is it.
export function isLit(doc, element) {
  return Boolean(doc.illumination?.enabled && element.illuminated);
}

export function findElement(doc, id) {
  return doc.elements.find((e) => e.id === id) || null;
}

export function findGroup(doc, id) {
  return doc.groups.find((g) => g.id === id) || null;
}

export function groupMembers(doc, groupId) {
  return doc.elements.filter((e) => e.groupId === groupId);
}

// Selection entries (element or group ids) → the element ids they cover,
// in document order, without duplicates.
export function resolveElementIds(doc, ids) {
  const wanted = new Set(ids);
  return doc.elements.filter((e) => wanted.has(e.id) || (e.groupId && wanted.has(e.groupId))).map((e) => e.id);
}

function replaceElements(doc, byId) {
  return { ...doc, elements: doc.elements.map((e) => byId.get(e.id) || e) };
}

export function addElement(doc, element) {
  const id = `e${doc.nextId}`;
  return { doc: { ...doc, elements: [...doc.elements, { ...element, id }], nextId: doc.nextId + 1 }, id };
}

// Settings changes (dimensions, mirror, repeat). `repeat` merges into the
// existing repeat settings rather than replacing them. Positions go
// through moveEndpoint/translate instead, which apply the rules above.
export function updateElement(doc, id, patch) {
  const element = findElement(doc, id);
  if (!element) return doc;
  const next = { ...element, ...patch, id };
  if (patch.repeat) next.repeat = { ...element.repeat, ...patch.repeat };
  return replaceElements(doc, new Map([[id, next]]));
}

// Settings changes to several elements in one go: `patchById` maps an id
// to its patch (repeat merged as in updateElement).
export function updateElements(doc, patchById) {
  const next = new Map();
  for (const element of doc.elements) {
    const patch = patchById.get(element.id);
    if (!patch) continue;
    const updated = { ...element, ...patch, id: element.id };
    if (patch.repeat) updated.repeat = { ...element.repeat, ...patch.repeat };
    next.set(element.id, updated);
  }
  return next.size ? replaceElements(doc, next) : doc;
}

const signOr = (v, fallback) => (v > 0 ? 1 : v < 0 ? -1 : fallback);

// End-point rule, end side: an end inside the start's distance from zero
// stops at that distance, on the side it was moved to (the side it was
// on before, when moved exactly onto zero). An end coming from across
// zero stays across, rather than landing on the start and leaving a bar
// of no length.
export function clampEnd(start, end, previousEnd = end) {
  if (Math.abs(end) >= Math.abs(start)) return end;
  const startSide = signOr(start, 0);
  const previousSide = signOr(previousEnd, 1);
  let side = signOr(end, previousSide);
  if (startSide !== 0 && side === startSide && previousSide === -startSide) side = previousSide;
  return side * Math.abs(start);
}

// End-point rule, start side: the start may not move further from zero
// than the end.
export function clampStart(start, end) {
  if (Math.abs(start) <= Math.abs(end)) return start;
  return signOr(start, 1) * Math.abs(end);
}

// Moves one end of a line or thinning bar. `which` is 'start' (point
// {x, y}: the perpendicular coordinate is the element's own and moves
// freely) or 'end' (point: only the axis coordinate is used). A bar's
// ends are clamped by the end-point rule; a line's go where they're put.
export function moveEndpoint(doc, id, which, point) {
  const element = findElement(doc, id);
  const axis = element && axisOf(element);
  if (!axis) return doc;
  const ruled = followsEndPointRule(element);
  const endKey = endKeyOf(element);
  const end = element[endKey];
  const next = { ...element };
  if (which === 'end') {
    next[endKey] = ruled ? clampEnd(startOnAxis(element), point[axis], end) : point[axis];
  } else {
    const across = axis === 'x' ? 'y' : 'x';
    next[axis] = ruled ? clampStart(point[axis], end) : point[axis];
    next[across] = point[across];
  }
  return replaceElements(doc, new Map([[id, next]]));
}

// Sets both ends of a line or bar from two points along its axis, in
// whichever order satisfies the end-point rule: the one nearer zero
// becomes the start. Used while a new segment is being drawn, so drawing
// it inwards gives the same segment as drawing it outwards.
export function spanSegment(doc, id, alongA, alongB) {
  const element = findElement(doc, id);
  const axis = element && axisOf(element);
  if (!axis) return doc;
  const [near, far] = Math.abs(alongB) >= Math.abs(alongA) ? [alongA, alongB] : [alongB, alongA];
  // Ordered this way the pair always satisfies the rule, so both ends are
  // set together rather than clamped one at a time against the old ones.
  return replaceElements(doc, new Map([[id, { ...element, [axis]: near, [endKeyOf(element)]: far }]]));
}

// The range [lo, hi] of offsets along its own axis that a thinning bar can
// be moved by under the two rules, always containing 0 so a record
// already outside the rules (an old file, say) can stay where it is.
// Unlimited for everything else, lines included.
export function axisMoveLimits(element) {
  if (!axisOf(element) || !followsEndPointRule(element)) return [-Infinity, Infinity];
  const s = startOnAxis(element);
  const e = endOnAxis(element);
  let lo = -Infinity;
  let hi = Infinity;
  // The start stays on its side of zero; a start exactly at zero belongs
  // to the end's side.
  const side = signOr(s, signOr(e, 0));
  if (side > 0) lo = Math.max(lo, -s);
  else if (side < 0) hi = Math.min(hi, -s);
  // |e + d| >= |s + d|  <=>  (e - s)(e + s + 2d) >= 0
  if (e > s) lo = Math.max(lo, -(e + s) / 2);
  else if (e < s) hi = Math.min(hi, -(e + s) / 2);
  return [Math.min(lo, 0), Math.max(hi, 0)];
}

// `+ 0` turns a -0 into 0, so 'no movement' reads the same either way.
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v)) + 0;

// The offset actually allowed for moving these elements together by
// (dx, dy): each axis is limited by the tightest member moving along it,
// and there is no sideways move when none of them can move sideways (BDC
// marks only).
export function allowedOffset(doc, ids, dx, dy) {
  const wanted = new Set(ids);
  let xLo = -Infinity, xHi = Infinity, yLo = -Infinity, yHi = Infinity;
  let sideways = false;
  for (const element of doc.elements) {
    if (!wanted.has(element.id)) continue;
    if (!staysOnVerticalAxis(element.type)) sideways = true;
    const axis = axisOf(element);
    if (!axis) continue;
    const [lo, hi] = axisMoveLimits(element);
    if (axis === 'x') { xLo = Math.max(xLo, lo); xHi = Math.min(xHi, hi); } else { yLo = Math.max(yLo, lo); yHi = Math.min(yHi, hi); }
  }
  return { dx: sideways ? clamp(dx, xLo, xHi) : 0, dy: clamp(dy, yLo, yHi) };
}

// Moves elements (by id) together, as far as the rules allow. Returns the
// new document and the offset actually applied.
export function translate(doc, ids, dx, dy) {
  const applied = allowedOffset(doc, ids, dx, dy);
  if (applied.dx === 0 && applied.dy === 0) return { doc, ...applied };
  const wanted = new Set(ids);
  const moved = new Map();
  for (const element of doc.elements) {
    if (wanted.has(element.id)) moved.set(element.id, translateRecord(element, applied.dx, applied.dy));
  }
  return { doc: replaceElements(doc, moved), ...applied };
}

// The position of several elements together (a group, a multi-selection):
// the centroid of their positions. Its x leaves out BDC marks, which don't
// move sideways, so setting it moves the centroid exactly there; 0 when
// they are all BDC marks.
export function centroidOf(doc, ids) {
  const wanted = new Set(ids);
  const members = doc.elements.filter((e) => wanted.has(e.id));
  if (members.length === 0) return { x: 0, y: 0 };
  const sideways = members.filter((e) => !staysOnVerticalAxis(e.type));
  return {
    x: sideways.length ? sideways.reduce((sum, e) => sum + e.x, 0) / sideways.length : 0,
    y: members.reduce((sum, e) => sum + e.y, 0) / members.length
  };
}

// Moves them so their centroid lands at (x, y), within the move rules.
export function setCentroid(doc, ids, x, y) {
  const at = centroidOf(doc, ids);
  return translate(doc, ids, x - at.x, y - at.y).doc;
}

export function groupPosition(doc, groupId) {
  return centroidOf(doc, groupMembers(doc, groupId).map((e) => e.id));
}

export function setGroupPosition(doc, groupId, x, y) {
  return setCentroid(doc, groupMembers(doc, groupId).map((e) => e.id), x, y);
}

// Drops groups left with fewer than two members, ungrouping the one left.
function pruneGroups(doc) {
  const counts = new Map();
  for (const e of doc.elements) if (e.groupId) counts.set(e.groupId, (counts.get(e.groupId) || 0) + 1);
  const keep = doc.groups.filter((g) => (counts.get(g.id) || 0) >= 2);
  if (keep.length === doc.groups.length) return doc;
  const kept = new Set(keep.map((g) => g.id));
  return {
    ...doc,
    groups: keep,
    elements: doc.elements.map((e) => (e.groupId && !kept.has(e.groupId) ? { ...e, groupId: null } : e))
  };
}

export function deleteElements(doc, ids) {
  const gone = new Set(ids);
  return pruneGroups({ ...doc, elements: doc.elements.filter((e) => !gone.has(e.id)) });
}

// Groups the given elements (by id) into one new group, absorbing any
// group they already belonged to whole. Needs two or more elements.
export function groupElements(doc, ids) {
  const wanted = new Set(ids);
  const absorbed = new Set(doc.elements.filter((e) => wanted.has(e.id) && e.groupId).map((e) => e.groupId));
  const members = new Set(resolveElementIds(doc, [...ids, ...absorbed]));
  if (members.size < 2) return { doc, groupId: null };
  const groupId = `g${doc.nextId}`;
  const next = {
    ...doc,
    nextId: doc.nextId + 1,
    groups: [...doc.groups.filter((g) => !absorbed.has(g.id)), { id: groupId }],
    elements: doc.elements.map((e) => (members.has(e.id) ? { ...e, groupId } : e))
  };
  return { doc: next, groupId };
}

export function ungroup(doc, groupId) {
  if (!findGroup(doc, groupId)) return { doc, ids: [] };
  const ids = groupMembers(doc, groupId).map((e) => e.id);
  return {
    doc: {
      ...doc,
      groups: doc.groups.filter((g) => g.id !== groupId),
      elements: doc.elements.map((e) => (e.groupId === groupId ? { ...e, groupId: null } : e))
    },
    ids
  };
}

// Copies of the given elements, appended and offset by (dx, dy) within the
// move rules; copies of a whole group form a new group of their own.
// Returns the new document and the selection entries for the copies.
export function duplicateElements(doc, ids, dx, dy) {
  const wanted = new Set(ids);
  const sources = doc.elements.filter((e) => wanted.has(e.id));
  if (sources.length === 0) return { doc, selection: [] };
  let nextId = doc.nextId;
  const groupMap = new Map();
  for (const e of sources) {
    if (e.groupId && !groupMap.has(e.groupId)) {
      const wholeGroup = groupMembers(doc, e.groupId).every((m) => wanted.has(m.id));
      groupMap.set(e.groupId, wholeGroup ? `g${nextId++}` : null);
    }
  }
  const copies = sources.map((e) => ({ ...e, id: `e${nextId++}`, groupId: e.groupId ? groupMap.get(e.groupId) : null }));
  const newGroups = [...new Set(groupMap.values())].filter(Boolean).map((id) => ({ id }));
  let next = { ...doc, nextId, elements: [...doc.elements, ...copies], groups: [...doc.groups, ...newGroups] };
  next = pruneGroups(next);
  const copyIds = copies.map((c) => c.id);
  next = translate(next, copyIds, dx, dy).doc;
  const selection = [];
  for (const c of copies) {
    const entry = c.groupId && findGroup(next, c.groupId) ? c.groupId : c.id;
    if (!selection.includes(entry)) selection.push(entry);
  }
  return { doc: next, selection };
}

// Adds a copy of another reticle's elements (a library reticle, `source`
// = { manufacturer, model, illumination, elements }), where they are and
// as they are: angles are copied unchanged whatever scope the source was
// drawn for, each element keeps its lit flag, and the source's groups come
// along as new groups of their own. An unlit reticle takes the source's
// illumination when that is on, and one with neither manufacturer nor
// model takes the source's. Returns the new document and the selection
// entries for the copies (their groups, and the elements in none).
export function insertReticle(doc, source) {
  const elements = source?.elements || [];
  if (elements.length === 0) return { doc, selection: [] };
  let nextId = doc.nextId;
  const groupMap = new Map();
  for (const e of elements) {
    if (e.groupId && !groupMap.has(e.groupId)) groupMap.set(e.groupId, `g${nextId++}`);
  }
  const copies = elements.map((e) => ({ ...e, id: `e${nextId++}`, groupId: e.groupId ? groupMap.get(e.groupId) : null }));
  let next = pruneGroups({
    ...doc,
    nextId,
    elements: [...doc.elements, ...copies],
    groups: [...doc.groups, ...[...groupMap.values()].map((id) => ({ id }))]
  });
  if (!doc.illumination?.enabled && source.illumination?.enabled) {
    next = setIllumination(next, { enabled: true, colour: source.illumination.colour });
  }
  if (!doc.manufacturer.trim() && !doc.model.trim()) {
    next = { ...next, manufacturer: source.manufacturer || '', model: source.model || '' };
  }
  const selection = [];
  for (const c of copies) {
    const entry = c.groupId && findGroup(next, c.groupId) ? c.groupId : c.id;
    if (!selection.includes(entry)) selection.push(entry);
  }
  return { doc: next, selection };
}

export function updateReferenceScope(doc, patch) {
  return { ...doc, referenceScope: { ...doc.referenceScope, ...patch } };
}

// The manufacturer and/or model: { manufacturer?, model? }.
export function setIdentity(doc, patch) {
  const next = { ...doc, ...patch };
  return next.manufacturer === doc.manufacturer && next.model === doc.model ? doc : next;
}

const DOCUMENT_KEYS = ['manufacturer', 'model', 'referenceScope', 'illumination', 'elements', 'groups', 'nextId'];

// The document part of a reticle record.
export function documentOf(reticle) {
  const doc = {};
  for (const key of DOCUMENT_KEYS) doc[key] = reticle[key];
  return doc;
}
