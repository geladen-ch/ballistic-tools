import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from './helpers/fake-dom.js';

installFakeDom();

const { getDeviceId } = await import('../src/sync/device-id.js');

test('getDeviceId creates and persists a UUID on first call', () => {
  localStorage.clear();
  const id = getDeviceId();
  assert.equal(typeof id, 'string');
  assert.ok(id.length > 0);
  assert.equal(localStorage.getItem('ballistics_device_id_v1'), id);
});

test('getDeviceId returns the same id on every subsequent call', () => {
  localStorage.clear();
  const first = getDeviceId();
  const second = getDeviceId();
  assert.equal(first, second);
});

test('getDeviceId reads back whatever is already persisted, without regenerating it', () => {
  localStorage.clear();
  localStorage.setItem('ballistics_device_id_v1', 'existing-device-id');
  assert.equal(getDeviceId(), 'existing-device-id');
});
