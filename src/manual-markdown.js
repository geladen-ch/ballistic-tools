import { el } from './dom.js';
import temml from './vendor/temml/temml.mjs';

function renderMath(latex, displayMode) {
  try {
    return temml.renderToString(latex, { displayMode, throwOnError: false });
  } catch {
    return el('code', {}, [latex]).outerHTML;
  }
}

function slugify(text) {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
}

function inline(text) {
  const nodes = [];
  const re = /\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|\[(.+?)\]\((.+?)\)|\$(.+?)\$/g;
  let last = 0;
  let match;
  while ((match = re.exec(text))) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    if (match[1] !== undefined) {
      nodes.push(el('strong', {}, [match[1]]));
    } else if (match[2] !== undefined) {
      nodes.push(el('em', {}, [match[2]]));
    } else if (match[3] !== undefined) {
      nodes.push(el('code', {}, [match[3]]));
    } else if (match[6] !== undefined) {
      nodes.push(el('span', { class: 'manual-math-inline', html: renderMath(match[6], false) }, []));
    } else if (match[5].startsWith('#')) {
      // An in-app hash route (e.g. a link to another manual page) — keep
      // it in the same window/tab so the router just re-renders in place,
      // instead of opening a second copy of the app.
      nodes.push(el('a', { href: match[5] }, [match[4]]));
    } else {
      nodes.push(el('a', { href: match[5], target: '_blank', rel: 'noopener' }, [match[4]]));
    }
    last = re.lastIndex;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function isListItemLine(line) {
  return /^-\s+/.test(line) || /^\d+\.\s+/.test(line);
}

function isStructuralLine(line) {
  return line.trim() === '' || line.trim() === '---' || /^#{1,3}\s+/.test(line)
    || isListItemLine(line) || /^```/.test(line) || /^\|.*\|\s*$/.test(line) || /^>\s?/.test(line);
}

// A single-line or multi-line $$...$$ block starting at lines[i]. Returns
// null if lines[i] (trimmed) doesn't open one.
function tryBlockMath(lines, i) {
  const trimmed = lines[i].trim();
  const singleLine = /^\$\$(.+)\$\$$/.exec(trimmed);
  if (singleLine) {
    return { node: el('div', { class: 'manual-math-block', html: renderMath(singleLine[1], true) }, []), next: i + 1 };
  }
  if (trimmed === '$$') {
    const contentLines = [];
    let j = i + 1;
    while (j < lines.length && lines[j].trim() !== '$$') {
      contentLines.push(lines[j]);
      j++;
    }
    return { node: el('div', { class: 'manual-math-block', html: renderMath(contentLines.join('\n'), true) }, []), next: j + 1 };
  }
  return null;
}

// One extra paragraph or math block, indented under an open list item
// (e.g. a formula worked out across a numbered step). lines[i] is already
// known to start with whitespace. Returns { node, next }.
function readIndentedBlock(lines, i) {
  const math = tryBlockMath(lines, i);
  if (math) return math;
  let text = lines[i].trim();
  let j = i + 1;
  while (j < lines.length && lines[j].trim() !== '' && /^\s/.test(lines[j])) {
    text += ' ' + lines[j].trim();
    j++;
  }
  return { node: el('p', {}, inline(text)), next: j };
}

// Consumes every (blank line + indented block) group that follows a list
// item, appending each block into `item`. Stops at the first blank line
// not followed by an indented line, or at end of input.
function consumeListItemContinuation(lines, i, item) {
  while (i < lines.length && lines[i].trim() === '' && i + 1 < lines.length && /^\s+\S/.test(lines[i + 1])) {
    i++; // the blank separator line
    const { node, next } = readIndentedBlock(lines, i);
    item.appendChild(node);
    i = next;
  }
  return i;
}

function parseTableRow(line) {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return trimmed.split('|').map((cell) => cell.trim());
}

const ALIGN_RIGHT = /^:?-+:$/;
const ALIGN_CENTER = /^:-+:$/;
const ALIGN_LEFT = /^:-+$/;

function columnAlign(sep) {
  if (ALIGN_CENTER.test(sep)) return 'center';
  if (ALIGN_RIGHT.test(sep)) return 'right';
  if (ALIGN_LEFT.test(sep)) return 'left';
  return null;
}

export function renderMarkdown(text) {
  const lines = text.split('\n');
  const root = el('div', { class: 'manual-body' }, []);
  let i = 0;
  let list = null; // { el, tag: 'ul' | 'ol', item: last <li> appended }

  function closeList() {
    if (list) {
      root.appendChild(list.el);
      list = null;
    }
  }

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === '') {
      closeList();
      i++;
      continue;
    }

    if (line.trim() === '---') {
      closeList();
      root.appendChild(el('hr', {}, []));
      i++;
      continue;
    }

    const fence = /^```/.exec(line);
    if (fence) {
      closeList();
      const codeLines = [];
      let j = i + 1;
      while (j < lines.length && !/^```/.test(lines[j])) {
        codeLines.push(lines[j]);
        j++;
      }
      root.appendChild(el('pre', {}, [el('code', {}, [codeLines.join('\n')])]));
      i = j + 1;
      continue;
    }

    const blockMath = tryBlockMath(lines, i);
    if (blockMath && (lines[i].trim() === '$$' || /^\$\$(.+)\$\$$/.test(lines[i].trim()))) {
      closeList();
      root.appendChild(blockMath.node);
      i = blockMath.next;
      continue;
    }

    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      closeList();
      const level = heading[1].length;
      const tag = level === 1 ? 'h1' : level === 2 ? 'h2' : 'h3';
      root.appendChild(el(tag, { id: slugify(heading[2]) }, inline(heading[2])));
      i++;
      continue;
    }

    if (/^\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
      closeList();
      const headerCells = parseTableRow(line);
      const aligns = parseTableRow(lines[i + 1]).map(columnAlign);
      const table = el('table', {}, []);
      const thead = el('thead', {}, [el('tr', {}, headerCells.map((cell, idx) =>
        el('th', aligns[idx] ? { style: `text-align:${aligns[idx]}` } : {}, inline(cell))))]);
      table.appendChild(thead);
      const tbody = el('tbody', {}, []);
      let j = i + 2;
      while (j < lines.length && /^\|.*\|\s*$/.test(lines[j])) {
        const cells = parseTableRow(lines[j]);
        tbody.appendChild(el('tr', {}, cells.map((cell, idx) =>
          el('td', aligns[idx] ? { style: `text-align:${aligns[idx]}` } : {}, inline(cell)))));
        j++;
      }
      table.appendChild(tbody);
      root.appendChild(table);
      i = j;
      continue;
    }

    if (/^>\s?/.test(line)) {
      closeList();
      let quoteText = line.replace(/^>\s?/, '');
      let j = i + 1;
      while (j < lines.length && /^>\s?/.test(lines[j])) {
        quoteText += ' ' + lines[j].replace(/^>\s?/, '');
        j++;
      }
      root.appendChild(el('blockquote', {}, [el('p', {}, inline(quoteText))]));
      i = j;
      continue;
    }

    const bullet = /^-\s+(.*)$/.exec(line);
    const numbered = /^\d+\.\s+(.*)$/.exec(line);
    if (bullet || numbered) {
      const itemBody = (bullet || numbered)[1];
      const tag = numbered ? 'ol' : 'ul';
      let itemText = itemBody;
      let j = i + 1;
      while (j < lines.length && lines[j].trim() !== '' && !isStructuralLine(lines[j])) {
        itemText += ' ' + lines[j].trim();
        j++;
      }
      if (!list || list.tag !== tag) {
        closeList();
        list = { el: el(tag, {}, []), tag };
      }
      const item = el('li', {}, inline(itemText));
      list.el.appendChild(item);
      i = consumeListItemContinuation(lines, j, item);
      continue;
    }

    closeList();
    let paraText = line.trim();
    let j = i + 1;
    while (j < lines.length && lines[j].trim() !== '' && !isStructuralLine(lines[j])) {
      paraText += ' ' + lines[j].trim();
      j++;
    }
    root.appendChild(el('p', {}, inline(paraText)));
    i = j;
  }
  closeList();

  return root;
}
