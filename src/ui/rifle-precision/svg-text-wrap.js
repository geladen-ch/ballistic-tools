// Plain-text wrapping for the analysis view's SVG export — extracted to
// its own module (rather than living inside analysis-diagram.js) so both
// analysis-diagram.js (legend rows) and confidence-gauge-svg.js (header
// lines, results-pane text) can import it without a circular dependency
// between those two.
//
// No real font metrics are available where this runs (a plain builder
// function, exercised the same way in the Node test suite as in a
// browser — it can't depend on CanvasRenderingContext2D.measureText() or
// SVGTextElement.getComputedTextLength()), so wrapping uses a fixed
// average-character-width estimate for the sans-serif export panel font.
// Not pixel-perfect, but enough to keep text off the panel's edge.
export function estimateTextWidth(text, fontSizePx) {
  return text.length * fontSizePx * 0.55;
}

export function wrapText(text, maxWidthPx, fontSizePx) {
  const words = text.split(' ');
  const lines = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && estimateTextWidth(candidate, fontSizePx) > maxWidthPx) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [''];
}
