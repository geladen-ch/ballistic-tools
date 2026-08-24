import test from 'node:test';
import assert from 'node:assert/strict';
import {
  machForVelocityMs, velocityMsForMach, bcSegmentsToCdCurve, validateSegments,
  optimalSupersonicBcs, OPTIMAL_BC_START_MACH, OPTIMAL_BC_END_MACH
} from '../src/engine/bc-segments-cd.js';
import { makeStepper } from '../src/engine/trajectory.js';
import { DRAG_TABLES } from '../src/engine/drag-tables.js';
import { LBIN2_TO_KGM2 } from '../src/engine/constants.js';
import { STANDARD_SEA_LEVEL_SOUND_MS } from '../src/engine/atmosphere.js';

test('machForVelocityMs/velocityMsForMach round-trip through the fixed standard-sea-level speed of sound', () => {
  assert.ok(Math.abs(machForVelocityMs(STANDARD_SEA_LEVEL_SOUND_MS) - 1) < 1e-12);
  const mach = machForVelocityMs(700);
  assert.ok(Math.abs(velocityMsForMach(mach) - 700) < 1e-9);
});

test('bcSegmentsToCdCurve reuses the reference table\'s own native Mach sampling, not a separate grid', () => {
  const segments = [{ toVelocityMs: null, bc: 0.5 }];
  const curve = bcSegmentsToCdCurve({ dragModel: 'G7', segments, massKg: 0.012, caliberM: 0.00782 });
  assert.deepEqual(curve.map((p) => p.mach), DRAG_TABLES.G7.map(([mach]) => mach));
});

test('a single-segment curve exactly reproduces the reference model scaled by BC/mass/caliber', () => {
  const bc = 0.45;
  const massKg = 0.011;
  const caliberM = 0.0067056;
  const segments = [{ toVelocityMs: null, bc }];
  const curve = bcSegmentsToCdCurve({ dragModel: 'G1', segments, massKg, caliberM });
  for (const [mach, cdStd] of DRAG_TABLES.G1) {
    const point = curve.find((p) => p.mach === mach);
    const expected = cdStd * massKg / (LBIN2_TO_KGM2 * bc * caliberM * caliberM);
    assert.ok(Math.abs(point.cd - expected) < 1e-12, `mach ${mach}: ${point.cd} vs ${expected}`);
  }
});

test('the derived formula reproduces the exact same trajectory as the plain bc+dragModel path', () => {
  // Cross-check against a real makeStepper() run — this is the one piece
  // of physics this module introduces that isn't already proven
  // elsewhere in the engine (see bc-segments-cd.js's own header comment).
  const bc = 0.5;
  const dragModel = 'G7';
  const massKg = 0.012;
  const caliberM = 0.00782;
  const atmo = { tempC: 15, pressureHpa: 1013.25, altitudeM: 0, humidityPct: 0, windSpeed: 0, windAngle: 90 };

  const cdTable = bcSegmentsToCdCurve({
    dragModel, segments: [{ toVelocityMs: null, bc }], massKg, caliberM
  }).map((p) => [p.mach, p.cd]);

  const stepperBc = makeStepper({ bc, dragModel, ...atmo });
  const stepperCd = makeStepper({ cdTable, massKg, caliberM, ...atmo });

  function fly(stepper, v0, nSteps) {
    let cur = { x: 0, y: 0, z: 0, vx: v0, vy: 0, vz: 0, t: 0 };
    for (let i = 0; i < nSteps; i++) cur = stepper.step(cur);
    return cur;
  }

  // Supersonic, transonic, and subsonic starting velocities.
  for (const v0 of [800, 340, 250]) {
    const a = fly(stepperBc, v0, 300);
    const b = fly(stepperCd, v0, 300);
    assert.ok(Math.abs(a.x - b.x) < 1e-6, `x diverged at v0=${v0}: ${a.x} vs ${b.x}`);
    const va = Math.hypot(a.vx, a.vy, a.vz);
    const vb = Math.hypot(b.vx, b.vy, b.vz);
    assert.ok(Math.abs(va - vb) / va < 1e-9, `velocity diverged at v0=${v0}: ${va} vs ${vb}`);
  }
});

test('a table point landing exactly on a border belongs to the higher-speed segment (>= lower, < upper)', () => {
  const borderMach = 1.2;
  const borderVelocityMs = velocityMsForMach(borderMach);
  const segments = [
    { toVelocityMs: borderVelocityMs, bc: 0.3 },
    { toVelocityMs: null, bc: 0.6 }
  ];
  const curve = bcSegmentsToCdCurve({ dragModel: 'G1', segments, massKg: 0.01, caliberM: 0.007 });
  const atBorder = curve.find((p) => Math.abs(p.mach - borderMach) < 1e-9);
  // Only meaningful if the reference table actually has a point at this
  // exact Mach — if not, pick a table point that does exist and use it
  // as the border instead, so the test always exercises a real boundary.
  if (atBorder) {
    assert.equal(atBorder.segmentIndex, 1, 'a point exactly at the border should belong to the upper segment');
  } else {
    const [tableMach] = DRAG_TABLES.G1[10];
    const segments2 = [
      { toVelocityMs: velocityMsForMach(tableMach), bc: 0.3 },
      { toVelocityMs: null, bc: 0.6 }
    ];
    const curve2 = bcSegmentsToCdCurve({ dragModel: 'G1', segments: segments2, massKg: 0.01, caliberM: 0.007 });
    const point = curve2.find((p) => p.mach === tableMach);
    assert.equal(point.segmentIndex, 1);
  }
});

test('a segment with no BC yet produces null cd, not a fabricated value — supports disjointed segments', () => {
  const segments = [
    { toVelocityMs: velocityMsForMach(1.0), bc: null },
    { toVelocityMs: null, bc: 0.5 }
  ];
  const curve = bcSegmentsToCdCurve({ dragModel: 'G1', segments, massKg: 0.012, caliberM: 0.00782 });
  const belowMach1 = curve.filter((p) => p.segmentIndex === 0);
  const aboveMach1 = curve.filter((p) => p.segmentIndex === 1);
  assert.ok(belowMach1.length > 0 && aboveMach1.length > 0);
  assert.ok(belowMach1.every((p) => p.cd === null));
  assert.ok(aboveMach1.every((p) => typeof p.cd === 'number' && p.cd > 0));
});

test('missing mass/caliber produces null cd for every point, even with every segment BC specified', () => {
  const segments = [{ toVelocityMs: null, bc: 0.5 }];
  const curve = bcSegmentsToCdCurve({ dragModel: 'G1', segments, massKg: null, caliberM: null });
  assert.ok(curve.every((p) => p.cd === null));
});

const BC_BOUNDS = { min: 0.05, max: 1.5 };

test('validateSegments passes when borders ascend and every BC is within bounds', () => {
  const segments = [
    { toVelocityMs: 300, bc: 0.4 },
    { toVelocityMs: 600, bc: 0.45 },
    { toVelocityMs: null, bc: 0.5 }
  ];
  const result = validateSegments(segments, BC_BOUNDS);
  assert.equal(result.allValid, true);
  assert.ok(result.segments.every((s) => s.valid));
});

test('validateSegments flags a non-ascending border as a real violation', () => {
  const segments = [
    { toVelocityMs: 600, bc: 0.4 },
    { toVelocityMs: 300, bc: 0.45 }, // out of order relative to the previous border
    { toVelocityMs: null, bc: 0.5 }
  ];
  const result = validateSegments(segments, BC_BOUNDS);
  assert.equal(result.allValid, false);
  assert.equal(result.segments[1].orderOk, false);
});

test('validateSegments flags an equal (zero-width) border the same as a non-ascending one', () => {
  const segments = [
    { toVelocityMs: 400, bc: 0.4 },
    { toVelocityMs: 400, bc: 0.45 },
    { toVelocityMs: null, bc: 0.5 }
  ];
  const result = validateSegments(segments, BC_BOUNDS);
  assert.equal(result.segments[1].orderOk, false);
});

test('validateSegments flags a blank BC and an out-of-range BC, independently of ordering', () => {
  const segments = [
    { toVelocityMs: 400, bc: null },
    { toVelocityMs: null, bc: 3.0 } // above FIELD_BOUNDS.bc's own max of 1.5
  ];
  const result = validateSegments(segments, BC_BOUNDS);
  assert.equal(result.allValid, false);
  assert.equal(result.segments[0].bcOk, false);
  assert.equal(result.segments[0].orderOk, true);
  assert.equal(result.segments[1].bcOk, false);
});

// ---- optimalSupersonicBcs ----

test('OPTIMAL_BC_START_MACH/END_MACH match the spec\'s own Mach 2.5 -> beginning-of-transonic range', async () => {
  const { TRANSONIC_HI } = await import('../src/engine/constants.js');
  assert.equal(OPTIMAL_BC_START_MACH, 2.5);
  assert.equal(OPTIMAL_BC_END_MACH, TRANSONIC_HI);
});

test('a single-segment curve built against model X recovers that exact BC when solved against X again (self-consistency)', () => {
  const bc = 0.45;
  const massKg = 0.0113;
  const caliberM = 0.00782;
  const curve = bcSegmentsToCdCurve({ dragModel: 'G1', segments: [{ toVelocityMs: null, bc }], massKg, caliberM })
    .filter((p) => p.cd != null).map((p) => [p.mach, p.cd]);

  const results = optimalSupersonicBcs({ cdTable: curve, massKg, caliberM, dragModelIds: ['G1'] });
  assert.equal(results.length, 1);
  assert.equal(results[0].dragModel, 'G1');
  assert.ok(!results[0].error, 'expected a real bc, not an error');
  assert.ok(Math.abs(results[0].bc - bc) < 1e-4, `expected ~${bc}, got ${results[0].bc}`);
});

test('every visible-model result carries its own dragModel id, in the same order requested', () => {
  const curve = bcSegmentsToCdCurve({ dragModel: 'G1', segments: [{ toVelocityMs: null, bc: 0.45 }], massKg: 0.0113, caliberM: 0.00782 })
    .filter((p) => p.cd != null).map((p) => [p.mach, p.cd]);
  const ids = ['G1', 'G7', 'G2', 'G5', 'G6', 'G8'];
  const results = optimalSupersonicBcs({ cdTable: curve, massKg: 0.0113, caliberM: 0.00782, dragModelIds: ids });
  assert.deepEqual(results.map((r) => r.dragModel), ids);
  // Every one of these is a real, well-conditioned bullet (moderate BC,
  // realistic mass/caliber) — none should be unreachable within
  // estimateBC's own default bracket.
  for (const r of results) assert.ok(!r.error, `${r.dragModel} unexpectedly errored`);
});

test('missing mass/caliber or an empty curve reports every model as an error, not a thrown exception', () => {
  const results1 = optimalSupersonicBcs({ cdTable: [], massKg: null, caliberM: null, dragModelIds: ['G1', 'G7'] });
  assert.ok(results1.every((r) => r.error));

  const curve = bcSegmentsToCdCurve({ dragModel: 'G1', segments: [{ toVelocityMs: null, bc: 0.45 }], massKg: 0.0113, caliberM: 0.00782 })
    .filter((p) => p.cd != null).map((p) => [p.mach, p.cd]);
  const results2 = optimalSupersonicBcs({ cdTable: curve, massKg: null, caliberM: null, dragModelIds: ['G1'] });
  assert.ok(results2[0].error);
});

test('a target unreachable within estimateBC\'s own BC bracket reports as an error, not a thrown exception', () => {
  // A very low-drag G7 bullet (high BC, high sectional density) can be
  // genuinely unreachable for a blunter reference model like G1 within
  // its conventional [0.05, 1.5] bracket — confirmed against a real
  // trajectory run, not assumed; this just locks in that the resulting
  // "no compromise BC in range" case degrades gracefully.
  const curve = bcSegmentsToCdCurve({ dragModel: 'G7', segments: [{ toVelocityMs: null, bc: 0.5 }], massKg: 0.012, caliberM: 0.00782 })
    .filter((p) => p.cd != null).map((p) => [p.mach, p.cd]);
  const results = optimalSupersonicBcs({ cdTable: curve, massKg: 0.012, caliberM: 0.00782, dragModelIds: ['G1', 'G7'] });
  const g1 = results.find((r) => r.dragModel === 'G1');
  const g7 = results.find((r) => r.dragModel === 'G7');
  assert.ok(g1.error, 'expected G1 to be unreachable for this bullet');
  assert.ok(!g7.error && Math.abs(g7.bc - 0.5) < 1e-4, 'G7 should self-consistently recover ~0.5');
});
