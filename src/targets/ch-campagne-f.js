// Scoring function for the Swiss field-shooting "CH field 'F'" target — a
// single hit/miss zone shaped like a torso silhouette (a narrower "head"
// rectangle on top of a wider "body" rectangle, sharing an edge with no
// overlap, so summing their probabilities is safe). See
// src/targets/ch-campagne-f.json for the target's own data and
// src/engine/target-shapes.js for the shared rectangleHitProbability math.
import { rectangleHitProbability } from '../engine/target-shapes.js';

export function hitProbability(sdX, sdY, offsetX, offsetY) {
  const head = rectangleHitProbability(-0.1, 0.3, 0.2, 0.2, sdX, sdY, offsetX, offsetY);
  const body = rectangleHitProbability(-0.225, -0.5, 0.45, 0.8, sdX, sdY, offsetX, offsetY);
  return [{ zoneId: 'hit', probability: head + body }];
}
