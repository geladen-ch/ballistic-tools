// The PDF font registry and its files: every face is a TrueType-outline
// font jsPDF can embed, without the layout tables the browser-side text
// measurement must not apply, uniquely registered under a usable family
// name, with its licence shipped; and everything the PDF renderer loads at
// run time (fonts, scripts, templates) is precached for offline use.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDF_FONT_FACES } from '../src/vendor/pdf-fonts/faces.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const FONT_DIR = join(ROOT, 'src/vendor/pdf-fonts');
const RESERVED = ['helvetica', 'times', 'courier', 'symbol', 'zapfdingbats', 'sans-serif', 'serif',
  'monospace', 'cursive', 'fantasy', 'fixed', 'terminal', 'arial', 'verdana'];
const LAYOUT_TABLES = ['GSUB', 'GPOS', 'GDEF', 'kern', 'morx', 'kerx'];

function sfntTables(buf) {
  const count = buf.readUInt16BE(4);
  const tags = [];
  for (let i = 0; i < count; i++) tags.push(buf.toString('latin1', 12 + i * 16, 16 + i * 16));
  return { version: buf.readUInt32BE(0), tags };
}

test('registry has at least one face, each uniquely keyed with valid weight and style', () => {
  assert.ok(PDF_FONT_FACES.length > 0);
  const keys = new Set();
  for (const f of PDF_FONT_FACES) {
    assert.ok(Number.isInteger(f.weight) && f.weight >= 100 && f.weight <= 900 && f.weight % 100 === 0, `${f.file} weight`);
    assert.ok(f.style === 'normal' || f.style === 'italic', `${f.file} style`);
    assert.ok(!RESERVED.includes(f.family.toLowerCase()), `${f.family} is a reserved renderer name`);
    assert.ok(!/[,'"]/.test(f.family), `${f.family} contains a comma or quote`);
    const key = `${f.family}|${f.weight}|${f.style}`;
    assert.ok(!keys.has(key), `duplicate face ${key}`);
    keys.add(key);
  }
});

test('every face file is a TrueType-outline font without layout tables', () => {
  for (const f of PDF_FONT_FACES) {
    const path = join(FONT_DIR, f.file);
    assert.ok(existsSync(path), `${f.file} missing`);
    const { version, tags } = sfntTables(readFileSync(path));
    assert.equal(version, 0x00010000, `${f.file}: not a TrueType-outline sfnt`);
    assert.ok(tags.includes('glyf') && tags.includes('cmap'), `${f.file}: no glyf/cmap table`);
    for (const t of LAYOUT_TABLES) assert.ok(!tags.includes(t), `${f.file}: has a ${t} table`);
  }
});

test('every family ships its licence text', () => {
  const files = readdirSync(FONT_DIR);
  for (const family of new Set(PDF_FONT_FACES.map((f) => f.family))) {
    const stem = family.replace(/\s+/g, '');
    assert.ok(files.some((n) => /^(OFL|LICENSE)-/.test(n) && n.includes(stem)), `no licence file for ${family}`);
  }
});

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]);
}

test('the PDF renderer, its fonts and every PDF template are precached', () => {
  const sw = readFileSync(join(ROOT, 'service-worker.js'), 'utf8');
  const rel = (p) => `./${relative(ROOT, p).split('\\').join('/')}`;
  const required = [
    ...readdirSync(join(ROOT, 'src/pdf')).filter((n) => n.endsWith('.js')).map((n) => `./src/pdf/${n}`),
    './src/vendor/jspdf/jspdf.umd.min.js',
    './src/vendor/svg2pdf/svg2pdf.umd.min.js',
    './src/vendor/pdf-fonts/faces.js',
    ...PDF_FONT_FACES.map((f) => `./src/vendor/pdf-fonts/${f.file}`),
    ...walk(join(ROOT, 'src')).filter((p) => p.endsWith('-pdf-template.svg')).map(rel)
  ];
  for (const url of required) assert.ok(sw.includes(`'${url}'`), `${url} not in the service worker's precache list`);
});
