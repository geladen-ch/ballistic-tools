// Font-face resolution for PDF templates, kept DOM-free so it runs (and is
// tested) under Node. It mirrors how svg2pdf.js picks a face, which is what
// the PDF will actually show:
//
// - font-family, font-weight and font-style inherit down the tree; on one
//   element the `style` attribute wins over the presentation attribute;
// - a face is found by family name plus a style key built from weight and
//   style (see styleKey());
// - the family is looked up where it is declared, with the weight and
//   style in effect on that element. If that combination is not registered,
//   the renderer substitutes Times for that element *and every descendant*,
//   even ones whose own weight/style would match. So a family-declaring
//   element must resolve to a registered face too, not only the text runs.
//
// Anything outside the supported values (lighter/bolder, oblique, a fallback
// family list) is reported, because the renderer would silently draw
// something else.

// Weight keywords the renderer understands. 'lighter'/'bolder' are relative
// in CSS and have no fixed face, so they are rejected.
const WEIGHT_KEYWORDS = { normal: 400, bold: 700 };

// The key svg2pdf.js asks jsPDF for: 'normal', 'italic', 'bold' and
// 'bolditalic' for the four classic faces, '<weight><style>' (e.g.
// '300normal', '600italic') for every other weight. A face is registered
// with jsPDF under exactly this key.
export function styleKey(weight, style) {
  if (weight === 400) return style === 'italic' ? 'italic' : 'normal';
  if (weight === 700) return style === 'italic' ? 'bolditalic' : 'bold';
  return `${weight}${style}`;
}

// Numeric CSS weight from an attribute value, or an Error describing why
// the value is not usable.
export function parseFontWeight(value) {
  const v = String(value).trim();
  if (Object.hasOwn(WEIGHT_KEYWORDS, v)) return WEIGHT_KEYWORDS[v];
  if (/^[1-9]00$/.test(v)) return Number(v);
  return new Error(`font-weight "${v}" must be 100..900 in steps of 100, normal or bold`);
}

export function parseFontStyle(value) {
  const v = String(value).trim();
  if (v === 'normal' || v === 'italic') return v;
  return new Error(`font-style "${v}" must be normal or italic`);
}

// One family name, unquoted. A comma-separated fallback list is an error:
// a registered face never falls back, and a missing one would fall back to
// a built-in font without Cyrillic.
export function parseFontFamily(value) {
  const v = String(value).trim();
  if (v.includes(',')) return new Error(`font-family "${v}" must name one family, not a fallback list`);
  const name = v.replace(/^(['"])(.*)\1$/, '$2').trim();
  if (!name) return new Error('font-family is empty');
  return name;
}

// Walks a plain tree of
//   { label, fontFamily?, fontWeight?, fontStyle?, texts: [string], children: [node] }
// (raw attribute values, already merged style-attribute-over-attribute;
// `texts` are the element's own text runs) and returns
//   { uses: [{ family, weight, style, text, label }], errors: [{ label, message }] }
// where `uses` has one entry per family-declaring element (text: '') and
// one per non-blank text run. Family is null where none is in effect.
export function resolveFaces(root) {
  const uses = [];
  const errors = [];
  const visit = (node, inherited) => {
    const state = { ...inherited };
    const report = (err) => errors.push({ label: node.label, message: err.message });
    if (node.fontWeight != null) {
      const w = parseFontWeight(node.fontWeight);
      if (w instanceof Error) report(w); else state.weight = w;
    }
    if (node.fontStyle != null) {
      const s = parseFontStyle(node.fontStyle);
      if (s instanceof Error) report(s); else state.style = s;
    }
    if (node.fontFamily != null) {
      const f = parseFontFamily(node.fontFamily);
      if (f instanceof Error) report(f); else state.family = f;
      uses.push({ family: state.family, weight: state.weight, style: state.style, text: '', label: node.label });
    }
    for (const text of node.texts || []) {
      if (text.trim()) {
        uses.push({ family: state.family, weight: state.weight, style: state.style, text, label: node.label });
      }
    }
    for (const child of node.children || []) visit(child, state);
  };
  visit(root, { family: null, weight: 400, style: 'normal' });
  return { uses, errors };
}

// Characters of `text` the renderer can't draw with a font whose cmap is
// `hasChar(codePoint) → boolean`. Line breaks and tabs are excluded (the
// renderer turns them into spaces); characters above U+FFFF are always
// reported, since jsPDF encodes text one UTF-16 unit at a time.
export function missingCharacters(text, hasChar) {
  const missing = new Set();
  for (const ch of text) {
    if (ch === '\n' || ch === '\r' || ch === '\t') continue;
    const cp = ch.codePointAt(0);
    if (cp > 0xffff || !hasChar(cp)) missing.add(ch);
  }
  return [...missing];
}

export function describeCharacters(chars) {
  return chars.map((c) => `U+${c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')} (${c})`).join(', ');
}
