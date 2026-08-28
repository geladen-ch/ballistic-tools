// McCoy Modified Point-Mass Model (4-DOF): the same fixed-step RK4 scheme
// as trajectory.js's makeStepper(), extended with a 4th state variable
// (axial spin rate p) and extra force/moment terms driven by it — lift
// and Magnus moment (from yaw of repose), induced yaw-drag, and spin
// decay. No DOM, no `self` — importable by a worker, the main thread, or
// a Node test runner unmodified, same as every other src/engine/*.js
// module.
//
// This implements McCoy eq. 9.56 (the general yaw-of-repose equation)
// with the Magnus *moment* term (CMpα) included, but the Magnus *force*
// term dropped from the translational equation (9.59) — no bullet in the
// sourced literature tables a Magnus force coefficient (CNpα) at all, so
// there's nothing to include it with. This is NOT full aerodynamic jump:
// the dominant new vertical term below comes from spin/Magnus coupling
// with the bullet's own crossrange yaw of repose, and is present even in
// still air — genuine crosswind-induced aero jump would need actual wind
// dependence in the acceleration this term feeds from, which isn't
// modeled here. Implementing real aero jump would need McCoy's Chapter
// 12 physics independently sourced and verified the way this module's
// own yaw-of-repose equations were, which hasn't been done — it remains
// an open, unimplemented feature, not a bug in what's here.
import { GRAVITY, LBIN2_TO_KGM2, TRANSONIC_LO, TRANSONIC_HI, H_COARSE, H_FINE } from './constants.js';
import { DRAG_TABLES, makeCdLookup } from './drag-tables.js';
import { airDensity, temperatureAtHeightDelta, icaoStandardPressureHpa } from './atmosphere.js';
import { estimateAeroCoefficients, canEstimateAeroCoefficients } from './aero-coefficients.js';

// Twist direction is this engine's own convention (spin-drift.js's own
// 'left'/'right' toggle), not McCoy's or Baranowski's implicit axis
// handedness — the sign below was pinned empirically so that a
// right-hand twist produces drift in the same direction (this engine's
// -z, see trajectory.js's own wind-angle convention comment) that the
// existing, already-shipped Litz-based spin-drift.js already produces
// for the same rifle, rather than re-derived from the papers' own frame.
// See trajectory-4dof.test.js's directional-agreement test.
function spinRateRadS(muzzleVelocity, riflingTwistMm, twistDirection) {
  const magnitude = (2 * Math.PI * muzzleVelocity) / (riflingTwistMm / 1000);
  return twistDirection === 'left' ? magnitude : -magnitude;
}

export function canMakeStepper4dof(state) {
  return canEstimateAeroCoefficients(state);
}

// Builds the RK4 step function for one fixed set of shot conditions —
// same contract as trajectory.js's makeStepper(), same drag/atmosphere
// machinery reused verbatim, plus the aero-coefficients estimate (fixed
// for this stepper's whole lifetime, same as kFactor below) computed
// once here rather than per step.
export function makeStepper4dof(state) {
  const {
    bc, dragModel = 'G1', cdTable, massKg, caliberM, lengthM, muzzleVelocity, riflingTwistMm,
    twistDirection = 'right',
    windSpeed = 0, windAngle = 90,
    tempC = 15, pressureHpa = 1013, altitudeM = 0, humidityPct = 0
  } = state;

  const table = cdTable || (DRAG_TABLES[dragModel] || DRAG_TABLES.G1);
  const cdAt = makeCdLookup(table);

  // Unlike makeStepper(), the 4-DOF model always needs the bullet's real
  // physical mass/area (for the lift/yaw-drag/spin-decay terms, which
  // aren't expressible through the BC abstraction the way plain drag
  // is) — guaranteed present here because canMakeStepper4dof() (same
  // gate as canEstimateAeroCoefficients/canComputeStability) has already
  // required them upstream. areaM2/kFactor below are still derived the
  // same two ways trajectory.js's own makeStepper() does, so a BC-only
  // bullet's *drag* still comes from its BC exactly as it would in the
  // 3-DOF model — only the new lift/yaw-drag/spin-decay terms use
  // areaM2/massKg directly.
  const areaM2 = (Math.PI / 4) * caliberM * caliberM;
  const kFactor = cdTable
    ? areaM2 / (2 * massKg)
    : Math.PI / (8 * LBIN2_TO_KGM2 * bc);

  // tempC/pressureHpa/humidityPct here are the shooter's own actual
  // muzzle-height conditions (trajectory.js's own convention — see its
  // atmosphereAt() comment), not sea-level-equivalent — exactly what
  // estimateAeroCoefficients wants for its own Sg/CMalpha atmosphere
  // correction (aero-coefficients.js, stability.js).
  const aero = estimateAeroCoefficients({ massKg, caliberM, lengthM, muzzleVelocity, riflingTwistMm, tempC, pressureHpa, humidityPct });
  const p0 = spinRateRadS(muzzleVelocity, riflingTwistMm, twistDirection);

  const siteStdPressureHpa = icaoStandardPressureHpa(altitudeM);

  // Same "frozen for the whole step" atmosphere convention as
  // trajectory.js's own atmosphereAt() — see that function's comment for
  // why. rho is returned alongside kConst/speedSound here because the
  // new force terms need it directly (kConst already bakes rho into the
  // BC/cdTable abstraction, which the lift/yaw-drag/spin-decay terms
  // don't go through).
  function atmosphereAt(heightDeltaM) {
    const localTempC = temperatureAtHeightDelta(tempC, heightDeltaM);
    const localPressureHpa = pressureHpa * (icaoStandardPressureHpa(altitudeM + heightDeltaM) / siteStdPressureHpa);
    const rho = airDensity({ tempC: localTempC, pressureHpa: localPressureHpa, humidityPct });
    const speedSound = Math.sqrt(1.4 * 287.05 * (localTempC + 273.15));
    return { kConst: rho * kFactor, rho, speedSound };
  }

  const windRad = (windAngle * Math.PI) / 180;
  const windX = -windSpeed * Math.cos(windRad);
  const windZ = windSpeed * Math.sin(windRad);

  function derivatives(vx, vy, vz, p, kConst, rho, speedSound) {
    const relVx = vx - windX, relVz = vz - windZ;
    const speed = Math.sqrt(relVx * relVx + vy * vy + relVz * relVz);
    const mach = speed / speedSound;
    const cd0 = cdAt(mach);

    // Classical (gravity-only) yaw of repose — McCoy eq. 9.57, verified
    // directly against a physical copy of the book (no leading constant
    // unaccounted for) and independently against McCoy's own published
    // drift at 1000 yd for this exact bullet (10"/12"/14" twist, within
    // ~3%, using the bullet's own real Cd0/CLα/CMα table — residual
    // explained by Miller's Sg's own known ~3% approximation, already
    // covered by aero-coefficients.test.js). Gravity (0,-GRAVITY,0) is
    // the only driver of curvature here, so (v x g) has no y-component
    // at all — this classical piece alone can't add a vertical term.
    const cMAlpha = aero.cMAlpha(mach);
    const speed2 = speed * speed;
    const speed4 = speed2 * speed2;
    const denom = rho * areaM2 * caliberM * cMAlpha * speed4;
    const yawScale = (-2 * aero.Ix * p) / denom;
    const aRx0 = yawScale * (relVz * GRAVITY);
    const aRz0 = yawScale * (-relVx * GRAVITY);

    // Magnus-moment correction — McCoy eq. 9.56's second numerator term,
    // with the Magnus *force* term (eq. 9.59) dropped since no sourced
    // bullet tables a CNpα at all (see this file's header comment). The
    // term is alpha_R = alpha_R0 + K*(v x alpha_R) for a scalar K, i.e.
    // self-referential (dV/dt, which the term needs, itself depends on
    // the lift force, which depends on alpha_R) — but linear, so it has
    // an exact closed form rather than needing iteration:
    //   alpha_R = (alpha_R0 + K*(v x alpha_R0)) / (1 + K^2*|v|^2)
    // (verified against a direct 3x3 linear solve before landing here).
    // K itself collapses to a short expression once mass/area/density
    // cancel out of the substitution (see its definition just below).
    const cMpAlpha = aero.cMpAlpha(mach);
    const K = (-caliberM * p * cMpAlpha) / (speed2 * cMAlpha);
    const crossVAx = vy * aRz0;
    const crossVAy = relVz * aRx0 - relVx * aRz0;
    const crossVAz = -vy * aRx0;
    const magnusDenom = 1 + K * K * speed2;
    const aRx = (aRx0 + K * crossVAx) / magnusDenom;
    const aRy = (K * crossVAy) / magnusDenom;
    const aRz = (aRz0 + K * crossVAz) / magnusDenom;
    const aRSq = aRx * aRx + aRy * aRy + aRz * aRz;

    const dragAccel = kConst * cd0 * speed;
    const yawDragAccel = (rho * areaM2 * aero.cDAlpha2(mach) * aRSq / (2 * massKg)) * speed;
    const liftFactor = (rho * areaM2 * aero.cLAlpha(mach) / (2 * massKg)) * speed2;

    // Spin damping: clp(mach) is already negative (an aerodynamically
    // stable roll-damping coefficient), so this decays |p| toward zero
    // on its own — no separate leading minus sign needed. See
    // trajectory-4dof.test.js's decay-direction test.
    const dpdt = (rho * areaM2 * caliberM * caliberM * aero.clp(mach) / (2 * aero.Ix)) * speed * p;

    return {
      ax: -(dragAccel + yawDragAccel) * relVx + liftFactor * aRx,
      ay: -(dragAccel + yawDragAccel) * vy - GRAVITY + liftFactor * aRy,
      az: -(dragAccel + yawDragAccel) * relVz + liftFactor * aRz,
      dpdt,
      mach
    };
  }

  function step(pt) {
    const { kConst, rho, speedSound } = atmosphereAt(pt.y);
    const d0 = derivatives(pt.vx, pt.vy, pt.vz, pt.p, kConst, rho, speedSound);
    const h = (d0.mach > TRANSONIC_LO && d0.mach < TRANSONIC_HI) ? H_FINE : H_COARSE;

    const k1 = d0;
    const k2 = derivatives(pt.vx + k1.ax * h / 2, pt.vy + k1.ay * h / 2, pt.vz + k1.az * h / 2, pt.p + k1.dpdt * h / 2, kConst, rho, speedSound);
    const k3 = derivatives(pt.vx + k2.ax * h / 2, pt.vy + k2.ay * h / 2, pt.vz + k2.az * h / 2, pt.p + k2.dpdt * h / 2, kConst, rho, speedSound);
    const k4 = derivatives(pt.vx + k3.ax * h, pt.vy + k3.ay * h, pt.vz + k3.az * h, pt.p + k3.dpdt * h, kConst, rho, speedSound);

    const ax = (k1.ax + 2 * k2.ax + 2 * k3.ax + k4.ax) / 6;
    const ay = (k1.ay + 2 * k2.ay + 2 * k3.ay + k4.ay) / 6;
    const az = (k1.az + 2 * k2.az + 2 * k3.az + k4.az) / 6;
    const dpdt = (k1.dpdt + 2 * k2.dpdt + 2 * k3.dpdt + k4.dpdt) / 6;

    // Same h^2/6 position-update trick as trajectory.js's makeStepper.
    // ax/ay/az depend on p (via aRx/aRz) as well as vx/vy/vz, but the RK4
    // identity behind this trick only requires that the k1..k4 stages
    // never depend on x/y/z themselves — true here exactly as it is in
    // the 3-DOF stepper, since atmosphere is frozen for the whole step
    // and p gets its own proper sub-stage values (p + k1.dpdt*h/2, etc.)
    // the same way vx/vy/vz do. p is a first-order state like vx/vy/vz
    // (not like x/y/z), so it gets their 1:2:2:1 update below, not this
    // h^2/6 treatment.
    const hh6 = (h * h) / 6;
    return {
      x: pt.x + pt.vx * h + hh6 * (k1.ax + k2.ax + k3.ax),
      y: pt.y + pt.vy * h + hh6 * (k1.ay + k2.ay + k3.ay),
      z: pt.z + pt.vz * h + hh6 * (k1.az + k2.az + k3.az),
      vx: pt.vx + ax * h,
      vy: pt.vy + ay * h,
      vz: pt.vz + az * h,
      p: pt.p + dpdt * h,
      t: pt.t + h
    };
  }

  return { step, p0, aero };
}
