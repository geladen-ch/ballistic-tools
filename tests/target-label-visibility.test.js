import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from './helpers/fake-dom.js';

installFakeDom();
// fake-dom.js's own requestAnimationFrame shim runs its callback
// synchronously — real browsers instead assign the outer `rafId` (from
// requestAnimationFrame's own return value) *before* the callback ever
// runs, but here the callback's `rafId = null` reset fires first and gets
// immediately clobbered back to `undefined` by that same assignment. So
// after any wire()'d pointermove, rafId is `undefined`, not `null` —
// still "not null" to the pointerleave handler's own guard, which then
// calls cancelAnimationFrame(undefined). No test-env polyfill exists for
// it (Node has no native rAF/cancelAnimationFrame either) — a harmless
// local no-op here is enough, only this file's own Node test-runner
// module gets it.
global.cancelAnimationFrame = () => {};

const HIDDEN_CLASS = 'target-photo-overlay-pin-label--hidden';

const { createTargetLabelVisibility } = await import('../src/ui/locations/target-label-visibility.js');
const { setTargetLabelVisibility } = await import('../src/range-solver-prefs.js');
const { removeCookie } = await import('../src/cookies.js');

const LABEL_VISIBILITY_COOKIE_NAME = 'ballistics_range_solver_label_visibility_v1';

test.afterEach(() => {
  removeCookie(LABEL_VISIBILITY_COOKIE_NAME);
});

// Bare object stand-ins for a pin <button>/its label <span> — fake-dom.js's
// own querySelectorAll()/querySelectorAll() stub always returns [] (it's
// not a real query engine), so "declutter" mode's DOM traversal is
// exercised against these hand-built objects instead, each carrying just
// the surface target-label-visibility.js actually calls.
function makeClassList() {
  const classes = new Set();
  return {
    toggle(cls, force) {
      const has = classes.has(cls);
      const shouldHave = force === undefined ? !has : force;
      if (shouldHave) classes.add(cls); else classes.delete(cls);
      return shouldHave;
    },
    remove(cls) { classes.delete(cls); },
    contains(cls) { return classes.has(cls); }
  };
}

function makeLabel(width) {
  return {
    classList: makeClassList(),
    getBoundingClientRect: () => ({ width })
  };
}

// centerX/centerY is the pin's own on-screen center — what declutter mode
// actually measures distance from (never the label's own position/size,
// which only ever feeds the hide-radius, not the distance check).
function makePin(label, centerX, centerY) {
  return {
    getBoundingClientRect: () => ({ left: centerX - 6, top: centerY - 6, width: 12, height: 12 }),
    querySelector: (sel) => (sel === '.target-photo-overlay-pin-label' ? label : null)
  };
}

function makeContainer(pins, labels) {
  const listeners = {};
  return {
    addEventListener(type, handler) { listeners[type] = handler; },
    querySelectorAll(sel) {
      if (sel === '.target-photo-overlay-pin') return pins;
      if (sel === '.target-photo-overlay-pin-label') return labels;
      return [];
    },
    fire(type, evt) { listeners[type]?.(evt); },
    listenerCount: () => Object.keys(listeners).length
  };
}

test('"always" mode: bindPin returns onSelect unchanged and never hides a label', () => {
  const lv = createTargetLabelVisibility(); // default cookie is unset -> "always"
  lv.beginRender();
  const label = makeLabel(0, 0, 40);
  let selected = false;
  const handler = lv.bindPin('t1', label, () => { selected = true; });
  assert.equal(label.classList.contains(HIDDEN_CLASS), false);
  handler();
  assert.equal(selected, true, 'a tap selects immediately, same as before this feature existed');
});

test('"always" mode: wire() attaches no listeners', () => {
  const lv = createTargetLabelVisibility();
  const container = makeContainer([], []);
  lv.wire(container);
  assert.equal(container.listenerCount(), 0);
});

test('"tap" mode: labels start hidden until tapped', () => {
  setTargetLabelVisibility('tap');
  const lv = createTargetLabelVisibility();
  lv.beginRender();
  const label = makeLabel(0, 0, 40);
  lv.bindPin('t1', label, () => {});
  assert.equal(label.classList.contains(HIDDEN_CLASS), true);
});

test('"tap" mode: first tap reveals the label without selecting; second tap on the same (now-revealed) target selects', () => {
  setTargetLabelVisibility('tap');
  const lv = createTargetLabelVisibility();
  lv.beginRender();
  const label = makeLabel(0, 0, 40);
  let selectCount = 0;
  const handler = lv.bindPin('t1', label, () => { selectCount += 1; });

  handler(); // first tap
  assert.equal(label.classList.contains(HIDDEN_CLASS), false, 'revealed after the first tap');
  assert.equal(selectCount, 0, 'a first tap only reveals, never selects');

  handler(); // second tap, target already revealed
  assert.equal(selectCount, 1, 'a second tap on the already-revealed target selects it');
  assert.equal(label.classList.contains(HIDDEN_CLASS), true, 'hidden again once selected');
});

test('"tap" mode: tapping a different target hides the previously-revealed one and reveals the new one, without selecting either', () => {
  setTargetLabelVisibility('tap');
  const lv = createTargetLabelVisibility();
  lv.beginRender();
  const labelA = makeLabel(0, 0, 40);
  const labelB = makeLabel(100, 0, 40);
  let selectedA = false, selectedB = false;
  const tapA = lv.bindPin('a', labelA, () => { selectedA = true; });
  const tapB = lv.bindPin('b', labelB, () => { selectedB = true; });

  tapA();
  assert.equal(labelA.classList.contains(HIDDEN_CLASS), false);

  tapB();
  assert.equal(labelA.classList.contains(HIDDEN_CLASS), true, 'A re-hidden once B is tapped instead');
  assert.equal(labelB.classList.contains(HIDDEN_CLASS), false, 'B revealed by its own first tap');
  assert.equal(selectedA, false);
  assert.equal(selectedB, false, 'B\'s first tap only reveals, same as any other target\'s first tap');
});

test('"tap" mode: clearRevealed() (a tap on empty background) hides whatever was revealed', () => {
  setTargetLabelVisibility('tap');
  const lv = createTargetLabelVisibility();
  lv.beginRender();
  const label = makeLabel(0, 0, 40);
  const handler = lv.bindPin('t1', label, () => {});
  handler(); // reveal it
  assert.equal(label.classList.contains(HIDDEN_CLASS), false);

  lv.clearRevealed();
  assert.equal(label.classList.contains(HIDDEN_CLASS), true);
});

test('"tap" mode: revealed state survives a renderPins()-style rebuild, but beginRender() drops the stale (detached) label from the registry', () => {
  setTargetLabelVisibility('tap');
  const lv = createTargetLabelVisibility();
  lv.beginRender();
  const staleLabel = makeLabel(40);
  lv.bindPin('t1', staleLabel, () => {})(); // reveals t1 in the first render pass

  lv.beginRender(); // simulates range-card-panel.js's renderPins() clearing and rebuilding the DOM
  const freshLabel = makeLabel(40);
  lv.bindPin('t1', freshLabel, () => {});
  // revealedId itself lives outside any one render pass's registry, so
  // t1's still-revealed state carries over onto its fresh label too.
  assert.equal(freshLabel.classList.contains(HIDDEN_CLASS), false, 'still-revealed target starts visible again after the rebuild');

  // Revealing a different target only touches what's in the *current*
  // registry — the previous pass's now-detached staleLabel is never
  // reached again.
  const otherLabel = makeLabel(40);
  lv.bindPin('t2', otherLabel, () => {})();
  assert.equal(freshLabel.classList.contains(HIDDEN_CLASS), true, 'fresh t1 label re-hidden once t2 is revealed instead');
  assert.equal(staleLabel.classList.contains(HIDDEN_CLASS), false, 'stale detached label from the dropped pass is left untouched');
});

// Shared geometry for the declutter tests below: pointer at (200,200);
// pin1 sits exactly on it (dist 0), pin2 is 20px away, pin3 is far away —
// each label is 40px wide, and MIN_DECLUTTER_RADIUS_PX is 40, so the
// resulting hide-radius is 40 either way: both pin1 and pin2 are
// candidates, pin3 never is.
function makeThreePinScene() {
  const label1 = makeLabel(40), label2 = makeLabel(40), label3Far = makeLabel(40);
  const pin1 = makePin(label1, 200, 200); // dist 0 — the closest
  const pin2 = makePin(label2, 220, 200); // dist 20 — near, but not closest
  const pin3Far = makePin(label3Far, 600, 600); // dist ~566 — outside the radius
  const container = makeContainer([pin1, pin2, pin3Far], [label1, label2, label3Far]);
  return { label1, label2, label3Far, container };
}

test('"declutter" mode: hides labels near the pointer except the closest one', () => {
  setTargetLabelVisibility('declutter');
  const lv = createTargetLabelVisibility();
  const { label1, label2, label3Far, container } = makeThreePinScene();
  lv.wire(container);

  container.fire('pointermove', { pointerType: 'mouse', clientX: 200, clientY: 200 });

  assert.equal(label1.classList.contains(HIDDEN_CLASS), false, 'closest target to the pointer stays visible');
  assert.equal(label2.classList.contains(HIDDEN_CLASS), true, 'a second nearby label is decluttered away');
  assert.equal(label3Far.classList.contains(HIDDEN_CLASS), false, 'a label far from the pointer is never touched');
});

test('"declutter" mode: a lone nearby label is left visible (nothing to declutter against)', () => {
  setTargetLabelVisibility('declutter');
  const lv = createTargetLabelVisibility();
  const label = makeLabel(40);
  const pin = makePin(label, 200, 200);
  const container = makeContainer([pin], [label]);
  lv.wire(container);

  container.fire('pointermove', { pointerType: 'mouse', clientX: 200, clientY: 200 });

  assert.equal(label.classList.contains(HIDDEN_CLASS), false, 'the only nearby label is also the closest one, so it is exempt');
});

test('"declutter" mode: non-mouse pointer types (touch/pen) never trigger hiding', () => {
  setTargetLabelVisibility('declutter');
  const lv = createTargetLabelVisibility();
  const { label1, label2, container } = makeThreePinScene();
  lv.wire(container);

  container.fire('pointermove', { pointerType: 'touch', clientX: 200, clientY: 200 });

  assert.equal(label1.classList.contains(HIDDEN_CLASS), false);
  assert.equal(label2.classList.contains(HIDDEN_CLASS), false, 'a touch/pen move must behave exactly like "always show" — no mouse on this device');
});

test('"declutter" mode: the pointer leaving the photo clears any hiding in effect', () => {
  setTargetLabelVisibility('declutter');
  const lv = createTargetLabelVisibility();
  const { label1, label2, container } = makeThreePinScene();
  lv.wire(container);

  container.fire('pointermove', { pointerType: 'mouse', clientX: 200, clientY: 200 });
  assert.equal(label2.classList.contains(HIDDEN_CLASS), true, 'sanity check: decluttering did kick in first');

  container.fire('pointerleave', { pointerType: 'mouse' });
  assert.equal(label1.classList.contains(HIDDEN_CLASS), false);
  assert.equal(label2.classList.contains(HIDDEN_CLASS), false);
});
