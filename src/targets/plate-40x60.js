// Scoring function for the 40x60cm plate — a single binary zone, centered
// on the point of aim. See src/targets/plate-40x60.json for the target's
// own data (dimensions, zones, SVG placement) and
// src/engine/target-shapes.js for the shared rectangleHitProbability math.
import { rectangleHitProbability } from '../engine/target-shapes.js';

const WIDTH_CM = 40;
const HEIGHT_CM = 60;

export function hitProbability(sdX, sdY, offsetX, offsetY) {
  const probability = rectangleHitProbability(
    -WIDTH_CM / 2, -HEIGHT_CM / 2, WIDTH_CM, HEIGHT_CM,
    sdX, sdY, offsetX, offsetY
  );
  return [{ zoneId: 'hit', probability }];
}
