// Scoring function for the IPSC/USPSA steel "Popper" target — a
// straight-tapered body topped by a circular head, the taper's own top
// edge meeting the circle below its center (not a plain rectangle-plus-
// circle stack, so plain addition doesn't apply — see
// src/engine/target-shapes.js's profileHitProbability). Geometry from
// data/targets/IPSC_Popper_steel_target.png: base 150mm wide, circle
// 300mm diameter (R150mm) centered 700mm above the base, taper widening
// from the base up to 200mm wide where it meets the circle, total height
// 850mm (base to top of circle). All figures below converted to
// centimeters. CHORD_Y (where the taper's top edge meets the circle) isn't
// printed on the drawing — it's the height on the circle whose own chord
// width equals the drawing's labeled 200mm, solved via the circle
// equation. hitProbability's own y=0 is the center of the circular head
// (the natural real-world point of aim on a popper — a shooter aims
// center-mass on the head, not at the post) rather than the bottom edge
// the raw drawing measurements are anchored to.
import { profileHitProbability, polylineHalfWidth, circularArcHalfWidth, unionHalfWidth } from '../engine/target-shapes.js';

const R = 15; // cm, circle radius
const CIRCLE_CENTER_Y = 70; // cm, base to circle center
const CHORD_HALF_WIDTH = 10; // cm, half of the labeled 200mm taper/circle junction width
const BASE_HALF_WIDTH = 7.5; // cm, half of the labeled 150mm base width
const CHORD_Y = CIRCLE_CENTER_Y - Math.sqrt(R * R - CHORD_HALF_WIDTH * CHORD_HALF_WIDTH);
const TOP_Y = CIRCLE_CENTER_Y + R; // cm, = 85, matches the drawing's labeled 850mm total height
const CENTER_Y = CIRCLE_CENTER_Y; // cm, base to hitProbability's own y=0

const halfWidthAt = unionHalfWidth(
  polylineHalfWidth([[0, BASE_HALF_WIDTH], [CHORD_Y, CHORD_HALF_WIDTH]]),
  circularArcHalfWidth(CIRCLE_CENTER_Y, R)
);

export function hitProbability(sdX, sdY, offsetX, offsetY) {
  const hit = profileHitProbability(halfWidthAt, 0, TOP_Y, sdX, sdY, offsetX, offsetY + CENTER_Y);
  return [{ zoneId: 'hit', probability: hit }];
}
