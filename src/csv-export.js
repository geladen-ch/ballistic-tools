// Pure CSV-text assembly for the Trajectory table's "export to CSV"
// button — no DOM, no file I/O (trajectory-view.js handles the download
// itself via download.js). Kept separate and DOM-free so the separator
// handling can be unit-tested directly.

// RFC4180-ish quoting: a cell is only wrapped in quotes if it actually
// contains the field separator, a quote, or a newline — most cells here
// are plain numbers or short header words, so leaving those unquoted
// keeps the file readable as plain text too, not just in a spreadsheet.
function escapeCsvField(text, fieldSeparator) {
  const needsQuoting = text.includes(fieldSeparator) || text.includes('"') || text.includes('\n') || text.includes('\r');
  if (!needsQuoting) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

// `rows` is an array of arrays of already-formatted string cells (see
// formatCsvNumber below for numeric ones) — this function only knows how
// to join and quote them. \r\n line endings are the widest-compatible
// choice for spreadsheet software opening the file directly, Excel
// included.
export function buildCsv(rows, fieldSeparator) {
  return rows.map((cells) => cells.map((cell) => escapeCsvField(cell, fieldSeparator)).join(fieldSeparator)).join('\r\n');
}

// Formats a numeric value exactly like the table's own cell text
// (toFixed to the column's decimals), then swaps in the user's chosen
// decimal separator. toFixed always produces a plain '.', so a plain
// substitution is exact — never touches a digit.
export function formatCsvNumber(value, decimals, decimalSeparator) {
  const text = value.toFixed(decimals);
  return decimalSeparator === '.' ? text : text.replace('.', decimalSeparator);
}
