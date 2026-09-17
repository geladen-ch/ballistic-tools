// Exports a Chartist-rendered chart (see src/vendor/chartist/) as a
// standalone .svg file. Chartist's own root <svg> is sized with
// width/height:100% (see createSvg() in the vendored source) so it fills
// whatever container it's drawn into — fine on screen, but a plain clone
// of that markup would render as a zero-size (or container-dependent)
// image once it's no longer sitting inside this app's own DOM. This
// bakes in the chart's current on-screen pixel size instead, and inlines
// the small slice of base.css that actually styles the chart (see
// .chart-container there) plus a matching background rect, so the file
// looks right opened completely on its own — no dependency on this app's
// stylesheet or CSS custom properties, which wouldn't exist in whatever
// opens the file next.
import { svgEl } from './svg.js';
import { downloadFile } from './download.js';

// Literal hex values, not var(--panel) etc. — a standalone file can't
// resolve this app's :root custom properties, so this is the same
// palette from base.css copied in as plain colors.
const CHART_BACKGROUND = '#1b2127';
const CHART_SVG_STYLE = `
.ct-line { stroke-width: 2px; fill: none; }
.ct-series-a .ct-line { stroke: #e8a33d; }
.ct-series-a .ct-point { stroke: #e8a33d; stroke-width: 6.7px; }
.ct-series-b .ct-line { stroke: #5fb87a; }
.ct-series-c .ct-line { stroke: #f4c63d; stroke-dasharray: 4px; }
.ct-series-d .ct-line { stroke: #d17905; stroke-dasharray: 4px; }
.ct-series-zero-line .ct-line { stroke: #7c8790; stroke-width: 1px; }
.ct-label { fill: #7c8790; color: #7c8790; font-size: 11px; font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif; }
.ct-grid { stroke: rgba(217, 224, 230, 0.15); }
`.trim();

// Chartist renders every axis label as <foreignObject><span>...</span></foreignObject>
// (createLabel() in src/vendor/chartist/index.js) so the live chart can flex-align and
// wrap label text with real CSS — see .ct-label's flexbox rules in
// src/vendor/chartist/index.css. Browsers happily render that inside an exported .svg
// file too, but plenty of standalone SVG consumers (this app's own default SVG viewer
// on Linux, which uses librsvg; cairosvg-based pipelines; older Inkscape; print/PDF
// exporters) don't implement foreignObject at all and silently drop every label.
// Wrapping each one in <switch> with a requiredExtensions-gated foreignObject branch
// plus a plain <text> fallback keeps browsers on the exact flex-based layout they use
// today (verified pixel-identical in Chromium and Firefox) while giving non-browser
// tools an actual label instead of blank space. The x/y/anchor/baseline math below
// mirrors those same four .ct-label.(ct-horizontal|ct-vertical).(ct-start|ct-end)
// flexbox combinations as plain SVG text positioning.
function addLabelTextFallback(svg) {
  for (const foreignObject of Array.from(svg.querySelectorAll('foreignObject'))) {
    const span = foreignObject.querySelector('.ct-label');
    if (!span) continue;
    const x = parseFloat(foreignObject.getAttribute('x')) || 0;
    const y = parseFloat(foreignObject.getAttribute('y')) || 0;
    const width = parseFloat(foreignObject.getAttribute('width')) || 0;
    const height = parseFloat(foreignObject.getAttribute('height')) || 0;
    const horizontal = span.classList.contains('ct-horizontal');
    const start = span.classList.contains('ct-start');
    const textAttrs = horizontal
      ? { x, y: start ? y + height : y, 'text-anchor': 'start', 'dominant-baseline': start ? 'auto' : 'hanging' }
      : { x: start ? x + width : x, y: y + height, 'text-anchor': start ? 'end' : 'start', 'dominant-baseline': 'auto' };
    const text = svgEl('text', { class: 'ct-label', ...textAttrs }, [document.createTextNode(span.textContent)]);

    foreignObject.setAttribute('requiredExtensions', 'http://www.w3.org/1999/xhtml');
    const fallbackSwitch = svgEl('switch');
    foreignObject.replaceWith(fallbackSwitch);
    fallbackSwitch.appendChild(foreignObject);
    fallbackSwitch.appendChild(text);
  }
}

export function exportChartSvg(container, filename) {
  const original = container.querySelector('svg');
  if (!original) return;

  const rect = original.getBoundingClientRect();
  const width = Math.round(rect.width);
  const height = Math.round(rect.height);
  if (!width || !height) return; // not actually laid out (e.g. hidden container) — nothing sensible to export

  const svg = original.cloneNode(true);
  // Chartist's foreignObject() helper (see .foreignObject() in
  // src/vendor/chartist/index.js, used by createLabel() for every axis
  // label) sets each label <span>'s "xmlns" attribute to the XMLNS
  // *meta*-namespace URI itself instead of the XHTML one — a value that's
  // forbidden to (re)declare in XML and trips strict parsers ("reuse of
  // xmlns namespace name is forbidden" in Firefox) as soon as this
  // exported file is reopened. Those spans are already in the right
  // namespace from document.createElement(), so XMLSerializer regenerates
  // a correct declaration for them on its own — just drop every explicit
  // "xmlns" Chartist left on a descendant before serializing.
  for (const node of svg.querySelectorAll('[xmlns]')) node.removeAttribute('xmlns');
  addLabelTextFallback(svg);
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.removeAttribute('style'); // drop Chartist's own inline "width:100%;height:100%"

  const background = svgEl('rect', { x: '0', y: '0', width: String(width), height: String(height), fill: CHART_BACKGROUND });
  svg.insertBefore(background, svg.firstChild);

  const style = svgEl('style', {}, [document.createTextNode(CHART_SVG_STYLE)]);
  svg.insertBefore(style, svg.firstChild);

  const xml = new XMLSerializer().serializeToString(svg);
  downloadFile(filename, `<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n${xml}`, 'image/svg+xml;charset=utf-8');
}
