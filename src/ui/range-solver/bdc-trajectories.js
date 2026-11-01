// The trajectories the scope view's BDC overlay reads (reticle/
// bdc-overlay.js), two, flown side by side on the shared worker pool so
// a slow 4-DOF solve never holds up the readout: the shot's conditions
// with the wind's head- or tailwind part and no crosswind, which sets the
// marks' ranges and moves them across by spin drift, and the same with
// the reference crosswind from the right added, whose difference the
// wind holds are scaled and mirrored from. Flown again whenever anything
// they depend on changes — the head- or tailwind included; a change of
// the crosswind alone leaves them as they are.
//
// bdcTrajectories(onChange) → { update(state, referenceSpeed), dispose() }.
// `state` is the shot's nominal state, `referenceSpeed` the reference
// crosswind in m/s. onChange({ still, referenceSpeed }) gets the hold
// table once both are in; a newer update() drops an older one's.
import { integrate } from '../../engine/trajectory.js';
import { getPool } from '../../pool.js';
import { FIELD_BOUNDS } from '../../units.js';
import { holdTable, withReferenceWind } from '../../reticle/bdc-overlay.js';

// Out to the farthest target the Range Solver takes, sampled finely
// enough that interpolating between samples is far below a click.
const MAX_RANGE_M = FIELD_BOUNDS.targetRange.max;
const RANGE_STEP_M = 5;
// A head- or tailwind this small (m/s) is none.
const NEGLIGIBLE_WIND = 1e-9;

// A wind as the engine takes it, from its two parts: along the line of
// fire (positive a headwind) and across it (positive from the right).
function windOf(headwind, crosswind) {
  return { windSpeed: Math.hypot(headwind, crosswind), windAngleRad: Math.atan2(crosswind, headwind) };
}

// On the pool where there are workers; inline (on a later tick) where
// there are none, as under the test runner.
function fly(state) {
  if (typeof Worker === 'function') return getPool().run('trajectory', state);
  return new Promise((resolve) => setTimeout(resolve, 0)).then(() => integrate(state));
}

export function bdcTrajectories(onChange) {
  let key = null;
  let request = 0;

  function update(state, referenceSpeed) {
    const { windSpeed = 0, windAngleRad = 0, ...conditions } = state;
    // A crosswind's float residue along the line of fire (cos 90° is not
    // quite 0) is no headwind: flown again for nothing otherwise.
    const along = windSpeed * Math.cos(windAngleRad);
    const headwind = Math.abs(along) < NEGLIGIBLE_WIND ? 0 : along;
    const base = { ...conditions, maxRange: MAX_RANGE_M, rangeStep: RANGE_STEP_M };
    const still = { ...base, ...windOf(headwind, 0) };
    const nextKey = JSON.stringify([still, referenceSpeed]);
    if (nextKey === key) return;
    key = nextKey;
    const id = ++request;
    Promise.all([fly(still), fly({ ...base, ...windOf(headwind, referenceSpeed) })]).then(([stillResult, referenceResult]) => {
      if (id !== request) return;
      onChange({
        still: withReferenceWind(holdTable(stillResult.points), holdTable(referenceResult.points), referenceSpeed),
        referenceSpeed
      });
    }).catch(() => {
      if (id !== request) return;
      key = null;
      onChange(null);
    });
  }

  return {
    update,
    dispose() {
      request += 1;
    }
  };
}
