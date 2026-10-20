// Scoring function for the Soviet "USSR №5" target — a single hit/miss
// zone shaped like a torso silhouette (a "head" rectangle on top of a
// wider "body" rectangle, sharing an edge with no overlap, so summing
// their probabilities is safe). See src/targets/ussr-5.json for the
// target's own data and src/engine/target-shapes.js for the shared
// rectangleHitProbability math.
import { rectangleHitProbability } from '../engine/target-shapes.js';

export function hitProbability(sdX, sdY, offsetX, offsetY) {
  const head = rectangleHitProbability(-0.115, -0.03, 0.23, 0.18, sdX, sdY, offsetX, offsetY);
  const body = rectangleHitProbability(-0.25, -0.15, 0.5, 0.12, sdX, sdY, offsetX, offsetY);
  return [{ zoneId: 'hit', probability: head + body }];
}
