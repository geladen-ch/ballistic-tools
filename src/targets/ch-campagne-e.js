// Scoring function for the Swiss field-shooting "CH field 'E'" target — a
// single hit/miss zone shaped like a stepped silhouette (three stacked
// rectangles, none overlapping, so summing their probabilities is safe).
// See src/targets/ch-campagne-e.json for the target's own data and
// src/engine/target-shapes.js for the shared rectangleHitProbability math.
import { rectangleHitProbability } from '../engine/target-shapes.js';

export function hitProbability(sdX, sdY, offsetX, offsetY) {
  const top = rectangleHitProbability(-0.1, 0.625, 0.2, 0.2, sdX, sdY, offsetX, offsetY);
  const middle = rectangleHitProbability(-0.225, -0.175, 0.45, 0.8, sdX, sdY, offsetX, offsetY);
  const bottom = rectangleHitProbability(-0.15, -0.825, 0.3, 0.65, sdX, sdY, offsetX, offsetY);
  return [{ zoneId: 'hit', probability: top + middle + bottom }];
}
