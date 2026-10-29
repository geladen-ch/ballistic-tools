// Whether this device can measure an angle with its camera and tilt
// sensors — decides whether the camera clinometer's button is shown at
// all. There is no synchronous way to ask a browser whether it has the
// sensor: desktop browsers define the same event interfaces as phones and
// either never fire them or fire one event with null values. So this
// probes once per page load, on first use, and only reports `true` once
// a real reading has arrived.
//
// The one exception is iOS/iPadOS Safari: there the events carry nothing
// until the user grants motion access, which takes a tap — the button's
// own. That platform is recognised by its permission API on a touch
// device, and every such device has the sensor.
const PROBE_TIMEOUT_MS = 2000;

let state = null; // null = not probed yet, 'probing', true, false
const listeners = [];

function resolve(available) {
  if (state === true || state === false) return;
  state = available;
  listeners.splice(0).forEach((fn) => fn(available));
}

function startProbe() {
  state = 'probing';
  const w = globalThis.window;
  const nav = globalThis.navigator;
  if (!w || typeof w.addEventListener !== 'function' || !globalThis.isSecureContext ||
      !nav || !nav.mediaDevices || typeof nav.mediaDevices.getUserMedia !== 'function') {
    resolve(false);
    return;
  }
  const Orientation = globalThis.DeviceOrientationEvent;
  if (Orientation && typeof Orientation.requestPermission === 'function' && nav.maxTouchPoints > 0) {
    resolve(true);
    return;
  }
  if (!Orientation && !globalThis.DeviceMotionEvent) {
    resolve(false);
    return;
  }
  let timer = null;
  const finish = (available) => {
    w.removeEventListener('deviceorientation', onOrientation);
    w.removeEventListener('devicemotion', onMotion);
    if (timer !== null) clearTimeout(timer);
    resolve(available);
  };
  function onOrientation(evt) {
    if (evt && Number.isFinite(evt.beta) && Number.isFinite(evt.gamma)) finish(true);
  }
  function onMotion(evt) {
    const g = evt && evt.accelerationIncludingGravity;
    if (g && Number.isFinite(g.x) && Number.isFinite(g.y) && Number.isFinite(g.z) && Math.hypot(g.x, g.y, g.z) > 0) finish(true);
  }
  w.addEventListener('deviceorientation', onOrientation);
  w.addEventListener('devicemotion', onMotion);
  timer = setTimeout(() => finish(false), PROBE_TIMEOUT_MS);
}

// Calls `fn(available)` once, as soon as it is known (straight away when
// it already is).
export function whenClinometerAvailabilityKnown(fn) {
  if (state === true || state === false) {
    fn(state);
    return;
  }
  listeners.push(fn);
  if (state === null) startProbe();
}

// Tests only.
export function resetClinometerAvailability() {
  state = null;
  listeners.length = 0;
}
