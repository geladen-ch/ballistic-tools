import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom, fireEvent } from './helpers/fake-dom.js';

installFakeDom();

const { massDualField } = await import('../src/ui/arsenal/mass-field.js');

function findByTag(node, tag, out = []) {
  if (node.tagName === tag) out.push(node);
  for (const child of node.childNodes || []) findByTag(child, tag, out);
  return out;
}

test('grams and grains stay in sync as the user types either one', () => {
  const field = massDualField({ value: 0.01 }); // 10 g
  const [gramsInput, grainsInput] = findByTag(field.node, 'INPUT');

  gramsInput.value = '12';
  fireEvent(gramsInput, 'input');
  assert.ok(Math.abs(parseFloat(grainsInput.value) - 185.2) < 0.1, `grains was ${grainsInput.value}`);
  assert.ok(Math.abs(field.getMassKg() - 0.012) < 1e-6);

  grainsInput.value = '150';
  fireEvent(grainsInput, 'input');
  assert.ok(Math.abs(parseFloat(gramsInput.value) - 9.72) < 0.01, `grams was ${gramsInput.value}`);
  assert.ok(Math.abs(field.getMassKg() - 0.00972) < 1e-5);
});

test('setMassKg writes both boxes without firing onInput', () => {
  let calls = 0;
  const field = massDualField({ value: 0.01, onInput: () => calls++ });
  field.setMassKg(0.02);

  const [gramsInput, grainsInput] = findByTag(field.node, 'INPUT');
  assert.equal(parseFloat(gramsInput.value), 20);
  assert.ok(Math.abs(parseFloat(grainsInput.value) - 308.6) < 0.1);
  assert.equal(calls, 0);
  assert.ok(Math.abs(field.getMassKg() - 0.02) < 1e-6);
});

test('regression: an emptied grams input does not fire onInput and getMassKg() falls back to the last real mass instead of 0', () => {
  let calls = 0;
  const field = massDualField({ value: 0.01, onInput: () => calls++ });
  const [gramsInput] = findByTag(field.node, 'INPUT');

  gramsInput.value = '15';
  fireEvent(gramsInput, 'input');
  assert.equal(calls, 1);

  // <input type=number> reports '' for a transient invalid/mid-edit state
  // (e.g. text selected and retyped) — this used to leak straight into
  // getMassKg() as 0 kg (a physically meaningless bullet mass) and, via
  // callers that persist it on every keystroke (bullet-section.js's
  // saveManualBullet(), cd-mach-curve-view.js's persistInputs()), risked
  // silently zeroing the remembered mass.
  gramsInput.value = '';
  fireEvent(gramsInput, 'input');
  assert.equal(calls, 1, 'onInput should not fire for a blank value');
  assert.ok(Math.abs(field.getMassKg() - 0.015) < 1e-6, `expected fallback to the last real 0.015 kg, got ${field.getMassKg()}`);

  gramsInput.value = '18';
  fireEvent(gramsInput, 'input');
  assert.equal(calls, 2);
  assert.ok(Math.abs(field.getMassKg() - 0.018) < 1e-6);
});

test('regression: an emptied grains input does not fire onInput and getMassKg() falls back to the last real mass', () => {
  let calls = 0;
  const field = massDualField({ value: 0.01, onInput: () => calls++ });
  const [, grainsInput] = findByTag(field.node, 'INPUT');

  grainsInput.value = '200';
  fireEvent(grainsInput, 'input');
  assert.equal(calls, 1);
  const massAfterValid = field.getMassKg();

  grainsInput.value = '';
  fireEvent(grainsInput, 'input');
  assert.equal(calls, 1, 'onInput should not fire for a blank value');
  assert.ok(Math.abs(field.getMassKg() - massAfterValid) < 1e-6);
});
