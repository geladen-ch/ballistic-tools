import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom, fireEvent } from './helpers/fake-dom.js';

installFakeDom();

const { initI18n } = await import('../src/i18n.js');
await initI18n();
const { targetList, formatAdjustment } = await import('../src/ui/range-solver/target-list.js');
const { INDICATOR_GLYPHS } = await import('../src/ui/dope-format.js');

const glyphs = INDICATOR_GLYPHS.signs;
const rows = [
  { id: 'a', name: 'Near', rangeDisplay: '300 m', valid: true, elevValue: 12, windValue: -1, decimals: 0 },
  { id: 'b', name: 'Far', rangeDisplay: '650 m', valid: true, elevValue: 40, windValue: 0, decimals: 0 },
  { id: 'c', name: 'Broken', rangeDisplay: '900 m', valid: false, elevValue: 0, windValue: 0, decimals: 0 }
];
function findByClass(node, cls, out = []) {
  if (node.className && node.className.split(' ').includes(cls)) out.push(node);
  for (const child of node.childNodes || []) findByClass(child, cls, out);
  return out;
}

test('renders a row per target with signed corrections, "—" for an unsolvable one', () => {
  const list = targetList({ onSelectTarget: () => {}, indicatorGlyphs: glyphs });
  list.refresh({ rows, activeTargetId: 'b' });
  const rendered = findByClass(list.node, 'range-card-row');
  assert.equal(rendered.length, 3);
  assert.ok(rendered[0].textContent.includes('Near') && rendered[0].textContent.includes('300 m'));
  assert.ok(rendered[0].textContent.includes(formatAdjustment(12, glyphs.elevationPositive, glyphs.elevationNegative, 0)));
  assert.ok(rendered[2].textContent.includes('—'));
  list.dispose();
});

test('the selected target is the one enlarged row; with none selected, no row is', () => {
  const list = targetList({ onSelectTarget: () => {}, indicatorGlyphs: glyphs });
  list.refresh({ rows, activeTargetId: 'b' });
  let active = findByClass(list.node, 'range-card-row--active');
  assert.equal(active.length, 1);
  assert.ok(active[0].textContent.includes('Far'));
  list.refresh({ rows, activeTargetId: null });
  active = findByClass(list.node, 'range-card-row--active');
  assert.equal(active.length, 0);
});

test('a tap or Enter on a row selects its target', () => {
  const picked = [];
  const list = targetList({ onSelectTarget: (id) => picked.push(id), indicatorGlyphs: glyphs });
  list.refresh({ rows, activeTargetId: null });
  const rendered = findByClass(list.node, 'range-card-row');
  fireEvent(rendered[0], 'click');
  fireEvent(rendered[1], 'keydown', { key: 'Enter', preventDefault() {} });
  assert.deepEqual(picked, ['a', 'b']);
});

test('setRowBudget accepts both forms without layout (the budget needs real row heights)', () => {
  const list = targetList({ onSelectTarget: () => {}, indicatorGlyphs: glyphs });
  list.refresh({ rows, activeTargetId: 'a' });
  list.setRowBudget({ optimal: false, count: 4 });
  list.setRowBudget({ optimal: true });
  list.remeasure();
  assert.equal(findByClass(list.node, 'range-card-row').length, 3);
});
