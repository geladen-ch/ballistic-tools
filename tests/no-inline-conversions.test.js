// Guards the rule that every unit conversion goes through src/quantity.js:
// no inline `* 1000`, `* Math.PI / 180`, `+ 273.15` or copied factor
// constants anywhere else under src/. A heuristic scan, not a parser —
// it looks for unit literals anywhere in code, and for multiplication or
// division by 10/100/1000/0.01/0.001 on a line that also names a
// unit-suffixed identifier.
//
// Sites that predate the rule are listed in
// inline-conversions-baseline.json and are removed as the SI refactor
// converts them. The baseline may only shrink: a new site fails this
// test, and so does a baseline entry whose site no longer exists (so the
// list never keeps stale entries around to hide a future regression).
// After removing sites, refresh the baseline with
//   UPDATE_INLINE_CONVERSIONS_BASELINE=1 node --test tests/no-inline-conversions.test.js
// which refuses to add entries, only to drop them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC = join(ROOT, 'src');
const BASELINE_PATH = fileURLToPath(new URL('./inline-conversions-baseline.json', import.meta.url));

// The one module allowed to convert, and third-party code.
const EXCLUDED = new Set(['src/quantity.js']);
const EXCLUDED_DIRS = ['src/vendor/'];

// Literals that only ever appear as unit-conversion factors.
const UNIT_LITERALS = [
  /(?<![\d.])25\.4(?!\d)/, /(?<![\d.])0\.0254(?!\d)/, /(?<![\d.])0\.3048(?!\d)/, /(?<![\d.])0\.9144(?!\d)/,
  /(?<![\d.])1\.0936\d*/, /(?<![\d.])3\.2808\d*/, /(?<![\d.])273\.15(?!\d)/, /(?<![\d.])0\.44704(?!\d)/,
  /[*/]\s*3\.6(?!\d)/, /(?<![\d.])15432\.\d+/, /(?<![\d.])64\.79891/, /(?<![\d.])0\.45359\d*/, /(?<![\d.])453\.59\d*/,
  /(?<![\d.])703\.06\d*/, /(?<![\d.])3386\.\d+/, /(?<![\d.])133\.32\d*/, /(?<![\d.])6894\.7\d*/, /(?<![\d.])10800(?!\d)/,
  /(?<![\d.])3437\.7\d*/, /Math\.PI\s*\)?\s*\/\s*180\b/, /\b180\s*\)?\s*\/\s*Math\.PI/, /\*\s*180\s*\)?\s*\/\s*Math\.PI/
];

// Decimal scaling — only flagged on a line that names a quantity with a
// unit suffix, which is what separates `sightHeightMm / 1000` from a loop
// bound or a CSS percentage.
const DECIMAL_SCALING = /[*/]\s*\(?\s*(?:10|100|1000|0\.01|0\.001|1e-3|1e3)(?![\d.])/;
const UNIT_SUFFIXED = /\b[a-z][A-Za-z0-9]*(?:Mm|Cm|M|Km|Pct|Percent|Mrad|Moa|Hpa|Deg|Kg|Grains?|Rad)\b|\b(?:toDisplay|toEngine|getEngineValue|setEngineValue|siToDisplay|displayToSI)\(/;
// Wall-clock arithmetic (ms ↔ s, retention windows) is bookkeeping, not a
// physical quantity of the domain, and is out of the rule's scope.
const TIME_BOOKKEEPING = /\b(?:Date|setTimeout|setInterval|performance)\b|_MS\b|[a-z]Ms\b/;

// Permanent, reviewed exemptions: code that matches a pattern above but
// isn't a unit conversion.
const PERMANENT_EXEMPTIONS = [
  { file: 'src/engine/constants.js', pattern: /^export const LBIN2_TO_KGM2 = / }, // the drag model's sanctioned BC conversion constant
  { file: 'src/labradar/track-parse.js', pattern: /Math\.pow\(10, snr \/ 10\)/ }, // decibels, not a unit
  { file: 'src/ui/arsenal/caliber-field.js', pattern: /step: 1 \/ 10 \*\* decimals/ }, // an input's step from a decimal count
  { file: 'src/ui/image-cropper.js', pattern: /^const leftPct = rect\.x0 \* 100/ }, // photo-fraction → CSS percentage geometry
  { file: 'src/ui/truing-session/plausibility.js', pattern: /^\['tenth', x [*/] 10 \* clickMrad\]/ } // a tenfold slip in the typed clicks, not a unit
];

function listJsFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...listJsFiles(full));
    else if (name.endsWith('.js') || name.endsWith('.mjs')) out.push(full);
  }
  return out;
}

// Drops comments, keeping only code, one entry per source line. A small
// tokenizer rather than a regex, so a `/*` inside a line comment or a
// `//` inside a string doesn't throw it off. Regex literals aren't
// tracked; none in src/ contains a comment marker.
function codeLines(text) {
  const out = [];
  let line = '';
  let state = 'code'; // 'code' | 'line' | 'block' | quote char
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];
    if (c === '\n') {
      out.push(line.trim());
      line = '';
      if (state === 'line') state = 'code';
      if (state === "'" || state === '"') state = 'code'; // unterminated; never valid JS anyway
      continue;
    }
    if (state === 'line') continue;
    if (state === 'block') {
      if (c === '*' && next === '/') { state = 'code'; i++; }
      continue;
    }
    if (state === 'code') {
      if (c === '/' && next === '/') { state = 'line'; i++; continue; }
      if (c === '/' && next === '*') { state = 'block'; i++; continue; }
      if (c === "'" || c === '"' || c === '`') state = c;
      line += c;
      continue;
    }
    // inside a string literal
    line += c;
    if (c === '\\') { if (next !== undefined && next !== '\n') { line += next; i++; } continue; }
    if (c === state) state = 'code';
  }
  out.push(line.trim());
  return out;
}

function scanFile(full) {
  const file = relative(ROOT, full).split('\\').join('/');
  if (EXCLUDED.has(file) || EXCLUDED_DIRS.some((d) => file.startsWith(d))) return [];
  const hits = [];
  for (const code of codeLines(readFileSync(full, 'utf8'))) {
    if (!code || code.length > 400) continue; // a minified data table, not code
    if (PERMANENT_EXEMPTIONS.some((e) => e.file === file && e.pattern.test(code))) continue;
    const literal = UNIT_LITERALS.some((re) => re.test(code));
    const scaling = DECIMAL_SCALING.test(code) && UNIT_SUFFIXED.test(code) && !TIME_BOOKKEEPING.test(code);
    if (literal || scaling) hits.push(`${file}: ${code}`);
  }
  return hits;
}

function jsQuantitiesImporters() {
  const out = [];
  for (const full of listJsFiles(SRC)) {
    const file = relative(ROOT, full).split('\\').join('/');
    if (file.startsWith('src/vendor/') || file === 'src/quantity.js') continue;
    if (/from\s+['"][^'"]*js-quantities\/quantities\.mjs['"]/.test(readFileSync(full, 'utf8'))) out.push(file);
  }
  return out.sort();
}

function currentHits() {
  return listJsFiles(SRC).flatMap(scanFile).sort();
}

function loadBaseline() {
  return JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
}

// Multiset difference: entries of `a` not matched one-for-one in `b`.
function missingFrom(a, b) {
  const counts = new Map();
  for (const x of b) counts.set(x, (counts.get(x) || 0) + 1);
  const out = [];
  for (const x of a) {
    const n = counts.get(x) || 0;
    if (n === 0) out.push(x);
    else counts.set(x, n - 1);
  }
  return out;
}

if (process.env.UPDATE_INLINE_CONVERSIONS_BASELINE) {
  const baseline = loadBaseline();
  const hits = currentHits();
  const importers = jsQuantitiesImporters();
  const added = [...missingFrom(hits, baseline.inlineConversions), ...missingFrom(importers, baseline.jsQuantitiesImporters)];
  if (added.length) {
    throw new Error(`refusing to add entries to the baseline:\n${added.join('\n')}`);
  }
  writeFileSync(BASELINE_PATH, `${JSON.stringify({ inlineConversions: hits, jsQuantitiesImporters: importers }, null, 2)}\n`);
}

test('no new inline unit conversions outside src/quantity.js', () => {
  const added = missingFrom(currentHits(), loadBaseline().inlineConversions);
  assert.deepEqual(added, [], 'route these through src/quantity.js instead of converting inline');
});

test('the inline-conversion baseline holds no stale entries', () => {
  const stale = missingFrom(loadBaseline().inlineConversions, currentHits());
  assert.deepEqual(stale, [], 'these sites are gone — refresh the baseline (see this file\'s header)');
});

test('only src/quantity.js imports js-quantities (apart from not-yet-migrated baseline modules)', () => {
  const importers = jsQuantitiesImporters();
  const baseline = loadBaseline().jsQuantitiesImporters;
  assert.deepEqual(missingFrom(importers, baseline), [], 'import from src/quantity.js instead');
  assert.deepEqual(missingFrom(baseline, importers), [], 'stale baseline entries — refresh the baseline');
});
