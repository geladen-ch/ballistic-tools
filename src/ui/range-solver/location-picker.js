// Range Solver's "Location" modal — the solver's Location nav item opens
// this instead of leaving for the Locations manager. The same shape as the
// Guns modal (gun-picker.js): a concise list of the user's saved locations,
// one row each, after a first "No location" row (single target, manual
// entry) that clears the active location; a click activates that row's
// choice, closes the dialog and remounts the solver, keeping its current pane.
//
// Locations without a target are left out — there's nothing to solve for.
// "Manage locations" goes to the Locations manager (goToLocations(): return
// path and solver pane recorded so Done comes back here); Cancel just closes.
//
// Activation goes through location-activation.js, the same routine the
// Locations manager's own list uses, so the rest of the app can't tell which
// of the two picked it.
import { el } from '../../dom.js';
import { t } from '../../i18n.js';
import { loadUserLocations } from '../../location-library.js';
import { loadRangeSolverLocationState } from '../../range-solver-state.js';
import { activateRangeSolverLocation } from '../../location-activation.js';
import { goToLocations } from '../../locations-nav.js';
import { getRangeSolverTab, setNextRangeSolverTab } from '../../range-solver-nav.js';
import { rerender } from '../../router.js';
import { showDialog, hideDialog } from '../app-dialog.js';
import { disambiguateByName } from '../../sync/disambiguate-by-name.js';
import { checkIcon } from '../nav-icons.js';

// The body alone, for tests and for openRangeSolverLocationPicker() below.
// `onPick(location)` fires after the dialog is already hidden; the first
// row, "No location", picks `null` (single target, manual entry).
export function rangeSolverLocationPickerBody({ onPick }) {
  const locations = loadUserLocations().filter((l) => l.targets.length > 0);
  const labels = disambiguateByName(locations);
  const activeId = loadRangeSolverLocationState()?.locationId ?? null;

  function row(loc, name, detail) {
    const isCurrent = (loc ? loc.id : null) === activeId;
    const button = el('button', {
      type: 'button',
      class: 'location-picker-row' + (isCurrent ? ' current' : ''),
      'aria-current': isCurrent ? 'true' : null
    }, [
      el('span', { class: 'gun-picker-name', text: name }),
      el('span', { class: 'gun-picker-detail', text: detail || '' }),
      isCurrent ? checkIcon(14) : null
    ]);
    button.addEventListener('click', () => {
      hideDialog();
      onPick(loc);
    });
    return el('div', { class: 'gun-picker-entry' }, [button]);
  }

  const list = el('div', { class: 'gun-picker location-picker' }, [
    row(null, t('rangeSolverLocations.noLocationOption'), null),
    ...locations.map((loc) => row(
      loc, labels.get(loc.id) || loc.name,
      t('rangeSolver.locationPicker.targetCount', { count: loc.targets.length })
    ))
  ]);
  if (locations.length > 0) return list;
  return el('div', {}, [list, el('p', { class: 'hint', i18n: 'rangeSolver.locationPicker.emptyHint' })]);
}

// Activates the picked location and remounts the solver on it, landing back
// on whichever pane was showing.
function activate(loc) {
  activateRangeSolverLocation(loc);
  setNextRangeSolverTab(getRangeSolverTab());
  rerender();
}

export function openRangeSolverLocationPicker() {
  showDialog({
    bodyNode: el('div', {}, [
      el('h3', { class: 'gun-picker-title', i18n: 'rangeSolver.locationPicker.title' }),
      rangeSolverLocationPickerBody({ onPick: activate })
    ]),
    wide: true,
    buttons: [
      { label: t('rangeSolver.locationPicker.manageLocations'), onClick: goToLocations },
      { label: t('rangeSolver.locationPicker.cancel') }
    ]
  });
}
