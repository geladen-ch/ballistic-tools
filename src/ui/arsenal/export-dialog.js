import { el } from '../../dom.js';

// Inline "Save Library" panel: lets the user pick which bullets/rifles to
// bundle into one exported JSON file. All checked by default (export
// everything unless something is explicitly excluded, the common case).
// A rifle can't be usefully exported without the bullet(s) its cartridges
// reference, so the two checkbox groups enforce that dependency both
// ways: checking a rifle (re-)checks whichever of its own bullets got
// unchecked, and unchecking a bullet takes every rifle that needs it back
// down with it — a checked rifle can never end up bundled without its
// own bullets. Purely a selection UI: onExport(...) receives the chosen
// ids and does nothing else here — arsenal-view.js is the one that
// actually builds and downloads the file (and marks the exported items
// saved) from that selection.
export function exportDialog({ bullets, rifles, onExport, onCancel }) {
  const userBulletIds = new Set(bullets.map((b) => b.id));
  const bulletCheckboxes = new Map(); // id -> checkbox element
  const rifleCheckboxes = new Map();

  function bulletIdsFor(rifle) {
    return rifle.cartridges.map((c) => c.bulletId).filter((id) => userBulletIds.has(id));
  }

  // Reverse index: bulletId -> the rifles that need it, so unchecking a
  // bullet can find every rifle that would otherwise end up exported with
  // a dangling cartridge reference.
  const riflesNeeding = new Map();
  for (const rifle of rifles) {
    for (const bulletId of bulletIdsFor(rifle)) {
      if (!riflesNeeding.has(bulletId)) riflesNeeding.set(bulletId, []);
      riflesNeeding.get(bulletId).push(rifle);
    }
  }

  const bulletRows = bullets.map((bullet) => {
    const checkbox = el('input', { type: 'checkbox', id: `export-bullet-${bullet.id}` });
    checkbox.checked = true;
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) return;
      for (const rifle of riflesNeeding.get(bullet.id) || []) {
        const rifleCheckbox = rifleCheckboxes.get(rifle.id);
        if (rifleCheckbox) rifleCheckbox.checked = false;
      }
    });
    bulletCheckboxes.set(bullet.id, checkbox);
    return el('label', { class: 'checkbox-field' }, [checkbox, bullet.name]);
  });

  const rifleRows = rifles.map((rifle) => {
    const checkbox = el('input', { type: 'checkbox', id: `export-rifle-${rifle.id}` });
    checkbox.checked = true;
    // Only cascades forward on check, not back onto other bullets on
    // uncheck — unchecking this rifle alone doesn't mean its bullets are
    // unwanted (another checked rifle might still need one, or the user
    // just wants the bullet on its own); see the bullet checkboxes' own
    // listener above for the direction that *is* enforced.
    checkbox.addEventListener('change', () => {
      if (!checkbox.checked) return;
      for (const bulletId of bulletIdsFor(rifle)) {
        const bulletCheckbox = bulletCheckboxes.get(bulletId);
        if (bulletCheckbox) bulletCheckbox.checked = true;
      }
    });
    rifleCheckboxes.set(rifle.id, checkbox);
    return el('label', { class: 'checkbox-field' }, [checkbox, rifle.name]);
  });

  const exportButton = el('button', { i18n: 'arsenal.exportButton' });
  const cancelButton = el('button', { class: 'secondary', i18n: 'arsenal.cancelButton' });

  exportButton.addEventListener('click', () => {
    const bulletIds = [...bulletCheckboxes].filter(([, cb]) => cb.checked).map(([id]) => id);
    const rifleIds = [...rifleCheckboxes].filter(([, cb]) => cb.checked).map(([id]) => id);
    if (onExport) onExport({ bulletIds, rifleIds });
  });
  cancelButton.addEventListener('click', () => { if (onCancel) onCancel(); });

  const node = el('div', { class: 'input-section nested' }, [
    el('h4', { i18n: 'arsenal.exportBulletsHeading' }),
    bullets.length ? el('div', {}, bulletRows) : el('p', { class: 'hint', i18n: 'arsenal.noBullets' }),
    el('h4', { i18n: 'arsenal.exportRiflesHeading' }),
    rifles.length ? el('div', {}, rifleRows) : el('p', { class: 'hint', i18n: 'arsenal.noRifles' }),
    el('div', { class: 'arsenal-form-actions' }, [exportButton, cancelButton])
  ]);

  return { node };
}
