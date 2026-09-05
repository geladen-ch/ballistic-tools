// Scoring function for the IPSC/USPSA "IPSC Target" cardboard silhouette
// (IPSC Handgun Rules, Appendix B2) — three nested scoring zones, A (highest
// value) inside C inside D, each a straight-sided taper/flat/taper polygon
// symmetric about the vertical centerline (see
// src/engine/target-shapes.js's profileHitProbability/polylineHalfWidth —
// no new geometry primitive needed, this is the same machinery the IPSC
// poppers use, just with a 4-point profile per zone instead of 2). Each
// zone's own probability is priced by nested containment (A ⊆ C ⊆ D, like
// ch-300m-b4's ring subtraction): zone A's probability is its own region;
// zone C's is (C's own region minus A's); zone D's is (D's own region
// minus C's).
//
// Geometry (cm, y measured down from the very top, the D-zone's own top
// edge) transcribed directly from the official drawing's dimensions —
// each zone is a taper up to full width, a flat run at full width, then a
// taper back down:
//   D: (7.5,0) -> (22.5,19) -> (22.5,38) -> (7.5,57)
//   C: (7.5,0) -> (15,19)   -> (15,33.5) -> (5,45)
//   A: (2.5,2.5) -> (7.5,19) -> (7.5,27.5) -> (2.5,35)
// D and C share the same top-edge width/height (their outlines coincide
// exactly along the flat top edge, diverging only once the tapers start);
// all three reach their own full width at the same height, 19cm down.
//
// Major/Minor power factor only changes each zone's *point value*, not its
// geometry — hitProbability() is invariant to it; the scoring toggle lives
// in the app's own view layer (each zone's JSON carries both scoreMajor
// and scoreMinor).
import { profileHitProbability, polylineHalfWidth } from '../engine/target-shapes.js';

const TOP_Y = 57; // cm, overall target height (D-zone's own extent)
const D = polylineHalfWidth([[0, 7.5], [19, 22.5], [38, 22.5], [57, 7.5]]);
const C = polylineHalfWidth([[0, 7.5], [19, 15], [33.5, 15], [45, 5]]);
const A = polylineHalfWidth([[2.5, 2.5], [19, 7.5], [27.5, 7.5], [35, 2.5]]);
// A-zone's own vertical center — the natural real-world point of aim
// (center of the highest-scoring zone), matching the reasoning behind the
// IPSC poppers' own y=0 (their circular head's center).
const CENTER_Y = (2.5 + 35) / 2;

export function hitProbability(sdX, sdY, offsetX, offsetY) {
  // offsetY is "up positive" (the app-wide convention), but this module's
  // own y increases downward from the top — so aiming higher (larger
  // offsetY) means a *smaller* raw y, hence the subtraction here.
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
