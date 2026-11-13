import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom, fireEvent } from './helpers/fake-dom.js';
import { degToRad } from '../src/quantity.js';

installFakeDom();

const { initI18n } = await import('../src/i18n.js');
await initI18n();
const { targetImagePicker } = await import('../src/ui/range-solver/target-image-picker.js');

function findByClass(node, cls, out = []) {
  if (node.className && node.className.split(' ').includes(cls)) out.push(node);
  for (const child of node.childNodes || []) findByClass(child, cls, out);
  return out;
}
const location = {
  id: 'l1', name: 'Range', photo: 'data:image/jpeg;base64,AAA',
  targets: [
    { id: 'p', name: 'Gong', rangeM: 300, losAngleRad: degToRad(3), coords: { x: 0.2, y: 0.5 } },
    { id: 'u', name: null, rangeM: 500, losAngleRad: degToRad(-2), coords: null }
  ]
};

test('a pin per placed target and a chip per unplaced one; tapping a chip selects its target', () => {
  const picked = [];
  const picker = targetImagePicker({ onSelectTarget: (id) => picked.push(id) });
  picker.refresh({ location, activeTargetId: 'p' });
  assert.equal(findByClass(picker.node, 'target-photo-overlay-pin').length, 1);
  const chips = findByClass(picker.node, 'target-photo-overlay-chip');
  assert.equal(chips.length, 1);
  fireEvent(chips[0], 'click');
  assert.deepEqual(picked, ['u']);
  assert.equal(findByClass(picker.node, 'range-card-pin--active').length, 1, 'the selected pin is highlighted');
});

test('no selection: nothing highlighted', () => {
  const picker = targetImagePicker({ onSelectTarget: () => {} });
  picker.refresh({ location, activeTargetId: null });
  assert.equal(findByClass(picker.node, 'range-card-pin--active').length, 0);
});

test('labels show the angle unless it is omitted (LoS angles ignored)', () => {
  const picker = targetImagePicker({ onSelectTarget: () => {} });
  picker.refresh({ location, activeTargetId: null });
  assert.match(picker.node.textContent, /3°/);
  picker.refresh({ location, activeTargetId: null, omitAngle: true });
  assert.doesNotMatch(picker.node.textContent, /°/);
});

test('no location: empty', () => {
  const picker = targetImagePicker({ onSelectTarget: () => {} });
  picker.refresh({ location, activeTargetId: null });
  picker.refresh({ location: null, activeTargetId: null });
  assert.equal(picker.node.childNodes.length, 0);
});
