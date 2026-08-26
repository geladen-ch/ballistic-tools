// Shared marker colors for anything that draws shots/PoA/POI/calibration
// onto a target photo *outside* the precision-report diagram itself —
// rifle-precision-marking-view.js's own live overlay, and
// rifle-precision-photo-export.js's own "Save group overview image" PNG
// export. Re-exports the diagram's own three colors (so both places
// genuinely share one definition, not just visually-matching duplicates)
// plus one new color the diagram itself never draws: the calibration
// ruler.
export { COLOR_POOLED_SHOT, COLOR_POA, COLOR_POI } from './analysis-diagram.js';

export const COLOR_CALIBRATION = '#2ecc71';
