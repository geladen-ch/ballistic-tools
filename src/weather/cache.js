// Key/value cache with TTL, for station lists (90 days), network indexes (30 days), learned extents (1 year), current
// values (10 minutes), per-station report history and the last result. Own IndexedDB database (a lost cache costs a
// download, never user data), with an in-memory mirror and an in-memory fallback when IndexedDB is unavailable
// (private mode, blocked storage). TTLs are in seconds; wall-clock stamps are epoch milliseconds.
import { openDatabase, getRecord, put, deleteRecord, getAllKeys } from '../db.js';
import { sToMs, msToS } from '../quantity.js';

export const WEATHER_DB_NAME = 'ballistics-weather-cache';
const STORE = 'kv';

/** @returns {import('./sources/types.js').SourceContext['cache']} */
export function createMemoryCache(now = () => Date.now()) {
  const map = new Map();
  const live = (e) => e && (e.expires === Infinity || e.expires > now());
  return {
    async get(key) { const e = map.get(key); return live(e) ? e.value : undefined; },
    async set(key, value, ttlS = Infinity) {
      map.set(key, { value, storedAt: now(), expires: ttlS === Infinity ? Infinity : now() + sToMs(ttlS) });
    },
    async info(key) { const e = map.get(key); return live(e) ? { storedAt: e.storedAt } : null; },
    async delete(key) { map.delete(key); },
    async clear() { map.clear(); },
  };
}

/**
 * Persistent TTL cache on IndexedDB; same interface as createMemoryCache. Every IndexedDB failure silently degrades to
 * the in-memory map, so callers never see storage errors.
 */
export function createWeatherCache({ dbName = WEATHER_DB_NAME, now = () => Date.now() } = {}) {
  const mem = createMemoryCache(now);
  if (typeof indexedDB === 'undefined') return mem;
  const live = (e) => e && (e.expires == null || e.expires > now());
  let dbp = null;
  const open = () => (dbp ??= openDatabase({ name: dbName, version: 1, stores: [{ name: STORE, keyPath: 'key' }] }).catch(() => null));
  async function db(fn) {
    const d = await open();
    if (!d) return { ok: false };
    try { return { ok: true, value: await fn(d) }; } catch { return { ok: false }; }
  }
  const storedAt = new Map();                            // key → time the value was first stored (survives reloads)
  async function load(key) {                              // true if the key is live (mirror warmed from IndexedDB)
    if (await mem.info(key)) return true;
    const r = await db((d) => getRecord(d, STORE, key));
    if (!r.ok || !r.value) return false;
    const e = r.value;
    if (!live(e)) { db((d) => deleteRecord(d, STORE, key)); return false; }
    await mem.set(key, e.value, e.expires == null ? Infinity : msToS(e.expires - now()));
    storedAt.set(key, e.storedAt);
    return true;
  }
  return {
    async get(key) { return (await load(key)) ? mem.get(key) : undefined; },
    async set(key, value, ttlS = Infinity) {
      const t = now();
      await mem.set(key, value, ttlS); storedAt.set(key, t);
      await db((d) => put(d, STORE, { key, value, storedAt: t, expires: ttlS === Infinity ? null : t + sToMs(ttlS) }));
    },
    async info(key) { return (await load(key)) ? { storedAt: storedAt.get(key) ?? (await mem.info(key)).storedAt } : null; },
    async delete(key) { await mem.delete(key); storedAt.delete(key); await db((d) => deleteRecord(d, STORE, key)); },
    /** Remove everything (Settings → clear weather cache). */
    async clear() {
      await mem.clear(); storedAt.clear();
      const keys = await db((d) => getAllKeys(d, STORE));
      if (keys.ok) for (const k of keys.value) await db((d) => deleteRecord(d, STORE, k));
    },
  };
}
