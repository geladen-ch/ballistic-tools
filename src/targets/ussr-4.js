// Scoring function for the Soviet "USSR №4" target — a single hit/miss
// zone shaped like a torso silhouette (a wide "body" rectangle topped by a
// narrower "head" rectangle, the two sharing an edge with no overlap, so
// summing their probabilities is safe). See src/targets/ussr-4.json for
// the target's own data and src/engine/target-shapes.js for the shared
// rectangleHitProbability math. Ported from the legacy data/targets/ussr-4.js
// (coordinates converted from meters to centimeters, poa split into
// offsetX/offsetY).
import { rectangleHitProbability } from '../engine/target-shapes.js';

export function hitProbability(sdX, sdY, offsetX, offsetY) {
  const head = rectangleHitProbability(-11.5, 7.0, 23.0, 18.0, sdX, sdY, offsetX, offsetY);
  const body = rectangleHitProbability(-25.0, -25.0, 50.0, 32.0, sdX, sdY, offsetX, offsetY);
  return [{ zoneId: 'hit', probability: head + body }];
}
