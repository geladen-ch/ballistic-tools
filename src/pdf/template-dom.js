// DOM work on a parsed SVG template: string substitution, slot filling,
// and extracting the plain tree font-style.js resolves faces on. Browser
// only (DOMParser, live SVG elements).
import { replaceInText, translateText } from './text-replace.js';

export const SVG_NS = 'http://www.w3.org/2000/svg';

// Elements whose text the renderer never draws.
const NON_RENDERED = new Set(['title', 'desc', 'metadata']);

export function parseSvg(text, label) {
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  const root = doc.documentElement;
  if (doc.getElementsByTagName('parsererror').length || root.namespaceURI !== SVG_NS || root.localName !== 'svg') {
    throw new Error(`${label}: not a well-formed SVG document`);
  }
  return root;
}

function isTextElement(el) {
  return el && el.namespaceURI === SVG_NS && (el.localName === 'text' || el.localName === 'tspan');
}

// Translates the `{key}` tokens of every text node of every <text>/<tspan>
// (see translateText); returns the keys that found no translation.
export function applyTranslations(svg, translate, lang) {
  const missing = new Set();
  const walker = svg.ownerDocument.createTreeWalker(svg, 4 /* NodeFilter.SHOW_TEXT */);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!isTextElement(node.parentNode)) continue;
    const r = translateText(node.data, translate, lang);
    node.data = r.text;
    for (const key of r.missing) missing.add(key);
  }
  return missing;
}

// Applies the pairs to every text node of every <text>/<tspan>; returns
// the indices of the pairs that matched somewhere.
export function applyReplacements(svg, pairs) {
  const matched = new Set();
  if (!pairs.length) return matched;
  const walker = svg.ownerDocument.createTreeWalker(svg, 4 /* NodeFilter.SHOW_TEXT */);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!isTextElement(node.parentNode)) continue;
    const r = replaceInText(node.data, pairs);
    if (r.matched.size) {
      node.data = r.text;
      for (const i of r.matched) matched.add(i);
    }
  }
  return matched;
}

function numberAttr(el, name, fallback) {
  const raw = el.getAttribute(name);
  if (raw === null && fallback !== undefined) return fallback;
  const v = Number(raw);
  return raw !== null && raw.trim() !== '' && Number.isFinite(v) ? v : NaN;
}

function validViewBox(vb) {
  return Array.isArray(vb) && vb.length === 4 && vb.every(Number.isFinite) && vb[2] > 0 && vb[3] > 0;
}

// Puts generated content into the box of the <rect id="…">. 'fit' scales
// it uniformly to the largest size that fits and centres it (its extent is
// `viewBox`, in the content's own units); 'clip' keeps template units,
// starts at the box's top-left corner and clips at the box. Both are a
// nested <svg> viewport placed right after the rect, so ancestor
// transforms apply to it exactly as to the rect.
export function fillSlot(svg, { id, content, mode, viewBox }, label) {
  const where = `${label}: slot "${id}"`;
  const rect = svg.ownerDocument.getElementById(id);
  if (!rect || !svg.contains(rect)) throw new Error(`${where}: no element with this id`);
  if (rect.namespaceURI !== SVG_NS || rect.localName !== 'rect') throw new Error(`${where}: must be a <rect>, is <${rect.localName}>`);
  if (rect.hasAttribute('transform')) throw new Error(`${where}: the slot rect must not have its own transform`);
  const box = {
    x: numberAttr(rect, 'x', 0), y: numberAttr(rect, 'y', 0),
    width: numberAttr(rect, 'width'), height: numberAttr(rect, 'height')
  };
  if (!Object.values(box).every(Number.isFinite) || box.width <= 0 || box.height <= 0) {
    throw new Error(`${where}: x, y, width and height must be plain positive numbers in user units`);
  }
  const port = svg.ownerDocument.createElementNS(SVG_NS, 'svg');
  for (const [k, v] of Object.entries(box)) port.setAttribute(k, String(v));
  if (mode === 'fit') {
    if (!validViewBox(viewBox)) throw new Error(`${where}: 'fit' needs viewBox [x, y, width, height] with positive size`);
    port.setAttribute('viewBox', viewBox.join(' '));
    port.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  } else if (mode === 'clip') {
    if (viewBox !== undefined) throw new Error(`${where}: 'clip' places content 1:1 and takes no viewBox`);
  } else {
    throw new Error(`${where}: mode must be 'fit' or 'clip'`);
  }
  for (const node of contentNodes(content, svg.ownerDocument, where)) port.appendChild(node);
  rect.after(port);
}

function contentNodes(content, doc, where) {
  if (typeof content === 'string') {
    const wrapper = parseSvg(`<svg xmlns="${SVG_NS}">${content}</svg>`, `${where} content`);
    return [...wrapper.childNodes].map((n) => doc.importNode(n, true));
  }
  if (content && content.nodeType === 1) return [doc.importNode(content, true)];
  throw new Error(`${where}: content must be SVG markup or an SVG element`);
}

// Property as the renderer reads it: the style attribute's declaration
// first, then the presentation attribute; 'inherit' counts as unset.
function prop(el, name) {
  let v = null;
  const style = el.getAttribute('style');
  if (style) {
    for (const decl of style.split(';')) {
      const i = decl.indexOf(':');
      if (i > 0 && decl.slice(0, i).trim().toLowerCase() === name) v = decl.slice(i + 1).trim();
    }
  }
  if (v === null) v = el.getAttribute(name);
  return v === null || v.trim() === '' || v.trim() === 'inherit' ? null : v.trim();
}

// The plain tree font-style.js's resolveFaces() walks: per SVG element its
// raw font properties, its own non-empty text runs (text/tspan only), and
// a label for messages. Foreign-namespace and non-rendered elements are
// left out, as the renderer ignores them.
export function faceTree(el, label) {
  const id = el.getAttribute('id');
  const node = {
    label: `${label}: <${el.localName}${id ? ` id="${id}"` : ''}>`,
    fontFamily: prop(el, 'font-family'),
    fontWeight: prop(el, 'font-weight'),
    fontStyle: prop(el, 'font-style'),
    texts: [],
    children: []
  };
  const textual = isTextElement(el);
  for (const child of el.childNodes) {
    if (child.nodeType === 3 && textual) node.texts.push(child.data);
    if (child.nodeType === 1 && child.namespaceURI === SVG_NS && !NON_RENDERED.has(child.localName)) {
      node.children.push(faceTree(child, label));
    }
  }
  return node;
}
