// Range Solver's "Guns" modal — every way of changing the gun from inside
// the solver (the rail's and tab bar's Guns item, the gun summary's Change
// button) opens this instead of leaving for the Guns section. A concise
// list of the user's own Arsenal rifles: a rifle with a single cartridge
// activates on click; one with several expands its cartridges underneath
// (collapsing any other rifle's open list), and a cartridge click
// activates that rifle + cartridge. Either way the dialog closes and the
// solver remounts on the new configuration, keeping its current tab.
//
// Rifles without a cartridge are left out — there's nothing to activate.
// "Manage Arsenal" goes to Guns exactly as the old nav item did
// (goToGuns(): source-aware tab, return path recorded so Done comes back
// here); Cancel just closes.
//
// Activation writes the same { library: { rifleId, cartridgeId } } pointer
// arsenal-view.js's commitActiveRifleOnDone() does, so the rest of the app
// can't tell which of the two picked it.
import { el, clear } from '../../dom.js';
import { t } from '../../i18n.js';
import { loadUserRifles } from '../../user-library.js';
import { loadRifleState, saveRifleState } from '../../shot-state.js';
import { goToGuns } from '../../guns-nav.js';
import { getRangeSolverTab, setNextRangeSolverTab } from '../../range-solver-nav.js';
import { rerender } from '../../router.js';
import { showDialog, hideDialog } from '../app-dialog.js';
import { disambiguateByName } from '../../sync/disambiguate-by-name.js';
import { siToDisplay, unitChoice } from '../../units.js';
import { getUnit } from '../../prefs.js';
import { checkIcon, chevronIcon } from '../nav-icons.js';

function velocityText(cartridge) {
  if (!Number.isFinite(cartridge.muzzleVelocity)) return '';
  const unit = getUnit('velocity');
  const choice = unitChoice('muzzleVelocity', unit);
  return `${siToDisplay('muzzleVelocity', cartridge.muzzleVelocity, unit).toFixed(choice.decimals)} ${choice.label}`;
}

function cartridgeSummary(cartridge) {
  const velocity = velocityText(cartridge);
  return velocity ? `${cartridge.name} · ${velocity}` : cartridge.name;
}

// The body alone, for tests and for openRangeSolverGunPicker() below.
// `onPick(rifleId, cartridgeId)` fires after the dialog is already hidden.
export function rangeSolverGunPickerBody({ onPick }) {
  const rifles = loadUserRifles().filter((r) => r.cartridges.length > 0);
  if (rifles.length === 0) {
    return el('p', { class: 'hint', i18n: 'rangeSolver.gunPicker.emptyHint' });
  }

  const labels = disambiguateByName(rifles);
  const active = loadRifleState()?.library || null;
  const activeRifle = active ? rifles.find((r) => r.id === active.rifleId) : null;
  // The active rifle opens with its cartridges already showing, so the
  // current load is visible without a click.
  let expandedRifleId = activeRifle && activeRifle.cartridges.length > 1 ? activeRifle.id : null;

  const list = el('div', { class: 'gun-picker' });

  function pick(rifleId, cartridgeId) {
    hideDialog();
    onPick(rifleId, cartridgeId);
  }

  function loadButton(rifle, cartridge) {
    const isCurrent = !!active && active.rifleId === rifle.id && active.cartridgeId === cartridge.id;
    const button = el('button', {
      type: 'button',
      class: 'gun-picker-load' + (isCurrent ? ' current' : ''),
      'aria-current': isCurrent ? 'true' : null
    }, [
      el('span', { class: 'gun-picker-name', text: cartridge.name }),
      el('span', { class: 'gun-picker-detail', text: velocityText(cartridge) }),
      isCurrent ? checkIcon(14) : null
    ]);
    button.addEventListener('click', () => pick(rifle.id, cartridge.id));
    return button;
  }

  function rifleEntry(rifle) {
    const isCurrent = !!activeRifle && activeRifle.id === rifle.id;
    const single = rifle.cartridges.length === 1;
    const expanded = expandedRifleId === rifle.id;
    const detail = single
      ? cartridgeSummary(rifle.cartridges[0])
      : t('rangeSolver.gunPicker.loadCount', { count: rifle.cartridges.length });
    const button = el('button', {
      type: 'button',
      class: 'gun-picker-rifle' + (isCurrent ? ' current' : '') + (expanded ? ' expanded' : ''),
      'aria-expanded': single ? null : String(expanded),
      'aria-current': isCurrent && single ? 'true' : null
    }, [
      el('span', { class: 'gun-picker-name', text: labels.get(rifle.id) || rifle.name }),
      el('span', { class: 'gun-picker-detail', text: detail }),
      single
        ? (isCurrent ? checkIcon(14) : null)
        : el('span', { class: 'chev' + (expanded ? ' open' : '') }, [chevronIcon(9)])
    ]);
    button.addEventListener('click', () => {
      if (single) {
        pick(rifle.id, rifle.cartridges[0].id);
        return;
      }
      expandedRifleId = expanded ? null : rifle.id;
      render();
    });

    const entry = el('div', { class: 'gun-picker-entry' }, [button]);
    if (!single && expanded) {
      entry.appendChild(el('div', { class: 'gun-picker-loads' },
        rifle.cartridges.map((c) => loadButton(rifle, c))));
    }
    return entry;
  }

  function render() {
    clear(list);
    for (const rifle of rifles) list.appendChild(rifleEntry(rifle));
  }

  render();
  return list;
}

// Activates the picked rifle + cartridge and remounts the solver on it,
// landing back on whichever input tab was showing.
function activate(rifleId, cartridgeId) {
  saveRifleState({ library: { rifleId, cartridgeId } });
  setNextRangeSolverTab(getRangeSolverTab());
  rerender();
}

export function openRangeSolverGunPicker() {
  showDialog({
    bodyNode: el('div', {}, [
      el('h3', { class: 'gun-picker-title', i18n: 'rangeSolver.gunPicker.title' }),
      rangeSolverGunPickerBody({ onPick: activate })
    ]),
    wide: true,
    buttons: [
      { label: t('rangeSolver.gunPicker.manageArsenal'), onClick: goToGuns },
      { label: t('rangeSolver.gunPicker.cancel') }
    ]
  });
}
