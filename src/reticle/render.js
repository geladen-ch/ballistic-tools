// Path data for drawing a reticle's primitives (reticle/geometry.js) into
// an SVG — shared by the Reticle Designer's view and reticle thumbnails.
// Pure — no DOM.
//
// Geometry is in radians; `toScreen(x, y)` maps a point to drawing units
// and `k` is drawing units per radian — a view transform, not a unit
// conversion. Mapping in script rather than with an SVG transform keeps
// sub-mrad shapes clear of the renderer's single-precision coordinate
// rounding.

export const fmt = (v) => (Math.round(v * 100) / 100).toString();

export function polygonPath(points) {
  return `M${points.map(([x, y]) => `${fmt(x)} ${fmt(y)}`).join('L')}Z`;
}

export function circlePath(cx, cy, r) {
  return `M${fmt(cx - r)} ${fmt(cy)}a${fmt(r)} ${fmt(r)} 0 1 0 ${fmt(2 * r)} 0a${fmt(r)} ${fmt(r)} 0 1 0 ${fmt(-2 * r)} 0Z`;
}

// A polygon, disk, ring or horseshoe primitive as path data (drawn with
// the even-odd rule, so a ring's inner circle is a hole).
export function primitivePath(p, toScreen, k) {
  if (p.kind === 'polygon') return polygonPath(p.points.map(([x, y]) => toScreen(x, y)));
  const [cx, cy] = toScreen(p.cx, p.cy);
  if (p.kind === 'disk') return circlePath(cx, cy, p.r * k);
  const ro = p.rOuter * k;
  const ri = p.rInner * k;
  if (p.kind === 'ring' || !(p.gap > 0)) return circlePath(cx, cy, ro) + (ri > 0 ? circlePath(cx, cy, ri) : '');
  const a0 = p.gapCenter + p.gap / 2;
  const a1 = p.gapCenter - p.gap / 2 + 2 * Math.PI;
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const at = (r, a) => `${fmt(cx + r * Math.cos(a))} ${fmt(cy + r * Math.sin(a))}`;
  const outer = `M${at(ro, a0)}A${fmt(ro)} ${fmt(ro)} 0 ${large} 1 ${at(ro, a1)}`;
  if (!(ri > 0)) return `${outer}L${fmt(cx)} ${fmt(cy)}Z`;
  return `${outer}L${at(ri, a1)}A${fmt(ri)} ${fmt(ri)} 0 ${large} 0 ${at(ri, a0)}Z`;
}
