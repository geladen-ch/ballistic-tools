// Parses a pasted Cd-Mach drag table: one "mach cd" pair per line,
// whitespace-separated, blank lines ignored — producing the same [mach,
// cd] pair shape the engine's built-in drag tables already use (see
// drag-tables.js), checked against exactly what makeCdLookup() there
// assumes: at least two points, and Mach strictly increasing from one row
// to the next (its cursor-based lookup walks the table assuming ascending
// order — a table that isn't sorted would silently mislookup rather than
// error, so this is caught here instead, up front).
export function parseCdTable(text) {
  const lines = text.split('\n').map((line) => line.trim()).filter((line) => line !== '');
  if (lines.length < 2) return { error: { key: 'arsenal.cdTableErrorTooFewRows' } };

  const table = [];
  for (let i = 0; i < lines.length; i++) {
    const parts = lines[i].split(/\s+/);
    if (parts.length !== 2) return { error: { key: 'arsenal.cdTableErrorBadLine', params: { line: i + 1 } } };

    const mach = Number(parts[0]);
    const cd = Number(parts[1]);
    if (!Number.isFinite(mach) || !Number.isFinite(cd)) {
      return { error: { key: 'arsenal.cdTableErrorBadLine', params: { line: i + 1 } } };
    }
    if (mach < 0 || cd <= 0) {
      return { error: { key: 'arsenal.cdTableErrorBadValue', params: { line: i + 1 } } };
    }
    if (table.length > 0 && mach <= table[table.length - 1][0]) {
      return { error: { key: 'arsenal.cdTableErrorNotIncreasing', params: { line: i + 1 } } };
    }
    table.push([mach, cd]);
  }
  return { table };
}

// The inverse of parseCdTable — used to pre-fill the textarea when editing
// an existing custom-table bullet (or a prefill carrying one forward from
// "Add to arsenal" — see bullet-section.js's getArsenalPrefill()).
export function formatCdTable(table) {
  return table.map(([mach, cd]) => `${mach} ${cd}`).join('\n');
}
