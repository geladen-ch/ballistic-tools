// Small line-icon set for the navigation rail/tab bar — geometric,
// stroke-based (line/circle/short-arc only, no hand-authored long path
// data), sized to inherit color from their container via `currentColor`
// so active/hover states are just a CSS color change, not a swapped icon.
import { svgEl } from '../svg.js';

const LINE = { fill: 'none', stroke: 'currentColor', 'stroke-width': '1.6', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };

function icon(size, viewBox, children) {
  return svgEl('svg', { viewBox, width: size, height: size, ...LINE }, children);
}

export function homeIcon(size = 18) {
  return icon(size, '0 0 20 20', [
    svgEl('path', { d: 'M3 9.5 10 3l7 6.5' }),
    svgEl('path', { d: 'M5 8.5V17h10V8.5' })
  ]);
}

// A gauge/dial — reads as "measuring instrument."
export function measurementIcon(size = 18) {
  return icon(size, '0 0 20 20', [
    svgEl('path', { d: 'M3 14.5a7 7 0 0 1 14 0' }),
    svgEl('line', { x1: '10', y1: '14.5', x2: '13.2', y2: '9.8' }),
    svgEl('circle', { cx: '10', cy: '14.5', r: '1.1', fill: 'currentColor', stroke: 'none' })
  ]);
}

// A trajectory arc to an impact point — echoes the app's own domain
// rather than a generic bar-chart glyph.
export function analysisIcon(size = 18) {
  return icon(size, '0 0 20 20', [
    svgEl('path', { d: 'M2.5 15.5Q7 4 11 8T17 6' }),
    svgEl('circle', { cx: '17', cy: '6', r: '1.6', fill: 'none' })
  ]);
}

export function arsenalIcon(size = 18) {
  return icon(size, '0 0 20 20', [
    svgEl('rect', { x: '4', y: '3.5', width: '10', height: '5', rx: '1' }),
    svgEl('rect', { x: '6', y: '11.5', width: '10', height: '5', rx: '1' })
  ]);
}

export function settingsIcon(size = 18) {
  return icon(size, '0 0 20 20', [
    svgEl('line', { x1: '5', y1: '3', x2: '5', y2: '17' }),
    svgEl('circle', { cx: '5', cy: '7', r: '1.6', fill: 'currentColor', stroke: 'none' }),
    svgEl('line', { x1: '10', y1: '3', x2: '10', y2: '17' }),
    svgEl('circle', { cx: '10', cy: '13', r: '1.6', fill: 'currentColor', stroke: 'none' }),
    svgEl('line', { x1: '15', y1: '3', x2: '15', y2: '17' }),
    svgEl('circle', { cx: '15', cy: '9', r: '1.6', fill: 'currentColor', stroke: 'none' })
  ]);
}

export function manualIcon(size = 18) {
  return icon(size, '0 0 20 20', [
    svgEl('rect', { x: '4', y: '2.5', width: '12', height: '15', rx: '1.5' }),
    svgEl('line', { x1: '7', y1: '7', x2: '13', y2: '7' }),
    svgEl('line', { x1: '7', y1: '10.5', x2: '13', y2: '10.5' }),
    svgEl('line', { x1: '7', y1: '14', x2: '11', y2: '14' })
  ]);
}

// Filled silhouette, not stroked like the rest of this set — deliberately
// literal (a cartoonish cartridge) rather than another abstract line mark,
// so the main "Guns" nav entry reads at a glance instead of blending into
// the abstractions around it. Still just fill:currentColor, so active/dim
// states are the same plain color swap every other icon here gets.
export function gunsIcon(size = 18) {
  return svgEl('svg', { viewBox: '0 0 100 100', width: size, height: size, fill: 'currentColor' }, [
    svgEl('path', { d: 'M50,4 C 62,4 68,20 68,32 L68,34 L32,34 L32,32 C32,20 38,4 50,4 Z' }),
    svgEl('rect', { x: '30', y: '34', width: '40', height: '46', rx: '3' }),
    svgEl('rect', { x: '26', y: '80', width: '48', height: '14', rx: '3' }),
    svgEl('rect', { x: '26', y: '88', width: '48', height: '6', rx: '2', opacity: '0.55' })
  ]);
}

// The "Custom" tab inside Guns — a pencil, reading as "hand-pick/edit"
// next to editIcon's sibling checkIcon (Done) and the reused arsenalIcon.
export function editIcon(size = 18) {
  return icon(size, '0 0 20 20', [
    svgEl('line', { x1: '4', y1: '16', x2: '14', y2: '6' }),
    svgEl('path', { d: 'M14 6 16.5 3.5 18 5 15.5 7.5 Z', fill: 'currentColor', stroke: 'none' }),
    svgEl('line', { x1: '3', y1: '17', x2: '5', y2: '15' })
  ]);
}

// "Done" — the plain checkmark that closes out Guns mode.
export function checkIcon(size = 18) {
  return icon(size, '0 0 20 20', [svgEl('path', { d: 'M4 10.5 8 14.5 16 5.5' })]);
}

export function chevronIcon(size = 9) {
  return icon(size, '0 0 12 12', [svgEl('path', { d: 'M3 4.5 6 7.5 9 4.5' })]);
}

// Points left (collapse) by default; pass reversed=true for the
// collapsed rail's own "expand" control.
export function collapseIcon(size = 15, reversed = false) {
  const d1 = reversed ? 'M7.5 4 13 10l-5.5 6' : 'M12.5 4 7 10l5.5 6';
  return icon(size, '0 0 20 20', [svgEl('path', { d: d1 })]);
}

// A classic bullseye — Range Solver's "Target" tab (range + line-of-sight
// angle).
export function targetIcon(size = 18) {
  return icon(size, '0 0 20 20', [
    svgEl('circle', { cx: '10', cy: '10', r: '7' }),
    svgEl('circle', { cx: '10', cy: '10', r: '4' }),
    svgEl('circle', { cx: '10', cy: '10', r: '1', fill: 'currentColor', stroke: 'none' })
  ]);
}

// A sight line rising from the shooter to the target, with a small arc
// marking the angle off the horizontal and a dot at the eye — inline
// adornment for the Target tab's LoS-angle field (range-solver-view.js),
// standing in for that field's removed text label. Redrawn from the
// original data/icons/los-angle-icon.svg (an Inkscape export: hardcoded
// black, odd mm-based viewBox) into this module's own line-icon
// convention instead of loaded as a static file. A small hollow ring in
// the otherwise-empty upper-left corner reads as a bare degree sign (°),
// making clear the field below it is measured in degrees rather than
// just "an angle."
export function losAngleIcon(size = 18) {
  return icon(size, '0 0 20 20', [
    svgEl('line', { x1: '3', y1: '15', x2: '16', y2: '15' }),
    svgEl('path', { d: 'M3 15 13 6' }),
    svgEl('path', { d: 'M8 15A5 5 0 0 1 6.8 11.6', fill: 'none' }),
    svgEl('circle', { cx: '3', cy: '15', r: '1.2', fill: 'currentColor', stroke: 'none' }),
    svgEl('circle', { cx: '13', cy: '6', r: '1.4', fill: 'none' }),
    svgEl('circle', { cx: '3.3', cy: '3.3', r: '1.1', fill: 'none' })
  ]);
}

// A thermometer — Range Solver's "Atmosphere" tab (temperature/pressure/
// altitude/humidity). Deliberately not the same gauge/dial motif
// measurementIcon() already uses, to avoid the two reading as the same
// concept.
export function atmosphereIcon(size = 18) {
  return icon(size, '0 0 20 20', [
    svgEl('rect', { x: '8', y: '3', width: '4', height: '10', rx: '2' }),
    svgEl('circle', { cx: '10', cy: '15', r: '3', fill: 'none' }),
    svgEl('line', { x1: '10', y1: '5', x2: '10', y2: '14', 'stroke-width': '2' })
  ]);
}

// An open door frame with an arrow passing through it — "Exit solver"
// (leaving the section entirely, back to Home), reading distinctly from
// checkIcon's plain checkmark ("Done," confirming a Guns selection).
export function exitIcon(size = 18) {
  return icon(size, '0 0 20 20', [
    svgEl('path', { d: 'M9 3H4v14h5' }),
    svgEl('line', { x1: '8', y1: '10', x2: '17', y2: '10' }),
    svgEl('path', { d: 'M13.5 6.5 17 10l-3.5 3.5' })
  ]);
}

// A magnifying glass with a +/- in the lens — location-placement-view.js's
// own Zoom In/Zoom Out nav buttons.
export function zoomInIcon(size = 18) {
  return icon(size, '0 0 20 20', [
    svgEl('circle', { cx: '8.5', cy: '8.5', r: '5.5' }),
    svgEl('line', { x1: '12.7', y1: '12.7', x2: '18', y2: '18' }),
    svgEl('line', { x1: '8.5', y1: '6', x2: '8.5', y2: '11' }),
    svgEl('line', { x1: '6', y1: '8.5', x2: '11', y2: '8.5' })
  ]);
}

export function zoomOutIcon(size = 18) {
  return icon(size, '0 0 20 20', [
    svgEl('circle', { cx: '8.5', cy: '8.5', r: '5.5' }),
    svgEl('line', { x1: '12.7', y1: '12.7', x2: '18', y2: '18' }),
    svgEl('line', { x1: '6', y1: '8.5', x2: '11', y2: '8.5' })
  ]);
}

export function hamburgerIcon(size = 20) {
  return icon(size, '0 0 20 20', [
    svgEl('line', { x1: '3', y1: '6', x2: '17', y2: '6' }),
    svgEl('line', { x1: '3', y1: '10', x2: '17', y2: '10' }),
    svgEl('line', { x1: '3', y1: '14', x2: '17', y2: '14' })
  ]);
}

// The app's own reticle mark (icons/icon.svg), redrawn inline so it can
// take `currentColor` and sit at nav-icon sizes — used as the brand mark
// when the rail is collapsed and there's no room for the wordmark.
export function reticleIcon(size = 20) {
  return icon(size, '0 0 20 20', [
    svgEl('circle', { cx: '10', cy: '10', r: '6.5', fill: 'none' }),
    svgEl('circle', { cx: '10', cy: '10', r: '2.6', fill: 'none' }),
    svgEl('line', { x1: '10', y1: '1.5', x2: '10', y2: '4.5' }),
    svgEl('line', { x1: '10', y1: '15.5', x2: '10', y2: '18.5' }),
    svgEl('line', { x1: '1.5', y1: '10', x2: '4.5', y2: '10' }),
    svgEl('line', { x1: '15.5', y1: '10', x2: '18.5', y2: '10' })
  ]);
}
