import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from './helpers/fake-dom.js';
import { freshId } from './helpers/fresh-import.js';

installFakeDom();

const {
  getFieldSeparator, setFieldSeparator, getDecimalSeparator, setDecimalSeparator,
  FIELD_SEPARATOR_CHOICES, DECIMAL_SEPARATOR_CHOICES
} = await import('../src/csv-prefs.js');
const { getCookie, setCookie, removeCookie } = await import('../src/cookies.js');

test('defaults are comma field separator, dot decimal separator', () => {
  removeCookie('ballistics_csv_field_separator_v1');
  removeCookie('ballistics_csv_decimal_separator_v1');
  assert.equal(getFieldSeparator(), ',');
  assert.equal(getDecimalSeparator(), '.');
});

test('setFieldSeparator/setDecimalSeparator update the read value and persist to a cookie', () => {
  setFieldSeparator(';');
  assert.equal(getFieldSeparator(), ';');
  assert.equal(getCookie('ballistics_csv_field_separator_v1'), ';');

  setDecimalSeparator(',');
  assert.equal(getDecimalSeparator(), ',');
  assert.equal(getCookie('ballistics_csv_decimal_separator_v1'), ',');

  setFieldSeparator(',');
  setDecimalSeparator('.');
});

test('a garbage/tampered cookie value falls back to the default rather than being trusted verbatim', () => {
  setCookie('ballistics_csv_field_separator_v1', 'not-a-real-separator');
  assert.equal(getFieldSeparator(), ',');
  removeCookie('ballistics_csv_field_separator_v1');
});

test('a value survives a fresh module load (session-to-session persistence)', async () => {
  setFieldSeparator('\t');
  const fresh = await import(`../src/csv-prefs.js?reload=${freshId()}`);
  assert.equal(fresh.getFieldSeparator(), '\t');
  setFieldSeparator(',');
});

test('FIELD_SEPARATOR_CHOICES/DECIMAL_SEPARATOR_CHOICES cover exactly what get/set accept', () => {
  assert.deepEqual(FIELD_SEPARATOR_CHOICES.map((c) => c.value), [',', ';', '\t']);
  assert.deepEqual(DECIMAL_SEPARATOR_CHOICES.map((c) => c.value), ['.', ',']);
});
