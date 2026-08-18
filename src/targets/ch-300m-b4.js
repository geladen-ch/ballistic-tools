// Scoring function for the Swiss CH 300m "B4" target — three concentric
// rings (zones 1-2, and the outer part of zone 3) around a non-circular
// "flag" zone 3 boundary (two abutting rectangles, sharing an edge with no
// overlap) and a small zone-4 bullseye circle at the center. See
// src/targets/ch-300m-b4.json for the target's own data and
// src/engine/target-shapes.js for the shared hit-probability math. Ported
// from the legacy data/targets/ch-300m-b4.js (radii/coordinates converted
// from meters to centimeters, poa split into offsetX/offsetY).
import { circleHitProbability, rectangleHitProbability } from '../engine/target-shapes.js';

export function hitProbability(sdX, sdY, offsetX, offsetY) {
  const disk1 = circleHitProbability(0, 0, 50, sdX, sdY, offsetX, offsetY);
  const disk2 = circleHitProbability(0, 0, 35, sdX, sdY, offsetX, offsetY);
  const flag3 =
    rectangleHitProbability(-22.5, -20, 45, 41, sdX, sdY, offsetX, offsetY) +
    rectangleHitProbability(-10, 21, 20, 9, sdX, sdY, offsetX, offsetY);
  const disk4 = circleHitProbability(0, 0, 10, sdX, sdY, offsetX, offsetY);

  return [
    { zoneId: '1', probability: disk1 - disk2 },
    { zoneId: '2', probability: disk2 - flag3 },
    { zoneId: '3', probability: flag3 - disk4 },
    { zoneId: '4', probability: disk4 }
  ];
}
