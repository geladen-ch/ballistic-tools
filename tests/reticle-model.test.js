import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from '../src/reticle/element-types.js';
import {
  createDocument, addElement, updateElement, moveEndpoint, spanSegment, clampEnd, clampStart, axisMoveLimits, translate,
  groupElements, ungroup, groupPosition, setGroupPosition, deleteElements, duplicateElements, findElement, resolveElementIds,
  insertReticle, setIllumination, setIdentity
} from '../src/reticle/model.js';

function hline(x, endX, y = 0) {
  return createElement('hline', { x, y, end: endX, units: 'mrad' });
}
function vline(y, endY, x = 0) {
  return createElement('vline', { x, y, end: endY, units: 'mrad' });
}
function hbar(x, endX, y = 0) {
  return createElement('hbar', { x, y, end: endX, units: 'mrad' });
}
function vbar(y, endY, x = 0) {
  return createElement('vbar', { x, y, end: endY, units: 'mrad' });
}
function withElements(...elements) {
  let doc = createDocument();
  const ids = [];
  for (const e of elements) {
    const r = addElement(doc, e);
    doc = r.doc;
    ids.push(r.id);
  }
  return { doc, ids };
}

test('clampEnd keeps the end no closer to zero than the start, on the side it was moved to', () => {
  assert.equal(clampEnd(2, 5), 5);
  assert.equal(clampEnd(2, 1), 2);
  assert.equal(clampEnd(2, -1), -2);
  assert.equal(clampEnd(-3, 10), 10, 'an end across zero, far enough out, is fine');
  assert.equal(clampEnd(-3, 1), 3);
  assert.equal(clampEnd(2, 0, 5), 2, 'onto zero: stays on its previous side');
  assert.equal(clampEnd(2, 0, -5), -2);
});

test('clampStart keeps the start no further from zero than the end', () => {
  assert.equal(clampStart(1, 5), 1);
  assert.equal(clampStart(7, 5), 5);
  assert.equal(clampStart(-7, 5), -5);
  assert.equal(clampStart(-4, 5), -4);
});

test('moveEndpoint applies the end-point rule to both ends of a bar; the start moves freely across the axis', () => {
  const { doc, ids: [id] } = withElements(hbar(2, 5, 1));
  const endIn = moveEndpoint(doc, id, 'end', { x: 1, y: 99 });
  assert.equal(findElement(endIn, id).endX, 2);
  assert.equal(findElement(endIn, id).y, 1, 'the end of a horizontal bar has no y of its own');
  const startOut = moveEndpoint(doc, id, 'start', { x: 6, y: -3 });
  assert.equal(findElement(startOut, id).x, 5);
  assert.equal(findElement(startOut, id).y, -3);
  const crossing = moveEndpoint(doc, id, 'end', { x: -8, y: 0 });
  assert.equal(findElement(crossing, id).endX, -8);
});

test('a line\'s ends are free: either one goes anywhere, across zero or past the other', () => {
  const { doc, ids: [id] } = withElements(hline(2, 5, 1));
  assert.equal(findElement(moveEndpoint(doc, id, 'end', { x: 1, y: 0 }), id).endX, 1);
  assert.equal(findElement(moveEndpoint(doc, id, 'end', { x: -0.5, y: 0 }), id).endX, -0.5);
  const start = findElement(moveEndpoint(doc, id, 'start', { x: 9, y: -3 }), id);
  assert.deepEqual([start.x, start.endX, start.y], [9, 5, -3]);
});

test('a bar\'s end coming from across zero stays across rather than collapsing onto the start', () => {
  assert.equal(clampEnd(-2, -1, 5), 2, 'from +5 into the start\'s side: held at +2');
  assert.equal(clampEnd(-2, -1, -5), -2, 'from the start\'s own side: stops at the start');
  const { doc, ids: [id] } = withElements(hbar(-2, 5));
  assert.equal(findElement(moveEndpoint(doc, id, 'end', { x: -1, y: 0 }), id).endX, 2);
});

test('spanSegment puts the point nearer zero at the start, whichever order it is given', () => {
  const { doc, ids: [id] } = withElements(hline(7, 7, 1));
  for (const [a, b] of [[2, 6], [6, 2], [-6, 2], [2, -6]]) {
    const e = findElement(spanSegment(doc, id, a, b), id);
    const [near, far] = Math.abs(b) >= Math.abs(a) ? [a, b] : [b, a];
    assert.deepEqual([e.x, e.endX, e.y], [near, far, 1], `${a} → ${b}`);
  }
});

test('vertical bars follow the same rules', () => {
  const bar = createElement('vbar', { x: 0, y: 3, end: 10, units: 'mrad' });
  const { doc, ids: [id] } = withElements(bar);
  assert.equal(findElement(moveEndpoint(doc, id, 'end', { x: 0, y: -1 }), id).endY, -3);
});

test('a whole-bar move stops when the start reaches zero', () => {
  const { doc, ids: [id] } = withElements(hbar(2, 5));
  assert.deepEqual(axisMoveLimits(findElement(doc, id)), [-2, Infinity]);
  const moved = translate(doc, [id], -4, 0);
  assert.equal(moved.dx, -2);
  assert.equal(findElement(moved.doc, id).x, 0);
  assert.equal(findElement(moved.doc, id).endX, 3);
  // Once at zero it belongs to the end's side and can't cross.
  assert.equal(translate(moved.doc, [id], -1, 0).dx, 0);
  assert.equal(translate(moved.doc, [id], 1, 0).dx, 1);
});

test('a bar across zero: towards its end the start stops at zero, towards its start it is held by the end-point rule', () => {
  const { doc, ids: [id] } = withElements(hbar(-10, 10));
  const right = translate(doc, [id], 15, 0);
  assert.equal(right.dx, 10);
  assert.equal(findElement(right.doc, id).x, 0);
  assert.equal(findElement(right.doc, id).endX, 20);
  assert.equal(translate(doc, [id], -1, 0).dx, 0, 'a symmetric bar cannot move towards its start');
  const { doc: d2, ids: [id2] } = withElements(hbar(-2, 6));
  assert.equal(translate(d2, [id2], -5, 0).dx, -2, 'stops where |start| = |end|');
});

test('lines move freely along their axis, across zero included', () => {
  const { doc, ids: [id] } = withElements(hline(-10, 10), vline(2, 5));
  assert.deepEqual(axisMoveLimits(findElement(doc, id)), [-Infinity, Infinity]);
  const moved = translate(doc, [id], -7, 0);
  assert.equal(moved.dx, -7);
  assert.deepEqual([findElement(moved.doc, id).x, findElement(moved.doc, id).endX], [-17, 3]);
});

test('movement across the axis is free', () => {
  const { doc, ids: [id] } = withElements(hbar(2, 5));
  const moved = translate(doc, [id], 0, -42);
  assert.equal(moved.dy, -42);
  assert.equal(findElement(moved.doc, id).y, -42);
});

test('a group stops when its tightest bar reaches its limit; lines don\'t hold it', () => {
  const dot = createElement('dot', { x: 0, y: 0, units: 'mrad' });
  const { doc, ids } = withElements(hbar(3, 8), hbar(1, 4), vbar(2, 6), dot, hline(0.5, 4), vline(0.5, 4));
  const moved = translate(doc, ids, -5, -5);
  assert.equal(moved.dx, -1, 'held by the bar starting at 1');
  assert.equal(moved.dy, -2, 'held by the vertical bar starting at 2');
  assert.equal(findElement(moved.doc, ids[0]).x, 2);
  assert.equal(findElement(moved.doc, ids[3]).x, -1);
});

test('updateElement merges repeat settings rather than replacing them', () => {
  const { doc, ids: [id] } = withElements(hline(0, 5));
  const next = updateElement(doc, id, { repeat: { enabled: true } });
  assert.equal(findElement(next, id).repeat.enabled, true);
  assert.equal(findElement(next, id).repeat.count, findElement(doc, id).repeat.count);
});

test('grouping, group position and ungrouping', () => {
  const { doc, ids } = withElements(
    createElement('dot', { x: 1, y: 1, units: 'mrad' }),
    createElement('dot', { x: 3, y: 5, units: 'mrad' }),
    createElement('dot', { x: 9, y: 9, units: 'mrad' })
  );
  const { doc: grouped, groupId } = groupElements(doc, ids.slice(0, 2));
  assert.ok(groupId);
  assert.deepEqual(groupPosition(grouped, groupId), { x: 2, y: 3 });
  assert.deepEqual(resolveElementIds(grouped, [groupId]), ids.slice(0, 2));
  const moved = setGroupPosition(grouped, groupId, 4, 3);
  assert.equal(findElement(moved, ids[0]).x, 3);
  assert.equal(findElement(moved, ids[1]).x, 5);
  // Grouping a member with an outsider absorbs the whole old group.
  const { doc: regrouped, groupId: g2 } = groupElements(grouped, [ids[0], ids[2]]);
  assert.equal(regrouped.groups.length, 1);
  assert.deepEqual(resolveElementIds(regrouped, [g2]), ids);
  const { doc: flat } = ungroup(regrouped, g2);
  assert.equal(flat.groups.length, 0);
  assert.ok(flat.elements.every((e) => e.groupId === null));
  assert.equal(groupElements(doc, [ids[0]]).groupId, null, 'one element is not a group');
});

test('deleting down to one member dissolves the group', () => {
  const { doc, ids } = withElements(hline(0, 1), hline(0, 2));
  const { doc: grouped } = groupElements(doc, ids);
  const after = deleteElements(grouped, [ids[0]]);
  assert.equal(after.groups.length, 0);
  assert.equal(findElement(after, ids[1]).groupId, null);
});

test('duplicating a whole group makes a new group of the copies, offset within the rules', () => {
  const { doc, ids } = withElements(hline(1, 2), hline(3, 4));
  const { doc: grouped, groupId } = groupElements(doc, ids);
  const { doc: dup, selection } = duplicateElements(grouped, ids, 1, 1);
  assert.equal(dup.elements.length, 4);
  assert.equal(dup.groups.length, 2);
  assert.equal(selection.length, 1);
  assert.notEqual(selection[0], groupId);
  const copies = resolveElementIds(dup, selection).map((id) => findElement(dup, id));
  assert.deepEqual(copies.map((c) => c.x), [2, 4]);
});

// ---- BDC marks ----

test('a BDC mark stays on the vertical axis: alone it moves only up and down, in a group it takes the vertical part', () => {
  const bdc = createElement('bdc', { x: 0.002, y: 0.003, units: 'mrad' });
  assert.equal(bdc.x, 0, 'created on the axis');
  const { doc, ids } = withElements(bdc, createElement('dot', { x: 0.001, y: 0, units: 'mrad' }));
  const alone = translate(doc, [ids[0]], 0.004, 0.001);
  assert.equal(alone.dx, 0, 'no sideways move for BDC marks alone');
  assert.equal(findElement(alone.doc, ids[0]).x, 0);
  assert.ok(Math.abs(findElement(alone.doc, ids[0]).y - 0.004) < 1e-12);

  const grouped = groupElements(doc, ids);
  const moved = translate(grouped.doc, ids, 0.002, 0.001).doc;
  assert.equal(findElement(moved, ids[0]).x, 0);
  assert.ok(Math.abs(findElement(moved, ids[1]).x - 0.003) < 1e-12);
  // The group's x is its sideways-moving members' only, so setting it lands exactly.
  assert.ok(Math.abs(groupPosition(grouped.doc, grouped.groupId).x - 0.001) < 1e-12);
  const placed = setGroupPosition(grouped.doc, grouped.groupId, 0.005, 0.002);
  assert.ok(Math.abs(groupPosition(placed, grouped.groupId).x - 0.005) < 1e-12);
  assert.ok(Math.abs(groupPosition(placed, grouped.groupId).y - 0.002) < 1e-12);
  assert.equal(findElement(placed, ids[0]).x, 0);

  const copies = duplicateElements(doc, [ids[0]], 0.001, 0.001);
  assert.equal(copies.doc.elements.at(-1).x, 0, 'a copy stays on the axis too');
});

test('a BDC mark can be neither mirrored nor repeated', async () => {
  const { validateElement } = await import('../src/reticle/element-types.js');
  const bdc = createElement('bdc', { x: 0, y: 0.003, units: 'mrad' });
  assert.deepEqual(validateElement(bdc), {});
  assert.equal(validateElement({ ...bdc, mirror: true }).mirror, 'notMirrorable');
  assert.equal(validateElement({ ...bdc, repeat: { enabled: true, direction: 'down', count: 2, step: 0.001 } }).repeat, 'notRepeatable');
  assert.equal(validateElement({ ...bdc, x: 0.001 }).x, 'onVerticalAxis');
});

test('insertReticle copies a reticle\'s elements where they are, with fresh ids and its own groups as new ones', () => {
  const { doc: target } = withElements(hline(1, 3), vline(1, 3));
  const grouped = groupElements(withElements(hline(2, 5, 1), vline(2, 5, 1), vbar(1, 4, 2)).doc, ['e1', 'e2']).doc;
  const source = { ...grouped, manufacturer: 'Maker', model: 'R1' };
  const { doc, selection } = insertReticle(target, source);
  assert.equal(doc.elements.length, 5);
  const ids = doc.elements.map((e) => e.id);
  assert.equal(new Set(ids).size, 5, 'ids stay unique');
  const copies = doc.elements.slice(2);
  assert.deepEqual(copies.map(({ id, groupId, ...rest }) => rest), source.elements.map(({ id, groupId, ...rest }) => rest), 'geometry unchanged');
  const groupId = copies[0].groupId;
  assert.ok(groupId && groupId !== source.groups[0].id && copies[1].groupId === groupId && copies[2].groupId === null);
  assert.deepEqual(doc.groups.map((g) => g.id), [groupId]);
  assert.deepEqual(selection, [groupId, copies[2].id]);
  assert.deepEqual([doc.manufacturer, doc.model], ['Maker', 'R1'], 'a target with no identity takes the source\'s');
});

test('insertReticle adopts the source\'s illumination and identity only where the target has none', () => {
  const lit = { ...hline(1, 3), illuminated: true };
  const source = { ...withElements(lit).doc, manufacturer: 'Maker', model: 'R1', illumination: { enabled: true, colour: 'green' } };
  const fresh = insertReticle(createDocument(), source).doc;
  assert.deepEqual(fresh.illumination, { enabled: true, colour: 'green' });
  assert.deepEqual([fresh.manufacturer, fresh.model], ['Maker', 'R1']);
  assert.equal(fresh.elements[0].illuminated, true);
  const own = setIdentity(setIllumination(createDocument(), { enabled: true, colour: 'amber' }), { model: 'Mine' });
  const kept = insertReticle(own, source).doc;
  assert.deepEqual(kept.illumination, { enabled: true, colour: 'amber' });
  assert.deepEqual([kept.manufacturer, kept.model], ['', 'Mine']);
  const empty = createDocument();
  assert.equal(insertReticle(empty, { ...source, elements: [] }).doc, empty);
});
