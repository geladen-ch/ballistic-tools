import test from 'node:test';
import assert from 'node:assert/strict';

const { buildCsv, formatCsvNumber } = await import('../src/csv-export.js');

test('buildCsv joins cells with the given field separator and CRLF between rows', () => {
  const csv = buildCsv([['Range (m)', 'Drop (cm)'], ['0', '0.0'], ['100', '-5.0']], ',');
  assert.equal(csv, 'Range (m),Drop (cm)\r\n0,0.0\r\n100,-5.0');
});

test('buildCsv supports non-comma field separators (e.g. semicolon, tab)', () => {
  assert.equal(buildCsv([['a', 'b']], ';'), 'a;b');
  assert.equal(buildCsv([['a', 'b']], '\t'), 'a\tb');
});

test('buildCsv quotes a cell that contains the field separator', () => {
  const csv = buildCsv([['Range (m, approx)', '0']], ',');
  assert.equal(csv, '"Range (m, approx)",0');
});

test('buildCsv quotes and escapes a cell containing a double quote', () => {
  const csv = buildCsv([['12" barrel']], ',');
  assert.equal(csv, '"12"" barrel"');
});

test('buildCsv quotes a cell containing a newline', () => {
  const csv = buildCsv([['line1\nline2']], ',');
  assert.equal(csv, '"line1\nline2"');
});

test('buildCsv leaves a plain cell unquoted even when other separators exist elsewhere', () => {
  // A tab-separated file shouldn't quote a cell just because it has a comma.
  const csv = buildCsv([['1,000', '2']], '\t');
  assert.equal(csv, '1,000\t2');
});

test('formatCsvNumber uses toFixed for the given decimals with a dot separator unchanged', () => {
  assert.equal(formatCsvNumber(12.345, 1, '.'), '12.3');
  assert.equal(formatCsvNumber(-5, 1, '.'), '-5.0');
});

test('formatCsvNumber substitutes the decimal separator without touching digits', () => {
  assert.equal(formatCsvNumber(12.345, 1, ','), '12,3');
  assert.equal(formatCsvNumber(1234.5, 1, ','), '1234,5');
});

test('formatCsvNumber with an integer-decimals column produces no separator at all', () => {
  assert.equal(formatCsvNumber(742.6, 0, ','), '743');
});
