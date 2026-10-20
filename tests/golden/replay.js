// Shared replay for the SI-refactor golden master (see si-golden-cases.js):
// one test per case kind, re-running every recorded input through the
// kind's current runner and comparing against the recorded output.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { installFakeDom } from '../helpers/fake-dom.js';

installFakeDom();
const { RUNNERS, encode, decode, compareOutputs } = await import('./si-golden-cases.js');

// Per-kind tolerance overrides, for kinds whose solvers iterate to a
// tolerance of their own (an ulp-level input change can move the result
// by up to that tolerance). Empty until an engine change actually needs one.
const TOLERANCES = {};

export function replayKinds(kinds) {
  for (const kind of kinds) {
    test(`golden master: ${kind} reproduces the pre-refactor engine`, async () => {
      const fixture = JSON.parse(readFileSync(fileURLToPath(new URL(`./${kind}.json`, import.meta.url)), 'utf8'));
      const failures = [];
      for (const [i, { input, output }] of fixture.cases.entries()) {
        let actual;
        try {
          actual = encode(await RUNNERS[kind](decode(structuredClone(input))));
        } catch (err) {
          actual = { $error: String((err && err.message) || err) };
        }
        const diffs = compareOutputs(decode(output), decode(actual), TOLERANCES[kind]);
        if (diffs.length) failures.push(`case ${i}: ${diffs.slice(0, 3).join('; ')}`);
        if (failures.length >= 5) break;
      }
      assert.deepEqual(failures, []);
    });
  }
}
