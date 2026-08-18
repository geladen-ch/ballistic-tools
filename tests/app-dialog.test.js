import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom, fireEvent, makeElement } from './helpers/fake-dom.js';

installFakeDom();

const { mountDialogRoot, showDialog } = await import('../src/ui/app-dialog.js');

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
