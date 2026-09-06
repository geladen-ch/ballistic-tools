// The body of the "Set as cartridge precision…" picker (see
// rifle-precision-view.js) — every Arsenal rifle that has at least one
// cartridge, each row a plain rifle name + a cartridge <select>, no other
// buttons (the same rifle+cartridge row idiom arsenal-view.js's own
// renderRifles()/buildCartridgeControls() uses for its "Other rifles"
// list, minus the compare/edit/delete buttons that don't apply here — this
// picker only ever reads a selection, it doesn't manage the library).
// Rendered once into a shown app-dialog.js bodyNode; picking a row is a
// one-shot action so there's no live re-render/refresh concern the way
// arsenal-view.js's own list has.
import { el } from '../dom.js';
import { loadUserRifles } from '../user-library.js';
import { hideDialog } from './app-dialog.js';

// `onPick(rifleId, cartridgeId)` fires after the dialog is already hidden
// — same ordering as every other "row picks, closes overlay" flow in this
// app (see e.g. arsenal-view.js's own target/target-picker equivalents).
export function rifleCartridgePickerBody({ onPick }) {
  const rifles = loadUserRifles().filter((r) => r.cartridges.length > 0);

  if (rifles.length === 0) {
    return el('p', { class: 'hint', i18n: 'riflePrecision.noArsenalCartridgesHint' });
  }

  const list = el('div', {});
  for (const rifle of rifles) {
    const select = el('select', {}, rifle.cartridges.map((c) => el('option', { value: c.id, text: c.name })));
    // Opening/changing the cartridge dropdown must not itself pick the
    // row — same convention as arsenal-view.js's own per-row cartridge
    // select (buildCartridgeControls()).
    select.addEventListener('click', (e) => e.stopPropagation?.());

    const row = el('div', { class: 'arsenal-row row-clickable' }, [
      el('div', { class: 'arsenal-row-info' }, [el('strong', { text: rifle.name })]),
      el('div', { class: 'arsenal-row-actions' }, [select])
    ]);
    row.addEventListener('click', () => {
      hideDialog();
      onPick(rifle.id, select.value);
    });
    list.appendChild(row);
  }
  return list;
}
