import test from 'node:test';
import assert from 'node:assert/strict';
import { convertBallisticCoefficient } from '../src/engine/bc-convert.js';
import { DRAG_MODELS } from '../src/engine/drag-tables.js';

test('converting a model to itself returns the BC unchanged', () => {
  const bc = convertBallisticCoefficient({ bc: 0.412, sourceModel: 'G7', targetModel: 'G7', velocityMs: 800 });
  assert.equal(bc, 0.412);
});

test('G1 -> G7 -> G1 round-trips exactly at the same reference velocity', () => {
  const original = 0.5;
  const toG7 = convertBallisticCoefficient({ bc: original, sourceModel: 'G1', targetModel: 'G7', velocityMs: 850 });
  const backToG1 = convertBallisticCoefficient({ bc: toG7, sourceModel: 'G7', targetModel: 'G1', velocityMs: 850 });
  assert.ok(Math.abs(backToG1 - original) < 1e-9, `round-trip drifted: ${backToG1} vs ${original}`);
});

test('every standard model round-trips through every other one, at a representative supersonic velocity', () => {
  for (const a of DRAG_MODELS) {
    for (const b of DRAG_MODELS) {
      if (a.id === b.id) continue;
      const converted = convertBallisticCoefficient({ bc: 0.3, sourceModel: a.id, targetModel: b.id, velocityMs: 700 });
      const back = convertBallisticCoefficient({ bc: converted, sourceModel: b.id, targetModel: a.id, velocityMs: 700 });
      assert.ok(Math.abs(back - 0.3) < 1e-9, `${a.id} -> ${b.id} -> ${a.id} drifted: ${back}`);
    }
  }
});

test('a higher-drag target model at the reference Mach yields a numerically different BC', () => {
  // G1 and G7 have different Cd shapes at any given Mach — the two BCs
  // describing the same physical bullet at the same velocity must differ.
  const g1Bc = 0.5;
  const g7Bc = convertBallisticCoefficient({ bc: g1Bc, sourceModel: 'G1', targetModel: 'G7', velocityMs: 800 });
  assert.notEqual(g7Bc, g1Bc);
  assert.ok(g7Bc > 0);
});

test('a lower reference velocity (deeper transonic) still produces a finite, positive result', () => {
  const bc = convertBallisticCoefficient({ bc: 0.4, sourceModel: 'G1', targetModel: 'G7', velocityMs: 340 });
  assert.ok(Number.isFinite(bc) && bc > 0);
});
