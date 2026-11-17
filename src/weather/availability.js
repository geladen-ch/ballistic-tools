// Reachability of the weather services, checked only from Settings. A service is probed with one small request to its
// own host (adapter.probe.url); services sharing a host share the result. The result is remembered for 30 minutes and
// not at all across an app restart (memory only). A service that was never checked counts as reachable: only a check
// that found it unreachable or busy takes it out, so the tools offer Get weather straight after a restart.
import { minToS, sToMs } from '../quantity.js';

/** How long a check result stays valid. */
export const AVAILABILITY_TTL_S = minToS(30);

/**
 * @typedef {'unknown'|'checking'|'available'|'unreachable'|'busy'} AvailabilityState
 * @typedef {{state:AvailabilityState, checkedAt:number|null}} Availability
 */

const hostOf = (adapter) => new URL(adapter.probe.url).host;

/**
 * @param {{probe:(url:string)=>Promise<{state:'available'|'unreachable'|'busy'}>, now?:()=>number}} deps
 *   probe: the reachability probe of net.js
 */
export function createAvailability({ probe, now = () => Date.now() }) {
  const results = new Map();            // host → {state, checkedAt}
  const checking = new Map();           // host → Promise (a check in flight)
  const listeners = new Set();
  const notify = () => listeners.forEach((fn) => fn());
  const fresh = (r) => r && r.state !== 'checking' && now() - r.checkedAt < sToMs(AVAILABILITY_TTL_S);

  /** Current availability of one service. */
  function get(adapter) {
    const host = hostOf(adapter);
    if (checking.has(host)) return { state: 'checking', checkedAt: results.get(host)?.checkedAt ?? null };
    const r = results.get(host);
    return fresh(r) ? { ...r } : { state: 'unknown', checkedAt: null };
  }

  /**
   * Check services (one request per distinct host). Without `force`, hosts with a valid result are not asked again.
   * Resolves when every asked host has answered.
   */
  async function check(adapters, { force = false } = {}) {
    const hosts = new Map();
    for (const a of adapters) hosts.set(hostOf(a), a);
    const runs = [];
    let started = false;
    for (const [host, adapter] of hosts) {
      if (checking.has(host)) { runs.push(checking.get(host)); continue; }
      if (!force && fresh(results.get(host))) continue;
      const run = (async () => {
        let outcome;
        try { outcome = (await probe(adapter.probe.url)).state; } catch { outcome = 'unreachable'; }
        results.set(host, { state: outcome, checkedAt: now() });
      })().finally(() => { checking.delete(host); notify(); });
      checking.set(host, run);
      runs.push(run);
      started = true;
    }
    if (started) notify();               // the services are 'checking' now
    await Promise.all(runs);
  }

  /** Not known to be unreachable or busy (never checked counts as reachable). */
  function isReachable(adapter) {
    const { state } = get(adapter);
    return state !== 'unreachable' && state !== 'busy';
  }

  /** Subscribe to every change; returns the unsubscribe function. */
  function onChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  function forgetAll() {
    results.clear();
    notify();
  }

  return { get, check, isReachable, onChange, forgetAll };
}

/**
 * Is at least one service set to Auto and not known to be unreachable? `modeOf(adapter)` gives its mode.
 * With every Auto service checked and none available, the feature is unusable.
 */
export function anyAutoAvailable(adapters, modeOf, availability) {
  return adapters.some((a) => modeOf(a) === 'auto' && availability.isReachable(a));
}
