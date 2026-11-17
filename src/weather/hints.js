// Known data issues by country, shipped as data: short hints the weather block shows next to a result, explaining
// why it may be less accurate in some places. No station data, no coordinates beyond what hints-eval.js needs; the
// wording lives in the locale files under `onlineWeather.hint.<id>`.
//
// An entry: { id, countries, trigger, severity, checked }
//   countries  ISO 3166-1 alpha-2 codes the entry is about; null = any country (the entry is not country-specific).
//   trigger    all listed conditions must hold (they combine with "and"):
//                country     a counted country is among `countries`
//                event       a data check fired for a candidate station of a counted country (qc code of the report)
//                noSynop     no SYNOP report was available among the candidates
//                far         the nearest contributor is more than 30 km away, or the weighted contributor height
//                            differs from the device's by more than 300 m
//                spread      the temperature neighbours disagree strongly (median absolute deviation above 2 K)
//                altitude    the weighted contributor height differs from the device's by more than 300 m
//                rejected    the check left a contributing station out
//   severity   'warn' | 'info'; at most two hints show, warnings first.
//   checked    the date the entry was last verified against live data; tests fail for an entry older than a year,
//              so the table is looked at again before it ships on.
//
// Counted countries: those of the stations that weigh at least 10 % in some quantity, plus that of the nearest
// contributor. A country comes from the report's network (METAR), from a national WIGOS id (SYNOP) or from the
// service itself (national services); no reverse geocoding.

const AFRICA = ['DZ', 'AO', 'BJ', 'BW', 'BF', 'BI', 'CM', 'CV', 'CF', 'TD', 'KM', 'CG', 'CD', 'CI', 'DJ', 'EG', 'GQ', 'ER', 'SZ', 'ET',
  'GA', 'GM', 'GH', 'GN', 'GW', 'KE', 'LS', 'LR', 'LY', 'MG', 'MW', 'ML', 'MR', 'MU', 'MA', 'MZ', 'NA', 'NE', 'NG', 'RW', 'ST', 'SN',
  'SC', 'SL', 'SO', 'ZA', 'SS', 'SD', 'TZ', 'TG', 'TN', 'UG', 'ZM', 'ZW'];

export const HINTS_TABLE_VERSION = 1;

/** @type {{id:string, countries:string[]|null, trigger:object, severity:'warn'|'info', checked:string}[]} */
export const HINTS = Object.freeze([
  // data problems of a country's feed
  { id: 'E-BR-1', countries: ['BR'], trigger: { country: true, event: 'pressureInconsistent' }, severity: 'info', checked: '2026-11-15' },
  { id: 'E-LV-1', countries: ['LV'], trigger: { country: true, event: 'pressureOutOfRange' }, severity: 'info', checked: '2026-11-15' },
  { id: 'E-IS-1', countries: ['IS'], trigger: { country: true }, severity: 'info', checked: '2026-11-15' },
  { id: 'E-CH-1', countries: null, trigger: { event: 'pressureInconsistent' }, severity: 'info', checked: '2026-11-15' },
  { id: 'E-CA-ES-TH-1', countries: ['CA', 'ES', 'TH'], trigger: { country: true, event: 'pressureInconsistent' }, severity: 'info', checked: '2026-11-15' },
  { id: 'E-DELAY-1', countries: ['BR', 'CL', 'DK', 'NO', 'IS'], trigger: { country: true }, severity: 'info', checked: '2026-11-14' },
  { id: 'E-US-1', countries: ['US'], trigger: { country: true, far: true }, severity: 'warn', checked: '2026-11-16' },
  { id: 'E-NOSYN-1', countries: ['CN', 'IN', 'JP', 'KR', 'RU', ...AFRICA], trigger: { country: true, noSynop: true, far: true }, severity: 'warn', checked: '2026-11-14' },
  { id: 'E-LATE-1', countries: ['IN', 'ZA', 'KE'], trigger: { country: true }, severity: 'info', checked: '2026-11-13' },
  // general
  { id: 'E-G-1', countries: null, trigger: { spread: true }, severity: 'info', checked: '2026-11-15' },
  { id: 'E-G-2', countries: null, trigger: { altitude: true }, severity: 'info', checked: '2026-11-15' },
  { id: 'E-G-3', countries: null, trigger: { rejected: true }, severity: 'info', checked: '2026-11-15' },
  // countries whose national service is not used, and why
  { id: 'E-NS-IT', countries: ['IT'], trigger: { country: true }, severity: 'info', checked: '2026-11-15' },
  { id: 'E-NS-RU', countries: ['RU'], trigger: { country: true }, severity: 'info', checked: '2026-11-15' },
  { id: 'E-NS-NL', countries: ['NL'], trigger: { country: true }, severity: 'info', checked: '2026-11-15' },
  { id: 'E-NS-NO', countries: ['NO'], trigger: { country: true }, severity: 'info', checked: '2026-11-15' },
  { id: 'E-NS-JP', countries: ['JP'], trigger: { country: true }, severity: 'info', checked: '2026-11-15' },
  { id: 'E-NS-NOCORS', countries: ['BE', 'CZ', 'SK', 'HU', 'HR', 'EE', 'LV', 'LT', 'AU', 'AR', 'TR', 'NZ'], trigger: { country: true }, severity: 'info', checked: '2026-11-15' },
  { id: 'E-NS-META', countries: ['PL', 'PT', 'IE', 'IS', 'BR'], trigger: { country: true }, severity: 'info', checked: '2026-11-15' },
  { id: 'E-NS-SI', countries: ['SI'], trigger: { country: true }, severity: 'info', checked: '2026-11-15' },
  { id: 'E-NS-HK', countries: ['HK'], trigger: { country: true }, severity: 'info', checked: '2026-11-15' },
  { id: 'E-NS-DE', countries: ['DE'], trigger: { country: true }, severity: 'info', checked: '2026-11-15' },
  { id: 'E-NS-UK', countries: ['GB'], trigger: { country: true }, severity: 'info', checked: '2026-11-15' },
  { id: 'E-NS-ES', countries: ['ES'], trigger: { country: true }, severity: 'info', checked: '2026-11-15' },
]);
