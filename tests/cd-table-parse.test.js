import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCdTable, formatCdTable } from '../src/ui/arsenal/cd-table-parse.js';

test('parses a well-formed table into [mach, cd] pairs', () => {
  const result = parseCdTable('0.85 0.230\n0.95 0.310\n1.00 0.380');
  assert.deepEqual(result, { table: [[0.85, 0.230], [0.95, 0.310], [1.00, 0.380]] });
});

test('ignores blank lines and trims surrounding/extra whitespace', () => {
  const result = parseCdTable('\n  0.85   0.230  \n\n0.95 0.310\n\n');
  assert.deepEqual(result, { table: [[0.85, 0.230], [0.95, 0.310]] });
});

test('accepts exactly the 2-row minimum', () => {
  const result = parseCdTable('0.5 0.2\n1.0 0.4');
  assert.equal(result.table.length, 2);
});

test('rejects fewer than 2 rows', () => {
  assert.deepEqual(parseCdTable(''), { error: { key: 'arsenal.cdTableErrorTooFewRows' } });
  assert.deepEqual(parseCdTable('0.85 0.230'), { error: { key: 'arsenal.cdTableErrorTooFewRows' } });
});

test('rejects a line with the wrong number of columns', () => {
  assert.deepEqual(
    parseCdTable('0.85 0.230\n0.95\n1.00 0.380'),
    { error: { key: 'arsenal.cdTableErrorBadLine', params: { line: 2 } } }
  );
  assert.deepEqual(
    parseCdTable('0.85 0.230\n0.95 0.310 extra\n1.00 0.380'),
    { error: { key: 'arsenal.cdTableErrorBadLine', params: { line: 2 } } }
  );
});

test('rejects non-numeric tokens', () => {
  assert.deepEqual(
    parseCdTable('0.85 0.230\nabc 0.310'),
    { error: { key: 'arsenal.cdTableErrorBadLine', params: { line: 2 } } }
  );
});

test('rejects a negative Mach or a non-positive Cd', () => {
  assert.deepEqual(
    parseCdTable('-0.1 0.230\n0.95 0.310'),
    { error: { key: 'arsenal.cdTableErrorBadValue', params: { line: 1 } } }
  );
  assert.deepEqual(
    parseCdTable('0.5 0.230\n0.85 0'),
    { error: { key: 'arsenal.cdTableErrorBadValue', params: { line: 2 } } }
  );
  assert.deepEqual(
    parseCdTable('0.85 -0.1\n0.95 0.310'),
    { error: { key: 'arsenal.cdTableErrorBadValue', params: { line: 1 } } }
  );
});

test('accepts a Mach of exactly 0 (a valid, meaningful value)', () => {
  const result = parseCdTable('0 0.230\n0.5 0.310');
  assert.deepEqual(result.table[0], [0, 0.230]);
});

test('rejects Mach values that don\'t strictly increase — equal or out of order', () => {
  assert.deepEqual(
    parseCdTable('0.85 0.230\n0.85 0.310'),
    { error: { key: 'arsenal.cdTableErrorNotIncreasing', params: { line: 2 } } }
  );
  assert.deepEqual(
    parseCdTable('0.95 0.230\n0.85 0.310'),
    { error: { key: 'arsenal.cdTableErrorNotIncreasing', params: { line: 2 } } }
  );
});

test('formatCdTable is the inverse of parseCdTable for a well-formed table', () => {
  const table = [[0.85, 0.23], [0.95, 0.31], [1, 0.38]];
  const text = formatCdTable(table);
  assert.deepEqual(parseCdTable(text).table, table);
});
