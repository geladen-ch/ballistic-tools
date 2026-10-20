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
  const dx = 0.125 / STEPS;
  const dy = 0.5 / STEPS;
  let outL = 0;
  let outR = 0;
  for (let i = 0; i < STEPS; i++) {
    outL += rectangleHitProbability(-0.25, -0.75 + dy * i, dx * (STEPS - i - 0.5), dy, sdX, sdY, offsetX, offsetY);
    outR += rectangleHitProbability(0.125 + dx * (i + 0.5), -0.75 + dy * i, dx * (STEPS - i - 0.5), dy, sdX, sdY, offsetX, offsetY);
  }

  const head = rectangleHitProbability(-0.115, 0.57, 0.23, 0.18, sdX, sdY, offsetX, offsetY);
  const body = rectangleHitProbability(-0.25, -0.75, 0.5, 1.32, sdX, sdY, offsetX, offsetY);
  return [{ zoneId: 'hit', probability: head + body - outL - outR }];
}
