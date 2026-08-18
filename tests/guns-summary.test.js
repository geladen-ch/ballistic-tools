import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom, fireEvent } from './helpers/fake-dom.js';
import { warmCatalogs } from './helpers/warm-catalogs.js';

installFakeDom();

const { initI18n, t } = await import('../src/i18n.js');
await initI18n();
await warmCatalogs();

const { gunsSummary } = await import('../src/ui/sections/guns-summary.js');
const { saveRifleState, saveCartridgeState, resetShotStateForTests } = await import('../src/shot-state.js');
const { saveUserRifle, saveUserBullet } = await import('../src/user-library.js');
const { resetGunsNavForTests, takeGunsReturnPath } = await import('../src/guns-nav.js');

test.beforeEach(() => {
  localStorage.clear();
  resetShotStateForTests();
  resetGunsNavForTests();
  location.hash = '';
});

function settle(ms = 150) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function findByClass(node, className, out = []) {
  if (node.className && node.className.split(' ').includes(className)) out.push(node);
  for (const child of node.childNodes || []) findByClass(child, className, out);
  return out;
}

function findByTag(node, tag, out = []) {
  if (node.tagName === tag) out.push(node);
  for (const child of node.childNodes || []) findByTag(child, tag, out);
  return out;
}

test('with nothing saved, shows the generic "custom" labels and no Arsenal badge', async () => {
  const guns = gunsSummary();
  await settle();

  const [rifleLine] = findByClass(guns.node, 'rifle-line');
  assert.equal(rifleLine.textContent, t('guns.customRifleLabel'));
  assert.equal(findByClass(guns.node, 'src-badge').length, 0);
});

test('a saved built-in rifle+bullet resolves their real names, no Arsenal badge', async () => {
  saveRifleState({ library: { rifleId: 'k31', cartridgeId: 'x' } });
  saveCartridgeState({ muzzleVelocity: 807.72, bullet: { selectedId: 'swiss-gp11' } });

  const guns = gunsSummary();
  await settle();

  const [rifleLine] = findByClass(guns.node, 'rifle-line');
  assert.equal(rifleLine.textContent, 'K31');
  assert.equal(findByClass(guns.node, 'src-badge').length, 0);

  const [bulletLine] = findByClass(guns.node, 'bullet-line');
  assert.ok(bulletLine.textContent.includes('807.7'));
});

test('a saved user (Arsenal) rifle shows its name and the Arsenal badge', async () => {
  saveUserRifle({
    id: 'my-rifle', name: 'My Rifle',
    defaultSightHeightM: 0.05, defaultZeroRangeM: 100,
    defaultClickUnit: 'mrad', defaultClickHorizontal: 0.1, defaultClickVertical: 0.1,
    cartridges: []
  });
  saveRifleState({ library: { rifleId: 'my-rifle', cartridgeId: 'c1' } });

  const guns = gunsSummary();
  await settle();

  const [rifleLine] = findByClass(guns.node, 'rifle-line');
  assert.ok(rifleLine.textContent.includes('My Rifle'));
  const [badge] = findByClass(guns.node, 'src-badge');
  assert.ok(badge, 'expected the Arsenal badge for a user rifle');
  assert.equal(badge.textContent, t('guns.arsenalBadge'));
});

test('a saved user (Arsenal) bullet, with no library rifle, shows its name', async () => {
  saveUserBullet({
    id: 'my-bullet', name: 'My Bullet', manufacturer: 'Handload',
    caliberM: 0.0078232, massKg: 0.01, profile: { type: 'bc', bc: 0.45, model: 'G1' }
  });
  saveCartridgeState({ muzzleVelocity: 800, bullet: { selectedId: 'my-bullet' } });

  const guns = gunsSummary();
  await settle();

  const [bulletLine] = findByClass(guns.node, 'bullet-line');
  assert.ok(bulletLine.textContent.includes('My Bullet'));
});

test('Change opens Guns at the Custom tab when the rifle isn\'t a saved Arsenal rifle', async () => {
  saveRifleState({ library: { rifleId: 'k31', cartridgeId: 'x' } });
  const guns = gunsSummary();
  await settle();

  location.hash = '#/trajectory';
  const changeButton = findByTag(guns.node, 'BUTTON')[0];
  fireEvent(changeButton, 'click');

  assert.equal(location.hash, '#/guns/custom');
  assert.equal(takeGunsReturnPath('/fallback'), '/trajectory', 'Change should record where it was clicked from');
});

test('Change opens Guns at the Arsenal tab when the rifle is a saved Arsenal rifle', async () => {
  saveUserRifle({
    id: 'my-rifle', name: 'My Rifle',
    defaultSightHeightM: 0.05, defaultZeroRangeM: 100,
    defaultClickUnit: 'mrad', defaultClickHorizontal: 0.1, defaultClickVertical: 0.1,
    cartridges: []
  });
  saveRifleState({ library: { rifleId: 'my-rifle', cartridgeId: 'c1' } });
  const guns = gunsSummary();
  await settle();

  location.hash = '#/hit-probability';
  const changeButton = findByTag(guns.node, 'BUTTON')[0];
  fireEvent(changeButton, 'click');

  assert.equal(location.hash, '#/guns/arsenal');
});

test('a manually-entered ("Other") bullet with no muzzle velocity yet shows only the generic label', async () => {
  const guns = gunsSummary();
  await settle();
  const [bulletLine] = findByClass(guns.node, 'bullet-line');
  assert.equal(bulletLine.textContent, t('guns.customBulletLabel'));
});
