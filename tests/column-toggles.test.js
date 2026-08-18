import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom, fireEvent } from './helpers/fake-dom.js';

installFakeDom();

const { initI18n } = await import('../src/i18n.js');
await initI18n();

const { columnToggles } = await import('../src/ui/column-toggles.js');

const COLUMNS = [
  { id: 'dropCm', headerKey: 'trajectory.colDrop' },
  { id: 'elevMrad', headerKey: 'trajectory.colElevMrad' }
];

function findInputs(node, out = []) {
  if (node.tagName === 'INPUT') out.push(node);
  for (const child of node.childNodes || []) findInputs(child, out);
  return out;
}

test('one checkbox per column, initialized from the given visibility map', () => {
  const toggles = columnToggles(COLUMNS, { dropCm: true, elevMrad: false });
  const checkboxes = findInputs(toggles.node);
  assert.equal(checkboxes.length, 2);
  assert.equal(checkboxes[0].checked, true);
  assert.equal(checkboxes[1].checked, false);
  assert.equal(toggles.isVisible('dropCm'), true);
  assert.equal(toggles.isVisible('elevMrad'), false);
});

test('toggling a checkbox updates isVisible() and fires onChange with the full map', () => {
  let seen = null;
  const toggles = columnToggles(COLUMNS, { dropCm: true, elevMrad: false }, {
    onChange: (visibility) => { seen = visibility; }
  });
  const [, elevCheckbox] = findInputs(toggles.node);

  elevCheckbox.checked = true;
  fireEvent(elevCheckbox, 'change');

  assert.equal(toggles.isVisible('elevMrad'), true);
  assert.deepEqual(seen, { dropCm: true, elevMrad: true });
});

test('getVisibility returns a snapshot, not a live reference', () => {
  const toggles = columnToggles(COLUMNS, { dropCm: true, elevMrad: false });
  const snapshot = toggles.getVisibility();
  const [dropCheckbox] = findInputs(toggles.node);
  dropCheckbox.checked = false;
  fireEvent(dropCheckbox, 'change');
  assert.equal(snapshot.dropCm, true, 'earlier snapshot should not mutate after the fact');
  assert.equal(toggles.getVisibility().dropCm, false);
});

test('a column with no entry in the initial visibility map defaults to falsy (unchecked)', () => {
  const toggles = columnToggles(COLUMNS, { dropCm: true }); // elevMrad omitted
  assert.equal(toggles.isVisible('elevMrad'), false);
});
