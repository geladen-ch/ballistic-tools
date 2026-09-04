// Scoring function for the IPSC/USPSA steel "Mini Popper" target — same
// shape and derivation as ipsc-popper.js (see its own comment for the
// geometry rationale), scaled down per
// data/targets/IPSC_Mini_Popper_steel_target.png: base 100mm wide, circle
// 200mm diameter (R100mm) centered 460mm above the base, taper widening to
// 135mm wide where it meets the circle, total height 560mm (base to top of
// circle). All figures below converted to centimeters. hitProbability's own
// y=0 is the center of the circular head — see ipsc-popper.js's own
// comment for why.
import { profileHitProbability, polylineHalfWidth, circularArcHalfWidth, unionHalfWidth } from '../engine/target-shapes.js';

const R = 10; // cm, circle radius
const CIRCLE_CENTER_Y = 46; // cm, base to circle center
const CHORD_HALF_WIDTH = 6.75; // cm, half of the labeled 135mm taper/circle junction width
const BASE_HALF_WIDTH = 5; // cm, half of the labeled 100mm base width
const CHORD_Y = CIRCLE_CENTER_Y - Math.sqrt(R * R - CHORD_HALF_WIDTH * CHORD_HALF_WIDTH);
const TOP_Y = CIRCLE_CENTER_Y + R; // cm, = 56, matches the drawing's labeled 560mm total height
const CENTER_Y = CIRCLE_CENTER_Y; // cm, base to hitProbability's own y=0

const halfWidthAt = unionHalfWidth(
  polylineHalfWidth([[0, BASE_HALF_WIDTH], [CHORD_Y, CHORD_HALF_WIDTH]]),
  circularArcHalfWidth(CIRCLE_CENTER_Y, R)
);

export function hitProbability(sdX, sdY, offsetX, offsetY) {
  const hit = profileHitProbability(halfWidthAt, 0, TOP_Y, sdX, sdY, offsetX, offsetY + CENTER_Y);
  return [{ zoneId: 'hit', probability: hit }];
}
