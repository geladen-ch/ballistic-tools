// Keeps the screen on while a field tool is showing (Range Solver, the
// camera clinometer). Resolves to the sentinel, or null where the API is
// missing or the request is refused.
export async function requestWakeLock() {
  if (!('wakeLock' in navigator)) return null;
  try {
    return await navigator.wakeLock.request('screen');
  } catch {
    // best-effort — low battery, backgrounded, or unsupported; not fatal
    return null;
  }
}
