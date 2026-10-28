import { el } from '../../dom.js';

// Inline "Save Library" panel: lets the user pick which bullets, rifles,
// scopes and reticles to bundle into one exported JSON file. All checked
// by default (export everything unless something is explicitly excluded,
// the common case). `groups` limits the panel to some of the four (the
// Scopes tab's own Save offers just scopes and reticles).
//
// A rifle can't be usefully exported without the bullet(s) its cartridges
// reference, so those two groups enforce that dependency both ways:
// checking a rifle (re-)checks whichever of its own bullets got
// unchecked, and unchecking a bullet takes every rifle that needs it back
// down with it. A rifle's scope, and a scope's reticles, are only ticked
// along with it — the rifle or scope stays usable without them (its link
// simply doesn't resolve on another device until they're there), so
// leaving them out is the user's choice. Purely a selection UI:
// onExport(...) receives the chosen ids and does nothing else —
// arsenal-view.js is the one that actually builds and downloads the file
// (and marks the exported items saved) from that selection.
export const EXPORT_GROUPS = ['bullets', 'rifles', 'scopes', 'reticles'];

export function exportDialog({
  bullets = [], rifles = [], scopes = [], reticles = [], groups = EXPORT_GROUPS, onExport, onCancel
}) {
  const shown = new Set(groups);
  const userBulletIds = new Set(bullets.map((b) => b.id));
  const checkboxes = { bullets: new Map(), rifles: new Map(), scopes: new Map(), reticles: new Map() };
  const check = (group, id) => {
    const checkbox = checkboxes[group].get(id);
    if (checkbox) checkbox.checked = true;
  };

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

  function rows(group, items, onChange) {
    return items.map((item) => {
      const checkbox = el('input', { type: 'checkbox', id: `export-${group.slice(0, -1)}-${item.id}` });
      checkbox.checked = true;
      checkbox.addEventListener('change', () => onChange(item, checkbox.checked));
      checkboxes[group].set(item.id, checkbox);
      return el('label', { class: 'checkbox-field' }, [checkbox, item.name]);
    });
  }

  const bulletRows = rows('bullets', bullets, (bullet, checked) => {
    if (checked) return;
    for (const rifle of riflesNeeding.get(bullet.id) || []) {
      const rifleCheckbox = checkboxes.rifles.get(rifle.id);
      if (rifleCheckbox) rifleCheckbox.checked = false;
    }
  });
  // Only cascades forward on check, not back on uncheck — unchecking a
  // rifle doesn't mean its bullets or scope are unwanted (another checked
  // rifle might still need one, or the user just wants it on its own).
  const rifleRows = rows('rifles', rifles, (rifle, checked) => {
    if (!checked) return;
    for (const bulletId of bulletIdsFor(rifle)) check('bullets', bulletId);
    if (rifle.scopeId) checkScope(rifle.scopeId);
  });
  function checkScope(scopeId) {
    check('scopes', scopeId);
    const scope = scopes.find((s) => s.id === scopeId);
    for (const reticleId of scope ? scope.reticleIds : []) check('reticles', reticleId);
  }
  const scopeRows = rows('scopes', scopes, (scope, checked) => {
    if (checked) checkScope(scope.id);
  });
  const reticleRows = rows('reticles', reticles, () => {});

  const exportButton = el('button', { i18n: 'arsenal.exportButton' });
  const cancelButton = el('button', { class: 'secondary', i18n: 'arsenal.cancelButton' });

  const checkedIds = (group) => (shown.has(group) ? [...checkboxes[group]].filter(([, cb]) => cb.checked).map(([id]) => id) : []);
  exportButton.addEventListener('click', () => {
    if (onExport) {
      onExport({
        bulletIds: checkedIds('bullets'), rifleIds: checkedIds('rifles'),
        scopeIds: checkedIds('scopes'), reticleIds: checkedIds('reticles')
      });
    }
  });
  cancelButton.addEventListener('click', () => { if (onCancel) onCancel(); });

  const sections = {
    bullets: [el('h4', { i18n: 'arsenal.exportBulletsHeading' }), bullets.length ? el('div', {}, bulletRows) : el('p', { class: 'hint', i18n: 'arsenal.noBullets' })],
    rifles: [el('h4', { i18n: 'arsenal.exportRiflesHeading' }), rifles.length ? el('div', {}, rifleRows) : el('p', { class: 'hint', i18n: 'arsenal.noRifles' })],
    scopes: [el('h4', { i18n: 'arsenal.exportScopesHeading' }), scopes.length ? el('div', {}, scopeRows) : el('p', { class: 'hint', i18n: 'arsenal.noScopes' })],
    reticles: [el('h4', { i18n: 'arsenal.exportReticlesHeading' }), reticles.length ? el('div', {}, reticleRows) : el('p', { class: 'hint', i18n: 'arsenal.noReticles' })]
  };
  const children = EXPORT_GROUPS.filter((group) => shown.has(group)).flatMap((group) => sections[group]);
  if (shown.has('scopes')) children.push(el('p', { class: 'hint', i18n: 'arsenal.exportOpticsHint' }));
  children.push(el('div', { class: 'arsenal-form-actions' }, [exportButton, cancelButton]));

  return { node: el('div', { class: 'input-section nested' }, children) };
}
