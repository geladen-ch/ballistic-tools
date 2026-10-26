import test from 'node:test';
import assert from 'node:assert/strict';
import { createHistory, commit, undo, redo, canUndo, canRedo, breakCoalescing, HISTORY_LIMIT } from '../src/reticle/history.js';

test('undo and redo walk the snapshots; a new commit drops the redo branch', () => {
  let h = createHistory('a');
  h = commit(h, 'b');
  h = commit(h, 'c');
  h = undo(h);
  assert.equal(h.present, 'b');
  assert.ok(canRedo(h));
  h = redo(h);
  assert.equal(h.present, 'c');
  h = undo(undo(h));
  assert.equal(h.present, 'a');
  assert.ok(!canUndo(h));
  h = commit(h, 'x');
  assert.ok(!canRedo(h));
  assert.deepEqual(h.past, ['a']);
});

test('committing the same snapshot is a no-op', () => {
  const h = commit(createHistory('a'), 'b');
  assert.equal(commit(h, h.present), h);
});

test('keeps at least 1000 undo steps, dropping only the oldest beyond that', () => {
  assert.ok(HISTORY_LIMIT >= 1000);
  let h = createHistory(0);
  for (let i = 1; i <= HISTORY_LIMIT + 50; i++) h = commit(h, i);
  assert.equal(h.past.length, HISTORY_LIMIT);
  let steps = 0;
  while (canUndo(h)) { h = undo(h); steps++; }
  assert.equal(steps, HISTORY_LIMIT);
  assert.equal(h.present, 50);
});

test('commits with the same coalesce key form one step until broken', () => {
  let h = createHistory('a');
  h = commit(h, 'drag1', { coalesceKey: 'drag:1' });
  h = commit(h, 'drag2', { coalesceKey: 'drag:1' });
  h = commit(h, 'drag3', { coalesceKey: 'drag:1' });
  assert.deepEqual(h.past, ['a']);
  assert.equal(h.present, 'drag3');
  h = breakCoalescing(h);
  h = commit(h, 'drag4', { coalesceKey: 'drag:1' });
  assert.deepEqual(h.past, ['a', 'drag3']);
  assert.equal(undo(h).present, 'drag3');
  // Undo ends a run too.
  h = commit(undo(h), 'again', { coalesceKey: 'drag:1' });
  assert.deepEqual(h.past, ['a', 'drag3']);
});
