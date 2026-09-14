import { el, clear } from '../dom.js';
import { renderMarkdown } from '../manual-markdown.js';

// FEATURES.md is a single file, not one per locale — kept English-only on
// purpose, so unlike manual-view.js there's no language lookup or fallback
// here; every locale's home-page link (see home-view.js's versionCard())
// points at this same file.
function featuresUrl() {
  return new URL('../FEATURES.md', import.meta.url);
}

export function mount(container) {
  clear(container);
  let cancelled = false;

  container.appendChild(el('div', { class: 'manual-loading', i18n: 'manual.loading' }));

  fetch(featuresUrl()).then((res) => {
    if (!res.ok) throw new Error(`failed to load FEATURES.md: ${res.status}`);
    return res.text();
  }).then((text) => {
    if (cancelled) return;
    clear(container);
    container.appendChild(renderMarkdown(text));
  }).catch(() => {
    if (cancelled) return;
    clear(container);
    container.appendChild(el('div', { class: 'status', i18n: 'features.loadError' }));
  });

  return () => {
    cancelled = true;
  };
}
