// Scoring function for the user-sizeable "Circle gong" target — a single
// hit/miss zone whose diameter comes from the caller (the Simulation
// panel's own diameter field) rather than a compile-time constant. See
// src/engine/target-shapes.js for the shared circleHitProbability math and
// src/targets/custom-target-render.js for how this target's geometry/
// artwork are derived from the same diameter at render time.
import { circleHitProbability } from '../engine/target-shapes.js';

export function hitProbability(sdX, sdY, offsetX, offsetY, dims) {
  const probability = circleHitProbability(0, 0, dims.diameterCm / 2, sdX, sdY, offsetX, offsetY);
  return [{ zoneId: 'hit', probability }];
}
