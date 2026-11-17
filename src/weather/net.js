// fetch wrapper: timeout, AbortSignal, per-host serialisation with minimum spacing, 429/503 handling, and a
// reachability probe. Errors carry a `kind` the UI translates ('http' | 'network' | 'timeout' | 'throttled' | 'parse').
import { sToMs, msToS } from '../quantity.js';

export class NetError extends Error {
  constructor(message, { status = 0, url = '', host = '', retryAfterS = null, kind = 'http' } = {}) {
    super(message);
    this.name = 'NetError';
    Object.assign(this, { status, url, host, retryAfterS, kind });
  }
}

const SLOW_DOWN_REFUSE_MS = sToMs(15);     // refuse at once when the host asked us to wait longer than this
const DEFAULT_RETRY_AFTER_S = 60;

/**
 * @param {{timeoutMs?:number, spacingMs?:Record<string,number>, defaultSpacingMs?:number, fetchImpl?:typeof fetch,
 *          now?:()=>number}} [opts]   spacing and timeouts are wall-clock bookkeeping in milliseconds
 */
export function createNet({ timeoutMs = 30000, spacingMs = {}, defaultSpacingMs = 0, fetchImpl = globalThis.fetch?.bind(globalThis), now = () => Date.now() } = {}) {
  const queues = new Map();          // host -> {tail: Promise, last: number}
  const blockedUntil = new Map();    // host -> epoch ms (after 429/503)

  function schedule(host, task) {
    const q = queues.get(host) ?? { tail: Promise.resolve(), last: 0 };
    queues.set(host, q);
    const gap = spacingMs[host] ?? defaultSpacingMs;
    const run = q.tail.then(async () => {
      const wait = Math.max(q.last + gap, blockedUntil.get(host) ?? 0) - now();
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      try { return await task(); } finally { q.last = now(); }
    });
    q.tail = run.catch(() => {});
    return run;
  }

  /** Fetch with timeout and abort handling; resolves with the Response (headers received) or throws NetError. */
  async function send(url, host, { signal, timeoutMs: perRequestMs, headers } = {}) {
    const ctl = new AbortController();
    const onAbort = () => ctl.abort(signal.reason);
    signal?.addEventListener('abort', onAbort, { once: true });
    const timer = setTimeout(() => ctl.abort(new DOMException('timeout', 'TimeoutError')), perRequestMs ?? timeoutMs);
    try {
      return { res: await fetchImpl(url, { signal: ctl.signal, credentials: 'omit', ...(headers ? { headers } : {}) }), clear: () => clearTimeout(timer) };
    } catch {
      clearTimeout(timer);
      const timeout = ctl.signal.reason?.name === 'TimeoutError';
      throw new NetError(timeout ? `Timed out: ${host}` : `Network error: ${host}`, { url, host, kind: timeout ? 'timeout' : 'network' });
    } finally {
      signal?.removeEventListener('abort', onAbort);
    }
  }

  function noteThrottle(host, res) {
    const ra = Number(res.headers.get('Retry-After'));
    const sec = Number.isFinite(ra) && ra > 0 ? ra : DEFAULT_RETRY_AFTER_S;
    blockedUntil.set(host, now() + sToMs(sec));
    return sec;
  }

  function refuseIfBlocked(url, host) {
    const blocked = blockedUntil.get(host) ?? 0;
    if (blocked - now() > SLOW_DOWN_REFUSE_MS) {
      throw new NetError(`${host} asked us to slow down; retry after ${new Date(blocked).toLocaleTimeString()}`,
        { status: 429, url, host, retryAfterS: Math.ceil(msToS(blocked - now())), kind: 'throttled' });
    }
  }

  async function request(url, { signal, as = 'json', timeoutMs: perRequestMs, headers, encoding, parallel = false } = {}) {
    const host = new URL(url).host;
    refuseIfBlocked(url, host);
    // `parallel`: a rare, very large download (a station list kept for months) that must not hold the host's queue
    // for the minutes it can take; everything else on the host stays serialised.
    const run = parallel ? (task) => task() : (task) => schedule(host, task);
    return run(async () => {
      const { res, clear } = await send(url, host, { signal, timeoutMs: perRequestMs, headers });
      let body;
      try {
        // encoding: for servers that send no charset for non-UTF-8 text (e.g. MeteoSwiss metadata, ISO-8859-1)
        body = encoding ? new TextDecoder(encoding).decode(await res.arrayBuffer()) : await res.text();
      } catch {
        throw new NetError(`Network error: ${host}`, { url, host, kind: 'network' });
      } finally { clear(); }
      if (res.status === 429 || res.status === 503 || /too many requests/i.test(body.slice(0, 200))) {
        const sec = noteThrottle(host, res);
        throw new NetError(`${host} is rate-limiting requests (HTTP ${res.status}); try again in ${sec} s`,
          { status: res.status || 429, url, host, retryAfterS: sec, kind: 'throttled' });
      }
      if (!res.ok) throw new NetError(`HTTP ${res.status} from ${host}`, { status: res.status, url, host });
      if (as === 'text') return body;
      try { return JSON.parse(body); } catch { throw new NetError(`Invalid JSON from ${host}`, { status: res.status, url, host, kind: 'parse' }); }
    });
  }

  /**
   * Reachability probe: one GET of a small CORS-readable URL; success is any 2xx once the headers arrived, the body is
   * cancelled unread. Resolves with {state:'available'|'unreachable'|'busy', status}; never throws.
   */
  async function probe(url, { signal, timeoutMs: perRequestMs = 8000 } = {}) {
    const host = new URL(url).host;
    const blocked = blockedUntil.get(host) ?? 0;
    if (blocked > now()) return { state: 'busy', status: 429 };
    try {
      return await schedule(host, async () => {
        const { res, clear } = await send(url, host, { signal, timeoutMs: perRequestMs });
        try { await res.body?.cancel?.(); } catch { /* body already gone */ }
        clear();
        if (res.status === 429 || res.status === 503) { noteThrottle(host, res); return { state: 'busy', status: res.status }; }
        return res.ok ? { state: 'available', status: res.status } : { state: 'unreachable', status: res.status };
      });
    } catch {
      return { state: 'unreachable', status: 0 };
    }
  }

  return {
    getJSON: (url, o = {}) => request(url, { ...o, as: 'json' }),
    getText: (url, o = {}) => request(url, { ...o, as: 'text' }),
    probe,
  };
}
