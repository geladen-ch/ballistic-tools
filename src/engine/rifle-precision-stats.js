// Shot-group / precision-analysis statistics, ported from the legacy TARAN
// app (data/legacy.code/taran/trous.js + synth-pane.js, GPLv3, Copyright
// 2015 Alexandre Trofimov). Pure functions, no DOM — every value here is
// plain data (project/target/group records in and out), unit-testable in
// isolation the same way src/engine/*'s other modules already are.
//
// Coordinates on a target are relative 0..1 fractions of the photo's
// natural pixel size (see rifle-precision-library.js's data-model
// comment); every function below converts through target.photoWidth/
// photoHeight + the calibration ruler to get real millimetres, replacing
// legacy's absolute-pixel-coordinate model.
import { RAYLEIGH_COEFF, CONF_LOWER, CONF_UPPER, TDIST_QUANTILE } from './rifle-precision-constants.js';
import { angularUnitToCmAtRange } from '../units.js';

// Pixels-per-mm for a target, from its 2-point calibration ruler. null if
// calibration isn't complete yet (no ruler placed, or a real length of 0
// was entered — legacy's own scale-reset button clears exactly this way).
export function computeScale(target) {
  const { calibration, photoWidth, photoHeight } = target;
  if (!calibration || !calibration.point1 || !calibration.point2 || !calibration.realLengthMm) return null;
  if (!photoWidth || !photoHeight || calibration.realLengthMm <= 0) return null;
  const dx = (calibration.point1.x - calibration.point2.x) * photoWidth;
  const dy = (calibration.point1.y - calibration.point2.y) * photoHeight;
  const pixelDist = Math.sqrt(dx * dx + dy * dy);
  if (pixelDist <= 0) return null;
  return pixelDist / calibration.realLengthMm;
}

// Whether a target can actually be analyzed — the same three
// requirements the marking workflow walks a user through in order
// (calibrate the ruler, place a point of aim, mark at least one impact —
// see rifle-precision-marking-view.js's own step sequence). Returns which
// of the three are still missing ('calibration'/'poa'/'impact'), in that
// order; an empty array means the target is fully usable. Calibration
// completeness is computeScale() returning a real scale rather than a
// looser point1/point2/realLengthMm presence check, so a degenerate
// ruler (e.g. both points on the same pixel) still counts as missing.
export function targetUsabilityGaps(target) {
  const gaps = [];
  if (computeScale(target) === null) gaps.push('calibration');
  if (!target.groups.some((g) => g.poa)) gaps.push('poa');
  if (!target.groups.some((g) => g.shots.length > 0)) gaps.push('impact');
  return gaps;
}

// Relative 0..1 point -> real millimetres, using the target's own natural
// pixel size and calibration scale (px/mm).
function toMm(point, target, scale) {
  return { x: (point.x * target.photoWidth) / scale, y: (point.y * target.photoHeight) / scale };
}

function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// Per-group stats: extreme spread (max pairwise distance among shots,
// legacy's own brute-force O(n^2) — groups are small, no need for
// anything smarter) and point of impact (centroid), both in mm, plus the
// H/V offset of the POI from the point of aim. Returns null if the target
// has no scale yet or the group has fewer than 2 shots (nothing to
// measure an extreme spread from), matching legacy's updateStatsGroup().
export function computeGroupStats(group, target) {
  const scale = computeScale(target);
  if (!scale || !group.poa || group.shots.length < 2) return null;

  const shotsMm = group.shots.map((s) => toMm(s, target, scale));
  const poaMm = toMm(group.poa, target, scale);

  let maxDist = 0;
  let m1 = null;
  let m2 = null;
  for (let i = 0; i < shotsMm.length - 1; i++) {
    for (let j = i + 1; j < shotsMm.length; j++) {
      const d = distance(shotsMm[i], shotsMm[j]);
      if (d > maxDist) {
        maxDist = d;
        m1 = i;
        m2 = j;
      }
    }
  }

  const poiMm = shotsMm.reduce((acc, s) => ({ x: acc.x + s.x / shotsMm.length, y: acc.y + s.y / shotsMm.length }), { x: 0, y: 0 });

  return {
    extremeSpreadMm: maxDist,
    extremePairIndices: [m1, m2],
    poiMm,
    // Legacy's own sign convention (image-pane.js): horizontal offset is
    // POI-minus-POA (positive = right); vertical is POA-minus-POI
    // (positive = up), because raw pixel y grows downward and this flips
    // it back to an intuitive "up is positive" reading for the shooter.
    hOffsetMm: poiMm.x - poaMm.x,
    vOffsetMm: poaMm.y - poiMm.y
  };
}

// Pools every shot across every target/group in the project, each shot
// re-centered relative to its own group's point of aim (so groups aimed
// at different spots on different targets don't skew pooled dispersion)
// and scaled to mm via that target's own calibration. Ports
// synthStats(): pooled POI + Student's-t confidence interval on it,
// Rayleigh-sigma dispersion + chi-square confidence interval, and the
// standard derived precision figures (radii R50/R95/R99, expected full
// group-size diameters D5x/D10x).
//
// `pooledShots` is always returned (even when status isn't 'ok') so CSV
// export has something to write — legacy's own CSV export reuses the
// pooled point list unconditionally, gated only on the group/shot data
// existing at all, not on there being "enough" shots for a sigma estimate.
export function computeCombinedStats(project) {
  const pooledShots = [];
  for (const target of project.targets) {
    const scale = computeScale(target);
    if (!scale) continue;
    for (const group of target.groups) {
      if (!group.poa) continue;
      const poaMm = toMm(group.poa, target, scale);
      for (const shot of group.shots) {
        const shotMm = toMm(shot, target, scale);
        pooledShots.push({
          xMm: shotMm.x - poaMm.x,
          yMm: shotMm.y - poaMm.y,
          targetId: target.id,
          targetName: target.name,
          groupId: group.id
        });
      }
    }
  }

  const shotCount = pooledShots.length;
  if (shotCount < 3) return { status: 'tooFewShots', shotCount, pooledShots };
  if (shotCount > 1000) return { status: 'tooManyShots', shotCount, pooledShots };

  let avgX = 0;
  let avgY = 0;
  for (const p of pooledShots) {
    avgX += p.xMm;
    avgY += p.yMm;
  }
  avgX /= shotCount;
  avgY /= shotCount;

  let vx = 0;
  let vy = 0;
  for (const p of pooledShots) {
    const dx = p.xMm - avgX;
    const dy = p.yMm - avgY;
    vx += dx * dx;
    vy += dy * dy;
  }
  vx /= shotCount - 1; // biased sample variance, same as legacy
  vy /= shotCount - 1;
  const v = (vx + vy) / 2;

  const sigma = RAYLEIGH_COEFF[shotCount] * Math.sqrt(v);
  const confidenceLower = (RAYLEIGH_COEFF[shotCount] * Math.sqrt(CONF_LOWER[shotCount] * v)) / sigma;
  const confidenceUpper = (RAYLEIGH_COEFF[shotCount] * Math.sqrt(CONF_UPPER[shotCount] * v)) / sigma;

  const tdistc = TDIST_QUANTILE[shotCount] / Math.sqrt(shotCount);
  const poiCiMm = { x: Math.sqrt(vx) * tdistc, y: Math.sqrt(vy) * tdistc };

  const r95 = sigma * 2.45;

  return {
    status: 'ok',
    shotCount,
    pooledShots,
    poiMm: { x: avgX, y: avgY },
    poiCiMm,
    sigma,
    confidenceLower,
    confidenceUpper,
    r50: sigma * 1.18,
    r95,
    r95LowerBound: r95 * confidenceLower,
    r95UpperBound: r95 * confidenceUpper,
    r99: sigma * 3.03,
    d5x: sigma * 3.06,
    d10x: sigma * 3.79
  };
}

// Radius (mm) containing `percent`% of shots under the fitted Rayleigh
// model — the interactive "hit probability" slider. percent is 0..99 in
// the UI (matching legacy's own slider range); 100 would divide by zero
// inside the log and is deliberately not a valid input.
export function hitProbabilityRadiusMm(sigma, percent) {
  const v = 1 - percent / 100;
  return sigma * Math.sqrt(-Math.log(v * v));
}

// The "confidence-o-meter": maps the width of sigma's own confidence
// interval to one of 8 discrete quality levels (0 = worst/"Useless" ...
// 7 = best/"Awesome"), ported verbatim from synth-pane.js's CONFI_LEVELS
// threshold scan. Colors/i18n text for each level are a UI concern (see
// src/ui/rifle-precision/confidence-o-meter.js), not this pure module.
const CONFIDENCE_THRESHOLDS = [0.5, 0.45, 0.4, 0.35, 0.3, 0.25, 0.2, 0];

export function confidenceLevel(confidenceLower, confidenceUpper) {
  const ci = confidenceUpper - confidenceLower;
  for (let i = 0; i < CONFIDENCE_THRESHOLDS.length; i++) {
    if (ci > CONFIDENCE_THRESHOLDS[i]) return i;
  }
  return CONFIDENCE_THRESHOLDS.length - 1;
}

// Continuous 0..1 vertical position for the confidence-o-meter's gauge
// (0 = bottom/worst, 1 = top/best) — ported from synth-pane.js's own
// cipos formula, not just confidenceLevel()'s 8 discrete buckets. Two
// linear pieces meeting exactly at ci=0.5 (CONFIDENCE_THRESHOLDS[0], the
// "bullshit threshold"): ci in (0.2, 0.5] maps onto the top 80% of the
// gauge (spanning confidenceLevel()'s own 6 middle thresholds), ci in
// (0.5, 1.5] maps onto the bottom 20% ("Meaningless" band), each clamped
// beyond its own end.
export function confidenceScaleFraction(confidenceLower, confidenceUpper) {
  const ci = confidenceUpper - confidenceLower;
  const raw = ci > 0.5 ? (1.5 - ci) * 0.2 : 1 - (ci - 0.2) * (8 / 3);
  return Math.max(0, Math.min(1, raw));
}

// One MOA's real-world width (mm) at a given range — reuses this app's
// own exact angular-unit conversion (src/units.js) rather than legacy's
// hand-rolled constant, though for MOA specifically the two agree to 4
// decimal places (legacy's mrad constant does not — see mmToAngularUnit).
export function oneMoaWidthMm(rangeM) {
  return angularUnitToCmAtRange('arcmin', rangeM) * 10;
}

// Same idea as oneMoaWidthMm() above, for 1 mrad — used by the analysis
// diagram's own mrad-spaced grid options.
export function oneMradWidthMm(rangeM) {
  return angularUnitToCmAtRange('mrad', rangeM) * 10;
}

// Converts a real-world length (mm) at a given range into an angular unit
// ('arcmin' for MOA, or 'mrad') — replaces legacy's printInMOA/printInMrad.
// Legacy's own MOA constant checks out exactly against this; its mrad
// constant was off by a factor of 10 (a dropped-decimal bug), so this is a
// deliberate correction, not a byte-for-byte port, for that one unit.
export function mmToAngularUnit(valueMm, unit, rangeM) {
  const cmPerUnit = angularUnitToCmAtRange(unit, rangeM);
  if (!cmPerUnit) return 0;
  return valueMm / 10 / cmPerUnit;
}
