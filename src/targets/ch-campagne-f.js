// Scoring function for the Swiss field-shooting "CH field 'F'" target — a
// single hit/miss zone shaped like a torso silhouette (a narrower "head"
// rectangle on top of a wider "body" rectangle, sharing an edge with no
// overlap, so summing their probabilities is safe). See
// src/targets/ch-campagne-f.json for the target's own data and
// src/engine/target-shapes.js for the shared rectangleHitProbability math.
import { rectangleHitProbability } from '../engine/target-shapes.js';

export function hitProbability(sdX, sdY, offsetX, offsetY) {
  const head = rectangleHitProbability(-10, 30, 20, 20, sdX, sdY, offsetX, offsetY);
  const body = rectangleHitProbability(-22.5, -50, 45, 80, sdX, sdY, offsetX, offsetY);
  return [{ zoneId: 'hit', probability: head + body }];
}
