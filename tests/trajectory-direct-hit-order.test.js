// The Trajectory page's direct-hit solve and its trajectory run as two
// separate worker jobs. The direct-hit elevation rows are measured from the
// trajectory's zero angle, so they must fill in whichever job finishes
// first — a regression test for the rows staying "—" when the direct-hit
// result arrived before the trajectory.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from './helpers/fake-dom.js';

installFakeDom();

// A worker whose jobs this test answers by hand, in the order it chooses,
// with the real engine handlers.
const queued = [];
global.Worker = class ControlledWorker {
  postMessage(message) { queued.push({ worker: this, message }); }
  terminate() {}
};
const { integrate, solveDirectHit } = await import('../src/engine/trajectory.js');
const HANDLERS = { trajectory: integrate, directHit: solveDirectHit };
function answer(type) {
  const index = queued.findIndex((q) => q.message.type === type);
  assert.ok(index >= 0, `expected a queued ${type} job`);
  const [{ worker, message }] = queued.splice(index, 1);
  worker.onmessage({ data: { id: message.id, ok: true, result: HANDLERS[type](message.payload) } });
}
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

const { makeElement } = await import('./helpers/fake-dom.js');
const { initI18n, t } = await import('../src/i18n.js');
await initI18n();
const trajectoryView = await import('../src/views/trajectory-view.js');

function rowValue(container, labelKey) {
  const label = t(labelKey);
  const find = (node) => {
    if (node.childNodes && node.childNodes.some((c) => c.textContent === label)) return node;
    for (const child of node.childNodes || []) {
      const found = find(child);
      if (found) return found;
    }
    return null;
  };
  const row = find(container);
  return row ? row.childNodes[row.childNodes.length - 1].textContent : null;
}

test('direct-hit elevation rows fill in even when the direct-hit result arrives before the trajectory', async () => {
  const container = makeElement('main');
  trajectoryView.mount(container);
  await settle();
  while (queued.some((q) => q.message.type === 'directHit')) answer('directHit');
  await settle();
  assert.equal(rowValue(container, 'trajectory.directHitElevationClicksLabel'), '—', 'no zero angle yet');
  while (queued.some((q) => q.message.type === 'trajectory')) answer('trajectory');
  await settle();
  assert.notEqual(rowValue(container, 'trajectory.directHitElevationClicksLabel'), '—');
  assert.notEqual(rowValue(container, 'trajectory.directHitElevationAbsoluteLabel'), '—');
});
