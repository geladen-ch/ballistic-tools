// Cookie-backed show/hide preference for standard ballistic drag models
// (see engine/drag-tables.js's DRAG_MODELS) — same shape as
// library-prefs.js's booleans, just a set instead of a single flag.
// Unlike the library toggles' own "everything on by default" convention,
// a first-time user (no cookie yet) starts with only G1 and G7 visible —
// the two most commonly used models — rather than every model this app
// knows about; anything beyond that is opt-in via Settings.
import { getCookie, setCookie } from './cookies.js';
import { DRAG_MODELS } from './engine/drag-tables.js';

const COOKIE_NAME = 'ballistics_hidden_drag_models_v1';
const DEFAULT_VISIBLE_IDS = new Set(['G1', 'G7']);

function defaultHidden() {
  return new Set(DRAG_MODELS.map((m) => m.id).filter((id) => !DEFAULT_VISIBLE_IDS.has(id)));
}

function loadHidden() {
  const raw = getCookie(COOKIE_NAME);
  // No cookie at all (never saved) gets the default above; an explicitly
  // saved empty string (every model shown, on purpose) must NOT be
  // re-defaulted every load — only null means "never touched this".
  if (raw === null) return defaultHidden();
  const knownIds = new Set(DRAG_MODELS.map((m) => m.id));
  return new Set(raw.split(',').filter((id) => knownIds.has(id)));
}

let hidden = loadHidden();

export function isDragModelVisible(id) {
  return !hidden.has(id);
}

export function setDragModelVisible(id, visible) {
  if (visible) hidden.delete(id); else hidden.add(id);
  try {
    setCookie(COOKIE_NAME, [...hidden].join(','));
  } catch {
    // best-effort — losing persistence isn't fatal
  }
}

// Every model the user hasn't hidden, in registry order — what every
// ballistic-model <select> in the app builds its option list from (see
// ui/drag-model-select.js) and what Settings' own checkboxes reflect.
export function visibleDragModels() {
  return DRAG_MODELS.filter((m) => isDragModelVisible(m.id));
}

export function resetDragModelPrefsForTests() {
  hidden = defaultHidden();
}
