// Session state for the Reticle Designer: the reticle being edited, its
// undo history and the editor's own settings (unit switch, toggles, active
// tool, selection, view). Held in module memory only — it survives moving
// to another tool and back, but not a reload or an app restart; work is
// kept by saving it to a file. The view warns before a reload discards
// unsaved changes.
//
// Everything is in radians (see reticle/model.js); the unit switch here
// only decides how the tool shows its angles.
import { createDocument } from './reticle/model.js';
import { createHistory } from './reticle/history.js';
import { DEFAULT_RETICLE_UNITS } from './reticle/angle-units.js';

function defaultEditor() {
  return {
    units: DEFAULT_RETICLE_UNITS,
    grid: true,
    snap: true,
    showZero: true,
    showBdc: true,
    // Illuminated reticles only: draw lit elements in the illumination
    // colour, and darken the field as in low light.
    showIllumination: true,
    dimField: false,
    tool: 'select',
    selection: [],
    // { cx, cy (rad, the point shown at the centre), zoom (1 = fit the
    // field circle) } — null until the user first pans or zooms.
    view: null,
    // The scope's zoom ring as shown in the view (null = lowest
    // magnification) — a preview setting, not part of the reticle.
    magnification: null,
    // Shared default for the principal dimension of new lines and dots,
    // and the direction/count/step of a newly enabled repeat; null until
    // entered.
    lastPrincipal: null,
    lastRepeat: null,
    // The font, digit height and anchor last chosen for a number, for the
    // next one: { font, digitHeight, anchor }, each set once entered.
    lastNumber: null,
    // Whether the element last set lit or unlit was lit, for the next one.
    lastIlluminated: null
  };
}

function freshSession() {
  const history = createHistory(createDocument());
  return { history, editor: defaultEditor(), savedDoc: history.present };
}

let session = freshSession();

export function getReticleSession() {
  return session;
}

export function setReticleHistory(history) {
  session = { ...session, history };
}

export function patchReticleEditor(patch) {
  session = { ...session, editor: { ...session.editor, ...patch } };
}

// The document as last saved to (or loaded from) a file — compared by
// identity, so undoing back to it counts as unsaved changes gone.
export function markReticleSaved() {
  session = { ...session, savedDoc: session.history.present };
}

export function hasUnsavedReticleChanges() {
  return session.history.present !== session.savedDoc;
}

// A new, empty reticle with a fresh undo history — the old one is gone,
// not undoable. The editor's preferences (unit switch, toggles, the
// remembered defaults for new elements) are kept; what referred to the old
// reticle (selection, armed tool, view, magnification) is reset.
export function startNewReticle() {
  const history = createHistory(createDocument());
  session = {
    history,
    savedDoc: history.present,
    editor: { ...session.editor, tool: 'select', selection: [], view: null, magnification: null }
  };
}

export function resetReticleDesignerStateForTests() {
  session = freshSession();
}
