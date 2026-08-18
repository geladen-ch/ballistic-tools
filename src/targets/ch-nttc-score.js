// Scoring function for the "NTTC (score)" target — an outer zone (Z, worth
// 2 points) with two higher-value sub-zones (X and Y, each worth 5 points)
// carved out of it. X and Y are disjoint, both fully contained in the
// outer shape, so Z's own probability is the outer shape's total minus
// both of theirs. See src/targets/ch-nttc-score.json for the target's own
// data and src/engine/target-shapes.js for the shared
// rectangleHitProbability math.
import { rectangleHitProbability } from '../engine/target-shapes.js';

export function hitProbability(sdX, sdY, offsetX, offsetY) {
  const x = rectangleHitProbability(-15, -17.7, 30, 34.7, sdX, sdY, offsetX, offsetY);
  const y = rectangleHitProbability(-15, -32.8, 30, 10, sdX, sdY, offsetX, offsetY);
  const outer =
    rectangleHitProbability(-22.5, -36.8, 45, 58.5, sdX, sdY, offsetX, offsetY) +
    rectangleHitProbability(-7.5, 21.7, 15, 15, sdX, sdY, offsetX, offsetY);
  const z = outer - x - y;
  return [
    { zoneId: 'x', probability: x },
    { zoneId: 'y', probability: y },
    { zoneId: 'z', probability: z }
  ];
}
