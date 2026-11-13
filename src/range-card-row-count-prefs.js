// Cookie-backed preference for how many rows the Range Solver's targets
// list shows when its Optimal fit is off (src/ui/range-solver/target-
// list.js; read and written through range-solver-fire-config.js) — same
// shape as wind-dial-prefs.js. Only ever an upper bound: the list still
// caps the count at what fits its cell.
import { getCookie, setCookie } from './cookies.js';

const COOKIE_NAME = 'ballistics_range_card_row_count_v1';
export const MIN_ROW_COUNT = 3;
export const MAX_ROW_COUNT = 12;
const DEFAULT_ROW_COUNT = 6;

export function getRangeCardRowCount() {
  const raw = getCookie(COOKIE_NAME);
  const n = raw !== null ? parseInt(raw, 10) : NaN;
  if (Number.isFinite(n) && n >= MIN_ROW_COUNT && n <= MAX_ROW_COUNT) return n;
  return DEFAULT_ROW_COUNT;
}

export function setRangeCardRowCount(n) {
  const clamped = Math.min(MAX_ROW_COUNT, Math.max(MIN_ROW_COUNT, Math.round(n)));
  try {
    setCookie(COOKIE_NAME, String(clamped));
  } catch {
    // best-effort — losing persistence isn't fatal
  }
  return clamped;
}
