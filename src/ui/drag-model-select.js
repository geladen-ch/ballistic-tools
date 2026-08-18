// The one shared option-builder every ballistic-model <select> in the app
// (BC Tools' Calculation panel, the Bullet section's manual entry, the
// Arsenal bullet form) uses instead of hand-listing G1/G7 — see
// engine/drag-tables.js's DRAG_MODELS and drag-model-prefs.js's show/hide
// setting.
//
// A select must always be able to display whatever value it's currently
// *being set to*, even if that model has since been hidden in Settings —
// otherwise hiding G1 would silently break an already-saved manual G1
// pick, or bullet-section.js's read-only display of a library bullet
// whose own built-in profile happens to use a hidden model. So the option
// list is always "every visible model, plus the value in play right now",
// never fewer.
import { el, clear } from '../dom.js';
import { DRAG_MODELS } from '../engine/drag-tables.js';
import { visibleDragModels } from '../drag-model-prefs.js';

export function dragModelOptionEls(required) {
  const ids = new Set(visibleDragModels().map((m) => m.id));
  if (required) ids.add(required);
  return DRAG_MODELS.filter((m) => ids.has(m.id)).map((m) => el('option', { value: m.id, i18n: m.labelKey }));
}

// Rebuilds `select`'s own options (see dragModelOptionEls above) and
// selects `value` — every call site that sets a drag-model <select>'s
// value, at construction or later, goes through this rather than a plain
// `select.value = ...` so a hidden-but-needed model is never silently
// missing from the option list.
export function setDragModelSelectValue(select, value) {
  clear(select);
  for (const opt of dragModelOptionEls(value)) select.appendChild(opt);
  select.value = value;
}
