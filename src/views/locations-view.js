import { el, clear } from '../dom.js';
import { t } from '../i18n.js';
import {
  loadUserLocations, saveUserLocation, deleteUserLocation, findUserLocationByName,
  markUserLocationsSaved, importUserLocation
} from '../location-library.js';
import { generateUserId } from '../user-library.js';
import { locationForm } from '../ui/locations/location-form.js';
import { targetForm } from '../ui/locations/target-form.js';
import { locationExportDialog } from '../ui/locations/location-export-dialog.js';
import { locationImportDialog } from '../ui/locations/location-import-dialog.js';
import { buildExportPayload, serializeExport, parseImportPayload, resolveImportItem } from '../location-export.js';
import { downloadFile } from '../download.js';
import {
  loadRangeSolverLocationState, saveRangeSolverLocationState,
  saveRangeSolverTargetState, saveRangeSolverAtmosphereState, wasAtmosphereTouchedThisSession
} from '../range-solver-state.js';
import { standardAtmosphereAt } from '../engine/atmosphere.js';
import { UNIT_GROUPS, unitChoice, engineToDisplay } from '../units.js';
import { formatTargetSummary } from '../ui/locations/target-summary.js';
import { getUnit } from '../prefs.js';
import { setLocationsMode } from '../locations-nav.js';
import { shouldClearTargetCoords } from '../location-photo.js';
import { setPendingPlacement } from '../location-placement-nav.js';

function downloadJsonFile(filename, text) {
  downloadFile(filename, text, 'application/json');
}

// Same cosmetic-only sanitizing as arsenal-view.js's own sanitizeFilename.
function sanitizeFilename(name) {
  return name.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'location';
}

// Same FIELD_UNITS/getUnit() display convention range-solver-view.js's
// own conditions bar uses — kept here for altitude specifically;
// range/LoS-angle summaries go through the shared formatTargetSummary().
function formatWithUnit(fieldId, groupName, engineValue) {
  const group = UNIT_GROUPS[groupName];
  const displayUnit = getUnit(groupName);
  const choice = unitChoice(fieldId, displayUnit) || group.choices.find((c) => c.unit === group.defaultUnit);
  return `${engineToDisplay(fieldId, engineValue, choice.unit).toFixed(choice.decimals)} ${choice.label}`;
}

export function mount(container) {
  clear(container);
  // Its own dedicated nav (Done only) — see locations-nav.js.
  setLocationsMode(true);

  // { id: null } while adding a brand new location, { id: <string> }
  // while editing an existing one, null = no form open — same convention
  // as arsenal-view.js's own bulletFormState/rifleFormState. Editing only
  // ever targets the *current* location (see renderLocations()); adding
  // is independent of which location is current.
  let locationFormState = null;
  // Target add/edit only ever applies to one specific location at a time
  // (locationId always a real, persisted id — same "must already be
  // saved" rule arsenal-view.js's cartridgeFormState follows for its
  // parent rifle).
  let targetFormState = null; // { locationId, id: null | string }
  // The location form's own photo field's current (possibly unsaved)
  // value, mirrored live via locationForm's onPhotoChange — lets
  // renderTargets() preview the not-placed badges against what Save would
  // actually do right now, not just the last-persisted photo. Reset to
  // the persisted value every time renderLocationForm() (re)builds the
  // form, which — since Cancel simply closes the form without ever
  // touching this — is also what makes Cancel implicitly "revert" it.
  let locationPhotoPreview = null;

  let exportDialogState = false;
  let importState = null; // { locations } once a picked file's been parsed
  let importErrorKey = null;
  let importSummary = null;

  const locationsListEl = el('div');
  // Stable, reused node (never recreated — only cleared/refilled) so it
  // can be re-parented by renderLocations() into whichever spot the
  // currently open location form belongs in: nested under the current
  // location's own row when editing it, or down by "Add location" when
  // adding a brand new one.
  const locationFormArea = el('div');
  // Same idea, one level down — whichever target's own edit/add form is
  // open gets this node positioned right under its row (or, for Add,
  // after the target list) by renderTargets().
  const targetFormArea = el('div');
  const exportDialogArea = el('div');
  const importArea = el('div');
  const importErrorArea = el('p', { class: 'hint warning' });
  importErrorArea.style.display = 'none';
  const importSummaryArea = el('p', { class: 'hint' });
  importSummaryArea.style.display = 'none';

  function unsavedBadge(entry) {
    if (!entry.unsaved) return null;
    return el('span', { class: 'unsaved-badge', title: t('arsenal.unsavedBadgeTitle'), text: t('arsenal.unsavedBadge') });
  }

  // Shown on a target whenever its parent location has a photo but this
  // target hasn't been placed on it yet (see location-placement-view.js)
  // — recomputed fresh on every render from the location's own current
  // `photo`/target `coords`, so it always reflects the latest saved photo
  // state with no separate "on photo change" hook needed.
  function notPlacedBadge() {
    return el('span', { class: 'not-placed-badge', title: t('rangeSolverLocations.notPlacedBadgeTitle'), text: t('rangeSolverLocations.notPlacedBadge') });
  }

  function lastModifiedLabel(entry) {
    if (!entry.modifiedAt) return null;
    const date = new Date(entry.modifiedAt);
    if (Number.isNaN(date.getTime())) return null;
    return t('arsenal.lastModified', { date: date.toISOString().slice(0, 16).replace('T', ' ') });
  }

  function refreshLibraryView() {
    renderLocations();
  }

  function exportSingleLocation(location) {
    const payload = buildExportPayload({ locations: [location] });
    downloadJsonFile(`gb-loc-${sanitizeFilename(location.name)}.json`, serializeExport(payload));
    markUserLocationsSaved([location.id]);
    refreshLibraryView();
  }

  // Writes the standard-atmosphere/50%-humidity default straight into
  // Range Solver's own cookie-backed atmosphere slice, bypassing
  // atmosphereSection's preset select entirely (it lands on "Custom" like
  // any other hand-set value once that tab next mounts) — only when the
  // location actually has an altitude, and only if the user hasn't
  // already taken over the Atmosphere tab themselves this session.
  function applyLocationAltitudeDefault(location) {
    if (location.altitudeM == null || wasAtmosphereTouchedThisSession()) return;
    const { tempC, pressureHpa } = standardAtmosphereAt(location.altitudeM);
    saveRangeSolverAtmosphereState({
      tempC, pressureHpa, altitudeM: location.altitudeM, humidityPct: 50, atmospherePreset: 'custom'
    });
  }

  // `activeLocation` (not `location`) deliberately — this module already
  // uses the bare global `location` (window.location) for navigation
  // below, and shadowing it here would silently break that. Unlike the
  // old setActiveLocation(), this never navigates away — clicking a
  // location in "Known locations" activates it in place and scrolls the
  // Current-location pane into view.
  function activateLocation(activeLocation) {
    if (!activeLocation) {
      saveRangeSolverLocationState({ locationId: null, targetId: null });
    } else {
      const targetId = activeLocation.targets[0]?.id ?? null;
      saveRangeSolverLocationState({ locationId: activeLocation.id, targetId });
      // Seeds the Target tab's own range/LoS cookie slice with this
      // target's values, exactly as if the user had picked it from that
      // tab's own selector — without this, Range Solver would show
      // whatever was left over from before and immediately flag a false
      // "diverged from the target" state that was never really an edit.
      const target = activeLocation.targets.find((tg) => tg.id === targetId);
      if (target) saveRangeSolverTargetState({ rangeM: target.rangeM, losAngleDeg: target.losAngleDeg });
      applyLocationAltitudeDefault(activeLocation);
    }
    // The previous current location's own edit/target-edit state doesn't
    // carry over once it's back in the list, where Edit isn't offered.
    locationFormState = null;
    targetFormState = null;
    refreshLibraryView();
    scrollCurrentLocationIntoView();
  }

  function scrollCurrentLocationIntoView() {
    const el_ = currentLocationSectionEl;
    if (el_ && el_.firstChild) el_.firstChild.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  let currentLocationSectionEl = null;

  // Builds one target's own row plus, immediately under it, its edit form
  // when open ("The target edit form appears right underneath the target
  // row concerned" — not collected at the bottom of the list as before).
  // `loc` (not `location`) deliberately — its own "Place it" button below
  // navigates via the bare global `location.hash`, and shadowing it here
  // would silently break that (same reasoning as setActiveLocation's own
  // activeLocation parameter).
  function renderTargetRow(loc, target, index, photoContextActive, photoWouldChange) {
    const displayName = target.name || t('rangeSolverLocations.defaultTargetName', { n: index + 1 });
    const editButton = el('button', { class: 'secondary', i18n: 'rangeSolverLocations.editButton' });
    editButton.addEventListener('click', () => {
      targetFormState = { locationId: loc.id, id: target.id };
      renderLocationForm();
      scrollTargetFormIntoView();
    });
    const deleteButton = el('button', { class: 'secondary', i18n: 'rangeSolverLocations.deleteButton' });
    deleteButton.addEventListener('click', () => {
      if (!confirm(t('rangeSolverLocations.confirmDeleteTarget', { name: displayName }))) return;
      saveUserLocation({ ...loc, targets: loc.targets.filter((tg) => tg.id !== target.id) });
      if (targetFormState && targetFormState.locationId === loc.id && targetFormState.id === target.id) targetFormState = null;
      refreshLibraryView();
      renderLocationForm();
    });
    const actions = [editButton];
    if (loc.photo) {
      const placeItButton = el('button', { class: 'secondary', i18n: 'rangeSolverLocations.placeItButton' });
      placeItButton.addEventListener('click', () => {
        setPendingPlacement({ locationId: loc.id, targetId: target.id, returnPath: '/locations', selectMode: false });
        location.hash = '#/locations/place';
      });
      actions.push(placeItButton);
    }
    actions.push(deleteButton);

    const rowEl = el('div', { class: 'arsenal-row' }, [
      el('div', { class: 'arsenal-row-info' }, [
        el('strong', { text: displayName }),
        photoContextActive && (photoWouldChange || !target.coords) ? notPlacedBadge() : null,
        el('span', { class: 'hint', text: ` — ${formatTargetSummary(target.rangeM, target.losAngleDeg)}` }),
        target.notes ? el('div', { class: 'hint', text: target.notes }) : null
      ]),
      el('div', { class: 'arsenal-row-actions' }, actions)
    ]);

    const wrapper = el('div', {}, [rowEl]);
    if (targetFormState && targetFormState.locationId === loc.id && targetFormState.id === target.id) {
      wrapper.appendChild(targetFormArea);
    }
    return wrapper;
  }

  // Always rendered for the current location (not gated on locationFormState
  // — its targets matter whether or not you're mid-edit of the location's
  // own name/altitude/photo). `loc`, same shadowing reasoning as above.
  function renderTargets(loc) {
    const targetsListEl = el('div');

    // Live preview of what Save would actually do right now — but only
    // while this location's own edit form is actually open; the rest of
    // the time (the target list is now always shown, not just mid-edit)
    // locationPhotoPreview is stale/irrelevant leftover state from
    // whenever a form was last open, so fall back to the plain persisted
    // photo with no "would change" override at all.
    const isEditingThisLocation = !!(locationFormState && locationFormState.id === loc.id);
    const photoWouldChange = isEditingThisLocation && shouldClearTargetCoords(loc.photo, locationPhotoPreview);
    const photoContextActive = isEditingThisLocation ? (!!locationPhotoPreview || !!loc.photo) : !!loc.photo;

    loc.targets.forEach((target, index) => {
      targetsListEl.appendChild(renderTargetRow(loc, target, index, photoContextActive, photoWouldChange));
    });
    if (loc.targets.length === 0) {
      targetsListEl.appendChild(el('p', { class: 'hint', i18n: 'rangeSolverLocations.noTargets' }));
    }

    const addButton = el('button', { class: 'secondary', id: 'location-add-target', i18n: 'rangeSolverLocations.addTargetButton' });
    addButton.addEventListener('click', () => {
      targetFormState = { locationId: loc.id, id: null };
      renderLocationForm();
      scrollTargetFormIntoView();
    });
    targetsListEl.appendChild(addButton);
    if (targetFormState && targetFormState.locationId === loc.id && targetFormState.id === null) {
      targetsListEl.appendChild(targetFormArea);
    }

    return el('div', { class: 'input-section nested' }, [
      el('h4', { i18n: 'rangeSolverLocations.targetsHeading' }),
      targetsListEl
    ]);
  }

  function scrollTargetFormIntoView() {
    if (targetFormArea.firstChild) targetFormArea.firstChild.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function locationInfoChildren(location) {
    const altitudeLabel = location.altitudeM != null
      ? el('span', { class: 'hint', text: ` — ${formatWithUnit('altitudeM', 'altitude', location.altitudeM)}` })
      : null;
    const modifiedLabel = lastModifiedLabel(location);
    return [
      el('strong', { text: location.name }),
      unsavedBadge(location),
      altitudeLabel,
      el('span', { class: 'hint', text: t('rangeSolverLocations.targetCount', { count: location.targets.length }) }),
      modifiedLabel ? el('div', { class: 'hint' }, [modifiedLabel]) : null
    ];
  }

  // ---- Current location pane ----

  function renderCurrentRealLocation(location) {
    const editButton = el('button', { class: 'secondary', i18n: 'rangeSolverLocations.editButton' });
    editButton.addEventListener('click', () => {
      locationFormState = { id: location.id };
      targetFormState = null;
      renderLocationForm();
      scrollLocationFormIntoView();
    });
    const deleteButton = el('button', { class: 'secondary', i18n: 'rangeSolverLocations.deleteButton' });
    deleteButton.addEventListener('click', () => {
      if (!confirm(t('rangeSolverLocations.confirmDeleteLocation', { name: location.name }))) return;
      deleteUserLocation(location.id);
      if (locationFormState && locationFormState.id === location.id) locationFormState = null;
      // The current location itself was just deleted — fall back to "No
      // location," same as Range Solver's own stale-pointer handling.
      saveRangeSolverLocationState({ locationId: null, targetId: null });
      refreshLibraryView();
      renderLocationForm();
    });
    const saveToFileButton = el('button', { class: 'secondary', i18n: 'rangeSolverLocations.saveToFileButton' });
    saveToFileButton.addEventListener('click', () => exportSingleLocation(location));

    const rowEl = el('div', { class: 'arsenal-row' }, [
      el('div', { class: 'arsenal-row-info' }, locationInfoChildren(location)),
      el('div', { class: 'arsenal-row-actions' }, [saveToFileButton, editButton, deleteButton])
    ]);

    const isEditingThis = locationFormState && locationFormState.id === location.id;
    return el('div', {}, [
      rowEl,
      isEditingThis ? locationFormArea : null,
      renderTargets(location)
    ]);
  }

  function renderCurrentNoLocation() {
    return el('div', {}, [
      el('div', { class: 'arsenal-row' }, [
        el('div', { class: 'arsenal-row-info' }, [el('strong', { i18n: 'rangeSolverLocations.noLocationOption' })])
      ])
    ]);
  }

  // ---- Known locations ----

  function renderKnownRealLocation(location) {
    const saveToFileButton = el('button', { class: 'secondary', i18n: 'rangeSolverLocations.saveToFileButton' });
    saveToFileButton.addEventListener('click', (e) => { e.stopPropagation?.(); exportSingleLocation(location); });
    const deleteButton = el('button', { class: 'secondary', i18n: 'rangeSolverLocations.deleteButton' });
    deleteButton.addEventListener('click', (e) => {
      e.stopPropagation?.();
      if (!confirm(t('rangeSolverLocations.confirmDeleteLocation', { name: location.name }))) return;
      deleteUserLocation(location.id);
      refreshLibraryView();
    });
    const row = el('div', { class: 'arsenal-row row-clickable' }, [
      el('div', { class: 'arsenal-row-info' }, locationInfoChildren(location)),
      el('div', { class: 'arsenal-row-actions' }, [saveToFileButton, deleteButton])
    ]);
    row.addEventListener('click', () => activateLocation(location));
    return row;
  }

  function renderKnownNoLocation() {
    const row = el('div', { class: 'arsenal-row row-clickable' }, [
      el('div', { class: 'arsenal-row-info' }, [el('strong', { i18n: 'rangeSolverLocations.noLocationOption' })])
    ]);
    row.addEventListener('click', () => activateLocation(null));
    return row;
  }

  function renderLocations() {
    clear(locationsListEl);
    const locations = loadUserLocations();
    const activeState = loadRangeSolverLocationState() || {};
    const currentLocation = activeState.locationId ? locations.find((l) => l.id === activeState.locationId) : null;

    const currentSection = el('div', { class: 'locations-current', id: 'locations-current-section' }, [
      el('h3', { i18n: 'rangeSolverLocations.currentLocationHeading' }),
      currentLocation ? renderCurrentRealLocation(currentLocation) : renderCurrentNoLocation()
    ]);
    currentLocationSectionEl = currentSection;

    const knownRows = [];
    if (currentLocation) knownRows.push(renderKnownNoLocation());
    for (const location of locations) {
      if (currentLocation && location.id === currentLocation.id) continue;
      knownRows.push(renderKnownRealLocation(location));
    }
    const knownSection = el('div', { class: 'locations-known' }, [
      el('h3', { i18n: 'rangeSolverLocations.knownLocationsHeading' }),
      ...(knownRows.length ? knownRows : [el('p', { class: 'hint', i18n: 'rangeSolverLocations.noLocations' })])
    ]);

    locationsListEl.appendChild(currentSection);
    locationsListEl.appendChild(knownSection);

    // Hidden while any form is open — editing/adding a location, or
    // adding/editing one of the current location's targets (which, unlike
    // before, can now happen with no location form open at all, since the
    // target list is always shown for the current location) — one open
    // form at a time avoids a confusing second entry point mid-edit.
    if (!locationFormState && !targetFormState) {
      const addButton = el('button', { id: 'location-add', i18n: 'rangeSolverLocations.addLocationButton' });
      addButton.addEventListener('click', () => {
        locationFormState = { id: null };
        targetFormState = null;
        renderLocationForm();
        scrollLocationFormIntoView();
      });
      locationsListEl.appendChild(addButton);
    } else if (locationFormState && locationFormState.id === null) {
      // Adding a brand new location isn't "the current location" —
      // its form stays down by the Add button rather than nesting under
      // the Current-location pane above.
      locationsListEl.appendChild(locationFormArea);
    }
  }

  function renderLocationForm() {
    clear(locationFormArea);
    clear(targetFormArea);
    const editing = locationFormState && locationFormState.id ? loadUserLocations().find((l) => l.id === locationFormState.id) : null;
    // Reset before renderLocations() below (which renders the target list
    // — and with it, the not-placed badges — for the current location) so
    // it always starts from this open's actual persisted photo, not
    // whatever was left over from a previous open/edit.
    locationPhotoPreview = editing ? editing.photo : null;
    // Re-render the list too — a target add/edit/delete changes what's
    // shown under its own row (renderTargets()), and a location
    // save/cancel changes whether the current row shows a form at all.
    renderLocations();

    if (locationFormState) {
      const form = locationForm({
        initialValues: editing || {},
        excludeId: locationFormState.id || undefined,
        onPhotoChange: (newPhoto) => {
          locationPhotoPreview = newPhoto;
          // Not renderLocationForm() — that would rebuild locationForm()
          // itself from the still-persisted data, discarding whatever the
          // user just picked in the very field that triggered this.
          renderLocations();
        },
        onSave: (data) => {
          const previousPhoto = editing ? editing.photo : null;
          const photoChanged = shouldClearTargetCoords(previousPhoto, data.photo);
          const clearCoords = (targets) => (photoChanged ? targets.map((tg) => ({ ...tg, coords: null })) : targets);

          const collision = findUserLocationByName(data.name, { excludeId: locationFormState.id || undefined });
          if (collision) {
            if (locationFormState.id && locationFormState.id !== collision.id) deleteUserLocation(locationFormState.id);
            saveUserLocation({ ...collision, ...data, id: collision.id, targets: clearCoords(collision.targets) });
          } else {
            const id = locationFormState.id || generateUserId('location');
            const baseTargets = editing ? editing.targets : [];
            saveUserLocation({ ...editing, ...data, id, targets: clearCoords(baseTargets) });
          }
          locationFormState = null;
          targetFormState = null;
          refreshLibraryView();
          renderLocationForm();
        },
        onCancel: () => {
          locationFormState = null;
          targetFormState = null;
          renderLocationForm();
        }
      });
      locationFormArea.appendChild(el('div', { class: 'card' }, [
        el('h2', { i18n: locationFormState.id ? 'rangeSolverLocations.editLocationHeading' : 'rangeSolverLocations.addLocationHeading' }),
        form.node
      ]));
    }

    if (targetFormState) {
      const location = loadUserLocations().find((l) => l.id === targetFormState.locationId);
      if (location) {
        const editingTarget = targetFormState.id ? location.targets.find((tg) => tg.id === targetFormState.id) : null;
        const form = targetForm({
          initialValues: editingTarget || {},
          locationId: location.id,
          locationPhoto: location.photo,
          siblingNames: location.targets.filter((tg) => tg.id !== targetFormState.id).map((tg) => tg.name).filter(Boolean),
          onSave: (data) => {
            const id = targetFormState.id || generateUserId('target');
            const targets = targetFormState.id
              ? location.targets.map((tg) => (tg.id === id ? { ...data, id } : tg))
              : [...location.targets, { ...data, id }];
            saveUserLocation({ ...location, targets });
            targetFormState = null;
            refreshLibraryView();
            renderLocationForm();
          },
          onCancel: () => {
            targetFormState = null;
            renderLocationForm();
          }
        });
        targetFormArea.appendChild(el('div', { class: 'card' }, [
          el('h4', { i18n: targetFormState.id ? 'rangeSolverLocations.editTargetHeading' : 'rangeSolverLocations.addTargetHeading' }),
          form.node
        ]));
      }
    }
  }

  function scrollLocationFormIntoView() {
    if (locationFormArea.firstChild) locationFormArea.firstChild.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function renderExportDialog() {
    clear(exportDialogArea);
    if (!exportDialogState) return;
    const dialog = locationExportDialog({
      locations: loadUserLocations(),
      onExport: ({ locationIds }) => {
        const locations = loadUserLocations().filter((l) => locationIds.includes(l.id));
        const payload = buildExportPayload({ locations });
        downloadJsonFile('gb-loc-library.json', serializeExport(payload));
        markUserLocationsSaved(locationIds);
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
      el('h2', { i18n: 'rangeSolverLocations.exportDialogHeading' }),
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
      importSummaryArea.textContent = t('rangeSolverLocations.importSummary', importSummary);
      importSummaryArea.style.display = '';
      importSummary = null;
    }
    if (!importState) return;

    const dialog = locationImportDialog({
      locations: importState.locations,
      existingLocations: loadUserLocations(),
      onImport: ({ locationIds, mode }) => {
        const selected = importState.locations.filter((l) => locationIds.includes(l.id));
        const existingLocations = loadUserLocations();
        const claimedNames = new Set(existingLocations.map((l) => l.name.trim().toLowerCase()));

        let saved = 0, skipped = 0;
        for (const item of selected) {
          const resolved = resolveImportItem(item, {
            existingList: existingLocations, mode, generateId: () => generateUserId('location'),
            nameTaken: (name) => claimedNames.has(name.trim().toLowerCase())
          });
          if (resolved.action === 'save') {
            claimedNames.add(resolved.record.name.trim().toLowerCase());
            importUserLocation(resolved.record);
            saved++;
          } else {
            skipped++;
          }
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
      el('h2', { i18n: 'rangeSolverLocations.importDialogHeading' }),
      dialog.node
    ]));
  }

  const fileInput = el('input', { type: 'file', accept: 'application/json' });
  fileInput.style.display = 'none';
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files && fileInput.files[0];
    fileInput.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      importState = parseImportPayload(text);
      importErrorKey = null;
    } catch (err) {
      importState = null;
      importErrorKey = err.code === 'invalid-json' ? 'rangeSolverLocations.importFileErrorInvalidJson' : 'rangeSolverLocations.importFileErrorInvalidFormat';
    }
    importSummary = null;
    renderImportArea();
  });

  const saveLibraryButton = el('button', { class: 'secondary', id: 'location-save-library', i18n: 'rangeSolverLocations.saveLibraryButton' });
  saveLibraryButton.addEventListener('click', () => {
    importState = null;
    renderImportArea();
    exportDialogState = true;
    renderExportDialog();
  });
  const loadLibraryButton = el('button', { class: 'secondary', id: 'location-load-library', i18n: 'rangeSolverLocations.loadLibraryButton' });
  loadLibraryButton.addEventListener('click', () => {
    exportDialogState = false;
    renderExportDialog();
    fileInput.click();
  });

  container.appendChild(el('div', {}, [
    el('h1', { i18n: 'rangeSolverLocations.title' }),
    el('p', { i18n: 'rangeSolverLocations.intro' }),
    el('div', { class: 'card' }, [
      el('div', { class: 'arsenal-form-actions' }, [saveLibraryButton, loadLibraryButton]),
      fileInput,
      importErrorArea,
      importSummaryArea
    ]),
    exportDialogArea,
    importArea,
    el('div', { class: 'card' }, [
      el('h2', { i18n: 'rangeSolverLocations.locationsHeading' }),
      locationsListEl
    ])
  ]));

  refreshLibraryView();
  renderExportDialog();
  renderImportArea();

  return () => setLocationsMode(false);
}
