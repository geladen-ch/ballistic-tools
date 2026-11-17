// Shared helpers for the weather tests: saved service responses and a tolerance assertion.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const FIXTURES = new URL('../fixtures/weather/', import.meta.url);

/** Saved JSON response. */
export function fixture(name) {
  return JSON.parse(readFileSync(new URL(name, FIXTURES), 'utf8'));
}

/** Saved text response (CSV); pass 'iso-8859-1' for the MeteoSwiss metadata. */
export function fixtureText(name, encoding = 'utf-8') {
  return new TextDecoder(encoding).decode(readFileSync(new URL(name, FIXTURES)));
}

/** |actual − expected| ≤ tol. */
export function near(actual, expected, tol, msg = '') {
  assert.ok(Math.abs(actual - expected) <= tol, `${msg} expected ${expected} ± ${tol}, got ${actual}`);
}
