import { el, clear } from '../dom.js';
import { t } from '../i18n.js';
import {
  loadUserBullets, saveUserBullet, deleteUserBullet, findUserBulletByName, markUserBulletsSaved, importUserBullet,
  loadUserRifles, saveUserRifle, deleteUserRifle, findUserRifleByName, markUserRiflesSaved, importUserRifle,
  generateUserId
} from '../user-library.js';
import { loadCaliberDesignations, designationFor, loadBullet } from '../bullets.js';
import { takePendingBulletPrefill, takePendingRiflePrefill } from '../arsenal-prefill.js';
import { saveRifleState } from '../shot-state.js';
import { takeGunsReturnPath } from '../guns-nav.js';
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
import { engineToDisplay, unitChoice } from '../units.js';
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
  // all) means the list is showing with no form open.
  let bulletFormState = null;
  let rifleFormState = null;
  // Cartridge management only ever applies to the rifle currently open
  // for editing (rifleFormState.id must already be a real, persisted id
  // — see renderRifleForm()'s onSave) — { id: null } = adding a new
  // cartridge to it, { id: <string> } = editing one of its existing ones.
  let cartridgeFormState = null;

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
  const riflesListEl = el('div');
  const rifleFormArea = el('div');

  // Single stable instances (re-appended, never recreated, by
  // renderBullets()/renderRifles() below) — their visibility is toggled
  // by refreshAddButtonVisibility() instead, so opening/closing a form
  // doesn't need to rebuild either list just to hide/reveal these.
  // Hidden while ANY add/edit form is open (bullet, rifle, or — nested
  // within an open rifle form — one of its cartridges), not just the
  // matching section's own, so there's never a second entry point
  // competing with whichever form is already open.
  const bulletAddButton = el('button', { id: 'arsenal-add-bullet', i18n: 'arsenal.addBulletButton' });
  bulletAddButton.addEventListener('click', () => {
    bulletFormState = { id: null };
    renderBulletForm();
    scrollBulletFormIntoView();
  });
  const rifleAddButton = el('button', { id: 'arsenal-add-rifle', i18n: 'arsenal.addRifleButton' });
  rifleAddButton.addEventListener('click', () => {
    rifleFormState = { id: null };
    cartridgeFormState = null;
    renderRifleForm();
    scrollRifleFormIntoView();
  });
  function refreshAddButtonVisibility() {
    const anyFormOpen = !!bulletFormState || !!rifleFormState;
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
  // "Set active" above, which stores the same shaped pointer rather than a
  // snapshot, so an edit to the rifle/cartridge afterward is always
  // reflected. Returns null for a pointer that no longer resolves (deleted
  // since being marked) — shouldn't normally happen, since the rifle/
  // cartridge delete handlers below prune comparison-state.js first, but
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
      id: 'maxRange', min: 100, max: 2000, step: 10, value: 1000,
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
        bulletFormState = { id: bullet.id };
        renderBulletForm();
        scrollBulletFormIntoView();
      });
      const deleteButton = el('button', { class: 'secondary', i18n: 'arsenal.deleteButton' });
      deleteButton.addEventListener('click', () => {
        if (!confirm(t('arsenal.confirmDeleteBullet', { name: bullet.name }))) return;
        deleteUserBullet(bullet.id);
        if (bulletFormState && bulletFormState.id === bullet.id) bulletFormState = null;
        refreshLibraryView();
        renderBulletForm();
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

  function renderCartridges(rifle) {
    const cartridgesListEl = el('div');
    const userBullets = loadUserBullets();
    for (const cartridge of rifle.cartridges) {
      const editButton = el('button', { class: 'secondary', i18n: 'arsenal.editButton' });
      editButton.addEventListener('click', () => {
        cartridgeFormState = { id: cartridge.id };
        renderRifleForm();
      });
      const deleteButton = el('button', { class: 'secondary', i18n: 'arsenal.deleteButton' });
      deleteButton.addEventListener('click', () => {
        if (!confirm(t('arsenal.confirmDeleteCartridge', { name: cartridge.name }))) return;
        saveUserRifle({ ...rifle, cartridges: rifle.cartridges.filter((c) => c.id !== cartridge.id) });
        if (cartridgeFormState && cartridgeFormState.id === cartridge.id) cartridgeFormState = null;
        removeFromComparison(rifle.id, cartridge.id);
        // Removing a cartridge can change which caliber(s)/manufacturer(s)
        // this rifle has (see rifleDesignations()/rifleManufacturers()) —
        // refresh the filters and the rifle list itself, not just this
        // open form.
        refreshLibraryView();
        renderRifleForm();
        renderComparisonSummary();
        renderComparisonSection();
      });
      const cartridgeStability = stabilityIndicator();
      cartridgeStability.update(stabilityValuesFor(rifle, cartridge, userBullets));
      cartridgesListEl.appendChild(el('div', { class: 'arsenal-row' }, [
        el('div', { class: 'arsenal-row-info' }, [
          el('strong', { text: cartridge.name }),
          el('span', { class: 'hint', text: ` — ${cartridge.muzzleVelocity.toFixed(0)} m/s` }),
          cartridgeStability.node
        ]),
        el('div', { class: 'arsenal-row-actions' }, [editButton, deleteButton])
      ]));
    }
    if (rifle.cartridges.length === 0) {
      cartridgesListEl.appendChild(el('p', { class: 'hint', i18n: 'arsenal.noCartridges' }));
    }

    const addButton = el('button', { class: 'secondary', id: 'arsenal-add-cartridge', i18n: 'arsenal.addCartridgeButton' });
    addButton.addEventListener('click', () => {
      cartridgeFormState = { id: null };
      renderRifleForm();
    });
    cartridgesListEl.appendChild(addButton);

    const cartridgeFormArea = el('div');
    if (cartridgeFormState) {
      const editingCartridge = cartridgeFormState.id ? rifle.cartridges.find((c) => c.id === cartridgeFormState.id) : null;
      const form = cartridgeForm({
        initialValues: editingCartridge || {},
        riflingTwistMm: rifleTwistMm(rifle),
        onSave: (data) => {
          const id = cartridgeFormState.id || generateUserId('user-cartridge');
          const cartridges = cartridgeFormState.id
            ? rifle.cartridges.map((c) => (c.id === id ? { ...data, id } : c))
            : [...rifle.cartridges, { ...data, id }];
          saveUserRifle({ ...rifle, cartridges });
          cartridgeFormState = null;
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

  function renderRifles() {
    clear(riflesListEl);
    const allRifles = loadUserRifles();
    const userBullets = loadUserBullets();
    const caliber = caliberFilter.value;
    const manufacturer = manufacturerFilter.value;
    const rifles = allRifles.filter((r) =>
      (caliber === ALL_VALUE || rifleDesignations(r, userBullets).has(caliber)) &&
      (manufacturer === ALL_VALUE || rifleManufacturers(r, userBullets).has(manufacturer))
    );
    if (rifles.length === 0) {
      const emptyKey = allRifles.length === 0 ? 'arsenal.noRifles' : 'arsenal.noRiflesFiltered';
      riflesListEl.appendChild(el('p', { class: 'hint', i18n: emptyKey }));
    }
    for (const rifle of rifles) {
      const modifiedLabel = lastModifiedLabel(rifle);
      const editButton = el('button', { class: 'secondary', i18n: 'arsenal.editButton' });
      editButton.addEventListener('click', () => {
        rifleFormState = { id: rifle.id };
        cartridgeFormState = null;
        renderRifleForm();
        scrollRifleFormIntoView();
      });
      const deleteButton = el('button', { class: 'secondary', i18n: 'arsenal.deleteButton' });
      deleteButton.addEventListener('click', () => {
        if (!confirm(t('arsenal.confirmDeleteRifle', { name: rifle.name }))) return;
        deleteUserRifle(rifle.id);
        if (rifleFormState && rifleFormState.id === rifle.id) rifleFormState = null;
        removeRifleFromComparison(rifle.id);
        refreshLibraryView();
        renderRifleForm();
        renderComparisonSummary();
        renderComparisonSection();
      });

      // "Set active" needs one specific cartridge to pull muzzle velocity
      // and bullet from — a rifle with none saved yet has nothing to offer
      // here, so the control (and its cartridge picker) simply don't show.
      const actionChildren = [];
      // Stability for whichever cartridge activeCartridgeSelect currently
      // points at — null (nothing shown) for a rifle with no cartridges,
      // the same guard the picker itself is behind.
      let rowStability = null;
      if (rifle.cartridges.length > 0) {
        const activeCartridgeSelect = el('select', { class: 'arsenal-active-cartridge' });
        for (const c of rifle.cartridges) activeCartridgeSelect.appendChild(el('option', { value: c.id, text: c.name }));
        const setActiveButton = el('button', { class: 'secondary', i18n: 'arsenal.setActiveButton' });
        setActiveButton.addEventListener('click', () => {
          // Stores just the (rifleId, cartridgeId) pointer — the same shape
          // rifle-section.js's own picker saves via saveLibrarySelection().
          // Every view's rifle/cartridge/bullet sections read this shared
          // state fresh on mount and restore from it (rifle-section.js's
          // catalog-load restoration), which fills in
          // zeroRange/sightHeight/clicks/muzzleVelocity/bullet exactly as
          // if the user had picked this rifle+cartridge there themselves.
          saveRifleState({ library: { rifleId: rifle.id, cartridgeId: activeCartridgeSelect.value } });
          // Same "wherever Guns was opened from" destination Done uses
          // (see guns-nav.js) — this page is only ever reached via Guns'
          // own Arsenal tab now, so this is just Done's own behavior,
          // reused here rather than duplicated.
          location.hash = '#' + takeGunsReturnPath('/trajectory');
        });

        // Shares activeCartridgeSelect with "Set active" above rather than
        // offering a second picker — whichever cartridge is currently
        // chosen there is also the one this button acts on. Its label and
        // disabled state track that selection (a rifle can have one
        // cartridge in comparison and another not, so this can't be a
        // single static per-rifle toggle) and the two-slot cap.
        const compareButton = el('button', { class: 'secondary arsenal-compare-toggle' });
        function refreshCompareButton() {
          const cartridgeId = activeCartridgeSelect.value;
          const inComparison = isSelectedForComparison(rifle.id, cartridgeId);
          compareButton.textContent = t(inComparison ? 'arsenal.removeFromComparisonButton' : 'arsenal.addToComparisonButton');
          compareButton.disabled = !inComparison && !canAddToComparison();
          compareButton.title = compareButton.disabled ? t('arsenal.comparisonFullHint') : '';
        }
        rowStability = stabilityIndicator();
        function refreshRowStability() {
          const cartridge = rifle.cartridges.find((c) => c.id === activeCartridgeSelect.value);
          rowStability.update(cartridge ? stabilityValuesFor(rifle, cartridge, userBullets) : {});
        }
        activeCartridgeSelect.addEventListener('change', refreshRowStability);
        refreshRowStability();

        activeCartridgeSelect.addEventListener('change', refreshCompareButton);
        compareButton.addEventListener('click', () => {
          const cartridgeId = activeCartridgeSelect.value;
          if (isSelectedForComparison(rifle.id, cartridgeId)) {
            removeFromComparison(rifle.id, cartridgeId);
          } else {
            addToComparison(rifle.id, cartridgeId);
          }
          renderRifles(); // just this row's toggle label/state — the library itself didn't change
          renderComparisonSummary();
          renderComparisonSection();
        });
        refreshCompareButton();

        actionChildren.push(activeCartridgeSelect, setActiveButton, compareButton);
      }
      const saveToFileButton = el('button', { class: 'secondary', i18n: 'arsenal.saveToFileButton' });
      saveToFileButton.addEventListener('click', () => exportSingleRifle(rifle));
      actionChildren.push(saveToFileButton, editButton, deleteButton);

      riflesListEl.appendChild(el('div', { class: 'arsenal-row' }, [
        el('div', { class: 'arsenal-row-info' }, [
          el('strong', { text: rifle.name }),
          unsavedBadge(rifle),
          el('span', { class: 'hint', text: t('arsenal.cartridgeCount', { count: rifle.cartridges.length }) }),
          rowStability ? rowStability.node : null,
          modifiedLabel ? el('div', { class: 'hint' }, [modifiedLabel]) : null
        ]),
        el('div', { class: 'arsenal-row-actions' }, actionChildren)
      ]));
    }

    // A single stable instance — see bulletsListEl's matching
    // bulletAddButton append above for why.
    riflesListEl.appendChild(rifleAddButton);
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

  function renderRifleForm() {
    clear(rifleFormArea);
    refreshAddButtonVisibility();
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
        const collision = findUserRifleByName(data.name, { excludeId: rifleFormState.id || undefined });
        const existingRecord = rifleFormState.id ? loadUserRifles().find((r) => r.id === rifleFormState.id) : null;
        if (collision) {
          if (rifleFormState.id && rifleFormState.id !== collision.id) deleteUserRifle(rifleFormState.id);
          saveUserRifle({ ...collision, ...data, id: collision.id });
        } else {
          const id = rifleFormState.id || generateUserId('user-rifle');
          saveUserRifle({ cartridges: [], ...existingRecord, ...data, id });
        }
        rifleFormState = null;
        cartridgeFormState = null;
        refreshLibraryView();
        renderRifleForm();
      },
      onCancel: () => {
        rifleFormState = null;
        cartridgeFormState = null;
        renderRifleForm();
      }
    });

    const sections = [
      el('h2', { i18n: rifleFormState.id ? 'arsenal.editRifleHeading' : 'arsenal.addRifleHeading' }),
      form.node
    ];
    // Cartridges can only be managed once the rifle itself is a real,
    // persisted record — a brand-new "Add Rifle" form doesn't have an id
    // (and so no cartridges array to attach to) until its first Save.
    const persisted = rifleFormState.id ? loadUserRifles().find((r) => r.id === rifleFormState.id) : null;
    if (persisted) sections.push(renderCartridges(persisted));

    rifleFormArea.appendChild(el('div', { class: 'card' }, sections));
  }

  // Scrolls the (already rendered) rifle form's card to the top of the
  // viewport — called only from the two rifle-level "open" actions below,
  // not from renderRifleForm() itself, since that function also re-runs
  // for cartridge add/edit within an already-open rifle form, where
  // re-scrolling back up to the rifle's own top would fight the user
  // right back down to whatever cartridge row they were just looking at.
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
    filterCard,
    el('div', { class: 'card' }, [
      el('h2', { i18n: 'arsenal.riflesHeading' }),
      riflesListEl
    ]),
    rifleFormArea,
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
    bulletFormState = { id: existing ? existing.id : null };
    renderBulletForm();
  }
  if (pendingRiflePrefill) {
    const existing = pendingRiflePrefill.name ? findUserRifleByName(pendingRiflePrefill.name) : null;
    rifleFormState = { id: existing ? existing.id : null };
    renderRifleForm();
  }

  loadCaliberDesignations().then((list) => {
    designations = list;
    refreshLibraryView();
  }).catch(() => {
    // caliber list unavailable — bullet rows just show a raw mm figure instead
  });
}
