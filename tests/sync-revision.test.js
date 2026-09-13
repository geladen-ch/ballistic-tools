import test from 'node:test';
import assert from 'node:assert/strict';

const { revisionOf, nextLocalRevision } = await import('../src/sync/revision.js');

test('revisionOf returns 0 for a record with no revision field at all', () => {
  assert.equal(revisionOf({ id: 'a' }), 0);
  assert.equal(revisionOf(null), 0);
  assert.equal(revisionOf(undefined), 0);
});

test('revisionOf returns the stored integer verbatim', () => {
  assert.equal(revisionOf({ id: 'a', revision: 5 }), 5);
  assert.equal(revisionOf({ id: 'a', revision: 0 }), 0);
});

test('revisionOf falls back to 0 for a non-numeric or non-finite revision (a hand-edited or corrupt file)', () => {
  assert.equal(revisionOf({ id: 'a', revision: 'five' }), 0);
  assert.equal(revisionOf({ id: 'a', revision: NaN }), 0);
  assert.equal(revisionOf({ id: 'a', revision: Infinity }), 0);
});

test('nextLocalRevision is one more than whatever was previously stored', () => {
  assert.equal(nextLocalRevision(null), 1); // brand new record
  assert.equal(nextLocalRevision({ revision: 0 }), 1);
  assert.equal(nextLocalRevision({ revision: 4 }), 5);
});

// The load-bearing property this module exists for: nextLocalRevision
// takes only `previousStored`, never anything about the value being
// written over it — see revision.js's own comment for why. This is what
// makes a Phase 9 revert or a review-resolution's "Keep mine" correctly
// dominate whatever it's replacing without any special-casing at the
// call site: the value being written (an old snapshot, a rejected local
// copy) is irrelevant to the computation, only what's currently stored
// locally matters.
test('nextLocalRevision ignores whatever revision the incoming value happens to carry', () => {
  const previouslyStored = { revision: 10 };
  // An old snapshot from history claiming a much lower revision — must
  // not pull the result down to anywhere near its own value.
  assert.equal(nextLocalRevision(previouslyStored), 11);
});
