import test from 'node:test';
import assert from 'node:assert/strict';
import { whenClinometerAvailabilityKnown, resetClinometerAvailability } from '../src/clinometer-availability.js';

// A minimal browser surface: one event target, a secure context, a camera API.
function installBrowser({ secure = true, camera = true, iosPermission = false, touchPoints = 5 } = {}) {
  const handlers = {};
  globalThis.window = {
    addEventListener(type, fn) { (handlers[type] ||= []).push(fn); },
    removeEventListener(type, fn) { handlers[type] = (handlers[type] || []).filter((h) => h !== fn); }
  };
  globalThis.isSecureContext = secure;
  Object.defineProperty(globalThis, 'navigator', {
    value: { maxTouchPoints: touchPoints, mediaDevices: camera ? { getUserMedia: async () => ({}) } : undefined },
    configurable: true
  });
  globalThis.DeviceOrientationEvent = iosPermission ? { requestPermission: async () => 'granted' } : function DeviceOrientationEvent() {};
  globalThis.DeviceMotionEvent = function DeviceMotionEvent() {};
  return { fire: (type, evt) => (handlers[type] || []).slice().forEach((fn) => fn(evt)), handlers };
}

function known() {
  return new Promise((resolve) => whenClinometerAvailabilityKnown(resolve));
}

test.afterEach(() => resetClinometerAvailability());

test('a real orientation reading makes the clinometer available', async () => {
  const browser = installBrowser();
  const result = known();
  browser.fire('deviceorientation', { alpha: null, beta: null, gamma: null }); // what a desktop sends
  browser.fire('deviceorientation', { alpha: 10, beta: 85, gamma: 2 });
  assert.equal(await result, true);
  assert.equal((browser.handlers.deviceorientation || []).length, 0); // the probe stopped listening
});

test('a gravity reading counts too', async () => {
  const browser = installBrowser();
  const result = known();
  browser.fire('devicemotion', { accelerationIncludingGravity: { x: 0, y: 9.8, z: 0.2 } });
  assert.equal(await result, true);
});

test('iOS Safari, whose events wait for a permission tap, is taken as available', async () => {
  installBrowser({ iosPermission: true });
  assert.equal(await known(), true);
});

test('no secure context or no camera API: never available', async () => {
  installBrowser({ secure: false });
  assert.equal(await known(), false);
  resetClinometerAvailability();
  installBrowser({ camera: false });
  assert.equal(await known(), false);
});

test('once known, later callers get the answer straight away', async () => {
  const browser = installBrowser();
  const first = known();
  browser.fire('deviceorientation', { alpha: 0, beta: 90, gamma: 0 });
  await first;
  let got = null;
  whenClinometerAvailabilityKnown((v) => { got = v; });
  assert.equal(got, true);
});
