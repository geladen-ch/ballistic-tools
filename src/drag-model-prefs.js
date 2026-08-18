// Cookie-backed show/hide preference for standard ballistic drag models
// (see engine/drag-tables.js's DRAG_MODELS) — same shape as
// library-prefs.js's booleans, just a set instead of a single flag.
// Default is nothing hidden (every model visible), opt-out not opt-in,
// matching the library toggles' own "discoverable by default" convention.
import { getCookie, setCookie } from './cookies.js';
import { DRAG_MODELS } from './engine/drag-tables.js';

const COOKIE_NAME = 'ballistics_hidden_drag_models_v1';

function loadHidden() {
  const raw = getCookie(COOKIE_NAME);
  if (!raw) return new Set();
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
  hidden = new Set();
}
