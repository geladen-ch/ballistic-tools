// Self-service troubleshooting: a snapshot of everything that tends to
// explain "why doesn't this work offline" — app version, live service
// worker/cache state cross-referenced against what should be cached,
// storage quota, and this session's own boot/loading log — bundled into
// one downloadable file a user can attach to a bug report. Also the one
// self-repair action available here: rebuildOfflineCache() below, for
// when a stuck registration or stale cache is the actual problem, not
// just something to report. See home-view.js's Troubleshooting card for
// both triggers.
import { CACHE_VERSION, RELEASE_ID, CODENAME_SHORT, CODENAME_LONG } from './version.js';
import { downloadFile } from './download.js';
import { getDiagnosticLog, logDiagnostic } from './debug-log.js';
import { loadBulletLibraries } from './bullets.js';
import { loadRifleCatalog } from './rifles.js';
import { loadTargetCatalog } from './targets.js';
import { loadUserBullets, loadUserRifles } from './user-library.js';
import { loadUserLocations } from './location-library.js';
import { loadRiflePrecisionProjects } from './rifle-precision-library.js';
import { openDatabase } from './db.js';
import { DB_NAME, DB_VERSION, STORES } from './db-schema.js';

// Pure and browser-API-free on purpose — the one part of this module
// `node --test` can actually exercise. `urlForId` and `cachedUrlSet` are
// injected rather than this reaching into caches.* itself, so the id/url
// matching logic is testable independent of a real Cache Storage.
export function missingIds(catalogIds, cachedUrlSet, urlForId) {
  return catalogIds.filter((id) => !cachedUrlSet.has(urlForId(id)));
}

// One cache entry covers a whole library now (see bullets.js's
// loadLibraryRecords()), so coverage is checked per library id, not per
// bullet id — see its call site below.
function bulletLibraryUrl(libId) {
  return new URL(`./bullets/${libId}/bullets.json`, import.meta.url).href;
}

function rifleUrl(id) {
  return new URL(`./rifles/${id}.json`, import.meta.url).href;
}

function targetUrl(id) {
  return new URL(`./targets/${id}.json`, import.meta.url).href;
}

async function collectEnvironment() {
  const isStandalone = (typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches)
    || navigator.standalone === true; // iOS Safari's own non-standard flag
  return {
    userAgent: navigator.userAgent,
    language: navigator.language,
    languages: navigator.languages,
    onLine: navigator.onLine,
    platform: navigator.platform,
    standalone: isStandalone,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
  };
}

async function collectServiceWorkerAndCache() {
  if (!('serviceWorker' in navigator)) {
    return { supported: false };
  }

  const registrations = await navigator.serviceWorker.getRegistrations();
  const result = {
    supported: true,
    controlled: !!navigator.serviceWorker.controller,
    registrations: registrations.map((reg) => {
      const worker = reg.active || reg.installing || reg.waiting;
      return {
        scope: reg.scope,
        worker: worker ? { state: worker.state, scriptURL: worker.scriptURL } : null
      };
    })
  };

  if (!('caches' in window)) {
    result.cacheStorage = { supported: false };
    return result;
  }

  const cacheNames = await caches.keys();
  const expectedCacheName = `ballistics-tools-${CACHE_VERSION}`;
  const cacheEntryCounts = {};
  for (const name of cacheNames) {
    const cache = await caches.open(name);
    cacheEntryCounts[name] = (await cache.keys()).length;
  }

  let currentCacheGaps = null;
  if (cacheNames.includes(expectedCacheName)) {
    const cache = await caches.open(expectedCacheName);
    const cachedUrls = new Set((await cache.keys()).map((req) => req.url));
    currentCacheGaps = {
      missingBulletLibraries: missingIds(loadBulletLibraries().map((lib) => lib.id), cachedUrls, bulletLibraryUrl),
      missingRifles: missingIds(loadRifleCatalog(), cachedUrls, rifleUrl),
      missingTargets: missingIds(loadTargetCatalog(), cachedUrls, targetUrl)
    };
  }

  result.cacheStorage = {
    supported: true,
    expectedCacheName,
    cacheNames,
    entriesPerCache: cacheEntryCounts,
    currentCacheGaps // null if the expected cache for this exact version doesn't exist at all
  };
  return result;
}

async function collectStorageEstimate() {
  if (!navigator.storage?.estimate) return { supported: false };
  const { usage, quota } = await navigator.storage.estimate();
  return { supported: true, usageBytes: usage, quotaBytes: quota };
}

// Read-only-in-spirit open probe (no upgrade should ever actually run here
// in practice — DB_VERSION matches what the app itself already opened at
// boot) purely to confirm IndexedDB itself is reachable on this device.
async function collectIndexedDb() {
  if (!('indexedDB' in window)) return { supported: false };
  try {
    const db = await openDatabase({ name: DB_NAME, version: DB_VERSION, stores: STORES });
    db.close();
    return { supported: true, ok: true };
  } catch (err) {
    return { supported: true, ok: false, error: String(err && err.message || err) };
  }
}

// Counts only, deliberately — this app's own privacy card says "we do not
// collect any data"; a diagnostics file is local-only and never sent
// anywhere by the app itself, but it's still something a user might paste
// into a public support forum, so actual location names/coordinates or
// bullet/rifle specs stay out of it.
function collectUserDataCounts() {
  return {
    locations: loadUserLocations().length,
    customBullets: loadUserBullets().length,
    customRifles: loadUserRifles().length,
    riflePrecisionProjects: loadRiflePrecisionProjects().length
  };
}

export async function collectDiagnostics() {
  const [environment, serviceWorker, storageEstimate, indexedDb] = await Promise.all([
    collectEnvironment(),
    collectServiceWorkerAndCache(),
    collectStorageEstimate(),
    collectIndexedDb()
  ]);

  return {
    generatedAt: new Date().toISOString(),
    app: { cacheVersion: CACHE_VERSION, releaseId: RELEASE_ID, codenameShort: CODENAME_SHORT, codenameLong: CODENAME_LONG },
    environment,
    serviceWorker,
    storageEstimate,
    indexedDb,
    userData: collectUserDataCounts(),
    autoRecovery: readAutoRecoveryMarker(),
    log: getDiagnosticLog()
  };
}

export async function downloadDiagnostics() {
  const report = await collectDiagnostics();
  const isoStamp = report.generatedAt.replace(/[:.]/g, '-');
  downloadFile(`geladen-diagnostics-${CACHE_VERSION}-${isoStamp}.json`, JSON.stringify(report, null, 2), 'application/json');
}

// Unregistering rather than just calling update() is the point: a browser
// that's gotten a service worker registration or Cache Storage into a
// stuck state (see the "ServiceWorker cannot be started" failures this
// was added for) needs that state torn down, not asked nicely to refresh
// itself. IndexedDB (locations, arsenal, rifle precision projects) lives
// outside both APIs and is untouched. The reload after is not optional —
// confirmed empirically (see update-notifications.js's own
// checkBootVersionChange(), which depends on this) that unregistering and
// re-registering live within an already-loaded page, without an
// intervening navigation, leaves the new worker "activated" with an
// empty cache and no error at all: the install/precache pipeline simply
// doesn't run correctly without a real navigation boundary. The reload is
// what actually gives the browser a fresh client to install the new
// worker against, and is what re-registers it and repopulates the cache,
// via the normal boot path in app.js.
export async function rebuildOfflineCache() {
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((reg) => reg.unregister()));
  }
  if ('caches' in window) {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((name) => caches.delete(name)));
  }
  location.reload();
}

const AUTO_REBUILD_GUARD_KEY = 'ballistics_auto_rebuild_attempted_v1';

// Best-effort self-repair for app.js's service worker register()/update()
// failures — deliberately narrow, since a blanket "reload on any
// failure" trades one bug for two worse ones:
// (1) those calls also throw when the browser is plainly offline (no
// network to fetch service-worker.js), and wiping the very cache an
// offline user is relying on right before a reload with nothing to
// repopulate from would strip their offline access instead of fixing
// anything — so this only ever matches the specific "cannot be started"
// stuck-registration signature, never a generic failure, and never while
// navigator.onLine is false.
// (2) if the underlying cause isn't something a cache/registration wipe
// can fix, reloading just reproduces the same failure — so this fires at
// most once per browser session (a sessionStorage marker checked, and
// set, before rebuildOfflineCache() ever runs); a second failure this
// session falls through to the normal silent log instead of looping.
export function attemptAutoRecovery(err) {
  const message = String((err && err.message) || err || '');
  if (!/cannot be started/i.test(message)) return false;
  if (!navigator.onLine) return false;
  const attemptedAt = new Date().toISOString();
  try {
    if (sessionStorage.getItem(AUTO_REBUILD_GUARD_KEY)) return false;
    // A timestamp rather than a plain flag — rebuildOfflineCache() reloads
    // the page immediately after, which wipes debug-log.js's in-memory
    // log along with it, so this sessionStorage marker (which survives
    // the reload) is the only trace left of an attempt having happened.
    // readAutoRecoveryMarker() below folds it back into the diagnostics
    // report so a user who downloads diagnostics *after* the reload still
    // sees that this fired, not just silence.
    sessionStorage.setItem(AUTO_REBUILD_GUARD_KEY, attemptedAt);
  } catch {
    // Storage unavailable (private browsing etc.) — can't guarantee the
    // one-shot guard, so don't risk a loop by acting anyway.
    return false;
  }
  logDiagnostic('log', `[boot] stuck service worker detected (${message}), attempting automatic offline-cache rebuild...`);
  rebuildOfflineCache();
  return true;
}

function readAutoRecoveryMarker() {
  try {
    const attemptedAt = sessionStorage.getItem(AUTO_REBUILD_GUARD_KEY);
    return attemptedAt ? { attempted: true, attemptedAt } : { attempted: false };
  } catch {
    return { attempted: false };
  }
}
