// Cookie-backed CSV export formatting preferences (see Settings) — the
// field separator and decimal separator used by the Trajectory table's
// "export to CSV" button. Its own tiny module rather than folded into
// prefs.js since these aren't unit preferences and don't need that
// module's per-group defaulting machinery; same shape as library-prefs.js.
// Defaults (comma field separator, dot decimal separator) match the
// common US/UK CSV convention.
import { getCookie, setCookie } from './cookies.js';

const FIELD_SEPARATOR_COOKIE = 'ballistics_csv_field_separator_v1';
const DECIMAL_SEPARATOR_COOKIE = 'ballistics_csv_decimal_separator_v1';

const DEFAULT_FIELD_SEPARATOR = ',';
const DEFAULT_DECIMAL_SEPARATOR = '.';

// Deliberately a short, fixed set rather than a free-text field — an
// arbitrary separator risks producing a file spreadsheet software can't
// parse at all, where a wrong pick from this list is at worst the other
// well-known convention.
export const FIELD_SEPARATOR_CHOICES = [
  { value: ',', labelKey: 'settings.csvSepComma' },
  { value: ';', labelKey: 'settings.csvSepSemicolon' },
  { value: '\t', labelKey: 'settings.csvSepTab' }
];

export const DECIMAL_SEPARATOR_CHOICES = [
  { value: '.', labelKey: 'settings.csvDecimalDot' },
  { value: ',', labelKey: 'settings.csvDecimalComma' }
];

function readCookie(cookieName, choices, fallback) {
  const raw = getCookie(cookieName);
  if (raw !== null && choices.some((c) => c.value === raw)) return raw;
  return fallback;
}

export function getFieldSeparator() {
  return readCookie(FIELD_SEPARATOR_COOKIE, FIELD_SEPARATOR_CHOICES, DEFAULT_FIELD_SEPARATOR);
}

export function setFieldSeparator(value) {
  try {
    setCookie(FIELD_SEPARATOR_COOKIE, value);
  } catch {
    // best-effort — losing persistence isn't fatal
  }
}

export function getDecimalSeparator() {
  return readCookie(DECIMAL_SEPARATOR_COOKIE, DECIMAL_SEPARATOR_CHOICES, DEFAULT_DECIMAL_SEPARATOR);
}

export function setDecimalSeparator(value) {
  try {
    setCookie(DECIMAL_SEPARATOR_COOKIE, value);
  } catch {
    // best-effort — losing persistence isn't fatal
  }
}
