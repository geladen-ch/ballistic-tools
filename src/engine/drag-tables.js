// Standard McCoy-derived G1 and G7 drag coefficient tables (Mach -> Cd),
// the form republished by most exterior-ballistics tools (JBM, GNU
// Ballistics, Applied Ballistics). Transcribed from memory of those public
// tables — VERIFY against an authoritative source (e.g. jbmballistics.com)
// before relying on these for live-fire predictions.

export const G1_TABLE = [
  [0.00, 0.2629], [0.05, 0.2558], [0.10, 0.2487], [0.15, 0.2413],
  [0.20, 0.2344], [0.25, 0.2278], [0.30, 0.2214], [0.35, 0.2155],
  [0.40, 0.2104], [0.45, 0.2061], [0.50, 0.2032], [0.55, 0.2020],
  [0.60, 0.2034], [0.70, 0.2165], [0.725, 0.2230], [0.75, 0.2313],
  [0.775, 0.2417], [0.80, 0.2546], [0.825, 0.2706], [0.85, 0.2901],
  [0.875, 0.3136], [0.90, 0.3415], [0.925, 0.3734], [0.95, 0.4084],
  [0.975, 0.4448], [1.00, 0.4805], [1.025, 0.5136], [1.05, 0.5427],
  [1.075, 0.5677], [1.10, 0.5883], [1.125, 0.6053], [1.15, 0.6191],
  [1.20, 0.6393], [1.25, 0.6518], [1.30, 0.6589], [1.35, 0.6621],
  [1.40, 0.6625], [1.45, 0.6607], [1.50, 0.6573], [1.55, 0.6528],
  [1.60, 0.6474], [1.65, 0.6413], [1.70, 0.6347], [1.75, 0.6280],
  [1.80, 0.6210], [1.85, 0.6141], [1.90, 0.6072], [1.95, 0.6003],
  [2.00, 0.5934], [2.10, 0.5804], [2.20, 0.5685], [2.30, 0.5577],
  [2.40, 0.5481], [2.50, 0.5397], [2.60, 0.5325], [2.70, 0.5264],
  [2.80, 0.5211], [2.90, 0.5168], [3.00, 0.5133], [3.20, 0.5084],
  [3.40, 0.5054], [3.60, 0.5030], [3.80, 0.5016], [4.00, 0.5006],
  [4.40, 0.4995], [4.80, 0.4990], [5.00, 0.4988]
];

export const G7_TABLE = [
  [0.00, 0.1198], [0.05, 0.1197], [0.10, 0.1196], [0.15, 0.1194],
  [0.20, 0.1193], [0.25, 0.1194], [0.30, 0.1194], [0.35, 0.1194],
  [0.40, 0.1193], [0.45, 0.1193], [0.50, 0.1194], [0.55, 0.1193],
  [0.60, 0.1194], [0.65, 0.1197], [0.70, 0.1202], [0.725, 0.1207],
  [0.75, 0.1215], [0.775, 0.1226], [0.80, 0.1242], [0.825, 0.1266],
  [0.85, 0.1306], [0.875, 0.1368], [0.90, 0.1464], [0.925, 0.1660],
  [0.95, 0.2054], [0.975, 0.2993], [1.00, 0.3803], [1.025, 0.4015],
  [1.05, 0.4043], [1.075, 0.4034], [1.10, 0.4014], [1.125, 0.3987],
  [1.15, 0.3955], [1.20, 0.3884], [1.25, 0.3810], [1.30, 0.3732],
  [1.35, 0.3657], [1.40, 0.3580], [1.50, 0.3440], [1.55, 0.3376],
  [1.60, 0.3315], [1.65, 0.3260], [1.70, 0.3209], [1.75, 0.3160],
  [1.80, 0.3117], [1.85, 0.3078], [1.90, 0.3042], [1.95, 0.3010],
  [2.00, 0.2980], [2.10, 0.2922], [2.20, 0.2864], [2.30, 0.2807],
  [2.40, 0.2752], [2.50, 0.2697], [2.60, 0.2640], [2.70, 0.2591],
  [2.80, 0.2547], [2.90, 0.2507], [3.00, 0.2470], [3.20, 0.2409],
  [3.40, 0.2357], [3.60, 0.2310], [3.80, 0.2269], [4.00, 0.2233],
  [4.40, 0.2213], [4.80, 0.2194], [5.00, 0.2185]
];

// The registry of every standard reference drag model this app knows
// about — the single source of truth both for DRAG_TABLES below (the
// engine's own bc+dragModel lookup) and for every ballistic-model
// <select> in the UI (see ui/drag-model-select.js), plus Settings' own
// per-model show/hide toggles (see drag-model-prefs.js). Supporting a
// future standard model (G2, G5, G6, GS, GL, ...) is just one more table
// constant above plus one more entry here — nothing else needs to change.
export const DRAG_MODELS = [
  { id: 'G1', table: G1_TABLE, labelKey: 'common.dragModelG1' },
  { id: 'G7', table: G7_TABLE, labelKey: 'common.dragModelG7' }
];

export const DRAG_TABLES = Object.fromEntries(DRAG_MODELS.map((m) => [m.id, m.table]));

// Per-point interpolation curves, one [a, b, c] quadratic (cd = c + mach*(b
// + a*mach)) per table point: the two endpoints get a linear fit (a=0)
// through their one neighbor, every interior point gets a proper 2nd-degree
// fit through itself and its two neighbors. Building this is O(n) — cheap
// once, but this table is used for library bullets' Cd curves too and
// makeStepper() (and so makeCdLookup()) gets rebuilt on *every single shot*
// of a Monte Carlo batch, so it must never be redone per shot. Cached here
// by table identity (G1_TABLE/G7_TABLE are fixed references, and a loaded
// bullet's cdTable array is reused across an entire batch) so it's computed
// at most once per distinct table, no matter how many shots use it.
const curvesCache = new WeakMap();

function fitCurves(table) {
  const n = table.length;
  const curves = new Array(n);

  const [x0, y0] = table[0];
  const [x1, y1] = table[1];
  let rate = (y1 - y0) / (x1 - x0);
  curves[0] = [0, rate, y0 - x0 * rate];

  for (let i = 1; i < n - 1; i++) {
    const [xa, ya] = table[i - 1];
    const [xb, yb] = table[i];
    const [xc, yc] = table[i + 1];
    const a = ((yc - ya) * (xb - xa) - (yb - ya) * (xc - xa)) /
      ((xc * xc - xa * xa) * (xb - xa) - (xb * xb - xa * xa) * (xc - xa));
    const b = (yb - ya - a * (xb * xb - xa * xa)) / (xb - xa);
    const c = ya - (a * xa * xa + b * xa);
    curves[i] = [a, b, c];
  }

  const [xLast, yLast] = table[n - 1];
  const [xPrev, yPrev] = table[n - 2];
  rate = (yLast - yPrev) / (xLast - xPrev);
  curves[n - 1] = [0, rate, yPrev - xPrev * rate];

  return curves;
}

function curvesFor(table) {
  let curves = curvesCache.get(table);
  if (!curves) {
    curves = fitCurves(table);
    curvesCache.set(table, curves);
  }
  return curves;
}

// Cursor-based Cd lookup: Mach decreases monotonically along almost all of
// a trajectory, so each lookup walks forward/back a few slots from wherever
// the previous call left off instead of binary-searching from scratch. Once
// the bracketing pair of table points is found, blends the two points' own
// fitted curves (2nd-degree for interior points, linear at the two ends),
// weighted linearly by how close the query is to each bracket point.
//
// Both curves of a bracket pass exactly through *both* bracket points (each
// is an exact fit through its 3 - or 2, at the ends - defining points, and
// adjacent curves share 2 of those), so the blend is exact and continuous
// at every table point regardless of weighting, and interpolates smoothly
// between them in between. An earlier version picked whichever curve was
// nearer and evaluated only that one - cheaper, but the two curves only
// agree at the shared bracket points, so the value jumped (by several
// percent, right in the steepest part of a transonic curve) at the switch
// point in the middle of the interval, whenever the winner changed.
export function makeCdLookup(table) {
  const curves = curvesFor(table);
  const last = table.length - 1;
  let i = 0;
  return function cdAt(mach) {
    if (mach <= table[0][0]) return table[0][1];
    if (mach >= table[last][0]) return table[last][1];
    while (i > 0 && table[i][0] > mach) i--;
    while (i < last - 1 && table[i + 1][0] <= mach) i++;

    const x0 = table[i][0], x1 = table[i + 1][0];
    const w1 = (mach - x0) / (x1 - x0);
    const [a0, b0, c0] = curves[i];
    const [a1, b1, c1] = curves[i + 1];
    const y0 = c0 + mach * (b0 + a0 * mach);
    const y1 = c1 + mach * (b1 + a1 * mach);
    return y0 + w1 * (y1 - y0);
  };
}
