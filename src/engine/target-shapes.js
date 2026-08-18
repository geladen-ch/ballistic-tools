// Analytical hit-probability primitives for target zones, given an
// independent-axis (uncorrelated) bivariate Gaussian dispersion —
// reference algorithm and derivation supplied directly.

const SQRT_2 = Math.sqrt(2);

// Rational approximation to the Gaussian error function, precise to
// ~1.2e-7 (the classic "erfcc" formula). Computed, not tabled — fine for
// this module's current callers (an analytical single-shot solve, called
// a handful of times per input change, not a Monte Carlo batch). A
// table-lookup variant (~40x faster, argument rounded to 0.001) exists
// and should replace this if/when a Monte Carlo-based scenario needs it
// in an actual hot loop.
export function erf(v) {
  const t = 1 / (1 + 0.5 * Math.abs(v));
  const result = 1 - t * Math.exp(-v * v - 1.26551223 +
    t * (1.00002368 +
      t * (0.37409196 +
        t * (0.09678418 +
          t * (-0.18628806 +
            t * (0.27886807 +
              t * (-1.13520398 +
                t * (1.48851587 +
                  t * (-0.82215223 +
                    t * 0.17087277)))))))));
  return v < 0 ? -result : result;
}

// Hit probability of an axis-aligned rectangle under an independent-axis
// bivariate Gaussian dispersion. `x0`/`y0` are the rectangle's own corner
// nearest the coordinate origin, `width`/`height` its extent from there —
// not necessarily centered on the origin. `offsetX`/`offsetY` is where the
// dispersion is actually centered in that same frame (e.g. mean point of
// impact relative to point of aim). Derivation: for X ~ Normal(offsetX,
// sdX^2), P(x0 <= X <= x0+width) = Phi((x0+width-offsetX)/sdX) -
// Phi((x0-offsetX)/sdX), and Phi(z) = (1 + erf(z/sqrt2)) / 2, so the two
// halves cancel to the erf-difference form below. X and Y are independent,
// so the joint probability is the product of the two marginal ones.
export function rectangleHitProbability(x0, y0, width, height, sdX, sdY, offsetX = 0, offsetY = 0) {
  const probX = (erf((x0 + width - offsetX) / sdX / SQRT_2) - erf((x0 - offsetX) / sdX / SQRT_2)) / 2;
  const probY = (erf((y0 + height - offsetY) / sdY / SQRT_2) - erf((y0 - offsetY) / sdY / SQRT_2)) / 2;
  return probX * probY;
}

const SQRT_PI = Math.sqrt(Math.PI);

// Hit probability of a circle, approximated as the axis-aligned square of
// equal area (side r*sqrt(pi), so side^2 = pi*r^2) centered on the same
// point, then handed to rectangleHitProbability — reference algorithm
// supplied directly. `cx`/`cy` is the circle's own center in the same
// frame `offsetX`/`offsetY` (where the dispersion is actually centered)
// is expressed in.
export function circleHitProbability(cx, cy, r, sdX, sdY, offsetX = 0, offsetY = 0) {
  const side = r * SQRT_PI;
  return rectangleHitProbability(cx - side / 2, cy - side / 2, side, side, sdX, sdY, offsetX, offsetY);
}
