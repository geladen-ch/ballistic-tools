// Scoring function for the Soviet "USSR №5" target — a single hit/miss
// zone shaped like a torso silhouette (a "head" rectangle on top of a
// wider "body" rectangle, sharing an edge with no overlap, so summing
// their probabilities is safe). See src/targets/ussr-5.json for the
// target's own data and src/engine/target-shapes.js for the shared
// rectangleHitProbability math.
import { rectangleHitProbability } from '../engine/target-shapes.js';

export function hitProbability(sdX, sdY, offsetX, offsetY) {
  const head = rectangleHitProbability(-11.5, -3, 23, 18, sdX, sdY, offsetX, offsetY);
  const body = rectangleHitProbability(-25, -15, 50, 12, sdX, sdY, offsetX, offsetY);
  return [{ zoneId: 'hit', probability: head + body }];
}
