svg2pdf.js v2.8.1
https://github.com/yWorks/svg2pdf.js

Vendored locally (not loaded from a CDN) so the app has no runtime dependency on a third-party host. Upstream UMD build (`dist/svg2pdf.umd.min.js` from the npm package), unmodified except that the trailing `sourceMappingURL` comment was removed: the .map file is not vendored, and the dangling reference made DevTools log a 404. The UMD build bundles its own dependencies (cssesc, svgpath, specificity, font-family-papandreou) and takes jsPDF from `globalThis.jspdf`, so it must be imported after src/vendor/jspdf/jspdf.umd.min.js. Importing it registers `jsPDF.API.svg` and sets `globalThis.svg2pdf`.

Used by the PDF template renderer (src/pdf/template-pdf.js) to draw an SVG template onto a jsPDF page. It needs a DOM (it walks a parsed SVG element), so it runs on the main thread only.

License: MIT (see LICENSE in this directory) — permissive and GPL-compatible.
