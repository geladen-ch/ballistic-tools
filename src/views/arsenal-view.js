import { el, clear } from '../dom.js';
import { t } from '../i18n.js';
import {
  loadUserBullets, saveUserBullet, deleteUserBullet, findUserBulletByName, markUserBulletsSaved, importUserBullet,
  loadUserRifles, saveUserRifle, deleteUserRifle, findUserRifleByName, markUserRiflesSaved, importUserRifle,
  generateUserId
} from '../user-library.js';
import { loadCaliberDesignations, designationFor, loadBullet } from '../bullets.js';
import { takePendingBulletPrefill, takePendingRiflePrefill } from '../arsenal-prefill.js';
import { loadRifleState, saveRifleState } from '../shot-state.js';
import { registerArsenalDoneHandler } from '../guns-nav.js';
import { bulletForm } from '../ui/arsenal/bullet-form.js';
import { rifleForm } from '../ui/arsenal/rifle-form.js';
import { cartridgeForm } from '../ui/arsenal/cartridge-form.js';
import { stabilityIndicator } from '../ui/stability-indicator.js';
import { isSpinDriftEnabled } from '../spin-drift-prefs.js';
import { isZeroForSpinDriftEnabled } from '../zero-spin-drift-prefs.js';
import { exportDialog } from '../ui/arsenal/export-dialog.js';
import { importDialog } from '../ui/arsenal/import-dialog.js';
import { buildExportPayload, serializeExport, collectRifleBulletIds, parseImportPayload, planImportBatch } from '../arsenal-export.js';
import {
  getComparisonSelection, isSelectedForComparison, canAddToComparison,
  addToComparison, removeFromComparison, removeRifleFromComparison
} from '../comparison-state.js';
import { getPool } from '../pool.js';
import { atmosphereSection } from '../ui/sections/atmosphere-section.js';
import { unitField } from '../ui/unit-field.js';
import { zoomRangeSlider } from '../ui/zoom-range-slider.js';
import { chartColumnSelect as buildChartColumnSelect, lineOfSightSeries, lineOfSightLegendItem } from '../ui/chart-column-select.js';
import { COLUMNS, CHART_POINTS_TARGET, MIN_ZOOM_WINDOW_M, CHART_DENSE_RANGE_STEP_M, resampleChartPoints } from '../trajectory-columns.js';
import { engineToDisplay, unitChoice, FIELD_BOUNDS } from '../units.js';
import { getUnit } from '../prefs.js';
import { LineChart } from '../vendor/chartist/index.js';
import { downloadButton } from '../ui/download-button.js';
import { exportChartSvg } from '../chart-svg-export.js';
import { downloadFile } from '../download.js';

const KG_TO_GRAIN = 15432.358352941432;
const ALL_VALUE = '__all__';

function downloadJsonFile(filename, text) {
  downloadFile(filename, text, 'application/json');
}

// Filenames are cosmetic only (the file's own `format`/contents are what
// actually matter on re-import) — just enough sanitizing that a bullet's
// or rifle's freely-typed name can't produce a broken/surprising filename.
function sanitizeFilename(name) {
  return name.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'arsenal';
}

export function mount(container) {
  clear(container);

  // Consumed exactly once, right here — see arsenal-prefill.js. Read into
  // a local rather than re-calling takePendingXPrefill() from inside the
  // render functions below, which would otherwise find it already
  // cleared by the very check that decided to open the form.
  let pendingBulletPrefill = takePendingBulletPrefill();
  let pendingRiflePrefill = takePendingRiflePrefill();

  // { id: null } while adding a brand new entry (not yet persisted),
  // { id: <string> } while editing an existing one — null (no value at
  // all) means the list is showing with no form open. A rifle's own
  // rifleFormState.id is only ever null (adding, rendered near "+ Add
  // Rifle") or activeRifleId (editing, rendered inside the "Active
  // rifle" pane — see renderActiveRifle()) since Edit is only offered
  // there now.
  let bulletFormState = null;
  let rifleFormState = null;
  // Cartridge management only ever applies to the *active* rifle (see
  // renderActiveRifle()) — { id: null } = adding a new cartridge to it,
  // { id: <string> } = editing one of its existing ones.
  let cartridgeFormState = null;

  // Only one add/edit form — bullet, rifle, or cartridge — is ever open
  // across the whole page. Every "open" action below calls this first
  // (before setting its own state), so opening one always closes and
  // discards whichever other was left open, rather than letting a second
  // one silently keep existing (and holding onto whatever was typed into
  // it) in the background. Doesn't itself re-render anything — callers
  // still call renderBulletForm()/renderRifleForm() afterward the same
  // way they always did, which is what actually clears the closed one's
  // own area from the page (see those functions' own "clear, then only
  // repopulate if still open" shape).
  function closeOtherForms(keep) {
    if (keep !== 'bullet') bulletFormState = null;
    if (keep !== 'rifle') rifleFormState = null;
    if (keep !== 'cartridge') cartridgeFormState = null;
  }

  // The rifle currently shown in the "Active rifle" pane, and which of
  // its cartridges is currently pointed at — page-local (not persisted)
  // staging, mirroring locations-view.js's own treatment of "whichever
  // location is current." Nothing here reaches shot-state.js's shared
  // cookie until Done is actually pressed (see commitActiveRifleOnDone()
  // below) — activating a rifle here only ever changes what this page
  // shows, same as locations-view.js's activateLocation().
  //
  // Seeded from shot-state.js's *persisted* rifle pointer so the pane
  // opens already showing whatever's actually running — but only when
  // that pointer resolves to one of the user's own Arsenal rifles; a
  // built-in-library selection or a fully manual entry both look the
  // same from here (neither is "in the Arsenal"), so both start out as
  // activeRifleId: null, the "manually defined" pane state.
  const initialRifleState = loadRifleState();
  const initialActiveRifle = initialRifleState && initialRifleState.library
    ? loadUserRifles().find((r) => r.id === initialRifleState.library.rifleId)
    : null;
  let activeRifleId = initialActiveRifle ? initialActiveRifle.id : null;
  let activeCartridgeId = initialActiveRifle
    ? (initialActiveRifle.cartridges.some((c) => c.id === initialRifleState.library.cartridgeId)
      ? initialRifleState.library.cartridgeId
      : (initialActiveRifle.cartridges[0] ? initialActiveRifle.cartridges[0].id : null))
    : null;

  // Whether the "Save Library" selection panel is currently open — the
  // one place a user picks *which* bullets/rifles to bundle into one
  // export; every other export (a single row's own "Save to file") just
  // exports that one item (plus, for a rifle, the bullets its cartridges
  // reference) directly, no picker needed.
  let exportDialogState = false;
  // Set once a picked file has been read and parsed (see the hidden
  // fileInput below) — { bullets, rifles } as found in the file, or null
  // while nothing's been picked / after Cancel or a completed import.
  let importState = null;
  let importErrorKey = null; // set instead of importState when the picked file fails to parse
  let importSummary = null; // { saved, skipped } shown once, right after a completed import

  let designations = [];

  const bulletsListEl = el('div');
  const bulletFormArea = el('div');
  const activeRifleListEl = el('div');
  // The whole "Active rifle" card, heading included — activating a rifle
  // scrolls to *this*, not just activeRifleListEl's own first child, so
  // the heading itself is what lands at the top of the viewport (see
  // scrollActiveRifleIntoView()), not scrolled just out of view above it.
  const activeRifleCard = el('div', { class: 'card' }, [
    el('h2', { i18n: 'arsenal.activeRifleHeading' }),
    activeRifleListEl
  ]);
  const riflesListEl = el('div');
  // Stable, reused nodes (never recreated — only cleared/refilled by
  // renderRifleForm() below) so they can be re-parented by
  // renderActiveRifle()/renderRifles() into whichever spot the currently
  // open rifle/cartridge form belongs in: nested under the active
  // rifle's own row (rifleFormArea) or its Cartridges section
  // (cartridgeFormArea) when editing/adding there, or down by "+ Add
  // Rifle" (rifleFormArea only — a brand-new rifle has no cartridges to
  // manage yet) when adding a new one. Same convention
  // locations-view.js's own locationFormArea/targetFormArea use.
  const rifleFormArea = el('div');
  const cartridgeFormArea = el('div');

  // Single stable instances (re-appended, never recreated, by
  // renderBullets()/renderRifles() below) — their visibility is toggled
  // by refreshAddButtonVisibility() instead, so opening/closing a form
  // doesn't need to rebuild either list just to hide/reveal these.
  // Hidden while ANY add/edit form is open (bullet, rifle, or cartridge),
  // not just the matching section's own, so there's never a second entry
  // point competing with whichever form is already open.
  const bulletAddButton = el('button', { id: 'arsenal-add-bullet', i18n: 'arsenal.addBulletButton' });
  bulletAddButton.addEventListener('click', () => {
    closeOtherForms('bullet');
    bulletFormState = { id: null };
    renderBulletForm();
    renderRifleForm();
    scrollBulletFormIntoView();
  });
  const rifleAddButton = el('button', { id: 'arsenal-add-rifle', i18n: 'arsenal.addRifleButton' });
  rifleAddButton.addEventListener('click', () => {
    closeOtherForms('rifle');
    rifleFormState = { id: null };
    renderRifleForm();
    renderBulletForm();
    scrollRifleFormIntoView();
  });
  function refreshAddButtonVisibility() {
    const anyFormOpen = !!bulletFormState || !!rifleFormState || !!cartridgeFormState;
    bulletAddButton.style.display = anyFormOpen ? 'none' : '';
    rifleAddButton.style.display = anyFormOpen ? 'none' : '';
  }
  const exportDialogArea = el('div');
  const importArea = el('div');
  const importErrorArea = el('p', { class: 'hint warning' });
  importErrorArea.style.display = 'none';
  const importSummaryArea = el('p', { class: 'hint' });
  importSummaryArea.style.display = 'none';

  // "For comparison" summary (up to two rifle+cartridge configs marked
  // from the rifle list below) and the "Comparison" section itself, which
  // only ever renders real content once exactly two are selected — see
  // renderComparisonSummary()/renderComparisonSection() further down.
  const comparisonSummaryEl = el('div');
  const comparisonSectionEl = el('div', { id: 'comparison-section' });

  function bulletCaliberLabel(bullet) {
    return designations.length ? designationFor(bullet.caliberM, designations) : `${(bullet.caliberM * 1000).toFixed(2)}mm`;
  }

  // === Caliber/manufacturer filters, shared by the rifle and bullet lists ===
  //
  // A rifle has no caliber of its own — it's derived from whichever
  // bullets its cartridges point at. A rifle with no cartridges, or whose
  // cartridges don't resolve to a known user bullet, contributes no
  // caliber and so only ever shows up under "All calibers".
  function rifleDesignations(rifle, userBullets) {
    const calibers = new Set();
    for (const cartridge of rifle.cartridges) {
      const bullet = userBullets.find((b) => b.id === cartridge.bulletId);
      if (bullet) calibers.add(bulletCaliberLabel(bullet));
    }
    return calibers;
  }

  // A rifle has no manufacturer of its own either — same derivation as
  // rifleDesignations() above, just collecting each cartridge's bullet's
  // manufacturer instead of its caliber. Selecting a manufacturer hides
  // any rifle that has no cartridge loaded with a bullet from it.
  function rifleManufacturers(rifle, userBullets) {
    const manufacturers = new Set();
    for (const cartridge of rifle.cartridges) {
      const bullet = userBullets.find((b) => b.id === cartridge.bulletId);
      if (bullet) manufacturers.add(bullet.manufacturer);
    }
    return manufacturers;
  }

  const caliberFilter = el('select', { id: 'arsenal-caliber-filter' }, [
    el('option', { value: ALL_VALUE, i18n: 'fields.bulletFilterAllCalibers' })
  ]);
  const manufacturerFilter = el('select', { id: 'arsenal-manufacturer-filter' }, [
    el('option', { value: ALL_VALUE, i18n: 'fields.bulletFilterAllManufacturers' })
  ]);
  caliberFilter.addEventListener('change', refreshLibraryView);
  manufacturerFilter.addEventListener('change', refreshLibraryView);

  const resetFiltersButton = el('button', { class: 'secondary', id: 'arsenal-reset-filters', i18n: 'arsenal.resetFiltersButton' });
  resetFiltersButton.addEventListener('click', () => {
    caliberFilter.value = ALL_VALUE;
    manufacturerFilter.value = ALL_VALUE;
    refreshLibraryView();
  });

  const filterCard = el('div', { class: 'card', id: 'arsenal-filter-card' }, [
    el('div', { class: 'arsenal-filter-row' }, [
      el('div', { class: 'field' }, [el('label', { i18n: 'fields.bulletCaliberFilter' }), caliberFilter]),
      el('div', { class: 'field' }, [el('label', { i18n: 'fields.bulletManufacturerFilter' }), manufacturerFilter])
    ]),
    resetFiltersButton
  ]);

  function rebuildFilterSelect(select, values, allLabelKey, previousValue) {
    clear(select);
    select.appendChild(el('option', { value: ALL_VALUE, i18n: allLabelKey }));
    for (const v of values) select.appendChild(el('option', { value: v, text: v }));
    select.value = values.includes(previousValue) ? previousValue : ALL_VALUE;
  }

  // Ordered by actual bore diameter, not a string sort of the designation
  // labels — same reasoning as bullet-section.js's own filter. Every
  // label here (bullet- or rifle-derived) traces back to some user
  // bullet's own caliberM via bulletCaliberLabel(), so one lookup built
  // from *every* bullet (not just whatever the manufacturer filter
  // currently narrows to) covers both.
  function sortCaliberLabelsByDiameter(labels, allBullets) {
    const caliberMByLabel = new Map();
    for (const b of allBullets) {
      const label = bulletCaliberLabel(b);
      if (!caliberMByLabel.has(label)) caliberMByLabel.set(label, b.caliberM);
    }
    return [...labels].sort((a, b) => caliberMByLabel.get(a) - caliberMByLabel.get(b));
  }

  // Manufacturer only ever describes a bullet directly, so its own option
  // list is always driven from (possibly caliber-filtered) bullets alone
  // — same mutual-narrowing bulletSection.js's own picker filters use.
  // A rifle has no manufacturer of its own, but a manufacturer selection
  // still hides any rifle none of whose cartridges carry a bullet from it
  // (see renderRifles()) — so the caliber list has to match: it includes
  // a rifle-derived caliber only from a rifle that would still be shown
  // under the current manufacturer filter, same as it only includes a
  // bullet-derived caliber from a bullet that matches it.
  function refreshFilterOptions() {
    const bullets = loadUserBullets();
    const rifles = loadUserRifles();
    const currentCaliber = caliberFilter.value;
    const currentManufacturer = manufacturerFilter.value;

    const manufacturers = [...new Set(
      bullets.filter((b) => currentCaliber === ALL_VALUE || bulletCaliberLabel(b) === currentCaliber).map((b) => b.manufacturer)
    )].sort();

    const bulletCalibers = bullets
      .filter((b) => currentManufacturer === ALL_VALUE || b.manufacturer === currentManufacturer)
      .map((b) => bulletCaliberLabel(b));
    const rifleCalibers = rifles
      .filter((r) => currentManufacturer === ALL_VALUE || rifleManufacturers(r, bullets).has(currentManufacturer))
      .flatMap((r) => [...rifleDesignations(r, bullets)]);
    const calibers = sortCaliberLabelsByDiameter([...new Set([...bulletCalibers, ...rifleCalibers])], bullets);

    rebuildFilterSelect(manufacturerFilter, manufacturers, 'fields.bulletFilterAllManufacturers', currentManufacturer);
    rebuildFilterSelect(caliberFilter, calibers, 'fields.bulletFilterAllCalibers', currentCaliber);

    // Nothing to filter — the whole card (including "Reset filters") only
    // adds noise to an empty library.
    filterCard.style.display = (bullets.length === 0 && rifles.length === 0) ? 'none' : '';
  }

  // The one place that re-derives filter options and re-renders both
  // lists together — called after anything that changes what's in the
  // library (add/edit/delete/import/export/caliber-designations-loaded),
  // so the filters and the lists they drive can never go stale relative
  // to each other. A few call sites that only touch comparison state
  // (nothing about the library itself changed) call renderRifles() alone
  // instead — see their own comments.
  function refreshLibraryView() {
    refreshFilterOptions();
    renderActiveRifle();
    renderRifles();
    renderBullets();
  }

  // Purely local bookkeeping (see user-library.js) — never shown for a
  // built-in entry (which has no such field at all), only ever for the
  // user's own bullets/rifles once they've been created/edited/imported
  // since their last export.
  function unsavedBadge(entry) {
    if (!entry.unsaved) return null;
    return el('span', { class: 'unsaved-badge', title: t('arsenal.unsavedBadgeTitle'), text: t('arsenal.unsavedBadge') });
  }

  // A rifle with no cartridges has nothing to offer Trajectory/Hit
  // Probability (no muzzle velocity, no bullet) — shown on every row that
  // has one, active or not, so it's visible before you even open it.
  function unusableBadge(rifle) {
    if (rifle.cartridges.length > 0) return null;
    return el('span', { class: 'unusable-badge', title: t('arsenal.unusableBadgeTitle'), text: t('arsenal.unusableBadge') });
  }

  function exportSingleBullet(bullet) {
    const payload = buildExportPayload({ bullets: [bullet], rifles: [] });
    downloadJsonFile(`gb-bullet-${sanitizeFilename(bullet.name)}.json`, serializeExport(payload));
    markUserBulletsSaved([bullet.id]);
    refreshLibraryView();
  }

  // Bundles the rifle together with whatever user-library bullets its own
  // cartridges reference — see the mount() function's own class comment
  // for why every cartridge should already resolve to one.
  function exportSingleRifle(rifle) {
    const allUserBullets = loadUserBullets();
    const bulletIds = collectRifleBulletIds(rifle, new Set(allUserBullets.map((b) => b.id)));
    const bullets = allUserBullets.filter((b) => bulletIds.has(b.id));
    const payload = buildExportPayload({ bullets, rifles: [rifle] });
    downloadJsonFile(`gb-rifle-${sanitizeFilename(rifle.name)}.json`, serializeExport(payload));
    markUserBulletsSaved([...bulletIds]);
    markUserRiflesSaved([rifle.id]);
    refreshLibraryView();
  }

  // Built-in-library records have no modifiedAt at all; a user record
  // saved before this field existed won't either, until its next save —
  // both cases just omit the line rather than showing a bogus date.
  // Deliberately UTC and hand-formatted (not toLocaleDateString) so the
  // displayed value doesn't depend on the host's locale/timezone.
  function lastModifiedLabel(entry) {
    if (!entry.modifiedAt) return null;
    const date = new Date(entry.modifiedAt);
    if (Number.isNaN(date.getTime())) return null;
    return t('arsenal.lastModified', { date: date.toISOString().slice(0, 16).replace('T', ' ') });
  }

  // === Comparison: up to two rifle+cartridge configs, side by side ===
  //
  // A comparison entry is a (rifleId, cartridgeId) pointer, resolved fresh
  // against the current Arsenal on every render — same spirit as
  // activeRifleId/activeCartridgeId above, which stage the same shaped
  // pointer rather than a snapshot, so an edit to the rifle/cartridge
  // afterward is always reflected. Returns null for a pointer that no
  // longer resolves (deleted since being marked) — shouldn't normally
  // happen, since the rifle/cartridge delete handlers below prune
  // comparison-state.js first, but
  // callers still check for it rather than assume.
  function resolveComparisonConfig(sel) {
    const rifle = loadUserRifles().find((r) => r.id === sel.rifleId);
    if (!rifle) return null;
    const cartridge = rifle.cartridges.find((c) => c.id === sel.cartridgeId);
    if (!cartridge) return null;
    return { rifle, cartridge };
  }

  // A user rifle's cartridge is meant to always point at a user-library
  // bullet (cartridge-form.js copies a built-in bullet in on save rather
  // than referencing it directly — see its own comment), but hand-
  // authored or imported data isn't guaranteed to hold that invariant —
  // falls back to the built-in catalog for anything not found locally,
  // the same two-step lookup bulletSection.js's findKnownBullet() uses for
  // the rifle-driven "lock to bullet" path.
  async function resolveComparisonBullet(cartridge) {
    const userBullet = loadUserBullets().find((b) => b.id === cartridge.bulletId);
    if (userBullet) return userBullet;
    return loadBullet(cartridge.bulletId);
  }

  function bulletProfileValues(bullet) {
    if (bullet.profile.type === 'cdTable') {
      return { cdTable: bullet.profile.table, massKg: bullet.massKg, caliberM: bullet.caliberM };
    }
    return { bc: bullet.profile.bc, dragModel: bullet.profile.model, massKg: bullet.massKg };
  }

  function clickSettingsFor(rifle) {
    return { horizontal: rifle.defaultClickHorizontal, vertical: rifle.defaultClickVertical, unit: rifle.defaultClickUnit };
  }

  function rifleTwistMm(rifle) {
    return rifle.defaultRiflingTwistM != null ? rifle.defaultRiflingTwistM * 1000 : null;
  }

  // A rifle chambers one caliber — once any of its cartridges already has
  // a resolvable bullet, that bullet's own caliber governs every other
  // cartridge on the same rifle too, so the cartridge form's own caliber
  // filter locks to it (see cartridge-form.js's own lockedCaliberM).
  // Checking every cartridge (not just "other" ones) means editing the
  // very cartridge that first established the caliber still finds it —
  // consistent, since its own bullet is exactly why it's locked. A rifle
  // with no cartridge carrying a resolvable bullet yet (its first one
  // being added right now, or a rifle whose only cartridges still
  // reference a since-deleted bullet) returns null — nothing to lock to.
  //
  // Exception: editing the rifle's *only* cartridge (editingCartridgeId
  // matches it, and there's nothing else on the rifle to stay consistent
  // with) leaves the choice open too — there's no sibling caliber to
  // protect, so the user is free to change their mind about what this
  // cartridge itself chambers.
  function lockedCaliberMForRifle(rifle, userBullets, editingCartridgeId = null) {
    if (editingCartridgeId != null && rifle.cartridges.length === 1 && rifle.cartridges[0].id === editingCartridgeId) {
      return null;
    }
    for (const cartridge of rifle.cartridges) {
      const bullet = userBullets.find((b) => b.id === cartridge.bulletId);
      if (bullet) return bullet.caliberM;
    }
    return null;
  }

  // Miller's-formula stability inputs for one saved rifle+cartridge
  // combination — used by both renderCartridges()'s per-row chip and
  // renderRifles()'s collapsed-row chip. A saved cartridge's bulletId is
  // meant to always resolve to a user-library bullet (see
  // resolveComparisonBullet()'s own comment above) — this reads that same
  // way, just without the built-in-catalog fallback, since a stability
  // chip has no need to await a network fetch for what should already be
  // local.
  function stabilityValuesFor(rifle, cartridge, userBullets) {
    const bullet = userBullets.find((b) => b.id === cartridge.bulletId);
    return {
      massKg: bullet ? bullet.massKg : null,
      caliberM: bullet ? bullet.caliberM : null,
      lengthM: bullet ? bullet.lengthM : null,
      muzzleVelocity: cartridge.muzzleVelocity,
      riflingTwistMm: rifleTwistMm(rifle)
    };
  }

  // Builds one config's full engine input: everything the rifle/cartridge/
  // bullet themselves fix, plus whatever's shared across both configs
  // being compared (maxRange + the chart's dense sampling resolution,
  // atmosphere+wind from the Comparison section's own control). No line-of-sight
  // incline input here — the Comparison section doesn't offer one, so
  // every comparison is a flat (losAngleDeg: 0) shot, the same engine
  // default used anywhere else that field isn't shown.
  function buildComparisonState(rifle, cartridge, bullet, shared) {
    return {
      ...shared,
      sightHeight: rifle.defaultSightHeightM * 1000, // stored in m; sightHeight's engine unit is mm
      zeroRange: rifle.defaultZeroRangeM,
      losAngleDeg: 0,
      muzzleVelocity: cartridge.muzzleVelocity,
      referenceTempC: cartridge.referenceTempC,
      velocityTempSensitivity: cartridge.velocityTempSensitivity,
      ...bulletProfileValues(bullet),
      // Spin drift's own inputs (silent here too, same as Range Solver —
      // no hint UI in this chart, it just factors in when enabled,
      // computable, and — for zeroForSpinDrift specifically — opted into
      // separately in Settings). caliberM/lengthM re-asserted explicitly since
      // bulletProfileValues() only includes caliberM for the cdTable
      // profile, never lengthM for either profile (see bullet-section.js's
      // own getStabilityValues() for why that gap exists).
      caliberM: bullet.caliberM,
      lengthM: bullet.lengthM,
      riflingTwistMm: rifleTwistMm(rifle),
      twistDirection: rifle.defaultTwistDirection,
      calculateSpinDrift: isSpinDriftEnabled(),
      zeroForSpinDrift: isZeroForSpinDriftEnabled()
    };
  }

  // The top-of-page "for comparison" list: each selected config with a
  // button to drop it. The Comparison section itself (see
  // renderComparisonSection() below) appears automatically once there are
  // exactly two — no separate button needed to reveal it. Hidden entirely
  // (no card at all) while nothing is selected.
  function renderComparisonSummary() {
    clear(comparisonSummaryEl);
    const selection = getComparisonSelection();
    if (selection.length === 0) return;

    const rows = selection.map((sel) => {
      const config = resolveComparisonConfig(sel);
      const removeButton = el('button', { class: 'secondary', i18n: 'arsenal.removeFromComparisonButton' });
      removeButton.addEventListener('click', () => {
        removeFromComparison(sel.rifleId, sel.cartridgeId);
        renderRifles(); // just the row's own "Add/Remove comparison" label — the library itself didn't change
        renderComparisonSummary();
        renderComparisonSection();
      });
      const info = config
        ? el('div', { class: 'arsenal-row-info' }, [
          el('strong', { text: config.rifle.name }),
          el('span', { class: 'hint', text: ` — ${config.cartridge.name}` })
        ])
        : el('div', { class: 'arsenal-row-info' }, [el('span', { class: 'hint', i18n: 'arsenal.comparisonStaleEntry' })]);
      return el('div', { class: 'arsenal-row' }, [info, el('div', { class: 'arsenal-row-actions' }, [removeButton])]);
    });

    const children = [el('h2', { i18n: 'arsenal.forComparisonLabel' }), ...rows];
    comparisonSummaryEl.appendChild(el('div', { class: 'card' }, children));
  }

  // The "Comparison" section itself — a brief summary of both configs, a
  // shared atmosphere+wind control, a shared max-range input, and a chart
  // formatted like the Trajectory page's own (same column selector, same
  // zoom/pan sliders, same 20-point-per-window resolution cap) but with
  // one series per configuration plus a legend. Renders nothing at all
  // (an empty comparisonSectionEl) unless exactly two configs are
  // currently selected — appearing/disappearing is purely a function of
  // selection size, not its own open/closed state.
  function renderComparisonSection() {
    clear(comparisonSectionEl);
    const selection = getComparisonSelection();
    if (selection.length !== 2) return;

    const configs = selection.map(resolveComparisonConfig);
    if (configs.some((c) => !c)) return; // a stale pointer — shouldn't happen, see resolveComparisonConfig()

    const distanceUnit = getUnit('distance');
    const distanceChoice = unitChoice('range', distanceUnit);
    const energyChoice = unitChoice('energy', getUnit('energy'));

    const summaryRows = configs.map(({ rifle, cartridge }) => el('p', { class: 'hint' }, [
      el('strong', { text: rifle.name }),
      document.createTextNode(` — ${cartridge.name}, ${cartridge.muzzleVelocity.toFixed(0)} m/s`)
    ]));

    const pool = getPool();
    const atmosphere = atmosphereSection({ onInput: () => scheduleComparisonRecompute() });
    const maxRangeField = unitField({
      // Reuses the Trajectory page's own "maxRange" field id — the shared
      // FIELD_UNITS entry gives it correct distance-unit conversion, and
      // the shared "fields.maxRange" translation gives it a real label in
      // every language, instead of a bespoke "comparisonMaxRange" id that
      // had neither (FIELD_UNITS has no entry for it, and no locale file
      // defines "fields.comparisonMaxRange"). No DOM id collision risk —
      // this view and the Trajectory page are never mounted at once.
      id: 'maxRange', ...FIELD_BOUNDS.maxRange, step: 10, value: 1000,
      onInput: () => {
        zoomSlider.setBounds(maxRangeField.getEngineValue());
        scheduleComparisonRecompute();
      }
    });

    const chartContainer = el('div', { class: 'chart-container' });
    const columnSelect = buildChartColumnSelect(COLUMNS, {
      id: 'comparisonChartColumn', energyChoice, defaultColumnId: 'dropCm'
    });

    let zoomRafScheduled = false;
    function scheduleApplyZoom() {
      if (zoomRafScheduled) return;
      zoomRafScheduled = true;
      requestAnimationFrame(() => {
        zoomRafScheduled = false;
        applyZoom();
      });
    }

    const zoomSlider = zoomRangeSlider({
      minWindowM: MIN_ZOOM_WINDOW_M,
      idPrefix: 'comparisonChartView',
      onInput: scheduleApplyZoom
    });
    // See the matching comment in trajectory-view.js — sync immediately so
    // the slider starts fully zoomed out over the real default range,
    // not a MIN_ZOOM_WINDOW_M sliver.
    zoomSlider.setBounds(maxRangeField.getEngineValue());

    const legend = el('div', { class: 'chart-legend' }, configs.map(({ rifle, cartridge }, i) => el('span', { class: `chart-legend-item chart-legend-${i === 0 ? 'a' : 'b'}` }, [
      el('span', { class: 'chart-legend-swatch' }),
      document.createTextNode(`${rifle.name} — ${cartridge.name}`)
    ])));
    // Appended/removed from `legend` by renderChart() below, depending on
    // whether the selected column is a drop-family one — kept as one
    // stable node (rather than rebuilt each render) so it can be added
    // and removed with plain appendChild/removeChild.
    const zeroLineLegendItem = lineOfSightLegendItem();

    const axisLabel = el('div', { class: 'chart-axis-label', text: `${t('arsenal.distanceAxisLabel')} (${distanceChoice.label})` });

    let chart = null;
    // Each config's own full-range trajectory, computed once (see
    // recomputeComparisonChart() below) and cached — resampled to the
    // current zoom window on every pan/zoom tick by applyZoom(), same
    // dense-cache-plus-resample design as trajectory-view.js's own chart.
    let denseA = [];
    let denseB = [];
    let pointsA = [];
    let pointsB = [];
    let ctxA = {};
    let ctxB = {};

    function applyZoom() {
      const { startM, endM } = zoomSlider.getWindow();
      pointsA = resampleChartPoints(denseA, startM, endM, CHART_POINTS_TARGET);
      pointsB = resampleChartPoints(denseB, startM, endM, CHART_POINTS_TARGET);
      renderChart();
    }

    // The two configs are resampled to the same [startM, endM] window
    // (see applyZoom() above) so they land on the same range grid — but a
    // config that doesn't actually reach the window's far edge (e.g.
    // underpowered at that range) is clamped short by resampleChartPoints()
    // and would otherwise return a shorter points array than the other.
    // Building the shared label set as the *union* of both configs' own
    // ranges (rather than assuming they match) keeps the two series
    // correctly aligned to one X axis regardless.
    function unionRangesM(pointsList) {
      const set = new Set();
      for (const points of pointsList) for (const p of points) set.add(Math.round(p.range * 1000));
      return [...set].sort((a, b) => a - b).map((mm) => mm / 1000);
    }

    function seriesFor(points, labelsM, col, ctx) {
      const byRange = new Map(points.map((p) => [Math.round(p.range * 1000), p]));
      // Full precision, not rounded to col.decimals — see the matching
      // comment on trajectory-view.js's own renderChart().
      return labelsM.map((rM) => {
        const p = byRange.get(Math.round(rM * 1000));
        if (!p) return null; // this config has no sample at this range — Chartist treats null as a data hole
        try {
          return col.value(p, ctx);
        } catch {
          return null;
        }
      });
    }

    function renderChart() {
      const col = COLUMNS.find((c) => c.id === columnSelect.value);
      const labelsM = unionRangesM([pointsA, pointsB]);
      const labels = labelsM.map((m) => Math.round(engineToDisplay('range', m, distanceUnit)));
      const series = [seriesFor(pointsA, labelsM, col, ctxA), seriesFor(pointsB, labelsM, col, ctxB)];
      if (col.showLineOfSight) series.push(lineOfSightSeries(labels.length));

      // removeChild() throws if the node isn't currently a child (unlike
      // e.g. classList.toggle) — guard with parentNode rather than calling
      // it unconditionally, since renderChart()'s very first call may run
      // with the item never having been appended at all.
      if (zeroLineLegendItem.parentNode === legend) legend.removeChild(zeroLineLegendItem);
      if (col.showLineOfSight) legend.appendChild(zeroLineLegendItem);

      const options = {
        fullWidth: true,
        chartPadding: { right: 24 },
        axisY: { onlyInteger: false },
        showPoint: false,
        lineSmooth: true // default cubic (monotoneCubic) smoothing
      };
      if (chart) chart.update({ labels, series }, options);
      else chart = new LineChart(chartContainer, { labels, series }, options);
    }

    columnSelect.addEventListener('change', renderChart);

    let latestRequestId = 0;
    async function recomputeComparisonChart() {
      const id = ++latestRequestId;
      const shared = { maxRange: maxRangeField.getEngineValue(), rangeStep: CHART_DENSE_RANGE_STEP_M, ...atmosphere.getValues() };
      try {
        const [bulletA, bulletB] = await Promise.all(configs.map((c) => resolveComparisonBullet(c.cartridge)));
        if (id !== latestRequestId) return; // superseded by a newer input
        const stateA = buildComparisonState(configs[0].rifle, configs[0].cartridge, bulletA, shared);
        const stateB = buildComparisonState(configs[1].rifle, configs[1].cartridge, bulletB, shared);
        const [resultA, resultB] = await Promise.all([pool.run('trajectory', stateA), pool.run('trajectory', stateB)]);
        if (id !== latestRequestId) return;
        denseA = resultA.points;
        denseB = resultB.points;
        ctxA = { clickSettings: clickSettingsFor(configs[0].rifle), massKg: bulletA.massKg };
        ctxB = { clickSettings: clickSettingsFor(configs[1].rifle), massKg: bulletB.massKg };
        applyZoom();
      } catch {
        if (id !== latestRequestId) return;
        // Leave the chart showing its last good state, same posture as
        // trajectory-view.js's own recomputeChart().
      }
    }

    let rafScheduled = false;
    function scheduleComparisonRecompute() {
      if (rafScheduled) return;
      rafScheduled = true;
      requestAnimationFrame(() => {
        rafScheduled = false;
        recomputeComparisonChart();
      });
    }

    comparisonSectionEl.appendChild(el('div', { class: 'card' }, [
      el('h2', { i18n: 'arsenal.comparisonHeading' }),
      ...summaryRows,
      atmosphere.node,
      maxRangeField.node
    ]));
    comparisonSectionEl.appendChild(el('div', { class: 'card' }, [
      el('div', { class: 'card-header-row' }, [
        el('h2', { i18n: 'trajectory.chartHeading' }),
        downloadButton({
          label: t('trajectory.downloadChartSvg'),
          onClick: () => exportChartSvg(chartContainer, 'comparison-chart.svg')
        })
      ]),
      el('div', { class: 'field' }, [el('label', { i18n: 'trajectory.chartColumnLabel' }), columnSelect]),
      legend,
      chartContainer,
      axisLabel,
      zoomSlider.node
    ]));

    recomputeComparisonChart();
  }

  function renderBullets() {
    clear(bulletsListEl);
    const allBullets = loadUserBullets();
    const caliber = caliberFilter.value;
    const manufacturer = manufacturerFilter.value;
    const bullets = allBullets.filter((b) =>
      (caliber === ALL_VALUE || bulletCaliberLabel(b) === caliber) &&
      (manufacturer === ALL_VALUE || b.manufacturer === manufacturer)
    );
    if (bullets.length === 0) {
      // Distinguish "nothing saved yet" from "nothing matches the
      // filter" — showing the former while a filter is just hiding
      // everything would wrongly suggest the Arsenal itself is empty.
      const emptyKey = allBullets.length === 0 ? 'arsenal.noBullets' : 'arsenal.noBulletsFiltered';
      bulletsListEl.appendChild(el('p', { class: 'hint', i18n: emptyKey }));
    }
    for (const bullet of bullets) {
      const grains = Math.round(bullet.massKg * KG_TO_GRAIN);
      const modifiedLabel = lastModifiedLabel(bullet);
      const editButton = el('button', { class: 'secondary', i18n: 'arsenal.editButton' });
      editButton.addEventListener('click', () => {
        closeOtherForms('bullet');
        bulletFormState = { id: bullet.id };
        renderBulletForm();
        renderRifleForm();
        scrollBulletFormIntoView();
      });
      const deleteButton = el('button', { class: 'secondary', i18n: 'arsenal.deleteButton' });
      deleteButton.addEventListener('click', () => {
        // A cartridge whose bulletId points at this bullet is meaningless
        // once it's gone (see the cartridge form's own "a cartridge always
        // resolves to a real user-library bullet" invariant) — deleting the
        // bullet takes every such cartridge, on every rifle, with it,
        // rather than leaving orphaned references behind. The confirm
        // prompt names the count so this isn't a silent side effect.
        const rifles = loadUserRifles();
        const affectedCartridgeCount = rifles.reduce(
          (sum, rifle) => sum + rifle.cartridges.filter((c) => c.bulletId === bullet.id).length, 0
        );
        const message = affectedCartridgeCount > 0
          ? t('arsenal.confirmDeleteBulletWithCartridges', { name: bullet.name, count: affectedCartridgeCount })
          : t('arsenal.confirmDeleteBullet', { name: bullet.name });
        if (!confirm(message)) return;

        for (const rifle of rifles) {
          const removedIds = rifle.cartridges.filter((c) => c.bulletId === bullet.id).map((c) => c.id);
          if (removedIds.length === 0) continue;
          saveUserRifle({ ...rifle, cartridges: rifle.cartridges.filter((c) => c.bulletId !== bullet.id) });
          for (const id of removedIds) removeFromComparison(rifle.id, id);
          if (rifle.id === activeRifleId && removedIds.includes(activeCartridgeId)) {
            const remaining = loadUserRifles().find((r) => r.id === rifle.id).cartridges;
            activeCartridgeId = remaining[0] ? remaining[0].id : null;
          }
          if (cartridgeFormState && removedIds.includes(cartridgeFormState.id)) cartridgeFormState = null;
        }

        deleteUserBullet(bullet.id);
        if (bulletFormState && bulletFormState.id === bullet.id) bulletFormState = null;
        refreshLibraryView();
        renderBulletForm();
        renderRifleForm();
        renderComparisonSummary();
        renderComparisonSection();
      });
      const saveToFileButton = el('button', { class: 'secondary', i18n: 'arsenal.saveToFileButton' });
      saveToFileButton.addEventListener('click', () => exportSingleBullet(bullet));
      bulletsListEl.appendChild(el('div', { class: 'arsenal-row' }, [
        el('div', { class: 'arsenal-row-info' }, [
          el('strong', { text: bullet.name }),
          unsavedBadge(bullet),
          el('span', { class: 'hint', text: ` — ${bullet.manufacturer}, ${bulletCaliberLabel(bullet)}, ${grains}gr` }),
          modifiedLabel ? el('div', { class: 'hint' }, [modifiedLabel]) : null
        ]),
        el('div', { class: 'arsenal-row-actions' }, [saveToFileButton, editButton, deleteButton])
      ]));
    }

    // A single stable instance (see bulletAddButton's own declaration),
    // just re-appended here on every render — its visibility is managed
    // separately by refreshAddButtonVisibility(), not by whether it gets
    // appended, so re-appending it never disturbs that state.
    bulletsListEl.appendChild(bulletAddButton);
  }

  function renderBulletForm() {
    clear(bulletFormArea);
    refreshAddButtonVisibility();
    if (!bulletFormState) return;
    const editing = bulletFormState.id ? loadUserBullets().find((b) => b.id === bulletFormState.id) : null;
    // pendingBulletPrefill is one-shot: consumed (and nulled) the first time
    // any form opens after it's set, whether that's a brand-new entry or an
    // existing one matched by name (see the mount()-time check below) —
    // either way it must win over `editing`'s stored values, since the
    // whole point is to bring the form up to date with what's currently in
    // the Trajectory Table.
    const prefill = pendingBulletPrefill;
    pendingBulletPrefill = null;
    const form = bulletForm({
      initialValues: prefill || editing || {},
      excludeId: bulletFormState.id || undefined,
      onSave: (data) => {
        const collision = findUserBulletByName(data.name, { excludeId: bulletFormState.id || undefined });
        if (collision) {
          if (bulletFormState.id && bulletFormState.id !== collision.id) deleteUserBullet(bulletFormState.id);
          saveUserBullet({ ...collision, ...data, id: collision.id });
        } else {
          saveUserBullet({ ...data, id: bulletFormState.id || generateUserId('user-bullet') });
        }
        bulletFormState = null;
        refreshLibraryView();
        renderBulletForm();
      },
      onCancel: () => {
        bulletFormState = null;
        renderBulletForm();
      }
    });
    bulletFormArea.appendChild(el('div', { class: 'card' }, [
      el('h2', { i18n: bulletFormState.id ? 'arsenal.editBulletHeading' : 'arsenal.addBulletHeading' }),
      form.node
    ]));
  }

  // Scrolls the (already rendered) bullet form's card to the top of the
  // viewport — called only from the two "open" actions (edit/add), not
  // from inside renderBulletForm() itself, since that function also
  // re-runs on save/cancel/an unrelated row's delete while this form
  // stays open, where re-scrolling would be an unwanted jump rather than
  // bringing a newly-opened form into view.
  function scrollBulletFormIntoView() {
    if (bulletFormArea.firstChild) bulletFormArea.firstChild.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // Shared by both the active rifle's own row (renderActiveRifle()) and
  // every "Other rifles" row (renderRifles()) — the cartridge picker,
  // its stability readout, and the Compare toggle, all keyed off
  // whichever cartridge the picker currently names. Only ever built for
  // a rifle that actually has cartridges (a rifle with none has nothing
  // for any of these three to act on). `onCartridgeChange`, when given,
  // additionally fires on every picker change — the active rifle's own
  // row uses it to keep activeCartridgeId (and so the Cartridges list's
  // own "Active" highlight below) in sync with whatever's picked here;
  // an "Other rifles" row has no such hook, since its picker only ever
  // feeds Compare there, the same as before this rework.
  function buildCartridgeControls(rifle, userBullets, { onCartridgeChange, initialCartridgeId } = {}) {
    const select = el('select', { class: 'arsenal-active-cartridge' });
    for (const c of rifle.cartridges) select.appendChild(el('option', { value: c.id, text: c.name }));
    if (initialCartridgeId && rifle.cartridges.some((c) => c.id === initialCartridgeId)) select.value = initialCartridgeId;

    const compareButton = el('button', { class: 'secondary arsenal-compare-toggle' });
    function refreshCompareButton() {
      const cartridgeId = select.value;
      const inComparison = isSelectedForComparison(rifle.id, cartridgeId);
      compareButton.textContent = t(inComparison ? 'arsenal.removeFromComparisonButton' : 'arsenal.addToComparisonButton');
      compareButton.disabled = !inComparison && !canAddToComparison();
      compareButton.title = compareButton.disabled ? t('arsenal.comparisonFullHint') : '';
    }
    const stability = stabilityIndicator();
    function refreshStability() {
      const cartridge = rifle.cartridges.find((c) => c.id === select.value);
      stability.update(cartridge ? stabilityValuesFor(rifle, cartridge, userBullets) : {});
    }
    select.addEventListener('change', () => {
      refreshStability();
      refreshCompareButton();
      if (onCartridgeChange) onCartridgeChange(select.value);
    });
    select.addEventListener('click', (e) => e.stopPropagation?.());
    compareButton.addEventListener('click', (e) => {
      e.stopPropagation?.();
      const cartridgeId = select.value;
      if (isSelectedForComparison(rifle.id, cartridgeId)) {
        removeFromComparison(rifle.id, cartridgeId);
      } else {
        addToComparison(rifle.id, cartridgeId);
      }
      // Both lists — the toggled row could be the active rifle's own, or
      // one from "Other rifles" — plus the library itself didn't change,
      // just the comparison selection.
      renderActiveRifle();
      renderRifles();
      renderComparisonSummary();
      renderComparisonSection();
    });

    refreshStability();
    refreshCompareButton();

    return { select, compareButton, stability };
  }

  // The active rifle's own Cartridges section — its list (each row
  // clickable to make it the active cartridge, per the ask, with the
  // currently-active one marked), a prominent warning in place of the
  // list when there are none (this rifle is unusable — see
  // commitActiveRifleOnDone()), and Add Cartridge. Only ever called for
  // the active rifle now — cartridge management no longer shows for any
  // other row.
  function renderCartridgesSection(rifle) {
    const cartridgesListEl = el('div');
    const userBullets = loadUserBullets();
    for (const cartridge of rifle.cartridges) {
      const editButton = el('button', { class: 'secondary', i18n: 'arsenal.editButton' });
      editButton.addEventListener('click', (e) => {
        e.stopPropagation?.();
        closeOtherForms('cartridge');
        cartridgeFormState = { id: cartridge.id };
        renderRifleForm();
        renderBulletForm();
      });
      const deleteButton = el('button', { class: 'secondary', i18n: 'arsenal.deleteButton' });
      deleteButton.addEventListener('click', (e) => {
        e.stopPropagation?.();
        if (!confirm(t('arsenal.confirmDeleteCartridge', { name: cartridge.name }))) return;
        const remaining = rifle.cartridges.filter((c) => c.id !== cartridge.id);
        saveUserRifle({ ...rifle, cartridges: remaining });
        if (cartridgeFormState && cartridgeFormState.id === cartridge.id) cartridgeFormState = null;
        if (activeCartridgeId === cartridge.id) activeCartridgeId = remaining[0] ? remaining[0].id : null;
        removeFromComparison(rifle.id, cartridge.id);
        // Removing a cartridge can change which caliber(s)/manufacturer(s)
        // this rifle has (see rifleDesignations()/rifleManufacturers()) —
        // refresh the filters and both rifle lists, not just this open form.
        refreshLibraryView();
        renderRifleForm();
        renderComparisonSummary();
        renderComparisonSection();
      });
      const isActiveCartridge = cartridge.id === activeCartridgeId;
      const cartridgeStability = stabilityIndicator();
      cartridgeStability.update(stabilityValuesFor(rifle, cartridge, userBullets));
      const row = el('div', { class: 'arsenal-row row-clickable' }, [
        el('div', { class: 'arsenal-row-info' }, [
          el('strong', { text: cartridge.name }),
          isActiveCartridge ? el('span', { class: 'active-badge', text: t('arsenal.activeCartridgeBadge') }) : null,
          el('span', { class: 'hint', text: ` — ${cartridge.muzzleVelocity.toFixed(0)} m/s` }),
          cartridgeStability.node
        ]),
        el('div', { class: 'arsenal-row-actions' }, [editButton, deleteButton])
      ]);
      row.addEventListener('click', () => {
        activeCartridgeId = cartridge.id;
        renderActiveRifle();
      });
      cartridgesListEl.appendChild(row);
    }
    if (rifle.cartridges.length === 0) {
      cartridgesListEl.appendChild(el('p', { class: 'hint warning', i18n: 'arsenal.noCartridgesWarning' }));
    }

    const addButton = el('button', { class: 'secondary', id: 'arsenal-add-cartridge', i18n: 'arsenal.addCartridgeButton' });
    addButton.addEventListener('click', () => {
      closeOtherForms('cartridge');
      cartridgeFormState = { id: null };
      renderRifleForm();
      renderBulletForm();
    });
    cartridgesListEl.appendChild(addButton);

    // Unlike rifleFormArea/bulletFormArea (each cleared once at the very
    // top of their own dedicated render function, right before their own
    // conditional rebuild), cartridgeFormArea is a persistent element
    // whose only populate site is right here — but this function itself
    // can run from more than one path (a click routed through
    // renderRifleForm(), which does clear it first, but also directly via
    // refreshLibraryView() → renderActiveRifle(), e.g. once this view's
    // own mount-time caliber-designations fetch resolves). Clearing it
    // unconditionally here, regardless of which path got us here, is what
    // actually guarantees at most one cartridge form ever lives inside it.
    clear(cartridgeFormArea);
    if (cartridgeFormState) {
      const editingCartridge = cartridgeFormState.id ? rifle.cartridges.find((c) => c.id === cartridgeFormState.id) : null;
      const form = cartridgeForm({
        initialValues: editingCartridge || {},
        riflingTwistMm: rifleTwistMm(rifle),
        lockedCaliberM: lockedCaliberMForRifle(rifle, userBullets, cartridgeFormState.id),
        siblingNames: rifle.cartridges.filter((c) => c.id !== cartridgeFormState.id).map((c) => c.name),
        onSave: (data) => {
          const id = cartridgeFormState.id || generateUserId('user-cartridge');
          const cartridges = cartridgeFormState.id
            ? rifle.cartridges.map((c) => (c.id === id ? { ...data, id } : c))
            : [...rifle.cartridges, { ...data, id }];
          saveUserRifle({ ...rifle, cartridges });
          cartridgeFormState = null;
          // A brand-new cartridge is a reasonable default active one for
          // a rifle that previously had none (or none active yet).
          if (!activeCartridgeId) activeCartridgeId = id;
          // A new/edited cartridge can add a caliber/manufacturer to this
          // rifle (and, via the cartridge form's own built-in-bullet-copy
          // behavior, add a bullet to the library too) — refresh both
          // lists and the filters, not just this open form.
          refreshLibraryView();
          renderRifleForm();
        },
        onCancel: () => {
          cartridgeFormState = null;
          renderRifleForm();
        }
      });
      cartridgeFormArea.appendChild(form.node);
    }

    return el('div', { class: 'input-section nested' }, [
      el('h4', { i18n: 'arsenal.cartridgesHeading' }),
      cartridgesListEl,
      cartridgeFormArea
    ]);
  }

  // Makes `rifle` the one shown in the "Active rifle" pane — a purely
  // page-local action (no cookie write, no navigation), same spirit as
  // locations-view.js's own activateLocation(). `preferredCartridgeId`
  // lets a click carry over whichever cartridge a row's own picker was
  // already showing (see renderRifles() below); `rifle: null` is the
  // "no active rifle" reset used by Delete. Allowed even for a rifle
  // with zero cartridges — see commitActiveRifleOnDone()'s own comment
  // for why activation itself is never blocked.
  function activateRifle(rifle, preferredCartridgeId) {
    activeRifleId = rifle ? rifle.id : null;
    activeCartridgeId = rifle
      ? (preferredCartridgeId || (rifle.cartridges[0] ? rifle.cartridges[0].id : null))
      : null;
    rifleFormState = null;
    cartridgeFormState = null;
    refreshLibraryView();
    scrollActiveRifleIntoView();
  }

  function scrollActiveRifleIntoView() {
    activeRifleCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // The "Active rifle" pane — full detail for whichever rifle is
  // currently staged (see activateRifle()/commitActiveRifleOnDone()), or
  // a plain explanatory message when the running configuration isn't one
  // of the user's own Arsenal rifles at all (manual entry, or a built-in
  // library pick — neither is "in the Arsenal", so both read the same
  // way here). Always shown regardless of the caliber/manufacturer
  // filters below, same as Locations' own Current-location pane.
  function renderActiveRifle() {
    clear(activeRifleListEl);
    const rifle = activeRifleId ? loadUserRifles().find((r) => r.id === activeRifleId) : null;

    if (!rifle) {
      activeRifleListEl.appendChild(el('div', { class: 'arsenal-row' }, [
        el('div', { class: 'arsenal-row-info' }, [el('span', { i18n: 'arsenal.manualRifleActiveMessage' })])
      ]));
      return;
    }

    const userBullets = loadUserBullets();
    const modifiedLabel = lastModifiedLabel(rifle);

    const editButton = el('button', { class: 'secondary', i18n: 'arsenal.editButton' });
    editButton.addEventListener('click', () => {
      closeOtherForms('rifle');
      rifleFormState = { id: rifle.id };
      renderRifleForm();
      renderBulletForm();
      scrollRifleFormIntoView();
    });
    const deleteButton = el('button', { class: 'secondary', i18n: 'arsenal.deleteButton' });
    deleteButton.addEventListener('click', () => {
      if (!confirm(t('arsenal.confirmDeleteRifle', { name: rifle.name }))) return;
      deleteUserRifle(rifle.id);
      removeRifleFromComparison(rifle.id);
      activateRifle(null);
      renderComparisonSummary();
      renderComparisonSection();
    });
    const saveToFileButton = el('button', { class: 'secondary', i18n: 'arsenal.saveToFileButton' });
    saveToFileButton.addEventListener('click', () => exportSingleRifle(rifle));

    const actionChildren = [];
    if (rifle.cartridges.length > 0) {
      const controls = buildCartridgeControls(rifle, userBullets, {
        initialCartridgeId: activeCartridgeId,
        onCartridgeChange: (cartridgeId) => {
          activeCartridgeId = cartridgeId;
          renderActiveRifle();
        }
      });
      actionChildren.push(controls.select, controls.compareButton);
    }
    actionChildren.push(saveToFileButton, editButton, deleteButton);

    activeRifleListEl.appendChild(el('div', { class: 'arsenal-row' }, [
      el('div', { class: 'arsenal-row-info' }, [
        el('strong', { text: rifle.name }),
        unsavedBadge(rifle),
        unusableBadge(rifle),
        el('span', { class: 'hint', text: t('arsenal.cartridgeCount', { count: rifle.cartridges.length }) }),
        modifiedLabel ? el('div', { class: 'hint' }, [modifiedLabel]) : null
      ]),
      el('div', { class: 'arsenal-row-actions' }, actionChildren)
    ]));

    if (rifleFormState && rifleFormState.id === rifle.id) activeRifleListEl.appendChild(rifleFormArea);

    activeRifleListEl.appendChild(renderCartridgesSection(rifle));
  }

  // "Other rifles" — every rifle except the currently active one (which
  // gets its own full-detail pane above — see renderActiveRifle()), same
  // Current/Known split locations-view.js already uses. Each row still
  // carries its own cartridge picker + Compare toggle (needed
  // independently of which rifle is active — a comparison can pit any
  // two rifle+cartridge configs against each other) but no longer Edit;
  // clicking the row itself (rather than one of its own controls) makes
  // it the active rifle instead.
  function renderRifles() {
    clear(riflesListEl);
    const allRifles = loadUserRifles();
    const userBullets = loadUserBullets();
    const caliber = caliberFilter.value;
    const manufacturer = manufacturerFilter.value;
    const rifles = allRifles.filter((r) =>
      r.id !== activeRifleId &&
      (caliber === ALL_VALUE || rifleDesignations(r, userBullets).has(caliber)) &&
      (manufacturer === ALL_VALUE || rifleManufacturers(r, userBullets).has(manufacturer))
    );
    if (rifles.length === 0) {
      const emptyKey = allRifles.length <= (activeRifleId ? 1 : 0) ? 'arsenal.noRifles' : 'arsenal.noRiflesFiltered';
      riflesListEl.appendChild(el('p', { class: 'hint', i18n: emptyKey }));
    }
    for (const rifle of rifles) {
      const modifiedLabel = lastModifiedLabel(rifle);

      const deleteButton = el('button', { class: 'secondary', i18n: 'arsenal.deleteButton' });
      deleteButton.addEventListener('click', (e) => {
        e.stopPropagation?.();
        if (!confirm(t('arsenal.confirmDeleteRifle', { name: rifle.name }))) return;
        deleteUserRifle(rifle.id);
        removeRifleFromComparison(rifle.id);
        refreshLibraryView();
        renderComparisonSummary();
        renderComparisonSection();
      });
      const saveToFileButton = el('button', { class: 'secondary', i18n: 'arsenal.saveToFileButton' });
      saveToFileButton.addEventListener('click', (e) => { e.stopPropagation?.(); exportSingleRifle(rifle); });

      const actionChildren = [];
      // A rifle with no cartridges has nothing for the picker/Compare to
      // act on — same guard this control has always had.
      let cartridgeSelect = null;
      if (rifle.cartridges.length > 0) {
        const controls = buildCartridgeControls(rifle, userBullets);
        cartridgeSelect = controls.select;
        actionChildren.push(controls.select, controls.compareButton);
      }
      actionChildren.push(saveToFileButton, deleteButton);

      const row = el('div', { class: 'arsenal-row row-clickable' }, [
        el('div', { class: 'arsenal-row-info' }, [
          el('strong', { text: rifle.name }),
          unsavedBadge(rifle),
          unusableBadge(rifle),
          el('span', { class: 'hint', text: t('arsenal.cartridgeCount', { count: rifle.cartridges.length }) }),
          modifiedLabel ? el('div', { class: 'hint' }, [modifiedLabel]) : null
        ]),
        el('div', { class: 'arsenal-row-actions' }, actionChildren)
      ]);
      // A rifle with zero cartridges is still activatable — see
      // activateRifle()'s own comment — so it can be reached to add one.
      row.addEventListener('click', () => activateRifle(rifle, cartridgeSelect ? cartridgeSelect.value : null));
      riflesListEl.appendChild(row);
    }

    // A single stable instance — see bulletsListEl's matching
    // bulletAddButton append above for why. Only shown near this list
    // when adding a brand new rifle — an edit of the active one renders
    // inside the "Active rifle" pane instead (see renderActiveRifle()).
    riflesListEl.appendChild(rifleAddButton);
    if (rifleFormState && rifleFormState.id === null) riflesListEl.appendChild(rifleFormArea);
  }

  function renderExportDialog() {
    clear(exportDialogArea);
    if (!exportDialogState) return;
    const dialog = exportDialog({
      bullets: loadUserBullets(),
      rifles: loadUserRifles(),
      onExport: ({ bulletIds, rifleIds }) => {
        const bullets = loadUserBullets().filter((b) => bulletIds.includes(b.id));
        const rifles = loadUserRifles().filter((r) => rifleIds.includes(r.id));
        const payload = buildExportPayload({ bullets, rifles });
        downloadJsonFile('gb-arsenal-library.json', serializeExport(payload));
        markUserBulletsSaved(bulletIds);
        markUserRiflesSaved(rifleIds);
        exportDialogState = false;
        renderExportDialog();
        refreshLibraryView();
      },
      onCancel: () => {
        exportDialogState = false;
        renderExportDialog();
      }
    });
    exportDialogArea.appendChild(el('div', { class: 'card' }, [
      el('h2', { i18n: 'arsenal.exportDialogHeading' }),
      dialog.node
    ]));
  }

  function renderImportArea() {
    clear(importArea);
    importErrorArea.style.display = 'none';
    importSummaryArea.style.display = 'none';

    if (importErrorKey) {
      importErrorArea.textContent = t(importErrorKey);
      importErrorArea.style.display = '';
      importErrorKey = null;
    }
    if (importSummary) {
      importSummaryArea.textContent = t('arsenal.importSummary', importSummary);
      importSummaryArea.style.display = '';
      importSummary = null;
    }
    if (!importState) return;

    const dialog = importDialog({
      bullets: importState.bullets,
      rifles: importState.rifles,
      existingBullets: loadUserBullets(),
      existingRifles: loadUserRifles(),
      onImport: ({ bulletIds, rifleIds, mode }) => {
        const selectedBullets = importState.bullets.filter((b) => bulletIds.includes(b.id));
        const selectedRifles = importState.rifles.filter((r) => rifleIds.includes(r.id));
        const plan = planImportBatch({
          bullets: selectedBullets, rifles: selectedRifles, mode,
          existingBullets: loadUserBullets(), existingRifles: loadUserRifles(),
          generateBulletId: () => generateUserId('user-bullet'),
          generateRifleId: () => generateUserId('user-rifle')
        });

        let saved = 0, skipped = 0;
        for (const { resolved } of plan.bulletResults) {
          if (resolved.action === 'save') { importUserBullet(resolved.record); saved++; } else skipped++;
        }
        for (const { resolved } of plan.rifleResults) {
          if (resolved.action === 'save') { importUserRifle(resolved.record); saved++; } else skipped++;
        }

        importState = null;
        importSummary = { saved, skipped };
        renderImportArea();
        refreshLibraryView();
      },
      onCancel: () => {
        importState = null;
        renderImportArea();
      }
    });
    importArea.appendChild(el('div', { class: 'card' }, [
      el('h2', { i18n: 'arsenal.importDialogHeading' }),
      dialog.node
    ]));
  }

  const fileInput = el('input', { type: 'file', accept: 'application/json' });
  fileInput.style.display = 'none';
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files && fileInput.files[0];
    fileInput.value = ''; // clear so picking the same filename again still fires 'change'
    if (!file) return;
    try {
      const text = await file.text();
      importState = parseImportPayload(text);
      importErrorKey = null;
    } catch (err) {
      importState = null;
      importErrorKey = err.code === 'invalid-json' ? 'arsenal.importFileErrorInvalidJson' : 'arsenal.importFileErrorInvalidFormat';
    }
    importSummary = null;
    renderImportArea();
  });

  const saveLibraryButton = el('button', { class: 'secondary', id: 'arsenal-save-library', i18n: 'arsenal.saveLibraryButton' });
  saveLibraryButton.addEventListener('click', () => {
    importState = null;
    renderImportArea();
    exportDialogState = true;
    renderExportDialog();
  });
  const loadLibraryButton = el('button', { class: 'secondary', id: 'arsenal-load-library', i18n: 'arsenal.loadLibraryButton' });
  loadLibraryButton.addEventListener('click', () => {
    exportDialogState = false;
    renderExportDialog();
    fileInput.click();
  });

  // Populates rifleFormArea/cartridgeFormArea from current form state —
  // called after every mutation that could affect either (not just their
  // own open/close), exactly like locations-view.js's own
  // renderLocationForm(). Repositions both stable nodes first (via
  // renderActiveRifle()/renderRifles(), which append them into whichever
  // spot their own open state calls for — or nowhere at all, once
  // cleared, if closed) before filling in real content, so "where does
  // the form go" and "what's inside it" stay decoupled the same way.
  function renderRifleForm() {
    clear(rifleFormArea);
    clear(cartridgeFormArea);
    refreshAddButtonVisibility();
    renderActiveRifle();
    renderRifles();

    if (!rifleFormState) return;
    const editing = rifleFormState.id ? loadUserRifles().find((r) => r.id === rifleFormState.id) : null;
    // See the matching comment in renderBulletForm() — one-shot, and wins
    // over `editing`'s stored values whether this is a brand-new entry or
    // one matched by name (see the mount()-time check below).
    const prefill = pendingRiflePrefill;
    pendingRiflePrefill = null;
    const form = rifleForm({
      initialValues: prefill || editing || {},
      excludeId: rifleFormState.id || undefined,
      onSave: (data) => {
        // Adding a brand-new rifle (not editing an existing one) makes it
        // the active rifle right away — there's nothing useful to leave
        // it as one of several "Other rifles" for, since it has no
        // cartridges yet and the very next thing to do is add one, which
        // only the active rifle's own pane offers.
        const wasAdding = !rifleFormState.id;
        const collision = findUserRifleByName(data.name, { excludeId: rifleFormState.id || undefined });
        const existingRecord = rifleFormState.id ? loadUserRifles().find((r) => r.id === rifleFormState.id) : null;
        let savedId;
        if (collision) {
          if (rifleFormState.id && rifleFormState.id !== collision.id) deleteUserRifle(rifleFormState.id);
          saveUserRifle({ ...collision, ...data, id: collision.id });
          savedId = collision.id;
        } else {
          savedId = rifleFormState.id || generateUserId('user-rifle');
          saveUserRifle({ cartridges: [], ...existingRecord, ...data, id: savedId });
        }
        if (wasAdding) {
          // activateRifle() resets rifleFormState/cartridgeFormState,
          // refreshes both rifle lists, and scrolls the Active-rifle
          // pane into view on its own — see its own comment.
          activateRifle(loadUserRifles().find((r) => r.id === savedId));
        } else {
          rifleFormState = null;
          cartridgeFormState = null;
          refreshLibraryView();
        }
        renderRifleForm();
      },
      onCancel: () => {
        rifleFormState = null;
        cartridgeFormState = null;
        renderRifleForm();
      }
    });

    rifleFormArea.appendChild(el('div', { class: 'card' }, [
      el('h2', { i18n: rifleFormState.id ? 'arsenal.editRifleHeading' : 'arsenal.addRifleHeading' }),
      form.node
    ]));
  }

  // Scrolls the (already rendered) rifle form's card to the top of the
  // viewport — called only from the two rifle-level "open" actions
  // (Edit/Add), not from renderRifleForm() itself, since that function
  // also re-runs for unrelated mutations (a cartridge add/edit/delete,
  // any comparison toggle) while the rifle form stays open, where
  // re-scrolling back up would fight the user right back down to
  // whatever they were just looking at.
  function scrollRifleFormIntoView() {
    if (rifleFormArea.firstChild) rifleFormArea.firstChild.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  container.appendChild(el('div', {}, [
    el('h1', { i18n: 'arsenal.title' }),
    el('p', { i18n: 'arsenal.intro' }),
    comparisonSummaryEl,
    comparisonSectionEl,
    el('div', { class: 'card' }, [
      el('div', { class: 'arsenal-form-actions' }, [saveLibraryButton, loadLibraryButton]),
      fileInput,
      importErrorArea,
      importSummaryArea
    ]),
    exportDialogArea,
    importArea,
    activeRifleCard,
    filterCard,
    el('div', { class: 'card' }, [
      el('h2', { i18n: 'arsenal.otherRiflesHeading' }),
      riflesListEl
    ]),
    el('div', { class: 'card' }, [
      el('h2', { i18n: 'arsenal.bulletsHeading' }),
      bulletsListEl
    ]),
    bulletFormArea
  ]));

  refreshLibraryView();
  renderExportDialog();
  renderImportArea();
  renderComparisonSummary();
  renderComparisonSection();

  // A pending prefill from a tool view's "Add to arsenal" button opens the
  // right form immediately, already filled in — as a brand-new entry, or,
  // when its name already matches one already in the Arsenal, in Edit mode
  // for that existing entry instead (still filled with the fresh
  // Trajectory Table values, not its old stored ones) so Save updates it
  // in place rather than prompting a duplicate-name overwrite. A manual
  // ("Other") bullet/rifle has no name to match against, so it always
  // opens as a new entry.
  if (pendingBulletPrefill) {
    const existing = pendingBulletPrefill.name ? findUserBulletByName(pendingBulletPrefill.name) : null;
    closeOtherForms('bullet');
    bulletFormState = { id: existing ? existing.id : null };
    renderBulletForm();
    renderRifleForm();
  }
  if (pendingRiflePrefill) {
    const existing = pendingRiflePrefill.name ? findUserRifleByName(pendingRiflePrefill.name) : null;
    // Edit only ever renders for the active rifle now (see
    // renderActiveRifle()) — a prefill matching an existing *other* rifle
    // has to activate it first so its Edit form has somewhere to go.
    if (existing && existing.id !== activeRifleId) activateRifle(existing);
    closeOtherForms('rifle');
    rifleFormState = { id: existing ? existing.id : null };
    renderRifleForm();
    renderBulletForm();
  }

  loadCaliberDesignations().then((list) => {
    designations = list;
    refreshLibraryView();
  }).catch(() => {
    // caliber list unavailable — bullet rows just show a raw mm figure instead
  });

  // Commits whatever's currently staged in the "Active rifle" pane to
  // shot-state.js's shared cookie — called by guns-nav.js's own
  // requestGunsDone() right before it navigates away, never directly.
  // Leaves the previously-running configuration untouched (rather than
  // clearing it) when there's nothing usable to commit: no rifle active
  // at all (manual entry / not-in-Arsenal), or the active one has no
  // cartridges — "the previous running configuration is not changed," as
  // asked, not reset to nothing.
  function commitActiveRifleOnDone() {
    const rifle = activeRifleId ? loadUserRifles().find((r) => r.id === activeRifleId) : null;
    if (!rifle || rifle.cartridges.length === 0) return;
    const cartridgeId = rifle.cartridges.some((c) => c.id === activeCartridgeId) ? activeCartridgeId : rifle.cartridges[0].id;
    saveRifleState({ library: { rifleId: rifle.id, cartridgeId } });
  }
  const unregisterArsenalDoneHandler = registerArsenalDoneHandler(commitActiveRifleOnDone);

  return () => unregisterArsenalDoneHandler();
}
