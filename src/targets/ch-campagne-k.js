// Scoring function for the Swiss field-shooting "CH field 'K'" target — a
// single hit/miss zone shaped like a 3-tier stepped silhouette (three
// stacked rectangles narrowing toward the top, none overlapping, so
// summing their probabilities is safe). See src/targets/ch-campagne-k.json
// for the target's own data and src/engine/target-shapes.js for the shared
// rectangleHitProbability math.
import { rectangleHitProbability } from '../engine/target-shapes.js';

export function hitProbability(sdX, sdY, offsetX, offsetY) {
  const bottom = rectangleHitProbability(-11, -16.5, 22, 8, sdX, sdY, offsetX, offsetY);
  const middle = rectangleHitProbability(-9, -8.5, 18, 16, sdX, sdY, offsetX, offsetY);
  const top = rectangleHitProbability(-7.5, 7.5, 15, 9, sdX, sdY, offsetX, offsetY);
  return [{ zoneId: 'hit', probability: bottom + middle + top }];
}
