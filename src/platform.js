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

// iOS Safari zooms the page in whenever an input, select or textarea with
// text smaller than 16px gets focus, and leaves it zoomed. The app's form
// controls are deliberately compact, so instead of enlarging them, add
// maximum-scale=1 to the viewport on iOS only: iOS (since 10) ignores it
// for the user's own pinch-zoom but honors it for focus auto-zoom. Not
// applied elsewhere, because Android browsers honor maximum-scale for
// pinch-zoom too and would lock the user out of zooming.
export function suppressIOSFocusZoom() {
  if (!isIOS() || typeof document === 'undefined') return;
  const meta = document.querySelector('meta[name="viewport"]');
  if (!meta) return;
  const content = meta.getAttribute('content') || '';
  if (/maximum-scale/.test(content)) return;
  meta.setAttribute('content', content + ', maximum-scale=1');
}
