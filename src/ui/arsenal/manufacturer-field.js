import { el, clear } from '../../dom.js';
import { loadBulletLibraries, loadBullet } from '../../bullets.js';
import { isBulletLibraryVisible } from '../../bullet-library-prefs.js';
import { loadUserBullets } from '../../user-library.js';

// Every manufacturer name known to the app right now: every bullet in
// every currently-*enabled* built-in library (a hidden library's vendors
// shouldn't be suggested — same "hidden means hidden everywhere" idea
// bullet-section.js/cartridge-form.js already apply to the bullets
// themselves), plus every manufacturer already used in the user's own
// Arsenal. Built-ins are resolved first so their spelling/casing wins on
// a case-insensitive collision (e.g. a user who once typed "lapua" by
// hand shouldn't split "Lapua" into two suggestions) — Arsenal-only
// entries keep whatever casing the user themselves gave them. Sorted
// alphabetically, same convention as every other picker list in this app.
async function knownManufacturers() {
  const ids = loadBulletLibraries()
    .filter((lib) => isBulletLibraryVisible(lib.id))
    .flatMap((lib) => lib.ids);
  // allSettled, not all: one bullet id failing to load must not blank
  // out every manufacturer suggestion from the other 60-odd bullets.
  const results = await Promise.allSettled(ids.map((id) => loadBullet(id)));
  const failedCount = results.filter((r) => r.status === 'rejected').length;
  if (failedCount) console.warn(`[catalog:bullets] manufacturer suggestions missing ${failedCount}/${ids.length} built-in bullets`);
  const builtIns = results.filter((r) => r.status === 'fulfilled').map((r) => r.value);

  const seen = new Map(); // lowercased -> display casing
  for (const b of [...builtIns, ...loadUserBullets()]) {
    const name = (b.manufacturer || '').trim();
    if (name && !seen.has(name.toLowerCase())) seen.set(name.toLowerCase(), name);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

// Plain text `<input>` (kept exactly as before — same id, same `.value`
// contract existing tests and readValues() rely on) plus a suggestion
// list anchored directly under it. Focusing or typing in the field shows
// every known manufacturer whose name contains the current text
// (case-insensitive) — an empty field therefore shows every vendor,
// which is exactly the "click an empty field to see them all" behavior,
// with no special-casing needed.
//
// No document-level "click outside" listener: each suggestion row's
// mousedown handler calls preventDefault(), which suppresses the
// browser's default focus-shift, so the input never actually blurs when
// a suggestion is clicked. A plain blur handler on the input then closes
// the list for every other case (tab away, click elsewhere) with no race
// and nothing to leak — this form is torn down and rebuilt repeatedly
// when embedded in cartridge-form.js's "Add new bullet" flow, and a
// listener attached to the input itself is garbage-collected right along
// with it, unlike one attached to `document`.
export function manufacturerField({ value = '' } = {}) {
  const input = el('input', { type: 'text', id: 'arsenalBulletManufacturer', value });
  const list = el('div', { class: 'field-suggest-list' });
  list.style.display = 'none';

  let vendors = [];
  knownManufacturers().then((resolved) => { vendors = resolved; });

  function highlightedIndex() {
    return [...list.childNodes].findIndex((row) => row.classList.contains('highlighted'));
  }

  function setHighlighted(index) {
    const rows = [...list.childNodes];
    rows.forEach((row, i) => row.classList.toggle('highlighted', i === index));
  }

  function selectVendor(name) {
    input.value = name;
    list.style.display = 'none';
  }

  function render(query) {
    const q = query.trim().toLowerCase();
    const matches = vendors.filter((v) => v.toLowerCase().includes(q));
    clear(list);
    if (!matches.length) {
      list.style.display = 'none';
      return;
    }
    for (const name of matches) {
      const row = el('div', { class: 'field-suggest-item', text: name });
      // mousedown (not click) + preventDefault(): suppresses the
      // browser's default focus-shift, so `input` never blurs when a
      // suggestion is clicked — see the file header comment.
      row.addEventListener('mousedown', (event) => {
        event.preventDefault();
        selectVendor(name);
      });
      list.appendChild(row);
    }
    list.style.display = '';
  }

  input.addEventListener('input', () => render(input.value));
  input.addEventListener('focus', () => render(input.value));
  input.addEventListener('blur', () => { list.style.display = 'none'; });

  input.addEventListener('keydown', (event) => {
    if (list.style.display === 'none') return;
    if (event.key === 'Escape') {
      list.style.display = 'none';
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const count = list.childNodes.length;
      if (!count) return;
      const current = highlightedIndex();
      const next = event.key === 'ArrowDown'
        ? (current + 1) % count
        : (current - 1 + count) % count;
      setHighlighted(next);
    } else if (event.key === 'Enter') {
      const current = highlightedIndex();
      if (current === -1) return;
      event.preventDefault();
      selectVendor(list.childNodes[current].textContent);
    }
  });

  const node = el('div', { class: 'field' }, [
    el('label', { i18n: 'arsenal.bulletManufacturer' }),
    el('div', { class: 'field-suggest-wrap' }, [input, list])
  ]);

  return {
    node,
    getValue: () => input.value,
    setDisabled(disabled) { input.disabled = disabled; }
  };
}
