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

// --- Generic profile-based hit probability (vertically symmetric shapes) ---
//
// Shapes that don't reduce to a rectangle or circle — a tapered popper body
// topped by a circular head, a polygon-outline paper silhouette, or any
// other shape symmetric about a vertical center line — can still be priced
// without Monte Carlo by describing them as a half-width profile:
// halfWidthAt(y) gives the shape's horizontal half-extent at height y (0
// outside the shape). Hit probability is then
//
//   P = integral over y of [PhiX(right(y)) - PhiX(left(y))] * densityY(y) dy
//
// the same per-row erf term rectangleHitProbability uses, integrated
// against the Y dispersion's own density instead of assuming one fixed
// row. The y-range is finite (the shape's own extent), so this integrates
// cleanly with fixed-node Gauss-Legendre quadrature: a deterministic
// numerical method, not a stochastic one — summing ~24 erf evaluations at
// fixed nodes, no sampling, no variance, no seed.

// Roots and weights of the n-th Legendre polynomial on [-1, 1], found by
// Newton's method (the classic "gauleg" algorithm) rather than transcribed
// from a printed table, so there's no risk of a mistyped digit. Memoized
// per n since a given caller (a target's own hitProbability()) asks for
// the same node count every time it runs.
const gaussLegendreCache = new Map();
export function gaussLegendreNodes(n) {
  if (gaussLegendreCache.has(n)) return gaussLegendreCache.get(n);
  const nodes = new Array(n);
  const weights = new Array(n);
  const m = Math.floor((n + 1) / 2);
  for (let i = 1; i <= m; i++) {
    let x = Math.cos(Math.PI * (i - 0.25) / (n + 0.5));
    let dp = 0;
    for (let iter = 0; iter < 100; iter++) {
      let pPrev = 1, pCurr = x;
      for (let k = 2; k <= n; k++) {
        const pNext = ((2 * k - 1) * x * pCurr - (k - 1) * pPrev) / k;
        pPrev = pCurr;
        pCurr = pNext;
      }
      // pCurr = P_n(x), pPrev = P_{n-1}(x); derivative via the standard
      // Legendre recurrence P_n'(x) = n/(x^2-1) * (x*P_n(x) - P_{n-1}(x))
      dp = n * (x * pCurr - pPrev) / (x * x - 1);
      const dx = pCurr / dp;
      x -= dx;
      if (Math.abs(dx) < 1e-15) break;
    }
    nodes[i - 1] = -x;
    nodes[n - i] = x;
    const w = 2 / ((1 - x * x) * dp * dp);
    weights[i - 1] = w;
    weights[n - i] = w;
  }
  const result = { nodes, weights };
  gaussLegendreCache.set(n, result);
  return result;
}

const SQRT_2PI = Math.sqrt(2 * Math.PI);

// Hit probability of a shape symmetric about the vertical line x = centerX,
// described by its half-width at each height (`halfWidthAt(y)`, 0 outside
// the shape) over a finite y-range [yMin, yMax] — the shape's own extent.
// `sdX`/`sdY`/`offsetX`/`offsetY` are the same independent-axis Gaussian
// dispersion as every other primitive in this file. See the block comment
// above for the derivation; `nodeCount` is the Gauss-Legendre node count
// (48 is comfortably enough for shapes made of lines and circular arcs —
// see the node-count rationale further down).
//
// Fixed-node quadrature only resolves the integrand well where it's
// actually smooth. Two separate failure modes, both handled below:
//
// 1. With sdY tiny relative to (yMax-yMin) (a precise group on a tall
//    target), nodes spread evenly across the whole shape could straddle
//    the Y density's narrow spike and sample ~0 everywhere, undercounting
//    a probability that's actually ~1. Fixed by first clipping the window
//    to [offsetY-8sdY, offsetY+8sdY] intersected with [yMin,yMax] — beyond
//    8 SDs the Gaussian tail is ~1e-15, negligible at any tolerance this
//    module cares about — which keeps the nodes concentrated on the mass
//    regardless of how narrow sdY is relative to the shape.
// 2. A shape assembled from more than one piece (unionHalfWidth) is only
//    piecewise-smooth: halfWidthAt(y) has a kink whereever the union
//    switches which piece is widest (e.g. a popper's taper-meets-circle
//    join), and a polyline profile has one at every vertex. A single
//    quadrature panel converges only algebraically (not exponentially)
//    across a kink, and if an off-axis offsetX also makes the per-row
//    X-probability curve steep right at that kink, 24 nodes can land
//    ~1e-3 relative off — orders of magnitude worse than this module's
//    usual ~1e-7 (erf's own precision floor). Fixed by running separate
//    quadrature panels between consecutive breakpoints (composite
//    quadrature): halfWidthAt may carry a `.breakpoints` array of y-values
//    where it's non-smooth (polylineHalfWidth/circularArcHalfWidth/
//    unionHalfWidth below all set this automatically), and any that fall
//    inside the clipped window split it into sub-panels, each smooth
//    inside its own bounds. Composite quadrature only helps where the
//    shape itself declares a breakpoint, though: a curved (circular-arc)
//    panel with no breakpoint in it can still converge slowly if sdX is
//    tiny AND offsetX happens to place the X-probability curve's own
//    transition inside that panel (nothing to split on — the transition's
//    location depends on offsetX, not the shape). 48 nodes (vs. this
//    module's earlier 24) keeps that residual error well under
//    circleHitProbability's own ~2%-tolerance approximation error even in
//    adversarial cases (sdX below ~1% of the shape's size); it isn't zero
//    for arbitrarily tiny sdX, but no fixed node count makes it exactly
//    zero, and this module's realistic callers (group dispersion in cm on
//    targets tens of cm across) sit nowhere near that regime.
export function profileHitProbability(halfWidthAt, yMin, yMax, sdX, sdY, offsetX = 0, offsetY = 0, centerX = 0, nodeCount = 48) {
  const yLo = Math.max(yMin, offsetY - 8 * sdY);
  const yHi = Math.min(yMax, offsetY + 8 * sdY);
  if (yLo >= yHi) return 0;
  const breakpoints = (halfWidthAt.breakpoints || []).filter((b) => b > yLo && b < yHi).sort((a, b) => a - b);
  const panelEdges = [yLo, ...breakpoints, yHi];
  const { nodes, weights } = gaussLegendreNodes(nodeCount);
  let total = 0;
  for (let p = 0; p < panelEdges.length - 1; p++) {
    const half = (panelEdges[p + 1] - panelEdges[p]) / 2;
    const mid = (panelEdges[p + 1] + panelEdges[p]) / 2;
    for (let i = 0; i < nodes.length; i++) {
      const y = mid + half * nodes[i];
      const hw = halfWidthAt(y);
      if (hw <= 0) continue;
      const probXAtY = (erf((centerX + hw - offsetX) / sdX / SQRT_2) - erf((centerX - hw - offsetX) / sdX / SQRT_2)) / 2;
      const z = (y - offsetY) / sdY;
      const densityY = Math.exp(-0.5 * z * z) / (sdY * SQRT_2PI);
      total += weights[i] * probXAtY * densityY * half;
    }
  }
  return total;
}

// A half-width profile for a straight-sided taper (or any piecewise-linear
// silhouette edge): `points` is [[y0, halfWidth0], [y1, halfWidth1], ...]
// sorted by ascending y. Linearly interpolates between consecutive points;
// 0 outside [y0, yLast]. Each vertex is a potential kink (a slope change),
// so they're all exposed as `.breakpoints` for profileHitProbability's
// composite quadrature.
export function polylineHalfWidth(points) {
  const fn = (y) => {
    if (y < points[0][0] || y > points[points.length - 1][0]) return 0;
    for (let i = 1; i < points.length; i++) {
      const [y1, hw1] = points[i];
      if (y <= y1) {
        const [y0, hw0] = points[i - 1];
        const t = y1 === y0 ? 0 : (y - y0) / (y1 - y0);
        return hw0 + t * (hw1 - hw0);
      }
    }
    return 0;
  };
  fn.breakpoints = points.map(([y]) => y);
  return fn;
}

// A half-width profile for a circular cap/arc of radius r centered at
// height cy on the same vertical center line the profile is evaluated on —
// 0 outside the circle's own [cy-r, cy+r] extent. Its two tangent points
// (where the arc meets zero width) are exposed as `.breakpoints`: the
// profile is continuous there but has a vertical tangent, which quadrature
// resolves better split off into its own panel than folded into a wider
// one.
export function circularArcHalfWidth(cy, r) {
  const fn = (y) => {
    const dy = y - cy;
    return Math.abs(dy) > r ? 0 : Math.sqrt(r * r - dy * dy);
  };
  fn.breakpoints = [cy - r, cy + r];
  return fn;
}

// Combines several half-width profiles into their union (the pointwise
// max) — e.g. a tapered body profile union a circular-cap profile, for a
// silhouette assembled from more than one piece. Carries forward every
// component's own `.breakpoints`; a crossover where the max switches from
// one profile to another is itself only caught this way when it falls on
// a breakpoint one of the components already declares (true whenever the
// pieces are authored to meet exactly at a shared vertex, as
// src/targets/ipsc-popper.js's taper does with its own circle) — this
// doesn't hunt for arbitrary curve intersections between components.
export function unionHalfWidth(...profiles) {
  const fn = (y) => Math.max(...profiles.map((p) => p(y)));
  fn.breakpoints = profiles.flatMap((p) => p.breakpoints || []);
  return fn;
}
