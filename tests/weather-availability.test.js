import test from 'node:test';
import assert from 'node:assert/strict';
import { createAvailability, anyAutoAvailable, AVAILABILITY_TTL_S } from '../src/weather/availability.js';
import { minToS, sToMs } from '../src/quantity.js';

const svc = (id, host) => ({ id, probe: { url: `https://${host}/probe` } });
const A = svc('a', 'one.test'), B = svc('b', 'two.test'), C = svc('c', 'one.test');   // c shares a's host

function setup(answers = {}) {
  const calls = [];
  const clock = { t: 1e12 };
  const probe = async (url) => { calls.push(url); await Promise.resolve(); return { state: answers[new URL(url).host] ?? 'available' }; };
  return { calls, clock, av: createAvailability({ probe, now: () => clock.t }) };
}

test('the result is valid for 30 minutes; a later check asks again; never checked reads as unknown', async () => {
  assert.equal(AVAILABILITY_TTL_S, minToS(30));
  const { av, calls, clock } = setup();
  assert.deepEqual(av.get(A), { state: 'unknown', checkedAt: null });
  await av.check([A]);
  assert.equal(av.get(A).state, 'available'); assert.equal(av.get(A).checkedAt, clock.t);
  await av.check([A]);                                    // still valid: no request
  assert.equal(calls.length, 1);
  clock.t += sToMs(minToS(29));
  await av.check([A]); assert.equal(calls.length, 1);
  clock.t += sToMs(minToS(2));                            // 31 minutes
  assert.equal(av.get(A).state, 'unknown');
  await av.check([A]); assert.equal(calls.length, 2);
  assert.equal(av.get(A).state, 'available');
});

test('force asks again at once, for every given service', async () => {
  const { av, calls } = setup();
  await av.check([A, B]);
  assert.equal(calls.length, 2);
  await av.check([A, B], { force: true });
  assert.equal(calls.length, 4);
});

test('services on one host share one request and one result', async () => {
  const { av, calls } = setup({ 'one.test': 'unreachable' });
  await av.check([A, B, C]);
  assert.equal(calls.length, 2);                          // one.test once, two.test once
  assert.equal(av.get(A).state, 'unreachable'); assert.equal(av.get(C).state, 'unreachable'); assert.equal(av.get(B).state, 'available');
});

test('checking state is visible while a request is out, listeners are told, and a second check joins the first', async () => {
  const { av, calls } = setup();
  const seen = [];
  const off = av.onChange(() => seen.push(av.get(A).state));
  const first = av.check([A]);
  assert.equal(av.get(A).state, 'checking');
  const second = av.check([A], { force: true });         // joins the request in flight
  await Promise.all([first, second]);
  assert.equal(calls.length, 1);
  assert.deepEqual(seen, ['checking', 'available']);
  off();
  await av.check([A], { force: true });
  assert.deepEqual(seen, ['checking', 'available']);
});

test('unreachable and busy services are not reachable; unknown, checking and available are', async () => {
  const { av } = setup({ 'two.test': 'busy', 'one.test': 'unreachable' });
  assert.equal(av.isReachable(A), true);                  // never checked: assumed reachable
  const pending = av.check([A, B]);
  assert.equal(av.isReachable(A), true);                  // checking
  await pending;
  assert.equal(av.isReachable(A), false); assert.equal(av.isReachable(B), false);
  const { av: ok } = setup(); await ok.check([A]);
  assert.equal(ok.isReachable(A), true);
});

test('a thrown probe counts as unreachable; the result expires back to "assumed reachable"', async () => {
  const clock = { t: 5e11 };
  const av = createAvailability({ probe: async () => { throw new Error('boom'); }, now: () => clock.t });
  await av.check([A]);
  assert.equal(av.get(A).state, 'unreachable'); assert.equal(av.isReachable(A), false);
  clock.t += sToMs(AVAILABILITY_TTL_S) + 1;
  assert.equal(av.isReachable(A), true);
});

test('anyAutoAvailable: needs an Auto service that is not known to be unreachable', async () => {
  const { av } = setup({ 'one.test': 'unreachable' });
  const modes = { a: 'auto', b: 'off', c: 'auto' };
  const modeOf = (s) => modes[s.id];
  assert.equal(anyAutoAvailable([A, B, C], modeOf, av), true);     // nothing checked yet
  await av.check([A, B, C]);
  assert.equal(anyAutoAvailable([A, B, C], modeOf, av), false);    // a and c unreachable, b is Off
  modes.b = 'auto';
  assert.equal(anyAutoAvailable([A, B, C], modeOf, av), true);
  assert.equal(anyAutoAvailable([A, B, C], () => 'off', av), false);
});

test('forgetAll drops every result (and tells listeners)', async () => {
  const { av } = setup();
  await av.check([A]);
  let told = 0; av.onChange(() => told++);
  av.forgetAll();
  assert.equal(av.get(A).state, 'unknown'); assert.equal(told, 1);
});
