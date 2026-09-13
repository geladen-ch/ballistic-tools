import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from './helpers/fake-dom.js';

installFakeDom();

// The suffixes are translated UI copy, so the real locale bundle has to be
// loaded for these assertions to mean anything — a missing key would
// otherwise pass silently as some placeholder string.
const { initI18n } = await import('../src/i18n.js');
await initI18n();
const { disambiguateByName } = await import('../src/sync/disambiguate-by-name.js');
const { recordPeerDevice } = await import('../src/sync/device-registry.js');

test.beforeEach(() => localStorage.clear());

test('a group of one keeps its plain name unchanged', () => {
  const labels = disambiguateByName([{ id: 'a', name: 'My Bullet' }]);
  assert.equal(labels.get('a'), 'My Bullet');
});

test('grouping is case/whitespace-insensitive, matching the rest of the app\'s name-collision conventions', () => {
  const labels = disambiguateByName([
    { id: 'a', name: 'My Bullet', modifiedBy: 'dev-1' },
    { id: 'b', name: '  my bullet  ', modifiedBy: 'dev-2' }
  ]);
  assert.notEqual(labels.get('a'), labels.get('b'));
  assert.ok(labels.get('a').startsWith('My Bullet ('));
  assert.ok(labels.get('b').startsWith('  my bullet   ('));
});

test('prefers the authoring device name via modifiedBy and the device registry', () => {
  recordPeerDevice({ id: 'dev-1', name: "Guns' iPhone", modifiedAt: '2021-01-01T00:00:00.000Z' });
  const labels = disambiguateByName([
    { id: 'a', name: 'X', modifiedBy: 'dev-1' },
    { id: 'b', name: 'X', modifiedBy: 'dev-2' } // unknown device
  ]);
  assert.equal(labels.get('a'), "X (from Guns' iPhone)");
  assert.ok(labels.get('b').startsWith('X ('));
  assert.notEqual(labels.get('b'), labels.get('a'));
});

test('falls back to a short authoring date when modifiedBy is missing or unresolvable', () => {
  const labels = disambiguateByName([
    { id: 'a', name: 'X', modifiedAt: '2021-03-15T12:00:00.000Z' },
    { id: 'b', name: 'X', modifiedAt: '2021-06-01T00:00:00.000Z' }
  ]);
  assert.equal(labels.get('a'), 'X (added 2021-03-15)');
  assert.equal(labels.get('b'), 'X (added 2021-06-01)');
});

test('falls back to createdAt for record types without modifiedAt collision info (Rifle Precision Projects)', () => {
  const labels = disambiguateByName([
    { id: 'a', name: 'X', createdAt: '2021-03-15T12:00:00.000Z' },
    { id: 'b', name: 'X', createdAt: '2021-06-01T00:00:00.000Z' }
  ], { dateFallbackField: 'createdAt' });
  assert.equal(labels.get('a'), 'X (added 2021-03-15)');
  assert.equal(labels.get('b'), 'X (added 2021-06-01)');
});

test('falls back to an id fragment when two members also share the same date and no resolvable device', () => {
  const labels = disambiguateByName([
    { id: 'aaa111', name: 'X', modifiedAt: '2021-01-01T00:00:00.000Z' },
    { id: 'bbb222', name: 'X', modifiedAt: '2021-01-01T00:00:00.000Z' }
  ]);
  assert.notEqual(labels.get('aaa111'), labels.get('bbb222'));
});

test('a group of three all get distinct labels', () => {
  const labels = disambiguateByName([
    { id: 'a', name: 'X', modifiedBy: 'dev-1' },
    { id: 'b', name: 'X', modifiedAt: '2021-01-01T00:00:00.000Z' },
    { id: 'c', name: 'X', modifiedAt: '2021-06-01T00:00:00.000Z' }
  ]);
  const values = new Set(['a', 'b', 'c'].map((id) => labels.get(id)));
  assert.equal(values.size, 3);
});

test('unrelated names never collide with each other', () => {
  const labels = disambiguateByName([
    { id: 'a', name: 'Bullet A' },
    { id: 'b', name: 'Bullet B' }
  ]);
  assert.equal(labels.get('a'), 'Bullet A');
  assert.equal(labels.get('b'), 'Bullet B');
});

test('an empty list produces an empty map', () => {
  assert.deepEqual([...disambiguateByName([])], []);
});
