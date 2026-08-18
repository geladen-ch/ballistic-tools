import { el, clear } from '../dom.js';
import { getLanguage } from '../i18n.js';
import { renderMarkdown } from '../manual-markdown.js';

const AUTO_TRANSLATED_LANGS = new Set(['de', 'it']);

function manualUrl(lang) {
  return new URL(`../manual/${lang}.md`, import.meta.url);
}

async function loadManualText(lang) {
  const res = await fetch(manualUrl(lang));
  if (res.ok) return res.text();
  const fallback = await fetch(manualUrl('en'));
  if (!fallback.ok) throw new Error(`failed to load manual: ${fallback.status}`);
  return fallback.text();
}

export function mount(container) {
  clear(container);
  let cancelled = false;

  const body = el('div', { class: 'manual-loading', i18n: 'manual.loading' });
  container.appendChild(el('div', {}, [body]));

  const lang = getLanguage();

  loadManualText(lang).then((text) => {
    if (cancelled) return;
    clear(container);
    const wrapper = el('div', {}, []);
    if (AUTO_TRANSLATED_LANGS.has(lang)) {
      wrapper.appendChild(el('div', { class: 'manual-auto-translated-notice', i18n: 'manual.autoTranslatedNotice' }));
    }
    wrapper.appendChild(renderMarkdown(text));
    container.appendChild(wrapper);
  }).catch(() => {
    if (cancelled) return;
    clear(container);
    container.appendChild(el('div', { class: 'status', i18n: 'manual.loadError' }));
  });

  return () => {
    cancelled = true;
  };
}
