// Air density from local conditions, including the (small, counterintuitive)
// effect of humidity: water vapor is LESS dense than dry air at the same
// temperature and pressure, so humid air is slightly less dense overall.
// tempC/pressureHpa here are always the *actual local* conditions at
// wherever density is being evaluated — altitude effects are handled
// upstream by siteBarometricPressure()/temperatureAtHeightDelta()/
// pressureAtHeightDelta() below, not by this function.
export function airDensity({ tempC, pressureHpa, humidityPct = 0 }) {
  const tempK = tempC + 273.15;
  const pressurePa = pressureHpa * 100;
  const satVaporPa = 611.21 * Math.exp((18.678 - tempC / 234.5) * (tempC / (257.14 + tempC)));
  const vaporPa = (humidityPct / 100) * satVaporPa;
  const dryPa = pressurePa - vaporPa;
  const R_DRY = 287.05;
  const R_VAPOR = 461.495;
  return dryPa / (R_DRY * tempK) + vaporPa / (R_VAPOR * tempK);
}

export function speedOfSound(tempC) {
  const GAMMA = 1.4;
  const R_DRY = 287.05;
  return Math.sqrt(GAMMA * R_DRY * (tempC + 273.15));
}

// Speed of sound at standard sea level (15°C) — the fixed reference every
// "idealized reference curve, not a real trajectory" Mach conversion in
// this app uses (bc-convert.js's single-point BC conversion, and
// bc-segments-cd.js's speed-segment <-> Mach boundaries), rather than
// each recomputing speedOfSound(15) on its own.
export const STANDARD_SEA_LEVEL_SOUND_MS = speedOfSound(15);

// Standard (ICAO) atmosphere: how temperature and pressure change with
// altitude. pressureHpa/tempC (state inputs elsewhere in this app) are the
// shooter's own actual station readings, taken at face value at their own
// elevation (altitudeM) — real weather, not assumed to match the ICAO
// standard. What IS trusted from the standard model is its *rate* of
// change with altitude: the fixed lapse rate for temperature, and — for
// pressure, which isn't linear in altitude — the *ratio* the standard
// curve predicts between two altitudes, applied as a scaling factor to the
// real local measurement rather than replacing it outright.
const LAPSE_RATE = 0.0065; // K/m, ICAO standard atmosphere, troposphere (0-11km) — real shots never approach the tropopause
const STD_SEA_LEVEL_TEMP_C = 15;
const STD_SEA_LEVEL_PRESSURE_HPA = 1013.25;
// Barometric formula exponent g*M/(R*L): g=9.80665 m/s^2 (standard
// gravity), M=0.0289644 kg/mol (molar mass of dry air), R=8.314462618
// J/(mol*K) (universal gas constant), L=LAPSE_RATE above.
const BAROMETRIC_EXPONENT = (9.80665 * 0.0289644) / (8.314462618 * LAPSE_RATE);

// The ICAO standard atmosphere's own pressure at a given altitude above
// sea level — the textbook formula, always referenced from the fixed
// standard sea-level constants above. Exported only as a *ratio* input for
// pressureAtAltitude() below (or for tests to check against published ISA
// tables) — real station pressure at any given site routinely differs
// from what this predicts, since it's actual weather, not the standard.
export function icaoStandardPressureHpa(altitudeM) {
  const ratio = 1 - (LAPSE_RATE * altitudeM) / (STD_SEA_LEVEL_TEMP_C + 273.15);
  // Below the (linear) lapse-rate model's absolute-zero point — hundreds
  // of kilometers down, "the atmosphere runs out" — the formula breaks
  // down (a negative base raised to a non-integer power isn't real). No
  // real shot gets remotely close; clamp defensively rather than hand
  // back NaN.
  return STD_SEA_LEVEL_PRESSURE_HPA * Math.pow(Math.max(ratio, 1e-6), BAROMETRIC_EXPONENT);
}

// Temperature at a height delta above/below a point with a known
// temperature — the ICAO lapse rate is linear, so this is exact
// regardless of how far the known point's actual temperature differs from
// the ICAO standard (the lapse *rate* is what's trusted, not any absolute
// standard temperature).
export function temperatureAtHeightDelta(tempC, heightDeltaM) {
  return tempC - LAPSE_RATE * heightDeltaM;
}

// Pressure at altitudeM, given the shooter's own actual station pressure
// measured at siteAltitudeM — scales that real local measurement by the
// *ratio* the ICAO standard atmosphere predicts between the two
// altitudes, rather than assuming the site itself sits at standard
// conditions (it usually doesn't).
export function pressureAtAltitude(sitePressureHpa, siteAltitudeM, altitudeM) {
  return sitePressureHpa * (icaoStandardPressureHpa(altitudeM) / icaoStandardPressureHpa(siteAltitudeM));
}

// Temperature and pressure the ICAO standard atmosphere itself predicts at
// altitudeM — the "Standard atmosphere" preset's own formula (see
// atmosphere-section.js): unlike pressureAtAltitude()/
// temperatureAtHeightDelta() above, this doesn't take a real station
// reading at all, it *is* the textbook reference value.
export function standardAtmosphereAt(altitudeM) {
  return {
    tempC: temperatureAtHeightDelta(STD_SEA_LEVEL_TEMP_C, altitudeM),
    pressureHpa: icaoStandardPressureHpa(altitudeM)
  };
}

// Inverse of icaoStandardPressureHpa() — the altitude at which the ICAO
// standard atmosphere would predict exactly this pressure. Used whenever a
// real station pressure is entered without an altitude of its own (a
// preset, or hand-typed "Real conditions" — see atmosphere-section.js): it
// gives the in-flight altitude-drift correction in trajectory.js a
// physically reasonable reference point instead of silently assuming sea
// level. Closed-form since the forward formula is already a plain power
// law — no iteration needed.
export function altitudeFromPressureHpa(pressureHpa) {
  const ratio = Math.pow(pressureHpa / STD_SEA_LEVEL_PRESSURE_HPA, 1 / BAROMETRIC_EXPONENT);
  return ((STD_SEA_LEVEL_TEMP_C + 273.15) * (1 - ratio)) / LAPSE_RATE;
}
