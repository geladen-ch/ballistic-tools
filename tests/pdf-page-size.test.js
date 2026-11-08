// PDF template page size: absolute SVG lengths to metres, and the
// same-size rule for the pages of one document.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSvgLengthM, pageSizeM, sameSize } from '../src/pdf/page-size.js';
import { mmToM, inToM, mToPoint } from '../src/quantity.js';

test('absolute units convert to metres', () => {
  assert.equal(parseSvgLengthM('210mm'), mmToM(210));
  assert.equal(parseSvgLengthM('21cm'), mmToM(210));
  assert.equal(parseSvgLengthM('8.5in'), inToM(8.5));
  assert.equal(parseSvgLengthM('72pt'), inToM(1));
  assert.equal(parseSvgLengthM(' 1e2 mm '), mmToM(100));
});

test('unitless, px, relative and missing lengths are rejected', () => {
  for (const bad of ['210', '794px', '100%', '10em', '', null, undefined, 'mm']) {
    assert.throws(() => parseSvgLengthM(bad), /mm, cm, in or pt/, String(bad));
  }
});

test('A4 in metres is 595.28 × 841.89 PDF points', () => {
  const a4 = pageSizeM('210mm', '297mm');
  assert.ok(Math.abs(mToPoint(a4.widthM) - 595.2755905511812) < 1e-9);
  assert.ok(Math.abs(mToPoint(a4.heightM) - 841.8897637795276) < 1e-9);
});

test('sameSize tolerates unit noise, not different paper', () => {
  assert.ok(sameSize(pageSizeM('210mm', '148mm'), pageSizeM('21cm', '14.8cm')));
  assert.ok(!sameSize(pageSizeM('210mm', '148mm'), pageSizeM('148mm', '210mm')));
  assert.ok(!sameSize(pageSizeM('210mm', '297mm'), pageSizeM('8.5in', '11in')));
});
