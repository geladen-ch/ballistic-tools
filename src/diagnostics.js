// Self-service troubleshooting: a snapshot of everything that tends to
// explain "why doesn't this work offline" — app version, live service
// worker/cache state cross-referenced against what should be cached,
// storage quota, and this session's own boot/loading log — bundled into
// one downloadable file a user can attach to a bug report. See
// home-view.js's Troubleshooting card for the download trigger.
import { CACHE_VERSION, RELEASE_ID, CODENAME_SHORT, CODENAME_LONG } from './version.js';
import { downloadFile } from './download.js';
import { getDiagnosticLog } from './debug-log.js';
import { loadBulletLibraries, bulletLibraryForBullet } from './bullets.js';
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

function bulletUrl(id) {
  const lib = bulletLibraryForBullet(id);
  return lib
    ? new URL(`./bullets/${lib.id}/${id}.json`, import.meta.url).href
    : new URL(`./bullets/${id}.json`, import.meta.url).href;
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
      missingBullets: missingIds(loadBulletLibraries().flatMap((lib) => lib.ids), cachedUrls, bulletUrl),
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
    log: getDiagnosticLog()
  };
}

export async function downloadDiagnostics() {
  const report = await collectDiagnostics();
  const isoStamp = report.generatedAt.replace(/[:.]/g, '-');
  downloadFile(`geladen-diagnostics-${CACHE_VERSION}-${isoStamp}.json`, JSON.stringify(report, null, 2), 'application/json');
}
