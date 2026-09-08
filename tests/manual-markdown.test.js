import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { installFakeDom } from './helpers/fake-dom.js';

installFakeDom();

const { renderMarkdown } = await import('../src/manual-markdown.js');

function findByTag(node, tag, out = []) {
  if (node.tagName === tag) out.push(node);
  for (const child of node.childNodes || []) findByTag(child, tag, out);
  return out;
}

test('inline: bold, italic, code, link and math all render as their own elements', () => {
  const root = renderMarkdown('**bold** *italic* `code` [text](https://example.com) $x^2$');
  const p = findByTag(root, 'P')[0];
  assert.equal(findByTag(p, 'STRONG')[0].textContent, 'bold');
  assert.equal(findByTag(p, 'EM')[0].textContent, 'italic');
  assert.equal(findByTag(p, 'CODE')[0].textContent, 'code');
  const link = findByTag(p, 'A')[0];
  assert.equal(link.textContent, 'text');
  assert.equal(link.getAttribute('href'), 'https://example.com');
  assert.equal(link.getAttribute('target'), '_blank');
  assert.equal(findByTag(p, 'SPAN').some((s) => s.className.includes('manual-math-inline')), true);
});

test('an in-app hash link opens in the same window; an external link opens in a new tab', () => {
  const root = renderMarkdown('[same window](#/manual/rifle-precision) [new tab](https://example.com)');
  const links = findByTag(root, 'A');
  const internal = links.find((a) => a.textContent === 'same window');
  const external = links.find((a) => a.textContent === 'new tab');
  assert.equal(internal.getAttribute('target'), null);
  assert.equal(internal.getAttribute('rel'), null);
  assert.equal(external.getAttribute('target'), '_blank');
  assert.equal(external.getAttribute('rel'), 'noopener');
});

test('italics wrapping a link does not swallow the link (no nested inline parsing)', () => {
  // The renderer is a single-pass, non-nesting inline scanner: a bare
  // *text [link](url) text* would match the whole span as one italic run
  // and never re-parse it for the link. Splitting the italics around the
  // link, as the manual sources do, is what keeps both.
  const root = renderMarkdown('*before* [link](https://example.com)*after*');
  const p = findByTag(root, 'P')[0];
  const link = findByTag(p, 'A')[0];
  assert.equal(link.textContent, 'link');
  assert.equal(findByTag(p, 'EM').length, 2);
});

test('headings get h1/h2/h3 tags and slugified ids', () => {
  const root = renderMarkdown('# Title One\n\n## Sub Section\n\n### 11.2 Pooling');
  assert.equal(findByTag(root, 'H1')[0].id, 'title-one');
  assert.equal(findByTag(root, 'H2')[0].id, 'sub-section');
  assert.equal(findByTag(root, 'H3')[0].id, '11-2-pooling');
});

test('bullet and ordered lists render as UL/OL with one LI per item', () => {
  const root = renderMarkdown('- one\n- two\n\n1. first\n2. second\n3. third');
  const ul = findByTag(root, 'UL')[0];
  assert.deepEqual(findByTag(ul, 'LI').map((li) => li.textContent), ['one', 'two']);
  const ol = findByTag(root, 'OL')[0];
  assert.deepEqual(findByTag(ol, 'LI').map((li) => li.textContent), ['first', 'second', 'third']);
});

test('an ordered item followed by an indented paragraph keeps the paragraph inside the same <li>', () => {
  const md = [
    '1. first item',
    '2. second item, continued below:',
    '',
    '   an indented follow-up paragraph.',
    '3. third item'
  ].join('\n');
  const root = renderMarkdown(md);
  const items = findByTag(root, 'LI');
  assert.equal(items.length, 3);
  assert.equal(findByTag(items[1], 'P').length, 1);
  assert.ok(items[1].textContent.includes('follow-up paragraph'));
  assert.equal(findByTag(items[2], 'P').length, 0);
});

test('an indented block-math line inside a list item renders as a math block, and the list stays open across it', () => {
  const md = [
    '1. set up the formula:',
    '',
    '   $$x = 1$$',
    '',
    '   where $x$ is a constant.',
    '2. second item'
  ].join('\n');
  const root = renderMarkdown(md);
  assert.equal(findByTag(root, 'OL').length, 1, 'both items belong to one list, not two');
  const items = findByTag(root, 'LI');
  assert.equal(items.length, 2);
  assert.equal(findByTag(items[0], 'DIV').some((d) => d.className.includes('manual-math-block')), true);
});

test('a list item is not left open by a following top-level paragraph', () => {
  const md = [
    '1. only item',
    '',
    '   an indented continuation.',
    '',
    'a normal unindented paragraph, not part of the list.'
  ].join('\n');
  const root = renderMarkdown(md);
  assert.equal(findByTag(root, 'OL').length, 1);
  const items = findByTag(root, 'LI');
  assert.equal(items.length, 1);
  const paragraphsOutsideList = findByTag(root, 'P').filter((p) => p.parentNode.tagName === 'DIV');
  assert.equal(paragraphsOutsideList.length, 1);
  assert.ok(paragraphsOutsideList[0].textContent.includes('not part of the list'));
});

test('a GitHub-flavored table with alignment renders as thead/tbody with the right cell counts', () => {
  const md = [
    '| Left | Center | Right |',
    '|:---|:---:|---:|',
    '| a | b | c |',
    '| d | e | f |'
  ].join('\n');
  const root = renderMarkdown(md);
  const table = findByTag(root, 'TABLE')[0];
  const headers = findByTag(findByTag(table, 'THEAD')[0], 'TH');
  assert.deepEqual(headers.map((h) => h.textContent), ['Left', 'Center', 'Right']);
  assert.equal(headers[1].attributes.style, 'text-align:center');
  assert.equal(headers[2].attributes.style, 'text-align:right');
  const rows = findByTag(findByTag(table, 'TBODY')[0], 'TR');
  assert.equal(rows.length, 2);
  assert.deepEqual(findByTag(rows[0], 'TD').map((c) => c.textContent), ['a', 'b', 'c']);
});

test('a blockquote renders as BLOCKQUOTE > P with inline formatting applied', () => {
  const root = renderMarkdown('> a **bold** point about `code`.');
  const bq = findByTag(root, 'BLOCKQUOTE')[0];
  assert.ok(bq);
  assert.equal(findByTag(bq, 'STRONG')[0].textContent, 'bold');
  assert.equal(findByTag(bq, 'CODE')[0].textContent, 'code');
});

test('a fenced code block preserves whitespace verbatim and skips inline parsing', () => {
  const md = '```\none  two\n  indented *not italic*\n```';
  const root = renderMarkdown(md);
  const pre = findByTag(root, 'PRE')[0];
  const code = findByTag(pre, 'CODE')[0];
  assert.equal(code.textContent, 'one  two\n  indented *not italic*');
  assert.equal(findByTag(pre, 'EM').length, 0);
});

test('every language of the detailed rifle-precision manual renders without throwing, with matching structure', async () => {
  const dir = new URL('../src/manual/rifle-precision/', import.meta.url);
  const files = (await readdir(dir)).filter((f) => f.endsWith('.md'));
  assert.ok(files.length >= 5);
  const summaries = {};
  for (const file of files) {
    const text = await readFile(new URL(file, dir), 'utf8');
    const root = renderMarkdown(text);
    summaries[file] = {
      ol: findByTag(root, 'OL').length,
      olItems: findByTag(root, 'OL').reduce((n, ol) => n + findByTag(ol, 'LI').length, 0),
      ulItems: findByTag(root, 'UL').reduce((n, ul) => n + findByTag(ul, 'LI').length, 0),
      table: findByTag(root, 'TABLE').length,
      pre: findByTag(root, 'PRE').length,
      blockquote: findByTag(root, 'BLOCKQUOTE').length,
      h3: findByTag(root, 'H3').length
    };
  }
  const reference = summaries['en.md'];
  for (const [file, summary] of Object.entries(summaries)) {
    for (const key of ['ol', 'olItems', 'ulItems', 'table', 'pre', 'blockquote', 'h3']) {
      assert.equal(summary[key], reference[key], `${file}: ${key} count should match en.md`);
    }
  }
});

test('every language of the detailed arsenal manual renders without throwing, with matching structure', async () => {
  const dir = new URL('../src/manual/arsenal/', import.meta.url);
  const files = (await readdir(dir)).filter((f) => f.endsWith('.md'));
  assert.ok(files.length >= 5);
  const summaries = {};
  for (const file of files) {
    const text = await readFile(new URL(file, dir), 'utf8');
    const root = renderMarkdown(text);
    summaries[file] = {
      ol: findByTag(root, 'OL').length,
      olItems: findByTag(root, 'OL').reduce((n, ol) => n + findByTag(ol, 'LI').length, 0),
      ulItems: findByTag(root, 'UL').reduce((n, ul) => n + findByTag(ul, 'LI').length, 0),
      table: findByTag(root, 'TABLE').length,
      pre: findByTag(root, 'PRE').length,
      blockquote: findByTag(root, 'BLOCKQUOTE').length,
      h3: findByTag(root, 'H3').length
    };
  }
  const reference = summaries['en.md'];
  for (const [file, summary] of Object.entries(summaries)) {
    for (const key of ['ol', 'olItems', 'ulItems', 'table', 'pre', 'blockquote', 'h3']) {
      assert.equal(summary[key], reference[key], `${file}: ${key} count should match en.md`);
    }
  }
});

test('the top-level manual (all languages) still renders without throwing', async () => {
  const dir = new URL('../src/manual/', import.meta.url);
  const files = (await readdir(dir)).filter((f) => f.endsWith('.md'));
  assert.ok(files.length >= 5);
  for (const file of files) {
    const text = await readFile(new URL(file, dir), 'utf8');
    assert.doesNotThrow(() => renderMarkdown(text), `${file} should render without throwing`);
  }
});
