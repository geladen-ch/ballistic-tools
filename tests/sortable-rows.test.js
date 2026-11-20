import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom, makeElement, fireEvent } from './helpers/fake-dom.js';

installFakeDom();
const { sortableRows, dropIndexFor } = await import('../src/ui/sortable-rows.js');

const ROW_H = 40;

// Rows stacked from y = 100 in one container, each ROW_H tall, with a
// layout the fake DOM otherwise lacks. `scroll(px)` moves the container
// (and its rows) up the viewport, as scrolling the page does.
function makeRows(n) {
  const container = makeElement('div');
  let offset = 0;
  container.getBoundingClientRect = () => ({ top: 100 - offset, height: n * ROW_H });
  const rows = Array.from({ length: n }, (_, i) => {
    const node = makeElement('div');
    node.getBoundingClientRect = () => ({ top: 100 - offset + i * ROW_H, height: ROW_H, bottom: 100 - offset + (i + 1) * ROW_H });
    container.appendChild(node);
    const handle = makeElement('button');
    handle.setPointerCapture = () => {};
    handle.releasePointerCapture = () => {};
    return { node, handle };
  });
  rows.scroll = (px) => { offset += px; };
  return rows;
}

function withWindow(fn) {
  const saved = global.window;
  global.window = { ...(saved || {}), scrollY: 0, innerHeight: 2000, scrollBy() {} };
  try { return fn(); } finally { global.window = saved; }
}

function pointer(handle, type, clientY, extra = {}) {
  fireEvent(handle, type, { pointerId: 1, pointerType: 'touch', button: 0, clientY, ...extra });
}

test('dropIndexFor: a row passes another once its centre crosses that row\'s centre', () => {
  const mids = [120, 160, 200, 240];
  assert.equal(dropIndexFor(120, mids, 0), 0);
  assert.equal(dropIndexFor(159, mids, 0), 0);
  assert.equal(dropIndexFor(161, mids, 0), 1);
  assert.equal(dropIndexFor(1000, mids, 0), 3);
  assert.equal(dropIndexFor(199, mids, 3), 2);
  assert.equal(dropIndexFor(-50, mids, 3), 0);
  assert.equal(dropIndexFor(200, mids, 2), 2);
});

test('a pointer drag down two rows calls onMove(from, to) once, on release', () => withWindow(() => {
  const rows = makeRows(4);
  const moves = [];
  sortableRows({ rows, onMove: (from, to) => moves.push([from, to]) });
  pointer(rows[0].handle, 'pointerdown', 120);
  pointer(rows[0].handle, 'pointermove', 150);
  pointer(rows[0].handle, 'pointermove', 205);
  assert.deepEqual(moves, []);
  assert.ok(rows[0].node.classList.contains('sortable-row--lifted'));
  assert.equal(rows[0].node.style.transform, 'translateY(85px)');
  assert.equal(rows[1].node.style.transform, `translateY(-${ROW_H}px)`);
  assert.equal(rows[2].node.style.transform, `translateY(-${ROW_H}px)`);
  assert.equal(rows[3].node.style.transform, '');
  pointer(rows[0].handle, 'pointerup', 205);
  assert.deepEqual(moves, [[0, 2]]);
  assert.ok(rows.every((r) => !r.node.classList.contains('sortable-row--lifted') && !r.node.classList.contains('sortable-row--shifting')));
  assert.ok(rows.every((r) => r.node.style.transform === ''));
}));

test('a pointer drag up shifts the rows in between down', () => withWindow(() => {
  const rows = makeRows(3);
  const moves = [];
  sortableRows({ rows, onMove: (from, to) => moves.push([from, to]) });
  pointer(rows[2].handle, 'pointerdown', 200);
  pointer(rows[2].handle, 'pointermove', 115);
  assert.equal(rows[0].node.style.transform, `translateY(${ROW_H}px)`);
  assert.equal(rows[1].node.style.transform, `translateY(${ROW_H}px)`);
  pointer(rows[2].handle, 'pointerup', 115);
  assert.deepEqual(moves, [[2, 0]]);
}));

test('dropping back where it started, or a cancelled drag, calls nothing', () => withWindow(() => {
  const rows = makeRows(3);
  const moves = [];
  sortableRows({ rows, onMove: (from, to) => moves.push([from, to]) });
  pointer(rows[1].handle, 'pointerdown', 160);
  pointer(rows[1].handle, 'pointermove', 170);
  pointer(rows[1].handle, 'pointerup', 170);
  pointer(rows[1].handle, 'pointerdown', 160);
  pointer(rows[1].handle, 'pointermove', 260);
  fireEvent(rows[1].handle, 'pointercancel', { pointerId: 1 });
  assert.deepEqual(moves, []);
  assert.ok(rows.every((r) => r.node.style.transform === ''));
}));

test('a page scroll during the drag counts towards the move (auto-scroll keeps the row under the finger)', () => withWindow(() => {
  const rows = makeRows(4);
  const moves = [];
  sortableRows({ rows, onMove: (from, to) => moves.push([from, to]) });
  pointer(rows[0].handle, 'pointerdown', 120);
  rows.scroll(90);
  pointer(rows[0].handle, 'pointermove', 125);
  pointer(rows[0].handle, 'pointerup', 125);
  assert.deepEqual(moves, [[0, 2]]);
}));

test('window.scrollY changing with nothing on screen moving (scroll anchoring) does not move the row', () => withWindow(() => {
  const rows = makeRows(3);
  const moves = [];
  sortableRows({ rows, onMove: (from, to) => moves.push([from, to]) });
  pointer(rows[0].handle, 'pointerdown', 120);
  window.scrollY = -30;
  pointer(rows[0].handle, 'pointermove', 205);
  pointer(rows[0].handle, 'pointerup', 205);
  assert.deepEqual(moves, [[0, 2]]);
}));

test('a mouse drag needs the primary button', () => withWindow(() => {
  const rows = makeRows(2);
  const moves = [];
  sortableRows({ rows, onMove: (from, to) => moves.push([from, to]) });
  pointer(rows[0].handle, 'pointerdown', 120, { pointerType: 'mouse', button: 2 });
  pointer(rows[0].handle, 'pointermove', 200, { pointerType: 'mouse' });
  pointer(rows[0].handle, 'pointerup', 200, { pointerType: 'mouse' });
  assert.deepEqual(moves, []);
}));

test('ArrowUp/ArrowDown on a handle move its row one place, never past either end', () => {
  const rows = makeRows(3);
  const moves = [];
  sortableRows({ rows, onMove: (from, to) => moves.push([from, to]) });
  fireEvent(rows[1].handle, 'keydown', { key: 'ArrowDown' });
  fireEvent(rows[1].handle, 'keydown', { key: 'ArrowUp' });
  fireEvent(rows[0].handle, 'keydown', { key: 'ArrowUp' });
  fireEvent(rows[2].handle, 'keydown', { key: 'ArrowDown' });
  fireEvent(rows[2].handle, 'keydown', { key: 'Enter' });
  assert.deepEqual(moves, [[1, 2], [1, 0]]);
});
