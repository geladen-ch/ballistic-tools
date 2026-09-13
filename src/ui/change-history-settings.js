// Settings UI for Phase 9's local change-history/revert safety net — see
// docs/plans/backup-sync.md. Deliberately its own section, separate from
// backup-sync-settings.js's "Backup & Sync" block: history capture is
// unconditional (every user gets it, whether or not sync is ever turned
// on), so this section is never hidden behind that feature's master
// toggle.
import { el, clear } from '../dom.js';
import { i18nSpan, t } from '../i18n.js';
import { sectionGroup } from './section.js';
import { showDialog } from './app-dialog.js';
import { listRecentHistory, listRecentlyDeleted, listHistoryFor, revertToSnapshot } from '../sync/change-history.js';
import { getDeviceId } from '../sync/device-id.js';
import { getDeviceLabel } from '../sync/device-registry.js';
import { recordTypeLabel } from '../sync/record-type-labels.js';

const VISIBLE_COUNT = 20;

// "Who made this change" (Phase 9's UI spec), falling back to a generic
// label when it's this device's own id (never shown by its own device
// name; see disambiguate-by-name.js's identical "resolve via the device
// registry" pattern) or unresolvable (a peer this device has since
// forgotten, or a change old enough to predate Phase 2 entirely).
function whoLabel(deviceId) {
  if (!deviceId) return t('settings.changeHistory.unknownDeviceLabel');
  if (deviceId === getDeviceId()) return t('settings.changeHistory.thisDeviceLabel');
  return getDeviceLabel(deviceId) || t('settings.changeHistory.unknownDeviceLabel');
}

// A history entry describes the change that *superseded* the version it
// holds, not the version itself: the snapshot is the value being kept for
// recovery, while `supersededBy`/`supersededByDelete` name the write that
// replaced it. Reading attribution off the snapshot instead would label
// every row with the author of the older version — the one nothing
// happened to.
function summaryFor(entry) {
  const status = entry.supersededByDelete
    ? t('settings.changeHistory.deletedStatus')
    : t('settings.changeHistory.editedStatus');
  return t('settings.changeHistory.entrySummary', {
    type: recordTypeLabel(entry.recordType),
    status,
    when: new Date(entry.capturedAt).toLocaleString(),
    who: whoLabel(entry.supersededBy)
  });
}

// The "Recently deleted" rows come from the libraries' own tombstones
// rather than from history (see change-history.js's listRecentlyDeleted),
// so their attribution is the tombstone's own deletedBy/deletedAt.
function deletedSummaryFor(row) {
  return t('settings.changeHistory.entrySummary', {
    type: recordTypeLabel(row.recordType),
    status: t('settings.changeHistory.deletedStatus'),
    when: new Date(row.deletedAt).toLocaleString(),
    who: whoLabel(row.deletedBy)
  });
}

// Per-record "History" view (docs/plans/backup-sync.md Phase 9's UI
// spec) — every retained version of one record, newest first, each with
// its own "Restore this version" action. Reached from a "History…" button
// next to any entry in the flat recent-changes list below, rather than a
// separate per-library screen, so it works identically for all four
// synced record types with no changes to their own list/edit views.
function openHistoryDialog(recordType, recordId, recordName, onChanged) {
  const rows = listHistoryFor(recordType, recordId).map((entry) => {
    const restoreButton = el('button', { class: 'secondary', i18n: 'settings.changeHistory.restoreVersionButton' });
    restoreButton.addEventListener('click', () => {
      revertToSnapshot(recordType, entry.snapshot);
      onChanged();
    });
    return el('div', { class: 'checkbox-field' }, [
      el('span', { text: `${entry.snapshot.name} — ${summaryFor(entry)}` }),
      restoreButton
    ]);
  });

  showDialog({
    bodyNode: el('div', {}, [
      el('p', { text: t('settings.changeHistory.historyDialogIntro', { name: recordName }) }),
      ...rows
    ]),
    buttons: [{ label: t('settings.backupSync.closeButton') }],
    wide: true
  });
}

// Returns `{ node, refresh }` rather than a bare node: this section's own
// buttons (revert/restore) already refresh themselves after writing, but
// a sync cycle or a conflict resolution can also add history entries —
// from backup-sync-settings.js, a wholly separate section built in the
// same settings-view.js page — with nothing else to ever prompt this
// section to notice. `refresh` is what lets settings-view.js wire that
// up, without this section reaching into sync code, or subscribing to
// onLibraryWrite itself (which would mean one more permanent listener
// added every time Settings is revisited, since this section is rebuilt
// fresh on every mount — see write-hooks.js's own listeners array, which
// has no unsubscribe).
export function changeHistorySection() {
  const deletedList = el('div', { class: 'field' });
  const recentList = el('div', { class: 'field' });

  function renderDeleted() {
    clear(deletedList);
    const entries = listRecentlyDeleted(VISIBLE_COUNT);
    if (entries.length === 0) {
      deletedList.appendChild(el('p', { class: 'hint', i18n: 'settings.changeHistory.recentlyDeletedEmptyHint' }));
      return;
    }
    for (const entry of entries) {
      const row = [el('span', { text: `${entry.tombstone.name} — ${deletedSummaryFor(entry)}` })];
      if (entry.previousSnapshot) {
        const restoreButton = el('button', { class: 'secondary', i18n: 'settings.changeHistory.restoreButton' });
        restoreButton.addEventListener('click', () => {
          revertToSnapshot(entry.recordType, entry.previousSnapshot);
          renderDeleted();
          renderRecent();
        });
        row.push(restoreButton);
      } else {
        // Deleted on a peer and merged in here, or aged out of the history
        // caps — the record is still listed as gone, there is just nothing
        // local to put back.
        row.push(el('span', { class: 'hint', i18n: 'settings.changeHistory.noRecoverableSnapshotHint' }));
      }
      deletedList.appendChild(el('div', { class: 'checkbox-field' }, row));
    }
  }

  function renderRecent() {
    clear(recentList);
    const entries = listRecentHistory(VISIBLE_COUNT);
    if (entries.length === 0) {
      recentList.appendChild(el('p', { class: 'hint', i18n: 'settings.changeHistory.emptyHint' }));
      return;
    }
    for (const entry of entries) {
      const revertButton = el('button', { class: 'secondary', i18n: 'settings.changeHistory.revertButton' });
      revertButton.addEventListener('click', () => {
        revertToSnapshot(entry.recordType, entry.snapshot);
        renderRecent();
        renderDeleted();
      });
      const historyButton = el('button', { class: 'secondary', i18n: 'settings.changeHistory.historyButton' });
      historyButton.addEventListener('click', () => {
        openHistoryDialog(entry.recordType, entry.recordId, entry.snapshot.name, () => {
          renderRecent();
          renderDeleted();
        });
      });
      recentList.appendChild(el('div', { class: 'checkbox-field' }, [
        el('span', { text: `${entry.snapshot.name} — ${summaryFor(entry)}` }),
        historyButton,
        revertButton
      ]));
    }
  }

  renderDeleted();
  renderRecent();

  const node = sectionGroup('settings.changeHistory.heading', [
    el('p', { class: 'hint', i18n: 'settings.changeHistory.intro' }),
    el('h4', { i18n: 'settings.changeHistory.recentlyDeletedHeading' }),
    deletedList,
    el('h4', { i18n: 'settings.changeHistory.recentHeading' }),
    recentList
  ]);

  return {
    node,
    refresh() {
      renderRecent();
      renderDeleted();
    }
  };
}
