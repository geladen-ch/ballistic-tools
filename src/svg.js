// SVG-namespace counterpart to dom.js's el() — SVG elements have to come
// from document.createElementNS, not createElement, and their attributes
// (viewBox, d, cx, stroke-width, ...) don't have the JS-property shortcuts
// HTML elements do, so everything goes through setAttribute rather than
// el()'s className/textContent special-casing.
const SVG_NS = 'http://www.w3.org/2000/svg';

export function svgEl(tag, attrs = {}, children = []) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null) continue;
    node.setAttribute(key, value);
  }
  for (const child of children) node.appendChild(child);
  return node;
}
