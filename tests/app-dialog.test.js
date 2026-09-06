import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom, fireEvent, makeElement } from './helpers/fake-dom.js';

installFakeDom();

const { mountDialogRoot, showDialog, hideDialog } = await import('../src/ui/app-dialog.js');

function findByClass(node, cls, out = []) {
  if ((node.className || '').split(' ').includes(cls)) out.push(node);
  for (const child of node.childNodes || []) findByClass(child, cls, out);
  return out;
}

test('hidden until showDialog is called', () => {
  const root = makeElement('div');
  mountDialogRoot(root);
  const overlay = findByClass(root, 'app-dialog-overlay')[0];
  assert.equal(overlay.style.display, 'none');
});

test('showDialog renders the message and one button per entry, then shows the overlay', () => {
  const root = makeElement('div');
  mountDialogRoot(root);
  showDialog({
    message: 'Something happened.',
    buttons: [{ label: 'OK' }, { label: 'Cancel' }]
  });

  const overlay = findByClass(root, 'app-dialog-overlay')[0];
  assert.equal(overlay.style.display, '');
  const message = findByClass(root, 'app-dialog-message')[0];
  assert.equal(message.textContent, 'Something happened.');
  const buttons = findByClass(root, 'app-dialog-actions')[0].childNodes;
  assert.equal(buttons.length, 2);
  assert.equal(buttons[0].textContent, 'OK');
  assert.equal(buttons[0].className, ''); // primary, unstyled
  assert.equal(buttons[1].textContent, 'Cancel');
  assert.equal(buttons[1].className, 'secondary');
});

test('clicking a button hides the dialog and fires only that button\'s onClick', () => {
  const root = makeElement('div');
  mountDialogRoot(root);
  const clicked = [];
  showDialog({
    message: 'Pick one.',
    buttons: [
      { label: 'A', onClick: () => clicked.push('A') },
      { label: 'B', onClick: () => clicked.push('B') }
    ]
  });

  const actions = findByClass(root, 'app-dialog-actions')[0];
  fireEvent(actions.childNodes[1], 'click'); // click "B"

  assert.deepEqual(clicked, ['B']);
  const overlay = findByClass(root, 'app-dialog-overlay')[0];
  assert.equal(overlay.style.display, 'none');
});

test('a button with no onClick just closes the dialog without throwing', () => {
  const root = makeElement('div');
  mountDialogRoot(root);
  showDialog({ message: 'FYI.', buttons: [{ label: 'OK' }] });

  const actions = findByClass(root, 'app-dialog-actions')[0];
  assert.doesNotThrow(() => fireEvent(actions.childNodes[0], 'click'));
  const overlay = findByClass(root, 'app-dialog-overlay')[0];
  assert.equal(overlay.style.display, 'none');
});

test('calling showDialog again replaces the previous message/buttons', () => {
  const root = makeElement('div');
  mountDialogRoot(root);
  showDialog({ message: 'First', buttons: [{ label: 'X' }] });
  showDialog({ message: 'Second', buttons: [{ label: 'Y' }, { label: 'Z' }] });

  const message = findByClass(root, 'app-dialog-message')[0];
  assert.equal(message.textContent, 'Second');
  const actions = findByClass(root, 'app-dialog-actions')[0];
  assert.equal(actions.childNodes.length, 2);
});

test('a bodyNode renders in place of a plain message, and wide toggles the modifier class', () => {
  const root = makeElement('div');
  mountDialogRoot(root);
  const body = makeElement('div');
  body.className = 'my-picker-body';
  showDialog({ bodyNode: body, buttons: [{ label: 'Cancel' }], wide: true });

  assert.equal(findByClass(root, 'app-dialog-message').length, 0);
  assert.equal(findByClass(root, 'my-picker-body').length, 1);
  const card = findByClass(root, 'app-dialog-card')[0];
  assert.ok(card.className.split(' ').includes('app-dialog-card-wide'));

  // A later plain-message dialog drops the wide modifier again.
  showDialog({ message: 'Back to normal', buttons: [{ label: 'OK' }] });
  assert.ok(!card.className.split(' ').includes('app-dialog-card-wide'));
});

test('hideDialog() hides the overlay from a bodyNode\'s own row click handler', () => {
  const root = makeElement('div');
  mountDialogRoot(root);
  const body = makeElement('div');
  const row = makeElement('div');
  let picked = false;
  row.addEventListener('click', () => {
    hideDialog();
    picked = true;
  });
  body.appendChild(row);
  showDialog({ bodyNode: body, buttons: [{ label: 'Cancel' }] });

  fireEvent(row, 'click');

  assert.ok(picked);
  const overlay = findByClass(root, 'app-dialog-overlay')[0];
  assert.equal(overlay.style.display, 'none');
});
