import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from './helpers/fake-dom.js';

installFakeDom();

const { loadColumnVisibility, saveColumnVisibility } = await import('../src/table-columns.js');
const { getCookie } = await import('../src/cookies.js');

const COLUMNS = [
  { id: 'a', default: true },
  { id: 'b', default: false },
  { id: 'c', default: true }
];

test('loadColumnVisibility falls back to each column\'s own default when nothing is saved', () => {
  assert.deepEqual(loadColumnVisibility(COLUMNS), { a: true, b: false, c: true });
});

test('saveColumnVisibility persists to a cookie, and loadColumnVisibility reads it back', () => {
  saveColumnVisibility({ a: false, b: true, c: true });
  assert.deepEqual(loadColumnVisibility(COLUMNS), { a: false, b: true, c: true });
});

test('a saved value missing a newer column still fills in that column\'s default', () => {
  saveColumnVisibility({ a: false }); // as if "b" and "c" didn't exist yet when this was saved
  assert.deepEqual(loadColumnVisibility(COLUMNS), { a: false, b: false, c: true });
});

test('persists under the documented cookie name', () => {
  saveColumnVisibility({ a: true, b: true, c: false });
  const raw = getCookie('ballistics_trajectory_columns_v1');
  assert.deepEqual(JSON.parse(raw), { a: true, b: true, c: false });
});

test('a visibility saved under a renamed column id (dropCm/windageCm) applies to the column\'s current id', async () => {
  const { setCookie } = await import('../src/cookies.js');
  setCookie('ballistics_trajectory_columns_v1', JSON.stringify({ dropCm: false, windageCm: false, tof: true }));
  const visibility = loadColumnVisibility([{ id: 'drop', default: true }, { id: 'windage', default: true }, { id: 'tof', default: false }]);
  assert.deepEqual(visibility, { drop: false, windage: false, tof: true });
});
