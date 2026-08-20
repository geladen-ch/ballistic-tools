import { svgEl } from '../svg.js';

// A compass direction shown visually instead of as a "090°" number — a
// single filled dart, not a stroked shaft+head, so it stays crisp even at
// the conditions bar's own ~11px text size. `angleDeg` is the direction
// something (wind) is coming FROM, same convention/values as
// wind-direction-dial.js's own handle (0deg = straight up, clockwise from
// there) — but the arrow itself is drawn pointing FROM that compass point,
// i.e. the way the wind is actually flowing, not back at its source. So a
// 0deg (headwind, blowing from downrange toward the shooter) draws
// pointing down, not up — the dart's own "up" artwork is rotated 180deg
// past the raw angle to get there.
const DART_PATH = 'M12 2 L18.5 20.5 L12 16 L5.5 20.5 Z';

export function directionArrow(angleDeg, { className } = {}) {
  return svgEl('svg', {
    viewBox: '0 0 24 24',
    class: ['direction-arrow', className].filter(Boolean).join(' '),
    style: `transform: rotate(${angleDeg + 180}deg)`
  }, [
    svgEl('path', { d: DART_PATH, fill: 'currentColor' })
  ]);
}
