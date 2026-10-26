// Reticle Designer — draw a rifle scope reticle by drag and drop, for a
// fixed, first- or second-focal-plane scope. Five panes around the
// reticle: editing options (1), the reticle view (2), the element palette
// (3), the selected element's settings (4) and the list of elements (5),
// with the scope definition above them and New / Save to file / Load from
// file.
//
// The reticle, its undo history and the editor settings live in session
// memory (reticle-designer-state.js): they survive moving to another tool
// and back, not a reload — a reload with unsaved changes asks first.
import { el, clear } from '../dom.js';
import { t } from '../i18n.js';
import { downloadFile } from '../download.js';
import { hasUnsavedReticleChanges } from '../reticle-designer-state.js';
import { serializeReticle, reticleFilename, FILE_EXTENSION, FILE_LIMITS } from '../reticle/file-codec.js';
import { loadReticleFile } from '../reticle/svg-import/client.js';
import { setName } from '../reticle/model.js';
import { createController } from '../ui/reticle-designer/controller.js';
import { optionsPane } from '../ui/reticle-designer/options-pane.js';
import { reticleView } from '../ui/reticle-designer/reticle-view.js';
import { elementPalette } from '../ui/reticle-designer/element-palette.js';
import { elementSettingsPane } from '../ui/reticle-designer/element-settings.js';
import { elementListPane } from '../ui/reticle-designer/element-list.js';
import { scopeSection } from '../ui/reticle-designer/scope-section.js';
import { svgImportPanel } from '../ui/reticle-designer/svg-import-panel.js';

// Arrow-key nudges move by one snap step, ten with Shift.
const FAST_NUDGE_STEPS = 10;
const NUDGE_KEYS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

let unloadGuardInstalled = false;

// The browser's own "leave site?" prompt, while changes aren't saved to a
// file — session memory doesn't survive a reload.
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
  const nameInput = el('input', { type: 'text', id: 'reticle-name', maxlength: '80', placeholder: t('reticleDesigner.file.namePlaceholder') });
  nameInput.value = ctl.doc.name;
  nameInput.addEventListener('input', () => ctl.commit(setName(ctl.doc, nameInput.value), { coalesceKey: 'name' }));
  nameInput.addEventListener('blur', () => ctl.breakCoalescing());

  const unsaved = el('span', { class: 'reticle-unsaved', i18n: 'reticleDesigner.file.unsaved' });
  const fileMessage = el('p', { class: 'reticle-file-message', role: 'status' });

  // A fresh start: the reticle and its undo history are scrapped, so
  // unsaved changes are asked about first.
  const newButton = el('button', { type: 'button', class: 'secondary', id: 'reticle-new', i18n: 'reticleDesigner.file.new' });
  newButton.addEventListener('click', () => {
    if (hasUnsavedReticleChanges() && !confirm(t('reticleDesigner.file.confirmNew'))) return;
    ctl.newDocument();
    nameInput.value = '';
    fileMessage.textContent = '';
  });

  const saveButton = el('button', { type: 'button', id: 'reticle-save', i18n: 'reticleDesigner.file.save' });
  saveButton.addEventListener('click', () => {
    downloadFile(reticleFilename(ctl.doc.name), serializeReticle(ctl.doc), 'application/json');
    fileMessage.textContent = '';
    ctl.markSaved();
  });

  const fileInput = el('input', { type: 'file', accept: `${FILE_EXTENSION},application/json` });
  fileInput.style.display = 'none';
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files && fileInput.files[0];
    fileInput.value = '';
    if (!file) return;
    // A file is untrusted input: checked and parsed in the import worker,
    // with a timeout, exactly like an SVG import.
    const show = (key) => { fileMessage.textContent = t(`reticleDesigner.file.errors.${key}`); };
    if (file.size > FILE_LIMITS.maxChars) return show('tooLarge');
    let text;
    try {
      text = await file.text();
    } catch {
      return show('invalidFormat');
    }
    const outcome = await loadReticleFile(text);
    if (!outcome.ok) {
      return show({ 'invalid-json': 'invalidJson', 'unsupported-version': 'newerVersion', 'too-large': 'tooLarge', timeout: 'timeout' }[outcome.code] || 'invalidFormat');
    }
    ctl.loadDocument(outcome.doc);
    nameInput.value = outcome.doc.name;
    fileMessage.textContent = '';
  });
  const loadButton = el('button', { type: 'button', class: 'secondary', id: 'reticle-load', i18n: 'reticleDesigner.file.load' });
  loadButton.addEventListener('click', () => {
    if (hasUnsavedReticleChanges() && !confirm(t('reticleDesigner.file.confirmReplace'))) return;
    fileInput.click();
  });

  const fileBar = el('div', { class: 'card reticle-file-bar' }, [
    el('label', { class: 'reticle-field reticle-name-field', for: 'reticle-name' }, [
      el('span', { class: 'reticle-field-label', i18n: 'reticleDesigner.file.name' }),
      nameInput
    ]),
    el('div', { class: 'reticle-file-actions' }, [newButton, saveButton, loadButton, unsaved]),
    fileInput,
    fileMessage
  ]);

  // ---- panes ----
  const scope = scopeSection(ctl);
  const options = optionsPane(ctl);
  const stage = reticleView(ctl);
  const svgImport = svgImportPanel(ctl);
  const palette = elementPalette(ctl, { onImportSvg: () => svgImport.open() });
  const settings = elementSettingsPane(ctl);
  const list = elementListPane(ctl);
  panes.push(scope, options, stage, palette, settings, list);

  container.appendChild(el('div', { class: 'reticle-designer' }, [
    el('h1', { i18n: 'reticleDesigner.title' }),
    el('p', { class: 'reticle-intro', i18n: 'reticleDesigner.intro' }),
    fileBar,
    scope.node,
    svgImport.node,
    el('div', { class: 'reticle-workspace' }, [options.node, palette.node, stage.node, settings.node, list.node])
  ]));

  function refresh() {
    for (const pane of panes) pane.update();
    unsaved.style.display = hasUnsavedReticleChanges() ? '' : 'none';
    if (document.activeElement !== nameInput && nameInput.value !== ctl.doc.name) nameInput.value = ctl.doc.name;
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
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
  };
}
