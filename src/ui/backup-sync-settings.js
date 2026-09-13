// Settings UI for the "Backup & Sync" feature — see
// docs/plans/backup-sync.md Phase 6. One section, always in the same
// place; what renders inside it differs by capability (Chromium folder
// sync vs. Phase 8a's plain download/upload), not by separate screens.
import { el, clear } from '../dom.js';
import { i18nSpan, applyI18nText, t } from '../i18n.js';
import { sectionGroup } from './section.js';
import { showDialog } from './app-dialog.js';
import { copyButton } from './copy-button.js';
import { downloadFile } from '../download.js';
import { isBackupSyncEnabled, setBackupSyncEnabled } from '../backup-sync-prefs.js';
import { getDeviceName, setDeviceName, hasCustomDeviceName } from '../sync/device-name.js';
import { isFileSystemAccessSupported, pickFolder, getPersistedFolderHandle } from '../sync/fs-folder.js';
import { getSyncMode, setSyncMode, runSyncCycle, unregisterAutomaticTriggers } from '../sync/auto-sync.js';
import {
  getLastSyncedAt, getLastSyncedDevices, getPendingPhotoDevices, getClockSkewedDevices
} from '../sync/last-sync-status.js';
import { isIOS, syncViaPickedFiles } from '../sync/manual-sync.js';
import {
  listPendingReviews, getPendingReviewCount, markPendingReviewResolved, reopenPendingReview
} from '../sync/pending-review.js';
import { isVerboseSyncLoggingEnabled, setVerboseSyncLoggingEnabled, getSyncLog } from '../sync/sync-log.js';
import { isIphoneSyncSupportEnabled, setIphoneSyncSupportEnabled } from '../sync/photo-storage-prefs.js';
import { getDeviceLabel } from '../sync/device-registry.js';
import { SYNCED_LIBRARIES } from '../sync/synced-libraries.js';
import { loadUserBullets, loadUserRifles } from '../user-library.js';
import { loadUserLocations } from '../location-library.js';
import { loadRiflePrecisionProjects } from '../rifle-precision-library.js';
import { buildExportPayload as buildArsenalPayload, serializeExport as serializeArsenal } from '../arsenal-export.js';
import { buildExportPayload as buildLocationsPayload, serializeExport as serializeLocations } from '../location-export.js';
import { buildExportPayload as buildRpPayload, serializeExport as serializeRp } from '../rifle-precision-export.js';

function dateStamp() {
  return new Date().toISOString().slice(0, 10);
}

function libraryFor(recordType) {
  return SYNCED_LIBRARIES.find((l) => l.recordType === recordType);
}

// "When did this side last actually change" — the same axis merge.js's
// own lastChanged() compares on, duplicated here rather than imported
// since this is display-only and doesn't need to match merge.js's
// resolution semantics exactly.
function lastChangedOf(record) {
  return record && (record.deletedAt || record.modifiedAt);
}

function formatWhen(iso) {
  const ms = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(ms) ? new Date(ms).toLocaleString() : t('settings.backupSync.review.unknownTimestamp');
}

// One line per side: "Yours: edited <when>" / "Theirs: deleted <when>" —
// the plan's own spec for this dialog ("the record's name, ... the two
// timestamps") which the first cut of this UI dropped, and which is
// exactly the piece of information needed to tell a real conflict apart
// from — say — a tombstone on one side with an unreadable timestamp on
// the other (an 'unresolvable-timestamp' conflict looks identical to a
// genuine content conflict without this).
function sideLine(sideKey, record) {
  const side = t(`settings.backupSync.review.${sideKey}`);
  const when = formatWhen(lastChangedOf(record));
  return record && record.deletedAt
    ? t('settings.backupSync.review.sideDeleted', { side, when })
    : t('settings.backupSync.review.sideEdited', { side, when });
}

const REASON_KEYS = {
  'unresolvable-timestamp': 'settings.backupSync.review.reasonUnresolvableTimestamp',
  'same-timestamp-diverged-content': 'settings.backupSync.review.reasonDiverged'
};

const RESOLVED_LABEL_KEYS = {
  'keep-mine': 'settings.backupSync.review.resolvedKeepMine',
  'take-theirs': 'settings.backupSync.review.resolvedTakeTheirs'
};

// One row's choice area: starts in the "undecided" state (Keep
// mine/Take theirs) and flips to a "resolved" state (a status chip
// naming which side won, plus Cancel) the moment either is picked —
// toggled in place, in this same dialog, rather than the row silently
// going stale until the whole dialog is reopened. `originalLocal` is
// snapshotted once, before any choice is made, specifically so Cancel
// can restore it verbatim.
function buildChoiceArea(item, lib, originalLocal, onResolved) {
  const area = el('div');

  function renderUndecided() {
    clear(area);
    const keepMineButton = el('button', { class: 'secondary', i18n: 'settings.backupSync.review.keepMineButton' });
    const takeTheirsButton = el('button', { class: 'secondary', i18n: 'settings.backupSync.review.takeTheirsButton' });

    // Both choices write through the normal save path, which fires the
    // library-write hook and so retires the outstanding entry on its own.
    // markPendingReviewResolved() then runs *after* that write, recording
    // which competing version was decided about — without it, a conflict
    // whose reason is 'unresolvable-timestamp' would come straight back on
    // the next cycle, since resolving restamps only the local side while
    // the peer's record stays just as un-timestamped as before.
    keepMineButton.addEventListener('click', () => {
      if (originalLocal) lib.save(originalLocal);
      markPendingReviewResolved(item.recordType, item.recordId, item.remoteVersion);
      onResolved();
      renderResolved('keep-mine');
    });
    takeTheirsButton.addEventListener('click', () => {
      lib.save(item.remoteVersion);
      markPendingReviewResolved(item.recordType, item.recordId, item.remoteVersion);
      onResolved();
      renderResolved('take-theirs');
    });
    area.appendChild(el('div', { class: 'app-dialog-button-row' }, [keepMineButton, takeTheirsButton]));
  }

  function renderResolved(choice) {
    clear(area);
    const badge = el('span', { class: 'status-chip status-chip-resolved', text: t(RESOLVED_LABEL_KEYS[choice]) });
    const cancelButton = el('button', { class: 'secondary', i18n: 'settings.backupSync.review.cancelButton' });

    // A true undo, not just a UI reset: `lib.write` (== the SYNCED_LIBRARIES
    // `write` field) preserves a record's fields exactly as given — same
    // primitive Phase 5's own merge-apply uses — so this restores
    // `originalLocal` byte-for-byte, including the modifiedAt/modifiedBy/
    // revision either choice above had just overwritten. reopenPendingReview
    // (rather than addPendingReview) is what actually brings the conflict
    // back as outstanding — addPendingReview's own suppression logic would
    // otherwise treat this identical remoteVersion, arriving right after
    // markPendingReviewResolved's own marker, as "nothing new" and refuse.
    cancelButton.addEventListener('click', () => {
      if (originalLocal) lib.write(originalLocal);
      reopenPendingReview(item.recordType, item.recordId, {
        reason: item.reason, peerDeviceId: item.peerDeviceId, remoteVersion: item.remoteVersion
      });
      onResolved();
      renderUndecided();
    });
    area.appendChild(el('div', { class: 'app-dialog-button-row' }, [badge, cancelButton]));
  }

  renderUndecided();
  return area;
}

// Renders the pending-review list into a dialog — one entry per
// unresolved conflict, each with "Keep mine"/"Take theirs". Both choices
// resolve through the normal save path (a fresh modifiedAt/modifiedBy for
// this device), per docs/plans/backup-sync.md Phase 4's "Resolving a
// conflict is not a new merge path".
function openReviewDialog(onResolved) {
  const items = listPendingReviews();
  const rows = items.map((item) => {
    const lib = libraryFor(item.recordType);
    const peerLabel = getDeviceLabel(item.peerDeviceId) || item.peerDeviceId;
    const originalLocal = lib.loadLocalWithTombstones().find((r) => r.id === item.recordId);
    const name = (item.remoteVersion && item.remoteVersion.name) || (originalLocal && originalLocal.name) || item.recordId;

    return el('div', { class: 'field' }, [
      el('p', {}, [
        el('strong', { text: name }),
        el('br'),
        el('span', { class: 'hint', text: t('settings.backupSync.review.fromPeer', { peer: peerLabel }) }),
        el('br'),
        el('span', { class: 'hint', text: sideLine('yours', originalLocal) }),
        el('br'),
        el('span', { class: 'hint', text: sideLine('theirs', item.remoteVersion) }),
        el('br'),
        el('span', { class: 'hint', text: t(REASON_KEYS[item.reason] || REASON_KEYS['unresolvable-timestamp']) })
      ]),
      buildChoiceArea(item, lib, originalLocal, onResolved)
    ]);
  });

  showDialog({
    bodyNode: el('div', {}, rows.length
      ? rows
      : [el('p', { i18n: 'settings.backupSync.review.emptyHint' })]),
    buttons: [{ label: t('settings.backupSync.closeButton') }],
    wide: true
  });
}

// `onSyncApplied` (optional; settings-view.js's own changeHistorySection()
// refresh) fires after anything here could have added a change-history
// entry — a folder-sync cycle, a manual picked-files import, or a
// conflict resolved/cancelled in the review dialog — so that section
// (built in the very same settings page, but with no other way to learn
// a write happened here) shows the new entries immediately rather than
// only after the whole page is next remounted.
export function backupSyncSection(onSyncApplied = () => {}) {
  const container = el('div');
  render();

  function render() {
    clear(container);
    container.appendChild(isBackupSyncEnabled() ? buildEnabled() : buildCollapsed());
  }

  function buildCollapsed() {
    const checkbox = el('input', { type: 'checkbox', id: 'settings-backup-sync-enabled' });
    checkbox.checked = false;
    checkbox.addEventListener('change', () => {
      if (!checkbox.checked) return;
      checkbox.checked = false; // stays unchecked until the confirmation actually completes
      openEnableConfirmation();
    });
    return el('div', {}, [
      el('p', { class: 'hint warning', i18n: 'settings.backupSync.experimentalWarning' }),
      el('label', { class: 'checkbox-field' }, [checkbox, i18nSpan('settings.backupSync.enableLabel')])
    ]);
  }

  function openEnableConfirmation() {
    function exportButton(labelKey, buildPayload, serialize, filenamePrefix) {
      const button = el('button', { class: 'secondary', i18n: labelKey });
      button.addEventListener('click', () => {
        downloadFile(`${filenamePrefix}-${dateStamp()}.json`, serialize(buildPayload()), 'application/json');
      });
      return button;
    }

    const body = el('div', {}, [
      el('p', { i18n: 'settings.backupSync.confirmIntro' }),
      el('div', { class: 'app-dialog-button-row' }, [
        exportButton('settings.backupSync.exportArsenalButton',
          () => buildArsenalPayload({ bullets: loadUserBullets(), rifles: loadUserRifles() }), serializeArsenal, 'arsenal-backup'),
        exportButton('settings.backupSync.exportLocationsButton',
          () => buildLocationsPayload({ locations: loadUserLocations() }), serializeLocations, 'locations-backup'),
        exportButton('settings.backupSync.exportRiflePrecisionButton',
          () => buildRpPayload({ projects: loadRiflePrecisionProjects() }), serializeRp, 'rifle-precision-backup')
      ])
    ]);

    showDialog({
      bodyNode: body,
      buttons: [
        {
          label: t('settings.backupSync.confirmContinueButton'),
          onClick: () => {
            setBackupSyncEnabled(true);
            // Force manual every time the feature is (re-)enabled, not just
            // on its very first enable. `ballistics_sync_mode_v1` is a
            // separate, persisted preference that survives the master
            // toggle being switched off — see auto-sync.js's own note on
            // why initSyncTriggers() checks the toggle itself rather than
            // trusting this alone. Without resetting it here, a user who
            // had automatic mode on, disabled the feature (maybe because
            // they're switching to a different sync folder, or moving the
            // old one), and re-enables later would have automatic syncing
            // resume immediately and silently — against whatever folder
            // handle happens to still be persisted, stale or not, with no
            // fresh confirmation. Manual is the safe, explicit floor to
            // land on every time; the user opts back into automatic
            // deliberately, the same way they did the first time (Phase 5's
            // own "manual is the default deliberately" reasoning applies
            // just as much to a re-enable as to a first enable).
            setSyncMode('manual');
            render();
          }
        },
        { label: t('settings.backupSync.cancelButton') }
      ]
    });
  }

  function buildEnabled() {
    const masterCheckbox = el('input', { type: 'checkbox', id: 'settings-backup-sync-enabled' });
    masterCheckbox.checked = true;
    masterCheckbox.addEventListener('change', () => {
      if (masterCheckbox.checked) return;
      setBackupSyncEnabled(false);
      unregisterAutomaticTriggers();
      render();
    });

    const nameInput = el('input', { type: 'text', id: 'settings-backup-sync-device-name' });
    nameInput.value = getDeviceName();
    nameInput.addEventListener('change', () => {
      const value = nameInput.value.trim();
      if (value) setDeviceName(value);
    });
    const nameField = el('div', { class: 'field' }, [
      el('label', { i18n: 'settings.backupSync.deviceNameLabel' }),
      nameInput,
      el('p', { class: 'hint', i18n: 'settings.backupSync.deviceNameHint' })
    ]);
    if (!hasCustomDeviceName() && typeof nameInput.focus === 'function') {
      nameInput.focus();
      if (typeof nameInput.select === 'function') nameInput.select();
    }

    const statusLine = el('p', { class: 'hint' });
    // Chromium/folder-sync only (auto-sync.js's runSyncCycle) — the one
    // context with a persisted, repeating cycle to actually retry a
    // referenced-mode (Phase 7) photo that hasn't finished syncing through
    // the cloud client yet. Manual sync's one-shot flows never populate
    // this, since a photo they can't resolve is applied as null
    // immediately rather than deferred — see photo-assets.js.
    const photoWarningLine = el('p', { class: 'hint warning' });
    function renderPhotoWarning() {
      const devices = getPendingPhotoDevices();
      photoWarningLine.textContent = devices.length
        ? t('settings.backupSync.photoWarning', { devices: devices.join(', ') })
        : '';
    }
    // Phase 4 calls surfacing clock skew required rather than optional:
    // nothing in the merge algorithm detects it, so a peer with a wrong
    // clock silently wins (or loses) every conflict it takes part in,
    // deletions included. This is the only place a user ever sees it —
    // the verbose sync log is off by default.
    const clockSkewLine = el('p', { class: 'hint warning' });
    function renderClockSkewWarning() {
      const devices = getClockSkewedDevices();
      clockSkewLine.textContent = devices.length
        ? t('settings.backupSync.clockSkewWarning', { devices: devices.join(', ') })
        : '';
    }
    function renderStatus() {
      const lastSyncedAt = getLastSyncedAt();
      renderPhotoWarning();
      renderClockSkewWarning();
      if (!lastSyncedAt) {
        statusLine.textContent = t('settings.backupSync.statusNeverSynced');
        return;
      }
      const when = new Date(lastSyncedAt).toLocaleString();
      const devices = getLastSyncedDevices();
      statusLine.textContent = devices.length
        ? t('settings.backupSync.statusLastSyncedWith', { when, devices: devices.join(', ') })
        : t('settings.backupSync.statusLastSynced', { when });
    }
    renderStatus();

    const reviewLine = el('div', { class: 'field' });
    function renderReview() {
      clear(reviewLine);
      const count = getPendingReviewCount();
      if (count === 0) return;
      const reviewButton = el('button', { class: 'secondary', i18n: 'settings.backupSync.reviewButton' });
      reviewButton.addEventListener('click', () => openReviewDialog(() => { renderReview(); onSyncApplied(); }));
      reviewLine.appendChild(el('p', { class: 'hint warning', text: t('settings.backupSync.reviewNeeded', { count }) }));
      reviewLine.appendChild(reviewButton);
    }
    renderReview();

    const syncEngineNode = isFileSystemAccessSupported()
      ? buildFolderSyncControls(renderStatus, renderReview)
      : buildManualSyncControls(renderStatus, renderReview);

    // Off by default (Phase 7) — shown regardless of this device's own
    // platform, since a desktop user with an iPhone elsewhere in their
    // mesh is the one who needs to turn it on, not an iPhone user (who has
    // no folder access to make this choice from in the first place).
    const iphoneSyncCheckbox = el('input', { type: 'checkbox', id: 'settings-backup-sync-iphone-support' });
    iphoneSyncCheckbox.checked = isIphoneSyncSupportEnabled();
    iphoneSyncCheckbox.addEventListener('change', () => setIphoneSyncSupportEnabled(iphoneSyncCheckbox.checked));
    const iphoneSyncField = el('div', { class: 'field' }, [
      el('label', { class: 'checkbox-field' }, [iphoneSyncCheckbox, i18nSpan('settings.backupSync.iphoneSyncLabel')]),
      el('p', { class: 'hint', i18n: 'settings.backupSync.iphoneSyncHint' })
    ]);

    const verboseCheckbox = el('input', { type: 'checkbox', id: 'settings-backup-sync-verbose' });
    verboseCheckbox.checked = isVerboseSyncLoggingEnabled();
    verboseCheckbox.addEventListener('change', () => setVerboseSyncLoggingEnabled(verboseCheckbox.checked));
    const copyLogButton = copyButton({
      label: t('settings.backupSync.copyLogButton'),
      copiedLabel: t('settings.backupSync.copyLogButtonCopied'),
      getText: () => getSyncLog().join('\n')
    });
    const advancedSection = sectionGroup('settings.backupSync.advancedHeading', [
      el('div', { class: 'field' }, [
        el('label', { class: 'checkbox-field' }, [verboseCheckbox, i18nSpan('settings.backupSync.verboseLoggingLabel')]),
        el('p', { class: 'hint', i18n: 'settings.backupSync.verboseLoggingHint' })
      ]),
      el('div', { class: 'field' }, [copyLogButton])
    ], { nested: true });

    return el('div', {}, [
      el('p', { class: 'hint warning', i18n: 'settings.backupSync.experimentalWarning' }),
      el('label', { class: 'checkbox-field' }, [masterCheckbox, i18nSpan('settings.backupSync.enableLabel')]),
      nameField,
      syncEngineNode,
      statusLine,
      photoWarningLine,
      clockSkewLine,
      iphoneSyncField,
      reviewLine,
      advancedSection
    ]);
  }

  function buildFolderSyncControls(renderStatus, renderReview) {
    // Its own line, not squeezed next to the label — this is the one piece
    // of state that determines whether "Sync Now" touches anything at all,
    // so it gets a full sentence rather than a two-word hint easy to
    // skim past: "No sync folder selected." when there's nothing to sync
    // against yet, "Currently synchronizing to <name>" once there is,
    // naming the actual folder (not just "a folder") for anyone with more
    // than one synced location or browser profile in play.
    const folderStatusLine = el('p', { class: 'hint' });
    // "Choose Folder…" is the synchronous first-paint default (correct for
    // the common no-folder-yet case, and for the brief gap before
    // refreshFolderStatus()'s IndexedDB read resolves) — the same pattern
    // syncNowButton below uses for its own default-disabled state.
    const chooseButton = el('button', { class: 'secondary', i18n: 'settings.backupSync.chooseFolderButton' });
    const syncNowButton = el('button', { i18n: 'settings.backupSync.syncNowButton', disabled: 'true' });

    async function refreshFolderStatus() {
      const handle = await getPersistedFolderHandle();
      // `handle.name` is the folder's own last-path-segment name (the File
      // System Access API's own getter for this — it never exposes a full
      // host filesystem path, by design) — showing it is what lets a user
      // with more than one similar-looking sync setup (a Dropbox folder
      // here, a OneDrive one there, or just two profiles pointed at
      // different places) confirm at a glance which one this device is
      // actually using. Falls back to the generic message only in the —
      // spec-wise near-impossible — case of an empty name.
      folderStatusLine.textContent = !handle
        ? t('settings.backupSync.folderNotChosen')
        : handle.name
          ? t('settings.backupSync.folderChosenNamed', { name: handle.name })
          : t('settings.backupSync.folderChosen');
      // "Choose Folder…" only the first time; once one is already set,
      // the same button reads "Change Folder…" — same action underneath
      // (showDirectoryPicker() again), but the label should say what a
      // second click on an already-configured setting actually does.
      applyI18nText(chooseButton, handle ? 'settings.backupSync.changeFolderButton' : 'settings.backupSync.chooseFolderButton');
      syncNowButton.disabled = !handle;
    }
    refreshFolderStatus();

    chooseButton.addEventListener('click', async () => {
      try {
        await pickFolder();
      } catch {
        return; // user cancelled the picker — nothing to do
      }
      await refreshFolderStatus();
    });

    syncNowButton.addEventListener('click', async () => {
      syncNowButton.disabled = true;
      await runSyncCycle({ allowPrompt: true });
      renderStatus();
      renderReview();
      onSyncApplied();
      syncNowButton.disabled = false;
    });

    const modeOptions = ['manual', 'automatic'].map((mode) => {
      const id = `settings-backup-sync-mode-${mode}`;
      const radio = el('input', { type: 'radio', name: 'settings-backup-sync-mode', id });
      radio.checked = getSyncMode() === mode;
      radio.addEventListener('change', () => { if (radio.checked) setSyncMode(mode); });
      return el('label', { for: id, class: 'checkbox-field' }, [radio, i18nSpan(`settings.backupSync.mode.${mode}`)]);
    });

    return el('div', {}, [
      el('div', { class: 'field' }, [
        el('label', { i18n: 'settings.backupSync.folderLabel' }),
        chooseButton,
        folderStatusLine
      ]),
      el('div', { class: 'field' }, modeOptions.concat(
        el('p', { class: 'hint', i18n: 'settings.backupSync.modeHint' })
      )),
      el('div', { class: 'field' }, [syncNowButton])
    ]);
  }

  // Phase 8a (desktop non-Chromium: Firefox anywhere, Safari on macOS) and
  // 8b (iOS/iPadOS) each get a single combined "Sync" action rather than
  // separate Download/Import buttons — see manual-sync.js's own comment
  // on why: a user who imports but forgets to re-export/share would leave
  // this device's own edits invisible to the rest of the mesh. Only the
  // picker shape and the export mechanism differ between the two tiers;
  // everything else is shared.
  function buildManualSyncControls(renderStatus, renderReview) {
    const iosMode = isIOS();
    const summaryArea = el('p', { class: 'hint' });
    const errorArea = el('p', { class: 'hint warning' });

    // 8a: `webkitdirectory` picks the whole synced folder in one gesture,
    // which — unlike a plain multi-file picker — also hands back any
    // assets/ subfolder files, making a peer's referenced-mode photos
    // (Phase 7) resolvable here. 8b has no working directory selection in
    // practice, so it stays a plain multi-file picker (iOS's document
    // picker supports multi-select of individual files); photos always
    // degrade to null there — see manual-sync.js's own isDirectorySelection.
    const fileInput = el('input', {
      type: 'file', accept: 'application/json', multiple: 'true',
      ...(iosMode ? {} : { webkitdirectory: 'true' })
    });
    fileInput.style.display = 'none';

    fileInput.addEventListener('change', async () => {
      const files = fileInput.files ? [...fileInput.files] : [];
      fileInput.value = ''; // clear so picking the same folder/files again still fires 'change'
      if (files.length === 0) return; // the picker was cancelled — nothing to do
      clear(errorArea);
      clear(summaryArea);
      try {
        const { devices } = await syncViaPickedFiles(files);
        renderStatus();
        renderReview();
        onSyncApplied();
        summaryArea.textContent = t('settings.backupSync.manualSyncSummary', { count: devices.length });
      } catch (err) {
        errorArea.textContent = err.code === 'invalid-json'
          ? t('settings.backupSync.importErrorInvalidJson')
          : t('settings.backupSync.importErrorInvalidFormat');
      }
    });

    const syncButton = el('button', { i18n: 'settings.backupSync.syncNowButton' });
    syncButton.addEventListener('click', () => fileInput.click());

    return el('div', { class: 'field' }, [
      el('p', { class: 'hint', i18n: iosMode ? 'settings.backupSync.iosModeHint' : 'settings.backupSync.manualModeHint' }),
      syncButton,
      fileInput,
      summaryArea,
      errorArea
    ]);
  }

  return sectionGroup('settings.backupSync.heading', [container]);
}
