Temml v0.13.5
https://github.com/ronkok/Temml

Vendored locally (not loaded from a CDN) so the app has no runtime
dependency on a third-party host. Unmodified upstream ESM build
(`dist/temml.mjs` from the npm package) — self-contained, zero `import`
statements. Converts LaTeX math to MathML rather than KaTeX-style
HTML/CSS spans, so no font files are required for basic notation; the app
only vendors `Temml-Local.css` (relies on the browser's/OS's own math
font, e.g. Cambria Math/STIX Two Math, via the CSS `math` generic family)
plus the small companion glyph file `Temml.woff2` it references (used
only for script-style letters). Used by the manual renderer
(src/manual-markdown.js) to render `$...$` inline and `$$...$$` block
LaTeX formulas in the user manual (src/manual/*.md).

License: MIT (see LICENSE in this directory) — permissive and
GPL-compatible.
