// The in-memory half of the debug logging every boot/loading path in this
// app writes to (see app.js, i18n.js, bullets.js, rifles.js, targets.js,
// and every built-in-catalog loader) — kept as its own leaf module, with
// no imports of its own, specifically so diagnostics.js (which needs data
// from bullets.js/rifles.js/targets.js to cross-reference cache contents)
// can read this buffer without those modules and diagnostics.js ending up
// in an import cycle over what's otherwise just a logging call.
const MAX_LOG_ENTRIES = 300;
const log = [];

export function logDiagnostic(level, ...args) {
  console[level](...args);
  log.push(`[${new Date().toISOString()}] ${level.toUpperCase()} ${args.map(String).join(' ')}`);
  if (log.length > MAX_LOG_ENTRIES) log.shift();
}

export function getDiagnosticLog() {
  return [...log];
}
