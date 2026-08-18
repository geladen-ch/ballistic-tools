// Scoring function for the Soviet "USSR №8" target — a single hit/miss
// zone shaped like a torso silhouette (a "head" rectangle over a wide
// "body" rectangle) with its bottom two corners tapered off diagonally,
// approximated — as the legacy implementation did — by subtracting many
// thin horizontal strips of shrinking width rather than solving the
// triangular-region integral analytically. See src/targets/ussr-8.json for
// the target's own data and src/engine/target-shapes.js for the shared
// rectangleHitProbability math.
import { rectangleHitProbability } from '../engine/target-shapes.js';

const STEPS = 50;

export function hitProbability(sdX, sdY, offsetX, offsetY) {
  const dx = 12.5 / STEPS;
  const dy = 50.0 / STEPS;
  let outL = 0;
  let outR = 0;
  for (let i = 0; i < STEPS; i++) {
    outL += rectangleHitProbability(-25.0, -75.0 + dy * i, dx * (STEPS - i - 0.5), dy, sdX, sdY, offsetX, offsetY);
    outR += rectangleHitProbability(12.5 + dx * (i + 0.5), -75.0 + dy * i, dx * (STEPS - i - 0.5), dy, sdX, sdY, offsetX, offsetY);
  }

  const head = rectangleHitProbability(-11.5, 57.0, 23.0, 18.0, sdX, sdY, offsetX, offsetY);
  const body = rectangleHitProbability(-25.0, -75.0, 50.0, 132.0, sdX, sdY, offsetX, offsetY);
  return [{ zoneId: 'hit', probability: head + body - outL - outR }];
}
