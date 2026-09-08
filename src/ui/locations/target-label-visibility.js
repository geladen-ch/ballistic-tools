// Implements settings.rangeSolverLabelVisibilityLabel's three modes for
// the "pick target on image" pins both location-placement-view.js's
// select mode and range-card-panel.js render (a `.target-photo-overlay-
// pin` <button> per placed target, each holding a `.target-photo-overlay-
// pin-label` span) — never the top-left unplaced-target chip stack, which
// has no separate label to hide (the chip's whole visible content *is*
// its label) and isn't positioned on the photo in the first place, so
// there's nothing to declutter there.
//
// One instance is meant to live as long as its caller's own view/panel
// does (created once, not per render pass) — "tap" mode's revealed state
// needs to survive range-card-panel.js's own frequent renderPins()
// rebuilds (every refresh(), e.g. from a wind-knob drag), which is why
// bindPin()/beginRender() below are designed to be called again on every
// rebuild while revealedId itself lives outside any of it.
import { getTargetLabelVisibility } from '../../range-solver-prefs.js';

const HIDDEN_CLASS = 'target-photo-overlay-pin-label--hidden';
// "the radius of a typical label width" — measured live off whatever
// labels are actually on screen (so it tracks font-size/interface-scale
// changes automatically, see ui-scale-prefs.js) rather than a guessed
// constant; this floor only matters for the degenerate case of a single
// very short label (e.g. "45m") whose own width alone would otherwise
// make the decluttering radius unreasonably small.
const MIN_DECLUTTER_RADIUS_PX = 40;

export function createTargetLabelVisibility() {
  const mode = getTargetLabelVisibility();
  let revealedId = null; // "tap" mode only
  let registry = []; // [{targetId, label}] — rebuilt via beginRender()/bindPin() each render pass

  // Call once at the top of whatever loop builds this render pass's pins
  // (renderPins()'s own loop, or select mode's one-time build in
  // location-placement-view.js's mount()) — clears stale entries from a
  // previous pass so applyRevealed() below never touches a detached label.
  function beginRender() {
    if (mode === 'tap') registry = [];
  }

  function applyRevealed() {
    for (const { targetId, label } of registry) {
      label.classList.toggle(HIDDEN_CLASS, targetId !== revealedId);
    }
  }

  // Call once per pin, right after building its label element, in place
  // of wiring the pin's click listener directly to onSelect. In every
  // mode but "tap" this just returns onSelect unchanged. In "tap" mode it
  // registers the pin (so a later tap elsewhere can hide its label again)
  // and returns a click handler implementing "show on first tap, select
  // on second tap on that same, already-revealed target" — tapping a
  // different target reveals that one instead and re-hides whatever was
  // previously shown.
  function bindPin(targetId, labelEl, onSelect) {
    if (mode !== 'tap') return onSelect;
    registry.push({ targetId, label: labelEl });
    labelEl.classList.toggle(HIDDEN_CLASS, targetId !== revealedId);
    return () => {
      if (revealedId === targetId) {
        revealedId = null;
        applyRevealed();
        onSelect();
      } else {
        revealedId = targetId;
        applyRevealed();
      }
    };
  }

  // A tap on empty photo background — wire this into photoViewport()'s
  // own onMarkerMove (its "plain tap on empty background" hook; select-
  // mode pins are real <button>s, already excluded from its gesture
  // handling entirely, so this never fires for a pin tap, only a genuine
  // background one). Harmless to wire in every mode; only "tap" ever has
  // anything revealed to clear.
  function clearRevealed() {
    if (mode !== 'tap' || revealedId === null) return;
    revealedId = null;
    applyRevealed();
  }

  function pinCenterDistance(pinEl, clientX, clientY) {
    const rect = pinEl.getBoundingClientRect();
    return Math.hypot(clientX - (rect.left + rect.width / 2), clientY - (rect.top + rect.height / 2));
  }

  // "declutter" mode — hides labels near the pointer, except the single
  // closest one. Recomputed from scratch against whatever pins currently
  // exist each time (rather than a registry like "tap" mode above), so it
  // stays correct across renderPins() rebuilds with no bookkeeping.
  function applyDeclutter(containerNode, clientX, clientY) {
    const entries = [];
    for (const pin of containerNode.querySelectorAll('.target-photo-overlay-pin')) {
      const label = pin.querySelector('.target-photo-overlay-pin-label');
      if (!label) continue;
      entries.push({ label, dist: pinCenterDistance(pin, clientX, clientY), width: label.getBoundingClientRect().width });
    }
    if (!entries.length) return;
    const radius = Math.max(MIN_DECLUTTER_RADIUS_PX, ...entries.map((en) => en.width));
    const near = entries.filter((en) => en.dist < radius);
    const closest = near.length ? near.reduce((a, b) => (b.dist < a.dist ? b : a)) : null;
    for (const en of entries) en.label.classList.toggle(HIDDEN_CLASS, near.includes(en) && en !== closest);
  }

  function clearDeclutter(containerNode) {
    for (const label of containerNode.querySelectorAll('.target-photo-overlay-pin-label')) {
      label.classList.remove(HIDDEN_CLASS);
    }
  }

  // Call once against the photoViewport()'s own outer `.node` right after
  // creating it (a no-op outside "declutter" mode). Live pointer position
  // only — mouse-only per settings.rangeSolverLabelVisibilityHint, so a
  // touch-only device simply never triggers any hiding, same as "always".
  function wire(containerNode) {
    if (mode !== 'declutter') return;
    let rafId = null;
    let pending = null;
    containerNode.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      pending = { x: e.clientX, y: e.clientY };
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        if (pending) applyDeclutter(containerNode, pending.x, pending.y);
      });
    });
    containerNode.addEventListener('pointerleave', (e) => {
      if (e.pointerType !== 'mouse') return;
      pending = null;
      if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
      clearDeclutter(containerNode);
    });
  }

  return { beginRender, bindPin, clearRevealed, wire };
}
