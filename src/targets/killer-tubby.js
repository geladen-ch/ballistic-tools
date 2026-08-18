// Scoring function for the "Killer Tubby" novelty target — the scoring
// rectangles are the same shape as ch-campagne-f's (see its own
// hitProbability for the geometry rationale), placed at the bottom-center
// of this target's larger 600x1200mm canvas rather than filling it. See
// src/targets/killer-tubby.json for the target's own data and
// src/engine/target-shapes.js for the shared rectangleHitProbability math.
import { rectangleHitProbability } from '../engine/target-shapes.js';

export function hitProbability(sdX, sdY, offsetX, offsetY) {
  const head = rectangleHitProbability(-10, 30, 20, 20, sdX, sdY, offsetX, offsetY);
  const body = rectangleHitProbability(-22.5, -50, 45, 80, sdX, sdY, offsetX, offsetY);
  return [{ zoneId: 'hit', probability: head + body }];
}
