// A small, unobtrusive icon-only button for a "copy to clipboard" action
// — same quiet treatment as download-button.js's icon button, next to
// which this is meant to sit. Swaps to a brief checkmark once the copy
// actually resolves: unlike a file download, which visibly happens in
// the browser's own UI, there's no native affordance for "the clipboard
// write succeeded," so this button has to say so itself.
import { el, clear } from '../dom.js';
import { svgEl } from '../svg.js';

const LINE = { fill: 'none', stroke: 'currentColor', 'stroke-width': '1.6', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
const CONFIRMATION_MS = 1400;

function copyIcon(size = 16) {
  return svgEl('svg', { viewBox: '0 0 20 20', width: size, height: size, ...LINE }, [
    svgEl('rect', { x: '3.5', y: '3.5', width: '10', height: '10', rx: '1.5' }),
    svgEl('rect', { x: '7.5', y: '7.5', width: '9', height: '9', rx: '1.5' })
  ]);
}

function checkIcon(size = 16) {
  return svgEl('svg', { viewBox: '0 0 20 20', width: size, height: size, ...LINE }, [
    svgEl('path', { d: 'M4 10.5 8 14.5 16 5.5' })
  ]);
}

// `getText` is called fresh on every click (not read once at construction)
// so it always copies whatever the table currently shows, same convention
// as download-button.js's own onClick.
export function copyButton({ label, copiedLabel, getText }) {
  const button = el('button', { type: 'button', class: 'icon-button', title: label, 'aria-label': label }, [copyIcon()]);
  let resetTimer = null;

  function setState(iconFn, text) {
    clear(button);
    button.appendChild(iconFn());
    button.title = text;
    button.setAttribute('aria-label', text);
  }

  button.addEventListener('click', () => {
    navigator.clipboard.writeText(getText()).then(() => {
      setState(checkIcon, copiedLabel);
      clearTimeout(resetTimer);
      resetTimer = setTimeout(() => setState(copyIcon, label), CONFIRMATION_MS);
    }).catch(() => {
      // Clipboard access denied or unavailable (insecure context, missing
      // permission, ...) — nothing sensible to fall back to here; the
      // download button next to this one is the reliable alternative.
    });
  });

  return button;
}
