// Text for a position, in the form the user types it: decimal degrees. The values are radians; the conversion goes
// through the display layer of units.js, like every other shown quantity.
import { siToDisplay, roundForDisplay } from '../../units.js';

const GEO_UNIT = 'deg';

function degrees(fieldId, rad) {
  return roundForDisplay(fieldId, GEO_UNIT, siToDisplay(fieldId, rad, GEO_UNIT));
}

/** "47.37, 8.54" for a latitude and longitude in radians. */
export function formatCoordinates(latitudeRad, longitudeRad) {
  return `${degrees('latitudeRad', latitudeRad)}, ${degrees('longitudeRad', longitudeRad)}`;
}

/** Does a location record hold a position? */
export function hasCoordinates(location) {
  return Number.isFinite(location?.latitudeRad) && Number.isFinite(location?.longitudeRad);
}
