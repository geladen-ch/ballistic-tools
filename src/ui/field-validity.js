import { el } from '../dom.js';

// Live, per-field validation — shared by every numeric/text/select field
// in the app (unit-field.js, large-stepper-field.js, and every hand-
// rolled field that isn't built from either) so "what invalid looks
// like" is defined in exactly one place: a `.field-invalid` class on the
// control itself (see base.css's red border) plus a `.hint.warning` line
// right after it, shown only while the value is actually invalid — never
// permanently visible, matching every other hint/warning already in this
// app (duplicate-name warnings, the old single-shared-error-on-save
// messages this replaces).
//
// Starts "pristine": no red border, no message, until the control has
// actually been touched — a freshly-opened blank "Add" form must never
// open already showing red on a required field nobody's had a chance to
// fill in yet. A form's own Save handler calls validate() on every field
// it owns, which forces it dirty (so a never-touched violation still
// surfaces the moment Save is actually clicked) and returns whether it's
// currently valid — see e.g. bullet-form.js's own saveButton handler.
//
// `getMessage()` is called fresh on every check — it returns the
// specific violation text (already fully composed, e.g. via
// units.js's formatFieldRange()) or a falsy value once the field is
// valid again.
export function fieldValidity(control, getMessage) {
  let dirty = false;
  const hint = el('p', { class: 'hint warning' });
  hint.style.display = 'none';

  function refresh() {
    if (!dirty) return true;
    const message = getMessage();
    control.classList.toggle('field-invalid', !!message);
    hint.textContent = message || '';
    hint.style.display = message ? '' : 'none';
    return !message;
  }

  // 'input' covers text/number typing; 'change' covers a <select> in
  // browsers that don't also fire 'input' for it. Attaching both to
  // every control type is harmless — refresh() is idempotent.
  control.addEventListener('input', () => { dirty = true; refresh(); });
  control.addEventListener('change', () => { dirty = true; refresh(); });

  return {
    hintNode: hint,
    validate() {
      dirty = true;
      return refresh();
    }
  };
}
