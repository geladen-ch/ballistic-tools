// Scoring function for the ISSF 300m target — 10 concentric scoring rings
// plus an inner "10x" sub-ring (a tiebreak marker within the 10-ring, not
// worth extra points — see src/targets/issf-300m.json). Ring diameters run
// evenly from 1000mm (score 1) down to 100mm (score 10) in 100mm steps,
// with the 10x ring at 50mm. See src/engine/target-shapes.js for the
// shared circleHitProbability math.
import { circleHitProbability } from '../engine/target-shapes.js';

// Outer radius of each ring, in metres, from the score-1 boundary in to the
// 10x bullseye. A ring's own probability is the disk out to its outer
// radius minus the disk out to the next ring's outer radius (the ring
// just inside it) — circleHitProbability(..., 0, ...) is exactly 0, so
// the innermost "10x" ring (whose "next ring in" doesn't exist) needs no
// special-casing.
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
