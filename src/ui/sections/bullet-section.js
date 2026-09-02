import { el, clear } from '../../dom.js';
import { FIELD_BOUNDS } from '../../units.js';
import { unitField } from '../unit-field.js';
import { sectionGroup } from '../section.js';
import { massDualField } from '../arsenal/mass-field.js';
import { caliberField } from '../arsenal/caliber-field.js';
import { bulletLengthField } from '../arsenal/bullet-length-field.js';
import { loadBulletCatalog, loadBullet, loadBulletLibraries, bulletLibraryForBullet, loadCaliberDesignations, designationFor } from '../../bullets.js';
import { loadUserBullets } from '../../user-library.js';
import { t } from '../../i18n.js';
import { loadCartridgeState, saveCartridgeState } from '../../shot-state.js';
import { isBulletLibraryVisible } from '../../bullet-library-prefs.js';
import { bulletLibraryCheckboxRows } from '../bullet-library-checkboxes.js';
import { setDragModelSelectValue } from '../drag-model-select.js';

const OTHER_VALUE = '__other__';
const ALL_VALUE = '__all__';
const KG_TO_GRAIN = 15432.358352941432; // display-only — bullet weights are conventionally published in grains
// GP11's own BC/model/mass (the built-in K31 entry's cartridge) — used
// whenever a shooter manually enters bc/dragModel without picking a
// library bullet, so kinetic energy (which BC alone can't derive — mass
// and area both cancel out of BC's own definition) has *some* value to
// work from until they enter their own. Matches the K31-derived defaults
// in rifle-section.js/cartridge-section.js, so a fresh install's manual
// entry describes one consistent rifle+cartridge+bullet out of the box.
const DEFAULT_BULLET_STATE = {
  selectedId: OTHER_VALUE, manualBc: 0.274, manualDragModel: 'G7', manualMassKg: 0.0113,
  manualCaliberM: 0.00778, manualLengthM: 0.035
};

// The bullet's own properties: either picked from the built-in library
// (a known BC+model, or — when the library entry carries one — the
// bullet's own measured Cd-Mach table) or "Other", which falls back to
// today's manual BC + drag-model entry. Always rendered nested inside a
// Cartridge section — a bullet doesn't exist as its own shot parameter,
// only as part of a loaded cartridge.
export function bulletSection({ slider = false, onInput } = {}) {
  const savedCartridge = loadCartridgeState();
  const initial = { ...DEFAULT_BULLET_STATE, ...(savedCartridge && savedCartridge.bullet) };

  // The user's own manual bc/dragModel, tracked independently of whatever
  // bcField/dragModelSelect currently *display* — a BC-profile library
  // bullet borrows those same two fields to show its own bc/model
  // read-only (see showLibraryInfo() below), which must not clobber the
  // manual entry underneath it. Only updated from the fields' own
  // input/change listeners, which can't fire while disabled — i.e. only
  // while "Other" is actually selected.
  let manualBc = initial.manualBc;
  let manualDragModel = initial.manualDragModel;
  let manualMassKg = initial.manualMassKg;
  // Both optional (null when left blank) — unlike bc/dragModel/mass, a
  // manual bullet doesn't strictly need either of these to be integrated
  // into the drag calculation itself, only to feed stability.js's Miller
  // formula and, through it, spin-drift.js (see getStabilityValues()
  // below). Missing either one just means stability/spin drift stay
  // "unknown" for this bullet, same graceful degradation as a library
  // bullet with no lengthM already gets.
  let manualCaliberM = initial.manualCaliberM;
  let manualLengthM = initial.manualLengthM;

  // Persists whichever bullet is currently selected (a library id or
  // "Other") together with the last *manual* bc/dragModel/mass/caliber/
  // length — deliberately not reading bcField/dragModelSelect here, since
  // a BC-profile library bullet borrows those same two fields to display
  // its own values (see showLibraryInfo() below) and they'd no longer
  // hold the manual entry at the time this runs.
  function saveBulletSelection() {
    saveCartridgeState({
      bullet: { selectedId: bulletSelect.value, manualBc, manualDragModel, manualMassKg, manualCaliberM, manualLengthM }
    });
  }

  // Called only from the manual fields' own listeners, which can only fire
  // while genuinely editable — i.e. only while "Other" is selected, since
  // a rifle-library lock (see lockToBullet() below) disables them. Updates
  // the actual remembered manual entry, then persists it the same way
  // saveBulletSelection() does.
  function saveManualBullet() {
    manualBc = bcField.getEngineValue();
    manualDragModel = dragModelSelect.value;
    manualMassKg = manualMassField.getMassKg();
    manualCaliberM = manualCaliber.getCaliberM();
    manualLengthM = manualLengthField.getLengthM();
    saveBulletSelection();
  }

  const bcField = unitField({
    id: 'bc', ...FIELD_BOUNDS.bc, step: 0.001, value: initial.manualBc, slider,
    onInput: () => { saveManualBullet(); if (onInput) onInput(); }
  });
  const dragModelSelect = el('select', { id: 'dragModel' });
  setDragModelSelectValue(dragModelSelect, initial.manualDragModel);
  dragModelSelect.addEventListener('change', () => { saveManualBullet(); if (onInput) onInput(); });

  const manualFields = el('div', {}, [
    bcField.node,
    el('div', { class: 'field' }, [el('label', { i18n: 'common.dragModel' }), dragModelSelect])
  ]);

  // Kept out of manualFields (unlike bcField/dragModelSelect) since a
  // BC-profile library bullet borrows manualFields to show its own bc/model
  // read-only (see showLibraryInfo() below) but already has its mass shown
  // as plain text in infoBox — showing this too would just duplicate it.
  // Only ever visible for genuine manual ("Other") entry.
  const manualMassField = massDualField({
    value: initial.manualMassKg,
    onInput: () => { saveManualBullet(); if (onInput) onInput(); }
  });

  // Caliber and length: the same shared components bullet-form.js's own
  // Arsenal fields use (see caliber-field.js/bullet-length-field.js) — a
  // manual bullet isn't picked from a catalog, but its caliber/length can
  // still be entered either way (caliber: a known designation, or a raw
  // diameter that gets matched against one automatically). Both kept out
  // of manualFields (like manualMassField above) since a BC-profile
  // library bullet borrows manualFields to show its own bc/model
  // read-only but already has its own caliber/length in infoBox's summary
  // text — these must only ever be visible/editable for genuine manual
  // ("Other") entry.
  const manualCaliber = caliberField({
    value: initial.manualCaliberM,
    onInput: () => { saveManualBullet(); if (onInput) onInput(); }
  });
  const manualLengthField = bulletLengthField({
    value: initial.manualLengthM,
    onInput: () => { saveManualBullet(); if (onInput) onInput(); }
  });
  const manualCaliberLengthFields = el('div', {}, [
    manualCaliber.node,
    manualLengthField.node,
    el('p', { class: 'hint', i18n: 'fields.bulletCaliberLengthHint' })
  ]);

  const caliberFilter = el('select', { id: 'bulletCaliberFilter' }, [
    el('option', { value: ALL_VALUE, i18n: 'fields.bulletFilterAllCalibers' })
  ]);
  const manufacturerFilter = el('select', { id: 'bulletManufacturerFilter' }, [
    el('option', { value: ALL_VALUE, i18n: 'fields.bulletFilterAllManufacturers' })
  ]);
  const bulletSelect = el('select', { id: 'bulletSelect' }, [
    el('option', { value: OTHER_VALUE, i18n: 'fields.bulletOther' })
  ]);

  const infoBox = el('div', { class: 'hint bullet-library-info' });
  infoBox.style.display = 'none';

  // Shown instead of manualFields when the selected library bullet uses
  // its own measured Cd-Mach table rather than a BC + standard model —
  // there's no bc/dragModel to display read-only in that case, just the
  // fact that a bullet-specific curve is driving the drag calculation
  // (the actual Mach/Cd pairs aren't shown; there's nowhere useful for a
  // reader to use raw drag-coefficient numbers).
  const cdTableHint = el('p', { class: 'hint', i18n: 'fields.bulletCustomCdTable' });
  cdTableHint.style.display = 'none';

  // Shown only while a rifle-library cartridge selection has taken over
  // this bullet (see lockToBullet() below) — the filters/select/infoBox
  // already read as read-only once disabled, but this spells out *why*.
  const lockedHint = el('p', { class: 'hint', i18n: 'fields.bulletLockedHint' });
  lockedHint.style.display = 'none';

  // Kept as named fields (not just inlined into `node` below) so
  // lockToBullet()/unlock() can hide them entirely — a locked cartridge
  // already forces one specific bullet, so filtering the picker down to
  // find it is a control with nothing left to do. Also hidden (see
  // updatePickerVisibility() below) whenever the built-in library is
  // switched off and there are no Arsenal bullets to offer either —
  // nothing left to pick from at all, in that case.
  const caliberFilterField = el('div', { class: 'field' }, [el('label', { i18n: 'fields.bulletCaliberFilter' }), caliberFilter]);
  const manufacturerFilterField = el('div', { class: 'field' }, [el('label', { i18n: 'fields.bulletManufacturerFilter' }), manufacturerFilter]);
  const bulletPickerField = el('div', { class: 'field' }, [el('label', { i18n: 'fields.bulletPicker' }), bulletSelect]);

  // Duplicated in every place a bullet input is expected (this section,
  // wherever it's nested), always visible — even when there's currently
  // nothing to pick from — so the user can turn a built-in library back
  // on without a trip to Settings. Cookie-backed (bullet-library-prefs.js)
  // and read fresh at every mount, same shared widget Settings' own list
  // uses — see ../bullet-library-checkboxes.js.
  const bulletLibraryRows = bulletLibraryCheckboxRows(() => {
    rebuildCatalog();
    if (onInput) onInput();
  });

  const node = sectionGroup('sections.bulletHeading', [
    lockedHint,
    ...bulletLibraryRows.map((r) => r.field),
    caliberFilterField,
    manufacturerFilterField,
    bulletPickerField,
    infoBox,
    cdTableHint,
    manualFields,
    manualMassField.node,
    manualCaliberLengthFields
  ], { nested: true });

  // Resolved bullets (full records) with a .designation attached — the
  // caliber label a bullet is filtered/shown by is looked up from its
  // physical diameter, not stored per-bullet. `catalog` is what the
  // filters/picker actually read; `builtInBullets` is the built-in half
  // of it, cached once (a network fetch) so toggling the checkbox can
  // recompute `catalog` (built-ins + a fresh read of the user's own
  // bullets, which can change between renders) without re-fetching.
  let builtInBullets = [];
  let cachedDesignations = [];
  let catalog = [];
  let selectedBullet = null; // entry from `catalog`, or null when "Other"

  function updatePickerVisibility() {
    const hasAnythingToOffer = loadBulletLibraries().some((lib) => isBulletLibraryVisible(lib.id)) || loadUserBullets().length > 0;
    const display = hasAnythingToOffer ? '' : 'none';
    caliberFilterField.style.display = display;
    manufacturerFilterField.style.display = display;
    bulletPickerField.style.display = display;
  }

  function rebuildCatalog() {
    const userBullets = loadUserBullets().map((b) => ({ ...b, isUser: true, designation: designationFor(b.caliberM, cachedDesignations) }));
    catalog = [...builtInBullets.filter((b) => isBulletLibraryVisible(b.libraryId)), ...userBullets];
    refreshFilterOptions();
    populateBulletOptions();
    updatePickerVisibility();
  }
  rebuildCatalog(); // user bullets (synchronous — localStorage) show immediately; built-ins join once the fetch below resolves

  function rebuildFilterSelect(select, values, allLabelKey, previousValue) {
    clear(select);
    select.appendChild(el('option', { value: ALL_VALUE, i18n: allLabelKey }));
    for (const v of values) select.appendChild(el('option', { value: v, text: v }));
    select.value = values.includes(previousValue) ? previousValue : ALL_VALUE;
  }

  // Each filter's own option list is driven by the *other* filter's
  // current selection, so picking a caliber hides manufacturers that
  // don't make anything in it, and vice versa — a plain "filter the
  // picker" pass wouldn't touch the filters' own option lists at all.
  function refreshFilterOptions() {
    const currentCaliber = caliberFilter.value;
    const currentManufacturer = manufacturerFilter.value;

    const manufacturersForCaliber = [...new Set(
      catalog.filter((b) => currentCaliber === ALL_VALUE || b.designation === currentCaliber).map((b) => b.manufacturer)
    )].sort();
    const calibersForManufacturer = uniqueCalibersSortedByDiameter(
      catalog.filter((b) => currentManufacturer === ALL_VALUE || b.manufacturer === currentManufacturer)
    );

    rebuildFilterSelect(manufacturerFilter, manufacturersForCaliber, 'fields.bulletFilterAllManufacturers', currentManufacturer);
    rebuildFilterSelect(caliberFilter, calibersForManufacturer, 'fields.bulletFilterAllCalibers', currentCaliber);
  }

  // Ordered by actual bore diameter, not a string sort of the designation
  // labels — a plain alphabetical sort would scatter e.g. ".224" and
  // ".22 LR" away from "5.45mm"/"6.5mm" that sit between them by
  // diameter, unlike every other place a caliber list is shown (see
  // caliber-designations.json itself, and bullet-form.js's own select).
  // Each bullet already carries its own caliberM, so this doesn't need to
  // consult caliber-designations.json separately — that's also what makes
  // it correct for a caliber this app doesn't recognize (designationFor's
  // raw-mm fallback), not just the tabulated ones.
  function uniqueCalibersSortedByDiameter(bullets) {
    const caliberMByDesignation = new Map();
    for (const b of bullets) {
      if (!caliberMByDesignation.has(b.designation)) caliberMByDesignation.set(b.designation, b.caliberM);
    }
    return [...caliberMByDesignation.keys()].sort((a, b) => caliberMByDesignation.get(a) - caliberMByDesignation.get(b));
  }

  function populateBulletOptions() {
    const caliber = caliberFilter.value;
    const manufacturer = manufacturerFilter.value;
    const previousValue = bulletSelect.value;

    clear(bulletSelect);
    bulletSelect.appendChild(el('option', { value: OTHER_VALUE, i18n: 'fields.bulletOther' }));

    const filtered = catalog.filter((b) =>
      (caliber === ALL_VALUE || b.designation === caliber) &&
      (manufacturer === ALL_VALUE || b.manufacturer === manufacturer)
    );
    for (const b of filtered) {
      const grains = Math.round(b.massKg * KG_TO_GRAIN);
      // "* " marks a user's own Arsenal entry; a built-in bullet instead
      // gets its owning library's own bracketed prefix (e.g. "[LCd] ") —
      // the two are mutually exclusive, and both conventions are shared
      // with every other merged picker in the app (see cartridge-form.js).
      const prefix = b.isUser ? '* ' : (b.libraryPrefix ? `[${b.libraryPrefix}] ` : '');
      bulletSelect.appendChild(el('option', { value: b.id, text: `${prefix}${b.manufacturer} ${b.name} (${b.designation}, ${grains}gr)` }));
    }

    const stillOffered = previousValue === OTHER_VALUE || filtered.some((b) => b.id === previousValue);
    bulletSelect.value = stillOffered ? previousValue : OTHER_VALUE;
    if (!stillOffered) selectBullet(OTHER_VALUE);
  }

  function onFiltersChanged() {
    refreshFilterOptions();
    populateBulletOptions();
  }

  function showManualFields() {
    manualFields.style.display = '';
    manualMassField.node.style.display = '';
    manualCaliberLengthFields.style.display = '';
    infoBox.style.display = 'none';
    cdTableHint.style.display = 'none';
    bcField.setEngineValue(manualBc);
    bcField.setDisabled(false);
    setDragModelSelectValue(dragModelSelect, manualDragModel);
    dragModelSelect.disabled = false;
    manualMassField.setMassKg(manualMassKg);
    manualCaliber.setCaliberM(manualCaliberM);
    manualLengthField.setLengthM(manualLengthM);
  }

  function showLibraryInfo(bullet) {
    infoBox.style.display = '';
    manualMassField.node.style.display = 'none';
    manualCaliberLengthFields.style.display = 'none';
    const grains = Math.round(bullet.massKg * KG_TO_GRAIN);
    const grams = (bullet.massKg * 1000).toFixed(2);
    // Length is optional for a user's own Arsenal bullet (see
    // bullet-form.js) — the built-in library always has it, but this
    // must not assume that, or a missing lengthM becomes a literal "NaNmm"
    // in the summary below.
    const lengthPart = bullet.lengthM != null ? `${(bullet.lengthM * 1000).toFixed(2)}mm, ` : '';
    const caliberMm = (bullet.caliberM * 1000).toFixed(4);
    const namePrefix = bullet.isUser ? '* ' : (bullet.libraryPrefix ? `[${bullet.libraryPrefix}] ` : '');
    const sourceText = bullet.source ? ` ${t('fields.bulletSource')}: ${bullet.source}` : '';
    infoBox.textContent =
      `${namePrefix}${bullet.manufacturer} ${bullet.name} — ${bullet.designation} (${caliberMm}mm), ` +
      `${lengthPart}${grains}gr (${grams}g).${sourceText}`;

    // BC + standard model: reuse the same bc/dragModel fields the manual
    // path uses, showing the library bullet's own values read-only — the
    // "information" the caller asked for. A bullet-specific Cd-Mach table
    // has no bc/model to show there at all; cdTableHint stands in for it.
    if (bullet.profile.type === 'bc') {
      manualFields.style.display = '';
      cdTableHint.style.display = 'none';
      bcField.setEngineValue(bullet.profile.bc);
      bcField.setDisabled(true);
      setDragModelSelectValue(dragModelSelect, bullet.profile.model);
      dragModelSelect.disabled = true;
    } else {
      manualFields.style.display = 'none';
      cdTableHint.style.display = '';
    }
  }

  // Deliberately searches *every* known bullet (built-in + Arsenal), not
  // just the toggle-filtered `catalog` the casual picker's own options
  // come from — a rifle-driven lockToBullet() must still resolve a
  // built-in bulletId even while "Show built-in bullets library" is
  // switched off, since that setting only hides built-ins from casual
  // browsing, not from a rifle cartridge that already names one.
  function findKnownBullet(id) {
    const userBullets = loadUserBullets().map((b) => ({ ...b, isUser: true, designation: designationFor(b.caliberM, cachedDesignations) }));
    return [...builtInBullets, ...userBullets].find((b) => b.id === id) || null;
  }

  // Synchronous: by the time bulletSelect can offer anything other than
  // "Other", the catalog (every bullet's full record) has already
  // resolved — there's nothing left to fetch at selection time.
  function selectBullet(id) {
    if (id === OTHER_VALUE) {
      selectedBullet = null;
      showManualFields();
    } else {
      selectedBullet = findKnownBullet(id);
      if (selectedBullet) showLibraryInfo(selectedBullet);
    }
    if (onInput) onInput();
  }

  caliberFilter.addEventListener('change', onFiltersChanged);
  manufacturerFilter.addEventListener('change', onFiltersChanged);
  bulletSelect.addEventListener('change', () => {
    selectBullet(bulletSelect.value);
    saveBulletSelection();
  });

  // Captured (rather than fire-and-forget) so lockToBullet() below can
  // await the same catalog load bulletSelect's own options depend on —
  // without it, a rifle-library cartridge selected before the catalog
  // resolves would try to look up a bullet id in a still-empty `catalog`.
  const catalogReady = Promise.all([loadBulletCatalog(), loadCaliberDesignations()])
    .then(([ids, designations]) => {
      cachedDesignations = designations;
      // allSettled, not all: one bullet id failing to load (a transient
      // fetch blip, a cache gap on a fresh install) must not blank out
      // the other 60-odd that loaded fine — see the same fix applied to
      // service-worker.js's own precache install for the same reasoning.
      return Promise.allSettled(ids.map((id) => loadBullet(id)))
        .then((results) => {
          const failedCount = results.filter((r) => r.status === 'rejected').length;
          console[failedCount ? 'warn' : 'log'](
            `[catalog:bullets] ${ids.length - failedCount}/${ids.length} built-in bullets loaded${failedCount ? ` (${failedCount} failed)` : ''}`
          );
          return results.filter((r) => r.status === 'fulfilled').map((r) => r.value);
        });
    })
    .then((bullets) => {
      builtInBullets = bullets.map((b) => {
        const lib = bulletLibraryForBullet(b.id);
        return { ...b, designation: designationFor(b.caliberM, cachedDesignations), libraryId: lib ? lib.id : null, libraryPrefix: lib ? lib.prefix : null };
      });
      rebuildCatalog();
      // Restore a library bullet a previous view's session left selected
      // (a manual bc/dragModel was already seeded at construction time
      // above — this only needs to happen for the library case). Left
      // fully interactive, unlike lockToBullet()'s restore — this is a
      // session starting point, not a rifle-driven lock.
      if (initial.selectedId !== OTHER_VALUE && catalog.some((b) => b.id === initial.selectedId)) {
        selectBullet(initial.selectedId);
        bulletSelect.value = initial.selectedId;
      }
    })
    .catch(() => {
      // Individual bullet failures no longer land here (see allSettled
      // above) — this now only catches loadCaliberDesignations() itself
      // failing, or the catalog fetch never resolving at all. Either
      // way: "Other" and the user's own Arsenal bullets still work fine.
      rebuildCatalog();
    });

  // massKg is always included — every catalog bullet record carries its
  // own mass regardless of drag-model profile, and a manual "Other" entry
  // now has its own mass field too (see manualMassField above). The
  // engine itself only needs mass for the cdTable path (BC already folds
  // mass/area into one number — see makeStepper() in trajectory.js); the
  // rest of it is purely for the kinetic-energy column/chart, which can't
  // derive mass from BC alone.
  function getValues() {
    if (selectedBullet) {
      const profile = selectedBullet.profile;
      if (profile.type === 'cdTable') {
        return { cdTable: profile.table, massKg: selectedBullet.massKg, caliberM: selectedBullet.caliberM };
      }
      return { bc: profile.bc, dragModel: profile.model, massKg: selectedBullet.massKg };
    }
    return { bc: bcField.getEngineValue(), dragModel: dragModelSelect.value, massKg: manualMassField.getMassKg() };
  }

  // For "Add to arsenal" (see trajectory-view.js): whatever's currently
  // in play, shaped for bullet-form.js's initialValues. A selected
  // library bullet contributes everything it knows (letting the user
  // save an edited copy of it), including its own Cd-Mach table if that's
  // what it has — the Arsenal form supports both profile types, so
  // there's no longer a reason to drop one of them here. Manual "Other"
  // entry carries over its own caliber/length too now (null when left
  // blank, same as bulletForm()'s own DEFAULT_VALUES) — bulletForm()'s
  // caliber <select> only actually adopts a carried-over caliberM when it
  // matches a real designation (see designationFor()'s tolerance there);
  // an unmatched or missing one just leaves that select's placeholder
  // selected, same graceful fallback as typing in an unrecognized caliber
  // directly on the Arsenal form.
  function getArsenalPrefill() {
    if (selectedBullet) {
      return {
        name: selectedBullet.name,
        manufacturer: selectedBullet.manufacturer,
        caliberM: selectedBullet.caliberM,
        lengthM: selectedBullet.lengthM,
        massKg: selectedBullet.massKg,
        source: selectedBullet.source,
        ...(selectedBullet.profile.type === 'bc'
          ? { bc: selectedBullet.profile.bc, dragModel: selectedBullet.profile.model }
          : { cdTable: selectedBullet.profile.table })
      };
    }
    return {
      bc: bcField.getEngineValue(), dragModel: dragModelSelect.value, massKg: manualMassField.getMassKg(),
      caliberM: manualCaliberM, lengthM: manualLengthM
    };
  }

  // Driven by a rifle library cartridge selection: forces this bullet
  // (bypassing the filters, exactly like picking it from bulletSelect
  // would) and disables every interactive control so the user can't
  // override it while the cartridge governs it — see cartridge-section.js.
  async function lockToBullet(id) {
    caliberFilter.value = ALL_VALUE;
    manufacturerFilter.value = ALL_VALUE;
    await catalogReady;
    // Force the full built-in set into the picker's own option list while
    // locked, regardless of "Show built-in bullets library" — a
    // rifle-driven lock must always be able to display its own bullet,
    // even one the user has otherwise hidden from casual browsing.
    // unlock() restores the toggle-respecting catalog via rebuildCatalog().
    catalog = [...builtInBullets, ...loadUserBullets().map((b) => ({ ...b, isUser: true, designation: designationFor(b.caliberM, cachedDesignations) }))];
    refreshFilterOptions();
    populateBulletOptions();
    selectBullet(id);
    bulletSelect.value = id;
    caliberFilter.disabled = true;
    manufacturerFilter.disabled = true;
    bulletSelect.disabled = true;
    bcField.setDisabled(true);
    dragModelSelect.disabled = true;
    caliberFilterField.style.display = 'none';
    manufacturerFilterField.style.display = 'none';
    lockedHint.style.display = '';
  }

  // Returns control to the user: back to "Other", with every control
  // interactive again.
  function unlock() {
    caliberFilter.disabled = false;
    manufacturerFilter.disabled = false;
    bulletSelect.disabled = false;
    bcField.setDisabled(false);
    dragModelSelect.disabled = false;
    lockedHint.style.display = 'none';
    rebuildCatalog(); // back to the toggle-respecting catalog/options (and picker visibility)
    selectBullet(OTHER_VALUE);
    bulletSelect.value = OTHER_VALUE;
  }

  // For stability.js's Miller's-formula indicator, which — unlike
  // getValues() — needs the bullet's own physical diameter/length
  // regardless of drag-model profile. Pulled straight off selectedBullet
  // (every catalog record carries them) rather than from bcField/
  // dragModelSelect, which a bc-profile library bullet only borrows to
  // *display* its own values (see showLibraryInfo() above). A manual
  // "Other" entry reports its own manualCaliberM/manualLengthM here,
  // which are null whenever the corresponding field is left blank —
  // canComputeStability() (stability.js) already treats any null among
  // its five inputs as "stability unknown," the same graceful fallback a
  // library bullet with no lengthM gets.
  function getStabilityValues() {
    return {
      massKg: selectedBullet ? selectedBullet.massKg : manualMassField.getMassKg(),
      caliberM: selectedBullet ? selectedBullet.caliberM : manualCaliberM,
      lengthM: selectedBullet ? selectedBullet.lengthM : manualLengthM
    };
  }

  return { node, getValues, lockToBullet, unlock, getArsenalPrefill, getStabilityValues };
}
