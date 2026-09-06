import { el, clear } from '../dom.js';

// The app's one and only true modal overlay — everything else that looks
// like a "dialog" elsewhere (export-dialog.js, import-dialog.js) is an
// inline page panel, not an overlay. Originally just update-notifications.js's
// two plain message+buttons dialogs; also used by the Arsenal <-> Rifle
// Precision picker modals (rifle-cartridge-picker.js and the Arsenal
// cartridge form's own "pick a project" flow), which need a richer body
// than a single string — see `bodyNode` below.
//
// mountDialogRoot() builds the hidden skeleton once, into a container
// that already exists in index.html (#app-dialog, a sibling of #app-shell
// so its fixed positioning isn't affected by that container's own
// layout). showDialog() is the only thing callers use afterward.
let overlay = null;
let bodyEl = null;
let actionsEl = null;
let card = null;

export function mountDialogRoot(container) {
  bodyEl = el('div', { class: 'app-dialog-body' });
  actionsEl = el('div', { class: 'app-dialog-actions' });
  card = el('div', { class: 'app-dialog-card' }, [bodyEl, actionsEl]);
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
// Escape key): a choice is the only thing that closes it. A picker body
// (bodyNode) is expected to close the dialog itself on a row pick — see
// hideDialog() below — since that's a third way out beyond either button,
// not something this generic shell can wire up on its own.
//
// `message` (a plain string, wrapped in a <p>) and `bodyNode` (a fully
// caller-built DOM node, e.g. a scrollable list of rows) are mutually
// exclusive — pass exactly one. `wide: true` widens/heightens the card for
// list content; plain message dialogs never need it.
export function showDialog({ message, bodyNode, buttons, wide = false }) {
  clear(bodyEl);
  bodyEl.appendChild(bodyNode || el('p', { class: 'app-dialog-message', text: message }));
  clear(actionsEl);
  buttons.forEach(({ label, onClick }, i) => {
    const button = el('button', { class: i === 0 ? '' : 'secondary', text: label });
    button.addEventListener('click', () => {
      hide();
      if (onClick) onClick();
    });
    actionsEl.appendChild(button);
  });
  card.classList.toggle('app-dialog-card-wide', wide);
  overlay.style.display = '';
}

// For a bodyNode's own row click handlers (see rifle-cartridge-picker.js)
// — picking a row is a third way to close the dialog, alongside its two
// buttons, and unlike those it also needs to run its own onPick logic
// first rather than a plain onClick already wired by showDialog() above.
export function hideDialog() {
  hide();
}
