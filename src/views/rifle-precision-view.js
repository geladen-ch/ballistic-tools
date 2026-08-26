// Project list for the Rifle Precision Calculator — CRUD list view
// following locations-view.js's own pattern closely: render*() closures
// rebuilding stable DOM slots, autosaved (every change persists
// immediately via saveRiflePrecisionProject, no explicit save button),
// mount(container) returning a cleanup closure. Unlike Locations' flat
// list, a project nests a list of targets, each of which nests a list of
// groups — this view owns projects and targets; groups/shots only ever
// exist inside the full-screen marking view (rifle-precision-marking-view.js).
import { el, clear } from '../dom.js';
import { t } from '../i18n.js';
import {
  loadRiflePrecisionProjects, saveRiflePrecisionProject, deleteRiflePrecisionProject, findRiflePrecisionProjectById,
  findRiflePrecisionProjectByName, markRiflePrecisionProjectsSaved, importRiflePrecisionProject
} from '../rifle-precision-library.js';
import { generateUserId } from '../user-library.js';
import { projectForm } from '../ui/rifle-precision/project-form.js';
import { photoAddFlow } from '../ui/rifle-precision/photo-add-flow.js';
import { riflePrecisionExportDialog } from '../ui/rifle-precision/export-dialog.js';
import { riflePrecisionImportDialog } from '../ui/rifle-precision/import-dialog.js';
import { buildExportPayload, serializeExport, parseImportPayload, resolveImportItem } from '../rifle-precision-export.js';
import { downloadFile } from '../download.js';
import { computeGroupStats, targetUsabilityGaps } from '../engine/rifle-precision-stats.js';
import { UNIT_GROUPS, SMALL_LENGTH_PRECISION_DECIMALS, unitChoice, engineToDisplay } from '../units.js';
import { getUnit } from '../prefs.js';
import { getActiveProjectId, setActiveProjectId, setPendingMarking } from '../rifle-precision-nav.js';

function downloadJsonFile(filename, text) {
  downloadFile(filename, text, 'application/json');
}

// Same cosmetic-only sanitizing as locations-view.js's/arsenal-view.js's
// own sanitizeFilename.
function sanitizeFilename(name) {
  return name.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'project';
}

// Same FIELD_UNITS/getUnit() display convention every other tool in this
// app uses (see locations-view.js's own formatWithUnit()) — `targetRange`
// and `bulletLength` are reused purely for their unit-math (meters and mm
// engine units respectively, both an exact match for how distanceM/
// caliberMm/extremeSpreadMm are actually stored), not because this is
// literally a "target range" or "bullet length" value; see
// project-form.js's own identical reuse and its comment for why.
function formatDistance(distanceM) {
  const displayUnit = getUnit('distance');
  const choice = unitChoice('targetRange', displayUnit) || UNIT_GROUPS.distance.choices.find((c) => c.unit === UNIT_GROUPS.distance.defaultUnit);
  return `${engineToDisplay('targetRange', distanceM, choice.unit).toFixed(choice.decimals)} ${choice.label}`;
}
// Finer precision than the smallLength group's own coarse default decimals
// (mm:0) — same SMALL_LENGTH_PRECISION_DECIMALS reasoning as project-form.js's
// own caliber field: a caliber or an extreme-spread reading in whole
// millimeters loses exactly the resolution a shooter cares about here.
function formatLengthMm(valueMm) {
  const displayUnit = getUnit('smallLength');
  const choice = unitChoice('bulletLength', displayUnit) || UNIT_GROUPS.smallLength.choices.find((c) => c.unit === UNIT_GROUPS.smallLength.defaultUnit);
  const decimals = SMALL_LENGTH_PRECISION_DECIMALS[choice.unit] ?? choice.decimals;
  return `${engineToDisplay('bulletLength', valueMm, choice.unit).toFixed(decimals)} ${choice.label}`;
}

export function mount(container) {
  clear(container);

  // { id: null } while adding a brand new project, { id: <string> } while
  // editing an existing one, null = no form open — same convention as
  // locations-view.js's own locationFormState.
  let projectFormState = null;
  // Target rename/notes editing only ever applies to one specific target
  // of the currently-open project at a time.
  let targetFormState = null; // { targetId } | null
  // Whether the "Add target" photo flow is currently open for the
  // currently-open project — reset whenever a different project opens.
  let addTargetOpen = false;

  // Whole-library export/import state — same shape as locations-view.js's
  // own exportDialogState/importState/importErrorKey/importSummary.
  let exportDialogState = false;
  let importState = null; // { projects } once a picked file's been parsed
  let importErrorKey = null;
  let importSummary = null;

  const projectsListEl = el('div');
  // Stable, reused nodes (never recreated — only cleared/refilled), same
  // "re-parented into whichever spot the open form belongs" convention as
  // locations-view.js's own locationFormArea/targetFormArea.
  const projectFormArea = el('div');
  const targetFormArea = el('div');
  const addTargetArea = el('div');
  const exportDialogArea = el('div');
  const importArea = el('div');
  const importErrorArea = el('p', { class: 'hint warning' });
  importErrorArea.style.display = 'none';
  const importSummaryArea = el('p', { class: 'hint' });
  importSummaryArea.style.display = 'none';

  function refresh() {
    renderProjects();
  }

  function unsavedBadge(proj) {
    if (!proj.unsaved) return null;
    return el('span', { class: 'unsaved-badge', title: t('arsenal.unsavedBadgeTitle'), text: t('arsenal.unsavedBadge') });
  }

  function exportSingleProject(proj) {
    const payload = buildExportPayload({ projects: [proj] });
    downloadJsonFile(`gb-prec-${sanitizeFilename(proj.name)}.json`, serializeExport(payload));
    markRiflePrecisionProjectsSaved([proj.id]);
    refresh();
  }

  function renderExportDialog() {
    clear(exportDialogArea);
    if (!exportDialogState) return;
    const dialog = riflePrecisionExportDialog({
      projects: loadRiflePrecisionProjects(),
      onExport: ({ projectIds }) => {
        const projects = loadRiflePrecisionProjects().filter((p) => projectIds.includes(p.id));
        const payload = buildExportPayload({ projects });
        downloadJsonFile('gb-prec-library.json', serializeExport(payload));
        markRiflePrecisionProjectsSaved(projectIds);
        exportDialogState = false;
        renderExportDialog();
        refresh();
      },
      onCancel: () => {
        exportDialogState = false;
        renderExportDialog();
      }
    });
    exportDialogArea.appendChild(el('div', { class: 'card' }, [
      el('h2', { i18n: 'riflePrecision.exportDialogHeading' }),
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
      importSummaryArea.textContent = t('riflePrecision.importSummary', importSummary);
      importSummaryArea.style.display = '';
      importSummary = null;
    }
    if (!importState) return;

    const dialog = riflePrecisionImportDialog({
      projects: importState.projects,
      existingProjects: loadRiflePrecisionProjects(),
      onImport: ({ projectIds, mode }) => {
        const selected = importState.projects.filter((p) => projectIds.includes(p.id));
        const existingProjects = loadRiflePrecisionProjects();
        const claimedNames = new Set(existingProjects.map((p) => p.name.trim().toLowerCase()));

        let saved = 0, skipped = 0;
        for (const item of selected) {
          const resolved = resolveImportItem(item, {
            existingList: existingProjects, mode, generateId: () => generateUserId('rp-project'),
            nameTaken: (name) => claimedNames.has(name.trim().toLowerCase())
          });
          if (resolved.action === 'save') {
            claimedNames.add(resolved.record.name.trim().toLowerCase());
            importRiflePrecisionProject(resolved.record);
            saved++;
          } else {
            skipped++;
          }
        }

        importState = null;
        importSummary = { saved, skipped };
        renderImportArea();
        refresh();
      },
      onCancel: () => {
        importState = null;
        renderImportArea();
      }
    });
    importArea.appendChild(el('div', { class: 'card' }, [
      el('h2', { i18n: 'riflePrecision.importDialogHeading' }),
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
      importErrorKey = err.code === 'invalid-json' ? 'riflePrecision.importFileErrorInvalidJson' : 'riflePrecision.importFileErrorInvalidFormat';
    }
    importSummary = null;
    renderImportArea();
  });

  const saveLibraryButton = el('button', { class: 'secondary', id: 'rifle-precision-save-library', i18n: 'riflePrecision.saveLibraryButton' });
  saveLibraryButton.addEventListener('click', () => {
    importState = null;
    renderImportArea();
    exportDialogState = true;
    renderExportDialog();
  });
  const loadLibraryButton = el('button', { class: 'secondary', id: 'rifle-precision-load-library', i18n: 'riflePrecision.loadLibraryButton' });
  loadLibraryButton.addEventListener('click', () => {
    exportDialogState = false;
    renderExportDialog();
    fileInput.click();
  });

  function lastModifiedLabel(project) {
    if (!project.modifiedAt) return null;
    const date = new Date(project.modifiedAt);
    if (Number.isNaN(date.getTime())) return null;
    return t('arsenal.lastModified', { date: date.toISOString().slice(0, 16).replace('T', ' ') });
  }

  // ---- targets ----

  function groupSummaryLine(group, target, index) {
    const label = t('riflePrecision.groupLabel', { n: index + 1 });
    const shots = t('riflePrecision.shotCount', { count: group.shots.length });
    const stats = computeGroupStats(group, target);
    return stats ? `${label}: ${shots} — ${t('riflePrecision.esLabel')} ${formatLengthMm(stats.extremeSpreadMm)}` : `${label}: ${shots}`;
  }

  // Same badge shape/color as arsenal-view.js's own unusableBadge() (a
  // rifle with no cartridges) — reuses the shared .unusable-badge class
  // rather than a rifle-precision-specific copy.
  function targetUnusableBadge(target) {
    if (targetUsabilityGaps(target).length === 0) return null;
    return el('span', { class: 'unusable-badge', title: t('riflePrecision.unusableBadgeTitle'), text: t('riflePrecision.unusableBadge') });
  }

  const MISSING_REQUIREMENT_KEYS = {
    calibration: 'riflePrecision.missingCalibrationLabel',
    poa: 'riflePrecision.missingPoaLabel',
    impact: 'riflePrecision.missingImpactLabel'
  };

  // The badge alone (a tooltip-only label, like Arsenal's) doesn't say
  // *what* to fix — this is the visible, always-red hint spelling out
  // exactly which of the three requirements this particular target is
  // still missing, reusing the same .hint.warning class every other
  // danger-colored inline message in this app already uses.
  function targetUnusableHint(target) {
    const gaps = targetUsabilityGaps(target);
    if (gaps.length === 0) return null;
    const items = gaps.map((gap) => t(MISSING_REQUIREMENT_KEYS[gap])).join(', ');
    return el('div', { class: 'hint warning', text: t('riflePrecision.targetUnusableHint', { items }) });
  }

  function renderTargetRow(proj, target, index) {
    const displayName = target.name || t('riflePrecision.defaultTargetName', { n: index + 1 });

    const thumb = target.photo ? el('img', { class: 'rp-target-thumb', src: target.photo, alt: '' }) : null;

    const groupLines = target.groups.length
      ? target.groups.map((g, i) => el('div', { class: 'hint', text: groupSummaryLine(g, target, i) }))
      : [el('p', { class: 'hint', i18n: 'riflePrecision.noGroups' })];

    const markButton = el('button', { class: 'secondary', i18n: 'riflePrecision.continueMarkingButton' });
    markButton.addEventListener('click', () => {
      setPendingMarking({ projectId: proj.id, targetId: target.id });
      location.hash = '#/rifle-precision/target';
    });
    const editButton = el('button', { class: 'secondary', i18n: 'riflePrecision.editButton' });
    // Hidden (not removed) — the edit form itself, targetFormState/
    // targetFormArea, and the name/notes metadata it edits are all still
    // fully wired up below; only this row's own trigger button is hidden
    // from the UI.
    editButton.style.display = 'none';
    editButton.addEventListener('click', () => {
      targetFormState = { targetId: target.id };
      // Not renderTargetForm() alone — the stable targetFormArea slot is
      // only actually appended into this target's own row by
      // renderProjects() (see renderTargetRow() above), which has to run
      // first with the new state before there's anywhere for the form's
      // content to land (same two-step "rebuild the slot, then fill it"
      // sequencing locations-view.js's own renderLocationForm() follows).
      renderProjects();
    });
    const deleteButton = el('button', { class: 'secondary', i18n: 'riflePrecision.deleteButton' });
    deleteButton.addEventListener('click', () => {
      if (!confirm(t('riflePrecision.confirmDeleteTarget', { name: displayName }))) return;
      const fresh = findRiflePrecisionProjectById(proj.id);
      saveRiflePrecisionProject({ ...fresh, targets: fresh.targets.filter((tg) => tg.id !== target.id) });
      if (targetFormState && targetFormState.targetId === target.id) targetFormState = null;
      refresh();
    });

    const row = el('div', { class: 'arsenal-row' }, [
      el('div', { class: 'rp-target-row-body' }, [
        thumb,
        el('div', { class: 'arsenal-row-info' }, [
          el('strong', { text: displayName }),
          targetUnusableBadge(target),
          targetUnusableHint(target),
          target.photoFilename ? el('div', { class: 'hint', text: target.photoFilename }) : null,
          target.notes ? el('div', { class: 'hint', text: target.notes }) : null,
          ...groupLines
        ])
      ]),
      el('div', { class: 'arsenal-row-actions' }, [markButton, editButton, deleteButton])
    ]);

    const wrapper = el('div', {}, [row]);
    if (targetFormState && targetFormState.targetId === target.id) wrapper.appendChild(targetFormArea);
    return wrapper;
  }

  function renderTargets(proj) {
    const listEl = el('div');
    proj.targets.forEach((target, index) => listEl.appendChild(renderTargetRow(proj, target, index)));
    if (proj.targets.length === 0) listEl.appendChild(el('p', { class: 'hint', i18n: 'riflePrecision.noTargets' }));

    const addButton = el('button', { class: 'secondary', i18n: 'riflePrecision.addTargetButton' });
    addButton.addEventListener('click', () => {
      addTargetOpen = true;
      // Same reasoning as the target-edit button above — renderProjects()
      // has to rebuild this section first (so the addTargetArea slot is
      // actually present below the target list) before its own trailing
      // renderAddTargetArea() call has anywhere to put the flow's content.
      renderProjects();
    });

    return el('div', { class: 'input-section nested' }, [
      el('h4', { i18n: 'riflePrecision.targetsHeading' }),
      listEl,
      addTargetOpen ? addTargetArea : null,
      el('div', { class: 'arsenal-form-actions' }, [addButton])
    ]);
  }

  function renderAddTargetArea(proj) {
    clear(addTargetArea);
    if (!addTargetOpen) return;
    const flow = photoAddFlow({
      onConfirm: ({ photo, photoWidth, photoHeight, photoFilename }) => {
        const fresh = findRiflePrecisionProjectById(proj.id);
        const newTarget = {
          id: generateUserId('rp-target'),
          name: null,
          notes: null,
          photo,
          photoWidth,
          photoHeight,
          photoFilename: photoFilename || null,
          calibration: { point1: null, point2: null, realLengthMm: null },
          groups: []
        };
        saveRiflePrecisionProject({ ...fresh, targets: [...fresh.targets, newTarget] });
        addTargetOpen = false;
        setPendingMarking({ projectId: proj.id, targetId: newTarget.id });
        location.hash = '#/rifle-precision/target';
      },
      onCancel: () => {
        addTargetOpen = false;
        renderProjects();
      }
    });
    addTargetArea.appendChild(el('div', { class: 'card' }, [
      el('h4', { i18n: 'riflePrecision.addTargetHeading' }),
      flow.node
    ]));
  }

  function renderTargetForm() {
    clear(targetFormArea);
    if (!targetFormState) return;
    const proj = findRiflePrecisionProjectById(getActiveProjectId());
    const target = proj && proj.targets.find((tg) => tg.id === targetFormState.targetId);
    if (!proj || !target) return;

    const nameInput = el('input', { type: 'text', id: 'riflePrecisionTargetName', value: target.name || '' });
    const notesInput = el('textarea', { id: 'riflePrecisionTargetNotes', rows: 3 });
    notesInput.value = target.notes || '';

    const saveButton = el('button', { i18n: 'riflePrecision.saveTargetButton' });
    saveButton.addEventListener('click', () => {
      const fresh = findRiflePrecisionProjectById(proj.id);
      const targets = fresh.targets.map((tg) => (tg.id === target.id
        ? { ...tg, name: nameInput.value.trim() || null, notes: notesInput.value.trim() || null }
        : tg));
      saveRiflePrecisionProject({ ...fresh, targets });
      targetFormState = null;
      refresh();
    });
    const cancelButton = el('button', { class: 'secondary', i18n: 'riflePrecision.cancelButton' });
    cancelButton.addEventListener('click', () => {
      targetFormState = null;
      renderProjects();
    });

    targetFormArea.appendChild(el('div', { class: 'card' }, [
      el('h4', { i18n: 'riflePrecision.editTargetHeading' }),
      el('div', { class: 'field' }, [el('label', { i18n: 'riflePrecision.targetNameLabel' }), nameInput]),
      el('div', { class: 'field' }, [el('label', { i18n: 'riflePrecision.targetNotesLabel' }), notesInput]),
      el('div', { class: 'arsenal-form-actions' }, [saveButton, cancelButton])
    ]));
  }

  // ---- projects ----

  function projectInfoChildren(proj) {
    const modifiedLabel = lastModifiedLabel(proj);
    return [
      el('strong', { text: proj.name }),
      unsavedBadge(proj),
      el('span', { class: 'hint', text: ` — ${formatDistance(proj.distanceM)}, ${formatLengthMm(proj.caliberMm)}` }),
      el('span', { class: 'hint', text: t('riflePrecision.targetCount', { count: proj.targets.length }) }),
      projectUsabilityHint(proj),
      modifiedLabel ? el('div', { class: 'hint' }, [modifiedLabel]) : null
    ];
  }

  // A project is "usable" for reporting purposes the same way a target
  // is usable (see targetUsabilityGaps() above) — at least one target
  // with complete calibration, POA, and an impact.
  function projectHasUsableTargets(proj) {
    return proj.targets.some((target) => targetUsabilityGaps(target).length === 0);
  }

  // Row-level rollup of the same per-target usability check, shown on
  // both the active and inactive rows (unlike Edit/Delete/View report,
  // which are active-only) — inactive rows have no target list of their
  // own, so this is the only place a problem there would otherwise show.
  // Two severities: some usable targets remain (amber/.hint.caution, "View
  // report" still works) vs. none do — no targets at all, or targets but
  // none usable (red/.hint.warning, same color as a target's own unusable
  // hint — and the reason "View report" is hidden; see
  // projectHasUsableTargets()).
  function projectUsabilityHint(proj) {
    if (!projectHasUsableTargets(proj)) {
      return el('div', { class: 'hint warning', i18n: 'riflePrecision.noUsableTargetsHint' });
    }
    const hasUnusableTarget = proj.targets.some((target) => targetUsabilityGaps(target).length > 0);
    return hasUnusableTarget ? el('div', { class: 'hint caution', i18n: 'riflePrecision.unusableTargetsPresentHint' }) : null;
  }

  // The inactive/summary row — clicking it activates this project (see
  // activateProject()). No action buttons, no target list: same "Known
  // locations"/"Other rifles" convention as locations-view.js and
  // arsenal-view.js, just within a single reordered list rather than a
  // separately-headed section (see renderProjects()'s own comment).
  function renderInactiveProjectRow(proj) {
    const row = el('div', { class: 'arsenal-row row-clickable' }, [
      el('div', { class: 'arsenal-row-info' }, projectInfoChildren(proj))
    ]);
    row.addEventListener('click', () => activateProject(proj.id));
    return row;
  }

  // The active project's own row — Edit/Delete, "View report" (only once
  // it has at least one usable target), and its full target list. Not
  // clickable itself (it's already active) — same as arsenal-view.js's
  // own "Active rifle" row.
  function renderActiveProjectRow(proj) {
    const saveToFileButton = el('button', { class: 'secondary', i18n: 'riflePrecision.saveToFileButton' });
    saveToFileButton.addEventListener('click', () => exportSingleProject(proj));
    const editButton = el('button', { class: 'secondary', i18n: 'riflePrecision.editButton' });
    editButton.addEventListener('click', () => {
      projectFormState = { id: proj.id };
      targetFormState = null;
      addTargetOpen = false;
      renderProjectForm();
      scrollProjectFormIntoView();
    });
    const deleteButton = el('button', { class: 'secondary', i18n: 'riflePrecision.deleteButton' });
    deleteButton.addEventListener('click', () => {
      if (!confirm(t('riflePrecision.confirmDeleteProject', { name: proj.name }))) return;
      deleteRiflePrecisionProject(proj.id);
      if (projectFormState && projectFormState.id === proj.id) projectFormState = null;
      setActiveProjectId(null);
      refresh();
    });

    const actions = [saveToFileButton];
    if (projectHasUsableTargets(proj)) {
      const viewReportButton = el('button', { class: 'secondary', i18n: 'riflePrecision.viewReportButton' });
      viewReportButton.addEventListener('click', () => {
        location.hash = '#/rifle-precision/analysis';
      });
      actions.push(viewReportButton);
    }
    actions.push(editButton, deleteButton);

    const row = el('div', { class: 'arsenal-row' }, [
      el('div', { class: 'arsenal-row-info' }, projectInfoChildren(proj)),
      el('div', { class: 'arsenal-row-actions' }, actions)
    ]);

    const isEditingThis = projectFormState && projectFormState.id === proj.id;
    const children = [row];
    if (isEditingThis) children.push(projectFormArea);
    children.push(renderTargets(proj));
    return el('div', {}, children);
  }

  // Makes `proj` the active project — a purely page-local action (no
  // navigation), same spirit as locations-view.js's own activateLocation()/
  // arsenal-view.js's own activateRifle(). Always activates (no toggle
  // off by clicking again) — matching those two views, where switching
  // away from a current/active entry only ever happens by activating a
  // different one or deleting it.
  function activateProject(id) {
    setActiveProjectId(id);
    projectFormState = null;
    targetFormState = null;
    addTargetOpen = false;
    refresh();
    scrollActiveProjectIntoView();
  }

  function scrollActiveProjectIntoView() {
    if (activeProjectRowEl) activeProjectRowEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // Set by renderProjects() below, on every render — the active project's
  // own outer node, so scrollActiveProjectIntoView() always has something
  // current to scroll to.
  let activeProjectRowEl = null;

  function renderProjects() {
    clear(projectsListEl);
    const projects = loadRiflePrecisionProjects();
    const activeId = getActiveProjectId();
    const activeProject = activeId ? projects.find((p) => p.id === activeId) : null;
    // Inactive projects, latest-modified first — the active project (if
    // any) is rendered separately, first, ahead of this sorted rest, so it
    // reads as "brought to the top of the list" rather than a distinct
    // section (see renderActiveProjectRow()/renderInactiveProjectRow()).
    const inactiveProjects = projects
      .filter((p) => p.id !== activeId)
      .sort((a, b) => new Date(b.modifiedAt || 0) - new Date(a.modifiedAt || 0));

    activeProjectRowEl = null;
    if (activeProject) {
      activeProjectRowEl = renderActiveProjectRow(activeProject);
      projectsListEl.appendChild(activeProjectRowEl);
    }
    for (const proj of inactiveProjects) projectsListEl.appendChild(renderInactiveProjectRow(proj));
    if (projects.length === 0) projectsListEl.appendChild(el('p', { class: 'hint', i18n: 'riflePrecision.noProjects' }));

    // Hidden while any form is open — same "one open form at a time" rule
    // locations-view.js's own renderLocations() follows.
    if (!projectFormState && !targetFormState) {
      const addButton = el('button', { id: 'rifle-precision-add-project', i18n: 'riflePrecision.addProjectButton' });
      addButton.addEventListener('click', () => {
        projectFormState = { id: null };
        targetFormState = null;
        addTargetOpen = false;
        renderProjectForm();
        scrollProjectFormIntoView();
      });
      projectsListEl.appendChild(addButton);
    } else if (projectFormState && projectFormState.id === null) {
      projectsListEl.appendChild(projectFormArea);
    }

    renderAddTargetArea(activeProject);
    renderTargetForm();
  }

  function renderProjectForm() {
    clear(projectFormArea);
    const editing = projectFormState && projectFormState.id ? findRiflePrecisionProjectById(projectFormState.id) : null;
    renderProjects();

    if (!projectFormState) return;
    const form = projectForm({
      initialValues: editing || {},
      excludeId: projectFormState.id || undefined,
      onSave: (data) => {
        // A name collision merges into the existing entry instead of
        // creating a duplicate — same convention as locations-view.js's/
        // arsenal-view.js's own onSave handlers. Editing is only ever
        // reachable from the active row (see renderActiveProjectRow's own
        // Edit button), so projectFormState.id, when set, is always the
        // currently active project's id — if it merges into a different
        // one, the active id must follow it, or the active row would end
        // up pointing at a project that was just deleted.
        const collision = findRiflePrecisionProjectByName(data.name, { excludeId: projectFormState.id || undefined });
        if (collision) {
          if (projectFormState.id && projectFormState.id !== collision.id) deleteRiflePrecisionProject(projectFormState.id);
          saveRiflePrecisionProject({ ...collision, ...data, id: collision.id });
          setActiveProjectId(collision.id);
        } else if (projectFormState.id) {
          const fresh = findRiflePrecisionProjectById(projectFormState.id);
          saveRiflePrecisionProject({ ...fresh, ...data });
        } else {
          const id = generateUserId('rp-project');
          saveRiflePrecisionProject({
            id, ...data, targets: [], createdAt: new Date().toISOString()
          });
          setActiveProjectId(id);
        }
        projectFormState = null;
        refresh();
      },
      onCancel: () => {
        projectFormState = null;
        renderProjectForm();
      }
    });
    projectFormArea.appendChild(el('div', { class: 'card' }, [
      el('h2', { i18n: projectFormState.id ? 'riflePrecision.editProjectHeading' : 'riflePrecision.addProjectHeading' }),
      form.node
    ]));
  }

  function scrollProjectFormIntoView() {
    if (projectFormArea.firstChild) projectFormArea.firstChild.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  container.appendChild(el('div', {}, [
    el('h1', { i18n: 'riflePrecision.title' }),
    el('p', { i18n: 'riflePrecision.intro' }),
    el('div', { class: 'card' }, [
      el('div', { class: 'arsenal-form-actions' }, [saveLibraryButton, loadLibraryButton]),
      fileInput,
      importErrorArea,
      importSummaryArea
    ]),
    exportDialogArea,
    importArea,
    el('div', { class: 'card' }, [
      el('h2', { i18n: 'riflePrecision.projectsHeading' }),
      projectsListEl
    ])
  ]));

  refresh();
  renderExportDialog();
  renderImportArea();

  return () => {};
}
