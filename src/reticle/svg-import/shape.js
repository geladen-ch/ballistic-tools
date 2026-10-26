// Re-validation of an imported shape held in a reticle record — run on
// every shape that comes from outside the importer (a loaded reticle
// file), with the importer's own limits, so a hand-edited file can't
// smuggle in anything the importer itself would have refused. Pure.
//
// Returns the shape in canonical form (paths re-parsed and re-written,
// bounds recomputed from the geometry, not trusted from the input);
// throws ImportError otherwise.
import { ImportError } from './errors.js';
import { LIMITS } from './extract.js';
import { MAX_COORDINATE, parsePathData, formatCommands, flattenCommands, inkBounds } from './path-data.js';

const CAPS = ['butt', 'round', 'square'];
const JOINS = ['miter', 'round', 'bevel'];
const FILL_RULES = ['nonzero', 'evenodd'];

export function normalizeShape(raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.paths) || raw.paths.length === 0) throw new ImportError('badShape');
  if (raw.paths.length > LIMITS.maxElements) throw new ImportError('tooComplex');
  const budget = { segments: LIMITS.maxSegments };
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const paths = raw.paths.map((p) => {
    if (!p || typeof p !== 'object' || typeof p.d !== 'string') throw new ImportError('badShape');
    const stroke = p.stroke === undefined ? 0 : p.stroke;
    if (typeof stroke !== 'number' || !Number.isFinite(stroke) || stroke < 0 || stroke > MAX_COORDINATE) throw new ImportError('badShape');
    const fill = p.fill === true;
    if (!fill && !(stroke > 0)) throw new ImportError('badShape');
    const commands = parsePathData(p.d, budget);
    if (commands.length === 0) throw new ImportError('badShape');
    const miter = typeof p.miter === 'number' && p.miter >= 1 && p.miter <= 100 ? p.miter : 4;
    const path = {
      d: formatCommands(commands),
      fill,
      fillRule: FILL_RULES.includes(p.fillRule) ? p.fillRule : 'nonzero',
      stroke,
      cap: CAPS.includes(p.cap) ? p.cap : 'butt',
      join: JOINS.includes(p.join) ? p.join : 'miter',
      miter
    };
    const box = inkBounds(flattenCommands(commands), path);
    if (box) {
      x0 = Math.min(x0, box[0]); y0 = Math.min(y0, box[1]);
      x1 = Math.max(x1, box[2]); y1 = Math.max(y1, box[3]);
    }
    return path;
  });
  if (!(x1 >= x0) || !(y1 >= y0)) throw new ImportError('badShape');
  return { paths, bounds: [x0, y0, x1, y1], segments: LIMITS.maxSegments - budget.segments };
}
