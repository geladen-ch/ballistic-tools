// Minimal DOM-construction helper — no framework, just enough sugar to
// build views without hand-writing innerHTML strings everywhere.
import { applyI18nText } from './i18n.js';

export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value === undefined || value === null) continue; // omit, don't stringify to "undefined"/"null"
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'html') node.innerHTML = value;
    // Sole-content translatable element: sets data-i18n + a derived id +
    // the current translation in one step. For text mixed with other
    // children (e.g. a <label> that also holds an input), use i18nSpan()
    // from i18n.js instead so the translation owns just its own node.
    else if (key === 'i18n') applyI18nText(node, value);
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2).toLowerCase(), value);
    else node.setAttribute(key, value);
  }
  for (const child of [].concat(children)) {
    if (child === undefined || child === null || child === false) continue;
    node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}
