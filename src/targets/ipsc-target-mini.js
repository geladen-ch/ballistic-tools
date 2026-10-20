// Scoring function for the IPSC/USPSA "IPSC Mini Target" cardboard
// silhouette (IPSC Handgun Rules, Appendix B3) — same shape family and
// derivation as ipsc-target.js (see its own comment for the geometry
// rationale and the nested A ⊆ C ⊆ D containment scoring), scaled down
// per the official mini drawing (not a uniform scale-down of the full
// target — its own dimensions):
//   D: (5,0)   -> (15,12.5) -> (15,25) -> (5,37.5)
//   C: (5,0)   -> (10,12.5) -> (10,22) -> (3.5,30)
//   A: (2,1.5) -> (5,12.5)  -> (5,18)  -> (2,23)
import { profileHitProbability, polylineHalfWidth } from '../engine/target-shapes.js';

const TOP_Y = 0.375; // m, overall target height (D-zone's own extent)
const D = polylineHalfWidth([[0, 0.05], [0.125, 0.15], [0.25, 0.15], [0.375, 0.05]]);
const C = polylineHalfWidth([[0, 0.05], [0.125, 0.1], [0.22, 0.1], [0.3, 0.035]]);
const A = polylineHalfWidth([[0.015, 0.02], [0.125, 0.05], [0.18, 0.05], [0.23, 0.02]]);
// A-zone's own vertical center — see ipsc-target.js's own comment for why.
const CENTER_Y = (0.015 + 0.23) / 2;

export function hitProbability(sdX, sdY, offsetX, offsetY) {
  const rawOffsetY = CENTER_Y - offsetY;
  const pA = profileHitProbability(A, 0, TOP_Y, sdX, sdY, offsetX, rawOffsetY);
  const pC = profileHitProbability(C, 0, TOP_Y, sdX, sdY, offsetX, rawOffsetY);
  const pD = profileHitProbability(D, 0, TOP_Y, sdX, sdY, offsetX, rawOffsetY);
  return [
    { zoneId: 'a', probability: pA },
    { zoneId: 'c', probability: pC - pA },
    { zoneId: 'd', probability: pD - pC }
  ];
}
