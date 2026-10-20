// Shared replay for the SI-refactor golden master (see si-golden-cases.js):
// one test per case kind, re-running every recorded input through the
// kind's current runner and comparing against the recorded output.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { installFakeDom } from '../helpers/fake-dom.js';

installFakeDom();
const { runCase, encode, decode, compareOutputs } = await import('./si-golden-cases.js');

// How close a replayed value must be to the recorded one: 1e-10 relative
// plus 1e-9 absolute, in the fixture's own units (1e-9 cm, 1e-9 mrad, ...).
// Moving an input through a unit conversion changes it in the last bit,
// and the engine's finite differences and near-zero results (a drop at
// the zero range, a sensitivity taken as the difference of two impacts)
// amplify that to around 1e-11 — physically nothing, while a genuine unit
// mistake is a factor of 10, 100 or 1000 and fails by many orders of
// magnitude. Per-kind overrides go in TOLERANCES.
const DEFAULT_TOLERANCE = { rel: 1e-10, abs: 1e-9 };
const TOLERANCES = {};

// Output paths that are not results and are left out of the comparison:
// the truing analysis's warm-start handle carries a fingerprint that is a
// JSON string of the state, field names included.
const IGNORED = { truingAnalyse: [['analysis', 'warm']] };
function withoutIgnored(kind, value) {
  for (const path of IGNORED[kind] || []) {
    let node = value;
    for (const key of path.slice(0, -1)) node = node && node[key];
    if (node && typeof node === 'object') delete node[path[path.length - 1]];
  }
  return value;
}

export function replayKinds(kinds) {
  for (const kind of kinds) {
    test(`golden master: ${kind} reproduces the pre-refactor engine`, async () => {
      const fixture = JSON.parse(readFileSync(fileURLToPath(new URL(`./${kind}.json`, import.meta.url)), 'utf8'));
      const failures = [];
      for (const [i, { input, output }] of fixture.cases.entries()) {
        let actual;
        try {
          actual = encode(await runCase(kind, decode(structuredClone(input))));
        } catch (err) {
          actual = { $error: String((err && err.message) || err) };
        }
        const diffs = compareOutputs(withoutIgnored(kind, decode(output)), withoutIgnored(kind, decode(actual)), TOLERANCES[kind] ?? DEFAULT_TOLERANCE);
        if (diffs.length) failures.push(`case ${i}: ${diffs.slice(0, 3).join('; ')}`);
        if (failures.length >= 5) break;
      }
      assert.deepEqual(failures, []);
    });
  }
}
