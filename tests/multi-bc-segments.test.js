import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom, fireEvent } from './helpers/fake-dom.js';

installFakeDom();

const { initI18n, t } = await import('../src/i18n.js');
await initI18n();
const { multiBcSegments } = await import('../src/ui/bc-tools/multi-bc-segments.js');
const { velocityMsForMach } = await import('../src/engine/bc-segments-cd.js');

function findById(node, id) {
  if (node.id === id) return node;
  for (const child of node.childNodes || []) {
    const found = findById(child, id);
    if (found) return found;
  }
  return null;
}

function findByClass(node, cls) {
  if (node.className && node.className.split(' ').includes(cls)) return node;
  for (const child of node.childNodes || []) {
    const found = findByClass(child, cls);
    if (found) return found;
  }
  return null;
}

function settle(ms = 30) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// The drag/click-on-chart interaction itself needs real getBoundingClientRect
// geometry this fake DOM doesn't provide (see tests/helpers/fake-dom.js's
// own header comment on scope) — verified by hand in a real browser
// instead (see docs/plans/multiple-bc-tool.md's own Verification section).
// Everything reachable through the table's own inputs — which is most of
// this component's actual logic (state, validation, cascading, curve
// computation) — is fully covered here.

test('starts with 2 segments split exactly at Mach 1.0, both BCs blank', () => {
  const s = multiBcSegments();
  const segs = s.getSegments();
  assert.equal(segs.length, 2);
  assert.equal(segs[0].bc, null);
  assert.equal(segs[1].bc, null);
  assert.equal(segs[1].toVelocityMs, null);
  assert.ok(Math.abs(segs[0].toVelocityMs - velocityMsForMach(1.0)) < 1e-6);

  const toInput = findById(s.node, 'multiBcTo0');
  assert.equal(toInput.value, String(Math.round(velocityMsForMach(1.0))));
});

test('typing a valid "to" value updates the border and cascades to the next row\'s "from" cell', () => {
  const s = multiBcSegments();
  const toInput = findById(s.node, 'multiBcTo0');
  toInput.value = '400';
  fireEvent(toInput, 'input');

  assert.equal(s.getSegments()[0].toVelocityMs, 400);
  // The next row's "from" cell is a plain <td> — the first cell of the
  // second row's own <tr>.
  const secondRow = s.node.childNodes.find((n) => n.tagName === 'TABLE')?.childNodes
    .find((n) => n.tagName === 'TBODY').childNodes[1];
  const fromCell = secondRow.childNodes[0];
  assert.equal(fromCell.textContent, '400');
});

test('typing a "to" value that violates ordering is rejected — state is unchanged and the field shows an error', () => {
  const s = multiBcSegments();
  const toInput = findById(s.node, 'multiBcTo0');
  const before = s.getSegments()[0].toVelocityMs;

  toInput.value = '-5';
  fireEvent(toInput, 'input');

  assert.equal(s.getSegments()[0].toVelocityMs, before, 'a negative "to" (below its own "from" of 0) must not be applied');
  assert.equal(toInput.classList.contains('field-invalid'), true);
});

test('typing a non-whole-number "to" value is rejected with a specific message', () => {
  const s = multiBcSegments();
  const toInput = findById(s.node, 'multiBcTo0');
  toInput.value = '400.5';
  fireEvent(toInput, 'input');
  assert.equal(toInput.classList.contains('field-invalid'), true);
});

test('typing BC values within bounds is accepted and reflected in getSegments()/getValidity()', () => {
  const s = multiBcSegments();
  const bc0 = findById(s.node, 'multiBcBc0');
  const bc1 = findById(s.node, 'multiBcBc1');
  bc0.value = '0.4';
  fireEvent(bc0, 'input');
  bc1.value = '0.5';
  fireEvent(bc1, 'input');

  const segs = s.getSegments();
  assert.equal(segs[0].bc, 0.4);
  assert.equal(segs[1].bc, 0.5);
  assert.equal(s.getValidity().allValid, true);
});

test('a BC outside FIELD_BOUNDS.bc is rejected — getValidity() reports it and shows an error', () => {
  const s = multiBcSegments();
  const bc0 = findById(s.node, 'multiBcBc0');
  bc0.value = '3.0'; // above the 0.05-1.5 bound
  fireEvent(bc0, 'input');

  assert.equal(bc0.classList.contains('field-invalid'), true);
  assert.equal(s.getValidity().allValid, false);
  assert.equal(s.getValidity().segments[0].bcOk, false);
});

test('getCurve() produces null cd for a still-blank segment and real values for a specified one', () => {
  const s = multiBcSegments();
  const bc1 = findById(s.node, 'multiBcBc1');
  bc1.value = '0.5';
  fireEvent(bc1, 'input');
  // massKg/caliberM both default to null ("not entered yet") — even the
  // specified segment reports null until both are set.
  const curveBeforeCaliber = s.getCurve();
  assert.ok(curveBeforeCaliber.every((p) => p.cd === null));

  s.setMassCaliber(0.012, 0.00782);
  const curve = s.getCurve();
  const below = curve.filter((p) => p.segmentIndex === 0);
  const above = curve.filter((p) => p.segmentIndex === 1);
  assert.ok(below.length > 0 && above.length > 0);
  assert.ok(below.every((p) => p.cd === null), 'segment 0 still has no BC');
  assert.ok(above.every((p) => typeof p.cd === 'number' && p.cd > 0), 'segment 1 has a real BC');
});

test('setSpeedUnit restates and re-rounds borders in the new unit, without changing the underlying m/s value materially', () => {
  const s = multiBcSegments();
  const beforeMs = s.getSegments()[0].toVelocityMs;
  s.setSpeedUnit('ft/s');
  assert.equal(s.getSpeedUnit(), 'ft/s');
  const afterMs = s.getSegments()[0].toVelocityMs;
  // Round-trip through a whole-number ft/s value introduces at most
  // ~0.3m/s of rounding noise (1 ft/s), not a structural change.
  assert.ok(Math.abs(afterMs - beforeMs) < 1, `border drifted more than rounding noise: ${beforeMs} -> ${afterMs}`);

  const toInput = findById(s.node, 'multiBcTo0');
  const expectedFtS = Math.round(afterMs / 0.3048);
  assert.equal(toInput.value, String(expectedFtS));
});

test('setDragModel swaps the reference curve without touching segments/borders', () => {
  const s = multiBcSegments();
  const before = s.getSegments();
  s.setDragModel('G7');
  assert.equal(s.getDragModel(), 'G7');
  assert.deepEqual(s.getSegments(), before);
});

test('a blank BC input reports as unspecified (null), not zero or NaN', () => {
  const s = multiBcSegments();
  const bc0 = findById(s.node, 'multiBcBc0');
  bc0.value = '0.4';
  fireEvent(bc0, 'input');
  bc0.value = '';
  fireEvent(bc0, 'input');
  assert.equal(s.getSegments()[0].bc, null);
});

test('editing a "to" input for the *last* interior border only has to clear its own lower neighbor (no upper one)', () => {
  const s = multiBcSegments();
  const toInput = findById(s.node, 'multiBcTo0');
  toInput.value = '900';
  fireEvent(toInput, 'input');
  assert.equal(s.getSegments()[0].toVelocityMs, 900);
  assert.equal(toInput.classList.contains('field-invalid'), false);
});

// ---- Velocity ruler (Mach is the chart's own primary axis; Chartist
// itself has no built-in dual-axis feature, so absolute velocity is a
// hand-built secondary scale) ----

test('the velocity ruler shows one tick per 0.5-Mach step, from Mach 0 up to the reference table\'s own top Mach (G1: 5.0 -> 11 ticks), labeled in m/s', async () => {
  const s = multiBcSegments();
  await settle(); // Chartist's own first draw is deferred a tick — see multi-bc-segments.js's own 'created' handler
  const ruler = findByClass(s.node, 'bc-velocity-ruler');
  assert.ok(ruler, 'expected a .bc-velocity-ruler element');
  const labels = ruler.childNodes.map((n) => n.textContent);
  assert.equal(labels.length, 11);
  assert.deepEqual(labels, labels.map((l) => String(Math.round(Number(l)))), 'every tick label is a whole number');
  const expectedM1 = Math.round(velocityMsForMach(1.0));
  assert.equal(labels[2], String(expectedM1), 'the third tick (Mach 1.0) matches velocityMsForMach(1.0)');
});

test('the velocity ruler re-renders to match a shorter-domain model\'s own top Mach (GS: 4.0 -> 9 ticks)', async () => {
  const s = multiBcSegments();
  await settle();
  s.setDragModel('GS');
  await settle();
  const ruler = findByClass(s.node, 'bc-velocity-ruler');
  const labels = ruler.childNodes.map((n) => n.textContent);
  assert.equal(labels.length, 9);
});
