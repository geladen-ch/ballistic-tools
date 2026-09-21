// Settings UI for the "Backup & Sync" feature — see
// docs/plans/backup-sync.md Phase 6. One section, always in the same
// place; what renders inside it differs by capability (Chromium folder
// sync vs. Phase 8a's plain download/upload), not by separate screens.
import { el, clear } from '../dom.js';
import { i18nSpan, applyI18nText, t } from '../i18n.js';
import { sectionGroup } from './section.js';
import { showDialog, hideDialog } from './app-dialog.js';
import { isoDate } from './iso-date.js';
import { copyButton } from './copy-button.js';
import { downloadFile } from '../download.js';
import { isBackupSyncEnabled, setBackupSyncEnabled } from '../backup-sync-prefs.js';
import { getDeviceName, setDeviceName, hasCustomDeviceName } from '../sync/device-name.js';
import {
  isFileSystemAccessSupported, pickFolder, getPersistedFolderHandle, verifyPermission, listBackupFiles
} from '../sync/fs-folder.js';
import { getSyncMode, setSyncMode, runSyncCycle, unregisterAutomaticTriggers } from '../sync/auto-sync.js';
import {
  getLastSyncedAt, getLastSyncedDevices, getPendingPhotoDevices, getClockSkewedDevices
} from '../sync/last-sync-status.js';
import { isIOS, syncViaPickedFiles } from '../sync/manual-sync.js';
import {
  listPendingReviews, getPendingReviewCount, markPendingReviewResolved, reopenPendingReview
} from '../sync/pending-review.js';
import {
  isVerboseSyncLoggingEnabled, setVerboseSyncLoggingEnabled, getPersistedSyncLog, clearSyncLog,
  clearPersistedSyncLog, rotateSyncLogNow
} from '../sync/sync-log.js';
import {
  runAssetCleanup, getAssetCleanupStatus, recordAssetCleanupRun,
  suppressAssetWarning, isAssetWarningSuppressed, clearAssetWarningSuppression
} from '../sync/asset-cleanup.js';
import { sweepResolvedMarkers } from '../sync/pending-review.js';
import { pruneChangeHistoryNow } from '../sync/change-history.js';
import { isIphoneSyncSupportEnabled, setIphoneSyncSupportEnabled } from '../sync/photo-storage-prefs.js';
import { getDeviceLabel, getDeviceNameEvenIfDeleted, isDeviceDeleted } from '../sync/device-registry.js';
import { listSyncDevices, deleteSyncDevice, identifyBackupFiles } from '../sync/device-deletion.js';
import { SYNCED_LIBRARIES } from '../sync/synced-libraries.js';
import { recordTypeLabel } from '../sync/record-type-labels.js';
import { loadUserBullets, loadUserRifles } from '../user-library.js';
import { loadUserLocations } from '../location-library.js';
import { loadRiflePrecisionProjects } from '../rifle-precision-library.js';
import { buildExportPayload as buildArsenalPayload, serializeExport as serializeArsenal } from '../arsenal-export.js';
import { buildExportPayload as buildLocationsPayload, serializeExport as serializeLocations } from '../location-export.js';
import { buildExportPayload as buildRpPayload, serializeExport as serializeRp } from '../rifle-precision-export.js';
import { downloadDiagnostics } from '../diagnostics.js';

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit++; }
  return `${value < 10 && unit > 0 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}

// The manual action reports **everything** it found, unlike the automatic
// path, which surfaces only the two conditions a user can act on and keeps
// the rest to the log. The asymmetry is deliberate: the visibility rules
// govern *unsolicited* notices, and someone who pressed a button is owed an
// answer whatever the cause. Every line pairs what happened with a cue for
// what to do about it; where there is genuinely nothing to try, it says so
// rather than inventing troubleshooting.
function describeCleanupReport(report, prefixLines) {
  const lines = [...prefixLines];
  const names = (devices) => (devices || []).map((d) => d.name || d.id).filter(Boolean).join(', ');
  if (!report) {
    lines.push(t('settings.backupSync.cleanup.reportNoFolder'));
    return lines;
  }

  switch (report.outcome) {
    case 'no-assets':
      lines.push(t('settings.backupSync.cleanup.reportNoAssets'));
      break;
    case 'parse-failure':
      lines.push(t('settings.backupSync.cleanup.reportParseFailure', {
        files: (report.detail || []).map((d) => d.fileName).join(', ')
      }));
      break;
    case 'aborted':
      lines.push(t('settings.backupSync.cleanup.reportAborted'));
      break;
    case 'error':
      lines.push(t('settings.backupSync.cleanup.reportError', { detail: report.detail || '' }));
      break;
    case 'hard-stop':
      if (report.failedCheck === 'bundle-lists-no-photos') {
        lines.push(t('settings.backupSync.cleanup.reportStopMissingRef', { device: names(report.affectedDevices) }));
      } else if (report.failedCheck === 'local-hash-invariant') {
        lines.push(t('settings.backupSync.cleanup.reportStopInternal'));
      } else if (report.failedCheck === 'attribution') {
        lines.push(t('settings.backupSync.cleanup.reportStopAttribution'));
      } else if (report.failedCheck === 'referenced-file-vanished') {
        lines.push(t('settings.backupSync.cleanup.reportStopVanished', { device: names(report.affectedDevices) }));
      }
      break;
    default:
      lines.push(report.removed.length === 0
        ? t('settings.backupSync.cleanup.reportNothingRemoved')
        : (report.bytesKnown
          ? t('settings.backupSync.cleanup.reportRemoved', {
            count: report.removed.length, size: formatBytes(report.removedBytes)
          })
          : t('settings.backupSync.cleanup.reportRemovedCountOnly', { count: report.removed.length })));
  }

  // Observational findings — reported here and nowhere else.
  if (report.referencedMissing && report.referencedMissing.length > 0) {
    lines.push(t('settings.backupSync.cleanup.reportMissing', {
      count: report.referencedMissing.length,
      devices: names(report.missingFromDevices) || t('settings.backupSync.cleanup.unknownDevice')
    }));
  }
  if (report.duplicateDeviceIds && report.duplicateDeviceIds.length > 0) {
    lines.push(t('settings.backupSync.cleanup.reportDuplicateIds', { ids: report.duplicateDeviceIds.join(', ') }));
  }
  if (report.divergentRefs && report.divergentRefs.length > 0) {
    lines.push(t('settings.backupSync.cleanup.reportDivergence', { count: report.divergentRefs.length }));
  }
  if (report.malformed && report.malformed.length > 0) {
    lines.push(t('settings.backupSync.cleanup.reportMalformed', { count: report.malformed.length }));
  }
  if (report.unresolvedMarks && report.unresolvedMarks.length > 0) {
    lines.push(t('settings.backupSync.cleanup.reportUnresolvedMarks', { count: report.unresolvedMarks.length }));
  }
  return lines;
}

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
  return Number.isFinite(ms) ? isoDate(ms) : t('settings.backupSync.review.unknownTimestamp');
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

// One line for a device in either the list or the picker: what the last
// backup file from it says. "No backup file in the folder" is a claim about
// the folder, so it is only made when the folder was actually listed and the
// file is not in it. It used to be the fallback for *any* row without a
// publish time — including this device's own, which is why it read that way
// beside a device that had just published.
function deviceStatusText(row) {
  if (!row.isSelf && row.hasBundle === false) return t('settings.backupSync.devices.noBackup');
  if (row.lastExportedAt) return t('settings.backupSync.devices.published', { when: isoDate(row.lastExportedAt) });
  return null;
}

// Deleting a device is not a light decision, so it is not one click away
// from every row in the list. The list only informs; this modal is where a
// device is chosen, and the choice then goes on to the same confirmation as
// before. Devices that cannot be deleted right now are shown, with the
// reason, rather than left out — a device missing from the picker with no
// explanation reads as a bug.
function openDeleteDevicePicker(rows, onDone) {
  const list = el('div', {});
  for (const row of rows.filter((r) => !r.isSelf)) {
    const status = deviceStatusText(row);
    const info = [el('strong', { text: row.name })];
    if (status) info.push(el('br'), el('span', { class: 'hint', text: status }));

    if (row.blocked) {
      // Never offered: the reason is the row's content, and it is not
      // clickable. (`self` never reaches here — filtered above — and the
      // rest are the gates in device-deletion.js's deletionBlockedReason().)
      const reasonKey = {
        conflicts: 'settings.backupSync.devices.blockedConflicts',
        'photos-pending': 'settings.backupSync.devices.blockedPhotos',
        'not-merged': 'settings.backupSync.devices.blockedNotMerged'
      }[row.blocked.reason];
      info.push(el('br'), el('span', {
        class: 'hint warning',
        text: t(reasonKey, { device: row.name, count: row.blocked.count })
      }));
      list.appendChild(el('div', { class: 'arsenal-row', 'aria-disabled': 'true' }, [
        el('div', { class: 'arsenal-row-info' }, info)
      ]));
      continue;
    }

    const pick = () => {
      hideDialog();
      confirmDeleteDevice(row, onDone);
    };
    const item = el('div', { class: 'arsenal-row row-clickable', role: 'button', tabindex: '0' }, [
      el('div', { class: 'arsenal-row-info' }, info)
    ]);
    item.addEventListener('click', pick);
    item.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        pick();
      }
    });
    list.appendChild(item);
  }

  showDialog({
    bodyNode: el('div', {}, [
      el('p', {}, [el('strong', { i18n: 'settings.backupSync.devices.pickTitle' })]),
      el('p', { class: 'hint', i18n: 'settings.backupSync.devices.pickHint' }),
      list
    ]),
    buttons: [{ label: t('settings.backupSync.devices.confirmCancel') }],
    wide: true
  });
}

// Deleting a device is shared and not undoable, so the confirmation spells
// out what actually happens — including that a machine which is still live
// simply rejoins, which is correct behaviour under the revival rule but
// reads as broken if nobody said so in advance.
function confirmDeleteDevice(row, onDone) {
  const body = [
    // Browsers without folder access cannot remove the file, so the usual
    // wording ("its backup file is removed") would not be true of them.
    el('p', {
      text: t(isFileSystemAccessSupported()
        ? 'settings.backupSync.devices.confirmBody'
        : 'settings.backupSync.devices.confirmBodyNoFolder', { device: row.name })
    }),
    el('p', { class: 'hint', i18n: 'settings.backupSync.devices.confirmMerged' }),
    el('p', { class: 'hint', i18n: 'settings.backupSync.devices.confirmRejoins' })
  ];
  if (row.recentlyPublished) {
    body.splice(1, 0, el('p', {
      class: 'hint warning',
      text: t('settings.backupSync.devices.confirmRecent', {
        when: row.lastExportedAt ? isoDate(row.lastExportedAt) : ''
      })
    }));
  }
  showDialog({
    bodyNode: el('div', {}, [el('p', {}, [el('strong', { text: t('settings.backupSync.devices.confirmTitle', { device: row.name }) })]), ...body]),
    buttons: [
      { label: t('settings.backupSync.devices.confirmDelete'), onClick: async () => {
        const handle = isFileSystemAccessSupported() ? await getPersistedFolderHandle() : null;
        await deleteSyncDevice(handle, row.id);
        onDone();
      } },
      { label: t('settings.backupSync.devices.confirmCancel') }
    ]
  });
}

// Who a conflict came from. A conflict can outlive the device it names: it
// is raised on one device, and another device can delete that machine before
// it is resolved. The record still holds the peer's version in full, so it can
// still be resolved, but the plain name lookup returns nothing for a deleted
// device and would have shown a raw id — so a deleted one is named, and said
// to be deleted.
function conflictPeerLabel(deviceId) {
  const name = getDeviceLabel(deviceId);
  if (name) return name;
  if (isDeviceDeleted(deviceId)) {
    return t('settings.backupSync.review.peerDeleted', { device: getDeviceNameEvenIfDeleted(deviceId) || deviceId });
  }
  return deviceId;
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
    const peerLabel = conflictPeerLabel(item.peerDeviceId);
    const originalLocal = lib.loadLocalWithTombstones().find((r) => r.id === item.recordId);
    const name = (item.remoteVersion && item.remoteVersion.name) || (originalLocal && originalLocal.name) || item.recordId;

    return el('div', { class: 'field' }, [
      el('p', {}, [
        el('strong', { text: name }),
        el('br'),
        // Which of the four synced libraries this is — a bare name alone
        // doesn't say it (see docs/plans/backup-sync.md's own "K31" bug:
        // a built-in library rifle and a rifle-precision project can
        // share a name with nothing else in this dialog to tell them
        // apart).
        el('span', { class: 'hint', text: t('settings.backupSync.review.libraryLine', { library: recordTypeLabel(item.recordType) }) }),
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
    // Late-bound: renderStatus() is first called before the Devices list
    // below exists, so it cannot reference renderDevices() directly (the
    // const it belongs to is still in its temporal dead zone). Assigned
    // once the list is built.
    let refreshDevices = () => {};
    function renderStatus() {
      // Every sync — folder or manual — ends in a renderStatus() call, so
      // this is what keeps the Devices list current. It used to render
      // once at mount and never again, so a peer first read during this
      // very visit did not appear until Settings was reopened.
      refreshDevices();
      const lastSyncedAt = getLastSyncedAt();
      renderPhotoWarning();
      renderClockSkewWarning();
      if (!lastSyncedAt) {
        statusLine.textContent = t('settings.backupSync.statusNeverSynced');
        return;
      }
      const when = isoDate(lastSyncedAt);
      const devices = getLastSyncedDevices();
      statusLine.textContent = devices.length
        ? t('settings.backupSync.statusLastSyncedWith', { when, devices: devices.join(', ') })
        : t('settings.backupSync.statusLastSynced', { when });
    }
    renderStatus();

    // --- unused photo files (docs/plans/orphaned-storage-cleanup.md phase 5) ---
    // Automatic deletion is never silent: this line is the only place a
    // user ever learns that files were removed from their own cloud folder.
    // A blocked run deliberately leaves it stale rather than alarming —
    // the folder quietly stops shrinking, and the durable log carries the
    // detail for a diagnostics download.
    const cleanupLine = el('p', { class: 'hint' });
    // One row per affected device, never one combined line: each has to be
    // collapsible on its own, or silencing an unreachable machine would
    // silence a reachable one alongside it.
    const cleanupWarnings = el('div', { class: 'field' });

    function renderCleanupWarnings(devices) {
      clear(cleanupWarnings);
      for (const device of devices || []) {
        if (!device || !device.id) continue;
        const collapsed = isAssetWarningSuppressed(device.id, device.exportedAt);
        const name = device.name || device.id;
        if (collapsed) {
          // Collapsed, never hidden outright: someone later asking why
          // photos are missing should still find the answer on screen.
          const row = el('p', { class: 'hint', text: t('settings.backupSync.cleanup.warningCollapsed', { device: name }) });
          const reopen = el('button', { class: 'secondary', i18n: 'settings.backupSync.cleanup.warningReopen' });
          reopen.addEventListener('click', () => {
            clearAssetWarningSuppression(device.id);
            renderCleanupWarnings(devices);
          });
          cleanupWarnings.appendChild(el('div', {}, [row, reopen]));
          continue;
        }
        const hide = el('button', { class: 'secondary', i18n: 'settings.backupSync.cleanup.warningHide' });
        hide.addEventListener('click', () => {
          suppressAssetWarning(device.id, device.exportedAt, device.condition || null);
          renderCleanupWarnings(devices);
        });
        cleanupWarnings.appendChild(el('div', {}, [
          el('p', { class: 'hint warning', text: t('settings.backupSync.cleanup.warningTitle', { device: name }) }),
          el('p', { class: 'hint', text: t('settings.backupSync.cleanup.warningStep1', { device: name }) }),
          el('p', { class: 'hint', text: t('settings.backupSync.cleanup.warningStep2') }),
          hide
        ]));
      }
    }

    function renderCleanupStatus() {
      const status = getAssetCleanupStatus();
      if (!status || !status.at) {
        cleanupLine.textContent = t('settings.backupSync.cleanup.never');
        renderCleanupWarnings([]);
        return;
      }
      const when = isoDate(status.at);
      if (status.removedCount > 0) {
        cleanupLine.textContent = status.bytesKnown
          ? t('settings.backupSync.cleanup.lastRemoved', {
              when, count: status.removedCount, size: formatBytes(status.removedBytes)
            })
          : t('settings.backupSync.cleanup.lastRemovedCountOnly', { when, count: status.removedCount });
      } else {
        cleanupLine.textContent = t('settings.backupSync.cleanup.lastNothing', { when });
      }
      // Only the two conditions a user can actually act on surface here;
      // everything else is log-only, because there is no step they could
      // take. The manual action below reports all of it regardless.
      renderCleanupWarnings(status.affectedDevices || []);
    }
    renderCleanupStatus();

    // --- devices (docs/plans/orphaned-storage-cleanup.md phase 6) ---
    // Wrapped in the same nested section shell the Advanced group uses, so
    // its heading reads as a heading rather than as a hint above
    // full-size rows.
    const devicesBody = el('div', {});
    const devicesSection = sectionGroup('settings.backupSync.devices.heading', [devicesBody], { nested: true });

    // The folder listing, when there is one to read without prompting, and
    // what its files hold. Reading them is what lets a device whose bundle
    // has not been through a sync cycle here yet appear at all — the
    // registry only knows peers this browser has already read. Never prompts (this runs on every
    // render, not from a gesture), and any failure just means the list is
    // built from the registry alone.
    async function readFolderFileNames() {
      if (!isFileSystemAccessSupported()) return null;
      try {
        const handle = await getPersistedFolderHandle();
        if (!handle || !(await verifyPermission(handle, { allowPrompt: false }))) return null;
        const names = await listBackupFiles(handle);
        // Learn what any file no sync cycle has read yet holds, by reading
        // it, so the list never has to guess from a name.
        await identifyBackupFiles(handle, names);
        return names;
      } catch {
        return null;
      }
    }

    let devicesRenderToken = 0;
    function renderDevices() {
      // Paint immediately from what is already known, then repaint once
      // the folder listing arrives. The token drops a slow listing that a
      // newer render has already superseded, so the list can never go
      // backwards.
      const token = ++devicesRenderToken;
      paintDevices(null);
      readFolderFileNames().then((fileNames) => {
        if (token === devicesRenderToken && fileNames) paintDevices(fileNames);
      });
    }

    function paintDevices(fileNames) {
      clear(devicesBody);
      const rows = listSyncDevices({ fileNames });
      // Only this device: a one-row list of yourself is noise, and there is
      // nothing on it you could act on anyway.
      devicesSection.style.display = rows.length <= 1 ? 'none' : '';
      if (rows.length <= 1) return;
      for (const row of rows) {
        const label = row.isSelf
          ? t('settings.backupSync.devices.thisDevice', { device: row.name || getDeviceName() })
          : row.name;
        const status = deviceStatusText(row);
        devicesBody.appendChild(el('div', { class: 'field' }, [
          el('p', { class: 'hint', text: status ? `${label} — ${status}` : label })
        ]));
      }

      // One button for the whole list, not one per row. This device is never
      // in the picker: a device tombstoning itself would republish with a
      // newer exportedAt on its next cycle, immediately revive, and achieve
      // nothing.
      const deleteDeviceButton = el('button', { class: 'secondary', i18n: 'settings.backupSync.devices.deleteDeviceButton' });
      // Recomputed on click, so what the picker offers (and which gates it
      // reports) is current rather than as of the last repaint. renderStatus()
      // also refreshes this list, so it is not repainted separately here.
      deleteDeviceButton.addEventListener('click', () => openDeleteDevicePicker(listSyncDevices({ fileNames }), () => {
        renderStatus();
        onSyncApplied();
      }));
      devicesBody.appendChild(el('div', { class: 'field' }, [deleteDeviceButton]));
    }
    refreshDevices = renderDevices;
    renderDevices();

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
      // The durable log, not just the in-memory trace: that trace is only
      // filled while verbose logging is on and is gone after a reload,
      // which would leave the warnings and errors this log exists for
      // (a file removed, a sync that failed) invisible here.
      getText: () => getPersistedSyncLog().then((lines) => lines.join('\n'))
    });
    // Clears both layers: the in-memory verbose trace and the durable
    // history behind it. Deliberately one action rather than two — the
    // distinction between them matters to sync-log.js, not to someone who
    // just wants the log emptied.
    const clearLogButton = el('button', { class: 'secondary', i18n: 'settings.backupSync.clearLogButton' });
    clearLogButton.addEventListener('click', () => {
      clearLogButton.disabled = true;
      clearSyncLog();
      clearPersistedSyncLog().finally(() => {
        clearLogButton.disabled = false;
      });
    });
    // Named for *storage*, not for assets, so it reconciles everything in
    // one go rather than making the user find four separate actions.
    // Not a confirmation dialog — a user-initiated action for someone who
    // just deleted a large project and wants the space back today rather
    // than waiting for the daily pass.
    const cleanupNowButton = el('button', { class: 'secondary', i18n: 'settings.backupSync.cleanup.runNowButton' });
    const cleanupReport = el('div', { class: 'field' });
    cleanupNowButton.addEventListener('click', async () => {
      cleanupNowButton.disabled = true;
      clear(cleanupReport);
      cleanupReport.appendChild(el('p', { class: 'hint', i18n: 'settings.backupSync.cleanup.running' }));
      try {
        const lines = [];
        const markers = sweepResolvedMarkers();
        if (markers > 0) lines.push(t('settings.backupSync.cleanup.reportMarkers', { count: markers }));
        const history = pruneChangeHistoryNow();
        if (history > 0) lines.push(t('settings.backupSync.cleanup.reportHistory', { count: history }));
        await rotateSyncLogNow();

        // A user gesture, so this is the one path allowed to re-prompt for
        // folder permission if it has lapsed.
        let report = null;
        if (isFileSystemAccessSupported()) {
          await runSyncCycle({ allowPrompt: true, trigger: 'manual' });
          const handle = await getPersistedFolderHandle();
          if (handle) {
            report = await runAssetCleanup(handle);
            recordAssetCleanupRun(report);
          }
        }
        clear(cleanupReport);
        for (const line of describeCleanupReport(report, lines)) {
          cleanupReport.appendChild(el('p', { class: 'hint', text: line }));
        }
        if (report && report.outcome === 'hard-stop') {
          const diagnostics = el('button', { class: 'secondary', i18n: 'settings.backupSync.cleanup.downloadDiagnostics' });
          diagnostics.addEventListener('click', () => downloadDiagnostics());
          cleanupReport.appendChild(diagnostics);
        }
        renderCleanupStatus();
        renderStatus();
        onSyncApplied();
      } finally {
        cleanupNowButton.disabled = false;
      }
    });

    const advancedSection = sectionGroup('settings.backupSync.advancedHeading', [
      el('div', { class: 'field' }, [
        el('label', { class: 'checkbox-field' }, [verboseCheckbox, i18nSpan('settings.backupSync.verboseLoggingLabel')]),
        el('p', { class: 'hint', i18n: 'settings.backupSync.verboseLoggingHint' })
      ]),
      el('div', { class: 'field' }, [copyLogButton, clearLogButton]),
      el('p', { class: 'hint', i18n: 'settings.backupSync.clearLogHint' }),
      // Only where this browser can use a sync folder. What the button is
      // for is removing photo files from that folder; without one, the rest
      // of what it does (expired conflict records, change history over its
      // limit, the sync log) is what already happens at every app start, so
      // there it would be a button that appears to do something and does
      // not.
      ...(isFileSystemAccessSupported() ? [
        el('div', { class: 'field' }, [cleanupNowButton]),
        el('p', { class: 'hint', i18n: 'settings.backupSync.cleanup.runNowHint' }),
        cleanupReport
      ] : [])
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
      devicesSection,
      cleanupLine,
      cleanupWarnings,
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
        // This app has no cloud feature of its own (see the manual's own
        // "Why there's no Cloud button") — the folder picked here only
        // ever gets carried to another device if something *else* is
        // already keeping it in sync, which the picker itself gives no
        // hint of. Shown before the button, not after, so it's read
        // before the choice is made rather than as an afterthought once
        // the wrong (unsynced) folder is already selected.
        el('p', { class: 'hint', i18n: 'settings.backupSync.folderHint' }),
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
      // Browsers that cannot write into the folder save the backup by
      // download (or, on iOS, into the Files app), and the save step offers
      // to rename it when the file already exists. A renamed copy is read
      // as a second file for this device (see duplicate-bundles.js), so the
      // instruction sits right where the save is explained. Caution rather
      // than warning: nothing is broken by it, the mesh just gets an extra
      // file to tidy.
      el('p', { class: 'hint caution', i18n: iosMode ? 'settings.backupSync.iosModeWarning' : 'settings.backupSync.manualModeWarning' }),
      syncButton,
      fileInput,
      summaryArea,
      errorArea
    ]);
  }

  return sectionGroup('settings.backupSync.heading', [container]);
}
