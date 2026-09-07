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
import { logDiagnostic } from './debug-log.js';
import { rebuildOfflineCache } from './diagnostics.js';
import {
  isUpdateNotificationsEnabled, setUpdateNotificationsEnabled,
  getLastSeenVersion, setLastSeenVersion,
  getServiceWorkerRebuiltVersion, setServiceWorkerRebuiltVersion
} from './update-notification-prefs.js';

// checkBootVersionChange()'s own CACHE_VERSION-vs-lastSeen comparison is a
// plain page-load value, entirely independent of the service worker's own
// unreliable sense of whether it's changed (see service-worker.js's own
// header comment: its update() byte-compare only looks at its own script
// text, never at what it imports, so a CACHE_VERSION-only release change
// like every one of this app's real releases is never noticed there —
// confirmed to reliably throw "ServiceWorker cannot be started" instead).
// So on a genuine version change, this proactively rebuilds the service
// worker/cache itself, in two passes rather than one, both required:
//
//  Pass 1 (the boot that first notices lastSeen != CACHE_VERSION): tears
//  down the previous release's registration/cache and reloads via
//  rebuildOfflineCache() — silently, no dialog, lastSeen left untouched.
//  Confirmed empirically that this needs the reload: unregistering and
//  re-registering live in an already-loaded page, without an intervening
//  navigation, leaves a worker reporting "activated" with an *empty*
//  cache and no error — the browser's install/precache pipeline doesn't
//  run correctly without a real navigation boundary. Returning `true`
//  tells app.js's caller to stop there for this boot — registering the
//  service worker again in the brief window before the pending reload
//  actually takes effect would race rebuildOfflineCache()'s own teardown
//  and reproduce the exact same broken state.
//
//  Pass 2 (the reload Pass 1 triggered): CACHE_VERSION is unchanged from
//  Pass 1, so the naive comparison still looks like a version change —
//  getServiceWorkerRebuiltVersion() is what tells this pass "already
//  handled," so it skips straight to the normal path: show the "what's
//  new" dialog (if enabled) and record lastSeen, exactly as before this
//  whole rebuild mechanism existed. Splitting the dialog out from the
//  rebuild this way is deliberate, not incidental — showing it on Pass 1
//  would have it torn down mid-display by the reload a moment later.
export async function checkBootVersionChange() {
  const lastSeen = getLastSeenVersion();
  const isVersionChange = lastSeen !== null && lastSeen !== CACHE_VERSION;

  // A version change can be *seen* while online (the new script/imports
  // came from the previous, still-registered worker's network-first fetch
  // — see service-worker.js's own header comment) and then lose
  // connectivity moments later, before rebuildOfflineCache()'s reload
  // finishes re-fetching everything it just tore down. Deferring the
  // *entire* comparison (not just the rebuild) is deliberate: also
  // holding back setLastSeenVersion()/the dialog means this exact boot
  // doesn't burn its one shot at handling the transition on a boot that
  // couldn't safely act on it — the next boot, online or not, sees the
  // same "changed" comparison and gets a real chance.
  if (isVersionChange && !navigator.onLine) return false;

  if (isVersionChange && getServiceWorkerRebuiltVersion() !== CACHE_VERSION) {
    try {
      setServiceWorkerRebuiltVersion(CACHE_VERSION);
      logDiagnostic('log', `[boot] version changed (${lastSeen} -> ${CACHE_VERSION}), rebuilding service worker before continuing this boot`);
      await rebuildOfflineCache();
      return true; // reloading — nothing else this boot should touch the service worker
    } catch (err) {
      // Best-effort, same as every other service-worker-adjacent failure
      // in this app: fall through to the normal path below instead of a
      // broken boot — worst case this load falls back to the old reactive
      // update()-failure recovery, and the next real release gets another
      // attempt since setServiceWorkerRebuiltVersion() only marks *this*
      // CACHE_VERSION as attempted, not future ones.
      logDiagnostic('error', '[boot] failed to rebuild service worker on version change:', err);
    }
  }

  // Bookkeeping updates regardless of whether the dialog actually shows
  // (notifications off, or nothing changed) — so a later re-enable of the
  // setting doesn't surface a stale, possibly multi-version-old jump.
  setLastSeenVersion(CACHE_VERSION);

  if (isVersionChange && isUpdateNotificationsEnabled()) {
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
  return false;
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
