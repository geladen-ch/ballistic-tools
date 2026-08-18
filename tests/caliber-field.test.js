import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom, fireEvent } from './helpers/fake-dom.js';
import { warmCatalogs } from './helpers/warm-catalogs.js';

installFakeDom();

const { initI18n } = await import('../src/i18n.js');
await initI18n();
// See warm-catalogs.js — every await settle() below assumes the caliber
// designations list is already cache-warm, not racing a cold fetch.
await warmCatalogs();

const { caliberField } = await import('../src/ui/arsenal/caliber-field.js');

function settle(ms = 30) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function findInputs(node, out = []) {
  if (node.tagName === 'INPUT' || node.tagName === 'SELECT') out.push(node);
  for (const child of node.childNodes || []) findInputs(child, out);
  return out;
}

function byId(node, id) {
  return findInputs(node).find((n) => n.id === id);
}

test('with no initial value, the number field is blank and the picker sits on the placeholder', async () => {
  const caliber = caliberField();
  await settle();
  const select = byId(caliber.node, 'bulletCaliber');
  const number = byId(caliber.node, 'bulletCaliberMm');
  assert.equal(number.value, '');
  assert.equal(select.value, '');
  assert.equal(caliber.getCaliberM(), null);
});

test('an initial value that matches a known designation is reflected in the picker once the list resolves', async () => {
  const caliber = caliberField({ value: 0.0078232 }); // near-exact .308
  const select = byId(caliber.node, 'bulletCaliber');
  const number = byId(caliber.node, 'bulletCaliberMm');
  assert.equal(number.value, '7.82'); // the number field itself doesn't need the async list at all
  await settle();
  assert.equal(select.value, '7.62 / .308 / .30');
});

test('typing a number within tolerance of a known bore diameter selects that designation', async () => {
  const caliber = caliberField();
  await settle();
  const number = byId(caliber.node, 'bulletCaliberMm');
  const select = byId(caliber.node, 'bulletCaliber');

  number.value = '6.71'; // exact "6.5 / .264" (0.00671m)
  fireEvent(number, 'input');
  assert.equal(select.value, '6.5 / .264');
  assert.ok(Math.abs(caliber.getCaliberM() - 0.00671) < 1e-9);
});

test('typing a number outside tolerance of every known bore diameter selects "Other", not the first option', async () => {
  const caliber = caliberField();
  await settle();
  const number = byId(caliber.node, 'bulletCaliberMm');
  const select = byId(caliber.node, 'bulletCaliber');

  // Sits in the gap between "6 / .243" (6.17mm) and "6.5 / .264" (6.71mm).
  number.value = '6.4';
  fireEvent(number, 'input');
  assert.equal(select.value, '__other__');
  assert.ok(Math.abs(caliber.getCaliberM() - 0.0064) < 1e-9, 'the raw typed value is still what getCaliberM() reports');
});

test('blanking the number field returns the picker to the placeholder, not "Other"', async () => {
  const caliber = caliberField({ value: 0.0064 });
  await settle();
  const number = byId(caliber.node, 'bulletCaliberMm');
  const select = byId(caliber.node, 'bulletCaliber');
  assert.equal(select.value, '__other__');

  number.value = '';
  fireEvent(number, 'input');
  assert.equal(select.value, '');
  assert.equal(caliber.getCaliberM(), null);
});

test('picking a designation from the picker writes its own exact caliberM into the number field', async () => {
  const caliber = caliberField();
  await settle();
  const select = byId(caliber.node, 'bulletCaliber');
  const number = byId(caliber.node, 'bulletCaliberMm');

  select.value = '7.62 / .308 / .30';
  fireEvent(select, 'change');
  assert.equal(number.value, '7.82');
  assert.ok(Math.abs(caliber.getCaliberM() - 0.00782) < 1e-9);
});

test('picking "Other" directly from the picker leaves whatever is already in the number field untouched', async () => {
  const caliber = caliberField();
  await settle();
  const number = byId(caliber.node, 'bulletCaliberMm');
  const select = byId(caliber.node, 'bulletCaliber');

  number.value = '6.4';
  fireEvent(number, 'input');
  assert.equal(select.value, '__other__'); // already there from the mismatch

  select.value = '__other__';
  fireEvent(select, 'change');
  assert.equal(number.value, '6.4');
});

test('picking the blank placeholder from the picker clears the number field', async () => {
  const caliber = caliberField({ value: 0.0078232 });
  await settle();
  const select = byId(caliber.node, 'bulletCaliber');
  const number = byId(caliber.node, 'bulletCaliberMm');
  assert.equal(select.value, '7.62 / .308 / .30');

  select.value = '';
  fireEvent(select, 'change');
  assert.equal(number.value, '');
  assert.equal(caliber.getCaliberM(), null);
});

test('setCaliberM() writes both the number field and the picker without requiring an input/change event', async () => {
  const caliber = caliberField();
  await settle();
  caliber.setCaliberM(0.00671);
  const select = byId(caliber.node, 'bulletCaliber');
  const number = byId(caliber.node, 'bulletCaliberMm');
  assert.equal(number.value, '6.71');
  assert.equal(select.value, '6.5 / .264');
});

test('onInput fires from both the number field and the picker', async () => {
  let calls = 0;
  const caliber = caliberField({ onInput: () => calls++ });
  await settle();
  const number = byId(caliber.node, 'bulletCaliberMm');
  const select = byId(caliber.node, 'bulletCaliber');

  number.value = '6.71';
  fireEvent(number, 'input');
  assert.equal(calls, 1);

  select.value = '7.62 / .308 / .30';
  fireEvent(select, 'change');
  assert.equal(calls, 2);
});
