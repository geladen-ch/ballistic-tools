import test from 'node:test';
import assert from 'node:assert/strict';

const { isoDate } = await import('../src/ui/iso-date.js');

test('formats a date as YYYY-MM-DD', () => {
  assert.equal(isoDate('2026-09-21T12:00:00.000Z'), '2026-09-21');
});

test('pads a single-digit month and day', () => {
  assert.equal(isoDate('2026-03-05T12:00:00.000Z'), '2026-03-05');
});

test('accepts an ISO string, a number of milliseconds, or a Date', () => {
  const ms = Date.parse('2026-09-21T12:00:00.000Z');
  assert.equal(isoDate(ms), '2026-09-21');
  assert.equal(isoDate(new Date(ms)), '2026-09-21');
});

test('shows no time and no locale punctuation', () => {
  assert.match(isoDate('2026-09-21T19:18:33.000Z'), /^\d{4}-\d{2}-\d{2}$/);
});

test('an unparseable value gives an empty string rather than "NaN-NaN-NaN"', () => {
  assert.equal(isoDate('not a date'), '');
  assert.equal(isoDate(undefined), '');
  assert.equal(isoDate(NaN), '');
});

test('is the date in the viewer\'s own time zone, not the UTC date', () => {
  const original = process.env.TZ;
  try {
    // 23:30 UTC on the 21st is already the 22nd at UTC+14, and still the
    // 21st at UTC-10 — a toISOString().slice(0, 10) would say the 21st for both.
    process.env.TZ = 'Pacific/Kiritimati';
    assert.equal(isoDate('2026-09-21T23:30:00.000Z'), '2026-09-22');
    process.env.TZ = 'Pacific/Honolulu';
    assert.equal(isoDate('2026-09-21T23:30:00.000Z'), '2026-09-21');
    assert.equal(isoDate('2026-09-22T05:00:00.000Z'), '2026-09-21', 'before midnight there, though already the 22nd in UTC');
  } finally {
    if (original === undefined) delete process.env.TZ; else process.env.TZ = original;
  }
});
