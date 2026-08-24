// Converts a piecewise BC specification (2-5 speed segments, each with
// its own BC against a shared reference drag model) into a real,
// bullet-specific Cd-vs-Mach curve — the "Multiple BC" tool's own math,
// distinct from cd-mach-curve.js (which solves Cd from *measured*
// velocity-drop data, a different problem entirely).
//
// The core relationship isn't spelled out anywhere else in this engine —
// trajectory.js's makeStepper() never actually forms a scaled Cd(Mach)
// table for the bc+dragModel path; it folds 1/BC directly into the
// acceleration constant instead (see that file's own comment on
// kFactor). Equating that path's acceleration formula,
//   a = (pi / (8 * LBIN2_TO_KGM2 * BC)) * rho * Cd_std(Mach) * v^2
// against the cdTable path's own,
//   a = (areaM2 / (2 * massKg)) * rho * Cd(Mach) * v^2,
// with areaM2 = (pi/4)*caliberM^2, and solving for the Cd(Mach) that
// makes the two equal at every Mach, gives:
//
//   Cd_effective(Mach) = Cd_std(Mach) * massKg / (LBIN2_TO_KGM2 * BC * caliberM^2)
//
// i.e. one constant multiplier per segment (its own BC, with this tool's
// shared mass/caliber), applied to the reference model's own Cd at every
// Mach in that segment. Verified against a real makeStepper() run (BC+
// dragModel vs. the resulting cdTable, same mass/caliber/BC): the two
// produce identical velocities to within floating-point noise (~1e-16
// relative) across supersonic, transonic, and subsonic speeds.
import { DRAG_TABLES } from './drag-tables.js';
import { LBIN2_TO_KGM2, TRANSONIC_HI, MAX_STEPS } from './constants.js';
import { STANDARD_SEA_LEVEL_SOUND_MS } from './atmosphere.js';
import { makeStepper, landOnRange } from './trajectory.js';
import { estimateBC } from './bc-estimate.js';

// Segment borders/Mach boundaries are always computed against a fixed
// standard sea-level (15°C) atmosphere — a single idealized reference,
// not a real trajectory (same reasoning bc-convert.js's own single-point
// BC conversion already uses the same constant for).
export function machForVelocityMs(velocityMs) {
  return velocityMs / STANDARD_SEA_LEVEL_SOUND_MS;
}

export function velocityMsForMach(mach) {
  return mach * STANDARD_SEA_LEVEL_SOUND_MS;
}

// `segments` is ascending array of { toVelocityMs, bc }: segment i's own
// lower bound is segment (i-1)'s toVelocityMs (0 for i===0); its upper
// bound is its own toVelocityMs (null/undefined for the last segment,
// meaning "and up" — open-ended). `bc` is null/undefined for "not yet
// specified". To avoid the (unlikely) exact-comparison bug at a segment
// boundary, the lower bound is inclusive (>=) and the upper bound is
// exclusive (<) — a table point landing exactly on a border belongs to
// the higher-speed segment.
function segmentIndexForVelocity(segments, velocityMs) {
  for (let i = 0; i < segments.length; i++) {
    const lower = i === 0 ? 0 : segments[i - 1].toVelocityMs;
    const upper = segments[i].toVelocityMs;
    if (velocityMs >= lower && (upper == null || velocityMs < upper)) return i;
  }
  return segments.length - 1; // unreachable given a well-formed segments array (last upper is always null)
}

// The reference table's own native Mach sampling is reused directly
// (DRAG_TABLES[dragModel]) rather than resampling onto a separate
// breakpoint grid — the result *is* the reference curve, piecewise
// rescaled, so it should carry exactly the reference curve's own shape/
// density. `cd` is null wherever the owning segment has no BC yet (or
// mass/caliber aren't set), so the caller can render a gap there rather
// than a fabricated value — see the "disjointed segments" requirement.
export function bcSegmentsToCdCurve({ dragModel, segments, massKg, caliberM }) {
  const table = DRAG_TABLES[dragModel] || DRAG_TABLES.G1;
  const validMassCaliber = massKg > 0 && caliberM > 0;
  return table.map(([mach, cdStd]) => {
    const velocityMs = velocityMsForMach(mach);
    const segmentIndex = segmentIndexForVelocity(segments, velocityMs);
    const bc = segments[segmentIndex].bc;
    const cd = validMassCaliber && bc != null
      ? cdStd * massKg / (LBIN2_TO_KGM2 * bc * caliberM * caliberM)
      : null;
    return { mach, cd, segmentIndex };
  });
}

// Pure validation, no DOM/i18n — the view translates `reason`s into
// messages. `orderOk` false means this segment's own upper border isn't
// strictly greater than its lower one (the "from cannot exceed to" sanity
// check); `bcOk` false means the BC is missing or out of `bcBounds`.
// `allValid` gates Save/CSV/Copy — per spec, those must stay disabled
// until every segment passes, even though the curve itself is computed
// and displayed live (with gaps) for any subset of valid segments.
export function validateSegments(segments, bcBounds) {
  const results = segments.map((seg, i) => {
    const lower = i === 0 ? 0 : segments[i - 1].toVelocityMs;
    const upper = seg.toVelocityMs;
    const orderOk = upper == null || upper > lower;
    const bcOk = seg.bc != null && seg.bc >= bcBounds.min && seg.bc <= bcBounds.max;
    return { orderOk, bcOk, valid: orderOk && bcOk };
  });
  return { segments: results, allValid: results.every((r) => r.valid) };
}

// ---- Optimal (compromise) supersonic BC, per standard G model --------
//
// A single BC value, against a standard reference model, that best
// stands in for this bullet's own (piecewise, segment-specific) drag
// over the supersonic band a shooter actually zeroes and holds for —
// not a fit across the whole domain (which the transonic drag rise
// would dominate and distort), and not any one of the tool's own input
// segments either (those are already exact by construction; this is a
// single-BC *approximation* of them, the same kind of number a
// manufacturer's spec sheet quotes).
//
// Fixed to the standard sea-level (15°C) atmosphere — an idealized
// reference figure, not a real shot — same convention as this file's
// own Mach<->velocity helpers above and bc-convert.js's single-point BC
// conversion.
export const OPTIMAL_BC_START_MACH = 2.5;
// "The beginning of transonic," approached from the supersonic side —
// TRANSONIC_HI (constants.js) is the upper edge of the engine's own
// transonic band (0.85-1.3 Mach), i.e. exactly where a decelerating
// bullet first enters it.
export const OPTIMAL_BC_END_MACH = TRANSONIC_HI;

// Flies the tool's own resulting curve (this function's one source of
// truth for "what this bullet actually does") from OPTIMAL_BC_START_MACH
// down to OPTIMAL_BC_END_MACH and reports the range at which the lower
// Mach is reached — landOnRange() (trajectory.js's own 3-point quadratic
// interpolator, already used for every other "state at an exact X" need
// in this engine) is reused here with *velocity* as the landing
// variable instead of its usual range/time, negated so it's monotonically
// increasing as the bullet slows (the same requirement its other two
// callers, in this file and bc-estimate.js, already satisfy with x/t).
function trueSupersonicRangeM(cdTable, massKg, caliberM) {
  const v1 = OPTIMAL_BC_START_MACH * STANDARD_SEA_LEVEL_SOUND_MS;
  const v2 = OPTIMAL_BC_END_MACH * STANDARD_SEA_LEVEL_SOUND_MS;
  const atmo = { tempC: 15, pressureHpa: 1013.25, altitudeM: 0, humidityPct: 0 };
  const stepper = makeStepper({ cdTable, massKg, caliberM, windSpeed: 0, windAngle: 90, ...atmo });
  const speed = (p) => Math.hypot(p.vx, p.vy, p.vz);

  let older = null, prev = null, cur = { x: 0, y: 0, z: 0, vx: v1, vy: 0, vz: 0, t: 0 };
  let steps = 0;
  while (speed(cur) > v2 && steps < MAX_STEPS) {
    older = prev;
    prev = cur;
    cur = stepper.step(cur);
    steps++;
  }
  if (prev === null) return null; // reached/started below v2 on the very first point — not a real supersonic segment

  const negSpeedOf = (p) => -speed(p);
  const landed = landOnRange(older, prev, cur, () => (steps < MAX_STEPS ? stepper.step(cur) : null), negSpeedOf, -v2);
  return landed.x;
}

// One optimal-BC figure per requested standard model — `dragModelIds`
// is expected to be whichever models are currently enabled in Settings
// (visibleDragModels(), src/drag-model-prefs.js), resolved by the
// caller so this stays a pure function with no prefs dependency of its
// own. `cdTable` is this tool's own resulting curve (bcSegmentsToCdCurve()'s
// output, non-null points only — same shape Save to Arsenal/CSV already
// filter to). Returns `{ dragModel, bc }` on success or
// `{ dragModel, error: true }` when the target isn't reachable within
// estimateBC's own default BC bracket (e.g. this bullet's real
// supersonic drag is so far outside any normal bullet's that no
// standard-model BC reproduces it) — the view renders that as a dash,
// not a thrown error.
export function optimalSupersonicBcs({ cdTable, massKg, caliberM, dragModelIds }) {
  const r2 = (massKg > 0 && caliberM > 0 && cdTable.length > 0) ? trueSupersonicRangeM(cdTable, massKg, caliberM) : null;
  const v1 = OPTIMAL_BC_START_MACH * STANDARD_SEA_LEVEL_SOUND_MS;
  const v2 = OPTIMAL_BC_END_MACH * STANDARD_SEA_LEVEL_SOUND_MS;
  return dragModelIds.map((dragModel) => {
    if (r2 == null) return { dragModel, error: true };
    try {
      const { bc } = estimateBC({
        v1, r1: 0, v2, r2, dragModel,
        tempC: 15, pressureHpa: 1013.25, altitudeM: 0, humidityPct: 0
      });
      return { dragModel, bc };
    } catch {
      return { dragModel, error: true };
    }
  });
}
