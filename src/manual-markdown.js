import { el } from './dom.js';

function slugify(text) {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
}

function inline(text) {
  const nodes = [];
  const re = /\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|\[(.+?)\]\((.+?)\)/g;
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
    } else {
      nodes.push(el('a', { href: match[5], target: '_blank', rel: 'noopener' }, [match[4]]));
    }
    last = re.lastIndex;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function renderMarkdown(text) {
  const lines = text.split('\n');
  const root = el('div', { class: 'manual-body' }, []);
  let i = 0;
  let list = null;

  function closeList() {
    if (list) {
      root.appendChild(list);
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

    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      closeList();
      const level = heading[1].length;
      const tag = level === 1 ? 'h1' : level === 2 ? 'h2' : 'h3';
      root.appendChild(el(tag, { id: slugify(heading[2]) }, inline(heading[2])));
      i++;
      continue;
    }

    const listItem = /^-\s+(.*)$/.exec(line);
    if (listItem) {
      let itemText = listItem[1];
      let j = i + 1;
      while (j < lines.length && lines[j].trim() !== '' && !/^-\s+/.test(lines[j]) && !/^#{1,3}\s+/.test(lines[j]) && lines[j].trim() !== '---') {
        itemText += ' ' + lines[j].trim();
        j++;
      }
      if (!list) list = el('ul', {}, []);
      list.appendChild(el('li', {}, inline(itemText)));
      i = j;
      continue;
    }

    closeList();
    let paraText = line.trim();
    let j = i + 1;
    while (j < lines.length && lines[j].trim() !== '' && !/^-\s+/.test(lines[j]) && !/^#{1,3}\s+/.test(lines[j]) && lines[j].trim() !== '---') {
      paraText += ' ' + lines[j].trim();
      j++;
    }
    root.appendChild(el('p', {}, inline(paraText)));
    i = j;
  }
  closeList();

  return root;
}
