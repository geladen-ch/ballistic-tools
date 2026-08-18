import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom, makeElement } from './helpers/fake-dom.js';

installFakeDom();

const { initI18n, t } = await import('../src/i18n.js');
await initI18n();
const categoryView = await import('../src/views/category-view.js');
const { toolsInGroup } = await import('../src/nav-tools.js');

function findByTag(node, tag, out = []) {
  if (node.tagName === tag) out.push(node);
  for (const child of node.childNodes || []) findByTag(child, tag, out);
  return out;
}

test('mounting the "measurement" group shows exactly its own tools', () => {
  const container = makeElement('main');
  categoryView.mount(container, 'measurement');

  assert.equal(container.textContent.includes(t('catalog.groupMeasurement')), true);
  const cards = findByTag(container, 'A').concat(findByTag(container, 'DIV').filter((d) => d.className && d.className.includes('category-card')));
  const measurementTools = toolsInGroup('measurement');
  for (const tool of measurementTools) {
    assert.ok(container.textContent.includes(t(tool.nameKey)), `expected "${tool.nameKey}" on the page`);
  }
  assert.ok(!container.textContent.includes(t('nav.trajectory')), 'an Analysis tool should not appear on the Measurement page');
});

test('a live tool renders as a link to its route; a planned one does not', () => {
  const container = makeElement('main');
  categoryView.mount(container, 'measurement');

  const link = findByTag(container, 'A').find((a) => a.getAttribute('href') === '#/bc-tools');
  assert.ok(link, 'expected BC Tools to be a real link');

  const plannedCards = findByTag(container, 'DIV').filter((d) => d.className && d.className.includes('category-card') && d.className.includes('disabled'));
  assert.ok(plannedCards.length >= 1);
});

test('mounting "analysis" shows the analysis tools and not measurement ones', () => {
  const container = makeElement('main');
  categoryView.mount(container, 'analysis');

  assert.ok(container.textContent.includes(t('nav.trajectory')));
  assert.ok(container.textContent.includes(t('nav.hitProbability')));
  assert.ok(!container.textContent.includes(t('catalog.bcTools')));
});

test('re-mounting into the same container replaces its content', () => {
  const container = makeElement('main');
  categoryView.mount(container, 'measurement');
  categoryView.mount(container, 'analysis');

  assert.ok(!container.textContent.includes(t('catalog.bcTools')));
  assert.ok(container.textContent.includes(t('nav.trajectory')));
});
