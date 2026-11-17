// The weather engine's shared runtime: one network client (per-host spacing: IEM etiquette 1.1 s, GeoSphere 5
// requests/s, the others 0.2 s), one cache and one availability record for the whole app, created on first use.
import { createNet } from './net.js';
import { createWeatherCache } from './cache.js';
import { createAvailability, anyAutoAvailable } from './availability.js';
import { sources } from './sources/index.js';
import { sourceMode } from './activation.js';
import { getOnlineWeatherSettings, isOnlineWeatherEnabled } from '../online-weather-prefs.js';

const SPACING_MS = {
  'mesonet.agron.iastate.edu': 1100, 'dataset.api.hub.geosphere.at': 250, 'api.brightsky.dev': 200,
  'opendataapi.dmi.dk': 200, 'api.weather.gc.ca': 200
};

let runtime = null;

/** @returns {{net, cache, availability, sources}} */
export function getWeatherRuntime() {
  if (!runtime) {
    const net = createNet({ timeoutMs: 30000, spacingMs: SPACING_MS });
    runtime = { net, cache: createWeatherCache(), availability: createAvailability({ probe: net.probe }), sources };
  }
  return runtime;
}

/** The mode (auto/off) each service has now: the user's choice, else its default. */
export function currentModes() {
  const { sources: chosen } = getOnlineWeatherSettings();
  return Object.fromEntries(sources.map((s) => [s.id, sourceMode(s, chosen)]));
}

/**
 * Can the tools offer Get weather? The feature is on and at least one Auto service is not known to be unreachable.
 * (A position check is separate: tools also need a complete, valid position.)
 */
export function isOnlineWeatherUsable() {
  if (!isOnlineWeatherEnabled()) return false;
  const modes = currentModes();
  return anyAutoAvailable(sources, (s) => modes[s.id], getWeatherRuntime().availability);
}

// ---- test-only ----
/** Replace the shared runtime (a fake network, cache or availability record). */
export function setWeatherRuntimeForTests(replacement) {
  runtime = replacement ? { sources, ...replacement } : null;
}
