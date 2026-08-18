// Scoring function for the plain "⌀ 100 mm" circular target — a single
// hit/miss zone. See src/targets/circle-100mm.json for the target's own
// data and src/engine/target-shapes.js for the shared circleHitProbability
// math.
import { circleHitProbability } from '../engine/target-shapes.js';

export function hitProbability(sdX, sdY, offsetX, offsetY) {
  const probability = circleHitProbability(0, 0, 5, sdX, sdY, offsetX, offsetY);
  return [{ zoneId: 'hit', probability }];
}
