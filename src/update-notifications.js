// Two independent ways the app tells a user it's changed:
//
//  - checkBootVersionChange(): "you opened a tab and it's now running a
//    different version than the one you last saw" — compares the
//    CACHE_VERSION baked into *this* load against the last one recorded,
//    fires once at startup.
//  - watchForLiveUpdate(): "a new version just finished installing while
//    you were sitting in this tab" — a service-worker lifecycle signal,
//    can fire at any point mid-session.
//
// Both are gated by isUpdateNotificationsEnabled(), checked fresh every
// time rather than cached, since either dialog's own "Never show again"
// can flip it off mid-session (including from the other dialog).
import { showDialog } from './ui/app-dialog.js';
import { t } from './i18n.js';
import { CACHE_VERSION } from './version.js';
import {
  isUpdateNotificationsEnabled, setUpdateNotificationsEnabled,
  getLastSeenVersion, setLastSeenVersion
} from './update-notification-prefs.js';

export function checkBootVersionChange() {
  const lastSeen = getLastSeenVersion();
  // Bookkeeping updates regardless of whether the dialog actually shows
  // (notifications off, or nothing changed) — so a later re-enable of the
  // setting doesn't surface a stale, possibly multi-version-old jump.
  setLastSeenVersion(CACHE_VERSION);

  if (lastSeen === null) return; // first-ever visit (or first since this feature shipped) — nothing to report
  if (lastSeen === CACHE_VERSION) return;
  if (!isUpdateNotificationsEnabled()) return;

  showDialog({
    message: t('updateNotification.bootMessage', { oldVersion: lastSeen, newVersion: CACHE_VERSION }),
    buttons: [
      { label: t('updateNotification.ok'), onClick: () => { location.hash = '#/'; } },
      { label: t('updateNotification.whatsNew'), onClick: () => { location.hash = '#/release-history'; } },
      {
        label: t('updateNotification.neverShowAgain'),
        onClick: () => { setUpdateNotificationsEnabled(false); location.hash = '#/'; }
      }
    ]
  });
}

// `registration` is whatever navigator.serviceWorker.register(...)
// resolved with. `registration.installing`'s statechange reaching
// 'installed' *while navigator.serviceWorker.controller already exists*
// is the standard way to tell "this is an update" from "this is the very
// first install for this origin" (no controller yet) — the latter must
// never show this dialog.
export function watchForLiveUpdate(registration) {
  registration.addEventListener('updatefound', () => {
    const installing = registration.installing;
    if (!installing) return;
    installing.addEventListener('statechange', () => {
      if (installing.state !== 'installed') return;
      if (!navigator.serviceWorker.controller) return; // first install, not an update
      if (!isUpdateNotificationsEnabled()) return;

      showDialog({
        message: t('updateNotification.liveMessage'),
        buttons: [
          { label: t('updateNotification.gotIt') },
          { label: t('updateNotification.restartNow'), onClick: () => location.reload() },
          { label: t('updateNotification.neverShowAgainLive'), onClick: () => setUpdateNotificationsEnabled(false) }
        ]
      });
    });
  });
}
