import test from 'node:test';
import assert from 'node:assert/strict';
import { parseVelocityTable } from '../src/ui/velocity-table-parse.js';

const M_FPS = { distanceUnit: 'm', velocityUnit: 'm/s' };

test('parses a well-formed table into rangeM/velocityMs points', () => {
  const result = parseVelocityTable('0 855\n100 807\n200 759', M_FPS);
  assert.deepEqual(result, { points: [
    { rangeM: 0, velocityMs: 855 },
    { rangeM: 100, velocityMs: 807 },
    { rangeM: 200, velocityMs: 759 }
  ] });
});

test('accepts a decimal comma as well as a decimal point', () => {
  const result = parseVelocityTable('0 855,5\n100,5 807\n200 759', M_FPS);
  assert.deepEqual(result.points[0], { rangeM: 0, velocityMs: 855.5 });
  assert.deepEqual(result.points[1], { rangeM: 100.5, velocityMs: 807 });
});

test('accepts tab, space or semicolon as field separator, any mix of them', () => {
  const result = parseVelocityTable('0\t855\n100 807\n200;759\n300  ;\t 711', M_FPS);
  assert.deepEqual(result.points.map((p) => p.rangeM), [0, 100, 200, 300]);
  assert.deepEqual(result.points.map((p) => p.velocityMs), [855, 807, 759, 711]);
});

test('ignores blank lines', () => {
  const result = parseVelocityTable('\n0 855\n\n100 807\n200 759\n\n', M_FPS);
  assert.equal(result.points.length, 3);
});

test('rejects a line with the wrong number of columns', () => {
  assert.deepEqual(
    parseVelocityTable('0 855\n100\n200 759', M_FPS),
    { error: { key: 'cdMachCurve.tableErrorBadLine', params: { line: 2 } } }
  );
  assert.deepEqual(
    parseVelocityTable('0 855\n100 807 extra\n200 759', M_FPS),
    { error: { key: 'cdMachCurve.tableErrorBadLine', params: { line: 2 } } }
  );
});

test('rejects non-numeric tokens', () => {
  assert.deepEqual(
    parseVelocityTable('0 855\nabc 807\n200 759', M_FPS),
    { error: { key: 'cdMachCurve.tableErrorBadLine', params: { line: 2 } } }
  );
});

test('rejects fewer than 3 valid rows', () => {
  assert.deepEqual(parseVelocityTable('0 855\n100 807', M_FPS), { error: { key: 'cdMachCurve.tableErrorTooFewRows' } });
  assert.deepEqual(parseVelocityTable('', M_FPS), { error: { key: 'cdMachCurve.tableErrorTooFewRows' } });
});

test('converts distance and velocity from the given units into engine units', () => {
  const result = parseVelocityTable('0 2800\n100 2600\n200 2400', { distanceUnit: 'yd', velocityUnit: 'ft/s' });
  // 100 yd -> m, 2800 ft/s -> m/s (via the same FIELD_UNITS conversions unitField()/atmosphereSection() use elsewhere)
  assert.ok(Math.abs(result.points[1].rangeM - 91.44) < 1e-6, `got ${result.points[1].rangeM}`);
  assert.ok(Math.abs(result.points[0].velocityMs - 853.44) < 1e-2, `got ${result.points[0].velocityMs}`);
});
