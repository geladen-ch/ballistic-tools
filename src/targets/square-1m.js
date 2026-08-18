// Scoring function for the plain "1 × 1 m" square target — a single
// hit/miss zone. See src/targets/square-1m.json for the target's own data
// and src/engine/target-shapes.js for the shared rectangleHitProbability
// math.
import { rectangleHitProbability } from '../engine/target-shapes.js';

export function hitProbability(sdX, sdY, offsetX, offsetY) {
  const probability = rectangleHitProbability(-50, -50, 100, 100, sdX, sdY, offsetX, offsetY);
  return [{ zoneId: 'hit', probability }];
}
