import { el, clear } from '../dom.js';
import { renderMarkdown } from '../manual-markdown.js';

// THANKS.md is a single file, not one per locale — it's multi-lingual by
// itself (see its own section headings), so unlike manual-view.js there's
// no language lookup or fallback here.
function thanksUrl() {
  return new URL('../THANKS.md', import.meta.url);
}

export function mount(container) {
  clear(container);
  let cancelled = false;

  container.appendChild(el('div', { class: 'manual-loading', i18n: 'manual.loading' }));

  fetch(thanksUrl()).then((res) => {
    if (!res.ok) throw new Error(`failed to load THANKS.md: ${res.status}`);
    return res.text();
  }).then((text) => {
    if (cancelled) return;
    clear(container);
    container.appendChild(renderMarkdown(text));
  }).catch(() => {
    if (cancelled) return;
    clear(container);
    container.appendChild(el('div', { class: 'status', i18n: 'thanks.loadError' }));
  });

  return () => {
    cancelled = true;
  };
}
