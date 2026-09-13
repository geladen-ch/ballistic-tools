import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from './helpers/fake-dom.js';

installFakeDom();

const { getDeviceName, setDeviceName, getDeviceNameModifiedAt, hasCustomDeviceName } =
  await import('../src/sync/device-name.js');

test('defaults to a UA-derived guess and reports no custom name yet', () => {
  localStorage.clear();
  Object.defineProperty(global, 'navigator', {
    value: { userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/120.0 Safari/537.36' },
    configurable: true
  });
  assert.equal(getDeviceName(), 'Chrome on Windows');
  assert.equal(hasCustomDeviceName(), false);
  assert.equal(getDeviceNameModifiedAt(), null);
});

test('guesses iPhone Safari distinctly from a desktop', () => {
  localStorage.clear();
  Object.defineProperty(global, 'navigator', {
    value: { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1' },
    configurable: true
  });
  assert.equal(getDeviceName(), 'Safari on iPhone');
});

test('setDeviceName persists the name and stamps modifiedAt, readable back', () => {
  localStorage.clear();
  const before = Date.now();
  const record = setDeviceName("Guns' Laptop");
  assert.equal(record.name, "Guns' Laptop");
  assert.equal(getDeviceName(), "Guns' Laptop");
  assert.equal(hasCustomDeviceName(), true);
  assert.ok(Date.parse(getDeviceNameModifiedAt()) >= before);
});

test('setDeviceName accepts an explicit modifiedAt (for merging in a peer-supplied device block)', () => {
  localStorage.clear();
  setDeviceName('Imported Name', { modifiedAt: '2020-01-01T00:00:00.000Z' });
  assert.equal(getDeviceNameModifiedAt(), '2020-01-01T00:00:00.000Z');
});
