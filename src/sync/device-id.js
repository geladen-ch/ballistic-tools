// Persists a random, opaque identity for this installation — created once,
// never changes. Used to attribute tombstones (deletedBy, Phase 1) and,
// once the rest of docs/plans/backup-sync.md's Phase 2 lands, every
// library record's modifiedBy. Never shown to the user directly — see
// device-name.js for the human-friendly label that is.
const DEVICE_ID_KEY = 'ballistics_device_id_v1';

// Same scheme as user-library.js's own generateUserId — deliberately not
// crypto.randomUUID(): this is a single-user, single-device value with no
// need for cryptographic entropy, and the Web Crypto global isn't
// available in every test/runtime context this app's suite runs under.
function generateDeviceId() {
  return `device-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getDeviceId() {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = generateDeviceId();
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    // storage blocked/unavailable — fall back to a per-load id rather than
    // crash; tombstones/records still get a value, just not a stable one.
    return generateDeviceId();
  }
}
