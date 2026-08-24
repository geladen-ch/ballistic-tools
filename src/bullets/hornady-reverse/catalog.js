// The "Hornady Reverse Radar" built-in bullet library — see
// ../bullet-libraries.js for the registry entry (name/description/prefix)
// this list belongs to. Kept as a real ES module rather than JSON for the
// same reason every other library's own catalog.js is: both the app and
// the module-type service worker can `import` it directly, with no fetch.
export const BULLET_IDS = [
  'hrr-30-eldm-208',
  'hrr-338-atip-300',
  'hrr-338-eldm-285',
  'hrr-50-amax-750',
  'hrr-65-eldm-147'
];
