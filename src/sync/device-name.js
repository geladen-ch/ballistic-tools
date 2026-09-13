// A human-friendly, editable device label, separate from the opaque
// deviceId (device-id.js) which is never shown to the user. Defaults to a
// coarse guess parsed from navigator.userAgent ("Safari on iPhone",
// "Chrome on Windows") until the user overrides it — see
// docs/plans/backup-sync.md's Phase 2 "Device name" for why Phase 6's
// Settings UI nudges the user to actually change it (two similar devices,
// e.g. two iPhones, default to an identical-looking guess).
//
// Stored as `{ name, modifiedAt }` under one localStorage key rather than
// two, since the record travels as a single `device: { id, name,
// modifiedAt }` block in the sync bundle (Phase 3) and merges through the
// same newer-modifiedAt-wins rule as every other record (Phase 4) — it
// needs its own modifiedAt the moment it's user-edited, not just a name.
const DEVICE_NAME_KEY = 'ballistics_device_name_v1';

function guessDeviceName() {
  const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || '';

  let browser = 'Browser';
  if (/Edg\//.test(ua)) browser = 'Edge';
  else if (/OPR\//.test(ua)) browser = 'Opera';
  else if (/Firefox\//.test(ua)) browser = 'Firefox';
  else if (/CriOS\//.test(ua)) browser = 'Chrome';
  else if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) browser = 'Chrome';
  else if (/Safari\//.test(ua)) browser = 'Safari';

  let platform = 'Device';
  if (/iPhone/.test(ua)) platform = 'iPhone';
  else if (/iPad/.test(ua)) platform = 'iPad';
  else if (/Android/.test(ua)) platform = 'Android';
  else if (/Mac OS X/.test(ua)) platform = 'Mac';
  else if (/Windows/.test(ua)) platform = 'Windows';
  else if (/Linux/.test(ua)) platform = 'Linux';

  return `${browser} on ${platform}`;
}

function loadRecord() {
  try {
    const raw = localStorage.getItem(DEVICE_NAME_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed.name === 'string' ? parsed : null;
  } catch {
    return null;
  }
}

// True once the user has actually set a name (or one was merged in from a
// peer's device block) — false while still on the UA-derived guess. Phase
// 6 uses this to decide whether to show the "give this device a name"
// nudge.
export function hasCustomDeviceName() {
  return loadRecord() !== null;
}

export function getDeviceName() {
  const record = loadRecord();
  return record ? record.name : guessDeviceName();
}

// null until the user (or a merge) has actually stamped this record —
// the UA-derived default has no authoring time, so there's nothing
// meaningful to compare it against in a merge.
export function getDeviceNameModifiedAt() {
  const record = loadRecord();
  return record ? record.modifiedAt : null;
}

// Guarantees a stamped device-name record exists, creating one from the
// UA-derived guess (with modifiedAt = now) the first time anything needs
// to publish this device's identity (the sync bundle, Phase 3) — a device
// record with no modifiedAt at all has nothing meaningful to compare
// against in a merge (Phase 4), so this establishes it exactly once,
// lazily, rather than requiring every caller to special-case "never set".
export function ensureDeviceNameRecord() {
  return loadRecord() || setDeviceName(guessDeviceName());
}

export function setDeviceName(name, { modifiedAt } = {}) {
  const record = { name, modifiedAt: modifiedAt || new Date().toISOString() };
  try {
    localStorage.setItem(DEVICE_NAME_KEY, JSON.stringify(record));
  } catch {
    // storage full/disabled — best-effort, same posture as prefs.js
  }
  return record;
}
