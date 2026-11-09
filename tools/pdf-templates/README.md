# PDF templates and fonts

The app generates PDF documents in the browser from SVG templates, using jsPDF with svg2pdf.js (vendored under `src/vendor/`) through `buildTemplatePdf()` in `src/pdf/template-pdf.js`. A document is one or more pages. Each page is one template, in which the app translates i18n keys, replaces given strings with given values and inserts generated SVG into named boxes. Fonts are produced offline and committed as pre-built assets; templates are authored by hand, checked offline, and committed next to the feature that uses them. The app never imports a font or a template at run time.

This file states what a template and a font must satisfy to work with that renderer, and how the offline steps are run. Rules marked **[checked]** are verified by the offline checker (`check_templates.py`, see "Offline build" below); rules marked **[app]** are verified by the app each time it builds a PDF, and a violation is an error, not a silent fallback. Nothing rewrites a template: what you author is exactly what the app renders.

## Why these rules exist

svg2pdf.js renders a subset of SVG 1.1, and jsPDF embeds TrueType fonts without any text shaping. Anything outside that subset is not rejected by the renderer. It degrades silently: an unknown font face becomes Times (which has no Cyrillic), an unsupported element is skipped, an unsupported property is ignored. The rules below keep templates inside the subset, so a PDF looks the way the template looks in a browser.

## Fonts

### File format

1. **[checked]** One static TrueType file (`.ttf`) per face, with TrueType outlines (a `glyf` table). Files with CFF outlines (`OTTO` signature, usually `.otf`) are not accepted. jsPDF accepts them silently and then writes broken text.
2. A variable font is not used directly. Each face that templates need is exported as a static instance (one weight and style per file) by the offline build.
3. WOFF and WOFF2 are not accepted.
4. The offline build removes the OpenType layout tables (GSUB, GPOS, GDEF, `kern` and the like) from every shipped font. jsPDF draws glyph by glyph and never applies kerning or ligatures, but svg2pdf.js positions text (centred and right-aligned text, a `tspan` that follows other text) by measuring it in the browser with the same font, and the browser would apply them. Without those tables both sides use the same plain advance widths. The PDF output is the same either way.

### Identity: family, weight, style

Each face is registered under three things: a family name, a weight and a style. Templates select a face with exactly these three values, and nothing else.

1. **Family name:** the name written in the templates' `font-family`, e.g. `Barlow`. Every face of one family shares the same family name. Matching is exact and case-sensitive.
2. **[checked]** A family name must not be one of the renderer's built-in or alias names: `helvetica`, `times`, `courier`, `symbol`, `zapfdingbats`, `sans-serif`, `serif`, `monospace`, `cursive`, `fantasy`, `fixed`, `terminal`, `arial`, `verdana` (any capitalisation).
3. **Weight:** a number from 100 to 900 in steps of 100. 400 is the regular face and 700 the bold face.
4. **Style:** `normal` or `italic`. `oblique` is not a style.
5. **[checked]** No two faces share the same family, weight and style.

How the renderer looks a face up (for reference; the app derives the registration from family, weight and style):

| Weight | Style | Lookup key |
|---|---|---|
| 400 | normal | `normal` |
| 400 | italic | `italic` |
| 700 | normal | `bold` |
| 700 | italic | `bolditalic` |
| any other, e.g. 300 | normal | `300normal` |
| any other, e.g. 300 | italic | `300italic` |

### Character coverage

1. Any character set is accepted. By default a font ships with all its glyphs. Restricting a font to a chosen character set (e.g. Latin + Cyrillic) is a build-time option that reduces the file the app downloads.
2. A PDF embeds only the outlines of the glyphs its text actually uses, whatever the size of the font. The font's per-glyph tables (metrics, glyph index) still scale with the font's total glyph count, so a font with thousands of glyphs adds some tens of KB to every PDF that uses it. The build-time restriction above removes that overhead too.
3. **[checked]** Every character in the fixed text of a template is present in the face that renders it.
4. **[app]** Every character of every text run, substituted values and translations included, is present in the face that renders it.
5. Only characters of the Basic Multilingual Plane (U+0000–U+FFFF) are supported. Emoji and other characters above U+FFFF are not.

### Typography limits

1. No kerning, ligatures or other OpenType features are applied, either to fixed text or to substituted values. Choose faces that read well without them; tabular digits are an advantage.
2. No complex-script shaping. Scripts that need it (Arabic, Indic and the like) are not supported.

### Licence

1. The licence must allow redistribution with the app and embedding in documents. The SIL Open Font License 1.1 is the usual choice.
2. The licence text ships next to the font in the app, as for every vendored asset.
3. Prefer fonts without a Reserved Font Name. The offline build always modifies a font (at least by removing its layout tables), and the OFL forbids a modified font from carrying a reserved name. A font that declares one needs to be checked case by case before use.

## Templates

### Where templates live

1. A template is not a vendored component and there is no central template directory. It lives next to the code and data of the feature that uses it, the way targets keep their `.js`, `.json` and `-detail.svg`/`-thumb.svg`/`-result.svg` side by side in `src/targets/`.
2. Its file name ends in `-pdf-template.svg`, e.g. `range-card-pdf-template.svg`. The offline checker and the precache test find templates by this suffix. It names the file only; it says nothing about the strings inside.
3. The feature passes the template to the renderer by URL, `new URL('./range-card-pdf-template.svg', import.meta.url)`, and adds it to the service worker's precache list like any other app file (a test fails otherwise).

### File

1. A standalone SVG 1.1 file, UTF-8, with the SVG namespace on the root element.
2. **[checked]** No external references of any kind: no linked images, no links to other files, no web fonts, no `@import`. Raster images are embedded as `data:` URIs, PNG or JPEG only.
3. **[checked]** No `<script>`, no `<style>` elements. Styling goes in presentation attributes (`fill="…"`) or the `style` attribute (`style="fill:…"`), both of which Inkscape writes. Where both set the same property, the `style` attribute wins.
4. Inkscape-specific namespaces and metadata may remain; the renderer ignores them. Saving as "Plain SVG" is the cleaner option.

### Page size

1. **[checked]** **[app]** The root `<svg>` has `width` and `height` with an absolute unit (`mm`, `cm`, `in`, `pt`). This is the PDF page size.
2. **[checked]** The root has a `viewBox` with the same aspect ratio as `width` × `height`. All coordinates inside the template are unitless user units of that `viewBox`.
3. **[app]** All pages of one document have the same page size.
4. Choose a user unit small enough that every font size is at least 100 user units (see "Text" below). With millimetre geometry, 1 user unit = 0.01 mm works: an A4 page is `width="210mm" height="297mm" viewBox="0 0 21000 29700"`, and 8 pt text is about `font-size="282"`. Inkscape still shows and edits the document in the unit of `width` and `height`.

### Elements

1. **[checked]** Only these elements are used: `svg`, `g`, `defs`, `use`, `symbol`, `a`, `path`, `rect`, `circle`, `ellipse`, `line`, `polyline`, `polygon`, `text`, `tspan`, `image`, `clipPath`, `linearGradient`, `radialGradient`, `stop`, `pattern`, `marker`, plus `title`, `desc` and `metadata`, which are ignored.
2. **[checked]** Not used: `mask`, `filter` and filter effects (blur, drop shadow), `textPath`, `foreignObject`, `switch`, and Inkscape flowed text (`flowRoot`, or `<text>` with `shape-inside`). Flowed text has to be converted to ordinary text in Inkscape ("Text > Convert to Text").
3. Colours are sRGB (named, `#rgb`, `#rrggbb`, `rgb()`). No ICC or CMYK colours.

### Text

1. **[checked]** **[app]** `font-family` names exactly one registered family, with no fallback list: `font-family="Barlow"`, not `font-family="Barlow, sans-serif"`. Text with no `font-family` in effect is an error, since the renderer would use Times.
2. **[checked]** **[app]** `font-weight` is a number from 100 to 900 in steps of 100, or `normal` (= 400) or `bold` (= 700). `lighter` and `bolder` are not used.
3. **[checked]** **[app]** `font-style` is `normal` or `italic`. `oblique` is not used: the renderer draws it upright at weight 400, with no warning.
4. **[checked]** **[app]** Every combination of family, weight and style that applies to any text, after inheritance from parent elements, is a registered face.
5. **[checked]** **[app]** Every element that declares `font-family` resolves, with the weight and style in effect on that element, to a registered face, even if it has no text of its own. The renderer looks the family up where it is declared; if that lookup fails, it uses Times for the element and every descendant, including descendants whose own weight would match. Example: `<g font-family="Overpass" font-weight="500">` breaks all text inside it unless Overpass 500 is registered.
6. **[checked]** `letter-spacing`, `word-spacing`, `font-variant`, `font-stretch`, the `font` shorthand, `text-decoration`, `dominant-baseline` and `writing-mode` are not used. The renderer ignores most of them, so the PDF would differ from the browser.
7. **[checked]** `text-anchor` is `start`, `middle` or `end`. It is the way to centre or right-align text, including substituted values of unknown length.
8. `font-size` is at least 100 user units. svg2pdf.js places centred and right-aligned text (and a `tspan` that follows other text) by measuring it in the browser at the font size taken as pixels. At a few pixels the browser rounds every glyph's advance, so the text measures too wide and lands too far left: at 2.9 user units a line of Overpass Bold measures 13 % too wide, at 29 user units 0.7 %, and from 100 user units on the measurement is exact. A template with millimetre user units and `font-size="2.9"` therefore shows ragged right-aligned columns in the PDF, although it looks right in a browser. The rule is not checked by the offline checker; it is the template author's responsibility, and it applies to generated content in slots too (in its own `viewBox` units for fit mode).
9. Align text with `text-anchor` and fixed `x` positions only. Do not position text from widths computed in code (e.g. an estimated digit width): the shipped fonts have proportional digits and no kerning tables, and only the renderer's own measurement matches what it draws.
10. The `y` of a `text` or `tspan` is the baseline. Do not align text with baseline properties.
11. Runs of several spaces collapse to one unless the text element has `xml:space="preserve"`.
12. Text is single-line: one `text` element (or `tspan` with its own position) per line. Nothing wraps.
13. Fixed text stays text, and is selectable and searchable in the PDF.

### Translated text

1. A template's fixed text (labels, headings, notes) is written as i18n keys in braces, never as text in one language: `{printableCard.pdf.rifle}`. `{key|upper}` gives the translation in capitals, upper-cased by the rules of the document's language. A key may sit inside other text of the same node, e.g. `{printableCard.pdf.rangeCard} · [date]`.
2. A key is letters, digits, `_`, `-` and `.`, starting with a letter. Braces that do not form a key are left as they are.
3. **[app]** The app passes `translate(key)` (and `lang`) to `buildTemplatePdf()`; every key of every page must translate. A key with no translation, or a template with keys and no `translate`, is an error.
4. Keys are translated before the replaceable strings below are applied, so a substituted value is never read as a key, and a translation can never be hit by a replacement meant for a placeholder.
5. In a browser or in Inkscape the template shows the keys themselves; the offline checker checks their characters like any other fixed text.

### Replaceable strings

1. Any string in a template's text content can be replaced at run time with a value. Use this for values (placeholders such as `[RANGE]`), not for labels, which are translated keys (above). There is no naming convention, and the offline checker neither detects nor checks these strings. The app supplies pairs of string and value; pairs apply in the given order, each to every occurrence.
2. **[app]** Every string to be replaced occurs in the page's template, entirely inside one text node. Inkscape can split a line into several `tspan`s when it is edited character by character, so check the saved file, e.g. with Edit > XML Editor.
3. The replacement value is rendered in the face of the text it replaces, so that face must contain all of its characters. This includes translated strings: a template whose labels arrive in all app languages needs a face that covers every script those languages use.
4. Replacement acts on the text content of `text` and `tspan` only, never on attribute values, titles or descriptions.

### Insertion boxes ("slots")

1. A slot is a `rect` with a unique `id`, the only identifier the app uses to find it.
2. **[app]** The slot `rect` has plain numeric `x`, `y`, `width` and `height` in user units, and no `transform` of its own. Its ancestors (e.g. Inkscape layers) may have transforms; generated content is placed right after the `rect`, in the same coordinate system. (The offline checker cannot tell which rects are slots, so the app checks this.)
3. The `rect` stays in the output. Give it `fill="none" stroke="none"` to keep it invisible, or style it as a visible frame.
4. Two placement modes, chosen by the app per insertion:
   1. **Fit** (`mode: 'fit'`, with the content's extent as `viewBox`): the generated content is scaled uniformly to the largest size that fits the box and is centred in it.
   2. **1:1** (`mode: 'clip'`): the generated content keeps template user units, starts at the box's top-left corner, and anything outside the box is clipped.
5. Generated content follows the same element and text rules as templates; the app checks its fonts and characters like template text.

### Identifiers

1. **[checked]** All `id` values in a template are unique.
2. Ids referenced by the app (slots) are stable across template revisions. Renaming one is a code change.

## Offline build

The tools that build fonts and check templates are not part of the repository. They are two Python scripts using fontTools, kept with the maintainer's local tooling. This section is the procedure to reproduce them and their output from scratch.

### Environment

Python 3.11 or newer (for `tomllib`) and fontTools:

```sh
python3 -m venv ~/.venvs/fonttools
~/.venvs/fonttools/bin/pip install fonttools
```

### Inputs

A working directory holding:

1. `fonts/<family>/`: each source font file and its licence text. The shipped Overpass faces come from the Google Fonts repository, `https://raw.githubusercontent.com/google/fonts/main/ofl/overpass/Overpass%5Bwght%5D.ttf` (variable font, version 4.000) and `…/ofl/overpass/OFL.txt` (SIL OFL 1.1, no Reserved Font Name).
2. `fonts.toml`: one `[[face]]` table per face. Keys: `family`, `weight` (100–900), `style` (`normal`/`italic`), `source` and `licence` (paths relative to `fonts.toml`), `output` (file name to write), `licence_output` (the licence's file name in the app, e.g. `OFL-Overpass.txt`, shared by a family's faces). Optional: `instance = { wght = 400 }` (axis values of the static instance; required for a variable font) and `charset = ["latin", "cyrillic", …]` (restrict the font to these character sets; omit to keep every glyph). The shipped set is Overpass 400 and 700, each `instance = { wght = <weight> }`, no `charset`.

### `build_fonts.py MANIFEST OUTPUT_DIR`

For each face, in this order:

1. Load the source font with its own timestamps (no clock time is written, so the output is byte-for-byte reproducible).
2. If it is a variable font, export the static instance at `instance` (`fontTools.varLib.instancer`, `updateFontNames=False`). Fail if it is variable and has no `instance`, if an axis is missing, or if `instance` is given for a static font.
3. Fail unless the result has TrueType outlines (sfnt version `0x00010000` and a `glyf` table). Remove `DSIG` (invalid once modified).
4. Remove the layout tables `GSUB`, `GPOS`, `GDEF`, `BASE`, `JSTF`, `kern`, `morx` and `kerx` (see "File format" above). Removing them before any subsetting also keeps the subsetter from retaining glyphs that are only reachable through ligatures or substitutions.
5. If `charset` is given, subset to the union of these Unicode ranges with `fontTools.subset` (all name records kept, `.notdef` outline kept, timestamps not recalculated): `latin` U+0020–007E, U+00A0–00FF; `latin-ext` U+0100–024F, U+1E00–1EFF; `greek` U+0370–03FF; `cyrillic` U+0400–04FF; `punctuation` U+2000–206F; `symbols` U+20A0–20CF, U+2100–214F, U+2190–21FF, U+2200–22FF, U+25A0–25FF.
6. Name the font after its registration: name IDs 1/2 (legacy family/subfamily; non-RIBBI weights become e.g. `Overpass Light` / `Regular`), 4 (full name), 6 (PostScript name, e.g. `Overpass-Bold`), 16/17 (typographic family/subfamily), 3 (`<PostScript name>;<font revision>`), and remove 25. Set `OS/2.usWeightClass`, the italic/bold/regular bits of `OS/2.fsSelection`, and `head.macStyle`.
7. Save to `OUTPUT_DIR/<output>` with `reorderTables=True`.

Then copy each licence to `OUTPUT_DIR/<licence_output>`, delete `.ttf` and `OFL-*`/`LICENSE-*` files in `OUTPUT_DIR` that the manifest no longer produces (never `NOTICE.md`), and write `OUTPUT_DIR/faces.js`: a header comment and `export const PDF_FONT_FACES = [ { family, weight, style, file }, … ];` in manifest order, one entry per line, strings JSON-quoted.

It also fails on: a reserved family name, a comma or quote in a family name, a weight or style outside the allowed values, an unknown charset, two faces with the same family/weight/style, or two faces with the same output file.

Run it from the repository root:

```sh
~/.venvs/fonttools/bin/python -I <tools>/build_fonts.py <tools>/fonts.toml src/vendor/pdf-fonts
```

Running it twice must leave `git status` clean.

### `check_templates.py REPO [TEMPLATE.svg …]`

Reads the registered faces from `REPO/src/vendor/pdf-fonts/faces.js` and their character maps from the `.ttf` files, then checks every given template, or without arguments every `REPO/src/**/*-pdf-template.svg`, against all **[checked]** rules above. It parses with `xml.etree`, skips elements outside the SVG namespace and the content of `title`, `desc` and `metadata`, reads each property from the `style` attribute first and the presentation attribute second (`inherit` counts as unset), and follows inheritance from the root with weight 400, style normal and no family. Every violation is printed with the file and element; the exit status is non-zero if there is any. Templates are never modified.

```sh
~/.venvs/fonttools/bin/python -I <tools>/check_templates.py .
```

### Adding a font

1. Put the font file and its licence into `fonts/<family>/`, and check the licence (see "Licence" above).
2. Add one `[[face]]` per weight and style that templates will use.
3. Run `build_fonts.py`, then in the repo: add the new `.ttf` files to the service worker's precache list, describe the family's source in `src/vendor/pdf-fonts/NOTICE.md`, and run `npm test` (the font test checks format, tables, licence and precaching).

### Adding a template

1. Author it to the rules above, next to its feature, named `<name>-pdf-template.svg`.
2. Run `check_templates.py` and fix every problem it reports.
3. Add it to the service worker's precache list and run `npm test`.

### Checking the renderer in a browser

`tools/pdf-templates/check.html` is a developer page, not part of the app. Run `npm run serve` and open `http://localhost:8080/tools/pdf-templates/check.html`. It builds a two-page PDF from the test fixture `tests/fixtures/pdf/sample-pdf-template.svg` (Latin and Cyrillic values, a fit slot and a clip slot inside a transformed group), offers it for download, and runs each error path once. Every line must show a pass mark. Inspect the downloaded PDF for faces (both Overpass weights embedded), text alignment, and the two slots.
