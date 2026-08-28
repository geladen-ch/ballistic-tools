// Pure point-mass exterior ballistics: no DOM, no `self` — importable by a
// worker, the main thread, or a Node test runner without modification.
import { GRAVITY, LBIN2_TO_KGM2, TRANSONIC_LO, TRANSONIC_HI, H_COARSE, H_FINE, MAX_STEPS } from './constants.js';
import { DRAG_TABLES, makeCdLookup } from './drag-tables.js';
import { airDensity, speedOfSound, temperatureAtHeightDelta, icaoStandardPressureHpa } from './atmosphere.js';
import { resolveSpinDrift, spinDriftCm, resolveSpinDriftMode } from './spin-drift.js';
import { makeStepper4dof } from './trajectory-4dof.js';

// Builds the RK4 step function for one fixed set of shot conditions (bc,
// wind, atmosphere). Reused by the zero-angle solver (many short
// integrations) and the full trajectory pass (one long one) so the two
// never drift out of sync with each other.
//
// Two ways to describe the bullet's drag:
//  - bc + dragModel (the default): scale a *standard reference* Cd(M)
//    curve (G1/G7) by the bullet's BC. This is the classic approximation
//    every hand-loaded BC value is built for.
//  - cdTable + massKg + caliberM (from a library bullet with its own
//    measured Cd curve, e.g. Doppler radar data — both already in SI,
//    same as everything else this engine touches): the reference-curve
//    approximation is no longer needed or wanted — Cd(M) is already the
//    bullet's own, so drag comes directly from its actual sectional
//    density (mass/frontal-area), not from BC/form-factor at all.
export function makeStepper(state) {
  const {
    bc, dragModel = 'G1', cdTable, massKg, caliberM,
    windSpeed = 0, windAngle = 90,
    tempC = 15, pressureHpa = 1013, altitudeM = 0, humidityPct = 0
  } = state;

  const table = cdTable || (DRAG_TABLES[dragModel] || DRAG_TABLES.G1);
  const cdAt = makeCdLookup(table);
  const areaM2 = cdTable ? (Math.PI / 4) * caliberM * caliberM : null;

  // kConst is rho * kFactor at every call site (see atmosphereAt() below)
  // — kFactor itself never changes across a stepper's lifetime (bc/massKg/
  // areaM2 are all fixed for "one set of shot conditions", per this
  // function's own docstring), so it's computed once here rather than
  // redone on every one of the (up to MAX_STEPS, times however many loops
  // reuse this stepper) calls to atmosphereAt().
  //
  //   cdTable:  a = rho * Cd(M) * v^2 / (2 * sectionalDensity), sectionalDensity
  //             being the bullet's own mass/area — the general form the BC
  //             branch below specializes.
  //   BC:       a = rho*v^2*Cd_actual*A / (2m), with BC defined as
  //             m/(i*d^2) (lb/in^2) and Cd_actual = i*Cd_std(M). Substituting
  //             A = pi*d^2/4 and m = BC*i*d^2, the diameter and form factor i
  //             both cancel, leaving a = (pi/8) * rho * Cd_std(M) * v^2 / BC —
  //             not the naive rho*Cd*v^2/(2*BC) a plain F=ma/2 reading would
  //             suggest, since that skips the pi/4 hidden inside BC's own d^2
  //             term. BC is converted from its conventional lb/in^2 to
  //             kg/m^2 so the rest of the model can stay SI throughout.
  const kFactor = cdTable
    // areaM2 / (2 * massKg), not 1 / (2 * (massKg / areaM2)) — same value,
    // one division instead of two.
    ? areaM2 / (2 * massKg)
    : Math.PI / (8 * LBIN2_TO_KGM2 * bc);

  // The ICAO standard-atmosphere reference pressure *at the site's own
  // altitude* — the denominator of pressureAtAltitude()'s ratio (see
  // atmosphere.js). altitudeM is fixed for this stepper's whole lifetime
  // (same as kFactor above), so unlike the numerator below (which
  // genuinely changes every step, as the bullet's own altitude changes),
  // this is computed once here rather than redone — via a fresh
  // icaoStandardPressureHpa() call, i.e. a Math.pow — on every single one
  // of the (up to MAX_STEPS, times however many loops reuse this stepper)
  // calls to atmosphereAt().
  const siteStdPressureHpa = icaoStandardPressureHpa(altitudeM);

  // pressureHpa/tempC are the shooter's own actual station readings, taken
  // at face value at their own elevation (altitudeM) — no sea-level
  // conversion (see atmosphere.js's pressureAtAltitude, whose ratio is
  // inlined here against the hoisted siteStdPressureHpa above rather than
  // called directly, so only the numerator's Math.pow is repeated per
  // step). Recomputed fresh at the start of every integration step (not
  // once for the whole trajectory, as before) from the bullet's own
  // current absolute altitude (altitudeM + its height delta from the
  // muzzle): the standard atmosphere's lapse rate (temperature) and
  // pressure ratio give the best available estimate of how conditions
  // change as that altitude diverges from the site's over the course of
  // one shot — enough, at long range or any real line-of-sight incline, to
  // meaningfully change both density and the speed of sound. All four RK4
  // stages within one step share this same snapshot: the altitude change
  // *within* one step (a fraction of a second of flight) is negligible
  // regardless.
  function atmosphereAt(heightDeltaM) {
    const localTempC = temperatureAtHeightDelta(tempC, heightDeltaM);
    const localPressureHpa = pressureHpa * (icaoStandardPressureHpa(altitudeM + heightDeltaM) / siteStdPressureHpa);
    const rho = airDensity({ tempC: localTempC, pressureHpa: localPressureHpa, humidityPct });
    const speedSound = speedOfSound(localTempC);
    const kConst = rho * kFactor;
    return { kConst, speedSound };
  }

  // Wind angle convention: 0deg = headwind, 90deg = full crosswind from the
  // right (pushes impact left, +z). Pin this down in the UI copy too — it's
  // the #1 source of "windage is backwards" bugs in ballistics apps. Wind
  // always blows horizontally in the world frame, regardless of any
  // line-of-sight incline the shot itself is fired at.
  const windRad = (windAngle * Math.PI) / 180;
  const windX = -windSpeed * Math.cos(windRad);
  const windZ = windSpeed * Math.sin(windRad);

  function derivatives(vx, vy, vz, kConst, speedSound) {
    const relVx = vx - windX, relVz = vz - windZ;
    const speed = Math.sqrt(relVx * relVx + vy * vy + relVz * relVz);
    const mach = speed / speedSound;
    const cd = cdAt(mach);
    const dragAccel = kConst * cd * speed;
    return {
      ax: -dragAccel * relVx,
      ay: -dragAccel * vy - GRAVITY,
      az: -dragAccel * relVz,
      mach
    };
  }

  // `p.y` is world-frame height gained (or lost) since the muzzle — true
  // vertical, not along whatever line-of-sight angle the shot was fired
  // at, and exactly the "altitude delta from the point of shooting" the
  // standard atmosphere model above needs.
  function step(p) {
    const { kConst, speedSound } = atmosphereAt(p.y);
    const d0 = derivatives(p.vx, p.vy, p.vz, kConst, speedSound);
    const h = (d0.mach > TRANSONIC_LO && d0.mach < TRANSONIC_HI) ? H_FINE : H_COARSE;

    const k1 = d0;
    const k2 = derivatives(p.vx + k1.ax * h / 2, p.vy + k1.ay * h / 2, p.vz + k1.az * h / 2, kConst, speedSound);
    const k3 = derivatives(p.vx + k2.ax * h / 2, p.vy + k2.ay * h / 2, p.vz + k2.az * h / 2, kConst, speedSound);
    const k4 = derivatives(p.vx + k3.ax * h, p.vy + k3.ay * h, p.vz + k3.az * h, kConst, speedSound);

    const ax = (k1.ax + 2 * k2.ax + 2 * k3.ax + k4.ax) / 6;
    const ay = (k1.ay + 2 * k2.ay + 2 * k3.ay + k4.ay) / 6;
    const az = (k1.az + 2 * k2.az + 2 * k3.az + k4.az) / 6;

    // Position gets its own RK4-consistent weighting, not the velocity
    // update's 1:2:2:1 average — for the coupled system dx/dt=v, dv/dt=a(v)
    // (a depends only on velocity here, not position, since atmosphere is
    // frozen for the whole step), working through the standard 4-stage RK4
    // derivation for the position component gives h*v + (h^2/6)*(k1+k2+k3)
    // with k4 dropped entirely and equal (not 1:2:2:1) weights — not
    // 0.5*ax_avg*h^2 with the velocity-style average, which differs by
    // (h^2/12)*(k1-k4) per step. h^2/6 factored as (h*h/6) rather than
    // 0.5*h*h/3 to keep it one visibly-exact fraction.
    const hh6 = (h * h) / 6;
    return {
      x: p.x + p.vx * h + hh6 * (k1.ax + k2.ax + k3.ax),
      y: p.y + p.vy * h + hh6 * (k1.ay + k2.ay + k3.ay),
      z: p.z + p.vz * h + hh6 * (k1.az + k2.az + k3.az),
      vx: p.vx + ax * h,
      vy: p.vy + ay * h,
      vz: p.vz + az * h,
      t: p.t + h
    };
  }

  return { step };
}

// Everything below the muzzle-velocity resolver deals with an optional
// line-of-sight angle (state.losAngleDeg, degrees, +up — a shot at an
// inclined target): the shooter tilts the whole rifle, scope included, to
// look along that incline, so the sight line itself becomes a straight ray
// tilted losAngle from horizontal, and the bore is tilted a bit further
// *above that line* by whatever the zero solver comes up with — the exact
// same relationship the flat (losAngle = 0) case already had with "above
// horizontal". Gravity, meanwhile, stays exactly vertical in the world
// frame no matter the incline (that's the whole reason a shot at any real
// angle doesn't drop like a level one at the same slant distance) — see
// makeStepper above, which always integrates in plain world (horizontal,
// vertical) coordinates and knows nothing about losAngle at all. The
// rotation below is purely a change of *frame*: world-frame points in, and
// out come the along-the-sight-line range/drop/velocity the table, the
// zero solver, and Monte Carlo's impact solve actually care about.
//
// `toLOS` collapses to the untilted values (range=x, drop=y, velocity=vx)
// when losAngle is 0, so every existing (angle-free) caller is unaffected.
function toLOS(p, cosL, sinL) {
  return {
    range: p.x * cosL + p.y * sinL,
    drop: -p.x * sinL + p.y * cosL,
    velocity: p.vx * cosL + p.vy * sinL
  };
}

// Just the range component of toLOS(), inline rather than allocating a
// whole {range, drop, velocity} object — used by every step-loop's own
// "have we reached the target range yet?" condition (solveZeroAngle(),
// computeImpact(), integrate()'s own rangeOf), which runs once per RK4
// step and only ever needs this one field there.
function rangeAlongLOS(p, cosL, sinL) {
  return p.x * cosL + p.y * sinL;
}

// The muzzle's world position: sightHeight below the sight line, rotated
// the same way the sight line itself is tilted (the inverse of toLOS() at
// range=0, drop=-sightHeight).
function losMuzzlePosition(sightHeight, cosL, sinL) {
  const drop = -sightHeight / 1000;
  return { x: -drop * sinL, y: drop * cosL };
}

// Optional linear muzzle-velocity-vs-temperature correction: propellant
// burns faster (higher V0) in warm cartridges and slower (lower V0) in
// cold ones, roughly linearly over the range a shooter encounters. Active
// only when both referenceTempC (the temperature V0 was measured at) and
// velocityTempSensitivity (m/s of V0 change per °C) are supplied — e.g.
// from a checkbox-gated UI section — otherwise muzzleVelocity passes
// through unchanged. The cartridge is assumed to sit at the same
// temperature as the surrounding air (state.tempC) — there's no separate
// "cartridge temperature" input.
export function resolveMuzzleVelocity(state) {
  const { muzzleVelocity, tempC, referenceTempC, velocityTempSensitivity } = state;
  if (velocityTempSensitivity == null || referenceTempC == null) return muzzleVelocity;
  return muzzleVelocity + (tempC - referenceTempC) * velocityTempSensitivity;
}

// Picks the stepper a shot's own resolved spinDriftMode (see
// resolveSpinDriftMode in spin-drift.js) should actually fly with.
// 'mccoy4dof' gets the full 4-DOF/MPM stepper — its own z comes out of
// integrating an actual lift force, already including spin drift
// physically, so callers must NOT also add Litz's spinDriftCm() on top.
// 'litz' and 'off' both fly the plain 3-DOF stepper, unchanged from
// before this dispatch existed; 'litz' callers add spinDriftCm()
// themselves afterward, from the {sg, twistDirection} resolveSpinDrift()
// already gives them.
//
// `initialExtra` carries whatever extra field(s) a mode's own initial
// point needs beyond this file's usual {x,y,z,vx,vy,vz,t} shape — just
// the axial spin rate `p0` for mccoy4dof, spread into every p0 object
// built at this file's three windage-aware call sites. landOnRange()/
// lerpPoint() don't preserve unrecognized fields through interpolation,
// but that's fine here: `p` only needs to survive the raw step-to-step
// walk (which always round-trips whatever step() itself just returned
// straight back into the next step() call, never through landOnRange()),
// since nothing downstream ever reads an interpolated `p` — display
// points never show spin rate, only position/velocity/tof.
//
// solveZeroAngle() deliberately does NOT go through this — it stays on
// the plain 3-DOF stepper always, regardless of mode. Its own vertical
// drop differs from 4-DOF's by <0.001% (see trajectory-4dof.test.js),
// so using the 3-DOF-solved launch angle to fly a 4-DOF trajectory
// afterward is a well below the numerical noise floor of every other
// approximation already in this model — not worth doubling
// solveZeroAngle's own stepper-selection logic for.
function stepperForMode(state, mode) {
  if (mode === 'mccoy4dof') {
    const { step, p0 } = makeStepper4dof(state);
    return { step, initialExtra: { p: p0 } };
  }
  return { step: makeStepper(state).step, initialExtra: {} };
}

// Secant-method solve for the launch pitch (radians, +up *above the line
// of sight*) that sends the bullet through the sight line (drop=0) at
// zeroRange (measured along that same, possibly inclined, line), given the
// bore starts sightHeight below it. Well-behaved (monotonic, no local
// minima) over the small angles real zeroing needs, so secant is enough —
// no need for anything fancier.
export function solveZeroAngle(state, { maxIter = 20, tolM = 1e-5 } = {}) {
  const { zeroRange, sightHeight, losAngleDeg = 0 } = state;

  // A zero range of 0 (or below) isn't a distance the bullet can actually
  // travel to, so there's no height error to null out — the secant solve
  // degenerates (heightErrorAt() is constant in theta since the
  // integration loop never runs, f1-f0 is always exactly 0, and the
  // update divides by the near-zero fallback and diverges). Treat it as
  // "no elevation correction": fire level, straight down the bore (i.e.
  // along the line of sight itself, whatever its incline).
  if (zeroRange <= 0) return 0;

  const losAngle = (losAngleDeg * Math.PI) / 180;
  const cosL = Math.cos(losAngle), sinL = Math.sin(losAngle);
  const muzzleVelocity = resolveMuzzleVelocity(state);
  const stepper = makeStepper(state);
  const muzzle = losMuzzlePosition(sightHeight, cosL, sinL);

  function heightErrorAt(theta) {
    const boreAngle = losAngle + theta;
    const p0 = {
      x: muzzle.x, y: muzzle.y, z: 0,
      vx: muzzleVelocity * Math.cos(boreAngle),
      vy: muzzleVelocity * Math.sin(boreAngle),
      vz: 0, t: 0
    };
    const rangeOf = (pt) => rangeAlongLOS(pt, cosL, sinL);
    let older = null, prev = null, cur = p0, steps = 0;
    while (rangeOf(cur) < zeroRange && steps < MAX_STEPS) {
      older = prev;
      prev = cur;
      cur = stepper.step(cur);
      steps++;
    }
    const raw = prev === null
      ? cur
      : landOnRange(older, prev, cur, () => (steps < MAX_STEPS ? stepper.step(cur) : null), rangeOf, zeroRange);
    return toLOS(raw, cosL, sinL).drop;
  }

  let theta0 = 0, theta1 = 0.001;
  let f0 = heightErrorAt(theta0), f1 = heightErrorAt(theta1);

  for (let i = 0; i < maxIter && Math.abs(f1) >= tolM; i++) {
    const denom = (f1 - f0) || 1e-12;
    const theta2 = theta1 - (f1 * (theta1 - theta0)) / denom;
    theta0 = theta1; f0 = f1;
    theta1 = theta2; f1 = heightErrorAt(theta1);
  }

  return theta1;
}

// Secant-method solve for the launch yaw (radians, sign whatever
// self-consistently nulls windageCm — see windageErrorAt() below) that
// sends the bullet through zero windage *at zeroRange*, canceling out
// spin drift (see spin-drift.js) by the time it gets there. This is what
// a real rifle's windage turret already does for free: dialing the scope
// until point of impact matches point of aim at the zero range absorbs
// whatever spin drift accumulated by then, without the shooter doing
// anything special about it. This engine has to solve for the equivalent
// bore yaw explicitly, since here it's the bore's own aim being computed,
// not a scope correction layered on afterward.
//
// Only ever meaningfully nonzero when spin drift resolves to something
// other than 'off' (see resolveSpinDriftMode in spin-drift.js — covers
// both the legacy calculateSpinDrift boolean and the newer spinDriftMode
// field, and its own automatic fallback when the requested mode isn't
// actually computable from the five inputs canComputeStability()/
// canMakeStepper4dof() need) *and* the shooter has separately opted in
// to zeroing for it (state.zeroForSpinDrift — see zero-spin-drift-prefs.js;
// a second, more specific switch than just calculating spin drift at all,
// since silently shifting the bore's own horizontal aim changes windage
// at every range, not only the one being zeroed for). Either missing
// means there's nothing to compensate for, so this returns 0 immediately
// without walking the integrator at all, the same "nothing to solve"
// shortcut zeroRange<=0 gets below.
//
// Reuses solveZeroAngle()'s own vertical solve for theta first and holds
// it fixed while solving phi — the two axes don't meaningfully interact
// at the small angles either one ever needs (a fraction of a degree),
// so solving them independently, vertical then horizontal, is exact
// enough; the alternative (a coupled 2D secant/Newton solve) would be
// solving for a coupling this small that it's below the engine's own
// numerical noise floor anyway.
export function solveHorizontalZeroAngle(state, { maxIter = 20, tolM = 1e-5 } = {}) {
  const { zeroRange, sightHeight, losAngleDeg = 0 } = state;
  if (zeroRange <= 0 || !state.zeroForSpinDrift) return 0;

  const muzzleVelocity = resolveMuzzleVelocity(state);
  const mode = resolveSpinDriftMode(state, muzzleVelocity);
  if (mode === 'off') return 0;
  // mccoy4dof's own raw.z (below) already includes physically-integrated
  // drift, so spinDrift stays null there — resolveSpinDrift() itself
  // still only ever answers for the Litz path (see its own doc comment).
  const spinDrift = mode === 'litz' ? resolveSpinDrift(state, muzzleVelocity) : null;

  const losAngle = (losAngleDeg * Math.PI) / 180;
  const cosL = Math.cos(losAngle), sinL = Math.sin(losAngle);
  const theta = solveZeroAngle(state);
  const { step, initialExtra } = stepperForMode(state, mode);
  const muzzle = losMuzzlePosition(sightHeight, cosL, sinL);
  const boreAngle = losAngle + theta;
  // The already-solved vertical pitch fixes how much of muzzleVelocity
  // lies in the vertical plane (vy) vs. available to yaw horizontally
  // (vxy) — phi then rotates just that vxy component between vx/vz,
  // preserving |v| = muzzleVelocity exactly (a proper rotation about the
  // vertical axis), unlike a naive vz = muzzleVelocity*sin(phi) added on
  // the side.
  const vxy = muzzleVelocity * Math.cos(boreAngle);
  const vy = muzzleVelocity * Math.sin(boreAngle);

  // In meters (matching heightErrorAt()'s own drop, not the cm windageCm
  // consumers like toTablePoint()/computeImpact() display) — spinDriftCm
  // is folded in directly for the 'litz' mode, so the target this drives
  // to 0 is exactly "raw windage plus spin drift," the same combined
  // value those two functions compute, at zeroRange's own time of flight
  // specifically. For 'mccoy4dof', raw.z already includes physically-
  // integrated drift on its own (spinDrift is null there — see above),
  // so no addition is needed. Lands on zeroRange via landOnRange()
  // (quadratic — see its own docs above), the same landing method every
  // other "exact range" solve in this file uses, rather than a plain
  // 2-point linear one here alone.
  function windageErrorAt(phi) {
    const p0 = {
      x: muzzle.x, y: muzzle.y, z: 0,
      vx: vxy * Math.cos(phi), vy, vz: vxy * Math.sin(phi), t: 0,
      ...initialExtra
    };
    const rangeOf = (pt) => rangeAlongLOS(pt, cosL, sinL);
    let older = null, prev = null, cur = p0, steps = 0;
    while (rangeOf(cur) < zeroRange && steps < MAX_STEPS) {
      older = prev;
      prev = cur;
      cur = step(cur);
      steps++;
    }
    const raw = prev === null
      ? cur
      : landOnRange(older, prev, cur, () => (steps < MAX_STEPS ? step(cur) : null), rangeOf, zeroRange);
    return raw.z + (spinDrift ? spinDriftCm(spinDrift, raw.t) / 100 : 0);
  }

  let phi0 = 0, phi1 = 0.001;
  let f0 = windageErrorAt(phi0), f1 = windageErrorAt(phi1);

  for (let i = 0; i < maxIter && Math.abs(f1) >= tolM; i++) {
    const denom = (f1 - f0) || 1e-12;
    const phi2 = phi1 - (f1 * (phi1 - phi0)) / denom;
    phi0 = phi1; f0 = f1;
    phi1 = phi2; f1 = windageErrorAt(phi1);
  }

  return phi1;
}

function lerpPoint(a, b, frac) {
  return {
    x: a.x + frac * (b.x - a.x),
    y: a.y + frac * (b.y - a.y),
    z: a.z + frac * (b.z - a.z),
    vx: a.vx + frac * (b.vx - a.vx),
    vy: a.vy + frac * (b.vy - a.vy),
    vz: a.vz + frac * (b.vz - a.vz),
    t: a.t + frac * (b.t - a.t)
  };
}

// 3-point Lagrange interpolation weights for landing on `x` given the
// (not necessarily evenly spaced — RK4's own step size varies with the
// transonic band) abscissas x0,x1,x2. Depends only on those 4 numbers,
// never on which field is being interpolated, so it's computed once per
// landed point (see landOnRange()) and reused across every field via
// applyQuadraticWeights() rather than re-deriving the same 3-point fit
// separately per field.
function quadraticWeights(x0, x1, x2, x) {
  const w0 = ((x - x1) * (x - x2)) / ((x0 - x1) * (x0 - x2));
  const w1 = ((x - x0) * (x - x2)) / ((x1 - x0) * (x1 - x2));
  const w2 = ((x - x0) * (x - x1)) / ((x2 - x0) * (x2 - x1));
  return [w0, w1, w2];
}

function applyQuadraticWeights(a, b, c, [w0, w1, w2]) {
  return {
    x: a.x * w0 + b.x * w1 + c.x * w2,
    y: a.y * w0 + b.y * w1 + c.y * w2,
    z: a.z * w0 + b.z * w1 + c.z * w2,
    vx: a.vx * w0 + b.vx * w1 + c.vx * w2,
    vy: a.vy * w0 + b.vy * w1 + c.vy * w2,
    vz: a.vz * w0 + b.vz * w1 + c.vz * w2,
    t: a.t * w0 + b.t * w1 + c.t * w2
  };
}

// Lands on `targetRange` between raw RK4 points, using quadratic (3-point)
// interpolation wherever a 3rd point is available — empirically ~100x more
// accurate than plain linear at this engine's own H_COARSE/H_FINE step
// sizes, since a quadratic's own interpolation error is one order smaller
// in the local step size than linear's. `older`/`prev`/`cur` are the last
// 3 raw points the caller has walked through (`older` is null only at the
// very first raw segment, where nothing precedes `prev`); `getNext` is a
// thunk — not a precomputed value — so that the 3rd point on the *other*
// side, which can require stepping the integrator forward again, is only
// ever actually computed when the "closest center" choice below calls for
// it (see computeImpact(), called many times per Monte Carlo batch, where
// avoiding that extra step matters).
//
// Center-selection rule: for an interior segment (both `older` and a real
// `next` available), the quadratic is centered on whichever of `prev`/
// `cur` sits closer to `targetRange` — a 3-point fit is most accurate near
// its own center, so anchoring there beats always favoring one side. At
// the first segment (`older` null) or the last (nothing computed past
// `cur` — `getNext()` returns null) only one triple exists, so that's the
// one used regardless of which endpoint is closer. Falls back to plain
// 2-point linear only in the degenerate case where fewer than 3 raw points
// exist at all (e.g. the whole trajectory reaches maxRange in one step).
//
// Exported since anything else that walks this same {x,y,z,vx,vy,vz,t}
// point shape and needs "state at an exact target x" (see bc-estimate.js's
// speedAt(), cd-mach-curve.js's flightAt()) should reuse this rather than
// reading off whatever raw RK4 point happens to overshoot the target —
// the overshoot from one fixed-time step is tens of meters at supersonic
// speed, which used to be read as if it were the answer at the target
// itself.
export function landOnRange(older, prev, cur, getNext, rangeOf, targetRange) {
  const prevRange = rangeOf(prev), curRange = rangeOf(cur);
  const closerToPrev = Math.abs(targetRange - prevRange) <= Math.abs(curRange - targetRange);

  if (closerToPrev && older) {
    return applyQuadraticWeights(older, prev, cur, quadraticWeights(rangeOf(older), prevRange, curRange, targetRange));
  }
  const next = getNext();
  if (next) {
    return applyQuadraticWeights(prev, cur, next, quadraticWeights(prevRange, curRange, rangeOf(next), targetRange));
  }
  if (older) {
    return applyQuadraticWeights(older, prev, cur, quadraticWeights(rangeOf(older), prevRange, curRange, targetRange));
  }
  const frac = (targetRange - prevRange) / (curRange - prevRange || 1);
  return lerpPoint(prev, cur, frac);
}

// `range`/`dropCm` are along/perpendicular to the (possibly inclined)
// line of sight, not raw world x/y — see toLOS() above. `windageCm` is
// untouched by that rotation (the world Z axis is always horizontal,
// perpendicular to the vertical plane the incline tilts), and `velocity`
// is a magnitude, also rotation-invariant. `mach` needs the speed of sound
// *at this point's own altitude* (see temperatureAtHeightDelta in
// atmosphere.js) — `tempC` here is the base (site) temperature, not a
// precomputed constant, since it now varies along the trajectory the same
// way makeStepper's own per-step atmosphere does. `spinDrift` is null
// (spin drift off, or its own required data missing — see spin-drift.js's
// resolveSpinDrift()) or the {sg, twistDirection} it resolved once for
// this whole shot; when present, its cm contribution (which grows with
// this point's own time of flight) is folded into windageCm right here,
// so every consumer of a table point already sees the combined value.
// `exactRange`, when given, overrides the range derived from `p` itself —
// used when `p` was just landed by landOnRange() at a specific requested
// range: that target is already known exactly, so re-deriving it via
// toLOS()'s rotation of the (quadratically interpolated, therefore
// floating-point-noisy at the ~1e-13 relative level) x/y would just
// reintroduce noise into a value the caller already has bit-exact.
function toTablePoint(p, tempC, cosL, sinL, spinDrift, exactRange) {
  const { range, drop } = toLOS(p, cosL, sinL);
  const velocity = Math.sqrt(p.vx * p.vx + p.vy * p.vy + p.vz * p.vz);
  const localTempC = temperatureAtHeightDelta(tempC, p.y);
  const windageCm = p.z * 100 + (spinDrift ? spinDriftCm(spinDrift, p.t) : 0);
  return {
    range: exactRange !== undefined ? exactRange : range, dropCm: drop * 100, windageCm,
    velocity, tof: p.t, mach: velocity / speedOfSound(localTempC)
  };
}

// Full sampled trajectory for display (table + chart), at exact multiples
// of rangeStep from 0 to maxRange inclusive — not just "close to" a step,
// since a shooter reading the table off specific range markers needs the
// row to actually be at that range. Each sample is quadratically
// interpolated between the raw RK4 points that surround it (see
// landOnRange()), never just the nearest raw integration step. Since the
// line-of-sight rotation (see toLOS() above) is linear, interpolating the
// raw world-frame points first and rotating the result is exactly
// equivalent to interpolating range/drop directly — no separate handling
// needed here, and this stays true for the quadratic fit for the same
// reason it was true for the old linear one (both are linear combinations
// of the known point values, which is all that matters for rotation to
// commute with them).
export function integrate(state) {
  const { maxRange, sightHeight, rangeStep, tempC = 15, losAngleDeg = 0 } = state;
  const losAngle = (losAngleDeg * Math.PI) / 180;
  const cosL = Math.cos(losAngle), sinL = Math.sin(losAngle);
  const rangeOf = (pt) => pt.x * cosL + pt.y * sinL;

  const muzzleVelocity = resolveMuzzleVelocity(state);
  const mode = resolveSpinDriftMode(state, muzzleVelocity);
  // mccoy4dof's own trajectory already includes physically-integrated
  // drift in z (see stepperForMode/toTablePoint below) — spinDrift stays
  // null there so toTablePoint()'s `spinDrift ? spinDriftCm(...) : 0`
  // adds nothing on top of it.
  const spinDrift = mode === 'litz' ? resolveSpinDrift(state, muzzleVelocity) : null;
  const launchAngle = solveZeroAngle(state); // radians above the line of sight
  const horizontalZeroAngle = solveHorizontalZeroAngle(state); // radians, bore yaw that nulls spin drift at zeroRange
  const { step: stepFn, initialExtra } = stepperForMode(state, mode);
  const muzzle = losMuzzlePosition(sightHeight, cosL, sinL);
  const boreAngle = losAngle + launchAngle;
  const vxy = muzzleVelocity * Math.cos(boreAngle);

  const p0 = {
    x: muzzle.x, y: muzzle.y, z: 0,
    vx: vxy * Math.cos(horizontalZeroAngle),
    vy: muzzleVelocity * Math.sin(boreAngle),
    vz: vxy * Math.sin(horizontalZeroAngle), t: 0,
    ...initialExtra
  };

  const points = [toTablePoint(p0, tempC, cosL, sinL, spinDrift)]; // range = 0 row

  const step = rangeStep > 0 ? rangeStep : Infinity; // non-positive step: skip intermediate rows, keep 0/maxRange
  let nextSample = step;

  // Emits every requested sample in [rangeOf(prev), rangeOf(cur)], each
  // one landed at its own exact target — see toTablePoint()'s exactRange.
  function emitSamplesInSegment(older, prev, cur, getNext) {
    const curRange = rangeOf(cur);
    while (nextSample <= curRange && nextSample <= maxRange) {
      points.push(toTablePoint(landOnRange(older, prev, cur, getNext, rangeOf, nextSample), tempC, cosL, sinL, spinDrift, nextSample));
      nextSample += step;
    }
  }

  // Raw RK4 walk, one step at a time. A segment [prev, cur]'s samples are
  // emitted once `next` (the raw point one step past `cur`) is known — for
  // every segment but the last, that's simply whatever the walk computes
  // on its following iteration anyway, no extra stepping needed. The
  // final segment (the one whose `cur` reaches or passes maxRange) has no
  // such next iteration, so its `next` is fetched lazily instead — one
  // more RK4 step past maxRange, taken only if landOnRange() actually
  // needs it (i.e. only when a sample in this last segment is closer to
  // `cur` than to `prev`) — and memoized so the "end exactly at maxRange"
  // row below reuses it rather than stepping twice. This mirrors
  // computeImpact()'s own lazy `getNext`, which matters here because the
  // two must land on the identical point for a shared target range (see
  // tests/trajectory.test.js's "stepped table matches the unstepped
  // physics" case) — treating the last segment as artificially cut off
  // from what lies past maxRange, instead of matching what a direct solve
  // at that same range would see, would silently break that invariant.
  let older = null, prev = null, cur = p0, steps = 0;
  while (rangeOf(cur) < maxRange && steps < MAX_STEPS) {
    const newPoint = stepFn(cur);
    steps++;
    if (prev !== null) emitSamplesInSegment(older, prev, cur, () => newPoint);
    older = prev;
    prev = cur;
    cur = newPoint;
  }
  let finalNext;
  const getFinalNext = () => (finalNext !== undefined ? finalNext : (finalNext = steps < MAX_STEPS ? stepFn(cur) : null));
  if (prev !== null) emitSamplesInSegment(older, prev, cur, getFinalNext);

  // Always end exactly at maxRange, even when it doesn't land on a whole
  // multiple of rangeStep — only valid if the walk actually reached it
  // (not cut short by MAX_STEPS) and it's not already the last row.
  const last = points[points.length - 1];
  if (prev !== null && rangeOf(cur) >= maxRange && Math.abs(last.range - maxRange) > 1e-9) {
    points.push(toTablePoint(landOnRange(older, prev, cur, getFinalNext, rangeOf, maxRange), tempC, cosL, sinL, spinDrift, maxRange));
  }

  return { points, launchAngleDeg: (launchAngle * 180) / Math.PI };
}

// Low-allocation single-shot solve: returns only the impact point (relative
// to the sight line) at one target range, no sample array — designed to be
// cheap to call many times in a tight loop (e.g. a Monte Carlo batch).
export function computeImpact(state, targetRange) {
  const { sightHeight, launchAngle, losAngleDeg = 0 } = state;
  const losAngle = (losAngleDeg * Math.PI) / 180;
  const cosL = Math.cos(losAngle), sinL = Math.sin(losAngle);
  const rangeOf = (pt) => rangeAlongLOS(pt, cosL, sinL);

  const muzzleVelocity = resolveMuzzleVelocity(state);
  // hit-probability-view.js's own Monte Carlo dispersion loop calls this
  // (computeImpact) thousands of times per shot group with neither
  // calculateSpinDrift nor spinDriftMode ever set on its state — mode
  // resolves to 'off' there (see resolveSpinDriftMode's own doc comment),
  // so stepperForMode() below returns the plain, cheap 3-DOF stepper
  // exactly as it always has, never the 4-DOF one.
  const mode = resolveSpinDriftMode(state, muzzleVelocity);
  const spinDrift = mode === 'litz' ? resolveSpinDrift(state, muzzleVelocity) : null;
  const theta = launchAngle !== undefined ? launchAngle : solveZeroAngle(state); // radians above the line of sight
  const horizontalZeroAngle = solveHorizontalZeroAngle(state); // radians, bore yaw that nulls spin drift at zeroRange
  const { step, initialExtra } = stepperForMode(state, mode);
  const muzzle = losMuzzlePosition(sightHeight, cosL, sinL);
  const boreAngle = losAngle + theta;
  const vxy = muzzleVelocity * Math.cos(boreAngle);

  const p0 = {
    x: muzzle.x, y: muzzle.y, z: 0,
    vx: vxy * Math.cos(horizontalZeroAngle),
    vy: muzzleVelocity * Math.sin(boreAngle),
    vz: vxy * Math.sin(horizontalZeroAngle), t: 0,
    ...initialExtra
  };

  let older = null, prev = null, cur = p0, steps = 0;
  while (rangeOf(cur) < targetRange && steps < MAX_STEPS) {
    older = prev;
    prev = cur;
    cur = step(cur);
    steps++;
  }

  // `getNext()` steps the integrator one more time only when the
  // "closest center" choice inside landOnRange() actually needs it — the
  // common case (target closer to `prev`, with `older` on hand) never
  // pays for it, which matters here since this runs once per Monte Carlo
  // sample.
  const raw = prev === null
    ? cur // targetRange reached at or before the muzzle itself — nothing to interpolate
    : landOnRange(older, prev, cur, () => (steps < MAX_STEPS ? step(cur) : null), rangeOf, targetRange);

  const los = toLOS(raw, cosL, sinL);
  const windageCm = raw.z * 100 + (spinDrift ? spinDriftCm(spinDrift, raw.t) : 0);
  return {
    dropCm: los.drop * 100,
    windageCm,
    velocity: los.velocity,
    tof: raw.t
  };
}
