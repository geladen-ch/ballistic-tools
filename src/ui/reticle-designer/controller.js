// The Reticle Designer's actions: every change the panes make goes through
// here, so each one lands in the session state (reticle-designer-state.js)
// and the undo history the same way, and every pane is told to refresh.
// No DOM.
//
// Selection entries are element ids or group ids. Selecting a group stands
// for all its members; a member can also be selected on its own (from the
// elements list), which edits just that element.
import {
  getReticleSession, setReticleHistory, patchReticleEditor, markReticleSaved, startNewReticle
} from '../../reticle-designer-state.js';
import { commit, undo, redo, breakCoalescing, canUndo, canRedo } from '../../reticle/history.js';
import {
  addElement, deleteElements, duplicateElements, findElement, findGroup, groupElements, resolveElementIds,
  setIllumination, translate, ungroup
} from '../../reticle/model.js';
import { ELEMENT_TYPES, DEFAULT_REPEAT, createElement } from '../../reticle/element-types.js';
import { reticleUnits } from '../../reticle/angle-units.js';
import { normalizeShape } from '../../reticle/svg-import/shape.js';

export function createController({ onChange = () => {} } = {}) {
  let dragCounter = 0;
  const session = () => getReticleSession();

  function existingEntries(doc, entries) {
    return entries.filter((id) => findElement(doc, id) || findGroup(doc, id));
  }

  function notify() {
    onChange();
  }

  const ctl = {
    get doc() { return session().history.present; },
    get editor() { return session().editor; },
    get units() { return reticleUnits(session().editor.units); },
    canUndo: () => canUndo(session().history),
    canRedo: () => canRedo(session().history),

    // A unique coalescing key for one gesture (a drag, a placement), so
    // all its intermediate states are one undo step.
    gestureKey(kind) {
      dragCounter += 1;
      return `${kind}:${dragCounter}`;
    },

    commit(next, { coalesceKey = null, selection } = {}) {
      setReticleHistory(commit(session().history, next, { coalesceKey }));
      if (selection) patchReticleEditor({ selection });
      notify();
    },

    breakCoalescing() {
      setReticleHistory(breakCoalescing(session().history));
    },

    undo() {
      setReticleHistory(undo(session().history));
      patchReticleEditor({ selection: existingEntries(ctl.doc, ctl.editor.selection) });
      notify();
    },

    redo() {
      setReticleHistory(redo(session().history));
      patchReticleEditor({ selection: existingEntries(ctl.doc, ctl.editor.selection) });
      notify();
    },

    setEditor(patch) {
      patchReticleEditor(patch);
      notify();
    },

    setTool(tool) {
      patchReticleEditor({ tool });
      notify();
    },

    setSelection(entries) {
      patchReticleEditor({ selection: [...new Set(entries)], tool: 'select' });
      notify();
    },

    toggleSelection(entry) {
      const current = ctl.editor.selection;
      ctl.setSelection(current.includes(entry) ? current.filter((e) => e !== entry) : [...current, entry]);
    },

    // The selection entry a click on an element in the view stands for:
    // the element itself if it is already selected on its own, otherwise
    // its group (if any).
    entryForElement(id) {
      const element = findElement(ctl.doc, id);
      if (!element) return null;
      if (ctl.editor.selection.includes(id) || !element.groupId) return id;
      return element.groupId;
    },

    selectedElementIds() {
      return resolveElementIds(ctl.doc, ctl.editor.selection);
    },

    // A new element of `type` at (x, y) (and `end` for lines and bars),
    // with the shared defaults: the last principal dimension for lines
    // and dots, the last repeat direction/count/step.
    newElement(type, x, y, end) {
      const { units, lastPrincipal, lastRepeat, lastNumber, lastIlluminated } = ctl.editor;
      return createElement(type, {
        x, y, end, units,
        principal: ELEMENT_TYPES[type].principal ? lastPrincipal : null,
        repeat: lastRepeat,
        number: lastNumber,
        illuminated: lastIlluminated === true
      });
    },

    // Adds an element; returns its id. Selects it and returns to the
    // arrow tool. A BDC mark placed while marks are hidden shows them, so
    // it doesn't vanish as it is placed.
    place(element, { coalesceKey = null } = {}) {
      const { doc, id } = addElement(ctl.doc, element);
      patchReticleEditor(element.type === 'bdc' ? { tool: 'select', showBdc: true } : { tool: 'select' });
      ctl.commit(doc, { coalesceKey, selection: [id] });
      return id;
    },

    // Inserts an imported drawing with its origin at the reticle's zero,
    // re-validated here as well as in the worker. Returns its id, or null
    // when the shape is refused.
    placeSvg(shape, name) {
      let clean;
      try {
        clean = normalizeShape(shape);
      } catch {
        return null;
      }
      return ctl.place(createElement('svg', { x: 0, y: 0, units: ctl.editor.units, svg: { shape: clean, name } }));
    },

    // Repeat direction/count/step for a repeat being switched on: whatever
    // was last entered, else the defaults (down, and the unit system's
    // count and step).
    repeatDefaults() {
      const units = ctl.editor.units;
      return ctl.editor.lastRepeat || { direction: DEFAULT_REPEAT.direction, count: DEFAULT_REPEAT.count, step: DEFAULT_REPEAT.step[units] };
    },

    rememberPrincipal(value) {
      patchReticleEditor({ lastPrincipal: value });
    },

    // Merges a number setting just chosen (font, digitHeight or anchor)
    // into the defaults for the next number.
    rememberNumber(patch) {
      patchReticleEditor({ lastNumber: { ...ctl.editor.lastNumber, ...patch } });
    },

    rememberIlluminated(on) {
      patchReticleEditor({ lastIlluminated: on });
    },

    // The reticle's illumination, as an undo step. Switching it on also
    // turns on Show illumination, so the colour is seen at once.
    setIllumination(patch) {
      const next = setIllumination(ctl.doc, patch);
      if (next === ctl.doc) return;
      if (patch.enabled && !ctl.doc.illumination.enabled) patchReticleEditor({ showIllumination: true });
      ctl.commit(next);
    },

    rememberRepeat(repeat) {
      patchReticleEditor({ lastRepeat: { direction: repeat.direction, count: repeat.count, step: repeat.step } });
    },

    deleteSelection() {
      const ids = ctl.selectedElementIds();
      if (ids.length === 0) return;
      ctl.commit(deleteElements(ctl.doc, ids), { selection: [] });
    },

    duplicateSelection() {
      const ids = ctl.selectedElementIds();
      if (ids.length === 0) return;
      const offset = ctl.units.gridRad;
      const { doc, selection } = duplicateElements(ctl.doc, ids, offset, offset);
      ctl.commit(doc, { selection });
    },

    // Groups the selection; needs two or more elements in it.
    groupSelection() {
      const { doc, groupId } = groupElements(ctl.doc, ctl.selectedElementIds());
      if (groupId) ctl.commit(doc, { selection: [groupId] });
    },

    canGroup() {
      return ctl.selectedElementIds().length >= 2
        && !(ctl.editor.selection.length === 1 && findGroup(ctl.doc, ctl.editor.selection[0]));
    },

    selectedGroups() {
      const groups = new Set();
      for (const entry of ctl.editor.selection) {
        if (findGroup(ctl.doc, entry)) groups.add(entry);
        else if (findElement(ctl.doc, entry)?.groupId) groups.add(findElement(ctl.doc, entry).groupId);
      }
      return [...groups];
    },

    ungroupSelection() {
      let doc = ctl.doc;
      const selection = [];
      for (const groupId of ctl.selectedGroups()) {
        const result = ungroup(doc, groupId);
        doc = result.doc;
        selection.push(...result.ids);
      }
      if (doc !== ctl.doc) ctl.commit(doc, { selection });
    },

    // Arrow-key nudge of the selection, as one undo step per key run.
    nudge(dx, dy, coalesceKey) {
      const ids = ctl.selectedElementIds();
      if (ids.length === 0) return;
      const moved = translate(ctl.doc, ids, dx, dy);
      if (moved.doc !== ctl.doc) ctl.commit(moved.doc, { coalesceKey });
    },

    // A document read from a file replaces the current one, as one undo
    // step (so a mistaken load can be undone).
    loadDocument(doc) {
      ctl.commit(doc, { selection: [] });
      patchReticleEditor({ view: null });
      markReticleSaved();
      notify();
    },

    // Scraps the reticle and its undo history for an empty one.
    newDocument() {
      startNewReticle();
      notify();
    },

    markSaved() {
      markReticleSaved();
      notify();
    }
  };
  return ctl;
}
