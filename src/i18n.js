// App-wide i18n bootstrap on top of the vendored i18next core. Every
// locale is loaded eagerly at startup (they're a few KB each) so that
// switching languages never needs a fetch and fallbackLng always has its
// resources already in memory.
import i18next from './vendor/i18next/i18next.js';
import { RELEASE_ID, CODENAME_SHORT } from './version.js';

const STORAGE_KEY = 'ballistics-tools:lang:v1';

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'ru', label: 'Русский' },
  { code: 'de', label: 'Deutsch' },
  { code: 'it', label: 'Italiano' }
];
const SUPPORTED_CODES = SUPPORTED_LANGUAGES.map((l) => l.code);
const languageChangeListeners = new Set();

async function loadResources() {
  const entries = await Promise.all(
    SUPPORTED_CODES.map(async (code) => {
      const url = new URL(`./locales/${code}.json`, import.meta.url);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`failed to load locale "${code}": ${res.status}`);
      return [code, { translation: await res.json() }];
    })
  );
  return Object.fromEntries(entries);
}

function detectInitialLanguage() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && SUPPORTED_CODES.includes(stored)) return stored;
  } catch {
    // private-browsing / storage-disabled — fall through to detection
  }
  const preferred = (typeof navigator !== 'undefined' && navigator.languages) || [];
  for (const tag of preferred) {
    const primary = tag.split('-')[0].toLowerCase();
    if (SUPPORTED_CODES.includes(primary)) return primary;
  }
  return 'en';
}

// Updates every already-rendered static-HTML element (the nav shell in
// index.html) that carries a data-i18n key. Dynamically-built view content
// re-translates itself naturally on next mount, since views call t() while
// constructing their DOM — this sweep only needs to cover markup that
// isn't rebuilt by a view mount.
function applyStaticTranslations() {
  document.documentElement.lang = i18next.language;
  document.title = `${i18next.t('app.title')} - ${RELEASE_ID} (${CODENAME_SHORT})`;
  document.querySelectorAll('[data-i18n]').forEach((node) => {
    node.textContent = i18next.t(node.getAttribute('data-i18n'));
  });
}

export async function initI18n() {
  const resources = await loadResources();
  await i18next.init({
    lng: detectInitialLanguage(),
    fallbackLng: 'en',
    supportedLngs: SUPPORTED_CODES,
    resources,
    interpolation: { escapeValue: false }, // no HTML in our strings; we're not injecting into innerHTML
    returnEmptyString: false
  });
  applyStaticTranslations();
}

export function t(key, options) {
  return i18next.t(key, options);
}

export function getLanguage() {
  return i18next.language;
}

export async function changeLanguage(lang) {
  await i18next.changeLanguage(lang);
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // best-effort — losing persistence isn't fatal
  }
  applyStaticTranslations();
  languageChangeListeners.forEach((fn) => fn(lang));
}

// Lets anything that needs to react to a language switch do so wherever it
// was triggered from — e.g. app.js uses this to re-mount whatever view is
// currently showing, since a language switcher now lives in the header
// and can fire from any page, not just Settings.
export function onLanguageChange(fn) {
  languageChangeListeners.add(fn);
  return () => languageChangeListeners.delete(fn);
}

// Deterministic DOM id derived from a translation key, so every
// translatable element gets a stable, unique, inspectable id for free
// (e.g. "fields.muzzleVelocity" -> "i18n-fields-muzzleVelocity").
export function i18nId(key) {
  return 'i18n-' + key.replace(/[^a-zA-Z0-9]+/g, '-');
}

// Marks `node` as the live owner of `key`'s translation (data-i18n + a
// derived id, unless the caller already gave it one) and sets its text.
// Shared by dom.js's `i18n` element prop and by views that need to update
// a status message imperatively (with interpolation params) after mount.
export function applyI18nText(node, key, options) {
  node.setAttribute('data-i18n', key);
  if (!node.id) node.id = i18nId(key);
  node.textContent = t(key, options);
  return node;
}

// A standalone translated text node for use inside a compound element
// (e.g. a <label> that also contains an input) — its own id/data-i18n
// without stealing the parent's other children.
export function i18nSpan(key, options) {
  return applyI18nText(document.createElement('span'), key, options);
}
