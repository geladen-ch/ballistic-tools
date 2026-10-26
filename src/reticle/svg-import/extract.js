// SVG text → the Reticle Designer's own shape data. Nothing of the input
// is kept but the geometry: every visible fill or stroke becomes a path of
// absolute M/L/Q/C/Z commands in the SVG's user units (origin and y-down
// orientation as in the file), with its fill rule and stroke width. No
// markup, style, script, link or metadata survives, so the result is safe
// to draw whatever the input was. Pure; runs inside the import worker.
//
// Throws ImportError (a reason code) on anything refused: too large, too
// complex, malformed, text that would go missing, or an empty drawing.
// Never returns a partial import.
//
// Shape: {
//   paths: [{ d, fill: bool, fillRule: 'nonzero' | 'evenodd',
//             stroke: width (0 = none), cap, join, miter }],
//   bounds: [x0, y0, x1, y1] (ink extents, user units, strokes included),
//   segments: total path commands,
//   warnings: [codes] — parts drawn differently from the original (clips,
//             dashes and markers ignored, embedded images left out)
// }
import { degToRad } from '../../quantity.js';
import { ImportError } from './errors.js';
import { parseXml } from './xml.js';
import {
  IDENTITY, MAX_COORDINATE, multiply, parsePathData, transformCommands, formatCommands, flattenCommands, inkBounds
} from './path-data.js';

export const LIMITS = {
  maxChars: 2000000,
  maxElements: 5000,
  maxDepth: 32,
  maxSegments: 100000,
  maxUses: 1000
};

const CAPS = ['butt', 'round', 'square'];
const JOINS = ['miter', 'round', 'bevel'];
const FILL_RULES = ['nonzero', 'evenodd'];
const DEFAULT_MITER = 4;

const SHAPES = new Set(['path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon']);
const CONTAINERS = new Set(['svg', 'g', 'a', 'switch']);
const TEXT = new Set(['text', 'tspan', 'textPath']);

const INHERITED = [
  'fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-linecap',
  'stroke-linejoin', 'stroke-miterlimit', 'visibility', 'stroke-dasharray', 'marker-start', 'marker-mid', 'marker-end'
];
const PROPERTIES = new Set([...INHERITED, 'opacity', 'display', 'clip-path', 'mask']);
const INITIAL_STYLE = {
  fill: 'black', 'fill-opacity': '1', 'fill-rule': 'nonzero', stroke: 'none', 'stroke-width': '1',
  'stroke-opacity': '1', 'stroke-linecap': 'butt', 'stroke-linejoin': 'miter', 'stroke-miterlimit': String(DEFAULT_MITER),
  visibility: 'visible', 'stroke-dasharray': 'none', 'marker-start': 'none', 'marker-mid': 'none', 'marker-end': 'none'
};

// Element name without a namespace prefix; null for a foreign namespace
// (inkscape:, sodipodi:, ...), which is ignored.
function localName(name) {
  const at = name.indexOf(':');
  if (at < 0) return name;
  return name.slice(0, at) === 'svg' ? name.slice(at + 1) : null;
}

function parseLength(value, fallback = 0) {
  if (value === undefined || value === null || value === '') return fallback;
  const m = /^\s*([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)(px)?\s*$/.exec(String(value));
  if (!m) throw new ImportError('unsupportedUnit', { value: String(value).slice(0, 20) });
  const v = Number(m[1]);
  if (!Number.isFinite(v) || Math.abs(v) > MAX_COORDINATE) throw new ImportError('badNumber');
  return v;
}

function parseOpacity(value) {
  const text = String(value ?? '1').trim();
  const v = text.endsWith('%') ? Number(text.slice(0, -1)) / 100 : Number(text);
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 1;
}

function parseNumberList(text) {
  const out = [];
  const re = /[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g;
  const rest = String(text || '').replace(re, (m) => {
    const v = Number(m);
    if (!Number.isFinite(v) || Math.abs(v) > MAX_COORDINATE) throw new ImportError('badNumber');
    out.push(v);
    return ' ';
  });
  if (/[^\s,]/.test(rest)) throw new ImportError('badNumber');
  return out;
}

export function parseTransform(text) {
  let m = IDENTITY;
  if (!text) return m;
  const re = /\s*(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)\s*,?/gy;
  let at = 0;
  let match;
  const source = String(text);
  while (at < source.length && (re.lastIndex = at, match = re.exec(source))) {
    at = re.lastIndex;
    const a = parseNumberList(match[2]);
    let t;
    switch (match[1]) {
      case 'matrix':
        if (a.length !== 6) throw new ImportError('badTransform');
        t = a;
        break;
      case 'translate':
        if (a.length < 1 || a.length > 2) throw new ImportError('badTransform');
        t = [1, 0, 0, 1, a[0], a[1] ?? 0];
        break;
      case 'scale':
        if (a.length < 1 || a.length > 2) throw new ImportError('badTransform');
        t = [a[0], 0, 0, a[1] ?? a[0], 0, 0];
        break;
      case 'rotate': {
        if (a.length !== 1 && a.length !== 3) throw new ImportError('badTransform');
        const r = degToRad(a[0]);
        const rot = [Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r), 0, 0];
        t = a.length === 3 ? multiply(multiply([1, 0, 0, 1, a[1], a[2]], rot), [1, 0, 0, 1, -a[1], -a[2]]) : rot;
        break;
      }
      case 'skewX':
        if (a.length !== 1) throw new ImportError('badTransform');
        t = [1, 0, Math.tan(degToRad(a[0])), 1, 0, 0];
        break;
      default:
        if (a.length !== 1) throw new ImportError('badTransform');
        t = [1, Math.tan(degToRad(a[0])), 0, 1, 0, 0];
    }
    m = multiply(m, t);
  }
  if (source.slice(at).trim()) throw new ImportError('badTransform');
  if (!m.every(Number.isFinite)) throw new ImportError('badTransform');
  return m;
}

function parseDeclarations(text) {
  const out = {};
  for (const part of String(text || '').split(';')) {
    const at = part.indexOf(':');
    if (at < 0) continue;
    const key = part.slice(0, at).trim().toLowerCase();
    const value = part.slice(at + 1).replace(/!important/i, '').trim();
    if (PROPERTIES.has(key) && value) out[key] = value;
  }
  return out;
}

// `<style>` sheets, read only for the properties above and only for simple
// selectors: `*`, `tag`, `.class`, `#id`, `tag.class`. Anything else
// (combinators, pseudo-classes, @-rules) is ignored.
function parseStyleSheet(css) {
  const rules = [];
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
  let order = 0;
  for (const chunk of text.split('}')) {
    const brace = chunk.indexOf('{');
    if (brace < 0) continue;
    const selectorText = chunk.slice(0, brace).trim();
    if (!selectorText || selectorText.startsWith('@') || selectorText.includes('{')) continue;
    const decls = parseDeclarations(chunk.slice(brace + 1));
    if (Object.keys(decls).length === 0) continue;
    for (const raw of selectorText.split(',')) {
      const sel = raw.trim();
      const m = /^(\*|[A-Za-z][\w-]*)?(?:\.([\w-]+))?(?:#([\w-]+))?$/.exec(sel);
      if (!m || !sel) continue;
      const [, tag, cls, id] = m;
      const specificity = (id ? 100 : 0) + (cls ? 10 : 0) + (tag && tag !== '*' ? 1 : 0);
      rules.push({ tag: tag && tag !== '*' ? tag : null, cls, id, specificity, order: order++, decls });
    }
  }
  return rules.sort((a, b) => a.specificity - b.specificity || a.order - b.order);
}

function ruleMatches(rule, name, attrs) {
  if (rule.tag && rule.tag !== name) return false;
  if (rule.id && attrs.id !== rule.id) return false;
  if (rule.cls && !String(attrs.class || '').split(/\s+/).includes(rule.cls)) return false;
  return true;
}

function collect(node, visit) {
  visit(node);
  for (const child of node.children) if (typeof child !== 'string') collect(child, visit);
}

const isNone = (paint) => paint === 'none' || paint === 'transparent';

// One shape element → absolute commands in its own user space.
function shapeCommands(name, attrs, budget) {
  const len = (key) => parseLength(attrs[key]);
  switch (name) {
    case 'path':
      return attrs.d ? parsePathData(attrs.d, budget) : [];
    case 'rect': {
      const x = len('x'), y = len('y'), w = len('width'), h = len('height');
      if (!(w > 0 && h > 0)) return [];
      let rx = attrs.rx !== undefined ? len('rx') : null;
      let ry = attrs.ry !== undefined ? len('ry') : null;
      if (rx === null) rx = ry ?? 0;
      if (ry === null) ry = rx;
      rx = Math.min(Math.max(rx, 0), w / 2);
      ry = Math.min(Math.max(ry, 0), h / 2);
      if (rx === 0 || ry === 0) return parsePathData(`M${x} ${y}H${x + w}V${y + h}H${x}Z`, budget);
      return parsePathData(
        `M${x + rx} ${y}H${x + w - rx}A${rx} ${ry} 0 0 1 ${x + w} ${y + ry}V${y + h - ry}A${rx} ${ry} 0 0 1 ${x + w - rx} ${y + h}`
        + `H${x + rx}A${rx} ${ry} 0 0 1 ${x} ${y + h - ry}V${y + ry}A${rx} ${ry} 0 0 1 ${x + rx} ${y}Z`, budget);
    }
    case 'circle':
    case 'ellipse': {
      const cx = len('cx'), cy = len('cy');
      const rx = name === 'circle' ? len('r') : len('rx');
      const ry = name === 'circle' ? rx : len('ry');
      if (!(rx > 0 && ry > 0)) return [];
      return parsePathData(`M${cx - rx} ${cy}A${rx} ${ry} 0 1 0 ${cx + rx} ${cy}A${rx} ${ry} 0 1 0 ${cx - rx} ${cy}Z`, budget);
    }
    case 'line':
      return parsePathData(`M${len('x1')} ${len('y1')}L${len('x2')} ${len('y2')}`, budget);
    case 'polyline':
    case 'polygon': {
      const pts = parseNumberList(attrs.points);
      if (pts.length % 2 !== 0) throw new ImportError('badPathData');
      if (pts.length < 4) return [];
      let d = `M${pts[0]} ${pts[1]}`;
      for (let k = 2; k < pts.length; k += 2) d += `L${pts[k]} ${pts[k + 1]}`;
      return parsePathData(name === 'polygon' ? `${d}Z` : d, budget);
    }
    default:
      return [];
  }
}

export function extractShape(text) {
  if (typeof text !== 'string' || !text.trim()) throw new ImportError('empty');
  if (text.length > LIMITS.maxChars) throw new ImportError('tooLarge', { limit: LIMITS.maxChars });
  const root = parseXml(text, { maxElements: LIMITS.maxElements, maxDepth: LIMITS.maxDepth });
  if (localName(root.name) !== 'svg') throw new ImportError('notSvg');

  const ids = new Map();
  let css = '';
  collect(root, (node) => {
    const name = localName(node.name);
    if (name && TEXT.has(name)) throw new ImportError('text');
    if (node.attrs.id && !ids.has(node.attrs.id)) ids.set(node.attrs.id, node);
    if (name === 'style') css += node.children.filter((c) => typeof c === 'string').join('');
  });
  const rules = css ? parseStyleSheet(css) : [];

  const budget = { segments: LIMITS.maxSegments };
  let uses = 0;
  const warnings = new Set();
  const paths = [];
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;

  function computeStyle(name, attrs, parent) {
    const style = {};
    for (const key of INHERITED) style[key] = parent[key];
    style.opacity = parent.opacity;
    const own = {};
    for (const key of PROPERTIES) if (attrs[key] !== undefined) own[key] = String(attrs[key]).trim();
    for (const rule of rules) if (ruleMatches(rule, name, attrs)) Object.assign(own, rule.decls);
    Object.assign(own, parseDeclarations(attrs.style));
    for (const [key, value] of Object.entries(own)) {
      if (value === 'inherit') continue;
      if (key === 'opacity') style.opacity = parent.opacity * parseOpacity(value);
      else style[key] = value;
    }
    return style;
  }

  // `area`: false for a <line>, which encloses nothing — only its stroke
  // can be ink.
  function addPath(commands, style, matrix, area = true) {
    if (commands.length === 0) return;
    const fill = area && !isNone(style.fill) && parseOpacity(style['fill-opacity']) > 0;
    const strokeWidth = isNone(style.stroke) || parseOpacity(style['stroke-opacity']) === 0 ? 0 : parseLength(style['stroke-width'], 1);
    if (!fill && !(strokeWidth > 0)) return;
    if (style['stroke-dasharray'] && style['stroke-dasharray'] !== 'none' && strokeWidth > 0) warnings.add('dashes');
    if (['marker-start', 'marker-mid', 'marker-end'].some((k) => style[k] && style[k] !== 'none')) warnings.add('markers');
    const transformed = transformCommands(commands, matrix);
    // A stroke's width under a transform: scaled by the transform's mean
    // linear scale (exact for uniform scaling and rotation).
    const stroke = strokeWidth > 0 ? strokeWidth * Math.sqrt(Math.abs(matrix[0] * matrix[3] - matrix[1] * matrix[2])) : 0;
    if (!Number.isFinite(stroke) || stroke > MAX_COORDINATE) throw new ImportError('badNumber');
    const miter = Number(style['stroke-miterlimit']);
    const path = {
      d: formatCommands(transformed),
      fill,
      fillRule: FILL_RULES.includes(style['fill-rule']) ? style['fill-rule'] : 'nonzero',
      stroke,
      cap: CAPS.includes(style['stroke-linecap']) ? style['stroke-linecap'] : 'butt',
      join: JOINS.includes(style['stroke-linejoin']) ? style['stroke-linejoin'] : 'miter',
      miter: Number.isFinite(miter) && miter >= 1 && miter <= 100 ? miter : DEFAULT_MITER
    };
    const box = inkBounds(flattenCommands(transformed), path);
    if (!box) return;
    x0 = Math.min(x0, box[0]); y0 = Math.min(y0, box[1]);
    x1 = Math.max(x1, box[2]); y1 = Math.max(y1, box[3]);
    paths.push(path);
  }

  // `useStack`: ids being expanded by <use>, to refuse reference loops.
  function walk(node, parentStyle, matrix, depth, useStack, isRoot = false) {
    if (depth > LIMITS.maxDepth) throw new ImportError('tooDeep');
    const name = localName(node.name);
    if (!name) return;
    if (name === 'image') { warnings.add('images'); return; }
    if (!CONTAINERS.has(name) && !SHAPES.has(name) && name !== 'use' && name !== 'symbol') return;
    const attrs = node.attrs;
    const style = computeStyle(name, attrs, parentStyle);
    if (style.display === 'none') return;
    if ((style['clip-path'] && style['clip-path'] !== 'none') || (style.mask && style.mask !== 'none')) warnings.add('clips');
    let m = multiply(matrix, parseTransform(attrs.transform));
    if (name === 'svg' && !isRoot) {
      // A nested viewport: placed at x, y, its viewBox fitted into its
      // width × height (uniformly, centred — the default "meet").
      m = multiply(m, [1, 0, 0, 1, parseLength(attrs.x), parseLength(attrs.y)]);
      const box = attrs.viewBox ? parseNumberList(attrs.viewBox) : null;
      const w = parseLength(attrs.width, NaN);
      const h = parseLength(attrs.height, NaN);
      if (box && box.length === 4 && box[2] > 0 && box[3] > 0 && w > 0 && h > 0) {
        const s = Math.min(w / box[2], h / box[3]);
        m = multiply(m, [s, 0, 0, s, (w - box[2] * s) / 2 - box[0] * s, (h - box[3] * s) / 2 - box[1] * s]);
      }
    }
    if (name === 'use') {
      const href = attrs.href ?? attrs['xlink:href'];
      if (!href || !href.startsWith('#')) return;
      const id = href.slice(1);
      const target = ids.get(id);
      if (!target) return;
      if (useStack.includes(id)) throw new ImportError('useLoop');
      uses += 1;
      if (uses > LIMITS.maxUses) throw new ImportError('tooComplex');
      const placed = multiply(m, [1, 0, 0, 1, parseLength(attrs.x), parseLength(attrs.y)]);
      const targetName = localName(target.name);
      if (targetName === 'symbol') {
        for (const child of target.children) {
          if (typeof child !== 'string') walk(child, computeStyle('symbol', target.attrs, style), placed, depth + 1, [...useStack, id]);
        }
      } else {
        walk(target, style, placed, depth + 1, [...useStack, id]);
      }
      return;
    }
    if (name === 'symbol') return; // drawn only through <use>
    if (SHAPES.has(name)) {
      if (style.visibility === 'hidden' || style.visibility === 'collapse' || !(style.opacity > 0)) return;
      addPath(shapeCommands(name, attrs, budget), style, m, name !== 'line');
      return;
    }
    for (const child of node.children) {
      if (typeof child !== 'string') walk(child, style, m, depth + 1, useStack);
    }
  }

  walk(root, { ...INITIAL_STYLE, opacity: 1 }, IDENTITY, 0, [], true);
  if (paths.length === 0 || !(x1 >= x0) || !(y1 >= y0)) throw new ImportError('nothingToDraw');
  return {
    paths,
    bounds: [x0, y0, x1, y1],
    segments: LIMITS.maxSegments - budget.segments,
    warnings: [...warnings]
  };
}
