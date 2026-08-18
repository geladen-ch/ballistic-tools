import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom, makeElement } from './helpers/fake-dom.js';

installFakeDom();

const { initI18n, t } = await import('../src/i18n.js');
await initI18n();

const { RELEASE_HISTORY } = await import('../src/release-history.js');
const releaseHistoryView = await import('../src/views/release-history-view.js');

test('RELEASE_HISTORY entries are well-formed', () => {
  assert.ok(RELEASE_HISTORY.length > 0);
  for (const entry of RELEASE_HISTORY) {
    assert.equal(typeof entry.cacheVersion, 'string');
    assert.equal(typeof entry.fullVersion, 'string');
    assert.match(entry.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(typeof entry.descriptionKey, 'string');
  }
});

test('seeds the first release (v104)', () => {
  const first = RELEASE_HISTORY.find((e) => e.cacheVersion === 'v104');
  assert.ok(first, 'expected a v104 entry');
  assert.equal(first.fullVersion, '0.1 alpha (EBANAT — External Ballistics Analysis and Numerical Assessment Toolkit)');
  assert.equal(first.date, '2026-08-15');
  assert.equal(t(first.descriptionKey), 'Initial public preview');
});

function findByClass(node, cls, out = []) {
  if ((node.className || '').split(' ').includes(cls)) out.push(node);
  for (const child of node.childNodes || []) findByClass(child, cls, out);
  return out;
}

test('renders one stacked entry per RELEASE_HISTORY entry, with translated descriptions (no table — see the view\'s own comment on why)', () => {
  const container = makeElement('main');
  releaseHistoryView.mount(container);

  const entries = findByClass(container, 'release-entry');
  assert.equal(entries.length, RELEASE_HISTORY.length);

  const first = entries[0];
  assert.equal(findByClass(first, 'release-entry-version')[0].textContent, RELEASE_HISTORY[0].cacheVersion);
  assert.equal(findByClass(first, 'release-entry-date')[0].textContent, RELEASE_HISTORY[0].date);
  assert.equal(findByClass(first, 'release-entry-fullversion')[0].textContent, RELEASE_HISTORY[0].fullVersion);
  assert.equal(findByClass(first, 'release-entry-description')[0].textContent, t(RELEASE_HISTORY[0].descriptionKey));
});
