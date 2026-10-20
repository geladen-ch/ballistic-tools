import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom, fireEvent } from './helpers/fake-dom.js';

installFakeDom();

const { initI18n } = await import('../src/i18n.js');
await initI18n();
const { targetForm } = await import('../src/ui/locations/target-form.js');

function findAll(node, pred, out = []) {
  if (pred(node)) out.push(node);
  for (const child of node.childNodes || []) findAll(child, pred, out);
  return out;
}

function saveWith(values, edit) {
  let saved = null;
  const form = targetForm({ initialValues: values, onSave: (v) => { saved = v; } });
  if (edit) edit(form.node);
  const save = findAll(form.node, (n) => n.tagName === 'BUTTON')[0];
  fireEvent(save, 'click');
  return saved;
}

test('an untouched line-of-sight angle is saved back as the record\'s own degrees, not a round trip through radians', () => {
  // 63.9 deg does not survive deg -> rad -> deg exactly
  const saved = saveWith({ name: 'Ridge', rangeM: 400, losAngleDeg: 63.9 });
  assert.equal(saved.losAngleDeg, 63.9);
});

test('a typed line-of-sight angle is stored in degrees', () => {
  const saved = saveWith({ name: 'Ridge', rangeM: 400, losAngleDeg: 0 }, (node) => {
    const input = findAll(node, (n) => n.id === 'losAngle')[0];
    input.value = '12.5';
    fireEvent(input, 'input');
  });
  assert.ok(Math.abs(saved.losAngleDeg - 12.5) < 1e-12);
});
