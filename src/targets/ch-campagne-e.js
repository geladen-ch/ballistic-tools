// Scoring function for the Swiss field-shooting "CH field 'E'" target — a
// single hit/miss zone shaped like a stepped silhouette (three stacked
// rectangles, none overlapping, so summing their probabilities is safe).
// See src/targets/ch-campagne-e.json for the target's own data and
// src/engine/target-shapes.js for the shared rectangleHitProbability math.
import { rectangleHitProbability } from '../engine/target-shapes.js';

export function hitProbability(sdX, sdY, offsetX, offsetY) {
  const top = rectangleHitProbability(-10, 62.5, 20, 20, sdX, sdY, offsetX, offsetY);
  const middle = rectangleHitProbability(-22.5, -17.5, 45, 80, sdX, sdY, offsetX, offsetY);
  const bottom = rectangleHitProbability(-15, -82.5, 30, 65, sdX, sdY, offsetX, offsetY);
  return [{ zoneId: 'hit', probability: top + middle + bottom }];
}
