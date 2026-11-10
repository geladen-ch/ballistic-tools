// The two launch-time notices that guard against iOS deleting this app's
// saved data. iOS (Safari and every other iOS browser, all WebKit) may
// delete everything a site stores once it has gone unused for about a week
// in a browser tab, and under storage pressure in general:
//
//  - Install notice: running in an iOS browser tab, suggest adding the app
//    to the Home Screen, where its storage is kept. The installed app does
//    not share the tab's storage, so with data present it also offers a
//    backup to carry over.
//  - Backup reminder: on any iOS launch surface, data changed since the
//    last backup and that backup is a week or more old
//    (backup-reminder-state.js).
//
// At most one of them per launch, install notice first: it addresses the
// cause, and offers the backup itself. Neither shows on other platforms,
// whose browsers do not delete a site's data for going unused.
import { el } from './dom.js';
import { t } from './i18n.js';
import { showDialog } from './ui/app-dialog.js';
import { isoDate } from './ui/iso-date.js';
import { isIOS, isHomeScreenApp } from './platform.js';
import { shareOrDownloadOwnBundle } from './sync/manual-sync.js';
import { logDiagnostic } from './debug-log.js';
import {
  getLastBackupAt, isBackupReminderDue, seedUnsavedData, snoozeBackupReminder, setBackupReminderEnabled
} from './backup-reminder-state.js';
import {
  isInstallNoticeAllowed, snoozeInstallNotice, dismissInstallNotice,
  INSTALL_NOTICE_SNOOZE_MS, INSTALL_NOTICE_AFTER_BACKUP_MS
} from './install-notice-prefs.js';
import { loadUserBullets, loadUserRifles, loadUserScopes } from './user-library.js';
import { loadUserReticles } from './reticle-library.js';
import { loadUserLocations } from './location-library.js';
import { loadRiflePrecisionProjects } from './rifle-precision-library.js';

// The libraries a backup bundle carries; the libraries' mirrors are warm by
// the time this runs (app.js awaits their init before routing).
function hasUserData() {
  return [loadUserBullets, loadUserRifles, loadUserScopes, loadUserReticles, loadUserLocations, loadRiflePrecisionProjects]
    .some((load) => load().length > 0);
}

// Where a backup is restored, spelled with the app's own labels so the
// instruction matches what the user sees in Settings.
function restorePath() {
  return t('storageNotice.restorePath', {
    settings: t('nav.settings'),
    section: t('settings.backupSync.heading'),
    enable: t('settings.backupSync.enableLabel'),
    sync: t('settings.backupSync.syncNowButton')
  });
}

function saveBackup() {
  // Called straight from the button's click, so the share sheet still has
  // the user gesture it needs.
  shareOrDownloadOwnBundle().catch((err) => logDiagnostic('error', '[storage] backup export failed:', err));
}

function showInstallNotice(withData) {
  const body = el('div', {}, [
    el('p', { text: t('storageNotice.installIntro') }),
    el('p', { text: t('storageNotice.installHow') }),
    withData ? el('p', { class: 'hint caution', text: t('storageNotice.installCarryOver') }) : null,
    withData ? el('p', { class: 'hint', text: restorePath() }) : null
  ]);
  const buttons = [];
  if (withData) {
    buttons.push({
      label: t('storageNotice.saveBackup'),
      onClick: () => {
        snoozeInstallNotice(INSTALL_NOTICE_AFTER_BACKUP_MS);
        saveBackup();
      }
    });
  }
  buttons.push(
    { label: t('storageNotice.notNow'), onClick: () => snoozeInstallNotice(INSTALL_NOTICE_SNOOZE_MS) },
    { label: t('storageNotice.dontShowAgain'), onClick: dismissInstallNotice }
  );
  showDialog({ bodyNode: body, buttons });
}

function showBackupReminder() {
  const lastBackupAt = getLastBackupAt();
  const body = el('div', {}, [
    el('p', { text: t('storageNotice.reminderIntro') }),
    el('p', {
      text: lastBackupAt === null
        ? t('storageNotice.reminderNever')
        // Non-breaking hyphens: a narrow dialog would otherwise wrap the
        // date as "2025-12-" / "01".
        : t('storageNotice.reminderSince', { date: isoDate(lastBackupAt).replace(/-/g, '‑') })
    }),
    el('p', { class: 'hint', text: t('storageNotice.saveToFilesHint') }),
    el('p', { class: 'hint', text: restorePath() })
  ]);
  showDialog({
    bodyNode: body,
    buttons: [
      { label: t('storageNotice.saveBackup'), onClick: saveBackup },
      { label: t('storageNotice.later'), onClick: () => snoozeBackupReminder() },
      // Undone from Settings → General.
      { label: t('storageNotice.neverShowAgain'), onClick: () => setBackupReminderEnabled(false) }
    ]
  });
}

// Returns which notice it showed ('install', 'backup' or null), for the
// boot log.
export function maybeShowStorageNotice() {
  const withData = hasUserData();
  seedUnsavedData(withData);
  if (!isIOS()) return null;
  if (!isHomeScreenApp() && isInstallNoticeAllowed()) {
    showInstallNotice(withData);
    return 'install';
  }
  if (withData && isBackupReminderDue()) {
    showBackupReminder();
    return 'backup';
  }
  return null;
}
