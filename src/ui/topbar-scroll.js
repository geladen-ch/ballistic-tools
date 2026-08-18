// Collapses the top bar (hides the tagline, tightens padding — see
// .app-topbar.collapsed in layout.css) once the page has scrolled away
// from the very top, and restores it back at the top — on both desktop
// and mobile, since the whole app scrolls at the window level (only
// #app-rail has its own independent scroll region) and the bar carries
// no navigational controls of its own to protect, just the brand and the
// language/display-mode switches.
//
// Also publishes the bar's own live rendered height as --topbar-height —
// the landscape-mobile tab bar (see layout.css) docks to the right edge
// as a fixed, viewport-relative strip, and needs to start below this
// (sticky, in-flow) bar rather than under it; the height isn't a fixed
// number (it shrinks when collapsed, and varies by language/font
// metrics), so a ResizeObserver keeps the published value accurate
// instead of guessing at it in CSS.
const COLLAPSE_THRESHOLD_PX = 8;

export function mountTopbarScroll(topbar) {
  function update() {
    topbar.classList.toggle('collapsed', window.scrollY > COLLAPSE_THRESHOLD_PX);
  }
  update(); // a reload landing mid-scroll (e.g. browser scroll restoration) should start collapsed too
  window.addEventListener('scroll', update, { passive: true });

  function publishHeight() {
    document.documentElement.style.setProperty('--topbar-height', topbar.offsetHeight + 'px');
  }
  publishHeight();
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(publishHeight).observe(topbar);
}
