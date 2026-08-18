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
.ct-label { fill: #7c8790; color: #7c8790; font-size: 11px; }
.ct-grid { stroke: rgba(217, 224, 230, 0.15); }
`.trim();

export function exportChartSvg(container, filename) {
  const original = container.querySelector('svg');
  if (!original) return;

  const rect = original.getBoundingClientRect();
  const width = Math.round(rect.width);
  const height = Math.round(rect.height);
  if (!width || !height) return; // not actually laid out (e.g. hidden container) — nothing sensible to export

  const svg = original.cloneNode(true);
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
