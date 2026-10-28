// Reticle Designer — draw a rifle scope reticle by drag and drop, for a
// fixed, first- or second-focal-plane scope. Five panes around the
// reticle: editing options (1), the reticle view (2), the element palette
// (3), the selected element's settings (4) and the list of elements (5),
// with the scope definition above them and the reticle's manufacturer and
// model, New, Save to arsenal, Discard changes and Insert whole reticle
// (another reticle's geometry, from the library). Reticles are kept in
// the Arsenal (reticle-library.js), which opens them here to add or edit.
//
// The reticle, its undo history and the editor settings live in session
// memory (reticle-designer-state.js): they survive moving to another tool
// and back, not a reload — a reload with unsaved changes asks first.
import { el, clear } from '../dom.js';
import { t, applyI18nText } from '../i18n.js';
import { hasUnsavedReticleChanges, getReticleTarget, setReticleReturnToArsenal } from '../reticle-designer-state.js';
import { setIdentity, documentOf } from '../reticle/model.js';
import { getUserReticle, saveUserReticle, findUserReticleByName } from '../reticle-library.js';
import { generateUserId } from '../user-library.js';
import { opticLabel } from '../scope-record.js';
import { setPendingArsenalTab } from '../arsenal-prefill.js';
import { opticsManufacturerInput } from '../ui/arsenal/optics-manufacturer-field.js';
import { createController } from '../ui/reticle-designer/controller.js';
import { optionsPane } from '../ui/reticle-designer/options-pane.js';
import { reticleView } from '../ui/reticle-designer/reticle-view.js';
import { elementPalette } from '../ui/reticle-designer/element-palette.js';
import { elementSettingsPane } from '../ui/reticle-designer/element-settings.js';
import { elementListPane } from '../ui/reticle-designer/element-list.js';
import { scopeSection } from '../ui/reticle-designer/scope-section.js';
import { svgImportPanel } from '../ui/reticle-designer/svg-import-panel.js';
import { libraryInsertPanel } from '../ui/reticle-designer/library-insert-panel.js';

// How long a confirmation (the reticle saved) stays in the file bar.
const CONFIRMATION_MS = 4000;

// Arrow-key nudges move by one snap step, ten with Shift.
const FAST_NUDGE_STEPS = 10;
const NUDGE_KEYS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

let unloadGuardInstalled = false;

// The browser's own "leave site?" prompt, while changes aren't saved to
// the Arsenal — session memory doesn't survive a reload.
function installUnloadGuard() {
  if (unloadGuardInstalled) return;
  unloadGuardInstalled = true;
  window.addEventListener('beforeunload', (event) => {
    if (!hasUnsavedReticleChanges()) return;
    event.preventDefault();
    event.returnValue = '';
  });
}

function isTypingTarget(target) {
  const tag = target?.tagName;
  return tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || target?.isContentEditable;
}

export function mount(container) {
  clear(container);
  installUnloadGuard();

  const panes = [];
  const ctl = createController({ onChange: () => refresh() });

  // ---- file bar ----
  // The reticle's identity: its manufacturer and model, each edit an undo
  // step like any other.
  // The manufacturer suggests scope and reticle makers, never bullet ones.
  function identityInput(key, input) {
    input.setAttribute('maxlength', '80');
    input.value = ctl.doc[key];
    input.addEventListener('input', () => setIdentityFrom(key, input));
    input.addEventListener('blur', () => ctl.breakCoalescing());
    return input;
  }
  function setIdentityFrom(key, input) {
    input.classList.remove('field-invalid');
    ctl.commit(setIdentity(ctl.doc, { [key]: input.value }), { coalesceKey: key });
  }
  const manufacturerSuggest = opticsManufacturerInput({
    id: 'reticle-manufacturer',
    onPick: () => {
      setIdentityFrom('manufacturer', manufacturerSuggest.input);
      ctl.breakCoalescing();
    }
  });
  const manufacturerInput = identityInput('manufacturer', manufacturerSuggest.input);
  const modelInput = identityInput('model', el('input', { type: 'text', id: 'reticle-model' }));
  const identityField = (key, input, control = input) => el('label', { class: 'reticle-field reticle-identity-field', for: input.id }, [
    el('span', { class: 'reticle-field-label', i18n: `reticleDesigner.file.${key}` }),
    control
  ]);

  const unsaved = el('span', { class: 'reticle-unsaved', i18n: 'reticleDesigner.file.unsaved' });
  const fileMessage = el('p', { class: 'reticle-file-message', role: 'status' });
  // A confirmation (`ok`) clears itself after a while; an error stays until
  // the next message.
  let messageTimer = null;
  function showMessage(key, { ok = false } = {}) {
    if (messageTimer) clearTimeout(messageTimer);
    messageTimer = null;
    fileMessage.textContent = key ? t(key) : '';
    fileMessage.classList.toggle('ok', ok);
    if (key && ok) messageTimer = setTimeout(() => showMessage(null), CONFIRMATION_MS);
  }

  // To the Arsenal's Scopes tab: Return to arsenal, and Discard on a
  // reticle opened from there, once its changes are discarded. Save stays, so work can go on.
  function returnToArsenal() {
    setReticleReturnToArsenal(false);
    setPendingArsenalTab('scopes');
    location.hash = '#/guns/arsenal';
  }

  // A fresh start: the reticle and its undo history are scrapped, so
  // unsaved changes are asked about first.
  const newButton = el('button', { type: 'button', class: 'secondary', id: 'reticle-new', i18n: 'reticleDesigner.file.new' });
  newButton.addEventListener('click', () => {
    if (hasUnsavedReticleChanges() && !confirm(t('reticleDesigner.file.confirmNew'))) return;
    ctl.newDocument();
    showMessage(null);
  });

  // Saves the reticle to the Arsenal: as the reticle it was opened as (or
  // last saved as), or as a new one. Another reticle already under the same
  // manufacturer and model is replaced, once confirmed — the reticle
  // opened is then left as it was. Success is confirmed in the file bar,
  // without leaving the Designer. With nothing unsaved the button is
  // Return to arsenal instead.
  const saveButton = el('button', { type: 'button', id: 'reticle-save', i18n: 'reticleDesigner.file.saveToArsenal' });
  saveButton.addEventListener('click', () => {
    if (!hasUnsavedReticleChanges()) {
      returnToArsenal();
      return;
    }
    const missing = [[manufacturerInput, 'manufacturer'], [modelInput, 'model']].filter(([, key]) => !ctl.doc[key].trim());
    for (const [input] of missing) input.classList.add('field-invalid');
    if (missing.length) {
      showMessage('reticleDesigner.file.identityRequired');
      return;
    }
    const { reticleId } = getReticleTarget();
    const current = reticleId ? getUserReticle(reticleId) : null;
    const collision = findUserReticleByName(opticLabel(ctl.doc), { excludeId: current?.id });
    if (collision && !confirm(t('reticleDesigner.file.confirmOverwrite', { name: collision.name }))) return;
    const base = collision || current;
    const { damaged, ...kept } = base || {};
    const id = base ? base.id : generateUserId('user-reticle');
    saveUserReticle({ ...kept, ...documentOf(ctl.doc), id });
    ctl.markSaved(id);
    showMessage('reticleDesigner.file.saved', { ok: true });
  });

  // Back to the reticle as last saved to the Arsenal (or an empty one if it
  // never was), its undo history scrapped — asked first. Off while there
  // is nothing unsaved to discard.
  const discardButton = el('button', { type: 'button', class: 'secondary', id: 'reticle-discard', i18n: 'reticleDesigner.file.discard' });
  discardButton.addEventListener('click', () => {
    if (!hasUnsavedReticleChanges() || !confirm(t('reticleDesigner.file.confirmDiscard'))) return;
    const { reticleId, fromArsenal } = getReticleTarget();
    const saved = reticleId ? getUserReticle(reticleId) : null;
    ctl.revertTo(saved && !saved.damaged ? saved : null);
    showMessage(null);
    if (fromArsenal) returnToArsenal();
  });

  // Opens the panel that adds a whole library reticle to this one — a
  // reticle-wide action, so it sits here rather than among the elements.
  const insertReticleButton = el('button', { type: 'button', class: 'secondary', id: 'reticle-insert-library', i18n: 'reticleDesigner.file.insertReticle' });

  const fileBar = el('div', { class: 'card reticle-file-bar' }, [
    identityField('manufacturer', manufacturerInput, manufacturerSuggest.wrap),
    identityField('model', modelInput),
    el('div', { class: 'reticle-file-actions' }, [newButton, saveButton, discardButton, insertReticleButton, unsaved]),
    fileMessage
  ]);

  // ---- panes ----
  const scope = scopeSection(ctl);
  const options = optionsPane(ctl);
  const stage = reticleView(ctl);
  const svgImport = svgImportPanel(ctl);
  const libraryInsert = libraryInsertPanel(ctl);
  // One insert panel open at a time.
  const palette = elementPalette(ctl, { onImportSvg: () => { libraryInsert.close(); svgImport.open(); } });
  insertReticleButton.addEventListener('click', () => {
    ctl.setTool('select');
    svgImport.close();
    libraryInsert.open();
  });
  const settings = elementSettingsPane(ctl);
  const list = elementListPane(ctl);
  panes.push(scope, options, stage, palette, settings, list, libraryInsert);

  container.appendChild(el('div', { class: 'reticle-designer' }, [
    el('h1', { i18n: 'reticleDesigner.title' }),
    el('p', { class: 'reticle-intro', i18n: 'reticleDesigner.intro' }),
    fileBar,
    scope.node,
    svgImport.node,
    libraryInsert.node,
    el('div', { class: 'reticle-workspace' }, [options.node, palette.node, stage.node, settings.node, list.node])
  ]));

  function refresh() {
    for (const pane of panes) pane.update();
    const changed = hasUnsavedReticleChanges();
    unsaved.style.display = changed ? '' : 'none';
    const saveKey = changed ? 'reticleDesigner.file.saveToArsenal' : 'reticleDesigner.file.returnToArsenal';
    if (saveButton.getAttribute('data-i18n') !== saveKey) applyI18nText(saveButton, saveKey);
    discardButton.disabled = !changed;
    for (const [input, key] of [[manufacturerInput, 'manufacturer'], [modelInput, 'model']]) {
      if (document.activeElement !== input && input.value !== ctl.doc[key]) input.value = ctl.doc[key];
    }
  }
  refresh();

  // ---- keyboard ----
  function onKeyDown(event) {
    const mod = event.ctrlKey || event.metaKey;
    const key = event.key;
    if (mod && (key === 'z' || key === 'Z')) {
      if (isTypingTarget(event.target)) return;
      event.preventDefault();
      if (event.shiftKey) ctl.redo(); else ctl.undo();
      return;
    }
    if (mod && (key === 'y' || key === 'Y')) {
      if (isTypingTarget(event.target)) return;
      event.preventDefault();
      ctl.redo();
      return;
    }
    if (isTypingTarget(event.target) || mod) return;
    if (key === 'Escape') {
      if (ctl.editor.tool !== 'select') ctl.setTool('select');
      else ctl.setSelection([]);
      return;
    }
    if (key === 'Delete' || key === 'Backspace') {
      if (ctl.editor.selection.length === 0) return;
      event.preventDefault();
      ctl.deleteSelection();
      return;
    }
    const direction = NUDGE_KEYS[key];
    if (direction && ctl.editor.selection.length > 0) {
      event.preventDefault();
      const steps = event.shiftKey ? FAST_NUDGE_STEPS : 1;
      const distance = ctl.units.snapRad * steps;
      ctl.nudge(direction[0] * distance, direction[1] * distance, 'nudge');
    }
  }
  // Each press of an arrow key (or a held run of repeats) is one undo step.
  function onKeyUp(event) {
    if (NUDGE_KEYS[event.key]) ctl.breakCoalescing();
  }
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  return () => {
    if (messageTimer) clearTimeout(messageTimer);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
  };
}
