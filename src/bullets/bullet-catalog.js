// The list of bullets bundled with the app. This is code-shaped metadata
// (a plain id list), not data — kept as a real ES module rather than JSON
// so both the app (bullets.js) and the module-type service worker can
// `import` it directly, with no fetch and exactly one source of truth
// either side has to stay in sync with.
export const BULLET_IDS = [
  // Imported from data/bullets.info — see each file's own "source" field
  // for provenance.
  'hornady-30-eldm-208',
  'hornady-338-eldm-285',
  'hornady-50-amax-750',
  'hornady-65-eldm-147',
  'lapua-224-scenarl-69',
  'lapua-22lr',
  'lapua-30-scenar-167',
  'lapua-30-scenarl-155',
  'lapua-338-scenar-250',
  'lapua-338-scenar-300',
  'lapua-65-scenar-139',
  'lapua-65-scenarl-136',
  'nato-m193',
  'nato-m80',
  'nato-m855',
  'ruag-338-swissp-ball-252',
  'ruag-338-swissp-target-250',
  'russian-545x39-7n10',
  'russian-545x39-7n6',
  'russian-762x39-m43',
  'russian-762x54r-7n1',
  'swiss-gp11',
  'swiss-gp90'
];
