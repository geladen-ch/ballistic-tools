// Text for SVG markup the printable card generates: escaped for XML, so a
// name like "S&B" or "<1 MOA" stays text.
export function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
