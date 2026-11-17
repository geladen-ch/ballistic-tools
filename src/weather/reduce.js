// Reduce a normalised observation to the device height. Decides which height each quantity refers to; all physics
// goes through atmosphere.js.
// Pressure: hypsometric with the station's temperature (QNH first to station level by ISA, which is exact); ISA when
// the report has no temperature (flag pressureIsa). Temperature: ISA lapse rate. RH: not adjusted in height.
import { isaPressureFromQnh, isaShiftPressure, isaShiftTemperature, isaQnhFromPressure, hypsometricShiftPressure } from './atmosphere.js';

/**
 * @param {import('./sources/types.js').Observation} obs
 * @param {number|null} deviceHeightM  device height, metres above mean sea level
 * @param {{layerTempC?:number|null}} [opt]  station temperature for the pressure layer (default obs.temperatureC);
 *   the pipeline passes the reported value when obs.temperatureC is time-corrected
 * @returns {{
 *   pressurePa:number|null, temperatureC:number|null, humidity:number|null,
 *   station:{qnhPa:number|null, pressurePa:number|null, pressureRefM:number|null},
 *   pressureRef:{kind:string, hM:number|null}|null, temperatureRefM:number|null,
 *   flags:string[]
 * }}
 */
export function reduceToDevice(obs, deviceHeightM, { layerTempC = obs.temperatureC } = {}) {
  const flags = [];
  const st = obs.station;
  const out = {
    pressurePa: null, temperatureC: null, humidity: obs.humidity ?? null,
    station: { qnhPa: null, pressurePa: null, pressureRefM: null },
    pressureRef: null, temperatureRefM: null, flags,
  };
  const haveH = Number.isFinite(deviceHeightM);
  if (!haveH) flags.push('noDeviceAltitude');

  // Pressure: reference height depends on what the source reports.
  const p = obs.pressure;
  if (!p) flags.push('noPressure');
  else if (p.kind === 'mslp') {
    // Sea-level pressure only (QFF/SLP, reduced with the real temperature by national methods): not converted and not
    // used. Validated worldwide on a year of hourly reports: it makes the result worse than no pressure from that
    // station. The station still contributes temperature and humidity; the reported value stays in the report.
    flags.push('mslpNotUsed');
    out.pressureRef = { kind: 'mslp', hM: 0 };
  } else if (p.kind === 'qnh') {
    // QNH refers to the ISA zero point by definition: exact ISA inverse.
    out.pressureRef = { kind: p.kind, hM: 0 };
    out.station.qnhPa = p.pa;
    if (Number.isFinite(st.elevM)) {
      out.station.pressurePa = isaPressureFromQnh(p.pa, st.elevM);
      out.station.pressureRefM = st.elevM;
    }
    if (haveH) {
      if (Number.isFinite(st.elevM) && Number.isFinite(layerTempC)) {
        out.pressurePa = hypsometricShiftPressure(out.station.pressurePa, st.elevM, deviceHeightM, layerTempC);
      } else {
        out.pressurePa = isaPressureFromQnh(p.pa, deviceHeightM);           // exact at the station, ISA in between
        flags.push('pressureIsa');
      }
    }
  } else if (p.kind === 'station') {
    let h = st.barometerM;
    if (!Number.isFinite(h)) {
      h = st.elevM;
      if (Number.isFinite(h)) flags.push('baroHeightAssumed');
    }
    if (Number.isFinite(h)) {
      out.pressureRef = { kind: 'station', hM: h };
      out.station.pressurePa = p.pa;
      out.station.pressureRefM = h;
      out.station.qnhPa = isaQnhFromPressure(p.pa, h);
      if (haveH) {
        if (Number.isFinite(layerTempC)) {
          // temperature measured at the station elevation, moved to the barometer height (metres apart: negligible)
          const tBaro = Number.isFinite(st.elevM) ? isaShiftTemperature(layerTempC, st.elevM, h) : layerTempC;
          out.pressurePa = hypsometricShiftPressure(p.pa, h, deviceHeightM, tBaro);
        } else {
          out.pressurePa = isaShiftPressure(p.pa, h, deviceHeightM);
          flags.push('pressureIsa');
        }
      }
    } else {
      flags.push('noPressureHeight');
      out.station.pressurePa = p.pa;
    }
  }

  // Temperature: refers to the sensor height = station elevation.
  if (Number.isFinite(obs.temperatureC)) {
    if (Number.isFinite(st.elevM)) {
      out.temperatureRefM = st.elevM;
      if (haveH) out.temperatureC = isaShiftTemperature(obs.temperatureC, st.elevM, deviceHeightM);
    } else {
      flags.push('tempNotAdjusted');
      out.temperatureC = obs.temperatureC;
    }
  } else flags.push('noTemperature');

  // Relative humidity: not adjusted in height (validated); the time correction is applied by the pipeline.
  return out;
}
