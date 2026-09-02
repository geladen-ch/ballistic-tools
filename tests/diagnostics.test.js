import test from 'node:test';
import assert from 'node:assert/strict';
import { missingIds } from '../src/diagnostics.js';

test('missingIds returns ids whose url is absent from the cached set', () => {
  const urlForId = (id) => `https://example.com/things/${id}.json`;
  const cached = new Set([urlForId('a'), urlForId('c')]);
  assert.deepEqual(missingIds(['a', 'b', 'c', 'd'], cached, urlForId), ['b', 'd']);
});

test('missingIds returns an empty array when everything is cached', () => {
  const urlForId = (id) => `https://example.com/things/${id}.json`;
  const cached = new Set(['a', 'b'].map(urlForId));
  assert.deepEqual(missingIds(['a', 'b'], cached, urlForId), []);
});

test('missingIds returns every id when the cache is empty', () => {
  const urlForId = (id) => `https://example.com/things/${id}.json`;
  assert.deepEqual(missingIds(['a', 'b'], new Set(), urlForId), ['a', 'b']);
});
