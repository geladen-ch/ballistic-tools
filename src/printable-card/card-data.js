// Everything the printable card's corrections table prints, solved and
// formatted: which rows, and every cell's text.
//
// Solved for the Trajectory setup's rifle, cartridge and atmosphere at the
// rifle's own zero, level, with no spin drift unless asked for:
//   - one trajectory in the reference crosswind (full value from the
//     right) on the card's finest distance grid (5 units of the user's
//     distance unit), giving every reference and neighbouring distance's
//     elevation and windage — and, flown far enough, where the bullet's
//     remaining velocity drops to the Mach limit;
//   - with the spin drift column, one more in still air with spin drift;
//   - with the slope corrections, one up and one down the slope for each
//     angle (10°–30°), averaged: the correction is that average less the
//     level elevation;
//   - with the temperature corrections, one at each of the card's
//     temperatures (air and powder alike: the muzzle velocity follows the
//     cartridge's velocity change per degree), the rifle's zero kept in its
//     own air: the correction is that elevation less the level elevation;
//   - each target on its own (computeImpact), at its own line-of-sight
//     angle.
// Values are formatted as the Range Solver shows them (dope-format.js):
// its output unit and direction glyphs. Windage is shown as a magnitude,
// with no glyph, the wind's side being fixed.
import { computeImpact } from '../engine/trajectory.js';
import { canComputeStability } from '../engine/stability.js';
import { formatDope } from '../ui/dope-format.js';
import { siToDisplay, displayToSI, FIELD_BOUNDS, convertAngularValue } from '../units.js';
import { linearToAngleAtRange, radToMrad, radToDeg, degToRad } from '../quantity.js';
import { referenceDistances, neighbourDistances, tableRows, DISTANCE_GRID } from './rows.js';

export const SLOPE_ANGLES_DEG = [10, 15, 20, 25, 30];
export const TEMPERATURE_COLUMNS = 5;
// How close (°C) a column's temperature must be to the reference to count
// as the reference itself (a step in °F lands on it only up to rounding).
const SAME_TEMPERATURE_C = 1e-6;
// The air fields the rifle's zero is solved in (trajectory.js's zero state).
const ZERO_AIR_KEYS = ['tempC', 'pressurePa', 'humidity', 'altitudeM'];
// A crosswind from the right: the engine's wind angle for it.
const CROSSWIND_FROM_RIGHT_RAD = Math.PI / 2;
const MINUS = '−';

// The setup as the card solves it: level, no spin drift, in `windSpeed`.
function levelState(base, windSpeed) {
  return { ...base, losAngleRad: 0, windSpeed, windAngleRad: CROSSWIND_FROM_RIGHT_RAD, spinDriftMode: 'off' };
}

// Whether the card offers the spin drift column: spin drift switched on in
// Settings (its method is the one used), and computable for the rifle and
// bullet (twist, bullet length and diameter known).
export function spinDriftOffered(base, settingsMode) {
  return !!settingsMode && settingsMode !== 'off' && canComputeStability(base);
}

// The card's temperature columns (°C): `count` steps of `stepC` up from
// `startC`. A step on the reference temperature is kept: its column, all
// zeros, marks where the reference falls in the scale.
export function temperatureColumns({ startC, stepC, count = TEMPERATURE_COLUMNS }) {
  if (!(Number.isFinite(startC) && Number.isFinite(stepC) && stepC > 0)) return [];
  return Array.from({ length: count }, (_, i) => startC + i * stepC);
}

// The rifle's zero air: its own when it was zeroed in other air, otherwise
// the setup's (the reference conditions).
function zeroAir(base) {
  if (base.zeroAtmosphere) return base.zeroAtmosphere;
  return Object.fromEntries(ZERO_AIR_KEYS.filter((k) => base[k] != null).map((k) => [k, base[k]]));
}

// A correction (radians, the engine's sign: elevation + up, windage as
// the Range Solver shows it) as the Range Solver writes it: its glyph and
// number, the glyph glued to a sign and spaced from a letter or arrow.
export function dopeText(rad, axis, output) {
  const { glyph, number } = formatDope({
    mrad: radToMrad(rad), axis, clickMrad: radToMrad(axis === 'elevation' ? output.clickVerticalRad : output.clickHorizontalRad),
    clicksLabel: output.clicksLabel, unit: output.unit, style: output.style
  });
  if (!glyph) return number;
  return output.style === 'signs' ? `${glyph}${number}` : `${glyph} ${number}`;
}

// A magnitude in the output unit, no glyph.
export function magnitudeText(rad, axis, output) {
  return formatDope({
    mrad: radToMrad(Math.abs(rad)), axis, clickMrad: radToMrad(axis === 'elevation' ? output.clickVerticalRad : output.clickHorizontalRad),
    clicksLabel: output.clicksLabel, unit: output.unit, style: output.style
  }).number;
}

// An angle in the output unit, as a number (for the refinement threshold).
export function angleInOutputUnit(rad, axis, output) {
  if (output.unit === 'clicks') return rad / (axis === 'elevation' ? output.clickVerticalRad : output.clickHorizontalRad);
  return convertAngularValue(rad, 'rad', output.unit === 'moa' ? 'arcmin' : 'mrad');
}

export function outputUnitToRad(value, axis, output) {
  if (output.unit === 'clicks') return value * (axis === 'elevation' ? output.clickVerticalRad : output.clickHorizontalRad);
  return convertAngularValue(value, output.unit === 'moa' ? 'arcmin' : 'mrad', 'rad');
}

export function signedDegreesText(rad) {
  const deg = Math.round(radToDeg(rad));
  if (deg === 0) return '0°';
  return `${deg > 0 ? '+' : MINUS}${Math.abs(deg)}°`;
}

// One trajectory on the card's grid, as { elevationRad(d), windageRad(d),
// points } where d is a grid distance in the user's unit.
function gridLookup(points, gridM) {
  const at = (d, unit) => {
    const m = displayToSI('range', d, unit);
    const p = points[Math.round(m / gridM)];
    return p && Math.abs(p.range - m) < gridM / 4 && p.range > 0 ? p : null;
  };
  return {
    elevationRad: (d, unit) => { const p = at(d, unit); return p ? -linearToAngleAtRange(p.dropM, p.range) : NaN; },
    windageRad: (d, unit) => { const p = at(d, unit); return p ? linearToAngleAtRange(p.windageM, p.range) : NaN; }
  };
}

// Where the remaining velocity first drops to `mach`, in m, interpolated
// between grid points; null if not within the trajectory.
export function machDistanceM(points, mach) {
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (b.mach <= mach) {
      if (!(a.mach > mach)) return a.range;
      return a.range + (b.range - a.range) * (a.mach - mach) / (a.mach - b.mach);
    }
  }
  return null;
}

// `base`: the engine state (Trajectory's setup at the rifle's own zero).
// `settings`: { maxMode, maxDistanceM, initialStep, refineThresholdRad,
// spinDrift, slope, temperaturesC, mach, maxRows } (mach for the Mach
// modes; temperaturesC: the temperature columns, null or empty for none;
// maxRows: the paper's table capacity). `crosswindMs`: the
// reference crosswind. `targets`: [{ id, label, rangeM, losAngleRad }].
// `output`: { unit, style, clickVerticalRad, clickHorizontalRad,
// clicksLabel }. `distanceUnit`: the user's. `spinDriftMode`: Settings'
// (the spin drift column is left out while it is off).
export async function computeCardData({ pool, base, settings, crosswindMs, targets = [], output, distanceUnit, spinDriftMode }) {
  const gridM = displayToSI('range', DISTANCE_GRID, distanceUnit);
  const boundM = FIELD_BOUNDS.maxRange.max;
  const machMode = settings.maxMode !== 'distance';
  const farthestNeighbour = 100;
  const requestedMax = machMode ? null : siToDisplay('range', settings.maxDistanceM, distanceUnit);
  const runMaxM = machMode
    ? boundM
    : Math.min(boundM, displayToSI('range', requestedMax + farthestNeighbour, distanceUnit));
  const rangeStep = Math.max(gridM, FIELD_BOUNDS.rangeStep.min);

  const run = (state) => pool.run('trajectory', { ...state, maxRange: runMaxM, rangeStep });
  const level = await run(levelState(base, crosswindMs));
  const grid = gridLookup(level.points, rangeStep);

  let maxDistance = requestedMax;
  let mach = null;
  if (machMode) {
    const m = machDistanceM(level.points, settings.mach);
    const lastM = level.points.length ? level.points[level.points.length - 1].range : 0;
    mach = { mach: settings.mach, distanceM: m, reached: m !== null };
    maxDistance = siToDisplay('range', m ?? lastM, distanceUnit);
  }
  // No row past what was flown (the neighbours included).
  maxDistance = Math.min(maxDistance, siToDisplay('range', runMaxM, distanceUnit) - farthestNeighbour);

  const elevationAt = (d) => angleInOutputUnit(grid.elevationRad(d, distanceUnit), 'elevation', output);
  const thresholdOutput = settings.refineThresholdRad > 0 ? angleInOutputUnit(settings.refineThresholdRad, 'elevation', output) : 0;
  const references = referenceDistances({
    initialStep: settings.initialStep, maxDistance, refineThreshold: thresholdOutput, elevationAt
  });

  const targetRows = targets.map((tg) => ({ ...tg, distance: siToDisplay('range', tg.rangeM, distanceUnit) }));
  const { rows, omitted, lastDistance } = tableRows({ references, targets: targetRows, maxDistance, maxRows: settings.maxRows });

  const spin = settings.spinDrift && spinDriftOffered(base, spinDriftMode);
  const spinMode = spinDriftMode;
  const spinGrid = spin
    ? gridLookup((await run({ ...levelState(base, 0), spinDriftMode: spinMode })).points, rangeStep)
    : null;

  let slopeGrids = null;
  if (settings.slope) {
    const payloads = SLOPE_ANGLES_DEG.flatMap((deg) => [1, -1].map((sign) => ({
      ...levelState(base, 0), losAngleRad: sign * degToRad(deg), maxRange: runMaxM, rangeStep
    })));
    const results = await pool.runAll('trajectory', payloads);
    slopeGrids = SLOPE_ANGLES_DEG.map((_, i) => [gridLookup(results[2 * i].points, rangeStep), gridLookup(results[2 * i + 1].points, rangeStep)]);
  }

  let temperatureGrids = null;
  if (settings.temperaturesC && settings.temperaturesC.length) {
    // A column at the reference temperature is the card's own trajectory:
    // no run of its own, and exact zeros rather than rounding noise.
    const zeroAtmosphere = zeroAir(base);
    const isReference = (tempC) => Number.isFinite(base.tempC) && Math.abs(tempC - base.tempC) < SAME_TEMPERATURE_C;
    const runTemps = settings.temperaturesC.filter((tempC) => !isReference(tempC));
    const results = await pool.runAll('trajectory', runTemps.map((tempC) => ({
      ...levelState(base, 0), tempC, zeroAtmosphere, maxRange: runMaxM, rangeStep
    })));
    let next = 0;
    temperatureGrids = settings.temperaturesC.map((tempC) => (isReference(tempC) ? grid : gridLookup(results[next++].points, rangeStep)));
  }

  const distanceText = (d) => String(Math.round(d));
  const cells = rows.map((row) => {
    if (row.kind === 'reference') {
      const d = row.distance;
      const elevation = grid.elevationRad(d, distanceUnit);
      const neighbours = neighbourDistances(row).map((nd) => {
        if (nd === null) return null;
        const e = grid.elevationRad(nd, distanceUnit);
        return Number.isFinite(e) ? { distance: distanceText(nd), elevation: dopeText(e, 'elevation', output) } : null;
      });
      const slope = slopeGrids
        ? slopeGrids.map(([up, down]) => {
          const avg = (up.elevationRad(d, distanceUnit) + down.elevationRad(d, distanceUnit)) / 2;
          return Number.isFinite(avg) && Number.isFinite(elevation) ? dopeText(avg - elevation, 'elevation', output) : '';
        })
        : null;
      const temperature = temperatureGrids
        ? temperatureGrids.map((g) => {
          const e = g.elevationRad(d, distanceUnit);
          return Number.isFinite(e) && Number.isFinite(elevation) ? dopeText(e - elevation, 'elevation', output) : '';
        })
        : null;
      const spinRad = spinGrid ? spinGrid.windageRad(d, distanceUnit) : NaN;
      return {
        kind: 'reference',
        distance: distanceText(d),
        elevation: Number.isFinite(elevation) ? dopeText(elevation, 'elevation', output) : '',
        neighbours,
        windage: magnitudeText(grid.windageRad(d, distanceUnit), 'windage', output),
        spin: spinGrid ? (Number.isFinite(spinRad) ? dopeText(spinRad, 'windage', output) : '') : null,
        slope,
        temperature
      };
    }
    const rangeM = row.rangeM;
    const state = { ...levelState(base, crosswindMs), losAngleRad: row.losAngleRad };
    let elevation = '';
    let windage = '';
    let spinText = spin ? '' : null;
    try {
      const r = computeImpact(state, rangeM);
      elevation = dopeText(-linearToAngleAtRange(r.dropM, rangeM), 'elevation', output);
      windage = magnitudeText(linearToAngleAtRange(r.windageM, rangeM), 'windage', output);
      if (spin) {
        const s = computeImpact({ ...levelState(base, 0), losAngleRad: row.losAngleRad, spinDriftMode: spinMode }, rangeM);
        spinText = dopeText(linearToAngleAtRange(s.windageM, rangeM), 'windage', output);
      }
    } catch {
      // an unsolvable target keeps blank cells
    }
    return {
      kind: 'target', id: row.label, angle: signedDegreesText(row.losAngleRad ?? 0),
      distance: distanceText(row.distance), elevation, windage, spin: spinText
    };
  });

  return {
    rows: cells,
    omitted,
    lastDistance,
    maxDistance,
    mach,
    spin,
    slope: !!slopeGrids,
    temperature: !!temperatureGrids,
    rowCount: rows.length
  };
}
