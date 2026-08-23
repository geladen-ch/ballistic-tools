// The set of per-range result columns a trajectory can be shown in —
// shared by the Trajectory page's own table/chart (src/views/
// trajectory-view.js) and the Arsenal Comparison chart (src/views/
// arsenal-view.js), which plots the same set of values against distance
// for two configurations at once. Kept in its own module (rather than
// exported from trajectory-view.js itself) so neither view has to import
// the other one's internals.
import { clicksForOffset, engineToDisplay } from './units.js';
import { getUnit } from './prefs.js';

// `value` returns the raw number (a table's own rendering derives its
// displayed text from it; a chart plots it directly) given the engine
// point plus a small per-call context ({ clickSettings, massKg }) for the
// columns that depend on the scope's click value or the bullet's mass.
// The mrad/MOA columns reuse clicksForOffset() with a click value of 1:
// dividing an offset by "1 unit's worth of cm at this range" is exactly
// the angular correction in that unit, independent of whatever click
// value the scope actually has.
// showLineOfSight marks the four columns that plot the bullet's vertical
// position relative to the line of sight (drop itself, plus its click/
// mrad/MOA correction forms) — see trajectory-view.js's/arsenal-view.js's
// renderChart(), which draws an extra zero-level reference line, labeled
// "Line of sight", only for these. Windage columns are a horizontal
// offset, not a position relative to the sight line, so they're excluded.
export const COLUMNS = [
  // Converted through the user's smallLength unit preference — the raw
  // p.dropCm/p.windageCm engine values (always cm) are still what every
  // clicksForOffset() call below reads directly, so this conversion only
  // affects what's displayed, never the click/mrad/MOA math.
  { id: 'dropCm', headerKey: 'trajectory.colDrop', default: true, decimals: 1, showLineOfSight: true, value: (p) => engineToDisplay('dropCm', p.dropCm, getUnit('smallLength')) },
  { id: 'windageCm', headerKey: 'trajectory.colWindage', default: true, decimals: 1, value: (p) => engineToDisplay('windageCm', p.windageCm, getUnit('smallLength')) },
  // Sign inverted relative to dropCm itself — a shooter reads this as
  // "dial up N clicks to compensate," so a bullet that's dropped below
  // the line of sight (dropCm negative) should show as a positive click
  // correction, not a negative one.
  { id: 'elevClicks', headerKey: 'trajectory.colElevClicks', default: true, decimals: 1, showLineOfSight: true, value: (p, ctx) => -clicksForOffset(p.dropCm, ctx.clickSettings.vertical, ctx.clickSettings.unit, p.range) },
  { id: 'windClicks', headerKey: 'trajectory.colWindClicks', default: true, decimals: 1, value: (p, ctx) => clicksForOffset(p.windageCm, ctx.clickSettings.horizontal, ctx.clickSettings.unit, p.range) },
  { id: 'elevMrad', headerKey: 'trajectory.colElevMrad', default: false, decimals: 2, showLineOfSight: true, value: (p) => clicksForOffset(p.dropCm, 1, 'mrad', p.range) },
  { id: 'windMrad', headerKey: 'trajectory.colWindMrad', default: false, decimals: 2, value: (p) => clicksForOffset(p.windageCm, 1, 'mrad', p.range) },
  { id: 'elevMOA', headerKey: 'trajectory.colElevMOA', default: false, decimals: 2, showLineOfSight: true, value: (p) => clicksForOffset(p.dropCm, 1, 'arcmin', p.range) },
  { id: 'windMOA', headerKey: 'trajectory.colWindMOA', default: false, decimals: 2, value: (p) => clicksForOffset(p.windageCm, 1, 'arcmin', p.range) },
  // Converted through the user's velocity unit preference the same way
  // `energy` converts through the energy preference below — getUnit() is
  // read fresh on every call for the same reason.
  { id: 'velocity', headerKey: 'trajectory.colVelocity', default: true, decimals: 1, value: (p) => engineToDisplay('velocity', p.velocity, getUnit('velocity')) },
  { id: 'tof', headerKey: 'trajectory.colTof', default: true, decimals: 3, value: (p) => p.tof },
  { id: 'mach', headerKey: 'trajectory.colMach', default: false, decimals: 2, value: (p) => p.mach },
  // Not carried on the engine point itself (the engine only needs mass for
  // the cdTable drag path — see makeStepper() in trajectory.js) — derived
  // here from velocity + the bullet's own mass (ctx.massKg), then
  // converted through the user's energy unit preference the same way
  // `range` converts through the distance preference. getUnit() is read
  // fresh on every call rather than closed over, since this is a
  // module-level array shared across every view that imports it.
  { id: 'energy', headerKey: 'trajectory.colEnergy', default: false, decimals: 0, value: (p, ctx) => engineToDisplay('energy', 0.5 * ctx.massKg * p.velocity * p.velocity, getUnit('energy')) }
];

// A narrower zoom always buys back resolution (see recomputeChart() in
// trajectory-view.js/arsenal-view.js), but only up to a point: past ~20
// samples across the visible window, the extra rows stop adding visible
// detail and just make the (already-smoothed) curve look "wobbly" from
// rounding noise in the displayed decimals. 20 is the sweet spot.
export const CHART_POINTS_TARGET = 20;
// Absolute floor, independent of whatever distance unit is selected —
// the same "20 m and no narrower" every chart's zoom sliders enforce.
export const MIN_ZOOM_WINDOW_M = 20;

// Fixed sampling resolution for the *dense* chart-source trajectory each
// chart computes once (over the full 0..maxRange span) and caches — see
// resampleChartPoints() below. Zoom/pan then resamples this cached array
// client-side instead of firing a new engine call per slider tick. Fine
// enough to comfortably outresolve the narrowest possible window
// (MIN_ZOOM_WINDOW_M / CHART_POINTS_TARGET = 2.5 m).
export const CHART_DENSE_RANGE_STEP_M = 1;

// Resamples a densely-computed trajectory (see CHART_DENSE_RANGE_STEP_M) at
// `count` evenly-spaced positions spanning [startM, endM], each obtained by
// linearly interpolating between the two bracketing dense points. Landing
// exactly on both window edges by construction is what keeps every segment
// the same size on screen: the previous approach re-ran the engine per
// zoom window with maxRange forced to land exactly on endM but not on
// startM, leaving one irregular (usually shorter) gap right before the
// last point — invisible under curve smoothing, but a visible kink once
// Chartist's index-based StepAxis (which spaces every gap at the same
// pixel width regardless of its real size) had to render it as a plain
// line. `densePoints` must be sorted by ascending `range`; if the
// trajectory didn't actually reach `endM` (e.g. went subsonic or hit the
// engine's step cap first), the window is clamped to wherever it did
// reach rather than extrapolating past the real data.
export function resampleChartPoints(densePoints, startM, endM, count = CHART_POINTS_TARGET) {
  if (densePoints.length === 0 || !Number.isFinite(startM) || !Number.isFinite(endM)) return [];
  const reachedM = densePoints[densePoints.length - 1].range;
  const clampedStart = Math.min(startM, reachedM);
  const clampedEnd = Math.min(endM, reachedM);
  const steps = clampedEnd > clampedStart ? count : 0;

  const out = [];
  let idx = 0;
  for (let k = 0; k <= steps; k++) {
    const target = k === steps ? clampedEnd : clampedStart + (k * (clampedEnd - clampedStart)) / steps;
    while (idx < densePoints.length - 2 && densePoints[idx + 1].range < target) idx++;
    const a = densePoints[idx];
    const b = densePoints[idx + 1] ?? a;
    const frac = b.range === a.range ? 0 : (target - a.range) / (b.range - a.range);
    const point = {};
    for (const key of Object.keys(a)) point[key] = a[key] + frac * (b[key] - a[key]);
    out.push(point);
  }
  return out;
}
