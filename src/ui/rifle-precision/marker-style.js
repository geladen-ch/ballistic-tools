// Shared marker colors for anything that draws shots/PoA/POI/calibration
// onto a target photo *outside* the precision-report diagram itself —
// rifle-precision-marking-view.js's own live overlay, and
// rifle-precision-photo-export.js's own "Save group overview image" PNG
// export. Re-exports the diagram's own colors (so both places genuinely
// share one definition, not just visually-matching duplicates) plus one
// new color the diagram itself never draws: the calibration ruler.
//
// Impacts are the exception to "color": pooledShotColor() is a function,
// since it resolves the user's own app-wide impact-color pick at draw
// time (see analysis-diagram.js), and every impact drawn on a photo
// carries the same white/dark edge the diagram's own dots do — re-
// exported here too so a photo-drawing caller needs one import, not two.
export { pooledShotColor, COLOR_POA, COLOR_POI } from './analysis-diagram.js';
export {
  IMPACT_EDGE_WHITE_RATIO, IMPACT_EDGE_DARK_RATIO, IMPACT_EDGE_WHITE_COLOR, IMPACT_EDGE_DARK_COLOR
} from '../../hit-probability-prefs.js';

export const COLOR_CALIBRATION = '#2ecc71';
