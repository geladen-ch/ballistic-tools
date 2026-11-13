import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom, installFakeIndexedDb, fireEvent, makeElement } from './helpers/fake-dom.js';
import { degToRad } from '../src/quantity.js';

installFakeDom();
installFakeIndexedDb();

const { initI18n, t } = await import('../src/i18n.js');
await initI18n();
const { fireConfigBody, openFireConfigDialog, setFirePaneContext } = await import('../src/ui/range-solver/fire-config-dialog.js');
const { getFireConfig, setFireConfig, resetFireConfigForTests } = await import('../src/range-solver-fire-config.js');
const { mountDialogRoot, isDialogOpen } = await import('../src/ui/app-dialog.js');
const { removeCookie } = await import('../src/cookies.js');
const { getRangeSolverTab, setRangeSolverTab, resetRangeSolverNavForTests } = await import('../src/range-solver-nav.js');

function findAll(node, pred, out = []) {
  if (pred(node)) out.push(node);
  for (const child of node.childNodes || []) findAll(child, pred, out);
  return out;
}
const byClass = (root, cls) => findAll(root, (n) => typeof n.className === 'string' && n.className.split(' ').includes(cls));
const byId = (root, id) => findAll(root, (n) => n.id === id)[0];

const PHOTO = 'data:image/jpeg;base64,AAA';
const loc = (photo, deg = 1) => ({ id: 'l', name: 'Range', photo, targets: [{ id: 't', rangeM: 300, losAngleRad: degToRad(deg) }] });
const context = (over = {}) => ({ location: loc(PHOTO), hasOptic: true, orientation: 'portrait', pane: { width: 366, height: 758 }, vmin: 390, ...over });
const draftAll = () => ({ scope: true, readout: true, list: true, picker: true, listRowsOptimal: true, ignoreLos: false, listRows: 6 });

test.beforeEach(() => {
  resetFireConfigForTests();
  resetRangeSolverNavForTests();
  for (const name of ['ballistics_range_solver_fire_config_v1', 'ballistics_range_solver_scope_view_v1', 'ballistics_range_card_row_count_v1']) removeCookie(name);
});

test('optional elements get a switch and an "Optional" tag; fixed ones do not', () => {
  const body = fireConfigBody({ draft: draftAll(), context: context() });
  const optional = byClass(body.node, 'optional');
  assert.deepEqual(optional.map((b) => b.id).sort(), ['fireConfigBox-list', 'fireConfigBox-picker', 'fireConfigBox-readout', 'fireConfigBox-scope']);
  for (const b of optional) assert.equal(byClass(b, 'fire-config-switch').length, 1);
  const fixed = byClass(body.node, 'fire-config-box').filter((b) => !b.className.includes('optional'));
  assert.equal(fixed.length, 5, 'gun, context, flight, manual, wind');
  for (const b of fixed) assert.equal(byClass(b, 'fire-config-switch').length, 0);
  assert.equal(byClass(body.node, 'fire-config-chip').length, 0, 'nothing hidden');
});

test('tapping a box switches its element off: it leaves the preview for the "Not shown" tray', () => {
  const draft = draftAll();
  const body = fireConfigBody({ draft, context: context() });
  fireEvent(byId(body.node, 'fireConfigBox-picker'), 'click');
  assert.equal(draft.picker, false);
  assert.equal(byId(body.node, 'fireConfigBox-picker'), undefined);
  const chip = byId(body.node, 'fireConfigChip-picker');
  assert.ok(chip);
  assert.equal(chip.getAttribute('aria-pressed'), 'false');
  assert.ok(chip.textContent.includes(t('rangeSolver.fireConfig.off')));
  fireEvent(chip, 'click');
  assert.equal(draft.picker, true);
  assert.ok(byId(body.node, 'fireConfigBox-picker'));
});

test('each hint appears in its case', () => {
  const chipText = (ctx, id, draft = draftAll()) => byId(fireConfigBody({ draft, context: context(ctx) }).node, `fireConfigChip-${id}`)?.textContent || '';
  assert.ok(chipText({ hasOptic: false }, 'scope').includes(t('rangeSolver.fireConfig.hints.noOptic')));
  assert.ok(chipText({ location: null }, 'list').includes(t('rangeSolver.fireConfig.hints.noLocation')));
  assert.ok(chipText({ location: null }, 'picker').includes(t('rangeSolver.fireConfig.hints.noLocation')));
  assert.ok(chipText({ location: loc(null) }, 'picker').includes(t('rangeSolver.fireConfig.hints.noPhoto')));
  assert.ok(chipText({}, 'readout', { ...draftAll(), readout: false }).includes(t('rangeSolver.fireConfig.hints.readoutOff')));
  const noOptic = byId(fireConfigBody({ draft: draftAll(), context: context({ hasOptic: false }) }).node, 'fireConfigChip-scope');
  assert.equal(noOptic.getAttribute('aria-pressed'), 'true', 'switched on but without effect: stays on');
});

test('the row stepper is disabled under Optimal fit, works without it, and the group dims without a list', () => {
  const draft = { ...draftAll(), listRowsOptimal: false };
  const body = fireConfigBody({ draft, context: context() });
  fireEvent(byId(body.node, 'fireConfigRowsMore'), 'click');
  assert.equal(draft.listRows, 7);
  fireEvent(byId(body.node, 'fireConfigOptimal'), 'change', { target: { checked: true } });
  const optimal = byId(body.node, 'fireConfigOptimal');
  optimal.checked = true;
  fireEvent(optimal, 'change');
  assert.equal(draft.listRowsOptimal, true);
  assert.equal(byId(body.node, 'fireConfigRowsMore').disabled, true);

  const noList = fireConfigBody({ draft: draftAll(), context: context({ location: null }) });
  assert.ok(byClass(noList.node, 'fire-config-group')[0].className.includes('off'));
  assert.equal(byId(noList.node, 'fireConfigOptimal').disabled, true);
});

test('Ignore LoS is disabled with its reason when a target is at 5° or more', () => {
  const ok = fireConfigBody({ draft: draftAll(), context: context({ location: loc(PHOTO, 4.99) }) });
  assert.equal(byId(ok.node, 'fireConfigIgnoreLos').disabled, false);
  const blocked = fireConfigBody({ draft: { ...draftAll(), ignoreLos: true }, context: context({ location: loc(PHOTO, -5) }) });
  const box = byId(blocked.node, 'fireConfigIgnoreLos');
  assert.equal(box.disabled, true);
  assert.equal(box.checked, false);
  assert.ok(blocked.node.textContent.includes(t('rangeSolver.fireConfig.losBlockedHint')));
});

test('the landscape preview lays the elements out as the landscape layout does', () => {
  const body = fireConfigBody({ draft: draftAll(), context: context({ orientation: 'landscape', pane: { width: 756, height: 366 } }) });
  assert.equal(byClass(body.node, 'fire-grid-wrap').length, 1, 'wrapping columns');
});

test('OK saves the draft and switches to Fire!; Cancel saves nothing', () => {
  const dialogContainer = makeElement('div');
  mountDialogRoot(dialogContainer);
  setFirePaneContext({ hasOptic: true, paneNode: null });
  setRangeSolverTab('atmosphere');

  openFireConfigDialog();
  assert.equal(isDialogOpen(), true);
  fireEvent(byId(dialogContainer, 'fireConfigBox-readout'), 'click');
  const [okButton, cancelButton] = findAll(dialogContainer, (n) => n.tagName === 'BUTTON' && n.parentNode && n.parentNode.className === 'app-dialog-actions');
  fireEvent(cancelButton, 'click');
  assert.equal(isDialogOpen(), false);
  assert.equal(getFireConfig().readout, true, 'Cancel discards');
  assert.equal(getRangeSolverTab(), 'atmosphere');

  openFireConfigDialog();
  fireEvent(byId(dialogContainer, 'fireConfigBox-readout'), 'click');
  const [ok2] = findAll(dialogContainer, (n) => n.tagName === 'BUTTON' && n.parentNode && n.parentNode.className === 'app-dialog-actions');
  fireEvent(ok2, 'click');
  assert.equal(getFireConfig().readout, false, 'OK saves');
  assert.equal(getRangeSolverTab(), 'fire');
  assert.ok(okButton);
});
