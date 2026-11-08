jsPDF v4.2.1
https://github.com/parallax/jsPDF

Vendored locally (not loaded from a CDN) so the app has no runtime dependency on a third-party host. Upstream UMD build (`dist/jspdf.umd.min.js` from the npm package), unmodified except that the trailing `sourceMappingURL` comment was removed: the .map file is not vendored, and the dangling reference made DevTools log a 404. The UMD build is used rather than the ES build because the ES build imports `@babel/runtime`, `fflate` and `fast-png` as bare module specifiers, which a browser cannot resolve without a bundler or an import map; the UMD build bundles them. Imported for its side effect: with no CommonJS/AMD loader present it sets `globalThis.jspdf`. Its optional `html2canvas`, `dompurify` and `canvg` dependencies are only reached through `.html()` and `addSvgAsImage()`, which the app never calls, so they are not vendored.

Used by the PDF template renderer (src/pdf/template-pdf.js) together with svg2pdf.js (src/vendor/svg2pdf/) to turn SVG templates into PDF documents.

License: MIT (see LICENSE in this directory) — permissive and GPL-compatible. The build also bundles third-party code under MIT, zlib, ISC/BSD-style and similar permissive terms; their notices are kept as `@license` comments inside the vendored file.
