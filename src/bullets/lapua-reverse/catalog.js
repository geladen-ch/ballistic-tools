// The "Lapua, reversed from Hornady radar" built-in bullet library —
// see ../bullet-libraries.js for the registry entry (name/description/
// prefix) this list belongs to. Kept as a real ES module rather than
// JSON for the same reason every other library's own catalog.js is: both
// the app and the module-type service worker can import it directly,
// with no fetch.
export const BULLET_IDS = [
  'hrl-30-scenar-167',
  'hrl-30-scenar-185',
  'hrl-30-scenarl-175',
  'hrl-30-scenarl-220',
  'hrl-338-lockbase-250',
  'hrl-338-scenar-300',
  'hrl-65-scenar-139',
  'hrl-65-scenarl-136'
];
