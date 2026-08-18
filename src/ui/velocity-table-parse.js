import { displayToEngine } from '../units.js';

// Parses a pasted distance/velocity table (one "distance velocity" pair
// per line) — deliberately more lenient than cd-table-parse.js's own
// textarea parser, matching what the legacy getcdmach tool accepted:
// both '.' and ',' as decimal separator, and tab/space/semicolon (any
// mix) as the field separator. distanceUnit/velocityUnit name whichever
// unit the pasted numbers are actually in (this tool's own local unit
// selects, not necessarily the app's global display preference — a
// user pasting an external Doppler/chrono report needs to say what
// units *that data* is in).
export function parseVelocityTable(text, { distanceUnit, velocityUnit }) {
  const normalized = text.replace(/,/g, '.');
  const lines = normalized.split('\n').map((line) => line.trim()).filter((line) => line !== '');

  const points = [];
  for (let i = 0; i < lines.length; i++) {
    const parts = lines[i].split(/[;\t ]+/).filter(Boolean);
    if (parts.length !== 2) return { error: { key: 'cdMachCurve.tableErrorBadLine', params: { line: i + 1 } } };

    const d = Number(parts[0]);
    const v = Number(parts[1]);
    if (!Number.isFinite(d) || !Number.isFinite(v)) {
      return { error: { key: 'cdMachCurve.tableErrorBadLine', params: { line: i + 1 } } };
    }

    points.push({
      rangeM: displayToEngine('range', d, distanceUnit),
      velocityMs: displayToEngine('v1', v, velocityUnit)
    });
  }

  if (points.length < 3) return { error: { key: 'cdMachCurve.tableErrorTooFewRows' } };

  return { points };
}
