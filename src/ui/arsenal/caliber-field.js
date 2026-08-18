import { el, clear } from '../../dom.js';
import { loadCaliberDesignations, matchCaliberDesignation } from '../../bullets.js';

const PLACEHOLDER_VALUE = '';
const OTHER_VALUE = '__other__';

// Bullet caliber, entered as a live-linked pair: a picker of known
// designations (marketing names like "6.5mm" or "7.62 / .308 / .30" —
// see caliber-designations.json) and a plain mm number, kept in sync in
// both directions rather than either one driving the other exclusively —
// a shooter might know the marketing name, the raw diameter, or both.
// Picking a designation writes its own exact caliberM into the number
// field; typing a number that lands within matchCaliberDesignation()'s
// own tolerance of a known bore diameter selects that designation in the
// picker, and anything else (present but unrecognized) selects "Other" —
// never silently left on a stale designation from before the edit.
// `value` is the initial caliber in meters (engine unit), or null/omitted
// for "nothing entered yet".
export function caliberField({ value = null, onInput } = {}) {
  let designations = [];

  const select = el('select', { id: 'bulletCaliber' });
  const numberInput = el('input', {
    type: 'number', id: 'bulletCaliberMm', min: 0, step: 0.01,
    value: value != null ? (value * 1000).toFixed(2) : ''
  });

  function rebuildOptions() {
    const previousValue = select.value || PLACEHOLDER_VALUE;
    clear(select);
    select.appendChild(el('option', { value: PLACEHOLDER_VALUE, i18n: 'arsenal.bulletCaliberPlaceholder' }));
    // Ordered by actual bore diameter, same convention as every other
    // caliber list in this app (see bullet-section.js's own picker).
    for (const d of [...designations].sort((a, b) => a.caliberM - b.caliberM)) {
      select.appendChild(el('option', { value: d.designation, text: d.designation }));
    }
    select.appendChild(el('option', { value: OTHER_VALUE, i18n: 'arsenal.bulletCaliberOther' }));
    select.value = previousValue;
  }
  rebuildOptions(); // placeholder + "Other" show immediately; real designations join once the fetch below resolves

  // Reflects numberInput's current content onto select — called after
  // every edit to numberInput, and once more when the designation list
  // itself finishes loading (an initial `value` can't resolve to a real
  // designation before that).
  function syncSelectFromNumber() {
    const raw = numberInput.value.trim();
    if (raw === '') { select.value = PLACEHOLDER_VALUE; return; }
    const mm = parseFloat(raw);
    if (Number.isNaN(mm)) { select.value = PLACEHOLDER_VALUE; return; }
    const match = matchCaliberDesignation(mm / 1000, designations);
    select.value = match ? match.designation : OTHER_VALUE;
  }

  numberInput.addEventListener('input', () => {
    syncSelectFromNumber();
    if (onInput) onInput();
  });

  select.addEventListener('change', () => {
    if (select.value === PLACEHOLDER_VALUE) {
      numberInput.value = '';
    } else if (select.value !== OTHER_VALUE) {
      // "Other" carries no caliberM of its own to adopt — numberInput is
      // left exactly as it was (that's usually what put "Other" here in
      // the first place: an unrecognized number already typed in).
      const entry = designations.find((d) => d.designation === select.value);
      if (entry) numberInput.value = (entry.caliberM * 1000).toFixed(2);
    }
    if (onInput) onInput();
  });

  loadCaliberDesignations().then((list) => {
    designations = list;
    rebuildOptions();
    syncSelectFromNumber();
  }).catch(() => {
    // caliber list unavailable (offline on first load) — the picker stays
    // at just the placeholder/"Other"; the number field still works fine.
  });

  const node = el('div', { class: 'field' }, [
    el('label', { i18n: 'arsenal.bulletCaliber' }),
    el('div', { class: 'caliber-dual-inputs' }, [select, numberInput, document.createTextNode(' mm')])
  ]);

  function getCaliberM() {
    const raw = numberInput.value.trim();
    if (raw === '') return null;
    const mm = parseFloat(raw);
    return Number.isNaN(mm) ? null : mm / 1000;
  }

  function setCaliberM(caliberM) {
    numberInput.value = caliberM != null ? (caliberM * 1000).toFixed(2) : '';
    syncSelectFromNumber();
  }

  return { node, getCaliberM, setCaliberM };
}
