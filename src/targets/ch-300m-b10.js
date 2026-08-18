// Scoring function for the Swiss CH 300m "B10" target — the same physical
// target sheet as ch-300m-b4 (see ch-300m-b4-result.svg, shared as-is
// between the two), but scored with 10 concentric rings plus an inner
// "10x" sub-ring instead of B4's 4-zone torso-silhouette scheme. The ring
// diameters and math are identical to the ISSF 300m target — see
// src/targets/issf-300m.js and src/engine/target-shapes.js.
import { circleHitProbability } from '../engine/target-shapes.js';

const RINGS = [
  { id: '1', outerCm: 50 },
  { id: '2', outerCm: 45 },
  { id: '3', outerCm: 40 },
  { id: '4', outerCm: 35 },
  { id: '5', outerCm: 30 },
  { id: '6', outerCm: 25 },
  { id: '7', outerCm: 20 },
  { id: '8', outerCm: 15 },
  { id: '9', outerCm: 10 },
  { id: '10', outerCm: 5 },
  { id: '10x', outerCm: 2.5 }
];

export function hitProbability(sdX, sdY, offsetX, offsetY) {
  return RINGS.map((ring, i) => {
    const outerP = circleHitProbability(0, 0, ring.outerCm, sdX, sdY, offsetX, offsetY);
    const nextRing = RINGS[i + 1];
    const innerP = nextRing ? circleHitProbability(0, 0, nextRing.outerCm, sdX, sdY, offsetX, offsetY) : 0;
    return { zoneId: ring.id, probability: outerP - innerP };
  });
}
