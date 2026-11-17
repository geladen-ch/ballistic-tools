import test from 'node:test';
import assert from 'node:assert/strict';
import { createNet } from '../src/weather/net.js';
import { createMemoryCache, createWeatherCache } from '../src/weather/cache.js';
import { installFakeIndexedDb } from './helpers/fake-dom.js';

const res = (status, body, headers = {}) => new Response(body, { status, headers });

test('net: per-host spacing serialises requests', async () => {
  const t = [];
  const net = createNet({ spacingMs: { 'a.test': 120 }, fetchImpl: async () => { t.push(Date.now()); return res(200, '{}'); } });
  await Promise.all([net.getJSON('https://a.test/1'), net.getJSON('https://a.test/2'), net.getJSON('https://a.test/3')]);
  assert.ok(t[1] - t[0] >= 110 && t[2] - t[1] >= 110, `gaps ${t[1] - t[0]}, ${t[2] - t[1]}`);
});

test('net: 429/503 "Too many requests" → throttled error, host blocked, Retry-After honoured', async () => {
  let calls = 0;
  const net = createNet({ fetchImpl: async () => { calls++; return res(503, 'Too many requests from your IP address, slow down.', { 'Retry-After': '120' }); } });
  let e1; try { await net.getJSON('https://b.test/x'); } catch (e) { e1 = e; }
  assert.equal(e1?.kind, 'throttled'); assert.equal(e1?.retryAfterS, 120); assert.equal(e1?.host, 'b.test');
  let e2; try { await net.getJSON('https://b.test/y'); } catch (e) { e2 = e; }
  assert.equal(e2?.kind, 'throttled');
  assert.equal(calls, 1);                              // second request was not sent
});

test('net: HTTP error and invalid JSON', async () => {
  const net = createNet({ fetchImpl: async (u) => (u.endsWith('404') ? res(404, 'nope') : res(200, 'not json')) });
  let e; try { await net.getJSON('https://c.test/404'); } catch (x) { e = x; }
  assert.equal(e?.status, 404);
  try { await net.getJSON('https://c.test/ok'); } catch (x) { e = x; }
  assert.equal(e?.kind, 'parse');
});

test('net: a failing fetch is a network error; a timeout is a timeout', async () => {
  const net = createNet({ fetchImpl: async () => { throw new TypeError('Failed to fetch'); } });
  await assert.rejects(net.getJSON('https://d.test/x'), (e) => e.kind === 'network' && e.host === 'd.test');
  const slow = createNet({ timeoutMs: 20, fetchImpl: (_u, { signal }) => new Promise((_r, rej) => signal.addEventListener('abort', () => rej(new Error('aborted')))) });
  await assert.rejects(slow.getJSON('https://e.test/x'), (e) => e.kind === 'timeout');
});

test('net.probe: 2xx is available (body cancelled), 5xx and failures unreachable, 429 busy; never throws', async () => {
  let cancelled = 0;
  const body = { cancel: async () => { cancelled++; } };
  const mk = (status) => ({ status, ok: status >= 200 && status < 300, headers: new Headers(), body });
  const net = createNet({ fetchImpl: async (u) => (u.endsWith('/ok') ? mk(200) : u.endsWith('/err') ? mk(500) : u.endsWith('/busy') ? mk(429) : Promise.reject(new TypeError('cors'))) });
  assert.deepEqual(await net.probe('https://p.test/ok'), { state: 'available', status: 200 });
  assert.equal(cancelled, 1);
  assert.equal((await net.probe('https://p.test/err')).state, 'unreachable');
  assert.equal((await net.probe('https://p.test/gone')).state, 'unreachable');
  assert.equal((await net.probe('https://p.test/busy')).state, 'busy');
  assert.equal((await net.probe('https://p.test/ok')).state, 'busy', 'the host is rate-limited now');
});

test('cache: TTL expiry (memory)', async () => {
  let now = 1000;
  const s = createMemoryCache(() => now);
  await s.set('k', 1, 10);
  assert.equal(await s.get('k'), 1);
  now += 11000;
  assert.equal(await s.get('k'), undefined);
});

test('cache: IndexedDB-backed values survive a new instance (restart), expire, clear', async () => {
  installFakeIndexedDb();
  let now = 5000;
  const a = createWeatherCache({ dbName: 'weather-test', now: () => now });
  await a.set('list', { n: 1 }, 100);
  await a.set('forever', 'x');
  const b = createWeatherCache({ dbName: 'weather-test', now: () => now });
  assert.deepEqual(await b.get('list'), { n: 1 });
  assert.equal(await b.get('forever'), 'x');
  assert.ok((await b.info('list')).storedAt === 5000);
  now += 101000;
  const c = createWeatherCache({ dbName: 'weather-test', now: () => now });
  assert.equal(await c.get('list'), undefined);
  assert.equal(await c.get('forever'), 'x');
  await c.clear();
  const d = createWeatherCache({ dbName: 'weather-test', now: () => now });
  assert.equal(await d.get('forever'), undefined);
});

test('net: a `parallel` download does not hold the host queue', async () => {
  let releaseBig;
  const order = [];
  const net = createNet({
    spacingMs: { 'big.test': 10 },
    fetchImpl: async (u) => {
      if (u.endsWith('/big')) { await new Promise((r) => { releaseBig = r; }); order.push('big'); return res(200, '{}'); }
      order.push('small'); return res(200, '{}');
    },
  });
  const big = net.getJSON('https://big.test/big', { parallel: true });
  await net.getJSON('https://big.test/small-1');
  await net.getJSON('https://big.test/small-2');
  assert.deepEqual(order, ['small', 'small'], 'the small ones went past the slow one');
  releaseBig();
  await big;
  assert.deepEqual(order, ['small', 'small', 'big']);
  // without it the second request waits for the first
  const t = [];
  const serial = createNet({ fetchImpl: async () => { t.push('a'); await new Promise((r) => setTimeout(r, 30)); t.push('b'); return res(200, '{}'); } });
  await Promise.all([serial.getJSON('https://s.test/1'), serial.getJSON('https://s.test/2')]);
  assert.deepEqual(t, ['a', 'b', 'a', 'b']);
});
