// Explicit conversion functions for moving weather-station values to the shooter's height: the ICAO standard
// atmosphere in its exact altimeter form, the hypsometric pressure shift, and relative humidity at constant vapour
// pressure. This is the only module of the weather engine that computes atmospheric physics. It is separate from
// src/engine/atmosphere.js on purpose: the ballistic engine uses the scale form of the standard atmosphere, while
// reducing a report (QNH to station pressure and back) needs the exact altimeter form, and the two must not be mixed.
// Units: Pa, °C, metres (orthometric, above mean sea level); humidity as a fraction 0..1.
import { celsiusToKelvin } from '../quantity.js';

export const ISA = Object.freeze({
  T0: 288.15,          // K, sea-level temperature
  P0: 101325,          // Pa, sea-level pressure
  L: 0.0065,           // K/m, tropospheric lapse rate
  g0: 9.80665,         // m/s²
  M: 0.0289644,        // kg/mol
  R: 8.31432,          // J/(mol·K), ICAO value
});
export const N_EXP = ISA.g0 * ISA.M / (ISA.R * ISA.L);       // 5.255876
const K_EXP = 1 / N_EXP;                                       // 0.19026324
/** P0^k · L / T0, in Pa^k per metre (the pressure unit enters through P0). */
export const K_ALT = ISA.P0 ** K_EXP * ISA.L / ISA.T0;

/** Pressure at height h from an altimeter setting (QNH). Exact inverse of the QNH definition. */
export function isaPressureFromQnh(qnhPa, hM) {
  return (qnhPa ** K_EXP - K_ALT * hM) ** N_EXP;
}

/** QNH equivalent of a pressure measured at height h. Display / cross-check only. */
export function isaQnhFromPressure(pPa, hM) {
  return (pPa ** K_EXP + K_ALT * hM) ** N_EXP;
}

/** Move an absolute pressure known at hFrom to hTo along the ISA profile. */
export function isaShiftPressure(pPa, hFromM, hToM) {
  return (pPa ** K_EXP - K_ALT * (hToM - hFromM)) ** N_EXP;
}

/** Specific gas constant of dry air, J/(kg·K): R (ICAO, per mol) divided by M = 287.053. */
export const R_DRY = ISA.R / ISA.M;

/**
 * Move an absolute pressure known at hFrom to hTo with the hypsometric equation. Layer mean temperature from the
 * temperature measured at hFrom and the ISA lapse rate: T̄ = t + 273.15 − L·(hTo − hFrom)/2. Use the station's
 * reported temperature (not time-corrected); without a temperature use isaShiftPressure.
 */
export function hypsometricShiftPressure(pPa, hFromM, hToM, tFromC) {
  const dh = hToM - hFromM;
  return pPa * Math.exp(-ISA.g0 * dh / (R_DRY * (celsiusToKelvin(tFromC) - ISA.L * dh / 2)));
}

/** Move a temperature from hFrom to hTo with the ISA lapse rate. */
export function isaShiftTemperature(tC, hFromM, hToM) {
  return tC - ISA.L * (hToM - hFromM);
}

const MAGNUS_A = 17.625, MAGNUS_B = 243.04;   // °C, WMO convention (over water, also below 0 °C)
const E_S0_PA = 610.94;                        // Pa

/** Saturation vapour pressure over water (Pa), Magnus. */
export function saturationVapourPressure(tC) {
  return E_S0_PA * Math.exp(MAGNUS_A * tC / (MAGNUS_B + tC));
}

/**
 * Relative humidity (fraction) after a temperature change at constant vapour pressure, capped at 1. Used for the
 * time correction only (temperature brought forward to "now"): humidity is not adjusted in height.
 */
export function rhAtConstantVapour(rh, tFromC, tToC) {
  return Math.min(1, rh * saturationVapourPressure(tFromC) / saturationVapourPressure(tToC));
}

/** Relative humidity (fraction) from temperature and dew point, Magnus formula over water (WMO convention). */
export function dewpointToRH(tC, tdC) {
  return Math.exp(MAGNUS_A * tdC / (MAGNUS_B + tdC) - MAGNUS_A * tC / (MAGNUS_B + tC));
}
