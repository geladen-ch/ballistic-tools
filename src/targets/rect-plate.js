// Scoring function for the user-sizeable "Rectangle plate" target — a
// single hit/miss zone, centered on the point of aim, whose width/height
// come from the caller (the Simulation panel's own width/height fields)
// rather than compile-time constants. See src/engine/target-shapes.js for
// the shared rectangleHitProbability math and
// src/targets/custom-target-render.js for how this target's geometry/
// artwork are derived from the same dimensions at render time.
import { rectangleHitProbability } from '../engine/target-shapes.js';

export function hitProbability(sdX, sdY, offsetX, offsetY, dims) {
  const { widthCm, heightCm } = dims;
  const probability = rectangleHitProbability(-widthCm / 2, -heightCm / 2, widthCm, heightCm, sdX, sdY, offsetX, offsetY);
  return [{ zoneId: 'hit', probability }];
}
