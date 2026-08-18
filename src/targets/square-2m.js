// Scoring function for the "2 × 2 m" square target — two nested zones,
// both worth the same single point but tracked separately (a 1×1m inner
// square and the 2×2m..1×1m outer ring around it). See
// src/targets/square-2m.json for the target's own data and
// src/engine/target-shapes.js for the shared rectangleHitProbability math.
import { rectangleHitProbability } from '../engine/target-shapes.js';

export function hitProbability(sdX, sdY, offsetX, offsetY) {
  const inner = rectangleHitProbability(-50, -50, 100, 100, sdX, sdY, offsetX, offsetY);
  const outer = rectangleHitProbability(-100, -100, 200, 200, sdX, sdY, offsetX, offsetY);
  return [
    { zoneId: '1x1', probability: inner },
    { zoneId: '2x2', probability: outer - inner }
  ];
}
