// Scoring function for the Swiss CH 300m "B10" target — the same physical
// target sheet as ch-300m-b4 (see ch-300m-b4-result.svg, shared as-is
// between the two), but scored with 10 concentric rings plus an inner
// "10x" sub-ring instead of B4's 4-zone torso-silhouette scheme. The ring
// diameters and math are identical to the ISSF 300m target — see
// src/targets/issf-300m.js and src/engine/target-shapes.js.
import { circleHitProbability } from '../engine/target-shapes.js';

const RINGS = [
  { id: '1', outerM: 0.5 },
  { id: '2', outerM: 0.45 },
  { id: '3', outerM: 0.4 },
  { id: '4', outerM: 0.35 },
  { id: '5', outerM: 0.3 },
  { id: '6', outerM: 0.25 },
  { id: '7', outerM: 0.2 },
  { id: '8', outerM: 0.15 },
  { id: '9', outerM: 0.1 },
  { id: '10', outerM: 0.05 },
  { id: '10x', outerM: 0.025 }
];

export function hitProbability(sdX, sdY, offsetX, offsetY) {
  return RINGS.map((ring, i) => {
    const outerP = circleHitProbability(0, 0, ring.outerM, sdX, sdY, offsetX, offsetY);
    const nextRing = RINGS[i + 1];
    const innerP = nextRing ? circleHitProbability(0, 0, nextRing.outerM, sdX, sdY, offsetX, offsetY) : 0;
    return { zoneId: ring.id, probability: outerP - innerP };
  });
}
