import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom, fireEvent } from './helpers/fake-dom.js';

installFakeDom();

const { initI18n } = await import('../src/i18n.js');
await initI18n();
const { rifleForm } = await import('../src/ui/arsenal/rifle-form.js');
const { moaToRad } = await import('../src/quantity.js');

function findAll(node, pred, out = []) {
  if (pred(node)) out.push(node);
  for (const child of node.childNodes || []) findAll(child, pred, out);
  return out;
}
const byId = (node, id) => findAll(node, (n) => n.id === id)[0];

test('a 1/16 MOA click shows with all four decimals, and is saved back exactly', () => {
  const clickRad = moaToRad(0.0625);
  let saved = null;
  const form = rifleForm({
    initialValues: { name: 'Fine Turret', defaultClickUnit: 'arcmin', defaultClickHorizontalRad: clickRad, defaultClickVerticalRad: clickRad },
    onSave: (v) => { saved = v; }
  });
  assert.equal(byId(form.node, 'arsenalRifleClickHorizontal').value, '0.0625');
  assert.equal(byId(form.node, 'arsenalRifleClickVertical').value, '0.0625');
  const save = findAll(form.node, (n) => n.tagName === 'BUTTON')[0];
  fireEvent(save, 'click');
  assert.equal(saved.defaultClickHorizontalRad, clickRad);
  assert.equal(saved.defaultClickVerticalRad, clickRad);
});
