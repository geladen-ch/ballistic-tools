import { el, clear } from '../dom.js';

// The app's one and only true modal overlay — everything else that looks
// like a "dialog" elsewhere (export-dialog.js, import-dialog.js) is an
// inline page panel, not an overlay. Used for update-notifications.js's
// two dialogs; deliberately generic (message + a list of buttons) rather
// than baking in anything update-specific here.
//
// mountDialogRoot() builds the hidden skeleton once, into a container
// that already exists in index.html (#app-dialog, a sibling of #app-shell
// so its fixed positioning isn't affected by that container's own
// layout). showDialog() is the only thing callers use afterward.
let overlay = null;
let messageEl = null;
let actionsEl = null;

export function mountDialogRoot(container) {
  messageEl = el('p', { class: 'app-dialog-message' });
  actionsEl = el('div', { class: 'app-dialog-actions' });
  const card = el('div', { class: 'app-dialog-card' }, [messageEl, actionsEl]);
  overlay = el('div', { class: 'app-dialog-overlay' }, [card]);
  overlay.style.display = 'none';
  clear(container);
  container.appendChild(overlay);
}

function hide() {
  overlay.style.display = 'none';
}

// `buttons`: [{ label, onClick }, ...] — the first is styled as the
// primary action (a plain `button`), the rest `.secondary`, same
// convention every existing form's save/cancel pair already uses.
// Clicking any of them hides the dialog and then calls that button's own
// onClick — there's no other way to dismiss it (no backdrop click, no
// Escape key): a choice is the only thing that closes it.
export function showDialog({ message, buttons }) {
  messageEl.textContent = message;
  clear(actionsEl);
  buttons.forEach(({ label, onClick }, i) => {
    const button = el('button', { class: i === 0 ? '' : 'secondary', text: label });
    button.addEventListener('click', () => {
      hide();
      if (onClick) onClick();
    });
    actionsEl.appendChild(button);
  });
  overlay.style.display = '';
}
