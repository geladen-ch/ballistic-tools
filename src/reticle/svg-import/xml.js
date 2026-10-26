// A deliberately small XML parser for the SVG importer — just enough to
// read an SVG file's element tree, and nothing that can expand or fetch.
// It runs inside a Web Worker, where the browser's DOMParser isn't
// available. Pure; throws ImportError on anything it doesn't accept.
//
// Accepted: elements, attributes (single or double quoted), text, CDATA
// (as text), comments and processing instructions (skipped), and the five
// predefined entities plus numeric character references. Refused outright:
// any DOCTYPE or ENTITY declaration — that is what makes entity-expansion
// ("billion laughs") and external-entity tricks impossible — and any
// mismatched or unclosed tag.
//
// Node shape: { name, attrs: { [name]: value }, children: [node | string] }.
// Namespace prefixes are kept in names ('xlink:href'); the importer
// decides what they mean.
import { ImportError } from './errors.js';

const NAMED = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };
const NAME_START = /[A-Za-z_:]/;
const NAME_CHAR = /[A-Za-z0-9_:.-]/;

function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[A-Za-z]+);/g, (whole, ref) => {
    if (ref[0] === '#') {
      const code = ref[1] === 'x' ? parseInt(ref.slice(2), 16) : parseInt(ref.slice(1), 10);
      if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) throw new ImportError('malformedXml');
      return String.fromCodePoint(code);
    }
    if (!(ref in NAMED)) throw new ImportError('malformedXml');
    return NAMED[ref];
  });
}

// `maxElements` / `maxDepth`: refused beyond that many elements or that
// deep a nesting.
export function parseXml(text, { maxElements = Infinity, maxDepth = Infinity } = {}) {
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw new ImportError('doctype');
  let i = 0;
  let count = 0;
  const root = { name: '#document', attrs: {}, children: [] };
  const stack = [root];
  const n = text.length;

  function readName() {
    if (!NAME_START.test(text[i] || '')) throw new ImportError('malformedXml');
    const start = i;
    while (i < n && NAME_CHAR.test(text[i])) i++;
    return text.slice(start, i);
  }
  function skipSpace() {
    while (i < n && /\s/.test(text[i])) i++;
  }
  function skipPast(marker) {
    const at = text.indexOf(marker, i);
    if (at < 0) throw new ImportError('malformedXml');
    const body = text.slice(i, at);
    i = at + marker.length;
    return body;
  }

  while (i < n) {
    if (text[i] !== '<') {
      const at = text.indexOf('<', i);
      const end = at < 0 ? n : at;
      const raw = text.slice(i, end);
      if (raw.trim()) stack[stack.length - 1].children.push(decodeEntities(raw));
      i = end;
      continue;
    }
    if (text.startsWith('<!--', i)) { i += 4; skipPast('-->'); continue; }
    if (text.startsWith('<![CDATA[', i)) { i += 9; stack[stack.length - 1].children.push(skipPast(']]>')); continue; }
    if (text.startsWith('<?', i)) { i += 2; skipPast('?>'); continue; }
    if (text.startsWith('<!', i)) throw new ImportError('malformedXml');
    if (text[i + 1] === '/') {
      i += 2;
      const name = readName();
      skipSpace();
      if (text[i] !== '>') throw new ImportError('malformedXml');
      i++;
      const open = stack.pop();
      if (!open || open === root || open.name !== name) throw new ImportError('malformedXml');
      continue;
    }
    i++;
    const node = { name: readName(), attrs: {}, children: [] };
    count++;
    if (count > maxElements) throw new ImportError('tooManyElements');
    for (;;) {
      skipSpace();
      if (text[i] === '/' && text[i + 1] === '>') { i += 2; stack[stack.length - 1].children.push(node); break; }
      if (text[i] === '>') {
        i++;
        stack[stack.length - 1].children.push(node);
        stack.push(node);
        if (stack.length - 1 > maxDepth) throw new ImportError('tooDeep');
        break;
      }
      if (i >= n) throw new ImportError('malformedXml');
      const attr = readName();
      skipSpace();
      if (text[i] !== '=') throw new ImportError('malformedXml');
      i++;
      skipSpace();
      const quote = text[i];
      if (quote !== '"' && quote !== "'") throw new ImportError('malformedXml');
      i++;
      const value = skipPast(quote);
      if (value.includes('<')) throw new ImportError('malformedXml');
      if (Object.prototype.hasOwnProperty.call(node.attrs, attr)) throw new ImportError('malformedXml');
      node.attrs[attr] = decodeEntities(value);
    }
  }
  if (stack.length !== 1) throw new ImportError('malformedXml');
  const elements = root.children.filter((c) => typeof c !== 'string');
  if (elements.length !== 1) throw new ImportError('malformedXml');
  return elements[0];
}
