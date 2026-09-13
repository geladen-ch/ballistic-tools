import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from './helpers/fake-dom.js';

installFakeDom();

const {
  recordPeerDevice, getKnownDevices, getDeviceLabel, forgetDevice,
  getPeerExportedAt, recordPeerExportedAtSeen
} = await import('../src/sync/device-registry.js');

test('recordPeerDevice adds a new device, readable by getDeviceLabel', () => {
  localStorage.clear();
  recordPeerDevice({ id: 'dev-1', name: "Guns' iPhone", modifiedAt: '2021-01-01T00:00:00.000Z' });
  assert.equal(getDeviceLabel('dev-1'), "Guns' iPhone");
  assert.deepEqual(getKnownDevices(), { 'dev-1': { name: "Guns' iPhone", modifiedAt: '2021-01-01T00:00:00.000Z' } });
});

test('recordPeerDevice ignores a stale update (older or equal modifiedAt)', () => {
  localStorage.clear();
  recordPeerDevice({ id: 'dev-1', name: 'Newer Name', modifiedAt: '2021-06-01T00:00:00.000Z' });
  recordPeerDevice({ id: 'dev-1', name: 'Stale Name', modifiedAt: '2021-01-01T00:00:00.000Z' });
  assert.equal(getDeviceLabel('dev-1'), 'Newer Name');
});

test('recordPeerDevice applies a genuinely newer update', () => {
  localStorage.clear();
  recordPeerDevice({ id: 'dev-1', name: 'Old Name', modifiedAt: '2021-01-01T00:00:00.000Z' });
  recordPeerDevice({ id: 'dev-1', name: 'New Name', modifiedAt: '2021-06-01T00:00:00.000Z' });
  assert.equal(getDeviceLabel('dev-1'), 'New Name');
});

test('getDeviceLabel returns null for an unknown device', () => {
  localStorage.clear();
  assert.equal(getDeviceLabel('never-seen'), null);
});

test('forgetDevice hides the label without deleting the underlying record, and a fresh sighting revives it', () => {
  localStorage.clear();
  recordPeerDevice({ id: 'dev-1', name: 'Retired Laptop', modifiedAt: '2021-01-01T00:00:00.000Z' });
  forgetDevice('dev-1');
  assert.equal(getDeviceLabel('dev-1'), null);

  // A real, fresh read of that peer's own bundle overwrites the cache
  // entry unconditionally and un-forgets it — no special "revive" code.
  recordPeerDevice({ id: 'dev-1', name: 'Retired Laptop', modifiedAt: '2022-01-01T00:00:00.000Z' });
  assert.equal(getDeviceLabel('dev-1'), 'Retired Laptop');
});

test('recordPeerDevice ignores a malformed device block', () => {
  localStorage.clear();
  recordPeerDevice(null);
  recordPeerDevice({ name: 'No id here' });
  assert.deepEqual(getKnownDevices(), {});
});

test('getPeerExportedAt returns null for a peer never seen before', () => {
  localStorage.clear();
  assert.equal(getPeerExportedAt('never-seen'), null);
});

test('recordPeerExportedAtSeen records and getPeerExportedAt reads it back', () => {
  localStorage.clear();
  recordPeerExportedAtSeen('dev-1', '2021-01-01T00:00:00.000Z');
  assert.equal(getPeerExportedAt('dev-1'), '2021-01-01T00:00:00.000Z');
  recordPeerExportedAtSeen('dev-1', '2021-06-01T00:00:00.000Z');
  assert.equal(getPeerExportedAt('dev-1'), '2021-06-01T00:00:00.000Z', 'always overwritten with whatever was last seen, unconditionally');
});

test('regression: recordPeerDevice preserves lastExportedAt (a separate concern) when merging in a new device name', () => {
  // recordPeerDevice replaces the whole cache entry on a genuinely newer
  // name update — it must not incidentally wipe out exportedAt tracking,
  // which is updated on its own, unrelated cadence (every bundle read,
  // not just device-name changes).
  localStorage.clear();
  recordPeerExportedAtSeen('dev-1', '2021-01-01T00:00:00.000Z');
  recordPeerDevice({ id: 'dev-1', name: 'Renamed', modifiedAt: '2021-06-01T00:00:00.000Z' });
  assert.equal(getPeerExportedAt('dev-1'), '2021-01-01T00:00:00.000Z');
  assert.equal(getDeviceLabel('dev-1'), 'Renamed');
});

test('regression: recordPeerDevice still un-forgets a retired device even with lastExportedAt tracking present', () => {
  localStorage.clear();
  recordPeerDevice({ id: 'dev-1', name: 'Retired', modifiedAt: '2021-01-01T00:00:00.000Z' });
  recordPeerExportedAtSeen('dev-1', '2021-01-01T00:00:00.000Z');
  forgetDevice('dev-1');
  assert.equal(getDeviceLabel('dev-1'), null);

  recordPeerDevice({ id: 'dev-1', name: 'Retired', modifiedAt: '2022-01-01T00:00:00.000Z' });
  assert.equal(getDeviceLabel('dev-1'), 'Retired', 'still un-forgets on a real, fresh sighting');
});
