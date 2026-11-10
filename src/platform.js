// What kind of device and launch surface the app is running on — for the
// few places where iOS behaves differently enough to matter (file export
// tiers, and how long the browser keeps this app's stored data).

// iPadOS 13+ reports as a Mac in its own User-Agent string, so touch
// support is the actual tell — a real Mac reports 0 touch points.
export function isIOS() {
  const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  return /Macintosh/.test(ua) && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1;
}

// Launched from a Home Screen icon (an installed web app) rather than in a
// browser tab. `navigator.standalone` is Apple's own flag; the
// display-mode query is the standard one and depends on the manifest's
// "display": "standalone". A page inside another app's built-in browser
// (a link tapped in a messenger) reads as a tab here, correctly so: its
// storage is the least durable of all.
export function isHomeScreenApp() {
  if (typeof navigator !== 'undefined' && navigator.standalone === true) return true;
  try {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      && window.matchMedia('(display-mode: standalone)').matches;
  } catch {
    return false;
  }
}
