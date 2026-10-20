// Golden-master cases for the SI-units refactor: a large, seeded, randomized
// set of inputs for every engine entry point whose units the refactor
// touches, together with each entry point's output as the engine computed
// it *before* the refactor. tools/si-golden-master/capture.js generates the
// inputs from GENERATORS below and records RUNNERS' outputs into
// tests/golden/<kind>.json; tests/si-golden-master-*.test.js replay every
// case through the same RUNNERS and compare.
//
// Inputs and outputs are stored in the engine's *original* units (mm, cm,
// hPa, degrees, mrad, percent). When an engine module moves to SI, its
// runner here changes to convert the stored input to the new API's units,
// call the new API, and convert the result back — through src/quantity.js,
// like every other conversion — so the fixtures themselves never change
// and keep proving that the refactor did not move a single result.
//
// Some runners need the fake DOM (the truing-session model reads unit
// preferences); callers install it before importing this module.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  integrate, computeImpact, resolveLaunchAngle, solveDirectHit, solveDangerZone, solveZeroAngle, resolveMuzzleVelocity
} from '../../src/engine/trajectory.js';
import {
  airDensity, speedOfSound, icaoStandardPressurePa, temperatureAtHeightDelta, pressureAtAltitude,
  standardAtmosphereAt, altitudeFromPressurePa
} from '../../src/engine/atmosphere.js';
import { hpaToPa, paToHpa, percentToFraction, fractionToPercent, mmToM, mToMm, cmToM, mToCm, degToRad, radToDeg, mradToRad, radToMrad } from '../../src/quantity.js';
import { computeMillerSg, canComputeStability } from '../../src/engine/stability.js';
import { resolveSpinDrift, spinDriftM, resolveSpinDriftMode } from '../../src/engine/spin-drift.js';
import { computeSingleShot } from '../../src/engine/single-shot.js';
import { computeSpotterCorrected } from '../../src/engine/spotter-corrected.js';
import {
  precisionToR50, conventionValueToR50, angularSDToLinear, movingTargetLeadSD, CONVENTION_TO_SD
} from '../../src/engine/dispersion-sources.js';
import {
  estimateBC, estimateBCFromTof, estimateBCFromTimeWindow, predictVelocityAtTimes
} from '../../src/engine/bc-estimate.js';
import { convertBallisticCoefficient } from '../../src/engine/bc-convert.js';
import { bcSegmentsToCdCurve, machForVelocityMs, velocityMsForMach, optimalSupersonicBcs } from '../../src/engine/bc-segments-cd.js';
import { computeCdMachCurve } from '../../src/engine/cd-mach-curve.js';
import { estimateTrackBCWholeWindow, aggregateTracks } from '../../src/engine/labradar-bc.js';
import {
  computeGroupStats, computeCombinedStats, hitProbabilityRadius, oneMoaWidthM, oneMradWidthM, linearToAngularUnit
} from '../../src/engine/rifle-precision-stats.js';
import { DRAG_TABLES } from '../../src/engine/drag-tables.js';
import { decodeRiflePrecisionProject } from '../../src/record-codec.js';

const BULLETS_DIR = new URL('../../src/bullets/', import.meta.url);
const readCatalog = (name) => JSON.parse(readFileSync(fileURLToPath(new URL(`${name}/bullets.json`, BULLETS_DIR)), 'utf8'));
const CATALOG = [...readCatalog('geladen'), ...readCatalog('lapua-cd'), ...readCatalog('berger-published')]
  .filter((b) => b.massKg && b.caliberM && b.profile);
const BC_BULLETS = CATALOG.filter((b) => b.profile.type === 'bc');
const CD_BULLETS = CATALOG.filter((b) => b.profile.type === 'cdTable');
const DRAG_MODEL_IDS = Object.keys(DRAG_TABLES);

// ---- seeded randomness (mulberry32), so a regeneration is reproducible ----
export function makeRng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    uniform: (lo, hi) => lo + (hi - lo) * next(),
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    pick: (list) => list[Math.floor(next() * list.length)],
    chance: (p) => next() < p
  };
}

const round = (x, decimals) => Number(x.toFixed(decimals));

// One sub-result of a runner that may legitimately throw (an estimator with
// no solution in its bracket), recorded as its error so the case's other
// sub-results are still compared.
function attempt(fn) {
  try {
    return fn();
  } catch (err) {
    return { $error: String((err && err.message) || err) };
  }
}

// One shot state the way the trajectory, range-solver and arsenal views
// build it: a bullet (BC or Cd table), a rifle, a cartridge, the air, wind.
function shotState(rng, { wind = true } = {}) {
  const useCd = rng.chance(0.3) && CD_BULLETS.length;
  const bullet = useCd ? rng.pick(CD_BULLETS) : rng.pick(BC_BULLETS);
  const state = {
    muzzleVelocity: round(rng.uniform(300, 1000), 2),
    // (fine steps only at shorter ranges, to keep the fixtures small)
    massKg: bullet.massKg, caliberM: bullet.caliberM,
    ...(bullet.lengthM ? { lengthM: bullet.lengthM } : {}),
    maxRange: rng.pick([300, 600, 1000, 1500]),
    rangeStep: rng.pick([10, 25, 50, 100]),
    zeroRange: rng.pick([0, 25, 50, 100, 100, 200, 300]),
    sightHeight: round(rng.uniform(20, 90), 1),
    windSpeed: wind ? round(rng.uniform(0, 12), 2) : 0,
    windAngle: wind ? rng.int(0, 359) : 90,
    tempC: round(rng.uniform(-20, 40), 1),
    pressureHpa: round(rng.uniform(800, 1050), 2),
    altitudeM: rng.int(0, 3000),
    humidityPct: rng.int(0, 100),
    losAngleDeg: rng.chance(0.6) ? 0 : round(rng.uniform(-30, 30), 1)
  };
  if (state.maxRange > 600 && state.rangeStep < 50) state.rangeStep = 50;
  if (useCd) {
    state.cdTable = bullet.profile.table;
  } else {
    state.bc = round(bullet.profile.bc * rng.uniform(0.9, 1.1), 4);
    state.dragModel = rng.chance(0.15) ? rng.pick(DRAG_MODEL_IDS) : bullet.profile.model;
  }
  if (rng.chance(0.6)) {
    state.riflingTwistMm = rng.int(180, 400);
    state.twistDirection = rng.chance(0.8) ? 'right' : 'left';
  }
  state.spinDriftMode = rng.pick(['off', 'litz', 'mccoy4dof']);
  state.zeroForSpinDrift = rng.chance(0.5);
  if (rng.chance(0.4)) {
    state.referenceTempC = round(rng.uniform(-10, 30), 1);
    state.velocityTempSensitivity = round(rng.uniform(-0.5, 2), 2);
  }
  if (rng.chance(0.3)) state.bcGainFactor = round(rng.uniform(0.9, 1.1), 3);
  if (rng.chance(0.15)) {
    const donor = rng.pick(BC_BULLETS);
    state.zeroDonorBallistics = {
      muzzleVelocity: round(rng.uniform(600, 950), 1), referenceTempC: null, velocityTempSensitivity: null,
      bcGainFactor: 1, cdTable: null, bc: donor.profile.bc, dragModel: donor.profile.model,
      massKg: donor.massKg, caliberM: donor.caliberM,
      zeroAtmosphere: rng.chance(0.5)
        ? { tempC: round(rng.uniform(-10, 30), 1), pressureHpa: round(rng.uniform(850, 1030), 1), humidityPct: rng.int(0, 100), altitudeM: rng.int(0, 2000) }
        : null
    };
  }
  if (rng.chance(0.15)) {
    state.zeroAtmosphere = { tempC: round(rng.uniform(-10, 30), 1), pressureHpa: round(rng.uniform(850, 1030), 1), humidityPct: rng.int(0, 100), altitudeM: rng.int(0, 2000) };
  }
  return state;
}

function errorsInput(rng) {
  const detailed = rng.chance(0.5);
  return {
    ownErrors: {
      muzzleVelocitySD: rng.chance(0.8) ? round(rng.uniform(0, 12), 1) : 0,
      precisionMode: detailed ? 'detailed' : 'simplified',
      detailed: { benchR50: round(rng.uniform(0, 0.6), 3), shooterR50: round(rng.uniform(0, 0.8), 3), positionH: round(rng.uniform(0.5, 1.5), 2), positionV: round(rng.uniform(0.5, 1.5), 2) },
      simplified: { value: round(rng.uniform(0, 1.5), 3), convention: rng.pick(Object.keys(CONVENTION_TO_SD)) }
    },
    conditionErrors: {
      distanceMedianErrorPct: rng.chance(0.7) ? round(rng.uniform(0, 10), 1) : 0,
      tempMedianErrorC: rng.chance(0.7) ? round(rng.uniform(0, 10), 1) : 0,
      pressureMedianErrorHpa: rng.chance(0.7) ? round(rng.uniform(0, 15), 1) : 0,
      windMedianErrorMs: rng.chance(0.7) ? round(rng.uniform(0, 4), 1) : 0,
      movingTarget: rng.chance(0.3)
        ? { speedMs: round(rng.uniform(0.5, 8), 1), speedMedianErrorPct: round(rng.uniform(5, 50), 0) }
        : { speedMs: 0, speedMedianErrorPct: 0 }
    }
  };
}

function atmoInput(rng) {
  return { tempC: round(rng.uniform(-20, 40), 1), pressureHpa: round(rng.uniform(800, 1050), 2), altitudeM: rng.int(0, 3000), humidityPct: rng.int(0, 100) };
}

// A synthetic Labradar track: velocities along a real BC's own decay,
// sampled on a radar-like time grid, with deterministic noise.
function labradarTrack(rng) {
  const bc = round(rng.uniform(0.18, 0.32), 3);
  const v1 = round(rng.uniform(700, 950), 1);
  const atmo = atmoInput(rng);
  const n = rng.int(20, 60);
  const dt = rng.uniform(0.002, 0.006);
  const times = Array.from({ length: n }, (_, i) => i * dt);
  const velocities = predictVelocityAtTimes({ bc, v1, times, dragModel: 'G7', ...atmo });
  let dist = 0;
  const points = times.map((t, i) => {
    if (i > 0) dist += (velocities[i] + velocities[i - 1]) / 2 * dt;
    const outlier = rng.chance(0.03) ? rng.uniform(-40, 40) : 0;
    return { t, v: velocities[i] + rng.uniform(-0.6, 0.6) + outlier, dist, snr: rng.uniform(5, 30), a: rng.uniform(0, 1) };
  });
  return { points, dragModel: 'G7', atmo, minLeft: 10, r2CleanThreshold: rng.pick([0.95, 0.98, 0.99]) };
}

function riflePrecisionProject(rng) {
  const targets = Array.from({ length: rng.int(1, 3) }, (_, ti) => {
    const photoWidth = rng.int(800, 4000);
    const photoHeight = rng.int(800, 4000);
    const groups = Array.from({ length: rng.int(1, 3) }, (_, gi) => {
      const poa = { x: rng.uniform(0.3, 0.7), y: rng.uniform(0.3, 0.7) };
      const spread = rng.uniform(0.005, 0.05);
      return {
        id: `g${ti}-${gi}`, poa,
        shots: Array.from({ length: rng.int(1, 10) }, () => ({ x: poa.x + rng.uniform(-spread, spread) + rng.uniform(-0.01, 0.01), y: poa.y + rng.uniform(-spread, spread) }))
      };
    });
    return {
      id: `t${ti}`, name: `Target ${ti}`, photoWidth, photoHeight,
      calibration: rng.chance(0.9)
        ? { point1: { x: rng.uniform(0.05, 0.3), y: rng.uniform(0.05, 0.95) }, point2: { x: rng.uniform(0.7, 0.95), y: rng.uniform(0.05, 0.95) }, realLengthMm: round(rng.uniform(50, 500), 1) }
        : { point1: null, point2: null, realLengthMm: null },
      groups
    };
  });
  return { distanceM: rng.pick([25, 50, 100, 200, 300]), caliberMm: rng.pick([5.56, 6.5, 7.62, 8.6]), targets };
}

// ---- truing session ----
// Imported lazily: these modules read unit preferences, which need the fake
// DOM a caller installs first.
let truing = null;
async function loadTruing() {
  if (!truing) {
    const sm = await import('../../src/ui/truing-session/session-model.js');
    const ts = await import('../../src/engine/truing-session.js');
    const { computePrepare } = await import('../../src/ui/truing-session/prepare-compute.js');
    truing = { sm, ts, computePrepare };
  }
  return truing;
}

function truingState(rng) {
  const bullet = rng.pick(BC_BULLETS.filter((b) => b.profile.model === 'G7'));
  return {
    dragModel: 'G7', bc: round(bullet.profile.bc * rng.uniform(0.95, 1.05), 4),
    muzzleVelocity: round(rng.uniform(720, 900), 2), zeroRange: rng.pick([100, 100, 200]),
    sightHeight: round(rng.uniform(35, 70), 0), tempC: round(rng.uniform(-5, 30), 1),
    pressureHpa: round(rng.uniform(880, 1030), 2), altitudeM: rng.int(0, 1500), humidityPct: rng.int(0, 90),
    windSpeed: 0, windAngle: 90, losAngleDeg: 0
  };
}

function truingAnalyseInput(rng, ts) {
  const state = truingState(rng);
  const far = rng.int(5, 10) * 100;
  const mid = rng.chance(0.5) ? rng.int(3, Math.floor(far / 100) - 1) * 100 : null;
  const slope = rng.chance(0.3) ? round(rng.uniform(-12, 12), 1) : 0;
  const location = {
    targets: [
      { id: 'near', name: 'Near', rangeM: state.zeroRange, losAngleDeg: 0 },
      ...(mid ? [{ id: 'mid', name: 'Mid', rangeM: mid, losAngleDeg: slope }] : []),
      { id: 'far', name: 'Far', rangeM: far, losAngleDeg: 0 }
    ]
  };
  const dragPct = round(rng.uniform(-8, 8), 2);
  const truth = { ...state, bcGainFactor: 1 / (1 + dragPct / 100), muzzleVelocity: state.muzzleVelocity + rng.uniform(-8, 8) };
  const chrono = rng.chance(0.6) ? Array.from({ length: rng.int(3, 12) }, () => round(truth.muzzleVelocity + rng.uniform(-4, 4), 1)) : undefined;
  const r50Mrad = round(rng.uniform(0.08, 0.25), 3);
  const group = (key, rangeM, shots, extra = {}) => ({
    rangeM, targetKey: key,
    observedComeUp: ts.comeUpMrad(toCurrentUnits({ ...truth, losAngleDeg: extra.losAngleDeg ?? 0 }), rangeM) + rng.uniform(-0.05, 0.05),
    shots, sigmaMrad: ts.sigmaForGroup({ shots, r50Mrad })
  });
  const groups = [
    { ...group('near', state.zeroRange, 4), ...(chrono ? { chronoVelocities: chrono } : {}) },
    ...(mid ? [group('mid', mid, rng.int(3, 6), { losAngleDeg: slope })] : []),
    group('far', far, rng.int(5, 10))
  ];
  const homework = {
    zeroVerified: rng.chance(0.8), trackTested: rng.chance(0.5), mvSD: round(rng.uniform(2, 8), 1),
    chronographAvailable: !!chrono, r50Mrad
  };
  return { state, location, session: { groups }, homework, rMax: far };
}

function truingPrepareInput(rng) {
  const state = truingState(rng);
  const all = [100, 150, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
  const availableDistances = all.filter(() => rng.chance(0.6));
  if (!availableDistances.includes(state.zeroRange)) availableDistances.unshift(state.zeroRange);
  availableDistances.sort((a, b) => a - b);
  return {
    state,
    homework: {
      r50Mrad: round(rng.uniform(0.08, 0.25), 3), mvSD: round(rng.uniform(2, 8), 1),
      windStrength: rng.pick(['calm', 'moderate', 'strong']), backdropHeightM: rng.pick([2, 4, 8]),
      chronographAvailable: rng.chance(0.5)
    },
    availableDistances, registeredDistances: availableDistances,
    roundBudget: rng.chance(0.5) ? rng.pick([12, 20, 30]) : null
  };
}

// ---- generators: kind → (rng) → one input ----
export const GENERATORS = {
  trajectory: (rng) => shotState(rng),
  impact: (rng) => {
    const state = shotState(rng);
    return { state, ranges: Array.from({ length: 5 }, () => rng.int(1, state.maxRange)) };
  },
  directHit: (rng) => ({ ...shotState(rng), targetHeightCm: rng.int(10, 120), aimingPoint: rng.pick(['center', 'bottomEdge']) }),
  dangerZone: (rng) => ({ ...shotState(rng), targetHeightCm: rng.int(10, 120), aimingPoint: rng.pick(['center', 'bottomEdge']) }),
  singleShot: (rng) => {
    const nominalState = shotState(rng, { wind: false });
    return {
      nominalState, targetRange: rng.int(50, 1000), battleZeroRange: rng.chance(0.3) ? rng.int(100, 400) : null,
      aimOffsetXCm: rng.chance(0.3) ? round(rng.uniform(-20, 20), 1) : 0, aimOffsetYCm: rng.chance(0.3) ? round(rng.uniform(-20, 20), 1) : 0,
      ...errorsInput(rng)
    };
  },
  spotterCorrected: (rng) => {
    const nominalState = shotState(rng, { wind: false });
    return {
      nominalState, targetRange: rng.int(50, 1000), battleZeroRange: rng.chance(0.3) ? rng.int(100, 400) : null,
      aimOffsetXCm: 0, aimOffsetYCm: 0, ...errorsInput(rng),
      sightingShotCount: rng.int(1, 5), spotterMeasureMrad: round(rng.uniform(0, 1), 2)
    };
  },
  stability: (rng) => {
    const b = rng.pick(CATALOG.filter((x) => x.lengthM));
    return {
      massKg: b.massKg, caliberM: b.caliberM, lengthM: b.lengthM, muzzleVelocity: round(rng.uniform(300, 1000), 1),
      riflingTwistMm: rng.int(150, 450), tempC: round(rng.uniform(-20, 40), 1), pressureHpa: round(rng.uniform(800, 1050), 1),
      humidityPct: rng.int(0, 100), twistDirection: rng.pick(['right', 'left']), spinDriftMode: rng.pick(['litz', 'mccoy4dof']),
      tof: round(rng.uniform(0.1, 3), 3)
    };
  },
  atmosphere: (rng) => ({ ...atmoInput(rng), heightDeltaM: round(rng.uniform(-300, 300), 1), otherAltitudeM: rng.int(0, 4000) }),
  bcEstimate: (rng) => {
    const atmo = atmoInput(rng);
    const v1 = round(rng.uniform(600, 1000), 1);
    const r1 = rng.int(0, 50);
    const r2 = r1 + rng.int(50, 500);
    const v2 = round(v1 * rng.uniform(0.75, 0.97), 1);
    const tof = round(((r2 - r1) / ((v1 + v2) / 2)) * rng.uniform(1, 1.02), 5);
    return { v1, r1, r2, v2, tof, t2: tof, dragModel: rng.pick(['G1', 'G7']), ...atmo };
  },
  bcConvert: (rng) => ({
    bc: round(rng.uniform(0.15, 0.7), 3), sourceModel: rng.pick(DRAG_MODEL_IDS), targetModel: rng.pick(DRAG_MODEL_IDS),
    velocityMs: round(rng.uniform(300, 1000), 1)
  }),
  bcSegments: (rng) => {
    const b = rng.pick(CATALOG);
    const n = rng.int(1, 4);
    const edges = Array.from({ length: n - 1 }, () => rng.int(400, 900)).sort((x, y) => x - y);
    return {
      dragModel: rng.pick(['G1', 'G7']), massKg: b.massKg, caliberM: b.caliberM,
      segments: Array.from({ length: n }, (_, i) => ({ bc: round(rng.uniform(0.15, 0.6), 3), toVelocityMs: i < n - 1 ? edges[i] : null })),
      velocity: round(rng.uniform(200, 1100), 1), mach: round(rng.uniform(0.5, 3), 3)
    };
  },
  optimalBcs: (rng) => {
    const b = rng.pick(CD_BULLETS);
    return { cdTable: b.profile.table, massKg: b.massKg, caliberM: b.caliberM, dragModelIds: ['G1', 'G7'] };
  },
  cdMachCurve: (rng) => {
    const b = rng.pick(BC_BULLETS);
    const atmo = atmoInput(rng);
    const state = { ...shotState(rng), bc: b.profile.bc, dragModel: b.profile.model, cdTable: undefined, ...atmo, windSpeed: 0, losAngleDeg: 0, maxRange: 1000, rangeStep: 100 };
    const { points } = integrate(toCurrentUnits(state));
    return {
      points: points.map((p) => ({ rangeM: p.range, velocityMs: round(p.velocity + rng.uniform(-1, 1), 1) })),
      massKg: b.massKg, caliberM: b.caliberM, ...atmo
    };
  },
  labradar: (rng) => labradarTrack(rng),
  dispersion: (rng) => ({
    precision: errorsInput(rng).ownErrors,
    valueMrad: round(rng.uniform(0, 2), 3), convention: rng.pick(Object.keys(CONVENTION_TO_SD)),
    sdMrad: round(rng.uniform(0, 1), 3), rangeM: rng.int(10, 1500),
    speedMs: round(rng.uniform(0, 8), 1), speedErrorPct: round(rng.uniform(0, 50), 1), tof: round(rng.uniform(0.05, 3), 3)
  }),
  riflePrecision: (rng) => ({ project: riflePrecisionProject(rng), percent: rng.int(1, 99), unit: rng.pick(['arcmin', 'mrad']) }),
  truingComeUp: (rng) => ({ state: { ...truingState(rng), losAngleDeg: rng.chance(0.4) ? round(rng.uniform(-15, 15), 1) : 0, windSpeed: round(rng.uniform(0, 8), 1), windAngle: rng.int(0, 359) }, ranges: [100, 300, 500, 800].filter(() => rng.chance(0.8)) }),
  truingAnalyse: 'async',
  truingPrepare: (rng) => truingPrepareInput(rng)
};

// truingAnalyse inputs need the truing modules to synthesize observed
// come-ups, so their generator is async.
export async function generateInput(kind, rng) {
  if (kind === 'truingAnalyse') {
    const { ts } = await loadTruing();
    return truingAnalyseInput(rng, ts);
  }
  return GENERATORS[kind](rng);
}

// ---- fixture units ↔ the engine's current units ----
// Every field the refactor renames (because its unit changed), with the
// conversion from the fixture's original unit and back. Applied to every
// object key at any depth of an input before it reaches the engine, and in
// reverse to every output, so the runners below speak the current engine
// API while fixtures stay in the units they were recorded in.
const RENAMED_FIELDS = [
  ['pressureHpa', 'pressurePa', hpaToPa, paToHpa],
  ['humidityPct', 'humidity', percentToFraction, fractionToPercent],
  ['pressureMedianErrorHpa', 'pressureMedianErrorPa', hpaToPa, paToHpa],
  ['sightHeight', 'sightHeightM', mmToM, mToMm],
  ['riflingTwistMm', 'riflingTwistM', mmToM, mToMm],
  ['dropCm', 'dropM', cmToM, mToCm],
  ['windageCm', 'windageM', cmToM, mToCm],
  ['targetHeightCm', 'targetHeightM', cmToM, mToCm],
  ['aimOffsetXCm', 'aimOffsetXM', cmToM, mToCm],
  ['aimOffsetYCm', 'aimOffsetYM', cmToM, mToCm],
  ['losAngleDeg', 'losAngleRad', degToRad, radToDeg],
  ['windAngle', 'windAngleRad', degToRad, radToDeg],
  ['launchAngleDeg', 'launchAngleRad', degToRad, radToDeg],
  ['distanceMedianErrorPct', 'distanceMedianError', percentToFraction, fractionToPercent],
  ['speedMedianErrorPct', 'speedMedianError', percentToFraction, fractionToPercent],
  ['spotterMeasureMrad', 'spotterMeasureRad', mradToRad, radToMrad],
  ['ci95PctBc', 'ci95RelBc', percentToFraction, fractionToPercent]
];

// Rifle precision inputs whose unit changed but whose names did not (mrad
// in the fixtures, rad in the engine).
function ownErrorsToRad(own) {
  return {
    ...own,
    detailed: own.detailed && { ...own.detailed, benchR50: mradToRad(own.detailed.benchR50), shooterR50: mradToRad(own.detailed.shooterR50) },
    simplified: own.simplified && { ...own.simplified, value: mradToRad(own.simplified.value) }
  };
}
// Subtrees passed on as they are: a location, whose targets' inclines in
// degrees are what the Truing Session works with (see fit-units.js's
// locationToFit).
const KEEP_AS_STORED = new Set(['location']);
const TO_CURRENT = new Map(RENAMED_FIELDS.map(([legacy, current, forward]) => [legacy, [current, forward]]));
const TO_LEGACY = new Map(RENAMED_FIELDS.map(([legacy, current, , back]) => [current, [legacy, back]]));

function renameDeep(value, table) {
  if (Array.isArray(value)) return value.map((v) => renameDeep(v, table));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (KEEP_AS_STORED.has(k)) { out[k] = v; continue; }
      const hit = table.get(k);
      if (hit && typeof v === 'number') out[hit[0]] = hit[1](v);
      else out[hit && v == null ? hit[0] : k] = renameDeep(v, table);
    }
    return out;
  }
  return value;
}
export const toCurrentUnits = (input) => renameDeep(input, TO_CURRENT);
export const toLegacyUnits = (output) => renameDeep(output, TO_LEGACY);

// Hit-probability results carry their linear SDs and offsets under generic
// names (sdX, offsetY, a contribution's x/y, ...); the fixtures hold them
// in cm.
const LINEAR_RESULT_KEY = /^(?:sd[XY]|offset[XY]|x|y|ownSd[XY]|conditionSd[XY])$/;
function linearToCm(value) {
  if (Array.isArray(value)) return value.map(linearToCm);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = typeof v === 'number' && LINEAR_RESULT_KEY.test(k) ? mToCm(v) : linearToCm(v);
    return out;
  }
  return value;
}

// One case, the way capture and replay both run it: fixture input in, engine
// output back in fixture units.
export async function runCase(kind, input) {
  return toLegacyUnits(await RUNNERS[kind](toCurrentUnits(input)));
}

// ---- runners: kind → (input) → output, in the engine's current units ----
export const RUNNERS = {
  trajectory: (s) => integrate(s),
  impact: ({ state, ranges }) => {
    const launchAngle = resolveLaunchAngle(state);
    return { launchAngle, muzzleVelocity: resolveMuzzleVelocity(state), impacts: ranges.map((r) => computeImpact({ ...state, launchAngle }, r)) };
  },
  directHit: (s) => solveDirectHit(s),
  dangerZone: (s) => solveDangerZone(s),
  singleShot: (input) => linearToCm(computeSingleShot({ ...input, ownErrors: ownErrorsToRad(input.ownErrors) })),
  spotterCorrected: (input) => linearToCm(computeSpotterCorrected({ ...input, ownErrors: ownErrorsToRad(input.ownErrors) })),
  stability: (s) => {
    const can = canComputeStability(s);
    const sg = can ? computeMillerSg(s) : null;
    const drift = resolveSpinDrift(s, s.muzzleVelocity);
    return { can, sg, mode: resolveSpinDriftMode(s, s.muzzleVelocity), drift, driftCm: drift ? mToCm(spinDriftM(drift, s.tof)) : null };
  },
  atmosphere: (a) => ({
    density: airDensity(a),
    speedOfSound: speedOfSound(a.tempC),
    icao: paToHpa(icaoStandardPressurePa(a.altitudeM)),
    tempAtDelta: temperatureAtHeightDelta(a.tempC, a.heightDeltaM),
    pressureAtOther: paToHpa(pressureAtAltitude(a.pressurePa, a.altitudeM, a.otherAltitudeM)),
    standard: standardAtmosphereAt(a.altitudeM),
    altitudeFromPressure: altitudeFromPressurePa(a.pressurePa)
  }),
  bcEstimate: (i) => ({
    twoVelocities: attempt(() => estimateBC(i)),
    tof: attempt(() => estimateBCFromTof(i)),
    timeWindow: attempt(() => estimateBCFromTimeWindow({ ...i, t2: i.tof })),
    predicted: predictVelocityAtTimes({ ...i, bc: 0.25, times: [0, i.tof / 2, i.tof] })
  }),
  bcConvert: (i) => convertBallisticCoefficient(i),
  bcSegments: (i) => ({
    curve: bcSegmentsToCdCurve(i), mach: machForVelocityMs(i.velocity), velocity: velocityMsForMach(i.mach)
  }),
  optimalBcs: (i) => optimalSupersonicBcs(i),
  cdMachCurve: (i) => computeCdMachCurve(i),
  labradar: (i) => {
    const result = estimateTrackBCWholeWindow(i);
    return { result, aggregate: aggregateTracks([result, { ...result, bc: result.bc * 1.01 }]) };
  },
  dispersion: (i) => ({
    r50: radToMrad(precisionToR50(ownErrorsToRad(i.precision))),
    convention: conventionValueToR50(i.valueMrad, i.convention),
    linear: mToCm(angularSDToLinear(mradToRad(i.sdMrad), i.rangeM)),
    lead: linearToCm(movingTargetLeadSD(i.speedMs, percentToFraction(i.speedErrorPct), i.tof))
  }),
  riflePrecision: ({ project: stored, percent, unit }) => {
    // the fixture's project is a stored record (caliber and ruler in mm)
    const project = decodeRiflePrecisionProject(stored);
    const combined = computeCombinedStats(project);
    // the fixtures hold every length in mm, under the old mm names
    const point = (p) => ({ x: mToMm(p.x), y: mToMm(p.y) });
    const groupInMm = (g) => g && { extremeSpreadMm: mToMm(g.extremeSpreadM), extremePairIndices: g.extremePairIndices, poiMm: point(g.poiM) };
    const { poiM, poiCiM, pooledShots, ...rest } = combined;
    const combinedInMm = {
      ...rest,
      pooledShots: pooledShots.map(({ xM, yM, ...shot }) => ({ xMm: mToMm(xM), yMm: mToMm(yM), ...shot })),
      ...(poiM ? { poiMm: point(poiM), poiCiMm: point(poiCiM) } : {}),
      ...Object.fromEntries(['sigma', 'r50', 'r95', 'r95LowerBound', 'r95UpperBound', 'r99', 'd5x', 'd10x']
        .filter((k) => rest[k] != null).map((k) => [k, mToMm(rest[k])]))
    };
    return {
      groups: project.targets.flatMap((t) => t.groups.map((g) => groupInMm(computeGroupStats(g, t)))),
      combined: combinedInMm,
      hitRadius: combined.sigma ? mToMm(hitProbabilityRadius(combined.sigma, percent)) : null,
      oneMoa: mToMm(oneMoaWidthM(project.distanceM)),
      oneMrad: mToMm(oneMradWidthM(project.distanceM)),
      angular: combined.r50 ? linearToAngularUnit(combined.r50, unit, project.distanceM) : null
    };
  },
  truingComeUp: async ({ state, ranges }) => {
    const { ts } = await loadTruing();
    return ranges.map((r) => ({ comeUp: ts.comeUpMrad(state, r), windage: ts.windageMrad(state, r) }));
  },
  truingAnalyse: async ({ state, location, session, homework, rMax }) => {
    const { sm } = await loadTruing();
    const targets = sm.sessionTargets({ location });
    const observations = sm.buildObservations({ state, session, targets, rangeDeclaredFlat: true, mvSD: homework.mvSD });
    const { joint, ...analysis } = sm.analyseSession({
      state, observations, priors: sm.sessionPriors(homework), params: sm.sessionParams(homework),
      causes: sm.reportedCauses(homework), rechecked: true, rMax, chronoN: sm.chronoCount(session), targets
    });
    return { observations, analysis };
  },
  truingPrepare: async (input) => {
    const { computePrepare } = await loadTruing();
    return computePrepare(structuredClone(input));
  }
};

// Every kind and how many cases the capture generates for it.
export const CASE_COUNTS = {
  trajectory: 400, impact: 200, directHit: 24, dangerZone: 80, singleShot: 120, spotterCorrected: 80,
  stability: 200, atmosphere: 300, bcEstimate: 100, bcConvert: 120, bcSegments: 80, optimalBcs: 10,
  cdMachCurve: 30, labradar: 30, dispersion: 150, riflePrecision: 60, truingComeUp: 80, truingAnalyse: 40, truingPrepare: 16
};

// ---- fixture encoding ----
// JSON can't hold NaN, ±Infinity, -0 or undefined, all of which engine
// output can contain. Non-finite numbers are tagged; -0 and undefined are
// normalized away (they compare equal to 0 and to "absent" respectively —
// the engine never gives either a meaning of its own).
export function encode(value) {
  return JSON.parse(JSON.stringify(value, (_k, v) => {
    if (typeof v === 'number' && !Number.isFinite(v)) return { $num: String(v) };
    return v;
  }));
}

export function decode(value) {
  if (Array.isArray(value)) return value.map(decode);
  if (value && typeof value === 'object') {
    if (Object.keys(value).length === 1 && typeof value.$num === 'string') return Number(value.$num);
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = decode(v);
    return out;
  }
  return value;
}

// Structural comparison with a numeric tolerance; returns the first few
// differences as readable strings (empty means equal).
export function compareOutputs(expected, actual, { rel = 1e-12, abs = 1e-12 } = {}, path = '$', out = []) {
  if (out.length >= 8) return out;
  if (typeof expected === 'number' && typeof actual === 'number') {
    if (Number.isNaN(expected) && Number.isNaN(actual)) return out;
    if (expected === actual) return out;
    if (!Number.isFinite(expected) || !Number.isFinite(actual)) { out.push(`${path}: ${expected} vs ${actual}`); return out; }
    const tol = abs + rel * Math.max(Math.abs(expected), Math.abs(actual));
    if (Math.abs(expected - actual) > tol) out.push(`${path}: ${expected} vs ${actual}`);
    return out;
  }
  if (Array.isArray(expected) || Array.isArray(actual)) {
    if (!Array.isArray(expected) || !Array.isArray(actual) || expected.length !== actual.length) {
      out.push(`${path}: array shape differs (${Array.isArray(expected) ? expected.length : typeof expected} vs ${Array.isArray(actual) ? actual.length : typeof actual})`);
      return out;
    }
    expected.forEach((e, i) => compareOutputs(e, actual[i], { rel, abs }, `${path}[${i}]`, out));
    return out;
  }
  if (expected && actual && typeof expected === 'object' && typeof actual === 'object') {
    const keys = new Set([...Object.keys(expected), ...Object.keys(actual)]);
    for (const k of keys) compareOutputs(expected[k], actual[k], { rel, abs }, `${path}.${k}`, out);
    return out;
  }
  if (expected !== actual) out.push(`${path}: ${JSON.stringify(expected)} vs ${JSON.stringify(actual)}`);
  return out;
}
